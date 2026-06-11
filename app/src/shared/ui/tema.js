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

// A cor de acento da escola entra DENTRO de limites: substitui só o
// dourado de destaque. O resto do tema não se toca.
export function tema(corAcento) {
  if (!corAcento || !/^#[0-9a-fA-F]{6}$/.test(corAcento)) return BASE;
  return { ...BASE, gold: corAcento };
}

export const FONTES_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Archivo:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  html, body { margin:0; max-width:100%; overflow-x:hidden; }
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
  @media (max-width: 560px) {
    .hdr-title { font-size: 17px !important; }
  }
`;
