// ============================================================
// 0063 — tabela nova em public não nasce com GRANT para anon/authenticated
// ------------------------------------------------------------
// O Postgres do CI é vanilla: não tem o privilégio PADRÃO que o Supabase
// põe em public (ALL em tabela nova para anon, authenticated e
// service_role). Sem simular isso, um teste de "tabela nova sem grant"
// passaria aqui com ou sem a 0063. Por isso o teste principal:
//   1. fotografa a ACL de todas as relações de public;
//   2. instala o padrão do Supabase e confirma que ele vale (tabela
//      criada nesse estado nasce aberta para anon);
//   3. executa o arquivo da 0063;
//   4. confirma que a tabela criada depois nasce fechada para anon e
//      authenticated, e continua aberta para service_role;
//   5. confirma que a ACL das relações que já existiam não mudou.
// Tudo em transação desfeita no fim.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pool, comoServidor } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const MIGRATION = readFileSync(new URL("../supabase/migrations/0063_sem_grant_automatico_tabela_nova.sql", import.meta.url), "utf8");
const PRIVS = ["SELECT", "INSERT", "UPDATE", "DELETE"];

async function emTransacao(fn) {
  return comoServidor(async (c) => {
    await c.query("begin");
    try { return await fn(c); } finally { await c.query("rollback"); }
  });
}

async function acls(c) {
  const r = await c.query(`
    select c.oid::regclass::text as rel, c.relkind::text as tipo, coalesce(c.relacl::text, '') as acl
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
     order by 1`);
  return r.rows;
}

async function privilegios(c, papel, tabela) {
  const out = {};
  for (const p of PRIVS) {
    out[p] = (await c.query("select has_table_privilege($1, $2, $3) as ok", [papel, tabela, p])).rows[0].ok;
  }
  return out;
}

const nada = Object.fromEntries(PRIVS.map((p) => [p, false]));
const tudo = Object.fromEntries(PRIVS.map((p) => [p, true]));

test("com o padrão do Supabase, a 0063 fecha a tabela nova para anon e authenticated e não toca nas existentes", async () => {
  await emTransacao(async (c) => {
    const antes = await acls(c);
    assert.ok(antes.length > 50, `esperava as relações do schema public, vieram ${antes.length}`);

    // o estado do Supabase antes da 0063
    await c.query("alter default privileges in schema public grant all on tables to anon, authenticated, service_role");
    await c.query("create table public._t0063_antes (id int)");
    assert.deepEqual(await privilegios(c, "anon", "public._t0063_antes"), tudo,
      "a simulação do padrão do Supabase não valeu; o teste não provaria nada");

    await c.query(MIGRATION);

    await c.query("create table public._t0063_depois (id int)");
    assert.deepEqual(await privilegios(c, "anon", "public._t0063_depois"), nada);
    assert.deepEqual(await privilegios(c, "authenticated", "public._t0063_depois"), nada);
    assert.deepEqual(await privilegios(c, "service_role", "public._t0063_depois"), tudo,
      "service_role continua recebendo pelo padrão");

    const depois = (await acls(c)).filter((x) => !x.rel.startsWith("_t0063_"));
    assert.deepEqual(depois, antes, "a ACL de alguma relação que já existia mudou");
  });
});

test("depois das migrations do repositório, tabela nova em public nasce sem grant para anon e authenticated", async () => {
  await emTransacao(async (c) => {
    await c.query("create table public._t0063_ci (id int)");
    assert.deepEqual(await privilegios(c, "anon", "public._t0063_ci"), nada);
    assert.deepEqual(await privilegios(c, "authenticated", "public._t0063_ci"), nada);
  });
});

test("a 0063 roda duas vezes sem erro e sem mexer em ACL existente", async () => {
  await emTransacao(async (c) => {
    const antes = await acls(c);
    await c.query(MIGRATION);
    await c.query(MIGRATION);
    assert.deepEqual(await acls(c), antes);
  });
});

test("o padrão de public não guarda grant em tabela para anon nem authenticated", async () => {
  const r = await pool.query(`
    select pg_get_userbyid(d.defaclrole) as dono, a.grantee::regrole::text as papel, a.privilege_type
      from pg_default_acl d
      cross join lateral aclexplode(d.defaclacl) a
     where d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype = 'r'
       and a.grantee in (select oid from pg_roles where rolname in ('anon', 'authenticated'))`);
  assert.deepEqual(r.rows, []);
});
