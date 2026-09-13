-- ============================================================
-- FINGERPRINT DE SCHEMA — paridade REAL entre ambientes
-- ------------------------------------------------------------
-- Complementa scripts/checar-migrations.mjs, não substitui.
--   • checar-migrations.mjs compara repo × LEDGER (o que o banco DIZ
--     que rodou). Cego para tudo que foi aplicado fora do fluxo.
--   • este script compara SCHEMA × SCHEMA (o que o banco É). Foi ele
--     que achou, em 07/09/2026, RLS ligada em app.acessos_codigo e
--     app.login_tentativas só em produção, sem migration nenhuma que
--     faça isso — divergência que o ledger nunca acusaria.
--
-- USO: rode nos dois bancos e compare os hashes linha a linha.
--   psql "$SUPABASE_DB_URL_PROD"  -f scripts/fingerprint-schema.sql
--   psql "$SUPABASE_DB_URL_TESTE" -f scripts/fingerprint-schema.sql
-- Hash igual = categoria idêntica. Hash diferente = drill down (troque
-- o SELECT final por `select item from itens where categoria = '...'`
-- nos dois e faça diff).
--
-- ------------------------------------------------------------
-- ARMADILHA JÁ PISADA (não reintroduza):
-- NÃO use information_schema.role_table_grants nem
-- information_schema.routine_privileges aqui. Essas views só mostram
-- linhas onde o papel CONECTADO é grantor/grantee. O MCP conecta como
-- `supabase_read_only_user` em produção e `postgres` em teste, o que
-- produzia 0 vs 1406 grants de tabela e 24 vs 161 de função: falso
-- positivo puro, medindo o observador e não o schema. Por isso aqui os
-- grants saem de pg_class.relacl / pg_proc.proacl, que independem de
-- quem conecta.
--
-- Pelo mesmo motivo nada usa `::regproc` cru: a renderização dele é
-- qualificada por schema ou não conforme o search_path do papel, o que
-- fazia os event triggers divergirem (`extensions.pgrst_ddl_watch` vs
-- `pgrst_ddl_watch`) sem nenhuma diferença real. O `set search_path`
-- abaixo trava a renderização de pg_get_expr / pg_get_constraintdef /
-- pg_get_indexdef / format_type pelo mesmo motivo.
-- ============================================================

set search_path = pg_catalog;

with itens as (
  -- tabelas + flag de RLS (a categoria que pegou o delta de 07/09)
  select 'tabelas' as categoria,
         format('%s.%s rls=%s', n.nspname, c.relname, c.relrowsecurity::text) as item
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where c.relkind in ('r','p') and n.nspname in ('public','app')

  union all
  select 'colunas',
         format('%s.%s.%s %s null=%s def=%s', n.nspname, c.relname, a.attname,
                format_type(a.atttypid, a.atttypmod), (not a.attnotnull)::text,
                coalesce(pg_get_expr(d.adbin, d.adrelid), ''))
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
   where a.attnum > 0 and not a.attisdropped
     and c.relkind in ('r','p') and n.nspname in ('public','app')

  union all
  select 'indices', indexdef from pg_indexes where schemaname in ('public','app')

  union all
  select 'constraints',
         format('%s.%s %s %s', n.nspname, c.relname, con.conname, pg_get_constraintdef(con.oid))
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public','app')

  union all
  select 'policies',
         format('%s.%s %s %s roles=%s using=%s check=%s', schemaname, tablename,
                policyname, cmd, roles::text, coalesce(qual,''), coalesce(with_check,''))
    from pg_policies where schemaname in ('public','app')

  union all
  select 'funcoes',
         format('%s.%s(%s) vol=%s secdef=%s', n.nspname, p.proname,
                pg_get_function_identity_arguments(p.oid), p.provolatile, p.prosecdef::text)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public','app')

  union all  -- grants de tabela via ACL (independe de quem conecta)
  select 'acl_tabelas',
         format('%s.%s %s', n.nspname, c.relname, coalesce(array_to_string(c.relacl, ','), 'NULL'))
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where c.relkind in ('r','p') and n.nspname in ('public','app')

  union all  -- grants de função via ACL (é o que a 0047 mexeu)
  select 'acl_funcoes',
         format('%s.%s(%s) %s', n.nspname, p.proname,
                pg_get_function_identity_arguments(p.oid),
                coalesce(array_to_string(p.proacl, ','), 'NULL'))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public','app')

  union all
  select 'triggers', format('%s.%s %s', n.nspname, c.relname, t.tgname)
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where not t.tgisinternal and n.nspname in ('public','app')

  union all  -- nome da função resolvido à mão, nunca por ::regproc
  select 'event_triggers',
         format('%s %s %s.%s enabled=%s', e.evtname, e.evtevent, n.nspname, p.proname, e.evtenabled)
    from pg_event_trigger e
    join pg_proc p on p.oid = e.evtfoid
    join pg_namespace n on n.oid = p.pronamespace

  union all
  select 'views', format('%s.%s', schemaname, viewname)
    from pg_views where schemaname in ('public','app')
)
select categoria, count(*) as itens, md5(string_agg(item, E'\n' order by item)) as hash
  from itens
 group by categoria
union all
select 'TOTAL', count(*), md5(string_agg(categoria || '|' || item, E'\n' order by categoria || '|' || item))
  from itens
 order by 1;
