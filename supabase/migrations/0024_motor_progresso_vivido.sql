-- ============================================================
-- 0024 — MOTOR DE PROGRESSO VIVIDO (PED1)
-- ------------------------------------------------------------
-- As fases 15.3–15.5 deixaram o modelo pedagógico no banco (níveis,
-- onboarding, missões, XP, conquistas) mas DORMENTE: nada concedia XP
-- por evento, nenhuma missão fechava sozinha, nível por matéria não
-- era persistido a partir do estudo real. Esta migration acende o
-- motor SEM enfraquecer a RLS:
--
--   • O aluno continua SEM poder se autopontuar (a policy de insert
--     direto em aluno_xp_eventos segue só para coordenação/servidor).
--   • Quem concede XP/fecha missão/persistе nível é um motor
--     SECURITY DEFINER (dono = postgres), disparado pelos MESMOS
--     eventos que o aluno já pode gravar: registro de estudo e
--     simulado (RLS de insert do aluno, intactas). É o padrão já
--     usado por app.registrar_nivel_historico (0011).
--
-- Idempotência (critério de aceite): cada concessão é amarrada à sua
-- ORIGEM + referência (missão/simulado/semana). Clique duplo, reload
-- ou retry reprocessam o mesmo evento e o índice único descarta o
-- duplicado — o XP/missão/conquista nunca conta duas vezes.
--
-- Honestidade do dado: XP só vem de DOMÍNIO (missão fechada com
-- acurácia, simulado entregue, semana cumprida) — nunca de volume
-- puro de cliques. Nível por matéria só é calculado com volume
-- mínimo; o motor NUNCA sobrescreve um nível 'manual' da coordenação.
--
-- Aditiva e idempotente. Rollback documentado no fim do arquivo e em
-- docs/auditoria/ped1/relatorio-ped1-motor-progresso-vivido.md.
-- ============================================================

-- ------------------------------------------------------------
-- 0) Gate de semeadura. Durante os seeds (que montam um estado de
--    fixture curado, com XP/níveis explícitos) o motor NÃO deve
--    disparar e duplicar concessões em cima do fixture. Os seeds
--    setam `app.motor_seed = 'on'` no início; o app real nunca seta.
-- ------------------------------------------------------------
create or replace function app.motor_semeando() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(current_setting('app.motor_seed', true), '') = 'on'
$$;

-- ------------------------------------------------------------
-- 1) exam_tag (concurso-alvo) do aluno. Sem alvo definido, o motor
--    não inventa: devolve null e os gatilhos param cedo.
-- ------------------------------------------------------------
create or replace function app.exam_tag_do_aluno(p_aluno uuid) returns text
language sql stable security definer set search_path = public, app as $$
  select c.codigo
  from alunos a
  join concursos c on c.id = a.concurso_id
  where a.id = p_aluno
$$;

-- ------------------------------------------------------------
-- 2) GUARDA DE IDEMPOTÊNCIA do ledger de XP. Uma concessão derivada
--    de um evento (missão/simulado/semana/conquista) carrega a
--    referência da fonte; o índice único impede a 2ª contagem.
--    Eventos sem referência (ajuste_manual da coordenação) ficam de
--    fora do índice — continuam livres como antes.
-- ------------------------------------------------------------
create unique index if not exists idx_xp_idem
  on aluno_xp_eventos (aluno_id, exam_tag, origem, referencia_id)
  where referencia_id is not null;

-- ------------------------------------------------------------
-- 3) CRITÉRIO ESTRUTURADO de missão. O `criterio_conclusao` textual
--    fica para a UI; o motor precisa de número para fechar sozinho.
--    meta_questoes + meta_acuracia tornam a missão máquina-avaliável.
--    Backfill conservador a partir do que a missão já sugeria.
-- ------------------------------------------------------------
alter table missoes
  add column if not exists meta_questoes int check (meta_questoes is null or meta_questoes >= 0),
  add column if not exists meta_acuracia int check (meta_acuracia is null or (meta_acuracia between 0 and 100));

