// ============================================================
// A9 (resíduo) — histórico sem formato não é reetiquetado pelo
// concurso atual do aluno
// ------------------------------------------------------------
// A Onda 2 fechou metade do A9: os dois formulários passaram a gravar
// `exam_tag`. O próprio PR deixou registrado que faltava o outro lado
// — os simulados JÁ gravados com `exam_tag` nulo — e esse lado não foi
// entregue em nenhuma onda seguinte. Na main da Onda 7 a tela ainda
// fazia:
//
//   (simulados ?? []).filter((s) => !s.exam_tag || s.exam_tag === concurso?.codigo)
//
// Ou seja: nulo entrava como se fosse do concurso vigente. O mesmo
// simulado era diagnosticado com as regras do CN hoje e com as da
// EsPCEx amanhã, só porque o aluno trocou de alvo.
//
// Estes testes são de COMPORTAMENTO, não de inspeção de fonte: a
// regra foi extraída para `segregarPorFormato` justamente para poder
// ser exercida de verdade. O contrafactual (voltar a condição
// `!s.exam_tag || ...`) faz os dois primeiros testes falharem na
// asserção, não por erro de import.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { segregarPorFormato } from "../app/src/modules/conteudo/simuladoConcurso.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// histórico plausível: dois simulados anteriores à migration 0014
// (sem formato) e dois gravados depois dela, já com exam_tag.
const HISTORICO = [
  { id: "s1", nome: "Simulado 1", data: "2026-03-10", exam_tag: null, acertos: { mat: 12, por: 9 } },
  { id: "s2", nome: "Simulado 2", data: "2026-04-02", exam_tag: undefined, acertos: { mat: 15, por: 11 } },
  { id: "s3", nome: "Simulado 3", data: "2026-06-18", exam_tag: "cn", acertos: { mat: 18, por: 14 } },
  { id: "s4", nome: "Simulado 4", data: "2026-08-01", exam_tag: "espcex", acertos: { mat: 20, por: 16 } },
];

test("A9: simulado sem exam_tag não entra no diagnóstico do concurso atual", () => {
  const { doConcurso, semFormato } = segregarPorFormato(HISTORICO, "cn");

  assert.deepEqual(doConcurso.map((s) => s.id), ["s3"],
    "só o simulado gravado como 'cn' pode ser avaliado no formato do CN");
  assert.deepEqual(semFormato.map((s) => s.id), ["s1", "s2"],
    "os dois sem formato precisam ficar segregados, não somidos e não absorvidos");
});

test("A9: trocar o concurso do aluno NÃO reetiqueta o histórico sem formato", () => {
  // este é o defeito, exatamente como o catálogo o descreve: a mesma
  // linha de histórico mudando de dono conforme a configuração atual.
  const comoCN = segregarPorFormato(HISTORICO, "cn");
  const comoEspcex = segregarPorFormato(HISTORICO, "espcex");

  // o que muda é só o que TEM formato — e muda para o formato certo.
  assert.deepEqual(comoCN.doConcurso.map((s) => s.id), ["s3"]);
  assert.deepEqual(comoEspcex.doConcurso.map((s) => s.id), ["s4"]);

  // o que NÃO tem formato é idêntico nos dois casos: não seguiu o aluno.
  assert.deepEqual(
    comoCN.semFormato.map((s) => s.id),
    comoEspcex.semFormato.map((s) => s.id),
    "o histórico sem formato mudou de concurso junto com o aluno — é o A9 de volta",
  );
  for (const id of ["s1", "s2"]) {
    assert.ok(!comoEspcex.doConcurso.some((s) => s.id === id),
      `${id} não tem formato registrado e foi contado como EsPCEx`);
  }
});

test("A9: nenhum simulado é perdido na segregação", () => {
  // separar não pode virar apagar: o registro é do aluno.
  for (const codigo of ["cn", "espcex", "esa", null]) {
    const { doConcurso, semFormato } = segregarPorFormato(HISTORICO, codigo);
    const vistos = new Set([...doConcurso, ...semFormato].map((s) => s.id));
    assert.equal(vistos.size, doConcurso.length + semFormato.length,
      `concurso ${codigo}: um simulado apareceu nas duas listas`);
    for (const s of HISTORICO) {
      // um simulado de OUTRO concurso (com formato) não é "sem formato",
      // e também não é do concurso atual — some da tela de propósito.
      if (!s.exam_tag) {
        assert.ok(vistos.has(s.id), `concurso ${codigo}: ${s.id} sumiu do histórico`);
      }
    }
  }
});

test("A9: entradas vazias/nulas não quebram a segregação", () => {
  for (const entrada of [undefined, null, []]) {
    const r = segregarPorFormato(entrada, "cn");
    assert.deepEqual(r.doConcurso, []);
    assert.deepEqual(r.semFormato, []);
  }
});

test("A9: a tela consome a regra pura e não recria o filtro antigo", () => {
  // trava de regressão: a condição `!s.exam_tag || ...` não pode voltar
  // para dentro do componente.
  const src = readFileSync(resolve(root, "app/src/modules/desempenho/SimuladoConcurso.jsx"), "utf8");
  // comentários fora: o texto que EXPLICA o defeito cita a condição
  // antiga, e citar não é executar. A trava é sobre código.
  const codigo = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.match(codigo, /segregarPorFormato\(simulados, concurso\?\.codigo\)/,
    "a tela parou de usar a regra única de segregação");
  assert.doesNotMatch(codigo, /!s\.exam_tag\s*\|\|/,
    "o filtro que absorve o histórico sem formato voltou ao componente");
  // e o diagnóstico tem que sair de doConcurso, nunca da lista inteira.
  assert.match(codigo, /const ultimo = doConcurso\.length/,
    "o último simulado do diagnóstico voltou a sair da lista não segregada");
});
