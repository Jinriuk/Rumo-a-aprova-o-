// ============================================================
// SEC3 / T75 — atomicidade da exclusão LGPD (banco + Auth)
// ------------------------------------------------------------
// Critério de aceite: "LGPD não deixa estado quebrado silencioso".
// A Edge Function lgpd-titular passou a apagar o Auth ANTES do banco,
// usando a lista que app.lgpd_usuarios_do_aluno devolve sem apagar
// nada. Aqui exercemos contra Postgres real essa peça de leitura —
// a base da ordem atômica:
//   - devolve a conta do aluno + responsáveis SEM outro vínculo;
//   - NÃO inclui responsável que ainda atende outro aluno;
//   - é SOMENTE LEITURA (não apaga, não fecha) — pode rodar antes de
//     qualquer deleção sem efeito colateral;
//   - bate EXATAMENTE com quem app.lgpd_excluir remove de fato;
//   - privilégio só do servidor (authenticated não lê a lista).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, ESCOLA_A, ALUNO_LUCAS } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const RESP_LUCAS = "aaaaaaaa-0000-4000-8000-000000000003";
const CONTA_LUCAS = "aaaaaaaa-0000-4000-8000-000000000002";

// Roda em transação com rollback. Como os arquivos de teste rodam em
// paralelo e vários mutam as linhas do Lucas (a exclusão LGPD cascateia
// metas/atividades), um deadlock transitório (40P01) é possível — a
// resposta padrão é reexecutar o cenário.
async function cenario(fn, tentativas = 5) {
  for (let i = 1; ; i++) {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("set local lock_timeout = '5s'");
      const r = await fn(c);
      await c.query("rollback").catch(() => {});
      return r;
    } catch (e) {
      await c.query("rollback").catch(() => {});
      if (e.code === "40P01" && i < tentativas) { await new Promise((res) => setTimeout(res, 40 * i)); continue; }
      throw e;
    } finally {
      c.release();
    }
  }
}

async function lista(c, aluno) {
  const r = await c.query("select app.lgpd_usuarios_do_aluno($1) as ids", [aluno]);
  return r.rows[0].ids;
}

test("devolve a conta do aluno + o responsável de vínculo único", async () => {
  await cenario(async (c) => {
    const ids = await lista(c, ALUNO_LUCAS);
    assert.ok(ids.includes(CONTA_LUCAS), "a conta do próprio aluno deve cair");
    assert.ok(ids.includes(RESP_LUCAS), "o responsável de vínculo único deve cair junto");
    assert.equal(ids.length, 2);
  });
});

test("NÃO inclui responsável que ainda atende outro aluno", async () => {
  await cenario(async (c) => {
    // novo aluno na escola A, vinculado ao MESMO responsável do Lucas
    const novoAluno = "a0000000-0000-4000-8000-0000000000aa";
    await c.query(
      "insert into alunos (id, escola_id, nome, trilha_id) select $1, escola_id, 'Outro', trilha_id from alunos where id = $2",
      [novoAluno, ALUNO_LUCAS],
    );
    await c.query(
      "insert into vinculos_responsaveis (escola_id, responsavel_id, aluno_id) values ($1, $2, $3)",
      [ESCOLA_A, RESP_LUCAS, novoAluno],
    );

    const ids = await lista(c, ALUNO_LUCAS);
    assert.ok(ids.includes(CONTA_LUCAS));
    assert.ok(!ids.includes(RESP_LUCAS), "o responsável tem outro vínculo: NÃO pode cair na exclusão do Lucas");
    assert.equal(ids.length, 1);
  });
});

test("é somente-leitura: chamar a lista não apaga nem altera nada", async () => {
  await cenario(async (c) => {
    const antes = await c.query("select count(*)::int n from alunos where id = $1", [ALUNO_LUCAS]);
    await lista(c, ALUNO_LUCAS);
    await lista(c, ALUNO_LUCAS);
    const depois = await c.query("select count(*)::int n from alunos where id = $1", [ALUNO_LUCAS]);
    assert.equal(antes.rows[0].n, 1);
    assert.equal(depois.rows[0].n, 1, "a leitura da lista não pode apagar o aluno");
    // os vínculos também continuam de pé
    const v = await c.query("select count(*)::int n from vinculos_responsaveis where aluno_id = $1", [ALUNO_LUCAS]);
    assert.ok(v.rows[0].n >= 1);
  });
});

test("a lista bate EXATAMENTE com quem app.lgpd_excluir remove de fato", async () => {
  await cenario(async (c) => {
    const previstos = (await lista(c, ALUNO_LUCAS)).slice().sort();
    const exc = await c.query("select app.lgpd_excluir($1) as r", [ALUNO_LUCAS]);
    const removidos = exc.rows[0].r.usuarios_removidos.slice().sort();
    assert.deepEqual(removidos, previstos, "a previsão (leitura) tem que ser idêntica à remoção real");
  });
});

test("aluno inexistente levanta erro (não devolve lista vazia silenciosa)", async () => {
  await cenario(async (c) => {
    let err = null;
    try { await lista(c, "00000000-0000-0000-0000-000000000000"); } catch (e) { err = e; }
    assert.ok(err, "aluno inexistente deve levantar, não devolver vazio");
  });
});

test("privilégio: usuário logado (authenticated) NÃO lê a lista de contas internas", async () => {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(
      "select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: RESP_LUCAS, role: "authenticated", app_metadata: { escola_id: ESCOLA_A, papel: "coordenacao" } })],
    );
    await c.query("set local role authenticated");
    for (const fn of [
      `select app.lgpd_usuarios_do_aluno('${ALUNO_LUCAS}')`,
      `select public.lgpd_usuarios_do_aluno('${ALUNO_LUCAS}')`,
    ]) {
      await c.query("savepoint sp");
      let err = null;
      try { await c.query(fn); } catch (e) { err = e; }
      await c.query("rollback to savepoint sp");
      assert.ok(err && /permission denied/i.test(err.message), `deveria recusar: ${fn}`);
    }
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
});
