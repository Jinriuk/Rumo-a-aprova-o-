// ============================================================
// MOTOR DE PROGRESSO (Fase C0) — LÓGICA PURA
// ------------------------------------------------------------
// XP total deriva do LEDGER (soma de xp_delta válido) e a patente
// deriva desse total. Sem banco: a mesma conta que o front faz.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { xpTotal, patente, PATENTES } from "../app/src/modules/motor/jargao.js";

test("xpTotal soma apenas xp_delta de eventos válidos", () => {
  const eventos = [
    { xp_delta: 100, status: "valido" },
    { xp_delta: 50, status: "valido" },
    { xp_delta: 0, status: "valido" },           // registro de estudo não pontua
    { xp_delta: 999, status: "estornado" },        // estornado não conta
  ];
  assert.equal(xpTotal(eventos), 150);
});

test("xpTotal é robusto a lista vazia/indefinida e xp_delta ausente", () => {
  assert.equal(xpTotal(), 0);
  assert.equal(xpTotal([]), 0);
  assert.equal(xpTotal([{ status: "valido" }]), 0);
});

test("patente deriva do XP persistido (recruta no zero, sobe por faixa)", () => {
  assert.equal(patente(xpTotal([])).nome, "Recruta");
  assert.equal(patente(0).nome, "Recruta");
  // 300 é exatamente o limiar de Soldado
  assert.equal(patente(300).nome, "Soldado");
  assert.equal(patente(299).nome, "Recruta");
});

test("patente no topo não estoura (Coronel sem próxima faixa)", () => {
  const topo = PATENTES[PATENTES.length - 1];
  const p = patente(topo.xp + 5000);
  assert.equal(p.nome, topo.nome);
  assert.equal(p.proxXp, null);
  assert.equal(p.pctProx, 100);
});

test("a patente é monotônica: mais XP nunca rebaixa o nível", () => {
  let nivelAnterior = 0;
  for (const limiar of PATENTES.map((p) => p.xp)) {
    const n = patente(limiar).nivel;
    assert.ok(n >= nivelAnterior, "nível não cai quando XP sobe");
    nivelAnterior = n;
  }
});

test("XP de simulado (50) move o aluno do zero de forma persistível", () => {
  // dois simulados finalizados = 2 eventos de 50 no ledger
  const eventos = [
    { xp_delta: 50, status: "valido", tipo_evento: "simulado_finalizado" },
    { xp_delta: 50, status: "valido", tipo_evento: "simulado_finalizado" },
  ];
  assert.equal(xpTotal(eventos), 100);
  assert.equal(patente(xpTotal(eventos)).nome, "Recruta"); // ainda abaixo de 300
});
