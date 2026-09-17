// ============================================================
// ONDA 6 — TELAS DO ALUNO E DO RESPONSÁVEL (21 itens catalogados)
// ------------------------------------------------------------
// Mesmo padrão das ondas anteriores: o repo não sobe navegador nem
// renderiza React em CI, então estes testes travam as propriedades
// por INSPEÇÃO DE FONTE (ver onda1-cors-modais.test.mjs), com
// comentários removidos antes de casar os padrões — senão um
// comentário que MENCIONA o padrão errado (documentando o que foi
// corrigido) faria o teste passar sem o código estar certo.
//
// Cada bloco trava exatamente o que o bloco corrigiu — não mais, não
// menos — para que reverter o código de um item quebre só os testes
// dele. T15 e C7 não têm teste de comportamento aqui: T15 não teve
// correção de código (achado de dado de seed, não de UI — ver PR);
// C7 ganhou só um espaço defensivo sem efeito visual, coberto pelo
// teste de estrutura abaixo.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const ler = (p) => readFileSync(resolve(root, p), "utf8");
const semComentarios = (fonte) => fonte
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:\\])\/\/.*$/gm, "$1");
const src = (p) => semComentarios(ler(p));

// ── T4: hierarquia de ação — Concluir vira a ação com peso ──────────────────
test("T4: MetaSemana.jsx usa 'objective-confirm' para Concluir e 'objective-practice' para Praticar agora", () => {
  const codigo = src("app/src/modules/motor/MetaSemana.jsx");
  assert.match(
    codigo,
    /className=\{concluida \? "objective-secondary" : "objective-confirm"\}/,
    "o botão Concluir precisa usar a classe sólida (objective-confirm) quando não concluído",
  );
  assert.match(
    codigo,
    /className="objective-practice"[\s\S]{0,40}onClick=\{aoPraticar\}/,
    "Praticar agora precisa ficar com o contorno (objective-practice), não mais o peso sólido",
  );
});

