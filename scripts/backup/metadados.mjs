// ============================================================
// ETAPA 6 — retrato de um banco para o backup e para o restore
// ------------------------------------------------------------
// Roda na ORIGEM, antes do dump (vai cifrado dentro do pacote como
// manifesto-interno.json), e no DESTINO, depois do restore. O
// comparar.mjs põe um contra o outro. Só leitura: SELECT em catálogo e
// count(*).
//
// O que mede:
//   • versão do Postgres, schemas presentes, última linha do ledger;
//   • contagem exata de linhas por tabela (schemas da aplicação e as
//     tabelas do Auth cujos dados entram no dump);
//   • estrutura por categoria, com os itens (não só o hash): tabelas e
//     RLS, colunas, índices, constraints, policies, funções (corpo,
//     search_path, security definer), triggers, views, valor das
//     sequências e ACL de tabela, coluna, sequência, função e schema;
//   • o que o dump por schema NÃO carrega e o restore refaz: jobs do
//     pg_cron e event triggers cujas funções são da aplicação.
//
// ACL é comparada pelo SIGNIFICADO: cada par (papel, privilégio) fora o
// dono, com NULL expandido para o default do Postgres. Dono e concedente
// mudam no restore (--no-owner) sem mudar quem pode o quê.
//
// Uso:  node scripts/backup/metadados.mjs <url> [saida.json]
//       (a URL também pode vir de METADADOS_DB_URL)
// ============================================================
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { carregarPg } from "../_pg.mjs";
import { SCHEMAS_APP, AUTH_SEM_DADOS } from "./toc.mjs";

const md5 = (s) => createHash("md5").update(s).digest("hex");

const HOSTS_LOCAIS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/**
 * Configuração do cliente `pg` para uma URL. Fora da máquina, TLS
 * sempre, sem conferir a cadeia: é o que o libpq do pg_dump faz por
 * padrão (sslmode=prefer), e o certificado do Supabase é de uma CA
 * própria. O `sslmode` da URL sai porque o `pg` o trataria como
 * verify-full e recusaria a conexão.
 */
export function configCliente(url, aplicacao = "triliva-backup") {
  const u = new URL(url);
  for (const p of ["sslmode", "sslrootcert", "sslcert", "sslkey"]) u.searchParams.delete(p);
  const local = HOSTS_LOCAIS.has(u.hostname);
  return { connectionString: u.toString(), application_name: aplicacao, ...(local ? {} : { ssl: { rejectUnauthorized: false } }) };
}

// ACL semântica: "papel:privilégio[*]" ordenados, sem o dono
const ACL_SQL = (col, tipo, dono) => `
  coalesce((select string_agg(x.item, ',' order by x.item collate "C") from (
      select case when e.grantee = 0 then 'PUBLIC' else pg_get_userbyid(e.grantee) end
             || ':' || e.privilege_type || case when e.is_grantable then '*' else '' end as item
        from aclexplode(coalesce(${col}, acldefault('${tipo}', ${dono}))) e
       where e.grantee <> ${dono}) x), '')`;

export const CONSULTAS = {
  tabelas: `
    select format('%s.%s kind=%s rls=%s force=%s', n.nspname, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity)
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where c.relkind in ('r','p','v','m','S') and n.nspname = any($1)`,
  colunas: `
    select format('%s.%s.%s %s null=%s def=%s', n.nspname, c.relname, a.attname,
                  format_type(a.atttypid, a.atttypmod), not a.attnotnull,
                  coalesce(pg_get_expr(d.adbin, d.adrelid), ''))
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
      left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
     where a.attnum > 0 and not a.attisdropped and c.relkind in ('r','p','v','m') and n.nspname = any($1)`,
  indices: `select format('%s %s', schemaname, indexdef) from pg_indexes where schemaname = any($1)`,
  constraints: `
    select format('%s.%s %s %s', n.nspname, c.relname, con.conname, pg_get_constraintdef(con.oid))
      from pg_constraint con join pg_class c on c.oid = con.conrelid join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = any($1)`,
  policies: `
    select format('%s.%s %s %s %s roles=%s using=%s check=%s', schemaname, tablename, policyname, permissive, cmd,
                  roles::text, coalesce(qual, ''), coalesce(with_check, ''))
      from pg_policies where schemaname = any($1)`,
  funcoes: `
    select format('%s.%s(%s) kind=%s vol=%s secdef=%s config=%s corpo=%s', n.nspname, p.proname,
                  pg_get_function_identity_arguments(p.oid), p.prokind, p.provolatile, p.prosecdef,
                  coalesce(array_to_string(p.proconfig, ';'), ''), md5(coalesce(p.prosrc, '')))
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
     where n.nspname = any($1) and d.objid is null`,
  triggers: `
    select format('%s.%s %s', n.nspname, c.relname, pg_get_triggerdef(t.oid))
      from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
     where not t.tgisinternal and n.nspname = any($1)`,
  views: `select format('%s.%s %s', schemaname, viewname, md5(definition)) from pg_views where schemaname = any($1)`,
  sequencias: `select format('%s.%s last=%s called=%s', schemaname, sequencename, last_value, last_value is not null) from pg_sequences where schemaname = any($1)`,
  acl_relacoes: `
    select format('%s.%s %s', n.nspname, c.relname, ${ACL_SQL("c.relacl", "r", "c.relowner")})
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where c.relkind in ('r','p','v','m','S') and n.nspname = any($1)`,
  acl_colunas: `
    select format('%s.%s.%s %s', n.nspname, c.relname, a.attname,
      coalesce((select string_agg(x.item, ',' order by x.item collate "C") from (
                  select pg_get_userbyid(e.grantee) || ':' || e.privilege_type as item
                    from aclexplode(a.attacl) e where e.grantee <> c.relowner) x), ''))
      from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
     where a.attacl is not null and a.attnum > 0 and n.nspname = any($1)`,
  acl_funcoes: `
    select format('%s.%s(%s) %s', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid),
                  ${ACL_SQL("p.proacl", "f", "p.proowner")})
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
     where n.nspname = any($1) and d.objid is null`,
  acl_schemas: `
    select format('%s %s', n.nspname, ${ACL_SQL("n.nspacl", "n", "n.nspowner")})
      from pg_namespace n where n.nspname = any($1)`,
};

