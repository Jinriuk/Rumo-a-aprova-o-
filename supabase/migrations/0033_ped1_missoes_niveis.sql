-- ============================================================
-- 0033 — PED1: MISSÕES QUE FECHAM, NÍVEL PERSISTIDO E ONBOARDING DO ALUNO
-- ------------------------------------------------------------
-- ESTENDE o motor mínimo da Fase C0 (0024_motor_progresso.sql), que já
-- é a FONTE DE VERDADE do XP (ledger `aluno_eventos_progresso`). Esta
-- camada adiciona o que o C0 ainda não fazia, SEM criar um segundo
-- ledger e SEM enfraquecer a RLS:
--
--   1. MISSÃO QUE FECHA SOZINHA — o C0 premia o objetivo (checkbox) da
--      meta; aqui a MISSÃO do catálogo (missoes 0012) fecha quando o
--      aluno bate VOLUME + ACURÁCIA na matéria, e o XP da missão entra
--      no MESMO ledger do C0 (`tipo_evento='missao_concluida'`,
--      `origem='motor_missao'`), idempotente pela idempotency_key.
--   2. NÍVEL POR MATÉRIA PERSISTIDO — recalculado do estudo real
--      (mesma regra de niveisAluno.js), com origem/auditoria; NUNCA
--      sobrescreve um nível 'manual' da coordenação.
--   3. CONQUISTAS data-driven (constância / volume com domínio /
--      matéria) creditando o xp_bonus no ledger do C0.
--   4. ONBOARDING DO ALUNO — autoatendimento do diagnóstico inicial
--      por RPC SECURITY DEFINER restrito à própria linha do aluno.
--
-- Doutrina (segue C0/0011/0013): o aluno escreve só o que já podia
-- (registros_estudo); um gatilho SECURITY DEFINER deriva o progresso —
-- o aluno NÃO fecha missão nem se autopontua por API.
--
-- Aditiva e idempotente. Rollback no fim do arquivo.
-- ============================================================

-- ------------------------------------------------------------
-- 0) Gate de semeadura: durante os seeds (fixture curado, com níveis
--    da 08 e eventos do C0) este motor extra NÃO dispara. Os seeds
--    03/11 setam `app.motor_seed='on'`; o app real nunca seta.
-- ------------------------------------------------------------
create or replace function app.motor_semeando() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(current_setting('app.motor_seed', true), '') = 'on'
$$;

-- exam_tag (concurso-alvo) do aluno; sem alvo → null (motor para).
create or replace function app.exam_tag_do_aluno(p_aluno uuid) returns text
language sql stable security definer set search_path = public, app as $$
  select c.codigo from alunos a join concursos c on c.id = a.concurso_id where a.id = p_aluno
$$;

-- ------------------------------------------------------------
-- 1) CRITÉRIO ESTRUTURADO de missão (o textual fica para a UI). O
--    backfill dos valores vem no seed 09 (conteúdo das missões).
-- ------------------------------------------------------------
alter table missoes
  add column if not exists meta_questoes int check (meta_questoes is null or meta_questoes >= 0),
  add column if not exists meta_acuracia int check (meta_acuracia is null or (meta_acuracia between 0 and 100));

-- ------------------------------------------------------------
-- 2) PROGRESSO/FECHAMENTO de missão por aluno (volume + acurácia).
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
-- escrita direta só da coordenação (ajuste manual); o motor escreve por
-- SECURITY DEFINER. O aluno NÃO fecha a própria missão na unha.
create policy aluno_missoes_coordenacao on aluno_missoes for all to authenticated
  using      (escola_id = app.tenant_id() and app.papel() = 'coordenacao')
  with check (escola_id = app.tenant_id() and app.papel() = 'coordenacao');

grant select, insert, update, delete on aluno_missoes to authenticated, service_role;

-- ------------------------------------------------------------
-- 3) Conquista premiada (data-driven): desbloqueia idempotente e
--    credita o xp_bonus NO LEDGER DO C0 (aluno_eventos_progresso).
--    Diferente de app.desbloquear_conquista_basica (C0), que é para
--    as conquistas "primeira vez" e concede xp_delta=0.
-- ------------------------------------------------------------
create or replace function app.motor_conquista_xp(
  p_escola uuid, p_aluno uuid, p_exam text, p_codigo text
) returns void
language plpgsql security definer set search_path = public, app as $$
declare
  v_conq  conquistas%rowtype;
  v_count int := 0;