update missoes
  set meta_questoes = coalesce(meta_questoes, qtd_questoes_sugerida),
      meta_acuracia = coalesce(meta_acuracia, 70)         -- piso de domínio padrão (🟡 calibrar)
  where qtd_questoes_sugerida is not null and meta_questoes is null;

-- ------------------------------------------------------------
-- 4) PROGRESSO/FECHAMENTO de missão por aluno. Uma linha por
--    (aluno, missão): acumulado de questões/acurácia na matéria e o
--    estado (em andamento / concluída). Isolado por escola (RLS).
--    Escrita pelo motor (SECURITY DEFINER) e pela coordenação.
-- ------------------------------------------------------------
create table if not exists aluno_missoes (
  id                  uuid primary key default gen_random_uuid(),
  escola_id           uuid not null references escolas (id) on delete cascade,
  aluno_id            uuid not null references alunos (id)  on delete cascade,
  missao_id           uuid not null references missoes (id) on delete cascade,
  exam_tag            text not null references concursos (codigo),
  estado              text not null default 'em_andamento' check (estado in ('em_andamento', 'concluida')),
  questoes_acumuladas int  not null default 0,
  acuracia            int  check (acuracia is null or (acuracia between 0 and 100)),
  xp_concedido        int  not null default 0,
  concluida_em        timestamptz,
  atualizado_em       timestamptz not null default now(),
  unique (aluno_id, missao_id)
);

create index if not exists idx_aluno_missoes_aluno on aluno_missoes (aluno_id, exam_tag);

alter table aluno_missoes enable row level security;

create policy aluno_missoes_select on aluno_missoes for select to authenticated
  using (
    escola_id = app.tenant_id() and (
      app.papel() = 'coordenacao'
      or aluno_id = app.meu_aluno_id()
      or (app.papel() = 'responsavel' and app.sou_responsavel_de(aluno_id))
    )
  );
-- Escrita direta é da coordenação (ajuste manual). O motor escreve
-- por SECURITY DEFINER, que ignora a RLS — o aluno NÃO fecha a própria
-- missão na unha (mesma doutrina do XP).
create policy aluno_missoes_coordenacao on aluno_missoes for all to authenticated
  using      (escola_id = app.tenant_id() and app.papel() = 'coordenacao')
  with check (escola_id = app.tenant_id() and app.papel() = 'coordenacao');

grant select, insert, update, delete on aluno_missoes to authenticated, service_role;

-- ============================================================
-- 5) PRIMITIVAS DO MOTOR (SECURITY DEFINER, dono = postgres).
--    Todas idempotentes. Nenhuma confia em quem chamou: derivam
--    escola_id/exam_tag do próprio aluno.
-- ============================================================

-- Concede um evento de XP de forma idempotente pela referência.
create or replace function app.motor_conceder_xp(
  p_escola uuid, p_aluno uuid, p_exam text,
  p_origem text, p_pontos int, p_descricao text, p_ref uuid
) returns void
language sql security definer set search_path = public, app as $$
  insert into aluno_xp_eventos (escola_id, aluno_id, exam_tag, origem, pontos, descricao, referencia_id)
  values (p_escola, p_aluno, p_exam, p_origem, p_pontos, p_descricao, p_ref)
  on conflict (aluno_id, exam_tag, origem, referencia_id) where referencia_id is not null
  do nothing;
$$;

-- Desbloqueia uma conquista (por código) e credita o bônus de XP da
-- conquista, tudo idempotente. Sem efeito se a conquista não existe.
create or replace function app.motor_desbloquear_conquista(
  p_escola uuid, p_aluno uuid, p_exam text, p_codigo text
) returns void
language plpgsql security definer set search_path = public, app as $$
declare
  v_conq  conquistas%rowtype;
  v_count int := 0;
