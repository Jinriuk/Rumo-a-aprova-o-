// ============================================================
// P0.6 — publicação da trilha CFO PMERJ: o que o repositório garante
// ------------------------------------------------------------
//   • o concurso entra na matriz como 'pre_edital', no nicho da trilha,
//     e nunca vira "pronto" nem herda trilha de outro concurso;
//   • o validador de conteúdo conhece o concurso pelo manifesto (ele não
//     está no seed 05) e reprova se a matriz e o manifesto divergirem;
//   • o seed 18 carimba 'pre_edital' e o SQL do gerador continua sem
//     carimbar (a ordem de aplicação é: SQL, depois o carimbo);
//   • os parâmetros da publicação são válidos (segunda-feira, turma 1,
//     publicada) e o SQL sai byte a byte igual a cada geração, o que
//     permite conferir o arquivo aplicado pelo hash do registro de
//     aplicação.
// Lógica pura, sem banco.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MATURIDADE_CONCURSOS, maturidadeDe, aceitaAluno, podeExibirComoPronto,
  podeAtribuirTrilhaSemanal, trilhaSemanalDoConcurso, rotuloMaturidade,
} from "../app/src/modules/conteudo/maturidade.js";
import {
  concursosDoSeed, concursosDoManifesto, concursosDoCatalogo, conteudoRealPorConcurso, integridadeTrilhaPmerjCfo, validar,
} from "../scripts/validar-conteudo.mjs";
import { carregarFonte, gerarSql, validarParametros } from "../scripts/gerar-seed-trilha-pmerj-cfo.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const M = carregarFonte();
const PUBLICACAO = { inicio: "2026-10-05", turma: 1, publicada: true };

test("matriz: pmerj_cfo é pre_edital, no nicho da trilha, com aviso e sem selo de pronto", () => {
  const c = MATURIDADE_CONCURSOS.pmerj_cfo;
  assert.equal(c.maturidade, "pre_edital");
  assert.equal(c.trilhaNicho, "pmerj-cfo");
  assert.equal(c.trilhaNicho, M.nicho);
  assert.equal(c.versao, 1);
  assert.equal(maturidadeDe("pmerj_cfo"), "pre_edital");
  assert.equal(rotuloMaturidade("pmerj_cfo"), "Pré-edital");
  assert.equal(podeExibirComoPronto("pmerj_cfo"), false);
  assert.equal(aceitaAluno("pmerj_cfo"), true);
  assert.equal(podeAtribuirTrilhaSemanal("pmerj_cfo"), true);
});

test("a nota da matriz não promete o que não existe: 24 missões escritas, 48 pendentes, sem data", () => {
  const { nota } = MATURIDADE_CONCURSOS.pmerj_cfo;
  assert.match(nota, /sem data de prova/i);
  assert.match(nota, /24 missões/);
  assert.match(nota, /48 .*não foram escritas/);
  assert.equal(M.missoes.length, 24);
  assert.equal(M.missoesPendentes.length, 48);
});

test("só a trilha publicada do nicho pmerj-cfo serve ao concurso; versão maior de outro nicho não entra", () => {
  const trilhas = [
    { id: "cn-v9", nicho: "colegio-naval", versao: 9, publicada: true },
    { id: "esp-v3", nicho: "espcex", versao: 3, publicada: true },
    { id: "pm-v2-rascunho", nicho: "pmerj-cfo", versao: 2, publicada: false },
    { id: "pm-v1", nicho: "pmerj-cfo", versao: 1, publicada: true },
  ];
  assert.equal(trilhaSemanalDoConcurso("pmerj_cfo", trilhas)?.id, "pm-v1");
  // trilha não publicada ou ausente: falha fechado, nunca o calendário de outro concurso
  assert.equal(trilhaSemanalDoConcurso("pmerj_cfo", trilhas.filter((t) => t.nicho !== "pmerj-cfo")), null);
  assert.equal(trilhaSemanalDoConcurso("pmerj_cfo", [trilhas[2]]), null);
  // e o PMERJ não tira a trilha dos outros
  assert.equal(trilhaSemanalDoConcurso("cn", trilhas)?.id, "cn-v9");
  assert.equal(trilhaSemanalDoConcurso("espcex", trilhas)?.id, "esp-v3");
});

