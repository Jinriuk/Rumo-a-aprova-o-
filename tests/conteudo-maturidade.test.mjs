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
  trilhaSemanalDoConcurso,
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

test("CN e EsPCEx têm conteúdo completo e podem ser exibidos como prontos", () => {
  assert.equal(maturidadeDe("cn"), "completa");
  assert.equal(maturidadeDe("espcex"), "completa");
  assert.equal(podeExibirComoPronto("cn"), true);
  assert.equal(podeExibirComoPronto("espcex"), true);
  for (const cod of Object.keys(MATURIDADE_CONCURSOS)) {
    if (["cn", "espcex"].includes(cod)) continue;
    assert.equal(podeExibirComoPronto(cod), false, `${cod} não pode aparecer como pronto`);
  }
});

test("só concurso completo recebe a trilha semanal (calendário)", () => {
  assert.equal(podeAtribuirTrilhaSemanal("cn"), true);
  assert.equal(podeAtribuirTrilhaSemanal("espcex"), true);
  for (const cod of ["epcar", "esa", "eear", "cm"]) {
    assert.equal(podeAtribuirTrilhaSemanal(cod), false, `${cod} não deve herdar calendário do CN`);
  }
});

test("cada concurso completo recebe somente a trilha do próprio nicho", () => {
  const trilhas = [
    { id: "cn-v1", nicho: "colegio-naval", versao: 1, publicada: true },
    { id: "esp-v1", nicho: "espcex", versao: 1, publicada: true },
    { id: "outra-v99", nicho: "outro", versao: 99, publicada: true },
    { id: "esp-r", nicho: "espcex", versao: 2, publicada: false },
  ];
  assert.equal(trilhaSemanalDoConcurso("cn", trilhas)?.id, "cn-v1");
  assert.equal(trilhaSemanalDoConcurso("espcex", trilhas)?.id, "esp-v1");
  assert.equal(trilhaSemanalDoConcurso("epcar", trilhas), null);
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

test("CN e EsPCEx têm trilha semanal real e estrutura de prova", () => {
  const real = conteudoRealPorConcurso();
  for (const codigo of ["cn", "espcex"]) {
    assert.equal(real[codigo].trilhaSemanal, true, codigo);
    assert.equal(real[codigo].provaOficial, true, codigo);
    assert.equal(real[codigo].assuntos, true, codigo);
  }
});

// ---------- integridade estrutural ----------
test("trilhas semanais de CN e EsPCEx têm integridade estrutural", () => {
  assert.deepEqual(integridadeTrilhaSemanal(), []);
});

test("seeds: matéria com slug, assunto com nome, plano de trilha com concurso válido", () => {
  assert.deepEqual(integridadeConteudo(), []);
});

test("seed gerado de maturidade está em dia com a fonte única", () => {
  assert.deepEqual(seedMaturidadeEmDia(), []);
});