begin
  select * into v_conq from conquistas where codigo = p_codigo;
  if not found then return; end if;

  insert into aluno_conquistas (escola_id, aluno_id, conquista_id, exam_tag)
  values (p_escola, p_aluno, v_conq.id, p_exam)
  on conflict (aluno_id, conquista_id, exam_tag) do nothing;
  get diagnostics v_count = row_count;

  if v_count > 0 and coalesce(v_conq.xp_bonus, 0) > 0 then
    perform app.motor_conceder_xp(
      p_escola, p_aluno, p_exam, 'conquista', v_conq.xp_bonus,
      'Bônus: ' || v_conq.nome, v_conq.id);
  end if;
end $$;

-- Comprimento da sequência de dias consecutivos de estudo mais
-- recente (constância). Honesto: conta a maior corrida que termina
-- no último dia estudado.
create or replace function app.motor_streak_dias(p_aluno uuid) returns int
language sql stable security definer set search_path = public, app as $$
  with dias as (
    select distinct data as d from registros_estudo where aluno_id = p_aluno
  ),
  grupos as (
    select d, (d - (row_number() over (order by d))::int) as grp from dias
  )
  select coalesce(count(*), 0)::int
  from grupos
  where grp = (select grp from grupos order by d desc limit 1)
$$;

-- ------------------------------------------------------------
-- 5.1) AVALIAÇÃO COMPLETA DO PROGRESSO de um aluno. Recalcula, a
--      partir do estudo real, o que está fechado: missões, níveis
--      por matéria e conquistas data-driven. Idempotente: só
--      ACRESCENTA (XP é ledger append-only; missão/conquista têm
--      unique). Exception-safe: um erro do motor jamais derruba o
--      registro de estudo do aluno.
-- ------------------------------------------------------------
create or replace function app.motor_avaliar_aluno(p_aluno uuid) returns void
language plpgsql security definer set search_path = public, app as $$
declare
  v_escola uuid;
  v_exam   text;
  v_streak int;
  r        record;
