// ============================================================
// PASSO A PASSO GUIADO (coordenação e aluno)
// ------------------------------------------------------------
// Pedido do dono (d4): na primeira entrada, o sistema oferece um guia
// que leva a pessoa tela a tela explicando o que cada uma faz, e o guia
// pode ser reaberto a qualquer hora.
//
// Lógica pura (roteiros e memória de "já visto") testada de verdade;
// a ligação nas telas, por inspeção de fonte, no padrão do repositório.
// ============================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ROTEIRO_COORDENACAO, ROTEIRO_ALUNO, chaveGuia, guiaJaVisto, marcarGuiaVisto,
} from "../app/src/shared/guia/roteiros.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => readFileSync(resolve(root, p), "utf8");

// as chaves das abas, lidas das próprias telas: o roteiro não pode
// apontar para aba que não existe
function abasDe(arquivo) {
  const codigo = src(arquivo);
  const bloco = codigo.slice(codigo.indexOf("const ABAS = ["), codigo.indexOf("];", codigo.indexOf("const ABAS = [")));
  return [...bloco.matchAll(/\["([a-z]+)", "/g)].map((m) => m[1]);
}

test("todo passo do roteiro da coordenação aponta para uma aba que existe", () => {
  const abas = abasDe("app/src/routes/escola/AreaEscola.jsx");
  assert.ok(abas.length >= 7, `abas lidas: ${abas}`);
  for (const p of ROTEIRO_COORDENACAO) assert.ok(abas.includes(p.aba), `aba inexistente: ${p.aba}`);
  // e cobre todas: guia que pula tela deixa a pessoa sem saber dela
  assert.deepEqual([...new Set(ROTEIRO_COORDENACAO.map((p) => p.aba))].sort(), [...abas].sort());
});

test("todo passo do roteiro do aluno aponta para uma aba que existe, e cobre todas", () => {
  const abas = abasDe("app/src/routes/aluno/VisaoEstudo.jsx");
  assert.ok(abas.length >= 8, `abas lidas: ${abas}`);
  assert.deepEqual([...new Set(ROTEIRO_ALUNO.map((p) => p.aba))].sort(), [...abas].sort());
});

test("coordenação começa pelo que se usa primeiro: turmas antes de alunos", () => {
  const ordem = ROTEIRO_COORDENACAO.map((p) => p.aba);
  assert.ok(ordem.indexOf("turmas") < ordem.indexOf("alunos"));
});

test("todo passo tem título e texto", () => {
  for (const p of [...ROTEIRO_COORDENACAO, ...ROTEIRO_ALUNO]) {
    assert.ok(p.titulo?.length > 3 && p.texto?.length > 20, p.aba);
  }
});

test("memória do guia: por papel e por conta, e tolera armazenamento quebrado", () => {
  const mem = new Map();
  const arm = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const a = chaveGuia("coordenacao", "u1");
  assert.notEqual(a, chaveGuia("coordenacao", "u2"));
  assert.notEqual(a, chaveGuia("aluno", "u1"));
  assert.equal(guiaJaVisto(a, arm), false);
  marcarGuiaVisto(a, arm);
  assert.equal(guiaJaVisto(a, arm), true);
  assert.equal(guiaJaVisto(chaveGuia("coordenacao", "u2"), arm), false);

  const quebrado = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("cheio"); } };
  assert.equal(guiaJaVisto(a, quebrado), false);
  assert.doesNotThrow(() => marcarGuiaVisto(a, quebrado));
  assert.equal(guiaJaVisto(a, undefined), false);
});

test("telas: botão 'Guia' no cabeçalho e o guia montado nas duas áreas", () => {
  const cab = src("app/src/shared/ui/Cabecalho.jsx");
  assert.match(cab, /aoAbrirGuia && \(/);
  const escola = src("app/src/routes/escola/AreaEscola.jsx");
  assert.match(escola, /roteiro: ROTEIRO_COORDENACAO/);
  assert.match(escola, /podeIniciar: mostrarAbas/, "o convite não pode aparecer antes da escola carregar");
  assert.match(escola, /aoAbrirGuia=\{guia\.abrir\}/);
  assert.match(escola, /\{guia\.elemento\}/);
  const aluno = src("app/src/routes/aluno/AreaAluno.jsx");
  assert.match(aluno, /pedidoGuia=\{pedidoGuia\}/);
  const visao = src("app/src/routes/aluno/VisaoEstudo.jsx");
  assert.match(visao, /roteiro: ROTEIRO_ALUNO/);
  assert.match(visao, /\{guia\.elemento\}/);
});

test("o guia não escreve no banco", () => {
  for (const f of ["app/src/shared/guia/roteiros.js", "app/src/shared/guia/GuiaPassoAPasso.jsx"]) {
    assert.doesNotMatch(src(f), /shared\/data|supabase/, f);
  }
});
