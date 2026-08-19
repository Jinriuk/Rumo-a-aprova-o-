/* Cena visual do login — original, sem copiar componentes das referências.
   Motion cuida apenas de transform/opacity/pathLength. A cena pausa quando
   a aba perde visibilidade, quando o usuário desliga os efeitos ou quando o
   sistema pede movimento reduzido (controle feito por Login.jsx). */
import React from "react";
import * as m from "motion/react-m";

const MOLAS = { type: "spring", stiffness: 155, damping: 18, mass: 0.8 };

const PONTOS = [
  { chave: "plano", numero: "01", titulo: "Plano", sub: "o edital vira rota" },
  { chave: "pratica", numero: "02", titulo: "Prática", sub: "cada alvo conta" },
  { chave: "dominio", numero: "03", titulo: "Domínio", sub: "o avanço aparece" },
];

const ESTRELAS = [
  [7, 16, 2], [13, 72, 1], [19, 43, 1], [27, 88, 2], [34, 10, 1],
  [41, 60, 1], [48, 27, 2], [57, 83, 1], [63, 47, 1], [71, 14, 2],
  [78, 68, 1], [84, 36, 1], [91, 77, 2], [95, 19, 1],
];

export function FundoPortal({ efeitos }) {
  return (
    <div className="portal-ambient" aria-hidden="true">
      <m.div className="portal-grid"
        animate={efeitos ? { backgroundPosition: ["0px 0px", "0px 72px"] } : { backgroundPosition: "0px 0px" }}
        transition={efeitos ? { duration: 8, repeat: Infinity, ease: "linear" } : { duration: 0 }} />
      <m.div className="portal-aurora portal-aurora--gold"
        animate={efeitos ? { x: [0, 90, -35, 0], y: [0, 35, 75, 0], scale: [1, 1.18, .94, 1] } : { x: 0, y: 0, scale: 1 }}
        transition={efeitos ? { duration: 14, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }} />
      <m.div className="portal-aurora portal-aurora--blue"
        animate={efeitos ? { x: [0, -75, 30, 0], y: [0, -30, 55, 0], scale: [1, .92, 1.16, 1] } : { x: 0, y: 0, scale: 1 }}
        transition={efeitos ? { duration: 18, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }} />
      <div className="portal-stars">
        {ESTRELAS.map(([x, y, tam], i) => (
          <m.i key={`${x}-${y}`} style={{ left: `${x}%`, top: `${y}%`, width: tam, height: tam }}
            animate={efeitos ? { opacity: [.15, i % 3 === 0 ? .9 : .52, .15], scale: [1, 1.7, 1] } : { opacity: .28, scale: 1 }}
            transition={efeitos ? { duration: 2.8 + (i % 4), delay: i * .17, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }} />
        ))}
      </div>
      <m.div className="portal-light-pass"
        animate={efeitos ? { x: ["-130vw", "130vw"] } : { x: "-130vw" }}
        transition={efeitos ? { duration: 2.2, delay: 1.1, repeat: Infinity, repeatDelay: 6.8, ease: [0.22, 1, 0.36, 1] } : { duration: 0 }} />
      <div className="portal-vignette" />
    </div>
  );
}

export function MarcaPortal({ compacta = false }) {
  return (
    <div className={`portal-brand ${compacta ? "portal-brand--compacta" : ""}`.trim()}>
      <span className="portal-brand-mark" aria-hidden="true">
        <svg viewBox="0 0 48 48" focusable="false">
          <circle cx="24" cy="24" r="16" />
          <circle cx="24" cy="24" r="7" />
          <path d="M24 3v8M24 37v8M3 24h8M37 24h8" />
          <path d="m19 25 3 3 8-9" />
        </svg>
      </span>
      <span>
        <strong>Rumo à Aprovação</strong>
        {!compacta && <small>Central de preparação</small>}
      </span>
    </div>
  );
}

