-- ============================================================
-- 0008 — FUNDAÇÃO PEDAGÓGICA CONFIGURÁVEL (Fase 15.1)
-- ------------------------------------------------------------
-- Cria a CAMADA DE CONFIG que a Fase 15 exige, sem tocar no motor
-- já testado da Fase 14.5. Princípios (doc "Fase 15.0"):
--
--   • A unidade pedagógica real é o CONCURSO, etiquetado por
--     `exam_tag` (= concursos.codigo). "Turma comercial" é só
--     rótulo de venda/UI e NÃO comanda o motor.
--   • Toda config tem duas camadas: a OFICIAL (referência do
--     edital, conteúdo global) e a da ESCOLA (override por
--     tenant). Todo override divergente é marcado em
--     `desvio_do_edital`.
--   • Todo dado pedagógico carrega um status:
--     'oficial' | 'inferencia' | 'validar'. A migration cria a
--     estrutura; os valores entram nos seeds (06_pedagogia.sql).
--
-- Esta migration é puramente ADITIVA: só cria tabelas/colunas e
-- políticas novas. Nada da fundação 0001–0007 é alterado ou
-- removido. Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1) CONCURSO ganha sua config oficial 1:1 (fatos do edital que
--    são únicos por concurso e não mudam por escola).
--    `exam_tag` é coluna GERADA a partir de `codigo` — deixa o
--    vocabulário do doc ("exam_tag") explícito sem duplicar dado.
-- ------------------------------------------------------------
alter table concursos
  add column if not exists exam_tag          text generated always as (codigo) stored,
  add column if not exists elimination_model text,
  add column if not exists redacao_role      text,
  add column if not exists usa_especialidade boolean not null default false,
  add column if not exists usa_ciclo         boolean not null default false,
  add column if not exists status_dado       text    not null default 'oficial';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'concursos_elimination_model_chk') then
    alter table concursos add constraint concursos_elimination_model_chk
      check (elimination_model is null or elimination_model in ('absoluto_50', 'absoluto_5', 'mediana'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'concursos_redacao_role_chk') then
    alter table concursos add constraint concursos_redacao_role_chk
      check (redacao_role is null or redacao_role in ('eliminatoria', 'eliminatoria_classificatoria', 'ausente'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'concursos_status_dado_chk') then
    alter table concursos add constraint concursos_status_dado_chk
      check (status_dado in ('oficial', 'inferencia', 'validar'));
  end if;
end $$;

-- ------------------------------------------------------------
-- 2) TURMAS COMERCIAIS (catálogo global). Agrupamento de venda/UI
--    que pode conter VÁRIOS concursos (ex.: "CN/EPCAR" → cn, epcar).
--    Não comanda o motor: serve para a tela e para sugerir os
--    alvos pedagógicos possíveis ao aluno daquela turma.
-- ------------------------------------------------------------
create table if not exists turmas_comerciais (
  id      uuid primary key default gen_random_uuid(),
  codigo  text not null unique,            -- ex.: 'cn-epcar'
  nome    text not null,                   -- ex.: 'CN/EPCAR'
  ordem   int  not null default 0
);

create table if not exists turmas_comerciais_concursos (
  turma_comercial_codigo text not null references turmas_comerciais (codigo) on delete cascade,
  exam_tag               text not null references concursos (codigo)         on delete cascade,
  ordem                  int  not null default 0,
  primary key (turma_comercial_codigo, exam_tag)
);

-- ------------------------------------------------------------
-- 3) ALVO PEDAGÓGICO DO ALUNO + campos por concurso.
--    `alunos.concurso_id` (criado na 0007) JÁ É o alvo pedagógico
--    ATIVO único (decisão D2): um concurso por vez. Aqui só
--    acrescentamos o vínculo comercial e os campos que alguns
--    concursos exigem (EEAR: especialidade e ciclo) e a data-alvo
--    da prova, que define a trilha e o estado Reta Final.
-- ------------------------------------------------------------
alter table alunos
  add column if not exists turma_comercial_codigo text references turmas_comerciais (codigo),
  add column if not exists especialidade          text,
  add column if not exists ciclo                  text,
  add column if not exists data_prova_alvo        date;

