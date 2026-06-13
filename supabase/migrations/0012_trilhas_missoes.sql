-- ============================================================
-- 0012 — TRILHAS E MISSÕES (Fase 15.4)
-- ------------------------------------------------------------
-- Motor de trilhas (planos por exam_tag × tipo) e missões (unidade
-- de estudo). Conteúdo OFICIAL é global (método do operador); a
-- ESCOLA ajusta numa camada isolada, com `desvio_do_edital`.
--
-- Princípios:
--   • Tudo etiquetado por `exam_tag` (nunca por turma comercial).
--   • Missão carrega exam_tag → a regra anti-furo (missão de matéria
--     que não cai no alvo não entra) sai de graça: basta filtrar
--     pelo exam_tag ativo do aluno.
--   • XP é PRELIMINAR aqui (`xp_sugerido`); patentes/conquistas e o
--     XP definitivo são da 15.5. Sem motor adaptativo.
--   • Todo dado tem status oficial/inferência/validar.
-- Aditiva e idempotente. Não toca nas trilhas semanais da 14.5
-- (tabela `trilhas`), que seguem servindo o CN-2026.
-- ============================================================

-- ------------------------------------------------------------
-- 1) PLANOS DE TRILHA — um por (exam_tag, tipo). O tipo define o
--    horizonte (anual / semestral / intensiva 3m / reta final).
-- ------------------------------------------------------------
create table if not exists trilha_planos (
  id           uuid primary key default gen_random_uuid(),
  exam_tag     text not null references concursos (codigo) on delete cascade,
  tipo         text not null check (tipo in ('anual', 'semestral', 'intensiva', 'reta_final')),
  nome         text not null,
  descricao    text,
  status_dado  text not null default 'inferencia' check (status_dado in ('oficial', 'inferencia', 'validar')),
  ordem        int  not null default 0,
  unique (exam_tag, tipo)
);

-- ------------------------------------------------------------
-- 2) MISSÕES (template global). Ligadas a exam_tag + matéria, e
--    opcionalmente a assunto/subassunto, com nível-alvo e prioridade.
--    Critérios de conclusão/excelência são texto (a trava de acurácia
--    real entra no motor de progresso, fora desta subfase). XP é
--    preliminar. origem/status preservam a honestidade do dado.
-- ------------------------------------------------------------
create table if not exists missoes (
  id                  uuid primary key default gen_random_uuid(),
  exam_tag            text not null references concursos (codigo) on delete cascade,
  materia_codigo      text not null references materias (codigo),
  assunto_id          uuid references assuntos (id) on delete set null,
  subassunto_id       uuid references subassuntos (id) on delete set null,
  nivel               text not null check (nivel in ('base', 'intermediario', 'avancado', 'reta_final')),
  nome                text not null,
  objetivo            text not null,
  prioridade          text check (prioridade is null or prioridade in ('alta', 'media', 'baixa')),
  qtd_questoes_sugerida int check (qtd_questoes_sugerida is null or qtd_questoes_sugerida >= 0),
  tempo_estimado_min  int check (tempo_estimado_min is null or tempo_estimado_min >= 0),
  criterio_conclusao  text not null,
  criterio_excelencia text,
  xp_sugerido         int  not null default 0 check (xp_sugerido >= 0),   -- PRELIMINAR (15.5 define o XP real)
  origem              text not null default 'inferencia',                  -- de onde veio o desenho da missão
  status_dado         text not null default 'inferencia' check (status_dado in ('oficial', 'inferencia', 'validar')),
  ordem               int  not null default 0
);

-- ------------------------------------------------------------
-- 3) MISSÃO NA TRILHA — liga missões a um plano, com fase/semana
--    sugerida e ordem. Global (faz parte do método oficial).
-- ------------------------------------------------------------
create table if not exists trilha_plano_missoes (
  id              uuid primary key default gen_random_uuid(),
  plano_id        uuid not null references trilha_planos (id) on delete cascade,
  missao_id       uuid not null references missoes (id)       on delete cascade,
  fase            text,                       -- ex.: 'Fundação', 'Consolidação', 'Reta Final'
  semana_sugerida int,
  ordem           int not null default 0,
  unique (plano_id, missao_id)
);

-- ------------------------------------------------------------
-- 4) AJUSTE DA ESCOLA sobre uma missão (camada isolada por escola).
--    A escola liga/desliga e sobrescreve qtd/xp/critério. Todo
--    desvio do desenho oficial é marcado em `desvio_do_edital`.
-- ------------------------------------------------------------
create table if not exists missoes_escola (
  id                  uuid primary key default gen_random_uuid(),
  escola_id           uuid not null references escolas (id) on delete cascade,
  missao_id           uuid not null references missoes (id) on delete cascade,
  ativa               boolean not null default true,
  qtd_questoes        int  check (qtd_questoes is null or qtd_questoes >= 0),
  xp                  int  check (xp is null or xp >= 0),
  criterio_conclusao  text,
  objetivo            text,
  desvio_do_edital    boolean not null default false,
  ajustado_por        uuid references usuarios (id) on delete set null,
  atualizado_em       timestamptz not null default now(),
  unique (escola_id, missao_id)
);

create index if not exists idx_trilha_planos_exam  on trilha_planos (exam_tag);
create index if not exists idx_missoes_exam_nivel  on missoes (exam_tag, nivel);
create index if not exists idx_tpm_plano           on trilha_plano_missoes (plano_id);
create index if not exists idx_missoes_escola_esc  on missoes_escola (escola_id);

-- ============================================================
-- RLS — global (planos/missões/ligações) lê todos, escreve só
-- service_role; missoes_escola isolada por escola.
-- ============================================================
alter table trilha_planos        enable row level security;
alter table missoes              enable row level security;
alter table trilha_plano_missoes enable row level security;
alter table missoes_escola       enable row level security;

create policy trilha_planos_select        on trilha_planos        for select to authenticated using (true);
create policy missoes_select              on missoes              for select to authenticated using (true);
create policy trilha_plano_missoes_select on trilha_plano_missoes for select to authenticated using (true);

create policy missoes_escola_select on missoes_escola for select to authenticated
  using (escola_id = app.tenant_id());
create policy missoes_escola_coordenacao on missoes_escola for all to authenticated
  using      (escola_id = app.tenant_id() and app.papel() = 'coordenacao')
  with check (escola_id = app.tenant_id() and app.papel() = 'coordenacao');

grant select, insert, update, delete on
  trilha_planos, missoes, trilha_plano_missoes, missoes_escola
  to authenticated, service_role;
