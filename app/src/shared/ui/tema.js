import { clarearAteRazao, razaoContraste, luminanciaRelativa, HEX_VALIDO } from "./contraste.js";

/* Sistema de design FIXO (Doc 6, 1.2), herdado da versão atual:
   navy #0A1622, dourado #CDA349, Fraunces/Archivo. O white-label
   é leve: a escola troca logo, nome e a COR DE ACENTO — nada mais. */

const CARD_HI = "#173050";

/* T23/C11 — o vermelho original (#D9695E) media 3,894:1 como texto sobre
   cardHi (a mais clara das superfícies fixas — mesmo raciocínio de
   SUPERFICIE_CRITICA logo abaixo, calculado aqui antes de BASE existir
   porque BASE.cardHi ainda não está definido neste ponto do módulo).
   Abaixo de 4,5:1 em ~49 lugares do app (T.red usado direto em `color:`
   — badge de risco, erro de validação, "sem atividade", etc.): não é um
   ponto fora da curva, é o TOKEN falhando no papel de texto.

   Corrigido pelo token, não por um `redText` paralelo: T.red também é
   FUNDO em vários lugares (badge "PARCIAL" com #0A1622 por cima, botão
   de perigo canônico, bordas translúcidas ${T.red}44/55/66) — um
   segundo token exigiria migrar caso a caso e deixa margem pra alguém
   voltar a usar T.red como texto por engano. Clarear o token resolve
   os dois papéis de uma vez: como FUNDO, luminância mais alta contra
   um texto tão escuro (#0A1622) só melhora o contraste, nunca piora.

   Mesmo algoritmo do acento (clarearAteRazao, OKLCh — a escolha de
   espaço está justificada em contraste.js) — matiz e croma saem quase
   intactos (a distância até 4,5:1 é pequena; o clareamento é sutil). */
const RED = clarearAteRazao("#D9695E", CARD_HI, 4.5);

export const BASE = {
  bg: "#0A1622",
  bg2: "#0E1F30",
  card: "#12273B",
  cardHi: CARD_HI,
  line: "#1E3A55",
  ink: "#EAF1F8",
  sub: "#8AA4BC",
  gold: "#CDA349",
  goldSoft: "#3a3320",
  green: "#4FB477",
  red: RED,
};

/* ── Legibilidade da cor de acento (I12) ──────────────────────────
   A escola escolhe a cor; o sistema garante que ela dê para ler. O
   acento aparece em DOIS papéis, e os dois precisam de 4,5:1:

     a) como TEXTO sobre as superfícies escuras do tema;
     b) como FUNDO de botão, com texto #0A1622 por cima
        (componentes.jsx, `Botao`).

   O papel (a) é o vinculante. Medido: exigir 4,5:1 como texto pede
   luminância relativa ≥ 0,327; como fundo de botão pede ≥ 0,209. Os
   dois são pisos, então quem satisfaz (a) satisfaz (b) de graça —
   não há conflito entre os papéis, há um piso só.

   QUAL superfície manda: a MAIS CLARA, porque é contra ela que um
   acento claro tem a menor razão. Não é `card`, e não é `cardHi`:
   é `goldSoft` (#3a3320, L=0,0337 > cardHi 0,0288). `goldSoft` NÃO
   é re-tematizado pela escola e serve de fundo para texto no acento
   em Cronometro.jsx (botão "Pausar": background goldSoft, color gold).
   `line` (#1E3A55) é mais clara ainda, mas nunca recebe texto no
   acento — só texto em `sub` e divisórias —, então não restringe.
   Quem passar a usar o acento sobre `line` precisa entrar aqui. */
export const SUPERFICIES_DO_ACENTO = [BASE.bg, BASE.bg2, BASE.card, BASE.cardHi, BASE.goldSoft];

/* A mais clara das superfícies acima = a restrição mais apertada. */
export const SUPERFICIE_CRITICA = SUPERFICIES_DO_ACENTO
  .reduce((pior, s) => (luminanciaRelativa(s) > luminanciaRelativa(pior) ? s : pior));

/* WCAG 2.x 1.4.3 (Contrast Minimum), texto normal. */
export const RAZAO_MINIMA = 4.5;

/* Substitui o antigo `luminancia(cor) < 0.32`, que estava duplicado
   aqui e em Marca.jsx. O limiar agora é UM só e mora no algoritmo:
   "precisa clarear" é exatamente "não alcança RAZAO_MINIMA contra a
   superfície crítica" — a mesma pergunta que garantirLegivel faz. */
export function precisaClarear(hex) {
  if (!HEX_VALIDO.test(hex)) return false;
  return razaoContraste(hex, SUPERFICIE_CRITICA) < RAZAO_MINIMA;
}

/* Clareia o acento até 4,5:1 contra a superfície crítica, segurando o
   matiz da escola (ver contraste.js para a escolha do espaço de cor).
   Cores que já passam saem intactas — o dourado padrão #CDA349, por
   exemplo, mede 5,33:1 e não é tocado. */
export function garantirLegivel(hex) {
  return clarearAteRazao(hex, SUPERFICIE_CRITICA, RAZAO_MINIMA);
}

