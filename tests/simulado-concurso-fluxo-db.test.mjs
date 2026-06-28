// ============================================================
// SIMULADO NO FORMATO DO CONCURSO — FLUXO ponta a ponta (15.6 ligada)
// ------------------------------------------------------------
// Prova o caminho que a tela agora roda: carregar a ESTRUTURA REAL da
// prova (prova_materias/prova_dias, como o seam carregarEstruturaProva)
// e o simulado PERSISTIDO (com exam_tag + redacao_nota), e avaliar com
// a lógica pura simuladoConcurso.js. Antes, a lógica era órfã: a pura
// rodava sobre estrutura hardcoded e o banco só guardava as colunas;
// nada cruzava o dado real com a avaliação. Aqui isso vira fluxo.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, IDS } from "./identidades.mjs";
import { avaliarSimulado } from "../app/src/modules/conteudo/simuladoConcurso.js";

test.after(async () => { await pool.end(); });

// Lê a estrutura real da prova como a tela faz (carregarEstruturaProva).
async function estruturaProva(c, examTag) {
  const m = await c.query(
    "select materia_codigo, dia_numero, num_questoes, peso, valor_questao, eh_redacao, ordem from prova_materias where exam_tag=$1 order by ordem",
    [examTag],
  );
  return m.rows;
}

test("CN: estrutura real + simulado persistido → diagnóstico no formato (nota por dia, redação, insumo)", async () => {
  await como(IDS.alunoA, async (c) => {
    const materias = await estruturaProva(c, "cn");
    assert.ok(materias.length >= 8, "estrutura do CN cadastrada (15.2)");

    const s = await c.query(
      "select acertos, redacao_nota from simulados where exam_tag='cn' and redacao_nota is not null limit 1",
    );
    assert.ok(s.rows.length, "há um simulado CN com redação persistido");
    const { acertos, redacao_nota } = s.rows[0];

    const r = avaliarSimulado({
      materias,
      acertos,
      redacaoNota: Number(redacao_nota),
      concurso: { elimination_model: "absoluto_50", redacao_role: "eliminatoria" },
    });

    // nota por DIA agregada a partir da estrutura real (CN tem 2 dias).
    const dia1 = r.porDia.find((d) => d.dia === 1);
    assert.ok(dia1, "Dia 1 existe");
    assert.equal(dia1.pontos, 75, "(mat 14 + ing 16) × 2,5 = 75 pontos no Dia 1");

    // redação no papel certo (eliminatória), com nota persistida → apta.
    assert.equal(r.redacao.papel, "eliminatoria");
    assert.equal(r.redacao.apto, true);

    // eliminação ABSOLUTA é regra oficial; insumo para nível sai por matéria.
    assert.equal(r.eliminacao.tipo, "absoluto");
    assert.equal(r.eliminacao.status, "oficial");
    assert.ok(r.insumoNivel.mat, "alimenta a classificação de nível (15.3)");
    assert.equal(typeof r.objetivo, "string");
  });
});

test("CN: acertos baixos na estrutura real disparam alerta de eliminação", async () => {
  await como(IDS.alunoA, async (c) => {
    const materias = await estruturaProva(c, "cn");
    // Química propositalmente abaixo do piso (1/6 ≈ 17% < 50%).
    const acertos = { mat: 14, ing: 16, por: 17, fis: 4, qui: 1, bio: 4, his: 4, geo: 5 };
    const r = avaliarSimulado({
      materias, acertos, redacaoNota: 80,
      concurso: { elimination_model: "absoluto_50", redacao_role: "eliminatoria" },
    });
    assert.ok(r.eliminacao.emRisco.some((x) => x.materia === "qui"), "Química abaixo de 50% entra em risco");
    assert.ok(r.alertas.length >= 1, "vira alerta para a coordenação");
    assert.ok(r.alertas.every((a) => a.tipo !== "eliminacao" || a.critico), "risco absoluto é crítico");
  });
});

test("concurso de MEDIANA: a estrutura real NÃO inventa corte — proxy marcado inferência", async () => {
  await como(IDS.alunoA, async (c) => {
    const tag = await c.query("select codigo from concursos where elimination_model='mediana' limit 1");
    assert.ok(tag.rows.length, "há ao menos um concurso de mediana cadastrado");
    const examTag = tag.rows[0].codigo;
    const materias = await estruturaProva(c, examTag);
    // metade dos acertos em todas as objetivas.
    const acertos = Object.fromEntries(
      materias.filter((m) => !m.eh_redacao).map((m) => [m.materia_codigo, Math.floor((m.num_questoes ?? 0) / 2)]),
    );
    const r = avaliarSimulado({ materias, acertos, concurso: { elimination_model: "mediana", redacao_role: null } });
    assert.equal(r.eliminacao.tipo, "relativo");
    assert.equal(r.eliminacao.status, "inferencia", "proxy de mediana é inferência, nunca regra oficial");
    assert.match(r.eliminacao.aviso, /não há corte absoluto oficial/i);
  });
});
