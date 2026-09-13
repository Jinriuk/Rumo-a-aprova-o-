// ============================================================
// ONDA 3 — lado do FRONT: estado do ciclo, data da prova e telas
// ------------------------------------------------------------
// Três defeitos que pareciam um só (A1, T27, C9) e na verdade vinham
// de DOIS conceitos colapsados num: o plano de estudo (a trilha) e a
// data da prova. Medido no demo em 13/09/2026: os 63 alunos dividem
// UMA trilha que acaba em 01/08 e prestam CINCO provas distintas —
// CN 01/08, EPCAR 28/06, EsPCEx 28/09, EsSA 01/10, EEAr 16/11.
// Usar o fim da trilha como data de prova acertava só os 23 do CN.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { estadoDoCiclo, cicloEncerrado } from "../app/src/shared/regras/regras.js";
import { diasParaProva, proximaProva } from "../app/src/modules/conteudo/concursos.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const ler = (p) => readFileSync(resolve(root, p), "utf8");
const semComentarios = (f) => f
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:\\])\/\/.*$/gm, "$1");

const SEMANAS = [
  { numero: 1, inicio: "2026-05-30", fim: "2026-06-07" },
  { numero: 2, inicio: "2026-06-08", fim: "2026-06-14" },
  { numero: 9, inicio: "2026-07-27", fim: "2026-08-01" },
];
const CN = { codigo: "cn", dia_prova: 1, mes_prova: 8 };
const ESPCEX = { codigo: "espcex", dia_prova: 28, mes_prova: 9 };

// ── estadoDoCiclo: espelho de app.estado_ciclo ───────────────────────

test("estadoDoCiclo: depois da última semana → encerrado, sem semana", () => {
  const e = estadoDoCiclo(SEMANAS, "2026-09-13"); // os 43 dias reais do demo
  assert.equal(e.estado, "encerrado");
  assert.equal(e.semana, null);
});

test("estadoDoCiclo: o dia exato do fim ainda é em_curso", () => {
  const e = estadoDoCiclo(SEMANAS, "2026-08-01");
  assert.equal(e.estado, "em_curso");
  assert.equal(e.semana.numero, 9);
});

test("estadoDoCiclo: antes do início → antes, apontando a 1ª", () => {
  const e = estadoDoCiclo(SEMANAS, "2026-05-01");
  assert.equal(e.estado, "antes");
  assert.equal(e.semana.numero, 1);
});

test("estadoDoCiclo: lacuna no calendário é em_curso sem semana, não encerrado", () => {
  const e = estadoDoCiclo(SEMANAS, "2026-06-20"); // entre a semana 2 e a 9
  assert.equal(e.estado, "em_curso", "buraco entre semanas não encerra o ciclo");
  assert.equal(e.semana, null);
});

test("estadoDoCiclo: trilha vazia → sem_semanas, e nunca quebra", () => {
  assert.equal(estadoDoCiclo([], "2026-09-13").estado, "sem_semanas");
  assert.equal(estadoDoCiclo(null, "2026-09-13").estado, "sem_semanas");
  assert.equal(estadoDoCiclo(undefined, "2026-09-13").estado, "sem_semanas");
});

test("cicloEncerrado é atalho de estadoDoCiclo, sem divergir dele", () => {
  for (const dia of ["2026-05-01", "2026-06-03", "2026-08-01", "2026-09-13"]) {
    assert.equal(cicloEncerrado(SEMANAS, dia), estadoDoCiclo(SEMANAS, dia).estado === "encerrado", dia);
  }
});

// ── diasParaProva: a correção do T27 ─────────────────────────────────

test("T27: a trilha NÃO entra mais no cálculo da data da prova", () => {
  // O aluno da EsPCEx: trilha acabou em 01/08, prova em 28/09. Antes,
  // esta função devolvia 0 dias (fim da trilha, esmagado por Math.max).
  const r = diasParaProva({ concurso: ESPCEX }, "2026-09-13");
  assert.equal(r.dataIso, "2026-09-28", "a data vem do concurso, não do fim da trilha");
  assert.equal(r.dias, 15, "faltam 15 dias reais, não 0");
  assert.equal(r.realizada, false);
});

test("T27: passar semanas de trilha não muda nada (o parâmetro sumiu)", () => {
  const semTrilha = diasParaProva({ concurso: CN }, "2026-09-13");
  const comTrilha = diasParaProva({ concurso: CN, semanasTrilha: SEMANAS }, "2026-09-13");
  assert.deepEqual(comTrilha, semTrilha,
    "se a trilha voltasse a influenciar aqui, o T27 voltava junto");
});

test("data_prova_alvo futura tem precedência e não é 'média'", () => {
  const r = diasParaProva({ dataProvaAlvo: "2026-10-05", concurso: CN }, "2026-09-13");
  assert.equal(r.dataIso, "2026-10-05");
  assert.equal(r.dias, 22);
  assert.equal(r.media, false, "data do aluno é exata, não estimativa");
  assert.equal(r.realizada, false);
});

