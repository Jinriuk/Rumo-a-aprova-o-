// ============================================================
// RECORRÊNCIA E TAGUEAMENTO (Fase 15.7) — lógica pura (sem banco)
// ------------------------------------------------------------
// Separa os graus de confiança (estimada/validada/medida), garante
// que a estimada NÃO promove prioridade sozinha (regra de ouro),
// consolida o melhor grau disponível e gera o relatório de incidência.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import {
  TIPO_RECORRENCIA, podePromoverPrioridade, statusDoTipo,
  consolidarRecorrencia, prioridadeSugerida, relatorioIncidencia,
} from "../app/src/modules/conteudo/recorrencia.js";
import { STATUS_DADO } from "../app/src/modules/conteudo/pedagogia.js";

test("só validada/medida promovem prioridade; estimada permanece inferência", () => {
  assert.equal(podePromoverPrioridade("estimada"), false);
  assert.equal(podePromoverPrioridade("validada"), true);
  assert.equal(podePromoverPrioridade("medida"), true);
  assert.equal(statusDoTipo("estimada"), STATUS_DADO.INFERENCIA);
  assert.equal(statusDoTipo("medida"), STATUS_DADO.OFICIAL);
});

test("consolidar escolhe o MAIOR grau de confiança sem apagar os outros", () => {
  const linhas = [
    { assunto_id: "a", tipo: "estimada", pct_materia: 25 },
    { assunto_id: "a", tipo: "medida", num_questoes: 2 },
  ];
  const c = consolidarRecorrencia(linhas);
  assert.equal(c.tipo, TIPO_RECORRENCIA.MEDIDA);
  assert.equal(c.promovivel, true);
  assert.equal(c.alternativas.length, 1, "a estimada continua visível como referência");
  assert.equal(c.alternativas[0].tipo, "estimada");
});

test("consolidar sem linhas devolve null", () => {
  assert.equal(consolidarRecorrencia([]), null);
});

test("prioridade sugerida: estimada NÃO aplica (pendente de validação)", () => {
  const c = consolidarRecorrencia([{ assunto_id: "a", tipo: "estimada", pct_materia: 25 }]);
  const p = prioridadeSugerida(c, { peso: 2 });
  assert.equal(p.prioridade, "alta", "25% sugere alta...");
  assert.equal(p.aplicar, false, "...mas não aplica enquanto é só estimada");
  assert.match(p.motivo, /pendente de validação/i);
});

test("prioridade sugerida: medida APLICA", () => {
  const c = consolidarRecorrencia([{ assunto_id: "a", tipo: "medida", num_questoes: 4 }]);
  const p = prioridadeSugerida(c, {});
  assert.equal(p.prioridade, "alta", "4 questões medidas → alta");
  assert.equal(p.aplicar, true);
});

test("prioridade baixa para incidência pequena", () => {
  const c = consolidarRecorrencia([{ assunto_id: "a", tipo: "medida", num_questoes: 1 }]);
  assert.equal(prioridadeSugerida(c, {}).prioridade, "baixa");
});

test("relatório de incidência cruza edital × prova real e marca ponto cego", () => {
  const edital = [
    { id: "a", nome: "Geometria Plana", materia_codigo: "mat", prioridade: "alta" },
    { id: "b", nome: "Saúde Pública", materia_codigo: "bio", prioridade: "baixa" },
  ];
  const medida = { a: { num_questoes_medidas: 2 } }; // b não tem incidência medida
  const rel = relatorioIncidencia(edital, medida);
  assert.equal(rel.find((r) => r.assunto_id === "a").questoesMedidas, 2);
  assert.equal(rel.find((r) => r.assunto_id === "a").semIncidenciaMedida, false);
  assert.equal(rel.find((r) => r.assunto_id === "b").semIncidenciaMedida, true, "no edital mas sem incidência medida = ponto cego");
});