begin
  if p_exam is null then return; end if;
  select * into v_conq from conquistas where codigo = p_codigo;
  if not found then return; end if;

  insert into aluno_conquistas (escola_id, aluno_id, conquista_id, exam_tag)
  values (p_escola, p_aluno, v_conq.id, p_exam)
  on conflict (aluno_id, conquista_id, exam_tag) do nothing;
  get diagnostics v_count = row_count;
  if v_count = 0 then return; end if;        -- já tinha: nada a creditar

  insert into aluno_eventos_progresso
    (escola_id, aluno_id, exam_tag, tipo_evento, origem, referencia_tabela, referencia_id, xp_delta, metadata, idempotency_key)
  values (p_escola, p_aluno, p_exam, 'conquista_desbloqueada', 'motor_conquista', 'conquistas', v_conq.id,
          coalesce(v_conq.xp_bonus, 0), jsonb_build_object('codigo', p_codigo),
          'conquista:' || p_aluno::text || ':' || p_codigo)
  on conflict (idempotency_key) do nothing;
end $$;

-- streak (constância): maior corrida de dias consecutivos de estudo.
create or replace function app.motor_streak_dias(p_aluno uuid) returns int
language sql stable security definer set search_path = public, app as $$
  with dias as (select distinct data as d from registros_estudo where aluno_id = p_aluno),
  grupos as (select d, (d - (row_number() over (order by d))::int) as grp from dias)
  select coalesce(count(*), 0)::int from grupos
  where grp = (select grp from grupos order by d desc limit 1)
$$;

-- ------------------------------------------------------------
-- 4) AVALIAÇÃO do progresso do aluno: fecha missões, persiste nível
--    por matéria e desbloqueia conquistas data-driven. Idempotente e
--    exception-safe (um erro do motor nunca derruba o registro).
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

  -- ----- MISSÕES: fecham quando batem volume E acurácia -----
  for r in
    select m.id              as missao_id,
           m.materia_codigo  as materia,
           coalesce(me.xp, m.xp_sugerido, 0)          as xp,
           coalesce(me.qtd_questoes, m.meta_questoes) as meta_questoes,  -- escola pode elevar a barra
           m.meta_acuracia,
           coalesce(agg.q, 0) as q,
           agg.acc            as acc
    from missoes m
    left join missoes_escola me on me.missao_id = m.id and me.escola_id = v_escola
    left join lateral (
      select sum(questoes)::int as q,
             case when sum(questoes) filter (where acertos is not null) > 0
                  then round(100.0 * sum(acertos) filter (where acertos is not null)
                             / sum(questoes) filter (where acertos is not null))::int end as acc
      from registros_estudo re
      where re.aluno_id = p_aluno and re.disciplina_codigo = m.materia_codigo
    ) agg on true
    where m.exam_tag = v_exam
      and m.meta_questoes is not null
      and coalesce(me.ativa, true) = true
  loop
    insert into aluno_missoes (escola_id, aluno_id, missao_id, exam_tag, estado, questoes_acumuladas, acuracia)
    values (v_escola, p_aluno, r.missao_id, v_exam, 'em_andamento', r.q, r.acc)
    on conflict (aluno_id, missao_id) do update
      set questoes_acumuladas = excluded.questoes_acumuladas,
          acuracia            = excluded.acuracia,
          atualizado_em       = now()
      where aluno_missoes.estado <> 'concluida';

    if r.q >= r.meta_questoes and r.acc is not null and r.acc >= coalesce(r.meta_acuracia, 0) then
      update aluno_missoes
        set estado = 'concluida', xp_concedido = r.xp, concluida_em = coalesce(concluida_em, now()), atualizado_em = now()
        where aluno_id = p_aluno and missao_id = r.missao_id and estado <> 'concluida';
      if found then
        -- XP da missão entra no LEDGER DO C0 (fonte única), idempotente.
        insert into aluno_eventos_progresso
          (escola_id, aluno_id, exam_tag, tipo_evento, origem, referencia_tabela, referencia_id, xp_delta, metadata, idempotency_key)
        values (v_escola, p_aluno, v_exam, 'missao_concluida', 'motor_missao', 'missoes', r.missao_id, r.xp,
                jsonb_build_object('volume', r.q, 'acuracia', r.acc),
                'missao_motor:' || p_aluno::text || ':' || r.missao_id::text)
        on conflict (idempotency_key) do nothing;
      end if;
    end if;
  end loop;

  -- ----- NÍVEL por matéria (calculado), nunca sobre 'manual' -----
  for r in
    select re.disciplina_codigo as materia,
           sum(questoes)::int as q,
           case when sum(questoes) filter (where acertos is not null) > 0
                then round(100.0 * sum(acertos) filter (where acertos is not null)
                           / sum(questoes) filter (where acertos is not null))::int end as acc
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
        'calculado', 'recalculado pelo motor de progresso (PED1)'
      )
      on conflict (aluno_id, escopo) do update
        set nivel = excluded.nivel, origem = 'calculado', motivo = excluded.motivo, atualizado_em = now()
        where aluno_niveis.origem in ('calculado', 'validar');
    end if;
  end loop;

  -- ----- CONQUISTAS data-driven -----
  v_streak := app.motor_streak_dias(p_aluno);
  for r in select codigo, criterio from conquistas where tipo = 'constancia' and criterio ? 'dias' loop
    if v_streak >= coalesce((r.criterio->>'dias')::int, 2147483647) then
      perform app.motor_conquista_xp(v_escola, p_aluno, v_exam, r.codigo);
    end if;
  end loop;

  for r in select codigo, criterio from conquistas where tipo = 'volume' loop
    if exists (
      select 1 from registros_estudo re
      where re.aluno_id = p_aluno and re.data >= (current_date - 30)
      having coalesce(sum(questoes), 0) >= coalesce((r.criterio->>'questoes')::int, 2147483647)
         and (sum(questoes) filter (where acertos is not null) = 0
              or round(100.0 * coalesce(sum(acertos) filter (where acertos is not null), 0)
                       / nullif(sum(questoes) filter (where acertos is not null), 0))
                 >= coalesce((r.criterio->>'acuracia_min')::int, 0))
    ) then
      perform app.motor_conquista_xp(v_escola, p_aluno, v_exam, r.codigo);
    end if;
  end loop;

  for r in select codigo, criterio from conquistas where tipo in ('materia', 'alavancagem') and criterio ? 'materia' loop
    if exists (
      select 1 from registros_estudo re
      where re.aluno_id = p_aluno and re.disciplina_codigo = (r.criterio->>'materia') and re.acertos is not null
      group by re.disciplina_codigo
      having sum(questoes) >= 20
         and round(100.0 * sum(acertos) / nullif(sum(questoes), 0)) >= coalesce((r.criterio->>'acuracia_min')::int, 2147483647)
    ) then
      perform app.motor_conquista_xp(v_escola, p_aluno, v_exam, r.codigo);
    end if;
  end loop;

