/* ============================================================
   INSÍGNIA DE PATENTE (Fase 16.1) — desenho vetorial da patente.
   ------------------------------------------------------------
   Traduz a especificação `insignia` de cada patente (jargao.js)
   num SVG limpo, legível em tamanho pequeno e coerente com o tema
   navy/dourado. NÃO contém regra: só desenha o que recebe.

     • PRAÇAS  → chevrons/gaivotas (+ arcos/rockers, diamante).
     • OFICIAIS → estrelas (+ louros, coroa) e moldura premium.
     • `nivelVisual` 1..5 controla a riqueza da moldura.
     • `bloqueada` → versão apagada (cadeado de progresso).
   ============================================================ */
import React from "react";
import { useTema } from "../branding/BrandingContext.jsx";

// Estrela de 5 pontas (path normalizado p/ um quadrado de lado `s`,
// centrada em cx,cy). Mantém leitura nítida mesmo a 14px.
function pontosEstrela(cx, cy, s) {
  const R = s / 2, r = R * 0.42;
  let d = "";
  for (let i = 0; i < 10; i++) {
    const raio = i % 2 === 0 ? R : r;
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const x = cx + raio * Math.cos(ang), y = cy + raio * Math.sin(ang);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d + "Z";
}

// Um chevron (gaivota) apontando para cima, vértice em (cx, apiceY).
function chevron(cx, apiceY, larg, perna) {
  return `M${cx - larg} ${apiceY + perna} L${cx} ${apiceY} L${cx + larg} ${apiceY + perna}`;
}

export function Insignia({ patente, tam = 56, bloqueada = false, style }) {
  const T = useTema();
  const ins = patente?.insignia ?? {};
  const oficial = patente?.faixa === "oficial";
  const nv = patente?.nivelVisual ?? 1;

  // paleta da insígnia conforme estado/riqueza
  const ouro = T.gold;
  const ouroEscuro = "#9c7d2e";
  const marca = bloqueada ? T.sub : ouro;          // chevrons/estrelas
  const traco = bloqueada ? T.line : (nv >= 4 ? ouro : nv >= 3 ? `${ouro}cc` : T.line); // moldura
  const fundo = bloqueada ? T.bg : T.bg2;
  const id = React.useId();

  const cx = 32;
  // Centro ÓTICO do escudo (topo y≈13, ponta y=70): as marcas de
  // graduação são desenhadas numa linha de base provisória e depois
  // transladadas em bloco para que o CENTRO da caixa caia aqui.
  let CY = 35;
  const marcas = [];      // chevrons/estrelas — centralizadas no escudo
  const ornamentos = [];  // louros/coroa/arco — moldura fixa ao redor
  let mn = Infinity, mx = -Infinity;
  const ext = (a, b) => { if (a < mn) mn = a; if (b > mx) mx = b; };

  // ---- moldura (escudo arredondado) ----
  const molduraD = "M32 4 L54 11 Q56 12 56 15 L56 40 Q56 58 33 70 Q32 70.5 31 70 Q8 58 8 40 L8 15 Q8 12 10 11 Z";

  // ---- PRAÇAS: chevrons + arcos + diamante (lidos como um bloco) ----
  if (!oficial || ins.chevrons) {
    const n = ins.chevrons ?? 0;
    const denso = (ins.arcos ?? 0) > 0 || ins.diamante; // feixe alto → encolhe p/ caber
    if (denso) CY = 33; // sobe o bloco p/ a ponta do escudo não apertar
    const larg = denso ? 13 : 15, perna = denso ? 7 : 8, gap = denso ? 8.5 : 9.5, sw = denso ? 4.4 : 5;
    for (let i = 0; i < n; i++) {
      const apice = i * gap;
      marcas.push(
        <path key={`ch${i}`} d={chevron(cx, apice, larg, perna)}
          fill="none" stroke={marca} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />,
      );
      ext(apice - sw / 2, apice + perna + sw / 2);
    }
    // arcos (rockers) logo abaixo do feixe — graduação de sargento
    const arcos = ins.arcos ?? 0;
    const baseArco = (n ? (n - 1) * gap + perna : 0) + 4;
    for (let i = 0; i < arcos; i++) {
      const y = baseArco + i * 5.5;
      marcas.push(
        <path key={`ar${i}`} d={`M18 ${y} Q32 ${y + 6} 46 ${y}`}
          fill="none" stroke={marca} strokeWidth={3.4} strokeLinecap="round" />,
      );
      ext(y - 1.7, y + 3.5 + 1.7);
    }
    // diamante acima do feixe (subtenente — praça mais nobre)
    if (ins.diamante) {
      const cyD = -10, h = 6, w = 6;
      marcas.push(
        <path key="dia" d={`M32 ${cyD - h} L${32 + w} ${cyD} L32 ${cyD + h} L${32 - w} ${cyD} Z`}
          fill={bloqueada ? "none" : ouro} stroke={marca} strokeWidth={2.4} strokeLinejoin="round" />,
      );
      ext(cyD - h - 1.2, cyD + h + 1.2);
    }
    // recruta puro: um único ponto discreto (sem chevron)
    if (ins.base) {
      marcas.push(<circle key="rec" cx={cx} cy={0} r={5} fill="none" stroke={marca} strokeWidth={3} />);
      ext(-6.5, 6.5);
    }
  }

  // ---- OFICIAIS: estrelas (centralizadas) + louros/coroa (moldura) ----
  if (oficial) {
    const ne = ins.estrelas ?? 0;
    const s = ne >= 3 ? 16 : 18;
    let pos = [];
    if (ne === 1) pos = [[cx, 0]];
    else if (ne === 2) pos = [[cx - 9, 0], [cx + 9, 0]];
    else if (ne >= 3) pos = [[cx, -8], [cx - 10, 8], [cx + 10, 8]];
    pos.forEach(([x, y], i) => {
      marcas.push(
        <path key={`st${i}`} d={pontosEstrela(x, y, s)} fill={marca}
          stroke={bloqueada ? T.line : ouroEscuro} strokeWidth={1} strokeLinejoin="round" />,
      );
      ext(y - s / 2 - 0.5, y + s / 2 + 0.5);
    });
    // louros — dois ramos simétricos pelas laterais (oficial superior)
    if (ins.louros) {
      [1, -1].forEach((dir, i) => {
        ornamentos.push(
          <path key={`lo${i}`} d={`M${32 - dir * 2} 62 Q${32 - dir * 16} 56 ${32 - dir * 17} 40`}
            fill="none" stroke={marca} strokeWidth={2.6} strokeLinecap="round" />,
        );
        for (let k = 0; k < 3; k++) {
          const fy = 56 - k * 7, fx = 32 - dir * (14 + k);
          ornamentos.push(
            <path key={`lf${i}${k}`} d={`M${fx} ${fy} q${dir * -5} -2 ${dir * -6} -5`}
              fill="none" stroke={marca} strokeWidth={2} strokeLinecap="round" />,
          );
        }
      });
    }
    // arco no topo (tenente-coronel)
    if (ins.arcoTopo) {
      ornamentos.push(
        <path key="atopo" d="M18 16 Q32 9 46 16" fill="none" stroke={marca} strokeWidth={2.8} strokeLinecap="round" />,
      );
    }
    // coroa (coronel — topo da hierarquia)
    if (ins.coroa) {
      ornamentos.push(
        <path key="coroa" d="M22 17 L25 10 L29 15 L32 8 L35 15 L39 10 L42 17 Z"
          fill={bloqueada ? "none" : ouro} stroke={marca} strokeWidth={1.6} strokeLinejoin="round" />,
      );
    }
  }

  // translada o bloco de marcas para o centro ótico do escudo
  const dy = mn === Infinity ? 0 : CY - (mn + mx) / 2;

  return (
    <svg width={tam} height={tam * (76 / 64)} viewBox="0 0 64 76" aria-hidden="true"
      style={{ display: "block", flexShrink: 0, ...style }}>
      <defs>
        <linearGradient id={`fnd${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={fundo} />
          <stop offset="1" stopColor={bloqueada ? T.bg : T.card} />
        </linearGradient>
      </defs>
      {/* moldura premium dupla nos níveis altos */}
      {nv >= 5 && !bloqueada && (
        <path d={molduraD} fill="none" stroke={ouro} strokeWidth={5} opacity={0.18} />
      )}
      <path d={molduraD} fill={`url(#fnd${id})`} stroke={traco} strokeWidth={nv >= 4 && !bloqueada ? 2.6 : 1.8}
        strokeDasharray={bloqueada ? "3 3" : "none"} strokeLinejoin="round" />
      {ornamentos}
      <g transform={`translate(0, ${dy.toFixed(2)})`}>{marcas}</g>
      {bloqueada && (
        <g opacity={0.9}>
          <rect x={27} y={36} width={10} height={8} rx={1.5} fill="none" stroke={T.sub} strokeWidth={1.8} />
          <path d="M29 36 v-2 a3 3 0 0 1 6 0 v2" fill="none" stroke={T.sub} strokeWidth={1.8} />
        </g>
      )}
    </svg>
  );
}
