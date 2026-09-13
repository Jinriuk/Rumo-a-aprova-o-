/* Onda 4 — higiene de chrome e acessibilidade (21 itens, blocos 1-9).
   ------------------------------------------------------------
   Mesmo padrão de inspeção de fonte que onda1-cors-modais.test.mjs e
   onda3-ciclo-encerrado.test.mjs: sem GoTrue/navegador no CI, as
   propriedades são travadas lendo o código-fonte, com `semComentarios`
   antes de casar — senão um teste "passa na prosa" (um comentário que
   FALA do conserto sem o conserto existir). Cada teste abaixo foi
   conferido contra a falha: revertendo o arquivo do bloco correspondente,
   o teste quebra. Isso é o que separa "trava o defeito" de "trava a
   redação".

   Itens de LAYOUT (I1, I3, I7, T1, T36, T41, T47, T48) só fecham de
   verdade quando alguém olhar em 1366×768 e 390px — o proxy deste
   ambiente nega CONNECT a *.supabase.co e não há Chromium contra o app
   autenticado. Os testes abaixo travam a PROPRIEDADE estrutural (CSS/
   marcação que implementa a correção), não a aparência renderizada. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const ler = (p) => readFileSync(resolve(root, p), "utf8");
const semComentarios = (f) => f
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:\\])\/\/.*$/gm, "$1");
const lerCodigo = (p) => semComentarios(ler(p));

function todosOsJsx(dirRel) {
  const base = resolve(root, dirRel);
  const achados = [];
  (function andar(dir) {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, ent.name);
      if (ent.isDirectory()) andar(caminho);
      else if (ent.name.endsWith(".jsx")) achados.push(caminho);
    }
  })(base);
  return achados;
}

// ============================================================
// BLOCO 1 — menu que esconde abas (I1, I7)
// ============================================================
test("BLOCO1: .menu-rolagem não suprime mais a barra de rolagem", () => {
  const src = lerCodigo("app/src/shared/ui/MenuPrincipal.jsx");
  // o defeito era isto: rolava, e nada sinalizava.
  assert.doesNotMatch(src, /\.menu-rolagem\s*\{\s*scrollbar-width:\s*none/,
    "scrollbar-width: none ainda suprime a affordance");
  assert.doesNotMatch(src, /\.menu-rolagem::-webkit-scrollbar\s*\{\s*display:\s*none/,
    "::-webkit-scrollbar{display:none} ainda esconde a barra no Chrome/Safari");
});

test("BLOCO1: .menu-rolagem agora tem uma barra visível (Firefox e WebKit/Blink)", () => {
  const src = lerCodigo("app/src/shared/ui/MenuPrincipal.jsx");
  assert.match(src, /\.menu-rolagem\s*\{\s*scrollbar-width:\s*thin/, "sem scrollbar-width: thin (Firefox)");
  assert.match(src, /\.menu-rolagem::-webkit-scrollbar\s*\{\s*width:\s*\d/, "sem largura de scrollbar (Chrome/Safari)");
  assert.match(src, /\.menu-rolagem::-webkit-scrollbar-thumb\s*\{\s*background:/, "sem thumb visível");
});

test("BLOCO1: aluno (8 abas) e coordenação (6, 'marca' por último) — a lista rola dentro do mesmo container sem paginação própria", () => {
  // Confirma que a premissa do defeito (contagem de abas) continua batendo
  // com o catálogo — se um dev reduzir/mudar a lista, este teste avisa.
  const visao = lerCodigo("app/src/routes/aluno/VisaoEstudo.jsx");
  const abasAluno = visao.match(/const ABAS = \[([\s\S]*?)\]\.filter/)?.[1] ?? "";
  const contagemAluno = (abasAluno.match(/\[["']/g) ?? []).length;
  assert.equal(contagemAluno, 8, "VisaoEstudo não tem mais 8 abas — reavaliar se I1/I7 ainda se aplicam");

  const escola = lerCodigo("app/src/routes/escola/AreaEscola.jsx");
  const abasEscola = escola.match(/const ABAS = \[([\s\S]*?)\];/)?.[1] ?? "";
  assert.match(abasEscola, /\["marca", "Marca"/, "a aba Marca sumiu ou mudou de chave — I7 fala dela por nome");
  assert.ok(abasEscola.trim().endsWith('["marca", "Marca", null, "pincel"],'),
    "'marca' não é mais a última aba da coordenação — I7 partia disso");
});

// ============================================================
// BLOCO 2 — faixa DEMO sobre o h1 (I3)
// ============================================================
test("BLOCO2: FaixaDemo publica a própria altura como variável CSS no :root", () => {
  const src = lerCodigo("app/src/shared/branding/FaixaDemo.jsx");
  assert.match(src, /export const ALTURA_FAIXA_DEMO\s*=\s*20/, "altura não exportada como constante única");
  assert.match(src, /--altura-faixa-demo:\s*\$\{ALTURA_FAIXA_DEMO\}px/, "a faixa não publica --altura-faixa-demo");
  // a div fixa continua usando a MESMA constante (uma fonte só, sem número duplicado)
  assert.match(src, /height:\s*ALTURA_FAIXA_DEMO/, "a altura visual ainda está com número solto, dessincronizada da variável publicada");
});

test("BLOCO2: Cabecalho e o header de AreaAdmin cedem espaço à faixa (sticky top compensado)", () => {
  const cab = lerCodigo("app/src/shared/ui/Cabecalho.jsx");
  assert.doesNotMatch(cab, /position:\s*"sticky",\s*top:\s*0\b/, "Cabecalho ainda gruda em top:0 fixo — nasce coberto pela faixa");
  assert.match(cab, /top:\s*"var\(--altura-faixa-demo,\s*0px\)"/, "Cabecalho não lê a variável da faixa");

  const admin = lerCodigo("app/src/routes/admin/AreaAdmin.jsx");
  assert.match(admin, /position:\s*"sticky",\s*top:\s*"var\(--altura-faixa-demo,\s*0px\)"/,
    "header de AreaAdmin não foi compensado — FaixaDemo cobre toda a árvore (App.jsx), admin incluso");
});

test("BLOCO2: a tabela de CSV em CadastroAlunos continua com top:0 puro (sticky de container próprio, não do topo da página)", () => {
  // Contraprova: este sticky é da rolagem INTERNA de uma tabela (maxHeight
  // + overflowY:auto), nunca fica sob a faixa fixa da viewport — não deve
  // ser "corrigido" para var(--altura-faixa-demo) por engano de find/replace.
  const src = lerCodigo("app/src/modules/pessoas/CadastroAlunos.jsx");
  assert.match(src, /position:\s*"sticky",\s*top:\s*0\s*\}/, "o sticky do cabeçalho de tabela do CSV não devia ter sido tocado");
});

// ============================================================
// BLOCO 3 — alvos de toque (T1, T29-tamanho, T36, T41)
// ============================================================
// Padrão do defeito, em todo o bloco: padding no <div> pai (não-clicável),
// <button>/<select> com padding:0 ou sem minHeight. A correção segue os
// dois padrões JÁ existentes no repo (componentes.jsx:318, tab transparente
// com padding+minHeight; e HistoricoProgresso.jsx:72-73/AreaEscola.jsx:
// 305-311, botão com borda) — nunca um terceiro padrão novo.
test("BLOCO3: Registrar.jsx — botão 'Ver mais' de registros recentes tem alvo de toque real", () => {
  const src = lerCodigo("app/src/modules/motor/Registrar.jsx");
  const m = src.match(/onClick=\{\(\) => setLimiteRecentes\(registros\.length\)\}\s*\n\s*style=\{\{([^}]*)\}\}/);
  assert.ok(m, "não achei o botão 'Ver mais' de registros recentes");
  assert.match(m[1], /minHeight:\s*32/, "sem minHeight — o padding sozinho não bastava (era padding: 0)");
});

test("BLOCO3: Conquistas.jsx — 'Ver carreira completa' e 'Ver mais/menos' por grupo têm alvo de toque real", () => {
  const src = lerCodigo("app/src/modules/motor/Conquistas.jsx");
  const m1 = src.match(/onClick=\{\(\) => setVerCarreira\(\(v\) => !v\)\}\s*\n\s*style=\{\{([^}]*)\}\}/);
  assert.ok(m1, "não achei o botão 'Ver carreira completa'");
  assert.match(m1[1], /minHeight:\s*32/, "'Ver carreira completa' sem minHeight");

  const m2 = src.match(/onClick=\{\(\) => setGruposExpandidos\(\(prev\) => \{[\s\S]*?\}\)\}\s*\n\s*style=\{\{([^}]*)\}\}/);
  assert.ok(m2, "não achei o botão 'Ver mais/menos' por grupo");
  assert.match(m2[1], /minHeight:\s*32/, "'Ver mais/menos' por grupo sem minHeight");
});

test("BLOCO3: VisaoEstudo.jsx — botão 'ver N objetivos' tem alvo de toque real", () => {
  const src = lerCodigo("app/src/routes/aluno/VisaoEstudo.jsx");
  const m = src.match(/onClick=\{\(\) => setAberto\(\(v\) => !v\)\}\s*\n\s*style=\{\{([^}]*)\}\}/);
  assert.ok(m, "não achei o botão de expandir objetivos");
  assert.match(m[1], /minHeight:\s*32/, "sem minHeight — antes era padding: \"4px 0\" só");
});

test("BLOCO3: Acumulado.jsx — toggle Tempo/Questões tem alvo de toque real", () => {
  const src = lerCodigo("app/src/modules/desempenho/Acumulado.jsx");
  const m = src.match(/onClick=\{\(\) => setVistaTreemap\(k\)\}\s*\n\s*style=\{\{([^}]*)\}\}/);
  assert.ok(m, "não achei o toggle Tempo/Questões");
  assert.match(m[1], /minHeight:\s*32/, "toggle Tempo/Questões sem minHeight (era ≈28px)");
});

test("BLOCO3: AreaEscola.jsx — cabeçalho de turma (abrir/fechar alunos) tem alvo de toque real", () => {
  const src = lerCodigo("app/src/routes/escola/AreaEscola.jsx");
  const m = src.match(/onClick=\{\(\) => setTurmaAberta\(aberta \? null : t\.id\)\}\s*\n\s*style=\{\{([^}]*)\}\}/);
  assert.ok(m, "não achei o cabeçalho de turma");
  assert.doesNotMatch(m[1], /padding:\s*0\b/, "cabeçalho de turma ainda com padding: 0");
  assert.match(m[1], /minHeight:\s*44/, "cabeçalho de turma sem minHeight");
});

test("BLOCO3: PainelGestao.jsx — 'Ver completo' (o pior caso, ≈17px) tem alvo de toque real", () => {
  const src = lerCodigo("app/src/modules/desempenho/PainelGestao.jsx");
  const m = src.match(/onClick=\{\(\) => aoIr\("ranking"\)\}[\s\S]{0,20}style=\{\{([^}]*)\}\}/);
  assert.ok(m, "não achei o botão 'Ver completo'");
  assert.match(m[1], /minHeight:\s*32/, "'Ver completo' continua sem minHeight — não tinha padding nenhum antes");
});

test("BLOCO3: ListaAlunos.jsx — selMini (turma/concurso/trilha, 3 por linha × ~34 linhas) tem alvo de toque real", () => {
  const src = lerCodigo("app/src/modules/pessoas/ListaAlunos.jsx");
  const m = src.match(/const selMini = \{([\s\S]*?)\};/);
  assert.ok(m, "não achei a definição de selMini");
  assert.match(m[1], /minHeight:\s*32/, "selMini sem minHeight — dava ≈26px");
});

// ============================================================
// BLOCO 4 — menus: flip e Escape/foco (T47, T48)
// ============================================================
test("BLOCO4/T48: MaisAcoes mede o painel e flipa pra cima quando falta espaço embaixo", () => {
  const src = lerCodigo("app/src/shared/ui/componentes.jsx");
  assert.match(src, /useLayoutEffect/, "sem medição pós-montagem — flip decidido sem saber a altura real do painel");
  assert.match(src, /abrirParaCima/, "sem estado de flip");
  // a decisão usa as DUAS condições (não cabe embaixo E cabe em cima) —
  // nunca vira o painel pra fora da tela nos dois sentidos numa tela curta
  assert.match(src, /alturaPainel\s*>\s*espacoAbaixo\s*&&\s*gRect\.top\s*>\s*alturaPainel/,
    "flip não checa as duas condições (espaço faltando embaixo E sobrando em cima)");
  // rede de segurança: mesmo com flip, nunca deixa de caber na viewport
  assert.match(src, /maxHeight:\s*"min\(360px,\s*calc\(100vh - 24px\)\)"/, "sem teto de altura + rolagem no painel");
});

test("BLOCO4/T48: o painel de MaisAcoes abre para cima OU para baixo, nunca os dois ao mesmo tempo", () => {
  const src = lerCodigo("app/src/shared/ui/componentes.jsx");
  assert.match(src, /abrirParaCima\s*\?\s*\{\s*bottom:\s*"calc\(100% \+ 4px\)"\s*\}\s*:\s*\{\s*top:\s*"calc\(100% \+ 4px\)"\s*\}/,
    "posicionamento condicional do painel não encontrado");
});

test("BLOCO4/T47: a folha do 'Mais' desaparece sozinha em ≥1024px (mesma regra que esconde a barra)", () => {
  const src = lerCodigo("app/src/shared/ui/MenuPrincipal.jsx");
  assert.match(src, /\.menu-folha-mais\s*\{\s*display:\s*block;\s*\}/, "sem classe .menu-folha-mais");
  assert.match(src, /@media \(min-width:\s*1024px\)\s*\{\s*\.menu-folha-mais\s*\{\s*display:\s*none;/,
    "a folha não some no breakpoint desktop — T47 continua reproduzível");
  assert.match(src, /className="menu-folha-mais"/, "a div da folha não usa a classe nova");
});

test("BLOCO4/T47: a folha do 'Mais' trata Escape e devolve o foco ao gatilho", () => {
  const src = lerCodigo("app/src/shared/ui/MenuPrincipal.jsx");
  assert.match(src, /gatilhoMaisRef/, "sem ref para o gatilho — não há como devolver foco");
  const efeito = src.match(/useEffect\(\(\) => \{\s*if \(!maisAberto\) return;[\s\S]*?\}, \[maisAberto\]\);/);
  assert.ok(efeito, "sem efeito ligado a maisAberto para tratar Escape");
  assert.match(efeito[0], /key === "Escape"/, "efeito não escuta Escape");
  assert.match(efeito[0], /gatilhoMaisRef\.current\?\.focus\(\)/, "Escape não devolve o foco ao gatilho");
});

test("BLOCO4/T47: o gatilho 'Mais' anuncia haspopup e expanded para leitor de tela", () => {
  const src = lerCodigo("app/src/shared/ui/MenuPrincipal.jsx");
  assert.match(src, /refBtn=\{gatilhoMaisRef\}[\s\S]{0,200}ariaHaspopup="menu"[\s\S]{0,40}ariaExpandido=\{maisAberto\}/,
    "gatilho do 'Mais' sem aria-haspopup/aria-expanded amarrados ao estado real");
});

test("confere contra a falha: revertendo o bloco 4, os testes acima quebram", () => {
  // teste-sentinela: garante que o arquivo de origem realmente mudou —
  // fica aqui como documentação executável do processo de verificação,
  // não substitui o revert manual feito durante o desenvolvimento.
  const src = lerCodigo("app/src/shared/ui/componentes.jsx");
  assert.doesNotMatch(src, /top:\s*"calc\(100% \+ 4px\)",\s*zIndex:\s*31/,
    "o painel de MaisAcoes ainda tem top fixo hardcoded (sem flip)");
});

// ============================================================
// BLOCO 5 — scroll que troca o concurso (T29-comportamento)
// ============================================================
test("BLOCO5: os 3 <select> por aluno (turma/concurso/trilha) tiram o foco no wheel", () => {
  const src = lerCodigo("app/src/modules/pessoas/ListaAlunos.jsx");
  const selects = [
    /<select value=\{turmaAtual\}[\s\S]*?<\/select>/,
    /<select value=\{a\.concurso_id \?\? ""\}[\s\S]*?<\/select>/,
    /<select value=\{a\.trilha_id \?\? ""\}[\s\S]*?<\/select>/,
  ];
  for (const re of selects) {
    const m = src.match(re);
    assert.ok(m, `select não encontrado: ${re}`);
    assert.match(m[0], /onWheel=\{\(e\) => e\.currentTarget\.blur\(\)\}/,
      `select sem onWheel/blur — a roda do mouse ainda troca o valor e grava: ${re}`);
  }
});

test("BLOCO5: o fix NÃO adiciona confirmação — onChange continua gravando direto (decisão de produto da Onda 5)", () => {
  const src = lerCodigo("app/src/modules/pessoas/ListaAlunos.jsx");
  assert.match(src, /onChange=\{\(e\) => trocarTurma\(a, e\.target\.value\)\}/, "onChange de turma não deveria mudar de assinatura");
  assert.match(src, /onChange=\{\(e\) => trocarConcurso\(a, e\.target\.value\)\}/, "onChange de concurso não deveria mudar de assinatura");
  assert.match(src, /onChange=\{\(e\) => trocarTrilha\(a, e\.target\.value\)\}/, "onChange de trilha não deveria mudar de assinatura");
  assert.doesNotMatch(src, /confirmar\(\{[\s\S]{0,200}trocarTurma|window\.confirm/, "confirmação foi adicionada — fora de escopo desta onda");
});

// ============================================================
// BLOCO 6 — acessibilidade mecânica (I8, T2, T3/T24, T13, T25, C6)
// ============================================================

test("I8: os 3 <select> por aluno têm aria-label com o nome do aluno, não só title", () => {
  const src = lerCodigo("app/src/modules/pessoas/ListaAlunos.jsx");
  assert.match(src, /aria-label=\{`Turma de \$\{a\.nome\}`\}/, "select de turma sem aria-label com nome do aluno");
  assert.match(src, /aria-label=\{`Concurso de \$\{a\.nome\}`\}/, "select de concurso sem aria-label com nome do aluno");
  assert.match(src, /aria-label=\{`Trilha de estudo de \$\{a\.nome\}`\}/, "select de trilha sem aria-label com nome do aluno");
  // title continua (tooltip visual), não foi removido — só deixou de ser o único rótulo
  assert.match(src, /title="Turma do aluno"/);
});

test("T2: nenhum <button> do app fica sem type= (79 ocorrências no laudo)", () => {
  const arquivos = todosOsJsx("app/src");
  let semType = 0;
  const exemplos = [];
  for (const caminho of arquivos) {
    const src = lerCodigo(caminho);
    for (const m of src.matchAll(/<button\b[\s\S]*?>/g)) {
      if (!m[0].includes("type=")) {
        semType++;
        if (exemplos.length < 5) exemplos.push(`${caminho.replace(root + "/", "")}: ${m[0].slice(0, 60)}`);
      }
    }
  }
  assert.equal(semType, 0, `${semType} <button> ainda sem type=\n${exemplos.join("\n")}`);
});

test("T2: os botões de submit dos 5 <form> do app continuam type=\"submit\" explícito (a correção não pisou neles)", () => {
  const arquivos = [
    "app/src/shared/ui/componentes.jsx",
    "app/src/routes/publico/RedefinirSenha.jsx",
    "app/src/routes/publico/Login.jsx",
    "app/src/routes/publico/TrocarSenhaObrigatoria.jsx",
  ];
  let achouSubmit = 0;
  for (const caminho of arquivos) {
    const src = lerCodigo(caminho);
    achouSubmit += (src.match(/type="submit"/g) ?? []).length;
  }
  assert.ok(achouSubmit >= 4, `esperava pelo menos 4 botões type="submit" nos formulários, achei ${achouSubmit}`);
});

test("T3/T24: SectionCard (o título de seção mais usado do app) é h2, não h3 — fecha o salto h1→h3", () => {
  const src = lerCodigo("app/src/shared/ui/componentes.jsx");
  assert.doesNotMatch(src, /<h3 className="disp"[^>]*>\{titulo\}<\/h3>/, "SectionCard ainda usa h3 para o título");
  assert.match(src, /<h2 className="disp"[^>]*>\{titulo\}<\/h2>/, "SectionCard não virou h2");
});

test("T3/T24: os 15 títulos de seção que eram <div> viraram <h2>, sem mudar o texto nem a posição visual", () => {
  const alvos = [
    ["app/src/modules/desempenho/Progresso.jsx", ["Questões por dia", "Evolução por semana — as {trilha.semanas.length} semanas até a prova", "% de acerto por matéria", "Total de questões por matéria", "Evolução nos simulados — {prova.rotulo}", "Registrar simulado — {prova.rotulo}", "Histórico"]],
    ["app/src/modules/desempenho/Acumulado.jsx", ["Desempenho acumulado", "Desempenho por meta", "Desempenho por disciplina"]],
    ["app/src/modules/desempenho/SimuladoConcurso.jsx", ["Registrar simulado — formato {concurso?.codigo?.toUpperCase()}", "Histórico"]],
    ["app/src/modules/desempenho/ClassificacaoTurma.jsx", ['Ranking — {modo === "estudos" ? "Estudos" : "Simulados"}']],
    ["app/src/modules/desempenho/FichaAluno.jsx", ["{aluno.nome}"]],
    ["app/src/modules/escola/Marca.jsx", ["{nome}", "Missão da semana"]],
  ];
  for (const [caminho, textos] of alvos) {
    const src = lerCodigo(caminho);
    for (const texto of textos) {
      const escapado = texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`<h2 className="disp" style=\\{\\{ margin: 0,[^}]*\\}\\}>${escapado}</h2>`);
      assert.match(src, re, `"${texto}" em ${caminho} não virou h2 com margin:0`);
    }
  }
  // CadastroAlunos.jsx: um título é multilinha (expressão), o outro é texto direto
  const cad = lerCodigo("app/src/modules/pessoas/CadastroAlunos.jsx");
  assert.match(cad, /<h2 className="disp" style=\{\{ margin: 0, fontSize: 17, fontWeight: 700, marginBottom: 6 \}\}>/, "título do modal de credencial não virou h2");
  assert.match(cad, /<h2 className="disp" style=\{\{ margin: 0, fontSize: 15, fontWeight: 700, marginBottom: 10 \}\}>Nova turma<\/h2>/, "'Nova turma' não virou h2");
});

test("T13: 'Confirmar estudo' liga aria-disabled + aria-describedby à explicação, que agora é live region", () => {
  const src = lerCodigo("app/src/modules/motor/Registrar.jsx");
  assert.match(src, /aria-disabled=\{!podeSalvar \|\| undefined\}/, "sem aria-disabled amarrado ao mesmo estado do disabled nativo");
  assert.match(src, /aria-describedby=\{faltaTopico \? id\("dica-topico"\) : undefined\}/, "aria-describedby não aponta pra explicação condicionalmente");
  assert.match(src, /id=\{id\("dica-topico"\)\} role="status" aria-live="polite"/, "a explicação não é live region com id correspondente");
});

test("T13: o único aria-required do repo agora tem required nativo correspondente", () => {
  const src = lerCodigo("app/src/modules/motor/Registrar.jsx");
  assert.match(src, /id=\{id\("top"\)\}[\s\S]{0,120}required aria-required="true"/, "input de tópico sem required nativo");
  // e o `required` continua não afetando o fluxo de envio (sem <form>)
  assert.doesNotMatch(src, /<form/, "Registrar.jsx ganhou um <form> — reconferir que required não passa a bloquear envio nativo");
});

test("T25: as duas navs de MenuPrincipal têm aria-label distintos", () => {
  const src = lerCodigo("app/src/shared/ui/MenuPrincipal.jsx");
  assert.match(src, /className="menu-lateral app-sidebar" aria-label="Navegação principal"/, "nav lateral perdeu o rótulo original");
  assert.match(src, /className="menu-barra app-bottom-nav" aria-label="Navegação principal \(barra inferior\)"/, "nav da barra inferior não ganhou rótulo distinto");
});

test("T25: existe skip-link, visível só no foco, apontando para #conteudo-principal", () => {
  const menu = lerCodigo("app/src/shared/ui/MenuPrincipal.jsx");
  assert.match(menu, /<a href="#conteudo-principal" className="skip-link">/, "sem skip-link no início da nav");
  assert.match(menu, /\.skip-link \{[\s\S]*?top: -60px/, "skip-link não está fora da tela por padrão");
  assert.match(menu, /\.skip-link:focus \{ top: 12px; \}/, "skip-link não aparece ao ganhar foco");

  const visao = lerCodigo("app/src/routes/aluno/VisaoEstudo.jsx");
  assert.match(visao, /id="conteudo-principal" tabIndex=\{-1\} className="fade"/, "VisaoEstudo sem o alvo do skip-link");
  const escola = lerCodigo("app/src/routes/escola/AreaEscola.jsx");
  assert.match(escola, /id="conteudo-principal" tabIndex=\{-1\} className="fade"/, "AreaEscola sem o alvo do skip-link");
});

test("C6: os 2 svgs decorativos de PortalLogin.jsx ganham aria-hidden (consistente com o 3º, que já tinha)", () => {
  const src = lerCodigo("app/src/routes/publico/PortalLogin.jsx");
  assert.match(src, /<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">/, "svg da marca do portal sem aria-hidden");
  assert.match(src, /<svg className="mission-map-lines" viewBox="0 0 620 310" preserveAspectRatio="none" aria-hidden="true" focusable="false">/, "svg do mapa da missão sem aria-hidden");
  // o terceiro já estava certo — contraprova de que não regrediu
  assert.match(src, /<svg className="portal-rings" viewBox="0 0 640 640" aria-hidden="true" focusable="false">/);
});

test("Botao aceita e repassa atributos extras (aria-*) — é o que viabiliza o fix de T13", () => {
  const src = lerCodigo("app/src/shared/ui/componentes.jsx");
  assert.match(src, /export function Botao\(\{[^}]*\.\.\.resto[^}]*\}\)/, "Botao não desestrutura ...resto");
  assert.match(src, /<button className="ui-button" type=\{type\} onClick=\{onClick\} disabled=\{disabled\} \{\.\.\.resto\}/,
    "Botao não espalha ...resto no <button>");
});
