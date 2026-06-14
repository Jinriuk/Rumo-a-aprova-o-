// ============================================================
// ESTRUTURA DE PROVA (Fase 15.2) — lógica pura (sem banco)
// ------------------------------------------------------------
// Prova os recortes de app/src/modules/conteudo/estruturaProva.js
// sobre uma estrutura de exemplo (separa redação, soma questões,
// agrupa por dia, ordena assunto por prioridade, compõe subassuntos).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import {
  materiasObjetivas, materiaRedacao, totalQuestoesObjetivas,
  materiasPorDia, assuntosOrdenados, resumoStatus, comporAssuntos,
} from "../app/src/modules/conteudo/estruturaProva.js";

const MATERIAS_CN = [
  { materia_codigo: "mat", dia_numero: 1, num_questoes: 20, eh_redacao: false, ordem: 0 },
  { materia_codigo: "ing", dia_numero: 1, num_questoes: 20, eh_redacao: false, ordem: 1 },
  { materia_codigo: "por", dia_numero: 2, num_questoes: 20, eh_redacao: false, ordem: 2 },
  { materia_codigo: "bio", dia_numero: 2, num_questoes: 6, eh_redacao: false, ordem: 5 },
  { materia_codigo: "red", dia_numero: 2, num_questoes: null, eh_redacao: true, ordem: 8 },
];
const DIAS_CN = [{ numero: 1, nome: "Dia 1", ordem: 0 }, { numero: 2, nome: "Dia 2", ordem: 1 }];

test("separa objetivas de redação", () => {
  assert.equal(materiasObjetivas(MATERIAS_CN).length, 4);
  assert.equal(materiaRedacao(MATERIAS_CN).materia_codigo, "red");
});

test("redação ausente (EEAR) devolve null", () => {
  const eear = [{ materia_codigo: "mat", num_questoes: 24, eh_redacao: false }];
  assert.equal(materiaRedacao(eear), null);
});

test("total de questões objetivas soma só as objetivas (ignora redação)", () => {
  assert.equal(totalQuestoesObjetivas(MATERIAS_CN), 20 + 20 + 20 + 6);
});

test("agrupa matérias por dia na ordem do edital", () => {
  const grupos = materiasPorDia(MATERIAS_CN, DIAS_CN);
  assert.deepEqual(grupos.map((g) => g.numero), [1, 2]);
  assert.deepEqual(grupos[0].materias.map((m) => m.materia_codigo), ["mat", "ing"]);
  assert.deepEqual(grupos[1].materias.map((m) => m.materia_codigo), ["por", "bio", "red"]);
});

test("matérias sem dia caem num grupo 'Prova' (concursos de bloco único)", () => {
  const epcar = [
    { materia_codigo: "por", dia_numero: null, num_questoes: 16, eh_redacao: false, ordem: 0 },
    { materia_codigo: "mat", dia_numero: null, num_questoes: 16, eh_redacao: false, ordem: 1 },
  ];
  const grupos = materiasPorDia(epcar, [{ numero: 1, nome: "Prova única", ordem: 0 }]);
  // sem matérias no dia 1, o grupo de bloco único recebe as sem-dia
  const comMaterias = grupos.find((g) => g.materias.length);
  assert.equal(comMaterias.materias.length, 2);
});

test("assuntos ordenam por prioridade (alta → baixa) e depois por ordem", () => {
  const assuntos = [
    { materia_codigo: "mat", nome: "B", prioridade: "baixa", ordem: 1 },
    { materia_codigo: "mat", nome: "A", prioridade: "alta", ordem: 2 },
    { materia_codigo: "mat", nome: "M", prioridade: "media", ordem: 0 },
  ];
  assert.deepEqual(assuntosOrdenados(assuntos, "mat").map((a) => a.nome), ["A", "M", "B"]);
});

test("resumoStatus conta oficial/inferência/validar", () => {
  const itens = [{ status_dado: "oficial" }, { status_dado: "oficial" }, { status_dado: "validar" }];
  assert.deepEqual(resumoStatus(itens), { oficial: 2, inferencia: 0, validar: 1 });
});

test("comporAssuntos anexa os subassuntos ao assunto certo, ordenados", () => {
  const assuntos = [{ id: "a1", nome: "Citologia" }, { id: "a2", nome: "Ecologia" }];
  const subs = [
    { assunto_id: "a1", nome: "Organelas", ordem: 1 },
    { assunto_id: "a1", nome: "Membrana", ordem: 0 },
    { assunto_id: "a2", nome: "Biomas", ordem: 0 },
  ];
  const r = comporAssuntos(assuntos, subs);
  assert.deepEqual(r[0].subassuntos.map((s) => s.nome), ["Membrana", "Organelas"]);
  assert.deepEqual(r[1].subassuntos.map((s) => s.nome), ["Biomas"]);
});
