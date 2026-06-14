-- ============================================================
-- 0015 — RECORRÊNCIA REAL E TAGUEAMENTO DE PROVAS (Fase 15.7)
-- ------------------------------------------------------------
-- Prepara a EVOLUÇÃO de inferência pedagógica para inteligência
-- baseada em prova real (o ativo proprietário da plataforma). Esta
-- subfase entrega a ESTRUTURA pronta — não o banco de questões
-- completo (fora de escopo). Conteúdo GLOBAL (método do operador):
-- leitura por todos, escrita só do service_role.
--
-- Separa CLARAMENTE os três graus de confiança da recorrência:
--   • 'estimada'  — preliminar (inferência); NÃO promove prioridade.
--   • 'validada'  — confirmada por humano/professor.
--   • 'medida'    — contada questão a questão em provas reais tagueadas.
-- Regra de ouro: estimada NUNCA vira dado oficial sem passar por
-- validação/medição. Aditiva e idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1) PROVAS ANTERIORES — uma edição real do concurso (ano/etapa).
-- ------------------------------------------------------------
create table if not exists provas_anteriores (
  id           uuid primary key default gen_random_uuid(),
  exam_tag     text not null references concursos (codigo) on delete cascade,
  ano          int  not null check (ano between 1990 and 2100),
  etapa        text,                       -- ex.: 'Exame Intelectual', 'CFS 1'
  fonte        text,                       -- de onde veio (PDF oficial, arquivo, etc.)
  observacao   text,
  status_dado  text not null default 'validar' check (status_dado in ('oficial', 'inferencia', 'validar')),
  unique (exam_tag, ano, etapa)
);

-- ------------------------------------------------------------
-- 2) TAGUEAMENTO — cada questão de uma prova real etiquetada por
--    matéria + assunto (+ subassunto). NÃO guarda o enunciado
--    completo (não é banco de questões): só a referência e a tag.
-- ------------------------------------------------------------
create table if not exists questoes_prova (
  id                 uuid primary key default gen_random_uuid(),
  prova_anterior_id  uuid not null references provas_anteriores (id) on delete cascade,
  numero             int,
  materia_codigo     text not null references materias (codigo),
  assunto_id         uuid references assuntos (id) on delete set null,
  subassunto_id      uuid references subassuntos (id) on delete set null,
  gabarito           text,
  observacao         text,
  unique (prova_anterior_id, numero)
);

-- ------------------------------------------------------------
-- 3) RECORRÊNCIA por assunto — o número publicado, COM o grau de
--    confiança (estimada/validada/medida). A mesma dupla
--    (exam_tag, assunto) pode ter linhas de tipos diferentes: a
--    estimada coexiste com a medida até a validação fechar.
-- ------------------------------------------------------------
create table if not exists recorrencia_assunto (
  id             uuid primary key default gen_random_uuid(),
  exam_tag       text not null references concursos (codigo) on delete cascade,
  materia_codigo text not null references materias (codigo),
  assunto_id     uuid references assuntos (id) on delete cascade,
  anos           int  check (anos is null or anos >= 0),
  num_questoes   int  check (num_questoes is null or num_questoes >= 0),
  pct_materia    numeric(5,2) check (pct_materia is null or (pct_materia >= 0 and pct_materia <= 100)),
  tipo           text not null check (tipo in ('estimada', 'validada', 'medida')),
  fonte          text,
  observacao     text,
  atualizado_em  timestamptz not null default now(),
  unique (exam_tag, assunto_id, tipo)
);

create index if not exists idx_questoes_prova_prova   on questoes_prova (prova_anterior_id);
create index if not exists idx_questoes_prova_assunto on questoes_prova (assunto_id);
create index if not exists idx_recorrencia_exam       on recorrencia_assunto (exam_tag, materia_codigo);

-- ------------------------------------------------------------
-- 4) RECORRÊNCIA MEDIDA (view): conta as questões tagueadas por
--    assunto, ao vivo, a partir do tagueamento real. É a fonte da
--    recorrência 'medida' e do relatório de incidência (edital ×
--    prova real). Leitura por qualquer autenticado.
-- ------------------------------------------------------------
create or replace view vw_recorrencia_medida as
  select a.exam_tag,
         q.materia_codigo,
         q.assunto_id,
         a.nome as assunto,
         count(*)::int as num_questoes_medidas,
         count(distinct pa.id)::int as provas_cobertas
    from questoes_prova q
    join provas_anteriores pa on pa.id = q.prova_anterior_id
    join assuntos a on a.id = q.assunto_id
   group by a.exam_tag, q.materia_codigo, q.assunto_id, a.nome;

-- ============================================================
-- RLS — conteúdo global (leitura por todos, escrita só operador).
-- ============================================================
alter table provas_anteriores   enable row level security;
alter table questoes_prova       enable row level security;
alter table recorrencia_assunto  enable row level security;

create policy provas_anteriores_select  on provas_anteriores  for select to authenticated using (true);
create policy questoes_prova_select     on questoes_prova     for select to authenticated using (true);
create policy recorrencia_select        on recorrencia_assunto for select to authenticated using (true);

grant select, insert, update, delete on
  provas_anteriores, questoes_prova, recorrencia_assunto
  to authenticated, service_role;
grant select on vw_recorrencia_medida to authenticated, service_role;
