-- ============================================================
-- 0001 — FUNDAÇÃO DE DADOS (Doc 6, seção 2)
-- ------------------------------------------------------------
-- Regra que organiza tudo: progresso pertence a uma escola e é
-- isolado. Conteúdo (trilha, disciplina, atividade-modelo) é
-- global, sem dono, lido por todos e escrito só pelo operador.
--
-- Toda tabela isolável nasce com escola_id (o dono/tenant) e com
-- RLS habilitada na migration 0002 — negar por padrão.
-- ============================================================

create extension if not exists pgcrypto;

-- Schema interno para helpers de identidade e motor.
create schema if not exists app;

-- ------------------------------------------------------------
-- Identidade: a escola e o papel viajam no token (Doc 6, seção 5).
-- No Supabase, o JWT chega em request.jwt.claims; estes helpers
-- são a ÚNICA porta pela qual as políticas leem a identidade.
-- ------------------------------------------------------------
create or replace function app.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

create or replace function app.usuario_id() returns uuid
language sql stable as $$
  select nullif(app.jwt() ->> 'sub', '')::uuid
$$;

create or replace function app.tenant_id() returns uuid
language sql stable as $$
  select nullif(app.jwt() -> 'app_metadata' ->> 'escola_id', '')::uuid
$$;

create or replace function app.papel() returns text
language sql stable as $$
  select app.jwt() -> 'app_metadata' ->> 'papel'
$$;

-- ============================================================
-- TENANT E PESSOAS (isoladas por escola)
-- ============================================================

create table if not exists escolas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  slug        text not null unique,
  -- White-label leve (Doc 6, 1.2): logo, nome e uma cor de acento.
  -- O design (navy/dourado/Fraunces/Archivo) é fixo no front.
  logo_url    text,
  cor_acento  text check (cor_acento is null or cor_acento ~ '^#[0-9a-fA-F]{6}$'),
  criada_em   timestamptz not null default now()
);

create table if not exists usuarios (
  id         uuid primary key,            -- mesmo id do auth.users (Supabase Auth)
  escola_id  uuid not null references escolas (id) on delete cascade,
  papel      text not null check (papel in ('coordenacao', 'aluno', 'responsavel')),
  nome       text not null,
  criado_em  timestamptz not null default now()
);

create table if not exists turmas (
  id         uuid primary key default gen_random_uuid(),
  escola_id  uuid not null references escolas (id) on delete cascade,
  nome       text not null,
  criada_em  timestamptz not null default now(),
  unique (escola_id, nome)
);

create table if not exists alunos (
  id             uuid primary key default gen_random_uuid(),
  escola_id      uuid not null references escolas (id) on delete cascade,
  -- Minimização (Doc 4, seção 8): só nome. Sem CPF, sem documento.
  nome           text not null,
  -- preenchido quando a credencial é provisionada (aluno é menor, não cria conta)
  usuario_id     uuid references usuarios (id) on delete set null,
  -- o aluno assina uma versão da trilha; a versão não muda embaixo do pé dele
  trilha_id      uuid,
  criado_em      timestamptz not null default now()
);

create table if not exists alunos_turmas (
  escola_id  uuid not null references escolas (id) on delete cascade,
  aluno_id   uuid not null references alunos (id) on delete cascade,
  turma_id   uuid not null references turmas (id) on delete cascade,
  primary key (aluno_id, turma_id)
);

create table if not exists vinculos_responsaveis (
  id              uuid primary key default gen_random_uuid(),
  escola_id       uuid not null references escolas (id) on delete cascade,
  responsavel_id  uuid not null references usuarios (id) on delete cascade,
  aluno_id        uuid not null references alunos (id) on delete cascade,
  criado_em       timestamptz not null default now(),
  unique (responsavel_id, aluno_id)
);

-- ============================================================
-- CONTEÚDO GLOBAL (sem dono — exceção deliberada, Doc 6 seção 2)
-- Lido por todas as escolas; escrito só pelo operador (service role).
-- ============================================================

create table if not exists trilhas (
  id         uuid primary key default gen_random_uuid(),
  nicho      text not null,               -- ex.: 'colegio-naval'
  nome       text not null,
  versao     int  not null default 1,
  publicada  boolean not null default false,
  criada_em  timestamptz not null default now(),
  unique (nicho, versao)
);

create table if not exists disciplinas (
  id         uuid primary key default gen_random_uuid(),
  trilha_id  uuid not null references trilhas (id) on delete cascade,
  codigo     text not null,               -- mat, ing, por, fis, qui, soc, red, prov
  nome       text not null,
  abrev      text not null,
  cor        text not null,
  ordem      int  not null,
  unique (trilha_id, codigo)
);

create table if not exists trilha_semanas (
  id             uuid primary key default gen_random_uuid(),
  trilha_id      uuid not null references trilhas (id) on delete cascade,
  numero         int  not null,
  inicio         date not null,
  fim            date not null,
  foco           text not null,
  simulado       text,                    -- ex.: 'Simulado 1' (SIM_PLAN da versão atual)
  meta_questoes  int  not null default 250,
  unique (trilha_id, numero)
);

