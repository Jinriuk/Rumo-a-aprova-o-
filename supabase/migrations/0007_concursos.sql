-- ============================================================
-- 0007 — CONCURSOS (conteúdo global)
-- ------------------------------------------------------------
-- Cadastro dos concursos do nicho com a DATA MÉDIA histórica da
-- prova. O sistema usa a data do dia para calcular quanto falta
-- para a próxima ocorrência média. A escola seleciona em qual
-- concurso cada aluno entra. As trilhas específicas por concurso
-- ficam para depois (níveis diferentes: fundamental/médio/superior)
-- — o aluno pode estar num concurso sem trilha pronta.
-- Conteúdo global: leitura por todos, escrita só do operador.
-- ============================================================

create table if not exists concursos (
  id           uuid primary key default gen_random_uuid(),
  codigo       text not null unique,
  nome         text not null,
  organizacao  text not null,
  nivel        text not null,        -- informativo: fundamental | medio | medio-tecnico
  -- data MÉDIA histórica da prova (mês/dia); a contagem regressiva
  -- mira a próxima ocorrência a partir de hoje
  mes_prova    int  not null check (mes_prova between 1 and 12),
  dia_prova    int  not null check (dia_prova between 1 and 31),
  observacao   text,
  ordem        int  not null default 0
);

alter table alunos add column if not exists concurso_id uuid references concursos (id);

alter table concursos enable row level security;

create policy concursos_select on concursos for select to authenticated using (true);

grant select, insert, update, delete on concursos to authenticated, service_role;