begin
  select escola_id into v_escola from alunos where id = p_aluno;
  v_exam := app.exam_tag_do_aluno(p_aluno);
  if v_escola is null or v_exam is null then return; end if;

  -- agregados por matéria (questões e acurácia sobre registros com acerto informado)
  -- usados tanto para missão quanto para nível e conquista de matéria.

  -- ----- MISSÕES: fecha quando bate volume E acurácia -----
  for r in
    select m.id              as missao_id,
           m.materia_codigo  as materia,
           coalesce(me.xp, m.xp_sugerido, 0) as xp,
           coalesce(me.qtd_questoes, m.meta_questoes) as meta_questoes,  -- escola pode elevar a barra de volume
           m.meta_acuracia,
           coalesce(agg.q, 0)   as q,
           agg.acc              as acc
    from missoes m
    left join missoes_escola me
           on me.missao_id = m.id and me.escola_id = v_escola
    left join lateral (
      select sum(questoes)::int as q,
             case when sum(questoes) filter (where acertos is not null) > 0
                  then round(100.0 * sum(acertos) filter (where acertos is not null)
                             / sum(questoes) filter (where acertos is not null))::int
             end as acc
      from registros_estudo re
      where re.aluno_id = p_aluno and re.disciplina_codigo = m.materia_codigo
    ) agg on true
    where m.exam_tag = v_exam
      and m.meta_questoes is not null
      and coalesce(me.ativa, true) = true       -- escola pode desligar a missão
  loop
    -- registra/atualiza o progresso (sempre), feche ou não
    insert into aluno_missoes (escola_id, aluno_id, missao_id, exam_tag, estado, questoes_acumuladas, acuracia)
    values (v_escola, p_aluno, r.missao_id, v_exam, 'em_andamento', r.q, r.acc)
    on conflict (aluno_id, missao_id) do update
      set questoes_acumuladas = excluded.questoes_acumuladas,
          acuracia            = excluded.acuracia,
          atualizado_em       = now()
      where aluno_missoes.estado <> 'concluida';   -- missão fechada não volta atrás

    -- fecha se o critério foi atingido (volume E domínio)
    if r.q >= r.meta_questoes
       and r.acc is not null
       and r.acc >= coalesce(r.meta_acuracia, 0) then
      update aluno_missoes
        set estado = 'concluida', xp_concedido = r.xp, concluida_em = coalesce(concluida_em, now()), atualizado_em = now()
        where aluno_id = p_aluno and missao_id = r.missao_id and estado <> 'concluida';
      if found and r.xp > 0 then
        perform app.motor_conceder_xp(
          v_escola, p_aluno, v_exam, 'missao', r.xp,
          'Missão concluída', r.missao_id);
      end if;
    end if;
  end loop;

  -- ----- NÍVEL por matéria (calculado), nunca sobre 'manual' -----
  for r in
    select re.disciplina_codigo as materia,
           sum(questoes)::int as q,
           case when sum(questoes) filter (where acertos is not null) > 0
                then round(100.0 * sum(acertos) filter (where acertos is not null)
                           / sum(questoes) filter (where acertos is not null))::int
           end as acc
    from registros_estudo re
    where re.aluno_id = p_aluno
    group by re.disciplina_codigo
  loop
    if r.q >= 20 and r.acc is not null then
      insert into aluno_niveis (escola_id, aluno_id, escopo, nivel, origem, motivo)
      values (
        v_escola, p_aluno, r.materia,
        case when r.acc < 40 then 'base'
             when r.acc >= 70 and r.q >= 100 then 'avancado'
             else 'intermediario' end,
        'calculado', 'recalculado pelo motor de progresso'
      )
      on conflict (aluno_id, escopo) do update
        set nivel = excluded.nivel, origem = 'calculado',
            motivo = excluded.motivo, atualizado_em = now()
        where aluno_niveis.origem in ('calculado', 'validar');  -- preserva manual/diagnóstico
    end if;
  end loop;

  -- ----- CONQUISTAS data-driven -----
  -- constância: maior corrida de dias consecutivos
  v_streak := app.motor_streak_dias(p_aluno);
  for r in
    select codigo, criterio from conquistas where tipo = 'constancia'
  loop
    if v_streak >= coalesce((r.criterio->>'dias')::int, 2147483647) then
      perform app.motor_desbloquear_conquista(v_escola, p_aluno, v_exam, r.codigo);
    end if;
  end loop;

  -- volume COM acurácia (anti-grind): questões nos últimos 30 dias e acurácia delas
  for r in
    select codigo, criterio from conquistas where tipo = 'volume'
  loop
    if exists (
      select 1
      from registros_estudo re
      where re.aluno_id = p_aluno and re.data >= (current_date - 30)
      having coalesce(sum(questoes), 0) >= coalesce((r.criterio->>'questoes')::int, 2147483647)
         and (sum(questoes) filter (where acertos is not null) = 0
              or round(100.0 * coalesce(sum(acertos) filter (where acertos is not null), 0)
                       / nullif(sum(questoes) filter (where acertos is not null), 0))
                 >= coalesce((r.criterio->>'acuracia_min')::int, 0))
    ) then
      perform app.motor_desbloquear_conquista(v_escola, p_aluno, v_exam, r.codigo);
    end if;
  end loop;

  -- matéria/alavancagem: acurácia da matéria-alvo bate o piso
  for r in
    select codigo, criterio from conquistas where tipo in ('materia', 'alavancagem')
  loop
    if exists (
      select 1
      from registros_estudo re
      where re.aluno_id = p_aluno
        and re.disciplina_codigo = (r.criterio->>'materia')
        and re.acertos is not null
      group by re.disciplina_codigo
      having sum(questoes) >= 20
         and round(100.0 * sum(acertos) / nullif(sum(questoes), 0)) >= coalesce((r.criterio->>'acuracia_min')::int, 2147483647)
    ) then
      perform app.motor_desbloquear_conquista(v_escola, p_aluno, v_exam, r.codigo);
    end if;
  end loop;

exception when others then
  -- O motor é efeito colateral: nunca pode derrubar o registro do
  -- aluno. Loga e segue (o evento será reprocessado no próximo).
  raise warning 'motor_avaliar_aluno(%) falhou: %', p_aluno, sqlerrm;
