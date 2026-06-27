// ============================================================
// S1.5 — ESCOLA SUSPENSA: bloqueio EFETIVO no banco (RLS), não só rótulo
// ------------------------------------------------------------
// Prova, contra o Postgres real (mesmas migrations de produção), que ao
// marcar a escola como 'suspensa'/'cancelada':
//   • o ALUNO perde a identidade (app.meu_aluno_id() → null) e não lê
//     mais nenhum registro/meta/simulado próprio;
//   • a COORDENAÇÃO não enxerga mais alunos nem o painel (resumo_escola
//     devolve vazio);
//   • com a escola ATIVA, tudo volta a aparecer (o gate é só o status).
// Tudo em transação com ROLLBACK — não suja o banco.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, ESCOLA_A, IDS } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const claimsDe = (id) => JSON.stringify({
  sub: id.sub, role: "authenticated",
  app_metadata: { escola_id: id.escola_id, papel: id.papel },
});

// roda fn(c) como `id`, com a ESCOLA_A no status pedido, em transação
// que sempre faz rollback. O status é trocado por dentro (privilégio de
// dono), antes de baixar para o papel `authenticated`.
async function comStatus(status, id, fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("update escolas set status = $1 where id = $2", [status, ESCOLA_A]);
    await c.query("select set_config('request.jwt.claims', $1, true)", [claimsDe(id)]);
    await c.query("set local role authenticated");
    return await fn(c);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

const conta = async (c, sql) => (await c.query(sql)).rows[0].n;

test("S1.5: escola ATIVA — aluno e coordenação enxergam normalmente", async () => {
  await comStatus("ativa", IDS.alunoA, async (c) => {
    const idNN = await conta(c, "select (app.meu_aluno_id() is not null)::int as n");
    assert.equal(idNN, 1, "aluno tem identidade quando a escola está ativa");
  });
  await comStatus("ativa", IDS.coordA, async (c) => {
    const alunos = await conta(c, "select count(*)::int as n from alunos");
    assert.ok(alunos > 0, "coordenação vê alunos quando ativa");
    const painel = await conta(c, "select count(*)::int as n from public.resumo_escola()");
    assert.ok(painel > 0, "painel agregado traz linhas quando ativa");
  });
});

test("S1.5: escola SUSPENSA — aluno perde identidade e não lê nada próprio", async () => {
  await comStatus("suspensa", IDS.alunoA, async (c) => {
    const idNN = await conta(c, "select (app.meu_aluno_id() is not null)::int as n");
    assert.equal(idNN, 0, "app.meu_aluno_id() colapsa para null quando suspensa");
    const reg = await conta(c, "select count(*)::int as n from registros_estudo");
    assert.equal(reg, 0, "nenhum registro de estudo sai para o aluno suspenso");
    const metas = await conta(c, "select count(*)::int as n from metas");
    assert.equal(metas, 0, "nenhuma meta sai para o aluno suspenso");
    const sim = await conta(c, "select count(*)::int as n from simulados");
    assert.equal(sim, 0, "nenhum simulado sai para o aluno suspenso");
  });
});

test("S1.5: escola SUSPENSA — coordenação não vê alunos nem painel", async () => {
  await comStatus("suspensa", IDS.coordA, async (c) => {
    const alunos = await conta(c, "select count(*)::int as n from alunos");
    assert.equal(alunos, 0, "coordenação suspensa não enxerga alunos");
    const painel = await conta(c, "select count(*)::int as n from public.resumo_escola()");
    assert.equal(painel, 0, "resumo_escola devolve vazio quando suspensa");
    const turmas = await conta(c, "select count(*)::int as n from turmas");
    assert.equal(turmas, 0, "coordenação suspensa não enxerga turmas");
  });
});

test("S1.5: escola CANCELADA — mesmo bloqueio da suspensa (aluno)", async () => {
  await comStatus("cancelada", IDS.alunoA, async (c) => {
    const idNN = await conta(c, "select (app.meu_aluno_id() is not null)::int as n");
    assert.equal(idNN, 0, "cancelada também colapsa a identidade do aluno");
    const reg = await conta(c, "select count(*)::int as n from registros_estudo");
    assert.equal(reg, 0, "cancelada não deixa o aluno ler registros");
  });
});

test("S1.5: a IDENTIDADE (própria linha e a escola) continua legível p/ a tela de suspensão", async () => {
  // o front precisa ler a própria linha de usuarios e a escola (status)
  // para mostrar 'Acesso suspenso' com a marca — isso NÃO pode ser barrado.
  await comStatus("suspensa", IDS.coordA, async (c) => {
    const eu = await conta(c, `select count(*)::int as n from usuarios where id = '${IDS.coordA.sub}'`);
    assert.equal(eu, 1, "o usuário ainda lê a própria linha (identidade)");
    const esc = await conta(c, `select count(*)::int as n from escolas where id = '${ESCOLA_A}'`);
    assert.equal(esc, 1, "a escola (marca/status) continua legível para a tela de suspensão");
  });
});
