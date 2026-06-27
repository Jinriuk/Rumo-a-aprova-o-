-- ============================================================
-- 0024 — MOTOR MÍNIMO PERSISTIDO DE PROGRESSO (Fase C0)
-- ------------------------------------------------------------
-- Até aqui o XP/patente do aluno era CALCULADO no front (jargao.js
-- calcularXP) — bonito, mas volátil e não auditável. Esta migration
-- cria o motor real: cada ação do aluno (registrar estudo, concluir
-- objetivo de missão, lançar simulado) vira um EVENTO PERSISTIDO,
-- rastreável, idempotente e impossível de forjar pelo aluno.
--
-- Doutrina (segue 0011/0013/0021):
--   • O aluno continua escrevendo SÓ o que já podia: registros_estudo,
--     meta_atividades.estado, simulados. NÃO escreve XP/conquista/
--     patente/evento de progresso diretamente (RLS barra).
--   • Quem deriva o evento de progresso é um GATILHO SECURITY DEFINER
--     a partir da linha REAL que o aluno gravou — o payload não é
--     confiado: o XP vem da regra no banco, não do cliente.
--   • Idempotência por `idempotency_key` única: duplo clique, refresh
--     e reabrir+concluir não geram XP/conquista em dobro.
--   • XP total = soma de xp_delta dos eventos válidos (ledger).
--   • Patente deriva desse total (regra pura centralizada no front).
--
-- RECONCILIAÇÃO (Fase C0.5): esta migration foi originalmente criada na
-- branch da C0 como 0016 e depois 0022_motor_progresso. No main, porém,
-- 0022/0023 já são logs_coordenacao/índices. Renumerada para 0024 — o
-- próximo após 0023 — para o histórico do repo ficar crescente e
-- reproduzível. O BODY é idêntico ao já aplicado no Supabase remoto
-- (tabela aluno_eventos_progresso já existe lá), e é idempotente
-- (`if not exists` / `create or replace`): reaplicar é no-op de schema.
-- Aditiva. Não altera 0001–0023. A tabela legada aluno_xp_eventos (0013)
-- é preservada para o ajuste manual da coordenação; o motor novo é a
-- fonte de verdade do progresso do aluno.
-- ============================================================

-- ------------------------------------------------------------
-- 1) EVENTOS DE PROGRESSO — o ledger único do motor. Cada linha é
--    um fato derivado de uma ação real, com origem e xp_delta.
--    status='valido' conta para o total; 'estornado' fica no
--    histórico mas não pontua (auditoria preserva o que aconteceu).
-- ------------------------------------------------------------
create table if not exists aluno_eventos_progresso (
  id                 uuid primary key default gen_random_uuid(),
  escola_id          uuid not null references escolas (id) on delete cascade,
  aluno_id           uuid not null references alunos (id)  on delete cascade,
  exam_tag           text references concursos (codigo),         -- alvo do aluno no momento (pode faltar)
  tipo_evento        text not null check (tipo_evento in (
                       'registro_estudo', 'missao_concluida', 'conquista_desbloqueada',
                       'simulado_finalizado', 'ajuste_coordenacao')),
  origem             text not null,                              -- tabela/fluxo de origem (livre, p/ auditoria)
  referencia_tabela  text,
  referencia_id      uuid,
  xp_delta           int  not null default 0,
  metadata           jsonb not null default '{}'::jsonb,
  status             text not null default 'valido' check (status in ('valido', 'estornado')),
  idempotency_key    text not null,                              -- trava anti-duplicidade (global)
  criado_por         uuid references usuarios (id) on delete set null,
  criado_em          timestamptz not null default now(),
  unique (idempotency_key)
);

create index if not exists idx_evprog_aluno      on aluno_eventos_progresso (aluno_id, exam_tag);
create index if not exists idx_evprog_escola_tipo on aluno_eventos_progresso (escola_id, tipo_evento);
create index if not exists idx_evprog_recente     on aluno_eventos_progresso (aluno_id, criado_em desc);

