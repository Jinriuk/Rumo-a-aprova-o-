// Calendário semanal e missões autorais da EsPCEx (sem banco).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  carregarFontes, montarTarefas, validarFonte, gerarSql, DESTINO,
} from "../scripts/gerar-seed-trilha-espcex.mjs";

const { trilha, conteudo } = carregarFontes();
const tarefas = montarTarefas(trilha, conteudo);

test("calendário próprio tem 9 semanas contínuas e termina nos dois dias oficiais", () => {
  assert.deepEqual(validarFonte(trilha, conteudo), []);
  assert.equal(trilha.semanas.length, 9);
  assert.deepEqual(trilha.provas, { dia1: "2026-09-12", dia2: "2026-09-13" });
  assert.deepEqual(
    trilha.semanas.map((s) => [s.n, s.inicio, s.fim]),
    [
      [1, "2026-07-13", "2026-07-19"], [2, "2026-07-20", "2026-07-26"],
      [3, "2026-07-27", "2026-08-02"], [4, "2026-08-03", "2026-08-09"],
      [5, "2026-08-10", "2026-08-16"], [6, "2026-08-17", "2026-08-23"],
      [7, "2026-08-24", "2026-08-30"], [8, "2026-08-31", "2026-09-06"],
      [9, "2026-09-07", "2026-09-13"],
    ],
  );
});

test("calendário cobre os 80 assuntos e usa recorrência conjunta 2024–2025", () => {
  const programa = tarefas.filter((t) => t.tipo === "programa");
  assert.equal(programa.length, 80);
  assert.equal(new Set(programa.map((t) => `${t.s}|${t.assunto}`)).size, 80);
  assert.ok(programa.some((t) => t.incidencia > 0 && t.p === "F"));
  assert.ok(programa.some((t) => t.incidencia === 0 && t.p === "X"));
  assert.equal(conteudo.provas.reduce((n, p) => n + p.questoes.length, 0), 200);
  assert.equal(tarefas.length, 109);
});

test("missões foram ampliadas para 24 e cobrem três objetivos por área", () => {
  assert.equal(trilha.missoes.length, 24);
  for (const materia of ["por", "red", "fis", "qui", "mat", "geo", "his", "ing"]) {
    assert.equal(trilha.missoes.filter((m) => m.materia === materia).length, 3, materia);
  }
  assert.deepEqual(trilha.planos.map((p) => p.tipo), ["anual", "semestral", "intensiva", "reta_final"]);
});

test("seed 20 está sincronizado byte a byte com as fontes versionadas", () => {
  assert.equal(readFileSync(DESTINO, "utf8"), gerarSql(trilha, conteudo));
});
