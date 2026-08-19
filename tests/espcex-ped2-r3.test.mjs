// PED2-R3 — fonte estruturada e seed gerado da EsPCEx (sem banco).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  carregarFonte, validarFonte, gerarSql, DESTINO,
} from "../scripts/gerar-seed-espcex-ped2-r3.mjs";

const dados = carregarFonte();

test("fonte PED2-R3 tem 80 assuntos oficiais, 339 recortes e 200 questões", () => {
  assert.deepEqual(validarFonte(dados), []);
  assert.equal(dados.catalogo.length, 80);
  assert.equal(dados.catalogo.reduce((n, a) => n + a.subassuntos.length, 0), 339);
  assert.equal(dados.provas.reduce((n, p) => n + p.questoes.length, 0), 200);
});

test("cadernos 2024 e 2025 preservam a numeração oficial dos dois dias", () => {
  assert.deepEqual(dados.provas.map((p) => p.chave), ["2024-d1-a", "2024-d2-d", "2025-d1-a", "2025-d2-d"]);
  for (const ano of [2024, 2025]) {
    const [dia1, dia2] = dados.provas.filter((p) => p.ano === ano);
    assert.deepEqual([dia1.questoes.length, dia2.questoes.length], [44, 56]);
    assert.deepEqual(dia1.questoes.map((q) => q.numero), Array.from({ length: 44 }, (_, i) => i + 1));
    assert.deepEqual(dia2.questoes.map((q) => q.numero), Array.from({ length: 56 }, (_, i) => i + 1));
  }
  const anuladas = dados.provas.flatMap((p) => p.questoes).filter((q) => q.gabarito === "ANULADA");
  assert.deepEqual(anuladas.map((q) => [q.materia, q.numero]), [["por", 2]]);
});

test("validador rejeita divergência do gabarito oficial", () => {
  const alterados = structuredClone(dados);
  alterados.provas[0].questoes[0].gabarito = "B";
  assert.match(validarFonte(alterados).join("\n"), /2024-d1-a Q1: esperado gabarito oficial A, encontrado B/);
});

test("programa vigente está comparado com 2022 e registra as mudanças de 2026", () => {
  assert.equal(dados.fonte_programa_vigente.comparado_com_2022, true);
  assert.match(dados.fonte_programa_vigente.edital, /22 de abril de 2026/);
  assert.match(dados.fonte_programa_vigente.url_oficial, /^https:\/\/in\.gov\.br\//);

  const estruturas = dados.catalogo.find((a) => a.materia === "ing" && a.nome === "Estruturas gramaticais");
  assert.ok(estruturas.subassuntos.includes("Word formation"));
  const guerraFria = dados.catalogo.find((a) => a.nome === "O Mundo na Guerra Fria");
  assert.ok(guerraFria.subassuntos.includes("República Brasileira entre 1945 e 1991"));
  const atual = dados.catalogo.find((a) => a.nome === "O Mundo no Final do Século XX e Início do Século XXI");
  assert.ok(atual.subassuntos.includes("Globalização na situação atual"));
});

test("fonte não guarda enunciado e não cria trilha semanal", () => {
  const serializado = JSON.stringify(dados);
  assert.equal(serializado.includes('"enunciado"'), false);
  assert.equal(serializado.includes('"trilha_semanas"'), false);
  assert.equal(serializado.includes('"atividades_modelo"'), false);
  for (const q of dados.provas.flatMap((p) => p.questoes)) {
    assert.ok(q.referencia.length <= 140, `referência longa na questão ${q.numero}`);
  }
});

test("seed 19 está sincronizado byte a byte com a fonte versionada", () => {
  assert.equal(readFileSync(DESTINO, "utf8"), gerarSql(dados));
});
