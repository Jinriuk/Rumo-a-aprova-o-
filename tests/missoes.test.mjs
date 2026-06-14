// ============================================================
// TRILHAS E MISSÕES (Fase 15.4) — lógica pura (sem banco)
// ------------------------------------------------------------
// Cobre: tipo de trilha pelo prazo; regra anti-furo (missão de
// outro concurso não entra); seleção por nível; ajuste da escola
// com sinalização de desvio; montagem final das missões do aluno.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import {
  TIPOS_TRILHA, tipoTrilhaPorPrazo, missaoCabeNoAlvo, missoesDoAlvo,
  missoesParaNivel, aplicarAjusteEscola, montarMissoesDoAluno, desviosDeMissao,
} from "../app/src/modules/conteudo/missoes.js";

const M = (over) => ({
  id: "m", exam_tag: "cn", materia_codigo: "mat", nivel: "intermediario",
  nome: "Missão", objetivo: "x", qtd_questoes_sugerida: 40, criterio_conclusao: "c",
  xp_sugerido: 50, ordem: 0, ...over,
});

test("tipo de trilha segue o prazo até a prova", () => {
  assert.equal(tipoTrilhaPorPrazo(400), TIPOS_TRILHA.ANUAL);
  assert.equal(tipoTrilhaPorPrazo(200), TIPOS_TRILHA.SEMESTRAL);
  assert.equal(tipoTrilhaPorPrazo(120), TIPOS_TRILHA.INTENSIVA);
  assert.equal(tipoTrilhaPorPrazo(45), TIPOS_TRILHA.RETA_FINAL);
});

test("regra anti-furo: missão só entra se for do exam_tag ATIVO do aluno", () => {
  assert.equal(missaoCabeNoAlvo(M({ exam_tag: "cn" }), "cn"), true);
  assert.equal(missaoCabeNoAlvo(M({ exam_tag: "epcar" }), "cn"), false, "missão de EPCAR não entra para alvo CN");
  assert.equal(missaoCabeNoAlvo(M({ exam_tag: "cn" }), null), false, "sem alvo, nada entra");
  const lista = [M({ id: "a", exam_tag: "cn" }), M({ id: "b", exam_tag: "eear" }), M({ id: "c", exam_tag: "cn" })];
  assert.deepEqual(missoesDoAlvo(lista, "cn").map((m) => m.id), ["a", "c"]);
});

test("missões por nível: traz o nível atual e os já alcançados, nunca o acima", () => {
  const lista = [
    M({ id: "base", nivel: "base" }),
    M({ id: "inter", nivel: "intermediario" }),
    M({ id: "avan", nivel: "avancado" }),
  ];
  assert.deepEqual(missoesParaNivel(lista, "intermediario").map((m) => m.id), ["base", "inter"]);
  assert.deepEqual(missoesParaNivel(lista, "base").map((m) => m.id), ["base"]);
});

test("na Reta Final, só missões de reta final", () => {
  const lista = [M({ id: "inter", nivel: "intermediario" }), M({ id: "rf", nivel: "reta_final" })];
  assert.deepEqual(missoesParaNivel(lista, "reta_final").map((m) => m.id), ["rf"]);
});

test("ajuste da escola: o valor da escola vence, o oficial NÃO some e o desvio é sinalizado", () => {
  const oficial = M({ qtd_questoes_sugerida: 40, xp_sugerido: 50 });
  const ajustada = aplicarAjusteEscola(oficial, { qtd_questoes: 60, desvio_do_edital: true });
  assert.equal(ajustada.qtd_questoes_sugerida, 60);
  assert.equal(ajustada.desvioDoEdital, true);
  assert.equal(ajustada.oficial.qtd_questoes_sugerida, 40, "a referência oficial continua visível");
});

test("ajuste da escola pode DESATIVAR a missão (some da lista)", () => {
  assert.equal(aplicarAjusteEscola(M(), { ativa: false }), null);
});

test("sem ajuste, a missão fica como oficial, sem desvio", () => {
  const r = aplicarAjusteEscola(M({ qtd_questoes_sugerida: 40 }), null);
  assert.equal(r.desvioDoEdital, false);
  assert.equal(r.ativa, true);
});

test("montarMissoesDoAluno junta alvo + nível + ajustes, ordenado", () => {
  const missoes = [
    M({ id: "cn-base", exam_tag: "cn", nivel: "base", ordem: 1 }),
    M({ id: "cn-inter", exam_tag: "cn", nivel: "intermediario", ordem: 0 }),
    M({ id: "cn-avan", exam_tag: "cn", nivel: "avancado", ordem: 2 }),
    M({ id: "eear-x", exam_tag: "eear", nivel: "base", ordem: 0 }),
  ];
  const ajustes = [{ missao_id: "cn-base", ativa: false }]; // desativa a base
  const r = montarMissoesDoAluno({ missoes, examTagAtivo: "cn", nivel: "intermediario", ajustesEscola: ajustes });
  // eear sai (anti-furo); avançado sai (acima do nível); base foi desativada → sobra só inter
  assert.deepEqual(r.map((m) => m.id), ["cn-inter"]);
});

test("desviosDeMissao lista só as missões com ajuste divergente", () => {
  const missoes = [M({ id: "a", nome: "A" }), M({ id: "b", nome: "B" })];
  const ajustes = [{ missao_id: "a", desvio_do_edital: true }, { missao_id: "b", desvio_do_edital: false }];
  assert.deepEqual(desviosDeMissao(missoes, ajustes), [{ missao_id: "a", nome: "A" }]);
});