test("data_prova_alvo passada → realizada, e dias é NULL, nunca 0", () => {
  const r = diasParaProva({ dataProvaAlvo: "2026-06-28", concurso: CN }, "2026-09-13");
  assert.equal(r.realizada, true);
  assert.equal(r.dias, null,
    "zero seria um número inventado para uma pergunta sem resposta — foi exatamente isso o T27");
});

test("sem data do aluno, a média do concurso NUNCA diz 'realizada'", () => {
  // A data média é anual e recorrente: o que existe é sempre a PRÓXIMA
  // ocorrência. Afirmar "prova realizada" a partir dela seria inventar
  // um fato sobre um aluno específico a partir de uma estatística.
  const r = diasParaProva({ concurso: CN }, "2026-09-13"); // CN é 01/08, já passou
  assert.equal(r.realizada, false);
  assert.equal(r.media, true);
  assert.equal(r.dataIso, "2027-08-01", "rola para a próxima ocorrência");
  assert.ok(r.dias > 0);
});

test("sem concurso e sem data do aluno → null (a tela omite a contagem)", () => {
  assert.equal(diasParaProva({}, "2026-09-13"), null);
});

test("proximaProva preservada: rola para o ano seguinte quando a data passa", () => {
  assert.equal(proximaProva(CN, "2026-09-13").dataIso, "2027-08-01");
  assert.equal(proximaProva(ESPCEX, "2026-09-13").dataIso, "2026-09-28");
});

// ── telas (inspeção de fonte — o CI não sobe navegador) ──────────────

test("A1: MissaoAtual decide pelo ciclo ANTES de ler a meta vencida", () => {
  const src = semComentarios(ler("app/src/modules/motor/MetaHero.jsx"));
  assert.match(src, /ciclo === "encerrado"/, "o ramo de ciclo encerrado precisa existir");
  const posCiclo = src.indexOf('ciclo === "encerrado"');
  const posAtrasada = src.indexOf("const atrasada");
  assert.ok(posCiclo > -1 && posAtrasada > -1 && posCiclo < posAtrasada,
    "se `atrasada` for calculada antes do ramo do ciclo, o vermelho permanente volta");
});

test("A1: VisaoEstudo passa o estado do ciclo para a missão", () => {
  const src = semComentarios(ler("app/src/routes/aluno/VisaoEstudo.jsx"));
  assert.match(src, /estadoDoCiclo\(/, "a tela precisa derivar o estado");
  assert.match(src, /ciclo=\{ciclo\.estado\}/, "e entregá-lo à missão");
});

test("T28: o resumo do responsável reconhece o ciclo encerrado", () => {
  const src = semComentarios(ler("app/src/modules/desempenho/ResumoResponsavel.jsx"));
  assert.match(src, /const encerrado = ciclo === "encerrado"/);
  assert.match(src, /Ciclo concluído/, "o semáforo precisa de um estado próprio, não 'Precisa de atenção'");
  assert.match(src, /!encerrado && m\.totalDias > 0 && poucosDias/,
    "o alerta de ritmo semanal não pode disparar num ciclo que acabou");
});

test("T27: o cabeçalho tem estado próprio para prova realizada", () => {
  const src = semComentarios(ler("app/src/shared/ui/Cabecalho.jsx"));
  assert.match(src, /provaRealizada \?/, "sem ramo próprio, sobra o '0 dias p/ prova'");
  for (const tela of ["app/src/routes/aluno/AreaAluno.jsx", "app/src/routes/responsavel/AreaResponsavel.jsx"]) {
    assert.match(semComentarios(ler(tela)), /provaRealizada=\{prova\?\.realizada/, `${tela} precisa repassar a flag`);
  }
});

test("C9: a pré-visualização da Marca não crava número de dias", () => {
  const src = semComentarios(ler("app/src/modules/escola/Marca.jsx"));
  assert.doesNotMatch(src, />124</, "o 124 cravado contradizia o cabeçalho da mesma sessão");
  assert.match(src, /dias p\/ prova/, "o bloco continua existindo, só sem número inventado");
});

test("gerar-meta não trata ciclo encerrado como falha de configuração", () => {
  const src = semComentarios(ler("supabase/functions/gerar-meta/index.ts"));
  assert.match(src, /ciclo_encerrado/, "a função precisa conhecer o estado novo");
  const posMapa = src.indexOf("SEM_META_SEM_FALHA");
  const posPendente = src.indexOf("pendente_configuracao");
  assert.ok(posMapa > -1 && posMapa < posPendente,
    "sem o ramo antes, 'gerar meta' num aluno de ciclo encerrado marcaria pendente_configuracao — o que BLOQUEIA emissão de credencial em provisionar-aluno");
});