// A cor de acento da escola entra DENTRO de limites: substitui só o
// dourado de destaque (já clareada se preciso). O resto não se toca.
export function tema(corAcento) {
  if (!corAcento || !HEX_VALIDO.test(corAcento)) return BASE;
  return { ...BASE, gold: garantirLegivel(corAcento) };
}

// PERF: o @import das fontes SAIU daqui e virou <link rel="stylesheet"> no
// index.html. Enquanto morava neste bloco, ele era injetado por um <style>
// em tempo de execução — o navegador só descobria as fontes depois de
// baixar, analisar e executar o JS inteiro. Medido em produção: ~350 ms de
// atraso até o pedido sequer nascer.
// Quem mexer aqui: a família (Fraunces + Archivo) é declarada no index.html
// e USADA abaixo (.disp, inputs). Trocar de fonte exige mexer nos dois lugares.
export const FONTES_CSS = `
  * { box-sizing: border-box; }
  /* overflow-x: CLIP (não "hidden"): corta estouro lateral SEM criar
     contêiner de rolagem — "hidden" no html quebra a inércia do
     scroll por toque no Safari/iPad. */
  html, body { margin:0; max-width:100%; overflow-x:clip; background:#0A1622; }
  /* D08 (Bloco 4, 23/09/2026): a família e a cor do texto moravam só na
     div raiz do App. Os modais saem por createPortal(document.body) —
     fora dessa div — e herdavam do <body>, que não tinha nenhuma das
     duas: o "Responsáveis de Helena" saía na serifa padrão do
     navegador. Declaradas aqui, valem para tudo o que nasce no body. */
  body { font-family: Archivo, system-ui, sans-serif; color: ${BASE.ink}; }
  /* sem efeito elástico no topo (mobile): o cabeçalho não "descola"
     do resto da tela ao puxar pra baixo */
  html, body { overscroll-behavior-y: none; }
  /* ATENÇÃO (B2 do catálogo de defeitos, 12/09/2026): esta animação
     usa \`transform\`, e um elemento com animação de transform vira
     CONTAINING BLOCK para descendentes \`position: fixed\` — eles
     deixam de resolver contra a viewport e passam a resolver contra
     ele. As três áreas envolvem o conteúdo de aba em
     <div className="fade"> (AreaEscola, VisaoEstudo, AreaAdmin),
     então qualquer overlay fixo renderizado dentro cai na armadilha:
     na lista com 60 alunos o wrapper tem a altura do documento
     (~6.010px) e o modal nascia em top ~2.933px, fora de alcance.
     Os 4 modais foram resolvidos com createPortal(document.body) —
     NÃO conserte um overlay novo mexendo aqui: use portal também. */
  .fade { animation: fade .5s ease both; }
  @keyframes fade { from { opacity:0; transform: translateY(8px);} to {opacity:1; transform:none;} }
  /* font-size 16px nos inputs evita o zoom automático do iOS ao focar */
  input, select, textarea { font-family: Archivo, sans-serif; font-size: 16px; }
  .num { font-variant-numeric: tabular-nums; }
  .disp { font-family: 'Fraunces', Georgia, serif; }
  button { cursor:pointer; }
  .chk { transition: all .15s; }
  /* ── Acessibilidade (UX1) ──
     Foco VISÍVEL no teclado: o anel dourado só aparece para quem
     navega por Tab (:focus-visible), nunca no clique de mouse. Garante
     o critério "foco visível" sem poluir a UI de quem usa ponteiro. */
  a:focus-visible, button:focus-visible, input:focus-visible,
  select:focus-visible, textarea:focus-visible, [tabindex]:focus-visible {
    outline: 2px solid ${BASE.gold};
    outline-offset: 2px;
    border-radius: 6px;
  }
  /* não duplica anel no clique de mouse (navegadores que ainda mandam :focus) */
  :focus:not(:focus-visible) { outline: none; }
  /* texto só para leitor de tela: nome acessível sem ocupar pixel */
  .sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
  }
  /* esqueleto de carga (skeleton): brilho que varre o bloco enquanto o
     dado não chega — comunica "carregando" sem parecer travado. */
  .skel {
    position: relative; overflow: hidden;
    background: ${BASE.card}; border: 1px solid ${BASE.line};
    border-radius: 10px;
  }
  .skel::after {
    content: ""; position: absolute; inset: 0;
    background: linear-gradient(90deg, transparent, ${BASE.cardHi}, transparent);
    transform: translateX(-100%); animation: skelvarre 1.25s ease-in-out infinite;
  }
  @keyframes skelvarre { 100% { transform: translateX(100%); } }
  /* respeita quem pediu menos movimento no SO: sem animações de varredura
     nem de fade (mantém o conteúdo, corta o movimento). */
  @media (prefers-reduced-motion: reduce) {
    .skel::after { animation: none; }
    .fade { animation: none; }
    * { scroll-behavior: auto !important; }
  }
  .navwrap { -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .navwrap::-webkit-scrollbar { display: none; }
  /* A densidade é controlada pelos próprios componentes. Zoom global
     altera a geometria do 100dvh, cria rolagem residual e distorce as
     medidas usadas pelos testes responsivos. */
  html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
  @media (max-width: 560px) {
    .hdr-title { font-size: 17px !important; }
    /* mobile mais compacto: menos respiro vertical, mais conteúdo na dobra */
    main { padding-top: 12px !important; }
  }
`;