test("T4: experiencia.css separa objective-confirm (sólido) de objective-practice (contorno)", () => {
  const css = src("app/src/shared/ui/experiencia.css");
  assert.match(
    css,
    /\.objective-confirm,\s*\n\.journey-confirmation-primary\s*\{/,
    "objective-confirm precisa herdar o estilo sólido antes usado só por journey-confirmation-primary",
  );
  assert.match(
    css,
    /\.objective-practice\s*\{[^}]*border:/,
    "objective-practice precisa ter seu próprio estilo de contorno (border), não o sólido",
  );
  assert.doesNotMatch(
    css,
    /\.objective-practice,\s*\n\.journey-confirmation-primary/,
    "objective-practice não pode mais compartilhar o estilo sólido com journey-confirmation-primary",
  );
});

// ── T5: última missão do plano cruza com 'atrasada' ──────────────────────────
test("T5: MetaHero.jsx cruza a última missão com o estado 'atrasada' antes de dizer 'boa prova'", () => {
  const codigo = src("app/src/modules/motor/MetaHero.jsx");
  assert.match(
    codigo,
    /atrasada\s*\?\s*"🏁 Última missão do plano — ainda há pendências\. Conclua os objetivos acima antes da prova\."\s*\n\s*:\s*"🏁 Última missão do plano — reta final\. Boa prova!"/,
    "a mensagem de última missão precisa ramificar por `atrasada`, não ser fixa",
  );
});

// ── T6: um nome só para o mesmo dado (m.totDone) ─────────────────────────────
test("T6: jargao.js troca 'alvos' por 'questoesTotal', e MetaHero.jsx usa o rótulo novo", () => {
  const jargao = src("app/src/modules/motor/jargao.js");
  assert.match(jargao, /questoesTotal:\s*"Questões resolvidas"/, "precisa existir o rótulo unificado questoesTotal");
  const hero = src("app/src/modules/motor/MetaHero.jsx");
  assert.match(hero, /rotulo=\{L\.questoesTotal\}\s+valor=\{m\.totDone\}/, "o StatCard de questões precisa usar L.questoesTotal, não mais 'Alvos atingidos'");
});

// ── T7: seta de evolução — sem alta/queda para variação zero ─────────────────
test("T7: Insights.jsx usa selo neutro ('▪') quando accTrend.delta é zero, não seta de alta", () => {
  const codigo = src("app/src/modules/desempenho/Insights.jsx");
  assert.match(
    codigo,
    /m\.accTrend\.delta > 0 \? "▲" : m\.accTrend\.delta < 0 \? "▼" : "▪"/,
    "delta === 0 precisa cair no símbolo neutro, não em '▲' (isso incluía delta>=0)",
  );
  assert.match(
    codigo,
    /m\.accTrend\.delta > 0 \? "ok" : m\.accTrend\.delta < 0 \? "risco" : "neutro"/,
    "o tom também precisa ser neutro (não 'ok') quando não houve variação",
  );
});

test("T7: InsightCard (componentes.jsx) trata tom='neutro' com cor própria (T.sub), não cai no dourado default", () => {
  const codigo = src("app/src/shared/ui/componentes.jsx");
  assert.match(
    codigo,
    /tom === "risco" \? T\.red : tom === "neutro" \? T\.sub : T\.gold/,
    "InsightCard precisa ramificar 'neutro' para T.sub explicitamente, em vez de cair no default dourado",
  );
});

// ── T8: RadarDesempenho não duplica os cards de insight ──────────────────────
test("T8: RadarDesempenho.jsx não importa nem renderiza mais InsightCard (duplicava Insights.jsx)", () => {
  const codigo = src("app/src/modules/desempenho/RadarDesempenho.jsx");
  assert.doesNotMatch(codigo, /InsightCard/, "os 4 InsightCards duplicados precisam ter sido removidos deste arquivo");
  assert.doesNotMatch(codigo, /minutosPorMateria/, "a função que só alimentava os cards removidos precisa ter sido removida junto");
  assert.match(codigo, /calcularInsights\(m\)/, "calcularInsights continua chamado só para o gate temDados");
});

// ── T11: medalhão de conquista bloqueada reage à proximidade ─────────────────
test("T11: Medalhao (Conquistas.jsx) recebe pct e usa conic-gradient proporcional quando bloqueado", () => {
  const codigo = src("app/src/modules/motor/Conquistas.jsx");
  assert.match(
    codigo,
    /function Medalhao\(\{ icone, ok, T, tam = 58, pct = 0 \}\)/,
    "Medalhao precisa aceitar pct como prop",
  );
  assert.match(
    codigo,
    /conic-gradient\(\$\{T\.gold\} \$\{pct\}%,\s*\$\{T\.line\} \$\{pct\}%\)/,
    "o anel externo precisa preencher proporcionalmente a pct via conic-gradient",
  );
  assert.match(codigo, /const quaseLa = pct >= 66;/, "precisa existir um limiar de proximidade que muda o tom do cadeado");
});

test("T11: os dois usos de Medalhao para conquistas bloqueadas passam pct", () => {
  const codigo = src("app/src/modules/motor/Conquistas.jsx");
  assert.match(codigo, /<Medalhao icone=\{c\.icone\} ok=\{ok\} T=\{T\} pct=\{pct\} \/>/, "a grade de conquistas precisa repassar pct calculado por item");
  assert.match(codigo, /<Medalhao icone=\{proxima\.icone\} ok=\{false\} T=\{T\} tam=\{44\} pct=\{pctProxima\} \/>/, "a faixa compacta (ConquistasRecentes) também precisa repassar pct da próxima conquista");
});

// ── T14: registros recentes viram campos discretos, não prosa corrida ───────
test("T14: RegistroRow (ListaRegistros.jsx) separa data/questões/acerto/minutos em selos, não uma string só", () => {
  const codigo = src("app/src/shared/ui/ListaRegistros.jsx");
  assert.doesNotMatch(
    codigo,
    /\{fmtBR\(String\(l\.data\)\)\} · \{l\.questoes\} questões/,
    "não pode mais concatenar os campos numa única string com ' · '",
  );
  assert.match(codigo, /<span className="num" style=\{selo\}>\{l\.questoes\} questões<\/span>/, "questões precisa ser um selo próprio");
  assert.match(codigo, /\{l\.minutos \? <span className="num" style=\{selo\}>\{l\.minutos\}min<\/span> : null\}/, "minutos precisa ser um selo próprio, condicional como antes");
});

// ── T16: 'não iniciada' distinta de 'parcial' no arquivo de semanas ──────────
test("T16: Arquivo.jsx distingue semana NÃO INICIADA de PARCIAL (feitas=0 e ignoradas=0)", () => {
  const codigo = src("app/src/modules/motor/Arquivo.jsx");
  assert.match(
    codigo,
    /const naoIniciada = !ativa && itens\.length > 0 && feitas === 0 && ignoradas === 0;/,
    "precisa existir a condição explícita de 'nada iniciado'",
  );
  assert.match(
    codigo,
    /const comPendencia = !ativa && !naoIniciada && pendentes > 0;/,
    "PARCIAL precisa excluir explicitamente o caso de nada iniciado",
  );
  assert.match(codigo, /<StatusBadge tom="neutro">NÃO INICIADA<\/StatusBadge>/, "precisa existir o selo visual do terceiro estado");
});

test("T16: Arquivo.jsx usa o StatusBadge compartilhado para os selos de estado da semana", () => {
  const codigo = src("app/src/modules/motor/Arquivo.jsx");
  assert.match(codigo, /import \{ Card, Empty, StatusBadge \} from "\.\.\/\.\.\/shared\/ui\/componentes\.jsx";/, "precisa importar StatusBadge do módulo compartilhado");
  assert.doesNotMatch(
    codigo,
    /background: T\.red, borderRadius: 5, padding: "2px 7px" \}\}>PARCIAL/,
    "o selo PARCIAL não pode mais ser um span hand-rolled — precisa vir do StatusBadge",
  );
});

