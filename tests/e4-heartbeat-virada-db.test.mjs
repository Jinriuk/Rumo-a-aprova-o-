// ============================================================
// ETAPA 4 — heartbeat da virada (0060)
// ------------------------------------------------------------
// O Postgres do CI não tem pg_net nem Vault. O teste cria, dentro de uma
// transação que sempre volta, um `net.http_post` falso (grava a chamada
// numa tabela) e um `vault.decrypted_secrets` falso com hc_virada_url.
// O gatilho real da 0060 roda contra eles. A prova com o pg_net e o
// Vault de verdade é a da stack local (scripts/alertas/provas.mjs).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, ESCOLA_A } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const URL_HC = "https://hc-ping.com/00000000-0000-4000-8000-00000000c0de";

async function comStubs(fn, { segredo = URL_HC, falhar = false } = {}) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("create schema vault");
    await c.query("create table vault.decrypted_secrets (name text, decrypted_secret text, created_at timestamptz default now())");
    if (segredo !== null) await c.query("insert into vault.decrypted_secrets (name, decrypted_secret) values ('hc_virada_url', $1)", [segredo]);
    await c.query("create schema net");
    await c.query("create table net.chamadas (url text, body jsonb)");
    await c.query(`create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
                     headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint
                   language plpgsql as $f$ begin
                     if ${falhar ? "true" : "false"} then raise exception 'pg_net fora do ar'; end if;
                     insert into net.chamadas values (url, body); return 1; end $f$`);
    return await fn(c);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

const chamadas = (c) => c.query("select url, body from net.chamadas").then((r) => r.rows);
const DIA = "2026-03-02";

test("E4/0060: virada global sem erro pinga a URL do Vault, com as contagens e sem id de aluno", async () => {
  await comStubs(async (c) => {
    await c.query("delete from metas");
    const r = (await c.query("select * from app.virar_semana($1::date)", [DIA])).rows[0];
    const ch = await chamadas(c);
    assert.equal(ch.length, 1);
    if (r.alunos_com_erro === 0) assert.equal(ch[0].url, URL_HC);
    else assert.equal(ch[0].url, `${URL_HC}/fail`);
    assert.deepEqual(Object.keys(ch[0].body).sort(), ["alunos_com_erro", "data_referencia", "metas_fechadas", "metas_geradas"]);
    assert.equal(ch[0].body.metas_geradas, r.metas_geradas);
    assert.doesNotMatch(JSON.stringify(ch[0].body), /[0-9a-f]{8}-[0-9a-f]{4}-/, "id no corpo do ping");
  });
});

test("E4/0060: alunos_com_erro > 0 pinga <url>/fail", async () => {
  await comStubs(async (c) => {
    await c.query("insert into virada_execucoes (escola_id, data_referencia, alunos_com_erro, erros) values (null, $1, 2, '[]')", [DIA]);
    assert.deepEqual((await chamadas(c)).map((x) => x.url), [`${URL_HC}/fail`]);
  });
});

test("E4/0060: barra no fim da URL não duplica; virada por escola não pinga", async () => {
  await comStubs(async (c) => {
    await c.query("insert into virada_execucoes (escola_id, data_referencia) values ($1, $2)", [ESCOLA_A, DIA]);
    assert.equal((await chamadas(c)).length, 0, "virada por escola não é a do cron");
    await c.query("insert into virada_execucoes (escola_id, data_referencia, alunos_com_erro) values (null, $1, 1)", [DIA]);
    assert.deepEqual((await chamadas(c)).map((x) => x.url), [`${URL_HC}/fail`]);
  }, { segredo: `${URL_HC}/` });
});

test("E4/0060: sem o segredo no Vault, a virada conclui e nada é chamado", async () => {
  await comStubs(async (c) => {
    const antes = (await c.query("select count(*)::int n from virada_execucoes")).rows[0].n;
    await c.query("select * from app.virar_semana($1::date)", [DIA]);
    const depois = (await c.query("select count(*)::int n from virada_execucoes")).rows[0].n;
    assert.equal(depois, antes + 1, "a virada tem de gravar o heartbeat mesmo sem o ping");
    assert.equal((await chamadas(c)).length, 0);
  }, { segredo: null });
});

test("E4/0060: segredo que não é URL http(s) não é chamado", async () => {
  await comStubs(async (c) => {
    await c.query("insert into virada_execucoes (escola_id, data_referencia) values (null, $1)", [DIA]);
    assert.equal((await chamadas(c)).length, 0);
  }, { segredo: "javascript:alert(1)" });
});

test("E4/0060: pg_net com erro não derruba a virada", async () => {
  await comStubs(async (c) => {
    const r = await c.query("select * from app.virar_semana($1::date)", [DIA]);
    assert.equal(r.rows.length, 1);
    const n = (await c.query("select count(*)::int n from virada_execucoes where data_referencia = $1::date and escola_id is null", [DIA])).rows[0].n;
    assert.ok(n >= 1);
  }, { falhar: true });
});

test("E4/0060: sem pg_net nem Vault (este Postgres puro), a virada segue como antes", async () => {
  const c = await pool.connect();
  try {
    await c.query("begin");
    const r = await c.query("select * from app.virar_semana($1::date)", [DIA]);
    assert.equal(r.rows.length, 1);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
});