exception when others then
  raise warning 'motor_avaliar_aluno(%) [PED1] falhou: %', p_aluno, sqlerrm;
end $$;

-- ------------------------------------------------------------
-- 5) ONBOARDING do ALUNO (autoatendimento). A RLS direta de
--    aluno_onboarding só deixa a coordenação escrever; aqui o aluno
--    grava o PRÓPRIO diagnóstico por um caminho que só toca a linha
--    dele (app.meu_aluno_id()). Não enfraquece a RLS.
-- ------------------------------------------------------------
create or replace function public.salvar_onboarding_aluno(
  p_experiencia text, p_disponibilidade int, p_dificuldade text, p_objetivo text
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
  values (v_aluno, v_escola, p_experiencia, p_disponibilidade, p_dificuldade, p_objetivo, now(), now())
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

grant execute on function app.exam_tag_do_aluno(uuid), app.motor_streak_dias(uuid) to authenticated, service_role;
revoke execute on function public.salvar_onboarding_aluno(text, int, text, text) from public, anon;
grant  execute on function public.salvar_onboarding_aluno(text, int, text, text) to authenticated, service_role;

-- ============================================================
-- 6) GATILHO — registro de estudo aciona o motor extra (missão/nível/
--    conquista). Convive com o gatilho do C0 (que registra o evento e
--    a conquista "primeiro registro"). Para na semeadura.
-- ============================================================
create or replace function app.trg_ped1_registro() returns trigger
language plpgsql security definer set search_path = public, app as $$
begin
  if app.motor_semeando() then return coalesce(new, old); end if;
  perform app.motor_avaliar_aluno(coalesce(new.aluno_id, old.aluno_id));
  return coalesce(new, old);
end $$;

drop trigger if exists trg_ped1_registro on registros_estudo;
create trigger trg_ped1_registro
  after insert or update or delete on registros_estudo
  for each row execute function app.trg_ped1_registro();

-- ============================================================
-- ROLLBACK (manual):
--   drop trigger trg_ped1_registro on registros_estudo;
--   drop function app.trg_ped1_registro, app.motor_avaliar_aluno(uuid),
--                 app.motor_conquista_xp(uuid,uuid,text,text), app.motor_streak_dias(uuid),
--                 app.exam_tag_do_aluno(uuid), app.motor_semeando(),
--                 public.salvar_onboarding_aluno(text,int,text,text);
--   drop table aluno_missoes;
--   alter table missoes drop column meta_questoes, drop column meta_acuracia;
-- O ledger do C0 já concedido não é apagado (append-only) — o motor só
-- para de conceder novos eventos de missão/conquista.
-- ============================================================
