// ============================================================
// FE1 — CONTRATOS: validação de payload e DTOs (schema cru → contrato).
// Lógica extraída dos componentes (Registrar, VinculosResponsavel)
// para módulos puros — testada aqui sem renderizar React.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { parseTempo, validarRegistroEstudo } from "../app/src/shared/contratos/registroEstudo.js";
import { vinculoDTO, vinculosDTO, responsaveisDTO, dataCurtaBR } from "../app/src/shared/contratos/dto.js";

// ---------- parseTempo (comportamento preservado da versão antiga) ----------

test("parseTempo: formatos amigáveis", () => {
  assert.equal(parseTempo(""), null);
  assert.equal(parseTempo("   "), null);
  assert.equal(parseTempo("90"), 90);
  assert.equal(parseTempo("45min"), 45);
  assert.equal(parseTempo("1h"), 60);
  assert.equal(parseTempo("1.5h"), 90);
  assert.equal(parseTempo("1h30"), 90);
  assert.equal(parseTempo("2h05"), 125);
  assert.ok(Number.isNaN(parseTempo("abc")), "lixo vira NaN");
});

// ---------- validarRegistroEstudo (validação de payload) ----------

const baseForm = { data: "2026-06-28", disciplina_codigo: "mat", topico: "MMC", questoes: "10", acertos: "8", tempo: "1h", obs: "" };

test("validarRegistroEstudo: payload válido devolve campos limpos", () => {
  const v = validarRegistroEstudo(baseForm);
  assert.equal(v.ok, true);
  assert.deepEqual(v.erros, {});
  assert.deepEqual(v.campos, {
    data: "2026-06-28", disciplina_codigo: "mat", topico: "MMC",
    questoes: 10, acertos: 8, minutos: 60, obs: null,
  });
});

test("validarRegistroEstudo: questões obrigatória e > 0", () => {
  assert.equal(validarRegistroEstudo({ ...baseForm, questoes: "" }).ok, false);
  assert.equal(validarRegistroEstudo({ ...baseForm, questoes: "0" }).ok, false);
  assert.ok(validarRegistroEstudo({ ...baseForm, questoes: "0" }).erros.questoes);
});

test("validarRegistroEstudo: tópico obrigatório", () => {
  const v = validarRegistroEstudo({ ...baseForm, topico: "   " });
  assert.equal(v.ok, false);
  assert.ok(v.erros.topico);
});

test("validarRegistroEstudo: tempo inválido barra o envio", () => {
  const v = validarRegistroEstudo({ ...baseForm, tempo: "xyz" });
  assert.equal(v.ok, false);
  assert.ok(v.erros.tempo);
});

test("validarRegistroEstudo: acertos não podem passar das questões", () => {
  const v = validarRegistroEstudo({ ...baseForm, questoes: "10", acertos: "15" });
  assert.equal(v.ok, false);
  assert.ok(v.erros.acertos);
});

test("validarRegistroEstudo: sem acerto lançado vira null (não 0)", () => {
  const v = validarRegistroEstudo({ ...baseForm, acertos: "" });
  assert.equal(v.ok, true);
  assert.equal(v.campos.acertos, null);
});

test("validarRegistroEstudo: tempo vazio (null) é aceito", () => {
  const v = validarRegistroEstudo({ ...baseForm, tempo: "" });
  assert.equal(v.ok, true);
  assert.equal(v.campos.minutos, null);
});

// ---------- DTOs (escondem o shape cru do PostgREST) ----------

test("vinculoDTO: mapeia embed aninhado para contrato estável", () => {
  const cru = { id: "v1", responsavel_id: "r1", criado_em: "2026-01-02T10:00:00Z", usuarios: { nome: "Ana", papel: "responsavel" } };
  assert.deepEqual(vinculoDTO(cru), {
    id: "v1", responsavelId: "r1", responsavelNome: "Ana", papel: "responsavel", desde: "2026-01-02T10:00:00Z",
  });
});

test("vinculoDTO: tolera embed ausente (nome com fallback)", () => {
  const cru = { id: "v2", responsavel_id: "r2", criado_em: null };
  const dto = vinculoDTO(cru);
  assert.equal(dto.responsavelNome, "Responsável");
  assert.equal(dto.papel, "responsavel");
  assert.equal(dto.desde, null);
});

test("vinculosDTO / responsaveisDTO: lidam com null e linhas vazias", () => {
  assert.deepEqual(vinculosDTO(null), []);
  assert.deepEqual(responsaveisDTO(undefined), []);
  assert.deepEqual(responsaveisDTO([{ id: "r1", nome: "João" }]), [{ id: "r1", nome: "João" }]);
});

test("dataCurtaBR: data válida formata; vazio/ inválido não lança", () => {
  assert.equal(dataCurtaBR(""), "");
  assert.equal(dataCurtaBR(null), "");
  // não impõe locale do runner — só garante que produz string não vazia
  assert.equal(typeof dataCurtaBR("2026-01-02T10:00:00Z"), "string");
  assert.ok(dataCurtaBR("2026-01-02T10:00:00Z").length > 0);
});
