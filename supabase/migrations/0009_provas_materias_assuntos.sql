-- ============================================================
-- 0009 — PROVAS, MATÉRIAS, ASSUNTOS E SUBASSUNTOS (Fase 15.2)
-- ------------------------------------------------------------
-- Cadastra a ESTRUTURA pedagógica de cada concurso, etiquetada por
-- `exam_tag`. Conteúdo GLOBAL (sem dono), igual aos concursos:
-- leitura por qualquer autenticado, escrita só do operador
-- (service_role, que tem BYPASSRLS).
--
-- Cada concurso é tratado SEPARADAMENTE — CN ≠ EPCAR e ESA ≠ EEAR,
-- mesmo dentro da turma comercial. Nada de misturar regra de prova.
--
-- Todo dado carrega `status_dado` (oficial/inferencia/validar). A
-- estrutura da prova (matérias, nº de questões, pesos) é 🟢 oficial;
-- a PRIORIDADE de assunto nasce 🟡 inferência (preliminar) porque a
-- recorrência real só será medida na 15.7. Idempotente e aditiva.
-- ============================================================

-- helper de status reutilizado nos checks
-- (texto + check, no estilo das demais migrations)

-- ------------------------------------------------------------
-- 1) PROVA — uma por concurso. Estrutura de aplicação (dias,
--    fórmula, observação). Liga-se ao concurso por exam_tag.
-- ------------------------------------------------------------
create table if not exists provas (
  id            uuid primary key default gen_random_uuid(),
  exam_tag      text not null unique references concursos (codigo) on delete cascade,
  nome          text not null,
  num_dias      int  not null default 1 check (num_dias between 1 and 3),
  formula       text,                      -- fórmula oficial da média (texto fiel ao edital)
  observacao    text,
  status_dado   text not null default 'oficial' check (status_dado in ('oficial', 'inferencia', 'validar'))
);

-- ------------------------------------------------------------
-- 2) DIAS / BLOCOS de prova. Alguns concursos têm 2 dias (CN,
--    EsPCEx); a maioria, um bloco único. duracao_min é informativa.
-- ------------------------------------------------------------
create table if not exists prova_dias (
  id            uuid primary key default gen_random_uuid(),
  exam_tag      text not null references concursos (codigo) on delete cascade,
  numero        int  not null,
  nome          text not null,
  duracao_min   int  check (duracao_min is null or duracao_min > 0),
  ordem         int  not null default 0,
  unique (exam_tag, numero)
);

-- ------------------------------------------------------------
-- 3) MATÉRIAS — catálogo global de disciplinas pedagógicas. Chave
--    curta e estável (mat, por, ing, red, fis, qui, bio, his, geo).
--    Separada das `disciplinas` (que são por trilha) de propósito:
--    aqui é a matéria do EDITAL, não a da trilha de estudo.
-- ------------------------------------------------------------
create table if not exists materias (
  codigo  text primary key,                -- 'mat','por','ing','red','fis','qui','bio','his','geo'
  nome    text not null,
  abrev   text not null,
  ordem   int  not null default 0
);

-- ------------------------------------------------------------
-- 4) MATÉRIA NA PROVA — o coração do 15.2. Para cada concurso, quais
--    matérias caem, com quantas questões, peso, valor por questão e
--    o papel (objetiva ou redação). dia_numero liga ao bloco quando
--    o concurso separa por dia. unique(exam_tag, materia_codigo):
--    uma matéria aparece uma vez por concurso.
-- ------------------------------------------------------------
create table if not exists prova_materias (
  id              uuid primary key default gen_random_uuid(),
  exam_tag        text not null references concursos (codigo) on delete cascade,
  materia_codigo  text not null references materias (codigo),
  dia_numero      int,                       -- bloco/dia (quando aplicável)
  num_questoes    int  check (num_questoes is null or num_questoes >= 0),
  peso            numeric(4,2),              -- peso oficial (ex.: 2.0, 1.5, 1.0)
  valor_questao   numeric(5,2),              -- valor por questão quando o edital dá
  eh_redacao      boolean not null default false,
  bloco           text,                      -- agrupador do edital (ex.: 'Ciências', 'Estudos Sociais')
  status_dado     text not null default 'oficial' check (status_dado in ('oficial', 'inferencia', 'validar')),
  observacao      text,
  ordem           int  not null default 0,
  unique (exam_tag, materia_codigo)
);

-- ------------------------------------------------------------
-- 5) ASSUNTOS — tópicos dentro de uma matéria, por concurso (o
--    estilo da banca difere, então o assunto é por exam_tag).
--    prioridade: alta/media/baixa (preliminar, derivada de
--    peso × recorrência — recorrência ainda não medida → 15.7).
-- ------------------------------------------------------------
create table if not exists assuntos (
  id              uuid primary key default gen_random_uuid(),
  exam_tag        text not null references concursos (codigo) on delete cascade,
  materia_codigo  text not null references materias (codigo),
  nome            text not null,
  prioridade      text check (prioridade is null or prioridade in ('alta', 'media', 'baixa')),
  status_dado     text not null default 'inferencia' check (status_dado in ('oficial', 'inferencia', 'validar')),
  observacao      text,
  ordem           int  not null default 0,
  unique (exam_tag, materia_codigo, nome)
);

-- ------------------------------------------------------------
-- 6) SUBASSUNTOS — recorte de um assunto (ex.: cônicas → elipse).
-- ------------------------------------------------------------
create table if not exists subassuntos (
  id           uuid primary key default gen_random_uuid(),
  assunto_id   uuid not null references assuntos (id) on delete cascade,
  nome         text not null,
  status_dado  text not null default 'inferencia' check (status_dado in ('oficial', 'inferencia', 'validar')),
  ordem        int  not null default 0,
  unique (assunto_id, nome)
);

create index if not exists idx_prova_dias_exam       on prova_dias (exam_tag);
create index if not exists idx_prova_materias_exam   on prova_materias (exam_tag);
create index if not exists idx_assuntos_exam_materia on assuntos (exam_tag, materia_codigo);
create index if not exists idx_subassuntos_assunto   on subassuntos (assunto_id);

-- ============================================================
-- RLS — conteúdo GLOBAL (mesma doutrina de concursos/config_oficial):
-- leitura por qualquer autenticado; escrita só do service_role.
-- ============================================================
alter table provas         enable row level security;
alter table prova_dias     enable row level security;
alter table materias       enable row level security;
alter table prova_materias enable row level security;
alter table assuntos       enable row level security;
alter table subassuntos    enable row level security;

create policy provas_select         on provas         for select to authenticated using (true);
create policy prova_dias_select     on prova_dias     for select to authenticated using (true);
create policy materias_select       on materias       for select to authenticated using (true);
create policy prova_materias_select on prova_materias for select to authenticated using (true);
create policy assuntos_select       on assuntos       for select to authenticated using (true);
create policy subassuntos_select    on subassuntos    for select to authenticated using (true);

grant select, insert, update, delete on
  provas, prova_dias, materias, prova_materias, assuntos, subassuntos
  to authenticated, service_role;
