// ============================================================
// BLOCO 3 (23/09/2026) — NÚMEROS DO PAINEL (D04, D05, D06, D15)
// ------------------------------------------------------------
// Os dados abaixo são a semana 4 do Instituto Meridiano, a das
// capturas de 19/09 (já sem o Enzo, D07): questões e acertos dos 7 dias
// e totais do ciclo de cada aluno.
//
// D04  "Acerto médio 60%" era a média simples do acerto ACUMULADO de
//      cada aluno, sem período, entre dois cards de 7 dias. Agora é
//      "Acerto (7 dias)" ponderado — aprovado em 23/09. Semana 4: 69%.
// D05  O pódio do painel ("Melhor acerto (7d)") punha o Gustavo (18
//      questões) em 3º; o Ranking, com o mesmo critério e janela, punha
//      o Rafael (69%, 59 questões). Agora é uma função só.
// D06  "Destaques da semana" mostrava o total do CICLO (Helena 378) num
//      bloco semanal; agora mostra as questões dos 7 dias (79).
// D15  "Acerto geral" é o acerto do CICLO (calcularMetricas soma todos
//      os registros) — o rótulo passa a dizer isso.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { adaptarResumoEscola, acertoPonderadoSemana } from "../app/src/shared/metricas/agregados.js";
import { podioDaSemana, classificarEstudo, linhaDeEstudo } from "../app/src/modules/desempenho/ranking.js";
import { calcularMetricas } from "../app/src/modules/desempenho/metricas.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => readFileSync(resolve(root, p), "utf8");

// [nome, q7, a7, min7, dias7, qCiclo, aCiclo]
const SEMANA4 = [
  ["Helena Vasconcelos", 79, 62, 243, 4, 378, 294],
  ["Camila Restrepo", 58, 42, 139, 3, 288, 205],
  ["Rafael Munhoz", 59, 41, 183, 3, 304, 198],
  ["Beatriz Okamoto", 29, 18, 58, 2, 144, 84],
  ["Thiago Albuquerque", 33, 14, 66, 2, 198, 95],
  ["Gustavo Peçanha", 18, 13, 36, 1, 222, 139],
  ["Larissa Fontoura", 0, 0, 0, 0, 117, 65],
];

function resumoDaSemana4(ordem = SEMANA4) {
  const alunosPorId = {};
  const linhas = ordem.map(([nome, q7, a7, min7, d7, q, a], i) => {
    const id = `a${SEMANA4.findIndex((x) => x[0] === nome)}`;
    alunosPorId[id] = { id, nome, trilha_id: "t", usuario_id: "u" + i };
    return {
      aluno_id: id,
      questoes_total: q, ca_questoes_total: q, acertos_total: a, minutos_total: q * 3, dias_total: 10,
      questoes_7d: q7, ca_questoes_7d: q7, acertos_7d: a7, minutos_7d: min7, dias_7d: d7,
      meta_feitas: 0, meta_consideradas: 7,
    };
  });
  return adaptarResumoEscola(linhas, alunosPorId);
}

// ── D04 ────────────────────────────────────────────────────────────
test("D04: 'Acerto (7 dias)' é ponderado pelas questões — semana 4 dá 69%", () => {
  // 190 acertos ÷ 276 questões = 68,8%
  assert.equal(acertoPonderadoSemana(resumoDaSemana4()), 69);
});

test("D04: ponderado não é média de médias", () => {
  const r = adaptarResumoEscola([
    { aluno_id: "x", questoes_7d: 100, ca_questoes_7d: 100, acertos_7d: 90 },
    { aluno_id: "y", questoes_7d: 10, ca_questoes_7d: 10, acertos_7d: 1 },
  ], { x: { id: "x", nome: "X" }, y: { id: "y", nome: "Y" } });
  // média simples seria (90 + 10) / 2 = 50; ponderado: 91 / 110 = 83
  assert.equal(acertoPonderadoSemana(r), 83);
});

test("D04: sem acerto lançado na janela, o card mostra traço (null), não 0%", () => {
  const r = adaptarResumoEscola([{ aluno_id: "x", questoes_7d: 12, ca_questoes_7d: 0, acertos_7d: 0 }],
    { x: { id: "x", nome: "X" } });
  assert.equal(acertoPonderadoSemana(r), null);
  assert.equal(acertoPonderadoSemana([]), null);
});