create table if not exists atividades_modelo (
  id                 uuid primary key default gen_random_uuid(),
  trilha_id          uuid not null references trilhas (id) on delete cascade,
  semana_numero      int  not null,
  disciplina_codigo  text not null,
  prioridade         text not null check (prioridade in ('F', 'P', 'X')),  -- Fechar / Pincelar / Mínimo
  texto              text not null,
  ordem              int  not null
);

-- ============================================================
-- MOTOR (progresso — isolado por escola)
-- ============================================================

create table if not exists metas (
  id             uuid primary key default gen_random_uuid(),
  escola_id      uuid not null references escolas (id) on delete cascade,
  aluno_id       uuid not null references alunos (id) on delete cascade,
  trilha_id      uuid not null references trilhas (id),
  semana_numero  int  not null,
  inicio         date not null,
  fim            date not null,
  status         text not null default 'ativa' check (status in ('ativa', 'fechada')),
  gerada_em      timestamptz not null default now(),
  unique (aluno_id, trilha_id, semana_numero)
);

create table if not exists meta_atividades (
  id                   uuid primary key default gen_random_uuid(),
  escola_id            uuid not null references escolas (id) on delete cascade,
  meta_id              uuid not null references metas (id) on delete cascade,
  atividade_modelo_id  uuid not null references atividades_modelo (id),
  -- Estados do miolo do motor (Doc 6, 1.3): concluída, pendente, ignorada.
  estado               text not null default 'pendente' check (estado in ('pendente', 'concluida', 'ignorada')),
  atualizado_em        timestamptz not null default now(),
  unique (meta_id, atividade_modelo_id)
);

create table if not exists registros_estudo (
  id                 uuid primary key default gen_random_uuid(),
  escola_id          uuid not null references escolas (id) on delete cascade,
  aluno_id           uuid not null references alunos (id) on delete cascade,
  data               date not null,
  disciplina_codigo  text not null,
  topico             text,
  questoes           int  not null check (questoes > 0),
  acertos            int  check (acertos is null or (acertos >= 0 and acertos <= questoes)),
  minutos            int  check (minutos is null or minutos >= 0),
  obs                text,
  criado_em          timestamptz not null default now()
);

create table if not exists simulados (
  id         uuid primary key default gen_random_uuid(),
  escola_id  uuid not null references escolas (id) on delete cascade,
  aluno_id   uuid not null references alunos (id) on delete cascade,
  nome       text not null,
  data       date not null,
  -- acertos por matéria: {mat, ing, por, fis, qui, soc}
  -- Nota projetada do Dia 1 = (mat + ing) × 2,5 — calculada na exibição, preservada.
  acertos    jsonb not null default '{}'::jsonb,
  criado_em  timestamptz not null default now()
);

-- ============================================================
-- CONFORMIDADE (LGPD — desde o MVP, Doc 4 seção 8)
-- ============================================================

create table if not exists consentimentos (
  id                uuid primary key default gen_random_uuid(),
  escola_id         uuid not null references escolas (id) on delete cascade,
  aluno_id          uuid not null references alunos (id) on delete cascade,
  responsavel_nome  text not null,
  termo_versao      text not null default 'v1',
  aceito_em         timestamptz not null default now(),
  registrado_por    uuid not null            -- usuário da coordenação que registrou
);

create table if not exists logs_acesso (
  id          bigint generated always as identity primary key,
  escola_id   uuid not null references escolas (id) on delete cascade,
  aluno_id    uuid not null,                 -- sem FK: o log sobrevive à exclusão do aluno
  usuario_id  uuid not null,
  papel       text not null,
  acao        text not null,                 -- ex.: 'leitura-desempenho', 'exportacao-lgpd'
  em          timestamptz not null default now()
);

-- Índices para as consultas do dia a dia (porte: 5–6 escolas, sem exagero).
create index if not exists idx_usuarios_escola        on usuarios (escola_id);
create index if not exists idx_alunos_escola          on alunos (escola_id);
create index if not exists idx_alunos_usuario         on alunos (usuario_id);
create index if not exists idx_metas_aluno            on metas (aluno_id);
create index if not exists idx_meta_atividades_meta   on meta_atividades (meta_id);
create index if not exists idx_registros_aluno_data   on registros_estudo (aluno_id, data);
create index if not exists idx_simulados_aluno        on simulados (aluno_id);
create index if not exists idx_logs_acesso_escola     on logs_acesso (escola_id, em);
create index if not exists idx_vinculos_responsavel   on vinculos_responsaveis (responsavel_id);
create index if not exists idx_atividades_trilha_sem  on atividades_modelo (trilha_id, semana_numero);

-- ------------------------------------------------------------
-- Grants: o papel `authenticated` (usuário logado) pode falar com
-- as tabelas — a RLS (0002) decide LINHA a LINHA o que ele vê.
-- `anon` não recebe nada: sem login, sem dado.
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

grant usage on schema public to authenticated, anon, service_role;
grant usage on schema app to authenticated, service_role;
grant execute on function app.jwt(), app.usuario_id(), app.tenant_id(), app.papel() to authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage on all sequences in schema public to authenticated, service_role;