-- ------------------------------------------------------------
-- 2) CONQUISTAS MÍNIMAS (catálogo global). Critério simples e
--    honesto: "primeira vez que X aconteceu". Sem inflar o catálogo.
--    Aditivas ao catálogo da 0013/seed 10; on conflict não duplica.
-- ------------------------------------------------------------
insert into conquistas (codigo, nome, tipo, descricao, criterio, xp_bonus, ordem) values
  ('primeiro_registro', 'Primeiro Registro',  'constancia', 'Lançou o primeiro registro de estudo.',   '{"primeiro": "registro_estudo"}'::jsonb,    0, 20),
  ('primeira_missao',   'Primeira Missão',     'desempenho', 'Concluiu o primeiro objetivo de missão.',  '{"primeiro": "missao_concluida"}'::jsonb,   0, 21),
  ('primeiro_simulado', 'Primeiro Simulado',   'simulado',   'Finalizou o primeiro simulado.',           '{"primeiro": "simulado_finalizado"}'::jsonb, 0, 22)
  on conflict (codigo) do nothing;

-- ============================================================
-- 3) REGRA DE XP — centralizada no banco (espelha jargao.js).
--    Conservadora e anti-grind: registrar estudo NÃO dá XP (só
--    evento/histórico); XP vem de DOMÍNIO (objetivo de missão por
--    prioridade) e de entregar simulado. Calibrável depois.
-- ------------------------------------------------------------
create or replace function app.xp_por_prioridade(p text) returns int
language sql immutable as $$
  select case p when 'F' then 100 when 'P' then 60 when 'X' then 40 else 40 end
$$;

-- XP fixo por finalizar um simulado (espelha simulados*50 do front).
-- Mantido como função para a regra ficar num lugar só.
create or replace function app.xp_simulado() returns int
language sql immutable as $$ select 50 $$;

-- ------------------------------------------------------------
-- Helper interno: desbloqueia (idempotente) uma conquista por código
-- e registra o evento 'conquista_desbloqueada'. Roda dentro dos
-- gatilhos (já em contexto SECURITY DEFINER). Conquista mínima não
-- concede XP (xp_delta=0) — evita recompensa dupla com a ação que a
-- disparou. on conflict garante "não desbloqueia duas vezes".
-- ------------------------------------------------------------
create or replace function app.desbloquear_conquista_basica(
  p_escola uuid, p_aluno uuid, p_exam text, p_codigo text
) returns void
language plpgsql security definer set search_path = public, app as $$
declare
  v_conq uuid;
  v_nova boolean := false;
begin
  if p_exam is null then return; end if;            -- conquista é travada no exam_tag
  select id into v_conq from conquistas where codigo = p_codigo;
  if v_conq is null then return; end if;

  insert into aluno_conquistas (escola_id, aluno_id, conquista_id, exam_tag)
    values (p_escola, p_aluno, v_conq, p_exam)
    on conflict (aluno_id, conquista_id, exam_tag) do nothing;
  get diagnostics v_nova = row_count;               -- 1 = inseriu agora; 0 = já existia

  if v_nova then
    insert into aluno_eventos_progresso
      (escola_id, aluno_id, exam_tag, tipo_evento, origem, referencia_tabela, referencia_id, xp_delta, idempotency_key)
    values (p_escola, p_aluno, p_exam, 'conquista_desbloqueada', 'motor', 'conquistas', v_conq, 0,
            'conquista:' || p_aluno::text || ':' || p_codigo)
    on conflict (idempotency_key) do nothing;
  end if;
end $$;

-- ============================================================
-- 4) GATILHOS — derivam evento de progresso da ação REAL do aluno.
--    SECURITY DEFINER: escrevem no ledger sem depender da RLS (o
--    aluno não consegue, por API, inserir evento de XP). Idempotentes.
-- ============================================================

-- 4a) REGISTRO DE ESTUDO → evento (xp_delta=0) + conquista primeiro_registro.
create or replace function app.progresso_de_registro() returns trigger
language plpgsql security definer set search_path = public, app as $$
declare
  v_exam text;
begin
  select c.codigo into v_exam
    from alunos a left join concursos c on c.id = a.concurso_id
   where a.id = new.aluno_id;

  insert into aluno_eventos_progresso
    (escola_id, aluno_id, exam_tag, tipo_evento, origem, referencia_tabela, referencia_id, xp_delta, metadata, idempotency_key)
  values (new.escola_id, new.aluno_id, v_exam, 'registro_estudo', 'registros_estudo', 'registros_estudo', new.id, 0,
          jsonb_build_object('disciplina', new.disciplina_codigo, 'questoes', new.questoes, 'acertos', new.acertos),
          'registro:' || new.id::text)
  on conflict (idempotency_key) do nothing;

  perform app.desbloquear_conquista_basica(new.escola_id, new.aluno_id, v_exam, 'primeiro_registro');
  return new;
