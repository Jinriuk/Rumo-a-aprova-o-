// ============================================================
// ACESSO DA COORDENAÇÃO + BLOQUEIO DE ESCOLA SUSPENSA (D1A.1)
// ------------------------------------------------------------
// Cobre o bug da D1A e o gate da S1 (migration 0027):
//  - escola OPERACIONAL: coordenação/aluno/responsável veem o dado;
//  - escola SUSPENSA/CANCELADA: a RLS esconde TODO o dado de aluno,
//    mas a pessoa AINDA enxerga o próprio usuário e a escola (para o
//    front explicar "acesso suspenso" em vez de tela vazia);
//  - isolamento por escola continua de pé;
//  - as RPCs D0 (definir_status/dashboard/editar) operam só p/ super_admin.
// Tudo em transação com ROLLBACK — não suja o banco.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, IDS, ESCOLA_A, ESCOLA_B } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

// Roda fn como `identidade`, mas com a escola dela forçada a `status`.
// O UPDATE roda como postgres (antes de assumir o papel), então não
// depende de RLS; o rollback garante isolamento entre testes.
async function comEscolaEm(status, identidade, fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("update escolas set status = $1 where id = $2", [status, identidade.escola_id]);
    const claims = JSON.stringify({
      sub: identidade.sub, role: "authenticated",
      app_metadata: { escola_id: identidade.escola_id, papel: identidade.papel },
    });
    await c.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    await c.query("set local role authenticated");
    return await fn(c);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

const n = async (c, sql) => Number((await c.query(sql)).rows[0].n);

// ---------- escola ATIVA: acesso normal ----------

test("coordenação de escola ATIVA vê painel (alunos/turmas/resumo)", async () => {
  await comEscolaEm("ativa", IDS.coordA, async (c) => {
    assert.equal((await c.query("select app.tenant_operacional() as o")).rows[0].o, true);
    assert.ok(await n(c, "select count(*)::int n from alunos") > 0, "deveria ver alunos");
    assert.ok(await n(c, "select count(*)::int n from turmas") > 0, "deveria ver turmas");
    assert.ok(await n(c, "select count(*)::int n from public.resumo_escola()") > 0, "resumo deveria ter linhas");
  });
});

test("aluno de escola ATIVA vê o próprio dado", async () => {
  await comEscolaEm("ativa", IDS.alunoA, async (c) => {
    assert.ok(await n(c, "select count(*)::int n from alunos") >= 1, "aluno vê a si mesmo");
    assert.notEqual((await c.query("select app.meu_aluno_id() as id")).rows[0].id, null);
  });
});

test("responsável de escola ATIVA vê o aluno vinculado", async () => {
  await comEscolaEm("ativa", IDS.respA, async (c) => {
    assert.ok(await n(c, "select count(*)::int n from vinculos_responsaveis") >= 1);
    assert.ok(await n(c, "select count(*)::int n from alunos") >= 1);
  });
});

// ---------- escola SUSPENSA: bloqueio efetivo ----------

for (const status of ["suspensa", "cancelada"]) {
  test(`coordenação de escola ${status.toUpperCase()} é bloqueada (dado some, sem erro)`, async () => {
    await comEscolaEm(status, IDS.coordA, async (c) => {
      assert.equal((await c.query("select app.tenant_operacional() as o")).rows[0].o, false);
      assert.equal(await n(c, "select count(*)::int n from alunos"), 0, "nenhum aluno");
      assert.equal(await n(c, "select count(*)::int n from turmas"), 0, "nenhuma turma");
      assert.equal(await n(c, "select count(*)::int n from metas"), 0);
      assert.equal(await n(c, "select count(*)::int n from registros_estudo"), 0);
      assert.equal(await n(c, "select count(*)::int n from public.resumo_escola()"), 0);
    });
  });

  test(`aluno de escola ${status.toUpperCase()} é bloqueado`, async () => {
    await comEscolaEm(status, IDS.alunoA, async (c) => {
      assert.equal(await n(c, "select count(*)::int n from alunos"), 0);
      assert.equal(await n(c, "select count(*)::int n from registros_estudo"), 0);
      assert.equal((await c.query("select app.meu_aluno_id() as id")).rows[0].id, null);
    });
  });

  test(`responsável de escola ${status.toUpperCase()} é bloqueado`, async () => {
    await comEscolaEm(status, IDS.respA, async (c) => {
      assert.equal(await n(c, "select count(*)::int n from alunos"), 0);
      assert.equal(await n(c, "select count(*)::int n from registros_estudo"), 0);
    });
  });
}

test("na suspensão, a coordenação AINDA vê o próprio usuário e a escola (para o front explicar)", async () => {
  await comEscolaEm("suspensa", IDS.coordA, async (c) => {
    // o próprio perfil continua visível (id = usuario_id), senão o
    // login nem carregaria para mostrar a mensagem de suspensão
    const u = await c.query("select count(*)::int n from usuarios where id = $1", [IDS.coordA.sub]);
    assert.equal(u.rows[0].n, 1, "vê o próprio usuário");
    // e a escola, com o status legível
    const e = await c.query("select status from escolas where id = $1", [ESCOLA_A]);
    assert.equal(e.rows[0].status, "suspensa", "lê o status para explicar o bloqueio");
  });
});

// ---------- isolamento mantido ----------

test("coordenação NÃO vê outra escola, mesmo com a sua ativa", async () => {
  await comEscolaEm("ativa", IDS.coordA, async (c) => {
    const eb = await c.query("select count(*)::int n from escolas where id = $1", [ESCOLA_B]);
    assert.equal(eb.rows[0].n, 0, "não enxerga a escola B");
    const ab = await c.query("select count(*)::int n from alunos where escola_id = $1", [ESCOLA_B]);
    assert.equal(ab.rows[0].n, 0, "não enxerga alunos da escola B");
  });
});

// ---------- D0: status só muda via super_admin ----------

test("coordenação NÃO chama as RPCs de status do backoffice", async () => {
  await como(IDS.coordA, async (c) => {
    await c.query("savepoint sp1");
    await assert.rejects(
      () => c.query("select public.backoffice_definir_status($1, 'suspensa')", [ESCOLA_A]),
      /acesso negado/i,
    );
    await c.query("rollback to savepoint sp1");
    await assert.rejects(
      () => c.query("select public.backoffice_dashboard()"),
      /acesso negado/i,
    );
  });
});
