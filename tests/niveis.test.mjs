// ============================================================
// NÍVEIS DE ALUNO (Fase 15.3) — lógica pura (sem banco)
// ------------------------------------------------------------
// Cobre os casos pedidos: sem dados → validar; baixo acerto → base;
// bom acerto mas pouco volume → NÃO avançado; alto volume + bom acerto
// → avançado; perto da prova → reta final; nível por matéria diferente
// do geral. Mais o resumo de pontos fortes/atenção.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import {
  NIVEIS, ORIGEM, CONFIANCA, LIMIAR,
  classificarPorDesempenho, calcularNivelMateria, estaEmRetaFinal,
  calcularNivelGeral, sugerirNivelInicial, resumirDiagnosticoAluno,
} from "../app/src/modules/conteudo/niveisAluno.js";

test("sem dados suficientes → nível nulo e origem 'validar' (não inventa)", () => {
  assert.deepEqual(classificarPorDesempenho({}), { nivel: null, origem: ORIGEM.VALIDAR });
  assert.deepEqual(classificarPorDesempenho({ acertoPct: 80, questoes: 5 }), { nivel: null, origem: ORIGEM.VALIDAR });
  assert.deepEqual(sugerirNivelInicial({}), { nivel: NIVEIS.BASE, origem: ORIGEM.VALIDAR });
});

test("baixo acerto → Base", () => {
  assert.equal(classificarPorDesempenho({ acertoPct: 30, questoes: 50 }).nivel, NIVEIS.BASE);
  assert.equal(classificarPorDesempenho({ acertoPct: 30, questoes: 50 }).origem, ORIGEM.CALCULADO);
});

test("bom acerto mas POUCO volume → Intermediário (não pula pra Avançado)", () => {
  const r = classificarPorDesempenho({ acertoPct: 85, questoes: 40 });
  assert.equal(r.nivel, NIVEIS.INTERMEDIARIO);
});

test("alto volume E bom acerto → Avançado", () => {
  const r = classificarPorDesempenho({ acertoPct: 78, questoes: 140 });
  assert.equal(r.nivel, NIVEIS.AVANCADO);
  assert.equal(r.origem, ORIGEM.CALCULADO);
});

test("perto da prova → estado Reta Final (sobrepõe a habilidade)", () => {
  assert.equal(estaEmRetaFinal(45), true);
  assert.equal(estaEmRetaFinal(120), false);
  assert.equal(estaEmRetaFinal(-3), false, "prova já passou não é reta final");
  // o nível inicial perto da prova vira reta final mesmo com bom desempenho
  assert.equal(sugerirNivelInicial({ diagnostico: { acertoPct: 80, questoes: 200 }, diasParaProva: 30 }).nivel, NIVEIS.RETA_FINAL);
  // e o geral também
  assert.equal(calcularNivelGeral({ mat: "avancado" }, { diasParaProva: 20 }).nivel, NIVEIS.RETA_FINAL);
});

test("nível por matéria pode diferir do nível geral (agregado)", () => {
  const porMateria = {
    mat: calcularNivelMateria({ acertoPct: 30, questoes: 60 }),   // base
    por: calcularNivelMateria({ acertoPct: 80, questoes: 150 }),  // avancado
    fis: calcularNivelMateria({ acertoPct: 55, questoes: 60 }),   // intermediario
  };
  assert.equal(porMateria.mat.nivel, NIVEIS.BASE);
  assert.equal(porMateria.por.nivel, NIVEIS.AVANCADO);
  const geral = calcularNivelGeral(porMateria, {});
  assert.equal(geral.nivel, NIVEIS.INTERMEDIARIO, "agregado fica no meio, diferente de Mat (Base) e Port (Avançado)");
  assert.equal(geral.origem, ORIGEM.CALCULADO);
});

test("geral com matéria sem dado → agregado parcial marcado 'validar'", () => {
  const porMateria = {
    mat: { nivel: "base", origem: "calculado" },
    por: { nivel: null, origem: "validar" }, // sem dado
  };
  const geral = calcularNivelGeral(porMateria, {});
  assert.equal(geral.origem, ORIGEM.VALIDAR);
});

test("QA1.5: volume moderado (20–50q) → estimativa PARCIAL; robusto (50+) → ALTA", () => {
  // 30 questões: classifica, mas como estimativa em formação (parcial)
  const moderado = classificarPorDesempenho({ acertoPct: 76, questoes: 30 });
  assert.equal(moderado.nivel, NIVEIS.INTERMEDIARIO);
  assert.equal(moderado.confianca, CONFIANCA.PARCIAL, "pouco volume não vira diagnóstico absoluto");
  // 60 questões: base firme
  const robusto = classificarPorDesempenho({ acertoPct: 54, questoes: 60 });
  assert.equal(robusto.nivel, NIVEIS.INTERMEDIARIO);
  assert.equal(robusto.confianca, CONFIANCA.ALTA);
  // Avançado (100+) é sempre confiança ALTA
  const avancado = classificarPorDesempenho({ acertoPct: 75, questoes: 140 });
  assert.equal(avancado.nivel, NIVEIS.AVANCADO);
  assert.equal(avancado.confianca, CONFIANCA.ALTA);
  // o limiar de robustez é coerente
  assert.equal(LIMIAR.VOLUME_ROBUSTO, 50);
});

test("QA1.5: abaixo do volume mínimo segue 'validar' SEM campo de confiança", () => {
  // contrato preservado: o caso sem evidência continua {nivel:null, origem}
  assert.deepEqual(classificarPorDesempenho({ acertoPct: 90, questoes: 10 }),
    { nivel: null, origem: ORIGEM.VALIDAR });
});

test("resumo lista pontos fortes (Avançado) e de atenção (Base)", () => {
  const r = resumirDiagnosticoAluno({ mat: "base", por: "avancado", fis: "intermediario", his: "base" });
  assert.deepEqual(r.pontosFortes, ["por"]);
  assert.deepEqual(r.pontosAtencao, ["mat", "his"]);
});
