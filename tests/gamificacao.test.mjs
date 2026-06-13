// ============================================================
// GAMIFICAÇÃO (Fase 15.5) — lógica pura (sem banco)
// ------------------------------------------------------------
// XP por missão com antigaming (acurácia obrigatória), total e
// patente por XP, avaliação de conquistas por tipo (sempre por
// acurácia/nota/constância), e separação desbloqueada × bloqueada.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import {
  xpDeMissao, totalXp, patenteParaXp,
  avaliarConquista, conquistasGanhas, separarConquistas, BONUS,
} from "../app/src/modules/conteudo/gamificacao.js";

test("XP de missão exige acurácia (antigaming): sem domínio, XP é zero", () => {
  assert.equal(xpDeMissao({ xpBase: 100, peso: 2, nivel: "avancado", acuracia: 60, limiarAcuracia: 80 }), 0);
  assert.ok(xpDeMissao({ xpBase: 100, peso: 2, nivel: "avancado", acuracia: 85, limiarAcuracia: 80 }) > 0);
});

test("XP de missão escala por peso e dificuldade", () => {
  const base = xpDeMissao({ xpBase: 100, peso: 1, nivel: "base", acuracia: 90, limiarAcuracia: 70 });
  const peso2 = xpDeMissao({ xpBase: 100, peso: 2, nivel: "base", acuracia: 90, limiarAcuracia: 70 });
  const avan = xpDeMissao({ xpBase: 100, peso: 1, nivel: "avancado", acuracia: 90, limiarAcuracia: 70 });
  assert.equal(base, 100);
  assert.ok(peso2 > base, "peso 2 vale mais que peso 1");
  assert.ok(avan > base, "avançado vale mais que base");
});

test("total de XP soma o ledger, opcionalmente por exam_tag", () => {
  const eventos = [
    { exam_tag: "cn", pontos: 100 }, { exam_tag: "cn", pontos: 50 }, { exam_tag: "epcar", pontos: 999 },
  ];
  assert.equal(totalXp(eventos), 1149);
  assert.equal(totalXp(eventos, "cn"), 150, "XP travado no alvo (não soma outro exame)");
});

test("patente por XP: atual, próxima, progresso e quanto falta", () => {
  const patentes = [
    { codigo: "recruta", xp_necessario: 0 },
    { codigo: "soldado", xp_necessario: 300 },
    { codigo: "cabo", xp_necessario: 800 },
  ];
  const r = patenteParaXp(500, patentes);
  assert.equal(r.atual.codigo, "soldado");
  assert.equal(r.proxima.codigo, "cabo");
  assert.equal(r.faltam, 300);
  assert.ok(r.progresso > 0 && r.progresso < 1);
  // topo da escala
  const topo = patenteParaXp(2000, patentes);
  assert.equal(topo.atual.codigo, "cabo");
  assert.equal(topo.proxima, null);
  assert.equal(topo.progresso, 1);
});

test("conquista de constância: precisa do streak", () => {
  const c = { tipo: "constancia", criterio: { dias: 7 } };
  assert.equal(avaliarConquista(c, { streakDias: 7 }), true);
  assert.equal(avaliarConquista(c, { streakDias: 5 }), false);
});

test("conquista de volume NÃO conta sem acurácia (antigaming)", () => {
  const c = { tipo: "volume", criterio: { questoes: 600, acuracia_min: 70 } };
  assert.equal(avaliarConquista(c, { questoesNoMes: 800, acuraciaMes: 65 }), false, "volume alto + acerto baixo não vale");
  assert.equal(avaliarConquista(c, { questoesNoMes: 800, acuraciaMes: 75 }), true);
});

test("conquista de matéria/alavancagem: acurácia na matéria certa", () => {
  const ing = { tipo: "alavancagem", criterio: { materia: "ing", acuracia_min: 80 } };
  assert.equal(avaliarConquista(ing, { acuraciaPorMateria: { ing: 85 } }), true);
  assert.equal(avaliarConquista(ing, { acuraciaPorMateria: { ing: 70 } }), false);
  assert.equal(avaliarConquista(ing, { acuraciaPorMateria: { mat: 90 } }), false, "matéria errada não conta");
});

test("conquistas de corte/recuperação/reta final dependem do estado", () => {
  assert.equal(avaliarConquista({ tipo: "corte", criterio: {} }, { pisoEmTodasUltimoSimulado: true }), true);
  assert.equal(avaliarConquista({ tipo: "recuperacao", criterio: {} }, { recuperouPiso: true }), true);
  assert.equal(avaliarConquista({ tipo: "reta_final", criterio: {} }, { retaFinalAtiva: false }), false);
});

test("conquistasGanhas filtra o catálogo pelo estado do aluno", () => {
  const cat = [
    { id: "a", tipo: "constancia", criterio: { dias: 7 } },
    { id: "b", tipo: "simulado", criterio: { simulados: 1 } },
  ];
  const ganhas = conquistasGanhas(cat, { streakDias: 10, simuladosCompletos: 0 });
  assert.deepEqual(ganhas.map((c) => c.id), ["a"]);
});

test("separarConquistas: acesas × cinzas pelos ids do aluno", () => {
  const cat = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const { desbloqueadas, bloqueadas } = separarConquistas(cat, ["b"]);
  assert.deepEqual(desbloqueadas.map((c) => c.id), ["b"]);
  assert.deepEqual(bloqueadas.map((c) => c.id), ["a", "c"]);
});

test("bônus fixos existem para os eventos que não são missão", () => {
  assert.ok(BONUS.semana_completa > 0 && BONUS.simulado > 0 && BONUS.melhoria_materia > 0);
});
