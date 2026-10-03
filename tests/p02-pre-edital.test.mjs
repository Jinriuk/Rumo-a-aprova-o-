// ============================================================
// P0.2 — lado do FRONT: concurso sem data e maturidade 'pre_edital'
// ------------------------------------------------------------
// Casos da seção 12 de docs/conteudo/pmerj-cfo/PMERJ_CFO_Desenho_da_
// Trilha_e_Auditoria_do_Banco.md que falam de data e de prontidão:
//   • "Concurso sem data confirmada → nenhuma contagem regressiva
//     inventada; calendário de estudos disponível."
//   • "Fonte histórica / prontidão operacional → aviso pré-edital claro
//     sem bloquear indevidamente a semana pronta."
// O lado banco (0062) está em p02-concurso-sem-data-db.test.mjs.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  diasParaProva, proximaProva, dataProvaConhecida, ROTULO_AGUARDANDO_EDITAL, trechoProvaSubtitulo,
} from "../app/src/modules/conteudo/concursos.js";
import {
  MATURIDADE_CONCURSOS, NIVEIS_MATURIDADE, APRESENTACAO_MATURIDADE, REQUISITOS_MATURIDADE,
  maturidadeDe, podeExibirComoPronto, aceitaAluno, podeAtribuirTrilhaSemanal, trilhaSemanalDoConcurso,
} from "../app/src/modules/conteudo/maturidade.js";
import { tipoTrilhaPorPrazo } from "../app/src/modules/conteudo/missoes.js";
import { estaEmRetaFinal } from "../app/src/modules/conteudo/niveisAluno.js";
import { gruposParaRenovar } from "../app/src/modules/escola/proximoCiclo.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => readFileSync(resolve(root, p), "utf8");
const semComentarios = (f) => f
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:\\])\/\/.*$/gm, "$1");

const HOJE = "2026-10-03";
const SEM_DATA = { id: "c-pre", codigo: "pre_teste", nome: "Pré-edital de teste", mes_prova: null, dia_prova: null };
const CN = { id: "c-cn", codigo: "cn", nome: "Colégio Naval", mes_prova: 8, dia_prova: 1 };

// ── data da prova ────────────────────────────────────────────────────

test("concurso sem data: não tem data média, e nenhuma metade vale como data", () => {
  assert.equal(dataProvaConhecida(SEM_DATA), false);
  assert.equal(dataProvaConhecida({ ...SEM_DATA, mes_prova: 10 }), false);
  assert.equal(dataProvaConhecida({ ...SEM_DATA, dia_prova: 5 }), false);
  assert.equal(dataProvaConhecida({ ...SEM_DATA, mes_prova: undefined, dia_prova: undefined }), false);
  assert.equal(dataProvaConhecida(null), false);
  assert.equal(dataProvaConhecida(CN), true);
});

test("concurso sem data: proximaProva é null, nunca '2026-null-null' nem NaN", () => {
  assert.equal(proximaProva(SEM_DATA, HOJE), null);
  assert.equal(proximaProva({ ...SEM_DATA, mes_prova: 10 }, HOJE), null);
});

test("concurso sem data: diasParaProva diz 'aguardando edital' e não conta dias", () => {
  const p = diasParaProva({ concurso: SEM_DATA }, HOJE);
  assert.deepEqual(p, { dataIso: null, dias: null, media: false, realizada: false, aguardandoEdital: true });
  assert.equal(ROTULO_AGUARDANDO_EDITAL, "Data da prova aguardando edital");
});

test("concurso sem data: a data do aluno, quando existe, continua valendo", () => {
  const futura = diasParaProva({ dataProvaAlvo: "2027-03-14", concurso: SEM_DATA }, HOJE);
  assert.equal(futura.dataIso, "2027-03-14");
  assert.equal(futura.dias, 162);
  assert.equal(futura.aguardandoEdital, undefined);
  const passada = diasParaProva({ dataProvaAlvo: "2026-09-01", concurso: SEM_DATA }, HOJE);
  assert.equal(passada.realizada, true);
  assert.equal(passada.dias, null);
});

