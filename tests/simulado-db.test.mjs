// ============================================================
// SIMULADO POR CONCURSO (Fase 15.6) — banco e RLS
// ------------------------------------------------------------
// As novas colunas (exam_tag, redacao_nota) funcionam e a RLS de
// `simulados` (14.5) segue valendo: o aluno escreve o PRÓPRIO
// simulado amarrado ao concurso; coordenação lê; o isolamento entre
// escolas se mantém. A avaliação por concurso é provada na lógica
// pura (simulado.test.mjs); aqui o foco é a persistência segura.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, esperaErro, IDS, ESCOLA_A, ESCOLA_B, ALUNO_LUCAS } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

test("o simulado de demo do CN traz exam_tag e nota de redação", async () => {
  await como(IDS.coordA, async (c) => {
    const r = await c.query("select exam_tag, redacao_nota, acertos from simulados where id = 'a4000000-0000-4000-8000-000000000001'");
    assert.equal(r.rows[0].exam_tag, "cn");
    assert.equal(Number(r.rows[0].redacao_nota), 70);
    assert.equal(r.rows[0].acertos.bio, 4, "tem Biologia separada (estrutura real do CN)");
  });
});

test("o aluno registra o PRÓPRIO simulado amarrado ao concurso", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query(
      `insert into simulados (escola_id, aluno_id, nome, data, exam_tag, acertos, redacao_nota)
       values ($1, $2, 'Meu simulado CN', current_date, 'cn', '{"mat": 12}'::jsonb, 55) returning exam_tag`,
      [ESCOLA_A, ALUNO_LUCAS]
    );
    assert.equal(r.rows[0].exam_tag, "cn");
  });
});

test("o aluno NÃO registra simulado em nome de outro aluno / outra escola", async () => {
  await como(IDS.alunoA, async (c) => {
    await esperaErro(
      c, /row-level security/i,
      `insert into simulados (escola_id, aluno_id, nome, data, exam_tag, acertos)
       values ($1, $2, 'forjado', current_date, 'cn', '{}'::jsonb)`,
      [ESCOLA_B, "b0000000-0000-4000-8000-000000000001"]
    );
  });
});

test("exam_tag do simulado referencia um concurso válido (FK)", async () => {
  await como(IDS.alunoA, async (c) => {
    await esperaErro(
      c, /foreign key|violates/i,
      `insert into simulados (escola_id, aluno_id, nome, data, exam_tag, acertos)
       values ($1, $2, 'tag inválida', current_date, 'inexistente', '{}'::jsonb)`,
      [ESCOLA_A, ALUNO_LUCAS]
    );
  });
});

test("isolamento mantido: coordenação A não lê simulado da escola B", async () => {
  await como(IDS.coordA, async (c) => {
    const r = await c.query("select count(*)::int as n from simulados where escola_id = $1", [ESCOLA_B]);
    assert.equal(r.rows[0].n, 0);
  });
});

test("coordenação lê o simulado por concurso do próprio aluno (para o painel)", async () => {
  await como(IDS.coordA, async (c) => {
    const r = await c.query("select count(*)::int as n from simulados where aluno_id = $1 and exam_tag = 'cn'", [ALUNO_LUCAS]);
    assert.ok(r.rows[0].n >= 1);
  });
});
