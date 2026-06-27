// ============================================================
// MATURIDADE E INTEGRIDADE DE CONTEÚDO (PED2) — lógica pura
// ------------------------------------------------------------
// Garante que a matriz de maturidade (fonte única) é honesta em
// relação ao conteúdo REAL dos seeds e que a UI nunca pode exibir
// trilha incompleta como pronta. Roda sem banco (node --test).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import {
  NIVEIS_MATURIDADE, MATURIDADE_CONCURSOS, APRESENTACAO_MATURIDADE,
  maturidadeDe, podeExibirComoPronto, aceitaAluno, podeAtribuirTrilhaSemanal,
} from "../app/src/modules/conteudo/maturidade.js";
import {
  validar, conteudoRealPorConcurso, integridadeTrilhaSemanal,
  integridadeConteudo, seedMaturidadeEmDia,
} from "../scripts/validar-conteudo.mjs";

// ---------- a matriz em si ----------
test("toda maturidade declarada usa um nível válido", () => {
  for (const c of Object.values(MATURIDADE_CONCURSOS)) {
    assert.ok(NIVEIS_MATURIDADE.includes(c.maturidade), `${c.codigo}: nível inválido ${c.maturidade}`);
  }
});

test("CN é a âncora completa; só ela é exibível como pronta", () => {
  assert.equal(maturidadeDe("cn"), "completa");
  assert.equal(podeExibirComoPronto("cn"), true);
  for (const cod of Object.keys(MATURIDADE_CONCURSOS)) {
    if (cod === "cn") continue;
    assert.equal(podeExibirComoPronto(cod), false, `${cod} não pode aparecer como pronto`);
  }
});

test("só concurso completo recebe a trilha semanal (calendário)", () => {
  assert.equal(podeAtribuirTrilhaSemanal("cn"), true);
  for (const cod of ["espcex", "epcar", "esa", "eear", "cm"]) {
    assert.equal(podeAtribuirTrilhaSemanal(cod), false, `${cod} não deve herdar calendário do CN`);
  }
});

test("concurso indisponível não aceita aluno; os demais aceitam", () => {
  assert.equal(aceitaAluno("cm"), false);
  for (const cod of ["cn", "espcex", "epcar", "esa", "eear"]) {
    assert.equal(aceitaAluno(cod), true, `${cod} deveria aceitar aluno`);
  }
});

test("código desconhecido cai em 'indisponivel' (nunca finge pronto)", () => {
  assert.equal(maturidadeDe("xyz-inexistente"), "indisponivel");
  assert.equal(podeExibirComoPronto("xyz-inexistente"), false);
});

test("apresentação cobre todos os níveis", () => {
  for (const n of NIVEIS_MATURIDADE) {
    assert.ok(APRESENTACAO_MATURIDADE[n], `falta apresentação para ${n}`);
    assert.ok(APRESENTACAO_MATURIDADE[n].rotulo);
  }
});

// ---------- honestidade contra os seeds reais ----------
test("validador de conteúdo passa sem erros (matriz × conteúdo real)", () => {
  const { erros, avisos } = validar();
  assert.deepEqual(erros, [], `erros de conteúdo:\n${erros.join("\n")}`);
  assert.deepEqual(avisos, [], `avisos de conteúdo:\n${avisos.join("\n")}`);
});

test("nenhum concurso 'completa'/'beta' está sem assuntos no seed", () => {
  const real = conteudoRealPorConcurso();
  for (const c of Object.values(MATURIDADE_CONCURSOS)) {
    if ((c.maturidade === "completa" || c.maturidade === "beta") && real[c.codigo]) {
      assert.equal(real[c.codigo].assuntos, true, `${c.codigo} promete ${c.maturidade} sem assuntos`);
    }
  }
});

test("CN tem trilha semanal real e estrutura de prova", () => {
  const real = conteudoRealPorConcurso();
  assert.equal(real.cn.trilhaSemanal, true);
  assert.equal(real.cn.provaOficial, true);
  assert.equal(real.cn.assuntos, true);
});

// ---------- integridade estrutural ----------
test("trilha semanal do CN não tem semana vazia, tarefa sem texto ou sem disciplina", () => {
  assert.deepEqual(integridadeTrilhaSemanal(), []);
});

test("seeds: matéria com slug, assunto com nome, plano de trilha com concurso válido", () => {
  assert.deepEqual(integridadeConteudo(), []);
});

test("seed gerado de maturidade está em dia com a fonte única", () => {
  assert.deepEqual(seedMaturidadeEmDia(), []);
});
