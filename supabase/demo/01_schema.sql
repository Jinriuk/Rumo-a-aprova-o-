-- ============================================================
-- DEMO 01 — schema `demo`: estado, fila e gravação da demonstração
-- ------------------------------------------------------------
-- APLICAR SÓ NO PROJETO DE DEMONSTRAÇÃO (bdjkgrzfzoamchdpobbl), via
-- SQL editor / execute_sql. NÃO é migration: não entra no ledger
-- supabase_migrations, não roda em produção e não roda no CI.
--
-- Por que um schema próprio e não tabelas `demo_*` no public:
--   * scripts/fingerprint-schema.sql só mede public e app, então nada
--     daqui cria diferença de schema entre demonstração e produção;
--   * o PostgREST só expõe public, então nada daqui vira API;
--   * o gatilho de evento rls_auto_enable só age em public — aqui o
--     RLS é ligado à mão, e anon/authenticated não têm USAGE.
--
-- Idempotente: rodar de novo não apaga gravação nem estado.
-- ============================================================

do $$
begin
  if not exists (select 1 from public.escolas
                  where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' and plano = 'demo') then
    raise exception 'supabase/demo: este banco não tem o Instituto Meridiano com plano demo — abortado (projeto errado?)';
  end if;
end $$;

create schema if not exists demo;
comment on schema demo is
  'Demonstração "semana 4 em repetição" do Instituto Meridiano. Só existe no projeto de demonstração. Ver docs/demo/HISTORIA.md.';

-- ── constantes (uma fonte só para as duas chaves do tenant) ─────────
create or replace function demo.escola() returns uuid
  language sql immutable set search_path = '' as
$$ select 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid $$;

create or replace function demo.trilha() returns uuid
  language sql immutable set search_path = '' as
$$ select 'dddddddd-0000-4000-8000-000000000001'::uuid $$;

-- ── estado: onde a semana 4 está ancorada agora ─────────────────────
create table if not exists demo.estado (
  id            boolean primary key default true check (id),
  ancora        date,                         -- segunda-feira da semana 4 vigente
  pausado       boolean not null default false,
  atualizado_em timestamptz not null default now()
);
insert into demo.estado (id) values (true) on conflict (id) do nothing;

-- ── log de execuções do mecanismo ───────────────────────────────────
create table if not exists demo.execucoes (
  id           bigserial primary key,
  acao         text not null,                 -- gravar | virar_semana | liberar | pausado
  hoje         date not null,
  ancora       date,
  detalhe      jsonb not null default '{}'::jsonb,
  executado_em timestamptz not null default now()
);

-- ── fila: o que já está na gravação mas ainda não "aconteceu" ──────
-- libera_em é o dia LOCAL a partir de cujo 00:10 a linha aparece no
-- produto. tabela = meta_atividades significa "marcar como concluída".
create table if not exists demo.fila (
  tabela    text not null check (tabela in ('registros_estudo', 'simulados', 'meta_atividades', 'aluno_eventos_progresso')),
  id        uuid not null,
  libera_em date not null,
  primary key (tabela, id)
);

-- ── gravação: o Meridiano das semanas 1 a 4, em dias relativos ──────
-- `dia` = data − segunda-feira da semana 4 da gravação (14/09/2026 na
-- gravação de 23/09). A mesma gravação é reproduzida toda semana com
-- as datas somadas à segunda-feira corrente.
create table if not exists demo.gravacao_semanas (
  numero     int primary key,
  dia_inicio int not null,
  dia_fim    int not null
);

create table if not exists demo.gravacao_registros (
  id                uuid primary key,
  aluno_id          uuid not null,
  dia               int not null,
  disciplina_codigo text not null,
  topico            text,
  questoes          int not null,
  acertos           int,
  minutos           int,
  obs               text,
  criado_hora       time not null,
  libera_dia        int not null
);

create table if not exists demo.gravacao_simulados (
  id           uuid primary key,
  aluno_id     uuid not null,
  nome         text not null,
  dia          int not null,
  acertos      jsonb not null,
  exam_tag     text,
  redacao_nota numeric,
  criado_hora  time not null,
  libera_dia   int not null
);

create table if not exists demo.gravacao_metas (
  id            uuid primary key,
  aluno_id      uuid not null,
  semana_numero int not null
);

create table if not exists demo.gravacao_meta_atividades (
  id                  uuid primary key,
  meta_id             uuid not null,
  atividade_modelo_id uuid not null,
  estado              text not null,
  dia_conclusao       int,                    -- só para estado = concluida
  libera_dia          int                     -- dia_conclusao + 1
);

create table if not exists demo.gravacao_eventos (
  id                uuid primary key,
  aluno_id          uuid not null,
  exam_tag          text,
  tipo_evento       text not null,
  origem            text not null,
  referencia_tabela text,
  referencia_id     uuid,
  xp_delta          int not null,
  metadata          jsonb not null,
  idempotency_key   text not null,
  criado_por        uuid,
  dia               int not null,
  criado_hora       time not null,
  libera_dia        int not null
);

-- estado derivado (níveis por matéria): restaurado como foi gravado,
-- com os carimbos originais — nenhuma tela mostra essas datas.
create table if not exists demo.gravacao_niveis (like public.aluno_niveis);
create table if not exists demo.gravacao_nivel_historico (like public.aluno_nivel_historico);

-- ── ninguém além do dono enxerga nada disto ─────────────────────────
revoke all on schema demo from public;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on schema demo from %I', r);
      execute format('revoke all on all tables in schema demo from %I', r);
      execute format('revoke all on all functions in schema demo from %I', r);
    end if;
  end loop;
end $$;
revoke all on all functions in schema demo from public;

do $$
declare t record;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'demo' and c.relkind = 'r' loop
    execute format('alter table demo.%I enable row level security', t.relname);
  end loop;
end $$;
