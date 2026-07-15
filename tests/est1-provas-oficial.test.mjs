// ============================================================
// EST1-A5 — provas.js É ESPELHO da estrutura OFICIAL do banco
// ------------------------------------------------------------
// Achado EST0 PEDAGOGIA-03: provas.js (lido por ClassificacaoTurma e
// ResumoResponsavel) divergia da estrutura oficial (seed 07): ESA 40q
// vs 50, EsPCEx dias trocados, EPCAR 20q vs 16, CN Dia 2 com fis/qui
// max 10 e chave agregada 'soc'. Como o SimuladoConcurso salva com as
// chaves oficiais (bio/his/geo), o ranking e o semáforo do responsável
// subcontavam. Aqui travamos a paridade contra os números do seed 07 e
// a compat do dado legado ('soc').
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { PROVAS, provaDoConcurso, materiasDaProva, totalQuestoes, totalAcertos, notaPct } from "../app/src/modules/conteudo/provas.js";

// Totais objetivos oficiais (soma de num_questoes por exam_tag no seed 07,
// excluindo a redação). Fonte: supabase/seed/07_provas.sql.
const TOTAL_OFICIAL = {
  cn: 20 + 20 + 20 + 6 + 6 + 6 + 6 + 6, // mat,ing,por,fis,qui,bio,his,geo = 90
  epcar: 16 + 16 + 16,                   // por,mat,ing = 48
  espcex: 20 + 12 + 12 + 20 + 12 + 12 + 12, // por,fis,qui,mat,ing,his,geo = 100
  esa: 14 + 14 + 6 + 6 + 10,             // mat,por,his,geo,ing = 50
  eear: 24 + 24 + 24 + 24,               // por,ing,mat,fis = 96
};

test("total de questões objetivas bate com o seed oficial, por concurso", () => {
  for (const [tag, total] of Object.entries(TOTAL_OFICIAL)) {
    assert.equal(totalQuestoes(PROVAS[tag]), total, `total objetivo de ${tag}`);
  }
});

test("CN Dia 2 usa as chaves oficiais (fis/qui/bio + his/geo), não a antiga 'soc'", () => {
  const chaves = materiasDaProva(PROVAS.cn).map((m) => m.k);
  for (const k of ["fis", "qui", "bio", "his", "geo"]) assert.ok(chaves.includes(k), `CN tem ${k}`);
  assert.ok(!chaves.includes("soc"), "a chave agregada 'soc' não é mais estrutura");
});

test("simulado salvo no formato oficial (bio/his/geo) é contado no total — antes zerava", () => {
  const prova = provaDoConcurso("cn");
  // acertos como o SimuladoConcurso grava: chaves oficiais
  const acertos = { mat: 18, ing: 16, por: 15, fis: 5, qui: 4, bio: 6, his: 5, geo: 4 };
  assert.equal(totalAcertos(prova, acertos), 18 + 16 + 15 + 5 + 4 + 6 + 5 + 4);
});

test("compat de dado legado: simulado antigo com 'soc' ainda conta (não some do total)", () => {
  const prova = provaDoConcurso("cn");
  // simulado antigo: Estudos Sociais lançado como 'soc' agregado (12 → 6+6 em his/geo)
  const antigo = { mat: 10, ing: 10, por: 10, fis: 3, qui: 3, bio: 3, soc: 12 };
  const tot = totalAcertos(prova, antigo);
  // soc=12 vira 6 his + 6 geo (teto 6 cada); demais somam direto
  assert.equal(tot, 10 + 10 + 10 + 3 + 3 + 3 + 6 + 6);
});

test("nota projetada do CN Dia 1 (mat+ing)×2,5 permanece intocada", () => {
  assert.equal(notaPct(provaDoConcurso("cn"), { mat: 20, ing: 20 }), 100);
  assert.equal(notaPct(provaDoConcurso("cn"), { mat: 16, ing: 16 }), 80);
});
