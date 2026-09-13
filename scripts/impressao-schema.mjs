// ============================================================
// IMPRESSÃO DIGITAL DE SCHEMA — paridade entre ambientes (BKL-017)
// ------------------------------------------------------------
// Por que existe: `checar-migrations.mjs` compara o NOME dos arquivos
// do repo com o NOME das linhas do ledger. Isso responde "o ledger
// registrou?", não "o banco tem?". São perguntas diferentes, e em
// 13/09/2026 elas divergiram de forma perigosa:
//
//   produção (zckyhihxjjbnqjqilymn):  3 linhas no ledger
//   demo     (bdjkgrzfzoamchdpobbl): 48 linhas no ledger
//   repo:                            49 arquivos
//
// O checador de ledger acusaria 47 migrations "faltando" em produção
// e mandaria NÃO publicar o front. Todas falsas: produção foi criada
// a partir do demo em 03/09 e veio com o SCHEMA pronto, só sem a
// tabela de ledger. Medido: mesmas 47 tabelas, mesmas 412 colunas,
// mesmas 85 policies, mesmas 62 funções de negócio.
//
// Este script responde a pergunta certa — o que o banco TEM — para
// que a decisão de publicar não dependa de um registro que pode estar
// incompleto por motivo administrativo.
//
// ARMADILHA QUE ESTE CÓDIGO EVITA DE PROPÓSITO:
//   NÃO use `md5(string_agg(... order by ...))` no servidor. O ORDER BY
//   depende do collation do banco, e dois Postgres com locales
//   diferentes devolvem hashes diferentes para conteúdo IDÊNTICO. Foi
//   exatamente o falso alarme que me fez quase reportar drift nas
//   funções. A ordenação acontece AQUI, no cliente, sempre.
//
// Uso (a string de conexão NUNCA entra no repositório):
//   SUPABASE_DB_URL="postgresql://..." node scripts/impressao-schema.mjs
//   ... > impressao-producao.txt        (e compare com `diff`)
//
// Roda de QUALQUER diretório: o `pg` é resolvido por _pg.mjs a partir
// de tests/node_modules (ver a nota lá sobre por que o import nu
// falhava).
// ============================================================
import { createHash } from "node:crypto";
import { carregarPg } from "./_pg.mjs";

const conexao = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!conexao) {
  console.error("defina SUPABASE_DB_URL (ou DATABASE_URL) no ambiente — nunca no repositório");
  process.exit(2);
}

const pg = await carregarPg();
if (!pg) {
  console.error("pacote `pg` não encontrado. Instale as dependências de tests/:");
  console.error("  cd tests && npm ci");
  process.exit(2);
}
const { Client } = pg.default ?? pg;

const SCHEMAS = ["public", "app"];

// Cada consulta devolve linhas; a canonicalização (ordenar + juntar)
// é feita no cliente. Ver a nota sobre collation no cabeçalho.
const CONSULTAS = {
  tabelas: `
    select n.nspname || '.' || c.relname || ':rls=' || c.relrowsecurity as sig
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = any($1) and c.relkind = 'r'`,

  colunas: `
    select table_schema || '.' || table_name || '.' || column_name
           || ':' || data_type || ':' || is_nullable as sig
    from information_schema.columns
    where table_schema = any($1)`,

  policies: `
    select schemaname || '.' || tablename || '.' || policyname
           || ':' || coalesce(cmd, '-') || ':' || coalesce(roles::text, '-') as sig
    from pg_policies where schemaname = any($1)`,

  // Funções de EXTENSÃO ficam de fora: num Postgres local elas caem em
  // `public` (pgcrypto, uuid-ossp...), no Supabase vivem no schema
  // `extensions`. Incluí-las faria todo ambiente divergir por ruído —
  // foram 36 funções de diferença na primeira medição, nenhuma delas
  // do produto.
  funcoes: `
    select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
           || ':secdef=' || p.prosecdef as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
    where n.nspname = any($1) and d.objid is null`,

  indices: `
    select schemaname || '.' || tablename || '.' || indexname as sig
    from pg_indexes where schemaname = any($1)`,
};

const cliente = new Client({ connectionString: conexao });
try {
  await cliente.connect();
} catch (e) {
  console.error("não consegui conectar ao banco:", e.message);
  process.exit(2);
}

const secoes = {};
for (const [nome, sql] of Object.entries(CONSULTAS)) {
  const { rows } = await cliente.query(sql, [SCHEMAS]);
  // ordenação no CLIENTE, com comparação binária estável — nunca no servidor
  secoes[nome] = rows.map((r) => r.sig).sort();
}
await cliente.end();

const hash = (linhas) => createHash("md5").update(linhas.join("\n")).digest("hex");

const detalhado = process.argv.includes("--detalhado");

console.log("# impressão digital de schema");
console.log(`# schemas: ${SCHEMAS.join(", ")}`);
console.log("");
for (const [nome, linhas] of Object.entries(secoes)) {
  console.log(`${nome.padEnd(10)} n=${String(linhas.length).padStart(5)}  ${hash(linhas)}`);
}
console.log("");
console.log(`TOTAL      ${hash(Object.entries(secoes).map(([k, v]) => k + hash(v)))}`);

if (detalhado) {
  console.log("\n# --detalhado: conteúdo canônico (para `diff` entre dois ambientes)");
  for (const [nome, linhas] of Object.entries(secoes)) {
    for (const l of linhas) console.log(`${nome}\t${l}`);
  }
}
