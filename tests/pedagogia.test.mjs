// ============================================================
// FUNDAÇÃO PEDAGÓGICA (Fase 15.1) — lógica pura (sem banco)
// ------------------------------------------------------------
// Prova o comportamento do módulo app/src/modules/conteudo/
// pedagogia.js: tradução de modelo de eliminação e papel da
// redação, resolução de exam_tag ativo, e a combinação config
// oficial × config escola com detecção de desvio do edital.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import {
  STATUS_DADO, ELIMINACAO, REDACAO,
  eliminacaoEhRelativa, examTagAtivo, concursosDaTurma, alvoPermitido,
  resolverConfig, desviosDoEdital,
} from "../app/src/modules/conteudo/pedagogia.js";

test("os modelos de eliminação do doc estão tabelados e classificados certo", () => {
  assert.equal(ELIMINACAO.absoluto_50.tipo, "absoluto");
  assert.equal(ELIMINACAO.absoluto_5.tipo, "absoluto");
  assert.equal(ELIMINACAO.mediana.tipo, "relativo");
  assert.equal(eliminacaoEhRelativa("mediana"), true);
  assert.equal(eliminacaoEhRelativa("absoluto_50"), false);
});

test("os três papéis da redação distinguem eliminar de classificar", () => {
  assert.deepEqual([REDACAO.eliminatoria.elimina, REDACAO.eliminatoria.classifica], [true, false]);
  assert.deepEqual([REDACAO.eliminatoria_classificatoria.elimina, REDACAO.eliminatoria_classificatoria.classifica], [true, true]);
  assert.deepEqual([REDACAO.ausente.elimina, REDACAO.ausente.classifica], [false, false]);
});

test("exam_tag ativo do aluno é o código do concurso de concurso_id (D2: um alvo)", () => {
  const concursosPorId = { "uuid-cn": { codigo: "cn" }, "uuid-epcar": { codigo: "epcar" } };
  assert.equal(examTagAtivo({ concurso_id: "uuid-epcar" }, concursosPorId), "epcar");
  assert.equal(examTagAtivo({ concurso_id: null }, concursosPorId), null);
  assert.equal(examTagAtivo({}, concursosPorId), null);
});

test("alvo só é permitido entre os concursos da turma comercial (não mistura concurso)", () => {
  const cnEpcar = { codigo: "cn-epcar", concursos: [{ codigo: "cn", ordem: 0 }, { codigo: "epcar", ordem: 1 }] };
  assert.equal(alvoPermitido("cn", cnEpcar), true);
  assert.equal(alvoPermitido("epcar", cnEpcar), true);
  assert.equal(alvoPermitido("essa", cnEpcar), false, "ESA não pode ser alvo de quem está na turma CN/EPCAR");
  // sem turma comercial: qualquer concurso vale
  assert.equal(alvoPermitido("essa", null), true);
});

test("concursosDaTurma respeita a ordem do catálogo", () => {
  const t = { concursos: [{ codigo: "epcar", ordem: 1 }, { codigo: "cn", ordem: 0 }] };
  assert.deepEqual(concursosDaTurma(t).map((c) => c.codigo), ["cn", "epcar"]);
});

test("resolverConfig: sem override, o valor efetivo é o oficial e o status viaja junto", () => {
  const oficial = [{ chave: "piso_disciplina", valor: { tipo: "absoluto", pct: 50 }, status_dado: "oficial", fonte: "Edital CPACN 6.5" }];
  const r = resolverConfig(oficial, []);
  assert.equal(r.length, 1);
  assert.equal(r[0].origem, "oficial");
  assert.deepEqual(r[0].valorEfetivo, { tipo: "absoluto", pct: 50 });
  assert.equal(r[0].statusDado, STATUS_DADO.OFICIAL);
  assert.equal(r[0].desvioDoEdital, false);
  assert.equal(r[0].temReferenciaOficial, true);
});

test("resolverConfig: override da escola vence, mas o valor oficial NÃO some (transparência D4)", () => {
  const oficial = [{ chave: "volume_semanal_mat", valor: { questoes: 200 }, status_dado: "inferencia", fonte: "doc" }];
  const escola = [{ chave: "volume_semanal_mat", valor: { questoes: 320 }, desvio_do_edital: true }];
  const r = resolverConfig(oficial, escola);
  assert.equal(r[0].origem, "escola");
  assert.deepEqual(r[0].valorEfetivo, { questoes: 320 });
  assert.deepEqual(r[0].valorOficial, { questoes: 200 }, "a referência oficial continua visível");
  assert.equal(r[0].desvioDoEdital, true);
});

test("desviosDoEdital lista só as chaves em que a escola diverge", () => {
  const oficial = [
    { chave: "piso_disciplina", valor: { pct: 50 }, status_dado: "oficial" },
    { chave: "volume_semanal_mat", valor: { questoes: 200 }, status_dado: "inferencia" },
  ];
  const escola = [
    { chave: "volume_semanal_mat", valor: { questoes: 320 }, desvio_do_edital: true },
    { chave: "foco", valor: { x: 1 }, desvio_do_edital: false },
  ];
  const desvios = desviosDoEdital(oficial, escola);
  assert.deepEqual(desvios.map((d) => d.chave), ["volume_semanal_mat"]);
});
