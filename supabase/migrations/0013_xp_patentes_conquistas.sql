-- ============================================================
-- 0013 — XP, PATENTES E CONQUISTAS (Fase 15.5)
-- ------------------------------------------------------------
-- Camada de gamificação pedagógica. O catálogo (patentes e
-- conquistas) é GLOBAL; o progresso do aluno (eventos de XP e
-- conquistas desbloqueadas) é ISOLADO por escola e travado no
-- exam_tag do alvo (decisão D2: XP não é comparável entre exames).
--
-- Antigaming (doc §11/§12): XP premia DOMÍNIO medido por acurácia,
-- nunca volume puro. Por isso o XP entra como um LEDGER de eventos
-- com origem explícita (missão, semana, melhoria, simulado, ...),
-- e o total é a soma. Esta subfase cria a estrutura; o motor que
-- concede XP automaticamente vem depois. Aditiva e idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1) PATENTES (catálogo global). XP cumulativo + critério adicional
--    opcional nos degraus altos (para não virar só grind).
-- ------------------------------------------------------------
create table if not exists patentes (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text not null unique,
  nome               text not null,
  xp_necessario      int  not null check (xp_necessario >= 0),
  criterio_adicional text,
  significado        text,
  ordem              int  not null
);

-- ------------------------------------------------------------
-- 2) CONQUISTAS (catálogo global). Cada uma tem um TIPO e um
--    critério (jsonb) avaliado pela lógica pura. Evita conquista
--    decorativa: o critério é sempre acurácia/nota/constância.
-- ------------------------------------------------------------
create table if not exists conquistas (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,
  nome        text not null,
  tipo        text not null check (tipo in (
                'constancia', 'volume', 'desempenho', 'simulado',
                'materia', 'evolucao', 'reta_final', 'corte', 'recuperacao', 'alavancagem')),
  descricao   text not null,
  criterio    jsonb not null default '{}'::jsonb,
  xp_bonus    int  not null default 0 check (xp_bonus >= 0),
  ordem       int  not null default 0
);

-- ------------------------------------------------------------
-- 3) LEDGER de XP do aluno (isolado por escola, travado no exam_tag).
--    Cada linha é um evento com ORIGEM — o total de XP é a soma.
--    Assim o XP é auditável e nunca "número mágico".
-- ------------------------------------------------------------
create table if not exists aluno_xp_eventos (
  id           uuid primary key default gen_random_uuid(),
  escola_id    uuid not null references escolas (id) on delete cascade,
  aluno_id     uuid not null references alunos (id)  on delete cascade,
  exam_tag     text not null references concursos (codigo),
  origem       text not null check (origem in (
                 'missao', 'semana_completa', 'melhoria_materia', 'simulado',
                 'evolucao', 'recuperacao', 'conquista', 'ajuste_manual')),
  referencia_id uuid,                      -- missão/conquista/simulado de origem (quando houver)
  pontos       int  not null,
  descricao    text,
  concedido_por uuid references usuarios (id) on delete set null,
  em           timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4) CONQUISTAS DESBLOQUEADAS pelo aluno (isolado, por exam_tag).
--    Ausência de linha = conquista bloqueada (medalha cinza).
-- ------------------------------------------------------------
create table if not exists aluno_conquistas (
  id             uuid primary key default gen_random_uuid(),
  escola_id      uuid not null references escolas (id) on delete cascade,
  aluno_id       uuid not null references alunos (id)  on delete cascade,
  conquista_id   uuid not null references conquistas (id) on delete cascade,
  exam_tag       text not null references concursos (codigo),
  desbloqueada_em timestamptz not null default now(),
  unique (aluno_id, conquista_id, exam_tag)
);

create index if not exists idx_xp_aluno        on aluno_xp_eventos (aluno_id, exam_tag);
create index if not exists idx_aluno_conq_aluno on aluno_conquistas (aluno_id, exam_tag);

-- ============================================================
-- RLS — catálogo global (leitura por todos, escrita só operador);
-- progresso isolado por escola (coordenação/aluno/responsável leem;
-- escrita do progresso é da coordenação ou do servidor — o aluno
-- NÃO concede XP a si mesmo).
-- ============================================================
alter table patentes          enable row level security;
alter table conquistas        enable row level security;
alter table aluno_xp_eventos  enable row level security;
alter table aluno_conquistas  enable row level security;

create policy patentes_select   on patentes   for select to authenticated using (true);
create policy conquistas_select on conquistas for select to authenticated using (true);

create policy xp_select on aluno_xp_eventos for select to authenticated
  using (
    escola_id = app.tenant_id() and (
      app.papel() = 'coordenacao'
      or aluno_id = app.meu_aluno_id()
      or (app.papel() = 'responsavel' and app.sou_responsavel_de(aluno_id))
    )
  );
create policy xp_coordenacao on aluno_xp_eventos for all to authenticated
  using      (escola_id = app.tenant_id() and app.papel() = 'coordenacao')
  with check (escola_id = app.tenant_id() and app.papel() = 'coordenacao');

create policy conq_select on aluno_conquistas for select to authenticated
  using (
    escola_id = app.tenant_id() and (
      app.papel() = 'coordenacao'
      or aluno_id = app.meu_aluno_id()
      or (app.papel() = 'responsavel' and app.sou_responsavel_de(aluno_id))
    )
  );
create policy conq_coordenacao on aluno_conquistas for all to authenticated
  using      (escola_id = app.tenant_id() and app.papel() = 'coordenacao')
  with check (escola_id = app.tenant_id() and app.papel() = 'coordenacao');

grant select, insert, update, delete on
  patentes, conquistas, aluno_xp_eventos, aluno_conquistas
  to authenticated, service_role;
