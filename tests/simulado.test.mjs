// ============================================================
// SIMULADO POR CONCURSO (Fase 15.6) — lógica pura (sem banco)
// ------------------------------------------------------------
// Avalia simulados contra a estrutura real de cada concurso:
// validação de máximos, nota por matéria/dia (peso/valor), redação
// no papel certo, modelo de eliminação (absoluto × mediana sem corte
// inventado), objetivo, comparação com meta e insumo para nível.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import {
  validarAcertos, notaPorMateria, notaPorDia, avaliarRedacao,
  avaliarEliminacao, objetivoSugerido, compararComMeta, insumoParaNivel,
  alertasDeRisco, avaliarSimulado, PROXY_MEDIANA_PCT,
} from "../app/src/modules/conteudo/simuladoConcurso.js";
import { classificarPorDesempenho } from "../app/src/modules/conteudo/niveisAluno.js";
import { STATUS_DADO } from "../app/src/modules/conteudo/pedagogia.js";

// estrutura do CN (parcial, Dia 1 com valor 2,5/q + redação)
const CN = [
  { materia_codigo: "mat", dia_numero: 1, num_questoes: 20, valor_questao: 2.5, eh_redacao: false, ordem: 0 },
  { materia_codigo: "ing", dia_numero: 1, num_questoes: 20, valor_questao: 2.5, eh_redacao: false, ordem: 1 },
  { materia_codigo: "fis", dia_numero: 2, num_questoes: 6, valor_questao: 2.0, eh_redacao: false, ordem: 3 },
  { materia_codigo: "red", dia_numero: 2, eh_redacao: true, ordem: 8 },
];
// EsPCEx (peso por matéria + redação classificatória)
const ESPCEX = [
  { materia_codigo: "mat", dia_numero: 2, num_questoes: 20, peso: 2.0, eh_redacao: false, ordem: 4 },
  { materia_codigo: "ing", dia_numero: 2, num_questoes: 12, peso: 1.5, eh_redacao: false, ordem: 5 },
  { materia_codigo: "red", dia_numero: 1, peso: 1.0, eh_redacao: true, ordem: 1 },
];

test("validação de máximos: acerto acima do total da matéria é capado e reportado", () => {
  const r = validarAcertos(CN, { mat: 25, ing: 18, fis: 4 });
  assert.equal(r.valido, false);
  assert.deepEqual(r.violacoes, [{ materia: "mat", informado: 25, max: 20 }]);
  assert.equal(r.capados.mat, 20, "capa no máximo");
  assert.equal(r.capados.ing, 18);
});

test("nota por matéria usa valor por questão quando o edital dá (CN 2,5/q)", () => {
  const linhas = notaPorMateria(CN, { mat: 20, ing: 10, fis: 6 });
  const mat = linhas.find((l) => l.materia === "mat");
  assert.equal(mat.pontos, 50, "20 × 2,5 = 50");
  assert.equal(mat.pct, 100);
});

test("nota por dia agrega por bloco", () => {
  const dias = notaPorDia(CN, { mat: 20, ing: 20, fis: 6 });
  const d1 = dias.find((d) => d.dia === 1);
  assert.equal(d1.pontos, 100, "(20+20)×2,5 = 100");
});

test("redação: papel ausente é apto e não classifica; eliminatória+classificatória soma", () => {
  assert.deepEqual(avaliarRedacao("ausente", null), { papel: "ausente", presente: false, apto: true, pontosClassificatorios: 0 });
  const r = avaliarRedacao("eliminatoria_classificatoria", 70, { minimo: 50 });
  assert.equal(r.apto, true);
  assert.equal(r.pontosClassificatorios, 70, "classificatória soma a nota");
  const inapta = avaliarRedacao("eliminatoria", 40, { minimo: 50 });
  assert.equal(inapta.apto, false);
});

test("eliminação ABSOLUTA (CN 50%): lista matérias abaixo do piso, status oficial", () => {
  const linhas = notaPorMateria(CN, { mat: 14, ing: 16, fis: 2 }); // fis 2/6 = 33%
  const e = avaliarEliminacao("absoluto_50", linhas);
  assert.equal(e.tipo, "absoluto");
  assert.equal(e.status, STATUS_DADO.OFICIAL);
  assert.ok(e.emRisco.some((r) => r.materia === "fis"), "Física abaixo de 50% entra em risco");
});

test("eliminação por MEDIANA: NÃO inventa corte — tipo relativo, proxy marcado inferência", () => {
  const linhas = notaPorMateria(ESPCEX, { mat: 10, ing: 6 }); // 50%
  const e = avaliarEliminacao("mediana", linhas);
  assert.equal(e.tipo, "relativo");
  assert.equal(e.status, STATUS_DADO.INFERENCIA, "proxy é inferência, não regra oficial");
  assert.equal(e.proxyPct, PROXY_MEDIANA_PCT);
  assert.match(e.aviso, /não há corte absoluto oficial/i);
});

test("objetivo sugerido aponta a matéria mais fraca (fraseado muda no relativo)", () => {
  const linhas = notaPorMateria(CN, { mat: 8, ing: 18, fis: 5 }); // mat 40%
  assert.match(objetivoSugerido(linhas, "absoluto_50"), /MAT.*≥70%/);
  assert.match(objetivoSugerido(linhas, "mediana"), /acima do campo/i);
});

test("comparação com meta", () => {
  const linhas = notaPorMateria(CN, { mat: 20, ing: 20, fis: 6 }); // 46/46 = 100%
  const r = compararComMeta(linhas, 80);
  assert.equal(r.geralPct, 100);
  assert.equal(r.atingiu, true);
  assert.equal(r.diferenca, 20);
});

test("insumo para nível: simulado → {acertoPct, questoes} que o nível consome", () => {
  const linhas = notaPorMateria(CN, { mat: 6, ing: 18, fis: 5 }); // mat 30%
  const insumo = insumoParaNivel(linhas);
  assert.deepEqual(insumo.mat, { acertoPct: 30, questoes: 20 });
  // alimenta a classificação de nível da 15.3
  assert.equal(classificarPorDesempenho(insumo.mat).nivel, "base", "30% em 20 questões → Base");
});

test("avaliarSimulado junta tudo (CN com redação eliminatória)", () => {
  const r = avaliarSimulado({
    materias: CN,
    acertos: { mat: 14, ing: 16, fis: 2 },
    redacaoNota: 60,
    concurso: { elimination_model: "absoluto_50", redacao_role: "eliminatoria" },
    metaPct: 70,
    redacaoMinimo: 50,
  });
  assert.equal(r.redacao.papel, "eliminatoria");
  assert.equal(r.redacao.apto, true);
  assert.ok(r.eliminacao.emRisco.some((x) => x.materia === "fis"));
  assert.ok(Array.isArray(r.alertas) && r.alertas.length >= 1);
  assert.ok(r.insumoNivel.mat);
});

test("alertas de risco combinam eliminação e redação inapta", () => {
  const alertas = alertasDeRisco({
    eliminacao: { tipo: "absoluto", emRisco: [{ materia: "fis", pct: 30 }] },
    redacao: { presente: true, apto: false },
  });
  assert.equal(alertas.length, 2);
  assert.ok(alertas.every((a) => a.critico));
});