async function linhas(c, sql, params = []) {
  return (await c.query(sql, params)).rows;
}

export async function coletar(c) {
  const { server_version: versao, server_version_num: versaoNum } =
    (await c.query("select current_setting('server_version') as server_version, current_setting('server_version_num')::int as server_version_num")).rows[0];
  const schemas = (await linhas(c, "select nspname from pg_namespace where nspname = any($1) order by 1", [SCHEMAS_APP]))
    .map((r) => r.nspname);

  let ultimaMigration = null;
  let ledgerLinhas = 0;
  if ((await linhas(c, "select to_regclass('supabase_migrations.schema_migrations') as t"))[0].t) {
    ledgerLinhas = (await linhas(c, "select count(*)::int as n from supabase_migrations.schema_migrations"))[0].n;
    const r = await linhas(c, "select version, name from supabase_migrations.schema_migrations order by version desc limit 1");
    if (r.length) ultimaMigration = { version: r[0].version, name: r[0].name ?? null };
  }

  // contagem exata: tabelas da aplicação + as do Auth que têm dado no dump
  const tabelas = await linhas(c, `
    select n.nspname as s, c.relname as t from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where c.relkind in ('r','p') and (n.nspname = any($1) or (n.nspname = 'auth' and c.relname <> 'schema_migrations' and not c.relname = any($2)))
     order by 1, 2`, [schemas, AUTH_SEM_DADOS]);
  const contagens = {};
  for (const { s, t } of tabelas) {
    const q = `select count(*)::bigint as n from ${c.escapeIdentifier(s)}.${c.escapeIdentifier(t)}`;
    contagens[`${s}.${t}`] = Number((await c.query(q)).rows[0].n);
  }

  const estrutura = {};
  for (const [cat, sql] of Object.entries(CONSULTAS)) {
    const itens = (await linhas(c, sql, [schemas])).map((r) => Object.values(r)[0])
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    estrutura[cat] = { n: itens.length, hash: md5(itens.join("\n")), itens };
  }

  let cron = [];
  if ((await linhas(c, "select to_regclass('cron.job') as t"))[0].t) {
    cron = (await linhas(c, "select jobname, schedule, command, active, database, username from cron.job order by jobname"))
      .map((r) => ({ ...r, command: r.command.trim() }));
  }

  // só os event triggers da aplicação; os da plataforma (extensions.*)
  // o destino já tem
  const eventTriggers = await linhas(c, `
    select e.evtname as nome, e.evtevent as evento, e.evttags as tags, e.evtenabled as habilitado,
           n.nspname as funcao_schema, p.proname as funcao
      from pg_event_trigger e join pg_proc p on p.oid = e.evtfoid join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = any($1) order by e.evtname`, [schemas]);

  const extensoes = await linhas(c, `
    select e.extname as nome, e.extversion as versao, n.nspname as schema
      from pg_extension e join pg_namespace n on n.oid = e.extnamespace order by 1`);

  return {
    postgres: { versao, versao_num: versaoNum, major: Math.floor(versaoNum / 10000) },
    schemas,
    ultima_migration: ultimaMigration,
    ledger_linhas: ledgerLinhas,
    contagens,
    estrutura,
    cron,
    event_triggers: eventTriggers,
    extensoes,
  };
}

// ── linha de comando ──────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.argv[2] || process.env.METADADOS_DB_URL;
  const saida = process.argv[3];
  if (!url) { console.error("uso: node scripts/backup/metadados.mjs <url> [saida.json]"); process.exit(2); }
  const pg = await carregarPg();
  if (!pg) { console.error("pacote pg ausente: rode `npm ci` em tests/"); process.exit(2); }
  const { Client } = pg.default ?? pg;
  const c = new Client(configCliente(url, "triliva-backup-metadados"));
  try {
    await c.connect();
    // transação só de leitura: nada aqui escreve, e se escrevesse, falharia
    await c.query("begin transaction isolation level repeatable read read only");
    const m = await coletar(c);
    await c.query("commit");
    const json = JSON.stringify(m, null, 1);
    if (saida) writeFileSync(saida, json + "\n"); else console.log(json);
  } catch (e) {
    console.error(`::error::metadados: ${e.message}`);
    process.exit(1);
  } finally {
    await c.end().catch(() => {});
  }
}
