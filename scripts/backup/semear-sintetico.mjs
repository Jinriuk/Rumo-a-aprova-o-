// ============================================================
// ETAPA 6 — ORIGEM SINTÉTICA do ensaio de restore (stack da E3)
// ------------------------------------------------------------
// Pré: scripts/e2e/stack.sh subir + scripts/e2e/banco.sh (migrations e
// seeds; a trava da E3 marca o banco como local). Deixa a stack com a
// forma dos bancos hospedados, para o dump sintético exercitar o que o
// dump de produção e o do demo vão exercitar:
//   1. contas no Auth LOCAL pela API admin (as contas de UI do E2E,
//      com senha conhecida): o ensaio entra com a senha ORIGINAL depois
//      do restore, o que prova que o hash sobreviveu. Sem a fixture da
//      matriz: a matriz roda depois, sobre o banco restaurado, e monta
//      a fixture dela numa transação desfeita;
//   2. o job da virada (0004) de volta ao cron, como nos dois
//      ambientes (o banco.sh da E3 o tira), e o ledger
//      supabase_migrations com uma linha por migration do repositório
//      (a cadeia da E3 vai por psql e não grava ledger; os hospedados
//      têm);
//   3. um schema `demo` mínimo com o desenho do de verdade (RLS ligada,
//      sem USAGE para anon/authenticated, sequência, função e job
//      próprio no cron), porque o do demo só existe lá.
// Tudo passa pela trava da E3 (host local, run id, marcador no banco).
// Uso: node scripts/backup/semear-sintetico.mjs
// ============================================================
import { pg, createClient } from "../e2e/deps.mjs";
import { travaCompleta } from "../e2e/trava.mjs";
import { carregarLocalEnv } from "../e2e/ambiente.mjs";
import { CONTAS, SENHA_E2E } from "../e2e/contas.mjs";
import { readdirSync } from "node:fs";

// contas com login no ensaio: uma por papel e por escola
export const CONTAS_ENSAIO = ["coordVitrine", "coordBeta", "lucas", "respLucas", "bruno", "respBruno", "alunaTroca", "alunoJornada"];

const env = carregarLocalEnv(process.env);
const db = new pg.Client({ connectionString: env.E2E_DB_URL });
await db.connect();
try {
  await travaCompleta(db, env);

  const admin = createClient(env.E2E_API_URL, env.E2E_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  for (const chave of CONTAS_ENSAIO) {
    const c = CONTAS[chave];
    const { error } = await admin.auth.admin.createUser({
      id: c.id, email: c.email, password: SENHA_E2E, email_confirm: true,
      app_metadata: { escola_id: c.escola, papel: c.papel }, user_metadata: { nome: c.nome },
    });
    if (error && !/already/i.test(error.message)) throw new Error(`${chave}: ${error.message}`);
  }
  await db.query("update usuarios set must_change_password = (id = $1) where id = any($2)",
    [CONTAS.alunaTroca.id, CONTAS_ENSAIO.map((k) => CONTAS[k].id)]);
  console.log(`contas no Auth local: ${CONTAS_ENSAIO.length}`);

  await db.query(`select cron.schedule('virar-semana-diaria', '5 3 * * *', $c$ select app.virar_semana(); $c$)`);

  const migrations = readdirSync(new URL("../../supabase/migrations/", import.meta.url))
    .filter((f) => f.endsWith(".sql")).sort().map((f) => f.replace(/\.sql$/, ""));
  await db.query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);`);
  for (const [i, nome] of migrations.entries()) {
    await db.query("insert into supabase_migrations.schema_migrations (version, name) values ($1, $2) on conflict do nothing",
      [`202609010${String(i).padStart(5, "0")}`, nome]);
  }
  console.log(`ledger sintético: ${migrations.length} migrations`);

  await db.query(`
    create schema if not exists demo;
    revoke all on schema demo from public, anon, authenticated;
    create table if not exists demo.execucoes (
      id bigserial primary key, rotina text not null, em timestamptz not null default now());
    alter table demo.execucoes enable row level security;
    revoke all on demo.execucoes from public, anon, authenticated;
    create or replace function demo.liberar() returns void language sql set search_path = '' as
      $f$ insert into demo.execucoes (rotina) values ('liberar') $f$;
    revoke all on function demo.liberar() from public, anon, authenticated;
    insert into demo.execucoes (rotina) select 'semente' where not exists (select 1 from demo.execucoes);
  `);
  await db.query(`select cron.schedule('demo-liberacao-diaria', '10 3 * * *', 'select demo.liberar()')`);
  console.log("cron: virar-semana-diaria e demo-liberacao-diaria; schema demo sintético");
} finally {
  await db.end();
}
