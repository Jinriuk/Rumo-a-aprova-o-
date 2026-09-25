// ============================================================
// ETAPA 3 — a trava de destino do E2E local (scripts/e2e/trava.mjs)
// ------------------------------------------------------------
// Antes de criar usuário, rodar seed ou limpar dado, o E2E exige host
// local, nenhum *.supabase.co, id de execução e o marcador da fixture no
// próprio banco. Aqui: cada recusa, e o marcador num banco de verdade
// (o Postgres local da suíte, dentro de uma transação desfeita).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { conferirDestino, criarMarcador, conferirMarcador, FIXTURE } from "../scripts/e2e/trava.mjs";
import { pool } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const LOCAL = {
  E2E_API_URL: "http://127.0.0.1:54321",
  E2E_DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  E2E_FUNCTIONS_URL: "http://127.0.0.1:54321/functions/v1",
  E2E_MAIL_URL: "http://localhost:54324",
};

test("trava: destino local com id de execução passa", () => {
  conferirDestino({ urls: LOCAL, runId: "gh-123456-1" });
  conferirDestino({ urls: { ...LOCAL, E2E_DB_URL: "postgresql://postgres:postgres@db:5432/postgres" }, runId: "local-20260925", internos: ["db"] });
});

test("trava: projeto hospedado é recusado sempre, mesmo declarado como interno", () => {
  for (const host of ["bdjkgrzfzoamchdpobbl.supabase.co", "zckyhihxjjbnqjqilymn.supabase.co", "x.supabase.com", "abc.supabase.in"]) {
    assert.throws(() => conferirDestino({ urls: { ...LOCAL, E2E_API_URL: `https://${host}` }, runId: "gh-1-1", internos: [host] }),
      /hospedado do Supabase é recusado sempre/, host);
  }
  assert.throws(() => conferirDestino({ urls: { ...LOCAL, E2E_DB_URL: "postgresql://postgres:x@db.zckyhihxjjbnqjqilymn.supabase.co:5432/postgres" }, runId: "gh-1-1" }),
    /recusado sempre/);
});

test("trava: host que não é local nem interno declarado é recusado", () => {
  assert.throws(() => conferirDestino({ urls: { ...LOCAL, E2E_API_URL: "http://10.0.0.8:54321" }, runId: "gh-1-1" }), /não é local nem interno/);
  assert.throws(() => conferirDestino({ urls: { ...LOCAL, E2E_MAIL_URL: "https://mail.example.com" }, runId: "gh-1-1" }), /não é local nem interno/);
});

test("trava: sem id de execução, ou com URL ausente, não há E2E", () => {
  assert.throws(() => conferirDestino({ urls: LOCAL, runId: "" }), /E2E_RUN_ID ausente/);
  assert.throws(() => conferirDestino({ urls: LOCAL, runId: "a b" }), /E2E_RUN_ID ausente ou inválido/);
  assert.throws(() => conferirDestino({ urls: { ...LOCAL, E2E_DB_URL: undefined }, runId: "gh-1-1" }), /E2E_DB_URL ausente/);
});

test("trava: o marcador da fixture nasce num banco sem marcador e recusa outra execução", async () => {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await assert.rejects(conferirMarcador(c, "gh-1-1"), /banco sem o marcador da fixture/, "banco sem marcador é recusado");
    await criarMarcador(c, "gh-1-1");
    await conferirMarcador(c, "gh-1-1");
    await assert.rejects(conferirMarcador(c, "gh-2-1"), /marcador não confere/, "marcador de outra execução é recusado");
    await assert.rejects(criarMarcador(c, "gh-2-1"), /marcador de outra execução/, "não se marca por cima de outra execução");
    const { rows } = await c.query("select fixture from e2e_local.execucao");
    assert.deepEqual(rows, [{ fixture: FIXTURE }]);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
});