-- ------------------------------------------------------------
-- 4) CONFIG OFICIAL (conteúdo global, referência do edital).
--    Chave-valor por exam_tag. `valor` é jsonb para acomodar
--    prioridades, pesos, volumes etc. nas subfases seguintes sem
--    nova migration. `status_dado` preserva oficial/inferência/
--    validar. Leitura por todos; escrita só do operador.
-- ------------------------------------------------------------
create table if not exists config_oficial (
  id            uuid primary key default gen_random_uuid(),
  exam_tag      text not null references concursos (codigo) on delete cascade,
  chave         text not null,
  valor         jsonb not null default '{}'::jsonb,
  status_dado   text  not null default 'oficial'
                check (status_dado in ('oficial', 'inferencia', 'validar')),
  fonte         text,                      -- edital/manual/análise que sustenta o dado
  observacao    text,
  atualizado_em timestamptz not null default now(),
  unique (exam_tag, chave)
);

-- ------------------------------------------------------------
-- 5) CONFIG DA ESCOLA (override por tenant, isolado por escola).
--    Sobrescreve a referência oficial. `desvio_do_edital = true`
--    sinaliza, de forma auditável, que a escola alterou um valor
--    que diverge do edital. `ajustado_por` registra quem mexeu.
-- ------------------------------------------------------------
create table if not exists config_escola (
  id               uuid primary key default gen_random_uuid(),
  escola_id        uuid not null references escolas (id)     on delete cascade,
  exam_tag         text not null references concursos (codigo) on delete cascade,
  chave            text not null,
  valor            jsonb not null default '{}'::jsonb,
  desvio_do_edital boolean not null default false,
  ajustado_por     uuid references usuarios (id) on delete set null,
  atualizado_em    timestamptz not null default now(),
  unique (escola_id, exam_tag, chave)
);

create index if not exists idx_config_oficial_exam      on config_oficial (exam_tag);
create index if not exists idx_config_escola_escola      on config_escola (escola_id, exam_tag);
create index if not exists idx_tcc_exam                  on turmas_comerciais_concursos (exam_tag);
create index if not exists idx_alunos_turma_comercial    on alunos (turma_comercial_codigo);

-- ============================================================
-- RLS — mesma doutrina da 0002: negar por padrão.
--   • turmas_comerciais / *_concursos / config_oficial: conteúdo
--     GLOBAL → leitura por qualquer autenticado, escrita só do
--     service_role (que tem BYPASSRLS).
--   • config_escola: ISOLADA por escola. Coordenação lê e escreve
--     a própria; aluno e responsável apenas LEEM a da própria
--     escola (precisam saber a config que vale para eles).
-- ============================================================
alter table turmas_comerciais            enable row level security;
alter table turmas_comerciais_concursos  enable row level security;
alter table config_oficial               enable row level security;
alter table config_escola                enable row level security;

create policy turmas_comerciais_select on turmas_comerciais for select to authenticated using (true);
create policy tcc_select               on turmas_comerciais_concursos for select to authenticated using (true);
create policy config_oficial_select    on config_oficial for select to authenticated using (true);

create policy config_escola_select on config_escola for select to authenticated
  using (escola_id = app.tenant_id());

create policy config_escola_coordenacao on config_escola for all to authenticated
  using      (escola_id = app.tenant_id() and app.papel() = 'coordenacao')
  with check (escola_id = app.tenant_id() and app.papel() = 'coordenacao');

-- Grants: as tabelas novas não estavam no grant em lote da 0001.
grant select, insert, update, delete on
  turmas_comerciais, turmas_comerciais_concursos, config_oficial, config_escola
  to authenticated, service_role;
