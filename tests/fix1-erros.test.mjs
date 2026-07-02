// ============================================================
// FIX1 — mensagemAmigavel (OBS-RC1-003 e OBS-RC1-008)
// ------------------------------------------------------------
// • 008: os contextos de VinculosResponsavel ("revogar", "vincular
//   responsável", "carregar responsáveis") têm mensagem própria —
//   não caem mais no genérico "Não foi possível concluir a ação."
// • 003: erro marcado `esperada` (credencial inválida) NÃO passa por
//   console.error — fora do Vite (import.meta.env ausente = produção)
//   é silêncio total; erro comum continua indo para console.error.
// erros.js é módulo puro (sem cliente Supabase): roda direto no node.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { mensagemAmigavel } from "../app/src/shared/lib/erros.js";

// Captura chamadas de console durante fn e devolve o que foi logado.
function espiandoConsole(fn) {
  const chamadas = { error: [], warn: [] };
  const orig = { error: console.error, warn: console.warn };
  console.error = (...a) => chamadas.error.push(a);
  console.warn = (...a) => chamadas.warn.push(a);
  try { fn(); } finally { console.error = orig.error; console.warn = orig.warn; }
  return chamadas;
}

test("OBS-RC1-008: contextos do fluxo de responsáveis têm mensagem específica", () => {
  espiandoConsole(() => {
    const e = new Error("qualquer falha");
    assert.match(mensagemAmigavel(e, "revogar"), /revogar o acesso/i);
    assert.match(mensagemAmigavel(e, "vincular responsável"), /vincular o responsável/i);
    assert.match(mensagemAmigavel(e, "carregar responsáveis"), /lista de responsáveis/i);
  });
});

test("OBS-RC1-008: contexto desconhecido ainda cai no genérico (fallback preservado)", () => {
  espiandoConsole(() => {
    assert.equal(mensagemAmigavel(new Error("x"), "contexto-que-nao-existe"),
      "Não foi possível concluir a ação. Tente novamente.");
  });
});

test("OBS-RC1-003: falha esperada (credencial errada) não vai para console.error", () => {
  const e = new Error("login por código: Invalid login credentials");
  e.esperada = true;
  const c = espiandoConsole(() => {
    // a mensagem ao usuário NÃO muda (regra dura do FIX1)
    assert.equal(mensagemAmigavel(e, "carregar"),
      "Não conseguimos carregar esses dados. Atualize a página ou tente novamente.");
  });
  assert.equal(c.error.length, 0, "falha esperada poluiu o console.error");
  // fora do Vite (import.meta.env ausente) comporta como produção: silêncio
  assert.equal(c.warn.length, 0);
});

test("OBS-RC1-003: falha inesperada continua indo para console.error (observabilidade intacta)", () => {
  const c = espiandoConsole(() => {
    mensagemAmigavel(new Error("perfil: Failed to fetch"), "carregar");
  });
  assert.equal(c.error.length, 1, "falha inesperada sumiu do console");
});

test("mensagens de rede e Edge seguras continuam funcionando (sem regressão)", () => {
  espiandoConsole(() => {
    assert.match(mensagemAmigavel(new Error("Failed to fetch"), "carregar"), /conexão parece instável/i);
    assert.equal(mensagemAmigavel(new Error("sem permissão para isso"), "acao"),
      "Você não tem permissão para esta ação.");
  });
});
