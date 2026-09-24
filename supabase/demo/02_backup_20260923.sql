-- ============================================================
-- DEMO 02 — backup do Instituto Meridiano ANTES do D07/D09 e do
-- mecanismo (23/09/2026). SÓ projeto de demonstração.
-- ------------------------------------------------------------
-- Regra 4 do documento: backup das linhas afetadas antes de escrever.
-- Aqui vai o dinâmico INTEIRO do Meridiano (não só as linhas do D07),
-- porque o mecanismo semanal apaga e reinsere tudo isso: este é o
-- ponto de restauração do estado de 23/09 (ver 90_restaurar_backup).
--
-- Nome: demo.backup_20260923_<tabela>. O documento sugeria
-- demo_backup_AAAAMMDD_<tabela> no public; ficou no schema `demo`
-- pelo mesmo motivo do 01 (fora do fingerprint e da API).
--
-- Idempotente: `if not exists` — rodar de novo NÃO sobrescreve o
-- backup original com um estado já alterado.
-- ============================================================

do $$
begin
  if not exists (select 1 from public.escolas
                  where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' and plano = 'demo') then
    raise exception 'supabase/demo: Meridiano/plano demo ausente — abortado';
  end if;
end $$;

create table if not exists demo.backup_20260923_registros_estudo as
  select * from public.registros_estudo where escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
create table if not exists demo.backup_20260923_simulados as
  select * from public.simulados where escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
create table if not exists demo.backup_20260923_metas as
  select * from public.metas where escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
create table if not exists demo.backup_20260923_meta_atividades as
  select * from public.meta_atividades where escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
create table if not exists demo.backup_20260923_aluno_eventos_progresso as
  select * from public.aluno_eventos_progresso where escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
create table if not exists demo.backup_20260923_aluno_niveis as
  select * from public.aluno_niveis where escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
create table if not exists demo.backup_20260923_aluno_nivel_historico as
  select * from public.aluno_nivel_historico where escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
create table if not exists demo.backup_20260923_aluno_missoes as
  select * from public.aluno_missoes where escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
create table if not exists demo.backup_20260923_trilha_semanas as
  select * from public.trilha_semanas where trilha_id = 'dddddddd-0000-4000-8000-000000000001';

do $$
declare t record;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'demo' and c.relname like 'backup\_%' and c.relkind = 'r' loop
    execute format('alter table demo.%I enable row level security', t.relname);
  end loop;
end $$;

-- conferência: tem de bater com o estado de 23/09 antes do D07
-- registros 90 · simulados 16 · metas 40 · meta_atividades 232
-- eventos 195 · níveis 34 · histórico de níveis 34 · missões 0 · semanas 9
select (select count(*) from demo.backup_20260923_registros_estudo)        as registros,
       (select count(*) from demo.backup_20260923_simulados)               as simulados,
       (select count(*) from demo.backup_20260923_metas)                   as metas,
       (select count(*) from demo.backup_20260923_meta_atividades)         as meta_atividades,
       (select count(*) from demo.backup_20260923_aluno_eventos_progresso) as eventos,
       (select count(*) from demo.backup_20260923_aluno_niveis)            as niveis,
       (select count(*) from demo.backup_20260923_aluno_nivel_historico)   as nivel_historico,
       (select count(*) from demo.backup_20260923_aluno_missoes)           as missoes,
       (select count(*) from demo.backup_20260923_trilha_semanas)          as semanas;