test("validador: o PMERJ vem do manifesto, não do seed; a matriz cobre os dois, sem aviso nem erro", () => {
  assert.deepEqual(concursosDoManifesto(), ["pmerj_cfo"]);
  // o que um banco recém-criado carrega (reset-db e CI) não tem o PMERJ
  assert.ok(!concursosDoSeed().includes("pmerj_cfo"));
  assert.ok(concursosDoCatalogo().includes("pmerj_cfo"));
  const real = conteudoRealPorConcurso();
  assert.deepEqual(real.pmerj_cfo, { origem: "manifesto", provaOficial: false, assuntos: true, missoes: true, planos: true, trilhaSemanal: true });
  for (const cod of concursosDoSeed()) assert.equal(real[cod].origem, "seed", cod);
  const { erros, avisos } = validar();
  assert.deepEqual(erros, []);
  assert.deepEqual(avisos, []);
  assert.deepEqual(integridadeTrilhaPmerjCfo(), []);
});

test("validador reprova a matriz que marca o PMERJ como completa ou aponta outro nicho", () => {
  const c = MATURIDADE_CONCURSOS.pmerj_cfo;
  const original = { ...c };
  try {
    c.maturidade = "completa";
    assert.match(integridadeTrilhaPmerjCfo().join("\n"), /deve ser 'pre_edital'/);
    c.maturidade = original.maturidade;
    c.trilhaNicho = "colegio-naval";
    assert.match(integridadeTrilhaPmerjCfo().join("\n"), /trilhaNicho da matriz é 'colegio-naval'/);
  } finally {
    Object.assign(c, original);
  }
  assert.deepEqual(integridadeTrilhaPmerjCfo(), []);
});

test("seed 18 carimba pre_edital no PMERJ; o SQL do gerador continua sem carimbar", () => {
  const seed = readFileSync(join(RAIZ, "supabase/seed/18_maturidade_concursos.sql"), "utf8");
  assert.match(seed, /update concursos set maturidade = 'pre_edital', conteudo_versao = 1\s*\n\s*where codigo = 'pmerj_cfo';/);
  const sql = gerarSql(M, PUBLICACAO).replace(/^--.*$/gm, "");
  assert.doesNotMatch(sql, /maturidade/);
});

test("parâmetros da publicação: segunda-feira, turma 1, publicada; 12 semanas de 05/10 a 27/12/2026", () => {
  assert.deepEqual(validarParametros(PUBLICACAO), []);
  assert.equal(new Date(`${PUBLICACAO.inicio}T00:00:00Z`).getUTCDay(), 1);
  const sql = gerarSql(M, PUBLICACAO);
  assert.match(sql, /insert into trilhas \(id, nicho, nome, versao, publicada\)\s*\nvalues \('[0-9a-f-]{36}', 'pmerj-cfo', 'CFO PMERJ, preparação pré-edital', 1, true\)/);
  assert.match(sql, /\(1, '2026-10-05', '2026-10-11'/);
  assert.match(sql, /\(12, '2026-12-21', '2026-12-27'/);
  // concurso sem data de prova (0062)
  assert.match(sql, /'pmerj_cfo', 'CFO PMERJ, preparação pré-edital', .*, null, null, /);
  // 219 linhas do Anexo II, 24 missões das semanas 1 a 4
  assert.equal((sql.match(/primeira exposição: semana/g) ?? []).length, 219);
  assert.match(sql, /count\(\*\) into n from missoes where exam_tag = 'pmerj_cfo';\s*\n\s*if n <> 24 then/);
});

test("o SQL da publicação é reprodutível: duas gerações dão o mesmo sha256", () => {
  const h = (s) => createHash("sha256").update(s).digest("hex");
  assert.equal(h(gerarSql(M, PUBLICACAO)), h(gerarSql(carregarFonte(), PUBLICACAO)));
});