end $$;

drop trigger if exists trg_progresso_registro on registros_estudo;
create trigger trg_progresso_registro
  after insert on registros_estudo
  for each row execute function app.progresso_de_registro();

-- 4b) OBJETIVO DE MISSÃO concluído → evento com XP por prioridade +
--     conquista primeira_missao. Dispara só na BORDA p/ 'concluida'
--     (reabrir e reconcluir reusa a MESMA idempotency_key → sem XP dobrado).
create or replace function app.progresso_de_missao() returns trigger
language plpgsql security definer set search_path = public, app as $$
declare
  v_exam text;
  v_prio text;
  v_xp   int;
begin
  if new.estado <> 'concluida' then return new; end if;
  if tg_op = 'UPDATE' and old.estado = 'concluida' then return new; end if;  -- já estava concluída

  select c.codigo into v_exam
    from metas m
    join alunos a on a.id = m.aluno_id
    left join concursos c on c.id = a.concurso_id
   where m.id = new.meta_id;

  select am.prioridade into v_prio
    from atividades_modelo am where am.id = new.atividade_modelo_id;
  v_xp := app.xp_por_prioridade(v_prio);

  insert into aluno_eventos_progresso
    (escola_id, aluno_id, exam_tag, tipo_evento, origem, referencia_tabela, referencia_id, xp_delta, metadata, idempotency_key)
  select m.escola_id, m.aluno_id, v_exam, 'missao_concluida', 'meta_atividades', 'meta_atividades', new.id, v_xp,
         jsonb_build_object('prioridade', v_prio, 'meta_id', new.meta_id),
         'meta_atividade:' || new.id::text
    from metas m where m.id = new.meta_id
  on conflict (idempotency_key) do nothing;

  -- exam_tag p/ a conquista: busca de novo via metas (escola/aluno vêm do mesmo join)
  perform app.desbloquear_conquista_basica(m.escola_id, m.aluno_id, v_exam, 'primeira_missao')
    from metas m where m.id = new.meta_id;
  return new;
end $$;

drop trigger if exists trg_progresso_missao on meta_atividades;
create trigger trg_progresso_missao
  after insert or update of estado on meta_atividades
  for each row execute function app.progresso_de_missao();

-- 4c) SIMULADO lançado → evento com XP fixo + conquista primeiro_simulado.
create or replace function app.progresso_de_simulado() returns trigger
language plpgsql security definer set search_path = public, app as $$
declare
  v_exam text;
begin
  select c.codigo into v_exam
    from alunos a left join concursos c on c.id = a.concurso_id
   where a.id = new.aluno_id;

  insert into aluno_eventos_progresso
    (escola_id, aluno_id, exam_tag, tipo_evento, origem, referencia_tabela, referencia_id, xp_delta, metadata, idempotency_key)
  values (new.escola_id, new.aluno_id, v_exam, 'simulado_finalizado', 'simulados', 'simulados', new.id, app.xp_simulado(),
          jsonb_build_object('nome', new.nome), 'simulado:' || new.id::text)
  on conflict (idempotency_key) do nothing;

  perform app.desbloquear_conquista_basica(new.escola_id, new.aluno_id, v_exam, 'primeiro_simulado');
  return new;
end $$;

drop trigger if exists trg_progresso_simulado on simulados;
create trigger trg_progresso_simulado
  after insert on simulados
  for each row execute function app.progresso_de_simulado();

-- ============================================================
-- 5) VIEW de XP total por aluno (soma do ledger válido). security_invoker
--    para herdar a RLS de aluno_eventos_progresso (cada um vê o que pode).
-- ============================================================
create or replace view vw_aluno_xp_total
  with (security_invoker = on) as
  select escola_id, aluno_id, exam_tag,
         coalesce(sum(xp_delta) filter (where status = 'valido'), 0)::int as xp_total,
         count(*) filter (where status = 'valido')::int as eventos
    from aluno_eventos_progresso
   group by escola_id, aluno_id, exam_tag;