export function MapaDaMissao({ efeitos }) {
  return (
    <div className="mission-map" aria-hidden="true">
      <m.div className="mission-map-glow"
        animate={efeitos ? { opacity: [.34, .72, .34], scale: [.94, 1.06, .94] } : { opacity: .46, scale: 1 }}
        transition={efeitos ? { duration: 4.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }} />

      <svg className="mission-map-lines" viewBox="0 0 620 310" preserveAspectRatio="none" focusable="false">
        <defs>
          <linearGradient id="rota-dourada" x1="0" x2="1">
            <stop offset="0" stopColor="var(--ui-accent)" stopOpacity=".08" />
            <stop offset=".52" stopColor="var(--ui-accent)" stopOpacity=".9" />
            <stop offset="1" stopColor="var(--ui-green)" stopOpacity=".3" />
          </linearGradient>
        </defs>
        <m.path className="mission-map-route" d="M62 220 C155 205 174 83 292 116 S440 254 558 114"
          initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.5, delay: .45, ease: [0.22, 1, 0.36, 1] }} />
        <m.path className="mission-map-route mission-map-route--signal" d="M62 220 C155 205 174 83 292 116 S440 254 558 114"
          strokeDasharray="3 16"
          animate={efeitos ? { strokeDashoffset: [0, -76] } : { strokeDashoffset: 0 }}
          transition={efeitos ? { duration: 3.2, repeat: Infinity, ease: "linear" } : { duration: 0 }} />
      </svg>

      <m.div className="mission-core" initial={{ opacity: 0, scale: .72, rotate: -8 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ ...MOLAS, delay: .28 }}>
        <m.span className="mission-core-ring mission-core-ring--one"
          animate={efeitos ? { rotate: 360 } : { rotate: 14 }}
          transition={efeitos ? { duration: 18, repeat: Infinity, ease: "linear" } : { duration: 0 }} />
        <m.span className="mission-core-ring mission-core-ring--two"
          animate={efeitos ? { rotate: -360 } : { rotate: -20 }}
          transition={efeitos ? { duration: 12, repeat: Infinity, ease: "linear" } : { duration: 0 }} />
        <span className="mission-core-content">
          <i />
          <small>SEU SISTEMA</small>
          <strong>EM MISSÃO</strong>
        </span>
      </m.div>

      <div className="mission-map-points">
        {PONTOS.map((ponto, i) => (
          <m.div key={ponto.chave} className={`mission-point mission-point--${ponto.chave}`}
            initial={{ opacity: 0, y: 18, scale: .88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...MOLAS, delay: .55 + i * .16 }}>
            <span className="mission-point-number">{ponto.numero}</span>
            <span><strong>{ponto.titulo}</strong><small>{ponto.sub}</small></span>
            <m.i animate={efeitos ? { boxShadow: ["0 0 0 0 rgba(205,163,73,.38)", "0 0 0 9px rgba(205,163,73,0)"] } : { boxShadow: "0 0 0 0 rgba(205,163,73,0)" }}
              transition={efeitos ? { duration: 2.2, delay: 1.2 + i * .7, repeat: Infinity, repeatDelay: 1.5 } : { duration: 0 }} />
          </m.div>
        ))}
      </div>

      <m.div className="mission-map-status" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}
        transition={{ duration: .5, delay: 1.15 }}>
        <span /> MÉTODO CONECTADO AO SEU PROGRESSO REAL
      </m.div>
    </div>
  );
}

export function ControleEfeitos({ ativos, sistemaReduzido, aoAlternar }) {
  const rotulo = sistemaReduzido
    ? "Movimento reduzido pelo sistema"
    : ativos ? "Pausar efeitos visuais" : "Ativar efeitos visuais";
  return (
    <button className="login-effects" type="button" onClick={aoAlternar}
      disabled={sistemaReduzido} aria-pressed={ativos}
      aria-label={rotulo}
      title={sistemaReduzido ? "Seu sistema solicitou movimento reduzido" : ativos ? "Pausar efeitos visuais" : "Ativar efeitos visuais"}>
      <span className="login-effects-icon" aria-hidden="true">
        {ativos ? "◉" : "○"}
      </span>
      <span>{sistemaReduzido ? "Movimento reduzido" : ativos ? "Efeitos ativos" : "Efeitos pausados"}</span>
    </button>
  );
}
