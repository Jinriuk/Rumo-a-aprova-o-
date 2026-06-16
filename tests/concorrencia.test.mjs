// ============================================================
// CONCORRÊNCIA LIMITADA (Fase B-min, B.6) — função pura, testável
// sem banco/rede (a `fn` é simulada).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { comConcorrenciaLimitada } from "../app/src/shared/lib/concorrencia.js";

test("comConcorrenciaLimitada: processa todos os itens, mesmo com mais itens que o limite", async () => {
  const itens = Array.from({ length: 23 }, (_, i) => i);
  const processados = [];
  await comConcorrenciaLimitada(itens, 5, async (x) => { processados.push(x); });
  assert.deepEqual([...processados].sort((a, b) => a - b), itens);
});

test("comConcorrenciaLimitada: nunca excede o teto de chamadas simultâneas", async () => {
  const itens = Array.from({ length: 30 }, (_, i) => i);
  let emVoo = 0;
  let pico = 0;
  await comConcorrenciaLimitada(itens, 4, async () => {
    emVoo++;
    pico = Math.max(pico, emVoo);
    await new Promise((r) => setTimeout(r, 1));
    emVoo--;
  });
  assert.ok(pico <= 4, `pico de chamadas simultâneas foi ${pico}, esperado <= 4`);
});

test("comConcorrenciaLimitada: lista vazia não chama fn e não trava", async () => {
  let chamadas = 0;
  await comConcorrenciaLimitada([], 10, async () => { chamadas++; });
  assert.equal(chamadas, 0);
});

test("comConcorrenciaLimitada: limite maior que a lista usa só o necessário (1 chamada por item)", async () => {
  const itens = [1, 2, 3];
  let chamadas = 0;
  await comConcorrenciaLimitada(itens, 100, async () => { chamadas++; });
  assert.equal(chamadas, 3);
});

test("comConcorrenciaLimitada: propaga o erro de um item que falhou (quem chama decide engolir ou não)", async () => {
  const itens = [1, 2, 3];
  await assert.rejects(
    comConcorrenciaLimitada(itens, 2, async (x) => {
      if (x === 2) throw new Error("falhou");
    }),
    /falhou/,
  );
});
