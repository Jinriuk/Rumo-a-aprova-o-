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
--
-- ------------------------------------------------------------
-- DUAS ARMADILHAS A MAIS, achadas na Onda 2.5 (13/09/2026) ao comparar
-- o banco LOCAL (o que as migrations do repo produzem) com produção.
-- O script foi escrito para prod × demo, que são dois projetos
-- Supabase; nessa dupla as duas passavam despercebidas.
--
-- 1. COLLATION. `order by item` usa o collation do BANCO. Medido:
--    produção e demo em en_US.UTF-8, o banco local do reset-db.sh em
--    C.UTF-8. Ordens diferentes, hash diferente, schema IDÊNTICO —
--    falso positivo puro, de novo medindo o observador. Por isso todo
--    `order by` de hash aqui leva `collate "C"`.
--
-- 2. FUNÇÕES DE EXTENSÃO. Num Postgres vanilla `create extension` põe
--    as funções em `public` (pgcrypto, uuid-ossp...); no Supabase elas
--    vivem no schema `extensions`. Isso dava 98 funções no local
--    contra 62 em produção, nenhuma delas do produto. As categorias
--    `funcoes` e `acl_funcoes` agora excluem o que pertence a extensão
--    (pg_depend deptype='e'), medindo só código nosso.
--
-- ------------------------------------------------------------
-- 3. A TERCEIRA ARMADILHA ERA DESTE SCRIPT, e é a pior das três,
--    porque as outras duas davam FALSO POSITIVO (alarme sem
--    divergência) e esta dava FALSO NEGATIVO: silêncio com
--    divergência. Achada em 21/09/2026.
--
--    Até esta data a categoria `funcoes` hasheava só
--    `schema.nome(args) vol= secdef=`. NÃO hasheava o corpo. Duas
--    funções com a mesma assinatura e lógicas completamente
--    diferentes produziam hash idêntico. A categoria dizia "as 63
--    funções são as mesmas" quando só sabia que os 63 CABEÇALHOS
--    eram os mesmos.
--
--    Isso não é hipótese. Em 21/09/2026 este script foi rodado em
--    demo e produção para o baseline da Etapa 0
--    (docs/e0-baseline.md), os 12 hashes bateram, e o documento
--    afirmou paridade de schema entre os dois ambientes com esse
--    resultado. A afirmação se sustentou quando finalmente testada
--    contra o corpo — md5(prosrc) normalizado das 63 funções bate
--    nos dois; as únicas duas que divergiam no cru,
--    public.backoffice_criar_escola e public.backoffice_detalhe_escola,
--    diferiam só por quebra de linha dentro de um `coalesce` e de um
--    `jsonb_build_object`, zero divergência semântica.
--
--    Mas sustentou-se por sorte, não por método: o script não tinha
--    como saber disso, e teria dito exatamente a mesma coisa se os
--    corpos fossem outros. Uma ferramenta de paridade que não pode
--    ficar vermelha não é uma ferramenta de paridade.
--
--    A categoria `funcoes` agora inclui `corpo=` com o md5 do corpo
--    NORMALIZADO. O porquê de cada passo da normalização está no
--    comentário da própria categoria, mais abaixo.
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
  -- ATENÇÃO: `corpo=` é o que faz esta categoria medir LÓGICA e não só
  -- assinatura. Sem ele, duas funções com a mesma assinatura e corpos
  -- diferentes hasheiam igual — ver a armadilha 3 no cabeçalho.
  --
  -- O corpo é NORMALIZADO antes de hashear, na ordem abaixo, porque o
  -- cru diverge entre ambientes por motivo que não é lógica:
  --   1. `\r` — produção grava CRLF, o demo LF.
  --   2. comentários de linha (`--` até o fim da linha) — reaplicação
  --      via MCP apply_migration perde comentário que o ambiente que
  --      recebeu o SQL original preserva.
  --   3. whitespace colapsado — quebra de linha dentro de um
  --      `coalesce(...)` ou `jsonb_build_object(...)` é formatação.
  -- A ordem importa: tirar `\r` PRIMEIRO, senão `--foo\r\n` deixa o
  -- `\r` para trás quando o comentário sai.
  --
  -- LIMITE CONHECIDO, registrado para não virar a próxima omissão: o
  -- passo 2 não distingue `--` dentro de literal de texto ou de corpo
  -- dollar-quoted. Duas funções que difiram SÓ dentro de uma string
  -- contendo `--` hasheiam igual. É estreito, mas é falso-negativo, e
  -- está aqui escrito em vez de descoberto depois.
  select 'funcoes',
         format('%s.%s(%s) vol=%s secdef=%s corpo=%s', n.nspname, p.proname,
                pg_get_function_identity_arguments(p.oid), p.provolatile, p.prosecdef::text,
                md5(btrim(regexp_replace(
                      regexp_replace(
                        replace(coalesce(p.prosrc, ''), E'\r', ''),
                      '--[^\n]*', '', 'g'),
                    '\s+', ' ', 'g'))))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
   where n.nspname in ('public','app') and d.objid is null

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
    left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
   where n.nspname in ('public','app') and d.objid is null

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
-- `collate "C"` NÃO é decoração: sem ele este script compara o
-- observador, não o schema (ver a armadilha do collation no cabeçalho).
select categoria, count(*) as itens,
       md5(string_agg(item, E'\n' order by item collate "C")) as hash
  from itens
 group by categoria
union all
select 'TOTAL', count(*),
       md5(string_agg(categoria || '|' || item, E'\n'
                      order by (categoria || '|' || item) collate "C"))
  from itens
 order by 1;
