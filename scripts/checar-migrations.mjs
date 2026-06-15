// ============================================================
// CHECAR MIGRATIONS — paridade repo × banco (Fase 17.1)
// ------------------------------------------------------------
// Compara as migrations versionadas no repositório
// (supabase/migrations/*.sql) com as efetivamente aplicadas no banco
// (tabela supabase_migrations.schema_migrations) e ACUSA divergência.
//
// Existe porque produção já ficou 9 migrations atrás do código sem
// ninguém perceber. Rode ANTES de publicar o front quando ele depender
// do banco — e deixe falhar (exit 1) se faltar migration.
//
// Uso (a string de conexão NUNCA entra no repositório):
//   SUPABASE_DB_URL="postgresql://postgres:SENHA@HOST:5432/postgres" \
//     node scripts/checar-migrations.mjs
// Aceita também DATABASE_URL. Requer o pacote `pg` disponível
// (ex.: rode de dentro de tests/, que já o tem:  cd tests && node ../scripts/checar-migrations.mjs).
//
// Saída: lista o que está aplicado, o que FALTA aplicar (bloqueia) e o
// que está no banco mas não no repo (drift — investigar). Exit:
//   0 = em dia    1 = faltam migrations    2 = erro de conexão/uso
// ============================================================
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const conexao = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!conexao) {
  console.error("defina SUPABASE_DB_URL (ou DATABASE_URL) no ambiente — nunca no repositório");
  process.exit(2);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");
const locais = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => f.replace(/\.sql$/, ""))
  .sort();

let Client;
try {
  ({ Client } = await import("pg"));
} catch {
  console.error("pacote `pg` não encontrado. Rode de dentro de tests/ (que já o tem):");
  console.error("  cd tests && node ../scripts/checar-migrations.mjs");
  process.exit(2);
}

const cliente = new Client({ connectionString: conexao });
try {
  await cliente.connect();
} catch (e) {
  console.error("não consegui conectar ao banco:", e.message);
  process.exit(2);
}

let aplicadas;
try {
  const { rows } = await cliente.query(
    "select name from supabase_migrations.schema_migrations order by version",
  );
  aplicadas = rows.map((r) => r.name);
} catch (e) {
  console.error("não consegui ler supabase_migrations.schema_migrations:", e.message);
  await cliente.end();
  process.exit(2);
}
await cliente.end();

const setAplicadas = new Set(aplicadas);
const setLocais = new Set(locais);
const faltando = locais.filter((n) => !setAplicadas.has(n)); // no repo, não no banco → BLOQUEIA
const drift = aplicadas.filter((n) => !setLocais.has(n));     // no banco, não no repo → investigar

console.log(`repo:  ${locais.length} migrations`);
console.log(`banco: ${aplicadas.length} aplicadas`);

if (drift.length) {
  console.log(`\n⚠ no banco mas NÃO no repo (drift — investigar):`);
  for (const n of drift) console.log(`   • ${n}`);
}

if (faltando.length) {
  console.log(`\n❌ FALTAM aplicar no banco (${faltando.length}) — NÃO publique o front:`);
  for (const n of faltando) console.log(`   • ${n}`);
  console.log(`\nAplique as migrations primeiro (supabase db push ou seu pipeline).`);
  process.exit(1);
}

console.log(`\n✓ banco em dia com o repositório.`);
process.exit(0);
