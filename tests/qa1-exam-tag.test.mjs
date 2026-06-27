// ============================================================
// QA1.1 — REGRESSÃO: aluno NUNCA vê missão de outro concurso
// ------------------------------------------------------------
// Guarda pedagógica do bug "EsPCEx vendo Colégio Naval": a montagem
// de missões do aluno é por exam_tag ATIVO; missão de outro edital
// não entra, e sem missão do alvo a lista fica VAZIA (a UI mostra
// "em configuração", nunca conteúdo de outro concurso). Lógica pura.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import {
  missaoCabeNoAlvo, missoesDoAlvo, montarMissoesDoAluno,
} from "../app/src/modules/conteudo/missoes.js";

// catálogo misto, como o banco devolveria se todas as missões viessem juntas
const CATALOGO = [
  { id: "cn-1",     exam_tag: "cn",     nivel: "base",          nome: "CN — Frações",      ordem: 0 },
  { id: "cn-2",     exam_tag: "cn",     nivel: "intermediario", nome: "CN — Geometria",    ordem: 1 },
  { id: "espcex-1", exam_tag: "espcex", nivel: "base",          nome: "EsPCEx — Funções",  ordem: 0 },
  { id: "espcex-2", exam_tag: "espcex", nivel: "intermediario", nome: "EsPCEx — Trigon.",  ordem: 1 },
  { id: "epcar-1",  exam_tag: "epcar",  nivel: "base",          nome: "EPCAR — Cinemát.",  ordem: 0 },
  { id: "eear-1",   exam_tag: "eear",   nivel: "base",          nome: "EEAr — Física",     ordem: 0 },
  { id: "esa-1",    exam_tag: "esa",    nivel: "base",          nome: "EsSA — Matemática", ordem: 0 },
];

test("QA1.1: aluno EsPCEx NÃO recebe nenhuma missão de Colégio Naval (cn)", () => {
  const minhas = montarMissoesDoAluno({ missoes: CATALOGO, examTagAtivo: "espcex" });
  assert.ok(minhas.length > 0, "EsPCEx deve ter as próprias missões");
  assert.ok(minhas.every((m) => m.exam_tag === "espcex"), "só missões de espcex");
  assert.ok(!minhas.some((m) => m.exam_tag === "cn"), "nenhuma missão de CN vaza para EsPCEx");
});

test("QA1.1: cada concurso só enxerga o próprio edital (sem fallback p/ CN)", () => {
  for (const tag of ["cn", "espcex", "epcar", "eear", "esa"]) {
    const minhas = montarMissoesDoAluno({ missoes: CATALOGO, examTagAtivo: tag });
    assert.ok(minhas.length > 0, `${tag} tem missão`);
    assert.ok(minhas.every((m) => m.exam_tag === tag), `${tag} não vê outro concurso`);
  }
});

test("QA1.1: concurso sem missão cadastrada → lista VAZIA (UI mostra 'em configuração')", () => {
  // simula um concurso cujo edital ainda não tem missões: nada de CN como
  // 'fallback genérico' — a montagem devolve vazio e a tela neutraliza.
  const semConteudo = montarMissoesDoAluno({ missoes: CATALOGO, examTagAtivo: "afa" });
  assert.deepEqual(semConteudo, [], "nenhuma missão (e jamais conteúdo de CN)");
});

test("QA1.1: sem exam_tag ativo, nada entra (não inventa concurso)", () => {
  assert.equal(missaoCabeNoAlvo({ exam_tag: "cn" }, null), false);
  assert.deepEqual(missoesDoAlvo(CATALOGO, undefined), []);
});
