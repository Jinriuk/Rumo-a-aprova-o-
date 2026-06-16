// ============================================================
// PAGINAÇÃO em memória (Fase B-min, B.2/B.6) — função pura,
// testável sem banco.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { paginar } from "../app/src/shared/lib/paginacao.js";

test("paginar: lista vazia devolve 1 página vazia", () => {
  const r = paginar([], 1, 50);
  assert.deepEqual(r, { pagina: 1, totalPaginas: 1, total: 0, itens: [] });
});

test("paginar: recorta a página pedida", () => {
  const lista = Array.from({ length: 120 }, (_, i) => i);
  const r = paginar(lista, 2, 50);
  assert.equal(r.pagina, 2);
  assert.equal(r.totalPaginas, 3);
  assert.equal(r.total, 120);
  assert.deepEqual(r.itens, lista.slice(50, 100));
});

test("paginar: última página pode ter menos itens que porPagina", () => {
  const lista = Array.from({ length: 120 }, (_, i) => i);
  const r = paginar(lista, 3, 50);
  assert.equal(r.itens.length, 20);
  assert.deepEqual(r.itens, lista.slice(100, 120));
});

test("paginar: página acima do total é presa na última (não devolve vazio à toa)", () => {
  const lista = Array.from({ length: 10 }, (_, i) => i);
  const r = paginar(lista, 99, 50);
  assert.equal(r.pagina, 1);
  assert.equal(r.totalPaginas, 1);
  assert.deepEqual(r.itens, lista);
});

test("paginar: página zero/negativa é presa na primeira", () => {
  const lista = Array.from({ length: 10 }, (_, i) => i);
  const r = paginar(lista, 0, 50);
  assert.equal(r.pagina, 1);
  const r2 = paginar(lista, -5, 50);
  assert.equal(r2.pagina, 1);
});
