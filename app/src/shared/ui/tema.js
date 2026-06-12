/* Sistema de design FIXO (Doc 6, 1.2), herdado da versão atual:
   navy #0A1622, dourado #CDA349, Fraunces/Archivo. O white-label
   é leve: a escola troca logo, nome e a COR DE ACENTO — nada mais. */

export const BASE = {
  bg: "#0A1622",
  bg2: "#0E1F30",
  card: "#12273B",
  cardHi: "#173050",
  line: "#1E3A55",
  ink: "#EAF1F8",
  sub: "#8AA4BC",
  gold: "#CDA349",
  goldSoft: "#3a3320",
  green: "#4FB477",
  red: "#D9695E",
};

// Contraste mínimo no tema escuro: acento escuro demais some (botão
// preto em fundo navy). Clareia até a luminância mínima — a cor da
// escola é respeitada, mas nunca pode quebrar a leitura.
const LUM_MINIMA = 0.32;

export function luminancia(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function garantirLegivel(hex) {
  const lum = luminancia(hex);
  if (lum >= LUM_MINIMA) return hex;
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = (LUM_MINIMA - lum) / (1 - lum); // mistura com branco
  r = Math.round(r + (255 - r) * t); g = Math.round(g + (255 - g) * t); b = Math.round(b + (255 - b) * t);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// A cor de acento da escola entra DENTRO de limites: substitui só o
// dourado de destaque (já clareada se preciso). O resto não se toca.
export function tema(corAcento) {
  if (!corAcento || !/^#[0-9a-fA-F]{6}$/.test(corAcento)) return BASE;
  return { ...BASE, gold: garantirLegivel(corAcento) };
}

export const FONTES_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Archivo:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  /* overflow-x: CLIP (não "hidden"): corta estouro lateral SEM criar
     contêiner de rolagem — "hidden" no html quebra a inércia do
     scroll por toque no Safari/iPad. */
  html, body { margin:0; max-width:100%; overflow-x:clip; background:#0A1622; }
  /* sem efeito elástico no topo (mobile): o cabeçalho não "descola"
     do resto da tela ao puxar pra baixo */
  html, body { overscroll-behavior-y: none; }
  .fade { animation: fade .5s ease both; }
  @keyframes fade { from { opacity:0; transform: translateY(8px);} to {opacity:1; transform:none;} }
  /* font-size 16px nos inputs evita o zoom automático do iOS ao focar */
  input, select, textarea { font-family: Archivo, sans-serif; font-size: 16px; }
  .num { font-variant-numeric: tabular-nums; }
  .disp { font-family: 'Fraunces', Georgia, serif; }
  button { cursor:pointer; }
  .chk { transition: all .15s; }
  .navwrap { -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .navwrap::-webkit-scrollbar { display: none; }
  /* em telas grandes DE COMPUTADOR (mouse/trackpad: pointer fine) o
     sistema sobe um degrau de tamanho. Tablets ficam de fora: zoom
     re-escala a página durante a rolagem e trava o scroll no WebKit. */
  @media (min-width: 1200px) and (pointer: fine) { body { zoom: 1.08; } }
  @media (min-width: 1600px) and (pointer: fine) { body { zoom: 1.15; } }
  @media (max-width: 560px) {
    .hdr-title { font-size: 17px !important; }
    /* mobile mais compacto: menos respiro vertical, mais conteúdo na dobra */
    main { padding-top: 12px !important; }
  }
`;