end $$;

-- ------------------------------------------------------------
-- 5.2) SIMULADO: concede XP de simulado (idempotente pela referência)
--      e desbloqueia a conquista de "primeiro simulado".
-- ------------------------------------------------------------
create or replace function app.motor_processar_simulado(p_simulado uuid) returns void
language plpgsql security definer set search_path = public, app as $$
declare
  s      simulados%rowtype;
  v_exam text;
begin
  select * into s from simulados where id = p_simulado;
  if not found then return; end if;
  v_exam := coalesce(s.exam_tag, app.exam_tag_do_aluno(s.aluno_id));
  if v_exam is null then return; end if;

  perform app.motor_conceder_xp(
    s.escola_id, s.aluno_id, v_exam, 'simulado', 150,
    'Simulado entregue: ' || coalesce(s.nome, ''), s.id);

  -- conquista de simulado (tipo 'simulado', critério {simulados: 1})
  perform app.motor_desbloquear_conquista(s.escola_id, s.aluno_id, v_exam, 'veterano');
exception when others then
  raise warning 'motor_processar_simulado(%) falhou: %', p_simulado, sqlerrm;
end $$;

-- ------------------------------------------------------------
-- 5.3) SEMANA COMPLETA: quando todas as atividades da meta ficam
--      'concluida', credita o bônus de semana (idempotente pela meta).
-- ------------------------------------------------------------
create or replace function app.motor_semana_completa(p_meta uuid) returns void
language plpgsql security definer set search_path = public, app as $$
declare
  v_meta   metas%rowtype;
  v_exam   text;
  v_pend   int;
begin
  select * into v_meta from metas where id = p_meta;
  if not found then return; end if;

  select count(*) into v_pend from meta_atividades where meta_id = p_meta and estado <> 'concluida';
  if v_pend > 0 then return; end if;       -- ainda há atividade aberta

  v_exam := app.exam_tag_do_aluno(v_meta.aluno_id);
  if v_exam is null then return; end if;

  perform app.motor_conceder_xp(
    v_meta.escola_id, v_meta.aluno_id, v_exam, 'semana_completa', 60,
    'Semana ' || v_meta.semana_numero || ' cumprida', v_meta.id);
exception when others then
  raise warning 'motor_semana_completa(%) falhou: %', p_meta, sqlerrm;
end $$;

-- ------------------------------------------------------------
-- 5.4) ONBOARDING do ALUNO (autoatendimento controlado). A RLS de
--      aluno_onboarding só deixa a coordenação escrever; aqui o aluno
--      grava o PRÓPRIO diagnóstico inicial por um caminho SECURITY
--      DEFINER que só toca a linha dele (app.meu_aluno_id()). Não
--      enfraquece a RLS: é escopo de uma linha, do próprio dono.
-- ------------------------------------------------------------
create or replace function public.salvar_onboarding_aluno(
  p_experiencia text,
  p_disponibilidade int,
  p_dificuldade text,
  p_objetivo text
) returns aluno_onboarding
language plpgsql security definer set search_path = public, app as $$
declare
  v_aluno  uuid := app.meu_aluno_id();
  v_escola uuid := app.tenant_id();
  v_row    aluno_onboarding;
begin
  if v_aluno is null then
    raise exception 'onboarding: sessão não corresponde a um aluno';
  end if;
  if p_disponibilidade is not null and (p_disponibilidade < 0 or p_disponibilidade > 168) then
    raise exception 'onboarding: disponibilidade semanal fora do intervalo (0..168)';
  end if;

  insert into aluno_onboarding (
    aluno_id, escola_id, experiencia_previa, disponibilidade_semanal_h,
    maior_dificuldade, objetivo, concluido_em, atualizado_em)
  values (
    v_aluno, v_escola, p_experiencia, p_disponibilidade,
    p_dificuldade, p_objetivo, now(), now())
  on conflict (aluno_id) do update
    set experiencia_previa        = excluded.experiencia_previa,
        disponibilidade_semanal_h = excluded.disponibilidade_semanal_h,
        maior_dificuldade         = excluded.maior_dificuldade,
        objetivo                  = excluded.objetivo,
        concluido_em              = coalesce(aluno_onboarding.concluido_em, excluded.concluido_em),
        atualizado_em             = now()
  returning * into v_row;
  return v_row;