test("concurso COM data: comportamento de antes, sem a flag nova", () => {
  const p = diasParaProva({ concurso: CN }, HOJE);
  assert.deepEqual(p, { dataIso: "2027-08-01", dias: 302, media: true, realizada: false });
  assert.equal(diasParaProva({}, HOJE), null, "sem concurso e sem data do aluno continua null");
});

test("subtítulo das telas: sem data não formata nada (fmtBR(null) quebraria a renderização)", () => {
  const sem = diasParaProva({ concurso: SEM_DATA }, HOJE);
  assert.equal(trechoProvaSubtitulo(sem), null);
  assert.equal(trechoProvaSubtitulo(sem, { detalharMedia: true }), null);
  assert.equal(trechoProvaSubtitulo(null), null);
  const media = diasParaProva({ concurso: CN }, HOJE);
  assert.equal(trechoProvaSubtitulo(media), "prova ≈ 01/08");
  assert.equal(trechoProvaSubtitulo(media, { detalharMedia: true }), "prova ≈ 01/08 (data média)");
  assert.equal(trechoProvaSubtitulo(diasParaProva({ dataProvaAlvo: "2027-03-14", concurso: SEM_DATA }, HOJE)), "prova em 14/03");
  for (const tela of ["app/src/routes/aluno/AreaAluno.jsx", "app/src/routes/responsavel/AreaResponsavel.jsx"]) {
    const src = semComentarios(ler(tela));
    assert.match(src, /trechoProvaSubtitulo\(prova/, `${tela} deve usar o trecho protegido`);
    assert.doesNotMatch(src, /fmtBR\(prova\.dataIso\)/, `${tela} formatava a data sem checar se ela existe`);
  }
});

test("sem número de dias, nada deriva prazo: trilha anual e fora da reta final", () => {
  const { dias } = diasParaProva({ concurso: SEM_DATA }, HOJE);
  assert.equal(tipoTrilhaPorPrazo(dias), "anual");
  assert.equal(estaEmRetaFinal(dias), false);
});

test("próximo ciclo: concurso sem data entra no grupo sem sugerir âncora inventada", () => {
  const resumo = [
    { aluno: { id: "a1", nome: "Ana", trilha_id: "t1", concurso_id: "c-pre" }, cicloEncerrado: true },
  ];
  const [g] = gruposParaRenovar({ resumo, trilhasPorId: { t1: { nome: "T", trilha_semanas: [{ fim: "2026-09-27" }] } }, concursosPorId: { "c-pre": SEM_DATA } }, HOJE);
  assert.equal(g.concursos[0].proxima, null);
  assert.equal(g.ancoraSugerida, null);
});

test("cabeçalho: ramo próprio para 'aguardando edital', repassado pelas duas telas", () => {
  const src = semComentarios(ler("app/src/shared/ui/Cabecalho.jsx"));
  assert.match(src, /provaAguardandoEdital \?/, "sem ramo próprio a tela não diz nada, ou diz um número");
  assert.match(src, /\{ROTULO_AGUARDANDO_EDITAL\}/);
  // a ordem importa: prova realizada (data do aluno) vem antes, contagem depois
  const iRealizada = src.indexOf("provaRealizada ?");
  const iEdital = src.indexOf("provaAguardandoEdital ?");
  const iDias = src.indexOf("diasProva != null");
  assert.ok(iRealizada > -1 && iRealizada < iEdital && iEdital < iDias);
  for (const tela of ["app/src/routes/aluno/AreaAluno.jsx", "app/src/routes/responsavel/AreaResponsavel.jsx"]) {
    assert.match(semComentarios(ler(tela)), /provaAguardandoEdital=\{prova\?\.aguardandoEdital/, `${tela} precisa repassar a flag`);
  }
});

// ── maturidade 'pre_edital' ──────────────────────────────────────────

const PRE = "pmerj_cfo_teste";
function comPreEdital(fn) {
  MATURIDADE_CONCURSOS[PRE] = {
    codigo: PRE, maturidade: "pre_edital", versao: 1,
    trilhaSemanalRef: null, trilhaNicho: "pre-teste", nota: "fixture de teste",
  };
  try { return fn(); } finally { delete MATURIDADE_CONCURSOS[PRE]; }
}

test("pre_edital é um nível declarado, entre completa e beta, com apresentação", () => {
  assert.deepEqual(NIVEIS_MATURIDADE, ["completa", "pre_edital", "beta", "esqueleto", "indisponivel"]);
  const a = APRESENTACAO_MATURIDADE.pre_edital;
  assert.equal(a.rotulo, "Pré-edital");
  assert.equal(a.tom, "alerta");
  assert.match(a.descricao, /edital anterior \(fonte histórica\)/, "o aviso precisa dizer de onde vem o programa");
  assert.deepEqual(REQUISITOS_MATURIDADE.pre_edital, { provaOficial: false, assuntos: true, trilhaSemanal: true });
});

test("pre_edital libera o calendário e aceita aluno, mas nunca se exibe como pronto", () => {
  comPreEdital(() => {
    assert.equal(maturidadeDe(PRE), "pre_edital");
    assert.equal(aceitaAluno(PRE), true);
    assert.equal(podeAtribuirTrilhaSemanal(PRE), true, "a semana pronta não pode ser bloqueada");
    assert.equal(podeExibirComoPronto(PRE), false, "sem edital, não é 'completa'");
  });
});

test("pre_edital recebe só a trilha do PRÓPRIO nicho, nunca a de outro concurso", () => {
  comPreEdital(() => {
    const trilhas = [
      { id: "cn", nicho: "colegio-naval", versao: 9, publicada: true },
      { id: "pre-1", nicho: "pre-teste", versao: 1, publicada: true },
      { id: "pre-2-rascunho", nicho: "pre-teste", versao: 2, publicada: false },
    ];
    assert.equal(trilhaSemanalDoConcurso(PRE, trilhas)?.id, "pre-1");
    assert.equal(trilhaSemanalDoConcurso(PRE, trilhas.filter((t) => t.nicho !== "pre-teste")), null,
      "sem a trilha própria no banco, nada é atribuído");
  });
});

test("os outros concursos não mudam de nível", () => {
  const atual = Object.fromEntries(Object.values(MATURIDADE_CONCURSOS).map((c) => [c.codigo, c.maturidade]));
  assert.deepEqual(atual, {
    cn: "completa", espcex: "completa", epcar: "esqueleto", esa: "esqueleto", eear: "esqueleto", cm: "indisponivel",
  });
});

test("o aviso de maturidade aparece no cadastro, na área do aluno e na do responsável para pre_edital", () => {
  // AvisoMaturidade some só quando podeExibirComoPronta; pre_edital é false.
  const aviso = semComentarios(ler("app/src/modules/conteudo/SeloMaturidade.jsx"));
  assert.match(aviso, /if \(info\.podeExibirComoPronta\) return null;/);
  const cadastro = semComentarios(ler("app/src/modules/pessoas/CadastroAlunos.jsx"));
  assert.equal((cadastro.match(/maturidadeDe\(codigoSel\) !== "completa" && \(\s*<AvisoMaturidade/g) ?? []).length, 2,
    "os dois formulários (individual e em lote) mostram o aviso");
  assert.match(semComentarios(ler("app/src/routes/aluno/AreaAluno.jsx")), /<AvisoMaturidade codigo=\{concurso\.codigo\}/);
  assert.match(semComentarios(ler("app/src/routes/responsavel/AreaResponsavel.jsx")), /<AvisoMaturidade codigo=\{concurso\.codigo\}/,
    "o responsável vê as atividades da trilha pré-edital e precisa do mesmo aviso");
});