test("D04: o card diz a janela e não sobra a média antiga", () => {
  const codigo = src("app/src/modules/desempenho/PainelGestao.jsx");
  assert.match(codigo, /rotulo="Acerto \(7 dias\)" valor=\{acertoSemana/);
  assert.doesNotMatch(codigo, /Acerto médio/);
  assert.doesNotMatch(codigo, /mediaAcerto/);
});

// ── D05 ────────────────────────────────────────────────────────────
const nomes = (linhas) => linhas.map((r) => r.aluno.nome.split(" ")[0]);

test("D05: pódio de 'Melhor acerto (7d)' é Helena, Camila, Rafael — o Gustavo (18 q) fica fora", () => {
  assert.deepEqual(nomes(podioDaSemana(resumoDaSemana4(), "acerto")), ["Helena", "Camila", "Rafael"]);
});

test("D05: o Ranking (7 dias) e o pódio do painel dão exatamente os mesmos 3", () => {
  const resumo = resumoDaSemana4();
  const porId = Object.fromEntries(resumo.map((x) => [x.aluno.id, x]));
  for (const criterio of ["acerto", "questoes", "tempo", "dias"]) {
    const ranking = classificarEstudo(resumo.map((x) => linhaDeEstudo(x.aluno, porId[x.aluno.id], "semana")), criterio);
    assert.deepEqual(nomes(podioDaSemana(resumo, criterio)), nomes(ranking.comparaveis.slice(0, 3)), criterio);
  }
});

test("D05: a ordem de entrada não muda o pódio (desempate total, até o nome)", () => {
  const invertido = resumoDaSemana4([...SEMANA4].reverse());
  for (const criterio of ["acerto", "questoes", "tempo", "dias"]) {
    assert.deepEqual(nomes(podioDaSemana(invertido, criterio)), nomes(podioDaSemana(resumoDaSemana4(), criterio)), criterio);
  }
});

test("D05: quem não passa do piso vai para 'sem dados suficientes', por nome", () => {
  const resumo = resumoDaSemana4();
  const r = classificarEstudo(resumo.map((x) => linhaDeEstudo(x.aluno, x, "semana")), "acerto");
  assert.deepEqual(nomes(r.semDadosSuficientes), ["Gustavo", "Larissa"]);
});

// ── D06 ────────────────────────────────────────────────────────────
test("D06: os destaques mostram as questões dos 7 dias, não o total do ciclo", () => {
  const [helena] = podioDaSemana(resumoDaSemana4(), "acerto");
  assert.equal(helena.q, 79, "semana 4 da Helena; o ciclo seria 378");
  const codigo = src("app/src/modules/desempenho/PainelGestao.jsx");
  assert.match(codigo, /\{r\.q\} questões em 7 dias/);
});

// ── D15 ────────────────────────────────────────────────────────────
test("D15: o 'acerto' da ficha e do responsável é o do ciclo inteiro, não o da semana", () => {
  const semanas = [
    { numero: 1, inicio: "2026-09-07", fim: "2026-09-13" },
    { numero: 2, inicio: "2026-09-14", fim: "2026-09-20" },
  ];
  const registros = [
    { data: "2026-09-08", disciplina_codigo: "mat", questoes: 100, acertos: 50, minutos: 60 },
    { data: "2026-09-15", disciplina_codigo: "mat", questoes: 100, acertos: 90, minutos: 60 },
  ];
  const m = calcularMetricas({ registros, simulados: [], semanas, semanaAtiva: semanas[1], disciplinas: [], metaQuestoes: 250 });
  assert.equal(m.acerto, 70, "ciclo: 140/200; a semana daria 90%");
});

test("D15: ficha, responsável, Hoje e frase-resumo dizem 'no ciclo'", () => {
  const resp = src("app/src/modules/desempenho/ResumoResponsavel.jsx");
  assert.match(resp, /% de acerto no ciclo`/, "frase-resumo");
  assert.match(resp, /rotulo="Acerto no ciclo"/);
  assert.match(src("app/src/modules/desempenho/Insights.jsx"), /rotulo="Acerto no ciclo"/);
  assert.match(src("app/src/modules/motor/MetaHero.jsx"), /sub="acerto no ciclo"/);
  for (const p of ["app/src/modules/desempenho/ResumoResponsavel.jsx", "app/src/modules/desempenho/Insights.jsx",
                   "app/src/modules/motor/MetaHero.jsx", "app/src/modules/motor/Conquistas.jsx"]) {
    assert.doesNotMatch(src(p), /acerto geral/i, `${p} ainda diz "acerto geral"`);
  }
});
