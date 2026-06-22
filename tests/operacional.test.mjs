// ============================================================
// escolaOperacional — espelho do gate de suspensão (D1A.1)
// ------------------------------------------------------------
// Prova que o front classifica como NÃO-operacional exatamente os
// mesmos status que app.tenant_operacional() bloqueia no banco
// (suspensa/cancelada), e como operacional os de pré-ativação.
// É o que decide se a coordenação vê o painel ou a tela "acesso
// suspenso" — então precisa casar com a RLS, nota a nota.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { escolaOperacional } from "../app/src/shared/data/operacional.js";

test("status que OPERAM (não bloqueados pela RLS)", () => {
  for (const status of ["implantacao", "demo", "piloto", "ativa"]) {
    assert.equal(escolaOperacional({ status }), true, `${status} deveria operar`);
  }
});

test("status BLOQUEADOS (RLS esconde o dado)", () => {
  for (const status of ["suspensa", "cancelada"]) {
    assert.equal(escolaOperacional({ status }), false, `${status} deveria bloquear`);
  }
});

test("tolerante: escola/status ausente não derruba o fluxo", () => {
  assert.equal(escolaOperacional(null), true);
  assert.equal(escolaOperacional(undefined), true);
  assert.equal(escolaOperacional({}), true);
});
