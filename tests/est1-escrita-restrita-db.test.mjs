// ============================================================
// EST1-A3 (0040) — ESCRITA RESTRITA: coluna no banco, whitelist no seam
// ------------------------------------------------------------
// Achado EST0 BANCO-03: a policy de update de meta_atividades gateava a
// LINHA mas não a COLUNA — o aluno podia trocar atividade_modelo_id
// para uma atividade F antes de concluir e maximizar XP (100 vs 40/60).
// A 0040 restringe o UPDATE do papel authenticated às colunas
// estado/atualizado_em. E o seam (atualizarAluno) ganhou whitelist
// explícita (patchAluno em shared/contratos/dto.js): campo desconhecido
// é ERRO na chamada, não um repasse silencioso ao banco.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, esperaErro, IDS, ALUNO_LUCAS } from "./identidades.mjs";
import { patchAluno, CAMPOS_ALUNO_EDITAVEIS } from "../app/src/shared/contratos/dto.js";

test.after(async () => { await pool.end(); });

async function objetivoDoLucas(c) {
  const r = await c.query(
    `select ma.id from meta_atividades ma join metas m on m.id = ma.meta_id
      where m.aluno_id=$1 limit 1`,
    [ALUNO_LUCAS],
  );
  assert.ok(r.rows.length === 1, "o Lucas tem objetivo de meta no seed");
  return r.rows[0].id;
}

test("aluno segue podendo concluir/reabrir o próprio objetivo (estado)", async () => {
  await como(IDS.alunoA, async (c) => {
    const id = await objetivoDoLucas(c);
    const r = await c.query(
      "update meta_atividades set estado='concluida', atualizado_em=now() where id=$1 returning estado",
      [id],
    );
    assert.equal(r.rows[0].estado, "concluida", "o fluxo legítimo não quebrou");
  });
});

test("aluno NÃO troca a atividade-modelo (privilégio por coluna barra antes da RLS)", async () => {
  await como(IDS.alunoA, async (c) => {
    const id = await objetivoDoLucas(c);
    await esperaErro(c, /permission denied/i,
      "update meta_atividades set atividade_modelo_id = gen_random_uuid() where id=$1",
      [id]);
    await esperaErro(c, /permission denied/i,
      "update meta_atividades set meta_id = gen_random_uuid() where id=$1",
      [id]);
    await esperaErro(c, /permission denied/i,
      "update meta_atividades set escola_id = gen_random_uuid() where id=$1",
      [id]);
  });
});

test("coordenação continua sem escrever progresso do aluno (RLS de linha)", async () => {
  await como(IDS.coordA, async (c) => {
    const r = await c.query(
      `update meta_atividades set estado='concluida'
        where meta_id in (select id from metas where aluno_id=$1)`,
      [ALUNO_LUCAS],
    );
    assert.equal(r.rowCount, 0, "nenhuma linha alcançada: coordenação não falsifica progresso");
  });
});

/* ---------- whitelist pura do seam (patchAluno) ---------- */

test("patchAluno aceita exatamente os campos que a tela edita", () => {
  const patch = patchAluno({ nome: "Novo Nome", trilha_id: null, concurso_id: "abc" });
  assert.deepEqual(patch, { nome: "Novo Nome", trilha_id: null, concurso_id: "abc" });
  assert.deepEqual(CAMPOS_ALUNO_EDITAVEIS, ["nome", "trilha_id", "concurso_id"]);
});

test("patchAluno recusa campo desconhecido (erro, não filtro silencioso)", () => {
  assert.throws(() => patchAluno({ nome: "X", usuario_id: "hack" }), /não permitido.*usuario_id/);
  assert.throws(() => patchAluno({ escola_id: "outra" }), /não permitido.*escola_id/);
  assert.throws(() => patchAluno({}), /nada para atualizar/);
  assert.throws(() => patchAluno(null), /nada para atualizar/);
});