-- ============================================================
-- 6) BACKFILL controlado (operador/coordenação). Para bases que já
--    tinham registros/simulados/objetivos ANTES do motor, recria os
--    eventos faltantes de forma idempotente (a idempotency_key impede
--    duplicar o que os gatilhos já geraram). Não concede XP retroativo
--    de simulado/missão além do que a regra atual define.
-- ============================================================
create or replace function app.backfill_progresso(p_escola uuid) returns int
language plpgsql security definer set search_path = public, app as $$
declare v_antes int; v_depois int;
begin
  select count(*) into v_antes from aluno_eventos_progresso where escola_id = p_escola;

  -- registros
  insert into aluno_eventos_progresso
    (escola_id, aluno_id, exam_tag, tipo_evento, origem, referencia_tabela, referencia_id, xp_delta, metadata, idempotency_key)
  select r.escola_id, r.aluno_id, c.codigo, 'registro_estudo', 'backfill', 'registros_estudo', r.id, 0,
         jsonb_build_object('disciplina', r.disciplina_codigo, 'questoes', r.questoes, 'acertos', r.acertos),
         'registro:' || r.id::text
    from registros_estudo r
    join alunos a on a.id = r.aluno_id
    left join concursos c on c.id = a.concurso_id
   where r.escola_id = p_escola
  on conflict (idempotency_key) do nothing;

  -- objetivos de missão concluídos
  insert into aluno_eventos_progresso
    (escola_id, aluno_id, exam_tag, tipo_evento, origem, referencia_tabela, referencia_id, xp_delta, metadata, idempotency_key)
  select m.escola_id, m.aluno_id, c.codigo, 'missao_concluida', 'backfill', 'meta_atividades', ma.id,
         app.xp_por_prioridade(am.prioridade),
         jsonb_build_object('prioridade', am.prioridade, 'meta_id', ma.meta_id),
         'meta_atividade:' || ma.id::text
    from meta_atividades ma
    join metas m on m.id = ma.meta_id
    join alunos a on a.id = m.aluno_id
    left join concursos c on c.id = a.concurso_id
    left join atividades_modelo am on am.id = ma.atividade_modelo_id
   where ma.escola_id = p_escola and ma.estado = 'concluida'
  on conflict (idempotency_key) do nothing;

  -- simulados
  insert into aluno_eventos_progresso
    (escola_id, aluno_id, exam_tag, tipo_evento, origem, referencia_tabela, referencia_id, xp_delta, metadata, idempotency_key)
  select s.escola_id, s.aluno_id, c.codigo, 'simulado_finalizado', 'backfill', 'simulados', s.id, app.xp_simulado(),
         jsonb_build_object('nome', s.nome), 'simulado:' || s.id::text
    from simulados s
    join alunos a on a.id = s.aluno_id
    left join concursos c on c.id = a.concurso_id
   where s.escola_id = p_escola
  on conflict (idempotency_key) do nothing;

  select count(*) into v_depois from aluno_eventos_progresso where escola_id = p_escola;
  return v_depois - v_antes;
end $$;

-- ============================================================
-- 7) RLS — leitura na matriz padrão (coordenação=escola, aluno=próprio,
--    responsável=vinculado). ESCRITA do aluno: NENHUMA (o motor escreve
--    via gatilho SECURITY DEFINER). A coordenação pode lançar APENAS
--    ajuste_coordenacao (com log/justificativa em metadata).
-- ============================================================
alter table aluno_eventos_progresso enable row level security;

create policy evprog_select on aluno_eventos_progresso for select to authenticated
  using (
    escola_id = app.tenant_id() and (
      app.papel() = 'coordenacao'
      or aluno_id = app.meu_aluno_id()
      or (app.papel() = 'responsavel' and app.sou_responsavel_de(aluno_id))
    )
  );

-- A coordenação só pode INSERIR ajuste manual (não pode forjar
-- registro/missão/simulado/conquista do aluno). O aluno: nada.
create policy evprog_ajuste_coordenacao on aluno_eventos_progresso for insert to authenticated
  with check (
    escola_id = app.tenant_id() and app.papel() = 'coordenacao'
    and tipo_evento = 'ajuste_coordenacao'
  );

grant select, insert on aluno_eventos_progresso to authenticated;
grant select, insert, update, delete on aluno_eventos_progresso to service_role;
grant select on vw_aluno_xp_total to authenticated, service_role;
grant execute on function app.backfill_progresso(uuid) to service_role;
grant execute on function app.xp_por_prioridade(text), app.xp_simulado() to authenticated, service_role;
