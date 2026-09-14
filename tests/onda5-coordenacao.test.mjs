// ============================================================
// ONDA 5 — COORDENAÇÃO (17 itens, 15 blocos)
// ------------------------------------------------------------
// Mesmo padrão das ondas anteriores: o repo não sobe navegador nem
// renderiza React em CI, então estes testes travam as propriedades
// por INSPEÇÃO DE FONTE (ver onda1-cors-modais.test.mjs), com
// comentários removidos antes de casar os padrões — senão um
// comentário que MENCIONA o padrão errado (documentando o que foi
// corrigido) faria o teste passar sem o código estar certo.
//
// Cada bloco abaixo trava exatamente o que o bloco corrigiu — não
// mais, não menos — para que reverter o código de um bloco quebre
// SÓ os testes dele.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { adaptarResumoEscola } from "../app/src/shared/metricas/agregados.js";
import { todayISO } from "../app/src/shared/regras/regras.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const ler = (p) => readFileSync(resolve(root, p), "utf8");
const semComentarios = (fonte) => fonte
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:\\])\/\/.*$/gm, "$1");
const src = (p) => semComentarios(ler(p));

// ── Bloco 1 (I9): contagem exata de acessos, não logs.length ────────────────
test("I9: data/index.js introduz o padrão count:'exact', head:true", () => {
  const codigo = src("app/src/shared/data/index.js");
  assert.match(
    codigo,
    /export async function contarLogsAcesso/,
    "precisa de uma função dedicada para a contagem exata (separada da listagem limitada)",
  );
  const trechoFn = codigo.slice(codigo.indexOf("export async function contarLogsAcesso"));
  assert.match(
    trechoFn.slice(0, 400),
    /\{\s*count:\s*["']exact["']\s*,\s*head:\s*true\s*\}/,
    "contarLogsAcesso precisa pedir count:'exact', head:true — não baixar o array pra contar no cliente",
  );
});

test("I9: AreaEscola.jsx busca a contagem exata e repassa ao PainelConformidade", () => {
  const codigo = src("app/src/routes/escola/AreaEscola.jsx");
  assert.match(codigo, /db\.contarLogsAcesso\(/, "a tela precisa chamar a nova função de contagem exata");
  assert.match(
    codigo,
    /<PainelConformidade[\s\S]*?logsTotal=\{[^}]+\}/,
    "logsTotal precisa ser passado como prop para o painel",
  );
});

test("I9: o StatCard 'Acessos registrados' usa logsTotal, não logs.length (limitado a 100)", () => {
  const codigo = src("app/src/modules/consentimento/PainelConformidade.jsx");
  assert.match(
    codigo,
    /rotulo="Acessos registrados"\s+valor=\{logsTotal\}/,
    "o card de resumo precisa mostrar a contagem exata, não o tamanho do array de 100",
  );
  assert.doesNotMatch(
    codigo,
    /rotulo="Acessos registrados"\s+valor=\{logs\.length\}/,
    "voltou a usar logs.length (nunca passa de 100) como se fosse o total",
  );
});

test("I9: a lista de baixo continua honesta sobre mostrar só os últimos 100", () => {
  const codigo = src("app/src/modules/consentimento/PainelConformidade.jsx");
  assert.match(codigo, /últimos 100/, "o texto de apoio da trilha de acesso não deveria mudar");
  assert.match(codigo, /logs\.map\(/, "a lista em si continua iterando o array limitado (só o resumo usa a contagem exata)");
});

// ── Bloco 2 (T31): "sem atividade" ignora aluno de ciclo encerrado ──────────
const addDias = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

test("T31: sem semanasPorTrilha, adaptarResumoEscola mantém o comportamento antigo (só dias_7d)", () => {
  const [x] = adaptarResumoEscola([{ aluno_id: "a1", dias_7d: 0 }], { a1: { id: "a1", trilha_id: "t1" } });
  assert.equal(x.semAtividade, true, "sem dado de trilha, precisa continuar decidindo só por dias_7d (compat.)");
});

test("T31: aluno de ciclo ENCERRADO não conta como 'sem atividade' mesmo com dias_7d=0", () => {
  const semanasPorTrilha = { t1: [
    { numero: 1, inicio: "2020-01-01", fim: "2020-01-07" },
    { numero: 2, inicio: "2020-01-08", fim: "2020-01-14" },
  ] };
  const [x] = adaptarResumoEscola(
    [{ aluno_id: "a1", dias_7d: 0 }], { a1: { id: "a1", trilha_id: "t1" } }, semanasPorTrilha,
  );
  assert.equal(x.semAtividade, false, "ciclo encerrado não tem mais missão — não faz sentido contar como sem atividade");
});

test("T31: aluno com ciclo EM CURSO e dias_7d=0 continua contando como 'sem atividade'", () => {
  const hoje = todayISO();
  const semanasPorTrilha = { t1: [
    { numero: 1, inicio: addDias(hoje, -30), fim: addDias(hoje, -8) },
    { numero: 2, inicio: addDias(hoje, -7), fim: addDias(hoje, 7) },
  ] };
  const [x] = adaptarResumoEscola(
    [{ aluno_id: "a1", dias_7d: 0 }], { a1: { id: "a1", trilha_id: "t1" } }, semanasPorTrilha,
  );
  assert.equal(x.semAtividade, true, "o ciclo ainda está em curso — o alerta continua válido");
});

test("T31: aluno de trilha SEM semanas cadastradas (sem_semanas) também não é 'encerrado' — mantém dias_7d", () => {
  const [x] = adaptarResumoEscola(
    [{ aluno_id: "a1", dias_7d: 0 }], { a1: { id: "a1", trilha_id: "t1" } }, { t1: [] },
  );
  assert.equal(x.semAtividade, true, "trilha sem semanas é dado quebrado, não fim de ciclo (estadoDoCiclo: 'sem_semanas')");
});

test("T31: aluno com atividade na semana continua sem o selo, ciclo encerrado ou não", () => {
  const semanasPorTrilha = { t1: [{ numero: 1, inicio: "2020-01-01", fim: "2020-01-07" }] };
  const [x] = adaptarResumoEscola(
    [{ aluno_id: "a1", dias_7d: 3 }], { a1: { id: "a1", trilha_id: "t1" } }, semanasPorTrilha,
  );
  assert.equal(x.semAtividade, false);
});

test("T31: listarTrilhas embute as semanas de todas as trilhas (a coordenação precisa de todas em memória)", () => {
  const codigo = src("app/src/shared/data/index.js");
  assert.match(
    codigo,
    /trilha_semanas\(numero,\s*inicio,\s*fim\)/,
    "precisa embutir trilha_semanas na listagem de trilhas — não buscar uma trilha de cada vez",
  );
});

test("T31: AreaEscola.jsx monta o mapa de semanas por trilha e alimenta adaptarResumoEscola com ele", () => {
  const codigo = src("app/src/routes/escola/AreaEscola.jsx");
  assert.match(
    codigo,
    /adaptarResumoEscola\(\s*dados\.resumo,\s*alunosPorId,\s*semanasPorTrilha\s*\)/,
    "resumoLista precisa considerar o estado do ciclo de cada aluno (Painel, Turmas e Ranking reusam este resumo)",
  );
});

test("T31: adaptarResumoEscola expõe cicloEncerrado por aluno (não só semAtividade já filtrada)", () => {
  const [x] = adaptarResumoEscola(
    [{ aluno_id: "a1", dias_7d: 0 }], { a1: { id: "a1", trilha_id: "t1" } },
    { t1: [{ numero: 1, inicio: "2020-01-01", fim: "2020-01-07" }] },
  );
  assert.equal(x.cicloEncerrado, true, "quem monta uma proporção precisa do sinal cru, não só do semAtividade já combinado");
});

// ── Bloco 3 (T31): turma "em risco" por PROPORÇÃO, não por contagem > 0 ─────
test("T31: existe uma constante nomeada para o limiar de turma em risco (não mágica solta)", () => {
  const codigo = src("app/src/routes/escola/AreaEscola.jsx");
  assert.match(
    codigo,
    /const\s+PROPORCAO_TURMA_EM_RISCO\s*=\s*0\.3\s*;/,
    "o limiar de 30% precisa ser uma constante nomeada, não um 0.3 solto no meio do cálculo",
  );
});

test("T31: o cálculo de emRisco exclui ciclo encerrado do numerador E do denominador", () => {
  const codigo = src("app/src/routes/escola/AreaEscola.jsx");
  assert.match(
    codigo,
    /emCicloAtivo\s*=\s*linhas\.filter\(\(x\)\s*=>\s*!x\.cicloEncerrado\)/,
    "o denominador da proporção precisa excluir quem já encerrou o ciclo — senão uma turma formada dilui a proporção",
  );
  assert.match(
    codigo,
    /entrada\.emRisco\s*=\s*emCicloAtivo\.length\s*>\s*0\s*&&\s*entrada\.risco\s*\/\s*emCicloAtivo\.length\s*>\s*PROPORCAO_TURMA_EM_RISCO/,
    "emRisco precisa ser risco/emCicloAtivo acima do limiar, guardado contra divisão por zero",
  );
});

test("T31: o badge 'em risco' usa a proporção (emRisco), não mais qualquer contagem > 0", () => {
  const codigo = src("app/src/routes/escola/AreaEscola.jsx");
  assert.match(codigo, /\{s\.emRisco\s*&&\s*<span/, "o badge precisa depender de emRisco (proporção), não de s.risco > 0");
  assert.doesNotMatch(codigo, /\{s\.risco\s*>\s*0\s*&&\s*<span/, "voltou a disparar com qualquer contagem > 0");
});

// ── Bloco 4 (T33): cards de alerta zerados somem, e o título junto ──────────
test("T33: os três <Alerta> só renderizam quando a contagem é > 0", () => {
  const codigo = src("app/src/modules/desempenho/PainelGestao.jsx");
  for (const variavel of ["semAtividade", "semCredencial", "metaPendente"]) {
    assert.match(
      codigo,
      new RegExp(`\\{${variavel} > 0 && \\(\\s*<Alerta`),
      `o <Alerta> de ${variavel} precisa estar condicionado a ${variavel} > 0`,
    );
  }
});

test("T33: o título 'Alertas de risco' some quando os três estão zerados", () => {
  const codigo = src("app/src/modules/desempenho/PainelGestao.jsx");
  assert.match(
    codigo,
    /\{\(semAtividade > 0 \|\| semCredencial > 0 \|\| metaPendente > 0\) && \(/,
    "o bloco inteiro (título + alertas) precisa desaparecer quando todos os três estão em zero",
  );
});

// ── Bloco 5 (T32): "Destaques da semana" — janela mista no critério acerto ──
test("T32: o critério 'acerto' de Destaques da semana usa accSem (7d), não acc (vida inteira)", () => {
  const codigo = src("app/src/modules/desempenho/PainelGestao.jsx");
  const linhaAcerto = codigo.match(/acerto:\s*\{[^}]*\}/)[0];
  assert.match(
    linhaAcerto,
    /x\.accSem/,
    "os outros três critérios do mesmo seletor já são de 7 dias — acerto não pode ser o único de janela geral",
  );
  assert.doesNotMatch(
    linhaAcerto,
    /x\.acc\b/,
    "não pode sobrar nenhum x.acc (geral) no critério de acerto — só x.accSem",
  );
});

// ── Bloco 6 (T34/T35): ranking de ClassificacaoTurma.jsx ────────────────────
test("T34/T35: ClassificacaoTurma importa LIMIAR de niveisAluno.js", () => {
  const codigo = src("app/src/modules/desempenho/ClassificacaoTurma.jsx");
  assert.match(
    codigo,
    /import\s*\{\s*LIMIAR\s*\}\s*from\s*"\.\.\/conteudo\/niveisAluno\.js"/,
    "precisa importar o limiar de volume mínimo já exportado por niveisAluno.js",
  );
});

test("T34/T35: o critério padrão de ClassificacaoTurma passa a ser 'acerto' (era 'questoes')", () => {
  const codigo = src("app/src/modules/desempenho/ClassificacaoTurma.jsx");
  assert.match(codigo, /useState\("acerto"\)/, "o padrão do ranking da coordenação precisa ser acerto");
  assert.doesNotMatch(codigo, /useState\("questoes"\)/, "não pode sobrar o antigo padrão 'questoes'");
});

test("T34/T35: o ranking separa quem tem volume (>= LIMIAR.VOLUME_MINIMO) de quem não tem", () => {
  const codigo = src("app/src/modules/desempenho/ClassificacaoTurma.jsx");
  assert.match(
    codigo,
    /\.filter\(\(x\)\s*=>\s*x\.q\s*>=\s*LIMIAR\.VOLUME_MINIMO\)/,
    "lista numerada: só quem já passou do piso de volume na janela ativa",
  );
  assert.match(
    codigo,
    /\.filter\(\(x\)\s*=>\s*x\.q\s*<\s*LIMIAR\.VOLUME_MINIMO\)/,
    "grupo 'ainda sem dados suficientes': quem não passou",
  );
});

test("T34/T35: quem não tem volume suficiente é ordenado por nome, não pelo critério escolhido", () => {
  const codigo = src("app/src/modules/desempenho/ClassificacaoTurma.jsx");
  assert.match(
    codigo,
    /x\.q\s*<\s*LIMIAR\.VOLUME_MINIMO\)\s*\n?\s*\.sort\(\(x,\s*y\)\s*=>\s*x\.aluno\.nome\.localeCompare\(y\.aluno\.nome/,
    "o grupo sem dados suficientes precisa ordenar por nome (nunca inventar posição por um critério sem volume que a sustente)",
  );
});

test("T34/T35: a seção 'Ainda sem dados suficientes' existe e não numera essas linhas", () => {
  const codigo = src("app/src/modules/desempenho/ClassificacaoTurma.jsx");
  assert.match(codigo, /Ainda sem dados suficientes/, "precisa de um título discreto para o segundo grupo");
  assert.match(
    codigo,
    /posicao == null \? "" :/,
    "a linha sem posição não pode inventar um Nº nem cair numa medalha",
  );
});

test("T34/T35: PainelGestao.jsx não muda de critério padrão (já era 'acerto' antes deste bloco)", () => {
  const codigo = src("app/src/modules/desempenho/PainelGestao.jsx");
  assert.match(codigo, /useState\("acerto"\)/);
});
