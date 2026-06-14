// ============================================================
// FUNDAÇÃO PEDAGÓGICA (Fase 15.1) — estrutura e RLS no banco
// ------------------------------------------------------------
// Prova que a camada de config nasce isolada e fiel ao doc:
//   • a config oficial 1:1 dos concursos bate com o edital;
//   • turmas comerciais agrupam os concursos certos;
//   • config_oficial e turmas_comerciais são globais (leitura por
//     qualquer escola);
//   • config_escola é ISOLADA: A não lê nem escreve a de B, e só a
//     coordenação escreve a da própria escola;
//   • o status do dado (oficial/inferência/validar) é preservado.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, esperaErro, IDS, ESCOLA_A, ESCOLA_B } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

// ---------- config oficial 1:1 fiel ao edital (doc §3–§6) ----------
test("modelo de eliminação e papel da redação batem com o doc, por concurso", async () => {
  await como(IDS.coordA, async (c) => {
    const r = await c.query(
      "select codigo, elimination_model, redacao_role, usa_especialidade, usa_ciclo from concursos where codigo = any($1) order by codigo",
      [["cn", "epcar", "espcex", "esa", "eear"]]
    );
    const m = Object.fromEntries(r.rows.map((x) => [x.codigo, x]));
    assert.equal(m.cn.elimination_model, "absoluto_50");
    assert.equal(m.cn.redacao_role, "eliminatoria");
    assert.equal(m.epcar.elimination_model, "absoluto_5");
    assert.equal(m.epcar.redacao_role, "eliminatoria_classificatoria");
    assert.equal(m.espcex.elimination_model, "mediana");
    assert.equal(m.espcex.redacao_role, "eliminatoria_classificatoria");
    assert.equal(m.esa.elimination_model, "mediana");
    assert.equal(m.esa.redacao_role, "eliminatoria");
    assert.equal(m.eear.elimination_model, "absoluto_5");
    assert.equal(m.eear.redacao_role, "ausente");
    assert.equal(m.eear.usa_especialidade, true, "EEAR usa especialidade");
    assert.equal(m.eear.usa_ciclo, true, "EEAR tem dois ciclos por ano");
  });
});

test("exam_tag é gerado a partir de codigo (vocabulário do doc, sem duplicar dado)", async () => {
  await como(IDS.coordA, async (c) => {
    const r = await c.query("select count(*)::int as n from concursos where exam_tag is distinct from codigo");
    assert.equal(r.rows[0].n, 0);
  });
});

// ---------- turmas comerciais ----------
test("turmas comerciais agrupam os concursos certos (turma não vira regra pedagógica)", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query(
      "select turma_comercial_codigo, array_agg(exam_tag order by ordem) as tags from turmas_comerciais_concursos group by turma_comercial_codigo"
    );
    const m = Object.fromEntries(r.rows.map((x) => [x.turma_comercial_codigo, x.tags]));
    assert.deepEqual(m["cn-epcar"], ["cn", "epcar"]);
    assert.deepEqual(m["esa-eear"], ["esa", "eear"]);
    assert.deepEqual(m["espcex"], ["espcex"]);
  });
});

// ---------- status do dado preservado ----------
test("o status do dado (oficial/inferência/validar) está representado na config oficial", async () => {
  await como(IDS.coordA, async (c) => {
    const r = await c.query("select distinct status_dado from config_oficial order by status_dado");
    assert.deepEqual(r.rows.map((x) => x.status_dado), ["inferencia", "oficial", "validar"]);
    // a recorrência por assunto ainda não foi medida → tem que estar como 'validar'
    const rec = await c.query("select status_dado from config_oficial where chave = 'recorrencia_status' limit 1");
    assert.equal(rec.rows[0].status_dado, "validar");
  });
});

// ---------- conteúdo global é legível por todas as escolas ----------
test("config oficial e turmas comerciais são globais: a escola B as enxerga igual", async () => {
  await como(IDS.coordB, async (c) => {
    const oficial = await c.query("select count(*)::int as n from config_oficial");
    assert.ok(oficial.rows[0].n >= 10, "config oficial é conteúdo global, visível para a escola B");
    const tc = await c.query("select count(*)::int as n from turmas_comerciais");
    assert.equal(tc.rows[0].n, 3);
  });
});

// ---------- config_escola: ISOLADA por escola ----------
test("config_escola: a escola A não lê o override da escola B (e vice-versa)", async () => {
  await como(IDS.coordA, async (c) => {
    const r = await c.query("select count(*)::int as n from config_escola where escola_id = $1", [ESCOLA_B]);
    assert.equal(r.rows[0].n, 0);
  });
  // o override de demo vive na escola A (Vitrine): a B não o vê
  await como(IDS.coordB, async (c) => {
    const r = await c.query("select count(*)::int as n from config_escola");
    assert.equal(r.rows[0].n, 0, "a escola B não tem override e não enxerga o da A");
  });
});

test("config_escola: a coordenação A escreve um override na PRÓPRIA escola, com flag de desvio", async () => {
  await como(IDS.coordA, async (c) => {
    await c.query(
      `insert into config_escola (escola_id, exam_tag, chave, valor, desvio_do_edital, ajustado_por)
       values ($1, 'cn', 'volume_semanal_por', '{"questoes": 120}'::jsonb, true, $2)`,
      [ESCOLA_A, IDS.coordA.sub]
    );
    const r = await c.query("select desvio_do_edital from config_escola where chave = 'volume_semanal_por'");
    assert.equal(r.rows[0].desvio_do_edital, true);
  });
});

test("config_escola: a coordenação A NÃO escreve override para a escola B (tenant forjado é recusado)", async () => {
  await como(IDS.coordA, async (c) => {
    await esperaErro(
      c, /row-level security/i,
      `insert into config_escola (escola_id, exam_tag, chave, valor)
       values ($1, 'cn', 'forjado', '{}'::jsonb)`,
      [ESCOLA_B]
    );
  });
});

test("config_escola: aluno LÊ a config da própria escola, mas NÃO escreve (só coordenação)", async () => {
  await como(IDS.alunoA, async (c) => {
    const leu = await c.query("select count(*)::int as n from config_escola where escola_id = $1", [ESCOLA_A]);
    assert.ok(leu.rows[0].n >= 1, "o aluno precisa ler a config que vale para ele");
    await esperaErro(
      c, /row-level security/i,
      `insert into config_escola (escola_id, exam_tag, chave, valor)
       values ($1, 'cn', 'aluno_nao_escreve', '{}'::jsonb)`,
      [ESCOLA_A]
    );
  });
});
