// Fase A.8 — trilha de ações sensíveis da coordenação (turma, marca,
// importação de alunos). Confere a RLS nova da 0022: só a própria
// coordenação grava (como si mesma, na própria escola), só a
// coordenação lê, e só os logs da própria escola.
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, esperaErro, IDS, ESCOLA_A, ESCOLA_B } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

test("coordenação registra um log de ação sensível para a própria escola", async () => {
  await como(IDS.coordA, async (c) => {
    const r = await c.query(
      `insert into logs_coordenacao (escola_id, usuario_id, papel, acao, entidade, detalhe)
       values ($1, $2, 'coordenacao', 'criou-turma', 'turma', '{"nome":"Turma X"}'::jsonb) returning id`,
      [ESCOLA_A, IDS.coordA.sub],
    );
    assert.equal(r.rows.length, 1);
  });
});

test("coordenação NÃO registra log em nome de outro usuário", async () => {
  await como(IDS.coordA, async (c) => {
    await esperaErro(c, /row-level security|policy/i,
      `insert into logs_coordenacao (escola_id, usuario_id, papel, acao)
       values ($1, $2, 'coordenacao', 'criou-turma')`,
      [ESCOLA_A, IDS.coordB.sub]);
  });
});

test("coordenação NÃO registra log para outra escola", async () => {
  await como(IDS.coordA, async (c) => {
    await esperaErro(c, /row-level security|policy/i,
      `insert into logs_coordenacao (escola_id, usuario_id, papel, acao)
       values ($1, $2, 'coordenacao', 'criou-turma')`,
      [ESCOLA_B, IDS.coordA.sub]);
  });
});

test("aluno e responsável NÃO registram log de coordenação", async () => {
  for (const id of [IDS.alunoA, IDS.respA]) {
    await como(id, async (c) => {
      await esperaErro(c, /row-level security|policy/i,
        `insert into logs_coordenacao (escola_id, usuario_id, papel, acao)
         values ($1, $2, $3, 'criou-turma')`,
        [ESCOLA_A, id.sub, id.papel]);
    });
  }
});

test("aluno e responsável NÃO leem logs de coordenação", async () => {
  for (const id of [IDS.alunoA, IDS.respA]) {
    await como(id, async (c) => {
      const r = await c.query("select count(*)::int as n from logs_coordenacao where escola_id = $1", [ESCOLA_A]);
      assert.equal(r.rows[0].n, 0, `${id.papel} enxergou logs_coordenacao`);
    });
  }
});

test("coordenação não lê log de outra escola", async () => {
  await como(IDS.coordA, async (c) => {
    const r = await c.query("select count(*)::int as n from logs_coordenacao where escola_id = $1", [ESCOLA_B]);
    assert.equal(r.rows[0].n, 0);
  });
});