end $$;

grant execute on function
  app.exam_tag_do_aluno(uuid),
  app.motor_streak_dias(uuid)
  to authenticated, service_role;

-- Onboarding do aluno é exposto via PostgREST (schema public). Fora do
-- alcance do anônimo; só o usuário autenticado grava o PRÓPRIO diagnóstico.
revoke execute on function public.salvar_onboarding_aluno(text, int, text, text) from public, anon;
grant  execute on function public.salvar_onboarding_aluno(text, int, text, text) to authenticated, service_role;

-- as primitivas do motor não são chamáveis pelo cliente (só pelos
-- gatilhos); não recebem grant de execução para authenticated.

-- ============================================================
-- 6) GATILHOS — acendem o motor nos eventos que o aluno já grava.
--    Todos param cedo durante a semeadura (fixture curado).
-- ============================================================

-- registro de estudo → reavalia missões/níveis/conquistas do aluno
create or replace function app.trg_motor_registro() returns trigger
language plpgsql security definer set search_path = public, app as $$
begin
  if app.motor_semeando() then return coalesce(new, old); end if;
  perform app.motor_avaliar_aluno(coalesce(new.aluno_id, old.aluno_id));
  return coalesce(new, old);
end $$;

drop trigger if exists trg_motor_registro on registros_estudo;
create trigger trg_motor_registro
  after insert or update or delete on registros_estudo
  for each row execute function app.trg_motor_registro();

-- simulado → XP de simulado + conquista + reavaliação
create or replace function app.trg_motor_simulado() returns trigger
language plpgsql security definer set search_path = public, app as $$
begin
  if app.motor_semeando() then return new; end if;
  perform app.motor_processar_simulado(new.id);
  perform app.motor_avaliar_aluno(new.aluno_id);
  return new;
end $$;

drop trigger if exists trg_motor_simulado on simulados;
create trigger trg_motor_simulado
  after insert on simulados
  for each row execute function app.trg_motor_simulado();

-- conclusão de atividade da meta → bônus de semana quando fecha tudo
create or replace function app.trg_motor_meta() returns trigger
language plpgsql security definer set search_path = public, app as $$
begin
  if app.motor_semeando() then return new; end if;
  if new.estado = 'concluida' then
    perform app.motor_semana_completa(new.meta_id);
  end if;
  return new;
end $$;

drop trigger if exists trg_motor_meta on meta_atividades;
create trigger trg_motor_meta
  after update on meta_atividades
  for each row execute function app.trg_motor_meta();

-- ============================================================
-- ROLLBACK (manual, se necessário):
--   drop trigger trg_motor_registro on registros_estudo;
--   drop trigger trg_motor_simulado on simulados;
--   drop trigger trg_motor_meta     on meta_atividades;
--   drop function app.trg_motor_registro, app.trg_motor_simulado, app.trg_motor_meta;
--   drop function app.motor_avaliar_aluno(uuid), app.motor_processar_simulado(uuid),
--                 app.motor_semana_completa(uuid), app.motor_conceder_xp(uuid,uuid,text,text,int,text,uuid),
--                 app.motor_desbloquear_conquista(uuid,uuid,text,text), app.motor_streak_dias(uuid),
--                 app.exam_tag_do_aluno(uuid), app.salvar_onboarding_aluno(text,int,text,text),
--                 app.motor_semeando();
--   drop index idx_xp_idem;
--   drop table aluno_missoes;
--   alter table missoes drop column meta_questoes, drop column meta_acuracia;
-- Nenhum dado de XP/níveis/conquistas já concedido é apagado pelo
-- rollback (ledger append-only) — só o motor para de conceder novos.
-- ============================================================
