// ============================================================
// FE1 — TRAVA DE ENVIO (prevenção de DUPLO ENVIO).
// Núcleo síncrono reusado por useEnvioUnico e pelas telas. Aqui
// provamos a garantia central: o segundo disparo NO MESMO TICK é
// recusado, que é exatamente o que o estado `ocupado` do React não
// garante (só vira true no próximo render).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { criarTrava, executarUnico } from "../app/src/shared/lib/travaEnvio.js";

test("criarTrava: primeiro tentar() entra, segundo é recusado até liberar", () => {
  const t = criarTrava();
  assert.equal(t.ocupada, false);
  assert.equal(t.tentar(), true, "primeira entrada deve passar");
  assert.equal(t.ocupada, true);
  assert.equal(t.tentar(), false, "segunda entrada no mesmo ciclo deve ser recusada");
  t.liberar();
  assert.equal(t.ocupada, false);
  assert.equal(t.tentar(), true, "depois de liberar, entra de novo");
});

test("DUPLO CLIQUE: duas chamadas síncronas só executam fn uma vez", async () => {
  const t = criarTrava();
  let execucoes = 0;
  const acao = () =>
    executarUnico(t, async () => {
      execucoes += 1;
      await new Promise((r) => setTimeout(r, 10));
      return "ok";
    });

  // dispara as duas no MESMO tick, antes de qualquer await — é o
  // cenário do duplo clique / clique+Enter.
  const p1 = acao();
  const p2 = acao();
  const [r1, r2] = await Promise.all([p1, p2]);

  assert.equal(execucoes, 1, "fn deve rodar uma única vez");
  // uma das chamadas é a vencedora (valor), a outra foi ignorada.
  const ignorados = [r1, r2].filter((r) => r.ignorado).length;
  const comValor = [r1, r2].filter((r) => r.valor === "ok").length;
  assert.equal(ignorados, 1);
  assert.equal(comValor, 1);
});

test("liberação acontece mesmo se fn lançar (não trava para sempre)", async () => {
  const t = criarTrava();
  await assert.rejects(
    executarUnico(t, async () => { throw new Error("falha de rede"); }),
    /falha de rede/,
  );
  assert.equal(t.ocupada, false, "trava deve estar livre após exceção");
  // e uma nova ação consegue rodar
  const r = await executarUnico(t, async () => 42);
  assert.deepEqual(r, { ignorado: false, valor: 42 });
});

test("após terminar, um clique seguinte (sequencial) executa normalmente", async () => {
  const t = criarTrava();
  let n = 0;
  await executarUnico(t, async () => { n += 1; });
  await executarUnico(t, async () => { n += 1; });
  assert.equal(n, 2, "envios sequenciais não são bloqueados");
});