// ── T18: cabeçalho da meta cita os adiados explicitamente ────────────────────
test("T18: MetaSemana.jsx computa 'adiados' e o cabeçalho cita os dois números que fecham", () => {
  const codigo = src("app/src/modules/motor/MetaSemana.jsx");
  assert.match(codigo, /const adiados = itens\.length - consideradas;/, "precisa existir a contagem explícita de adiados");
  assert.match(
    codigo,
    /const subObjetivos = `\$\{feitas\} de \$\{consideradas\} concluídos\$\{adiados > 0 \? ` · \$\{adiados\} \$\{adiados === 1 \? "adiado" : "adiados"\}` : ""\}`;/,
    "subObjetivos precisa citar os adiados quando existirem",
  );
  const usos = codigo.match(/sub=\{subObjetivos\}/g) ?? [];
  assert.equal(usos.length, 2, "os dois SectionCard (semana concluída e lista normal) precisam usar subObjetivos");
});

// ── T19 + T20: responsável — sem duplicar texto, com detalhe do que falta ────
test("T19: na semana zerada, o card abaixo do semáforo vira o detalhamento em vez de repetir a mesma constatação", () => {
  const codigo = src("app/src/modules/desempenho/ResumoResponsavel.jsx");
  // T39 (Onda 5) já fixou que o semáforo bifurca por `coord` e preserva
  // "um incentivo ajuda a retomar" para o público parental — não é esse
  // texto que muda. O que dobrava era o card LOGO ABAIXO, repetindo a
  // mesma constatação ("ainda não registrou estudos") com outras
  // palavras. Esse card passa a virar o detalhamento (T20) nesse caso.
  assert.match(codigo, /coord\s*\n?\s*\?\s*`\$\{primeiroNome\} ainda não estudou nesta semana\.`/, "T39 continua valendo: coord mantém a versão factual curta");
  assert.match(codigo, /um incentivo ajuda a retomar/, "T39 continua valendo: o texto parental original precisa continuar existindo");
  assert.match(
    codigo,
    /\{!encerrado && m\.diasSemana === 0 && pendentesDaSemana\.length > 0 \? \(/,
    "o card interpretativo precisa virar o detalhamento quando há o que detalhar, em vez de repetir a mesma frase do semáforo",
  );
});

test("T20: ResumoResponsavel.jsx detalha, em leitura, as atividades pendentes da semana zerada", () => {
  const codigo = src("app/src/modules/desempenho/ResumoResponsavel.jsx");
  assert.match(codigo, /const \[verPendencias, setVerPendencias\] = useState\(false\);/, "precisa existir estado local para expandir/recolher o detalhe");
  assert.match(
    codigo,
    /const pendentesDaSemana = itens\.filter\(\(x\) => x\.estado === "pendente"\);/,
    "precisa derivar as pendentes a partir do mesmo `itens` já usado na lista de baixo (sem novo fetch)",
  );
  assert.match(
    codigo,
    /const pendentesPorMateria = pendentesDaSemana\.reduce\(/,
    "precisa agrupar as pendências por matéria para o detalhamento",
  );
  assert.match(
    codigo,
    /\{!encerrado && m\.diasSemana === 0 && pendentesDaSemana\.length > 0 \? \(/,
    "o card expansível só deve substituir a frase quando a semana estiver zerada e houver o que detalhar",
  );
});

// ── T21 + T22: largura da área do responsável e grid de 5 cartões ───────────
test("T21: AreaResponsavel.jsx usa 'com-sidebar' e maxWidth 1080, como AreaAluno/AreaEscola", () => {
  const codigo = src("app/src/routes/responsavel/AreaResponsavel.jsx");
  assert.match(
    codigo,
    /<main className="com-sidebar" style=\{\{ maxWidth: 1080,/,
    "o <main> precisa ganhar a mesma classe/largura das outras duas áreas — hoje travava em 760px",
  );
});

test("T22: ResumoResponsavel.jsx reduz o mínimo do grid de 5 cartões da semana", () => {
  const codigo = src("app/src/modules/desempenho/ResumoResponsavel.jsx");
  assert.match(
    codigo,
    /gridTemplateColumns: "repeat\(auto-fit,minmax\(140px,1fr\)\)"/,
    "o grid de StatCards da semana precisa de um mínimo menor para os 5 caberem com mais folga",
  );
});

// ── T26: nomes truncados ganham title/aria no cabeçalho compartilhado ───────
test("T26: Cabecalho.jsx adiciona title ao h1, ao subtítulo e ao nome do usuário truncados", () => {
  const codigo = src("app/src/shared/ui/Cabecalho.jsx");
  assert.match(codigo, /<h1 className="disp hdr-title" title=\{escola\?\.nome \?\? titulo\}/, "o h1 (nome da escola) precisa ter title");
  assert.match(codigo, /<div title=\{subtitulo\} style=/, "o subtítulo (aluno/concurso/prova) precisa ter title");
  assert.match(codigo, /<span className="hdr-user" title=\{nomeUsuario\}/, "o nome do usuário logado precisa ter title");
});

// ── C1: linguagem neutra de dispositivo no arquivo de semanas ───────────────
test("C1: Arquivo.jsx não presume toque — usa linguagem neutra de dispositivo", () => {
  const codigo = src("app/src/modules/motor/Arquivo.jsx");
  assert.doesNotMatch(codigo, /Toque numa semana para ver os detalhes\./, "a instrução não pode mais presumir tela de toque");
  assert.match(codigo, /Selecione uma semana para ver os detalhes\./, "precisa haver uma instrução neutra no lugar");
});

// ── C3: placeholder da nota de redação vira dica de formato, não travessão ──
test("C3: SimuladoConcurso.jsx troca o placeholder '—' da nota de redação por '0'", () => {
  const codigo = src("app/src/modules/desempenho/SimuladoConcurso.jsx");
  const campoRedacao = codigo.slice(codigo.indexOf('label htmlFor={id("redacao")}'));
  assert.match(campoRedacao.slice(0, 300), /placeholder="0"/, "o campo de nota de redação precisa usar o mesmo padrão de placeholder dos campos de acerto ao lado");
  assert.doesNotMatch(campoRedacao.slice(0, 300), /placeholder="—"/, "o travessão não é dica de formato nenhuma");
});

// ── C4: toggle "+ Observação e data" ganha affordance de chevron ────────────
test("C4: Registrar.jsx troca +/− por chevron (▾/▴) no toggle de mais campos", () => {
  const codigo = src("app/src/modules/motor/Registrar.jsx");
  assert.match(codigo, /"Menos campos ▴" : "Observação e data ▾"/, "o texto do botão precisa usar chevron, não +/−");
  assert.doesNotMatch(codigo, /"− Menos campos" : "\+ Observação e data"/, "a versão antiga com +/− não pode mais existir");
  assert.match(codigo, /aria-expanded=\{maisCampos\}/, "o botão de disclosure precisa anunciar o estado via aria-expanded");
});

// ── C5: título de nível por matéria reage à confiança consolidada ──────────
test("C5: Niveis.jsx troca o título para 'Nível por matéria' quando todas as matérias firmaram (ALTA)", () => {
  const codigo = src("app/src/modules/desempenho/Niveis.jsx");
  assert.match(
    codigo,
    /const todasFirmes = comDado\.length > 0 && comDado\.every\(\(l\) => l\.confianca === CONFIANCA\.ALTA\);/,
    "precisa existir a condição de todas as matérias com dado terem confiança ALTA",
  );
  assert.match(
    codigo,
    /titulo=\{todasFirmes \? "Nível por matéria" : "Estimativa inicial de nível por matéria"\}/,
    "o título da seção precisa reagir a todasFirmes, em vez de ficar fixo em 'inicial'",
  );
});

// ── C7: separador defensivo entre as duas linhas do h1 público ─────────────
test("C7: Login.jsx tem um espaço explícito entre as duas linhas do título (defensivo, sem mudar o visual)", () => {
  const codigo = src("app/src/routes/publico/Login.jsx");
  assert.match(
    codigo,
    /Sua prova tem um alvo\.[\s\S]*?<\/m\.span>\s*<\/span>\{" "\}[\s\S]*?<span className="login-title-line">/,
    "precisa haver um espaço explícito entre as duas <span className=\"login-title-line\"> — hoje a separação depende só do CSS (display:block)",
  );
});

// ── C10: peça de conformidade não afirma "menores" categoricamente ─────────
test("C10: PainelConformidade.jsx troca 'Os alunos são menores de idade' por uma afirmação que admite exceção", () => {
  const codigo = src("app/src/modules/consentimento/PainelConformidade.jsx");
  assert.doesNotMatch(codigo, /Os alunos são <b[^>]*>menores de idade<\/b>/, "a afirmação categórica é falsa para EsPCEx (até 21) e EsSA (até 24)");
  assert.match(codigo, /A maior parte dos alunos é <b[^>]*>menor de idade<\/b>/, "precisa existir a redação que admite exceção");
});
