/* Componentes do sistema de design — portados da versão atual.
   Recebem o tema via contexto de branding (useTema). */
import React from "react";
import { useTema } from "../branding/BrandingContext.jsx";

export function Card({ children, style }) {
  const T = useTema();
  return (
    <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, ...style }}>
      {children}
    </div>
  );
}

export function Stat({ label, value, sub, color }) {
  const T = useTema();
  return (
    <Card style={{ flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11.5, color: T.sub, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div className="num disp" style={{ fontSize: 30, fontWeight: 700, color: color || T.ink, lineHeight: 1.1, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: T.sub, marginTop: 3 }}>{sub}</div>}
    </Card>
  );
}

export function MiniStat({ label, value, sub, color }) {
  const T = useTema();
  return (
    <div style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 10.5, color: T.sub, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div className="num disp" style={{ fontSize: 22, fontWeight: 700, color: color || T.ink, lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: T.sub, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const PR = { F: { t: "Fechar", c: "#4FB477" }, P: { t: "Pincelar", c: "#CDA349" }, X: { t: "Mínimo", c: "#7E93A6" } };

export function Tag({ p }) {
  const x = PR[p] || PR.X;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: x.c, border: `1px solid ${x.c}`, borderRadius: 5, padding: "1px 6px", textTransform: "uppercase", letterSpacing: 0.4 }}>
      {x.t}
    </span>
  );
}

// Relevância em estrelas — leitura visual da prioridade da
// metodologia (Fechar/Pincelar/Mínimo). Não muda o método: só o traduz.
const ESTRELAS_POR_PRIORIDADE = { F: 5, P: 3, X: 2 };

export function Estrelas({ p }) {
  const T = useTema();
  const n = ESTRELAS_POR_PRIORIDADE[p] ?? 2;
  const titulo = { F: "Fechar", P: "Pincelar", X: "Mínimo" }[p] ?? "Mínimo";
  return (
    <span title={`${titulo} — relevância ${n}/5`} style={{ fontSize: 12, letterSpacing: 1, whiteSpace: "nowrap" }}>
      <span style={{ color: T.gold }}>{"★".repeat(n)}</span>
      <span style={{ color: T.line }}>{"★".repeat(5 - n)}</span>
    </span>
  );
}

export function SubjDot({ disciplina }) {
  const T = useTema();
  if (!disciplina) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: T.ink }}>
      <span style={{ width: 9, height: 9, borderRadius: 3, background: disciplina.cor }} />
      {disciplina.nome}
    </span>
  );
}

export function Empty({ txt }) {
  const T = useTema();
  return <div style={{ padding: "24px 0", textAlign: "center", color: T.sub, fontSize: 13 }}>{txt}</div>;
}

export function Botao({ children, onClick, disabled, secundario, perigo, style, type = "button" }) {
  const T = useTema();
  const fundo = disabled ? T.line : perigo ? T.red : secundario ? T.card : T.gold;
  const cor = disabled ? T.sub : secundario ? T.ink : "#0A1622";
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ background: fundo, color: cor, border: secundario ? `1px solid ${T.line}` : "none", borderRadius: 8, padding: "13px 20px", minHeight: 48, fontWeight: 700, fontSize: 15, ...style }}>
      {children}
    </button>
  );
}

export function useInputStyle() {
  const T = useTema();
  return {
    input: { background: T.bg, border: `1px solid ${T.line}`, color: T.ink, borderRadius: 8, padding: "12px 12px", fontSize: 16, width: "100%", minHeight: 46 },
    label: { fontSize: 11.5, color: T.sub, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: 0.4 },
  };
}

export function Erro({ children }) {
  const T = useTema();
  if (!children) return null;
  return (
    <div style={{ color: T.red, fontSize: 13, marginTop: 10, border: `1px solid ${T.red}`, borderRadius: 8, padding: "10px 12px" }}>
      {String(children)}
    </div>
  );
}

/* ============================================================
   KIT REFINADO (UX premium) — componentes reutilizáveis novos.
   Tudo mobile-first, sem estouro horizontal, navy/dourado.
   ============================================================ */

// Card com cabeçalho editorial: título forte + subtítulo + ação à direita.
export function SectionCard({ titulo, sub, acao, children, style, semPadding }) {
  const T = useTema();
  return (
    <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden", ...style }}>
      {(titulo || acao) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "13px 16px", borderBottom: `1px solid ${T.line}`, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            {titulo && <div className="disp" style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.2 }}>{titulo}</div>}
            {sub && <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>{sub}</div>}
          </div>
          {acao && <div style={{ flexShrink: 0 }}>{acao}</div>}
        </div>
      )}
      <div style={{ padding: semPadding ? 0 : 16 }}>{children}</div>
    </div>
  );
}

// Barra de abas rolável (mobile-first). `abas`: [[chave, rótulo], ...].
export function Tabs({ abas, ativo, aoTrocar }) {
  const T = useTema();
  return (
    <div className="navwrap" style={{ display: "flex", gap: 2, overflowX: "auto", borderBottom: `1px solid ${T.line}`, marginBottom: 16 }}>
      {abas.map(([k, lb, badge]) => {
        const on = ativo === k;
        return (
          <button key={k} className="tab" onClick={() => aoTrocar(k)}
            style={{ border: "none", background: "transparent", color: on ? T.gold : T.sub, fontWeight: 600, fontSize: 13.5, padding: "12px 13px", minHeight: 46, whiteSpace: "nowrap", borderBottom: on ? `2px solid ${T.gold}` : "2px solid transparent", display: "inline-flex", alignItems: "center", gap: 6 }}>
            {lb}
            {badge != null && badge !== 0 && (
              <span style={{ fontSize: 10.5, fontWeight: 800, background: on ? T.gold : T.line, color: on ? "#0A1622" : T.sub, borderRadius: 9, padding: "1px 6px", minWidth: 17, textAlign: "center" }}>{badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Card de indicador. Use `gradiente` para os destaques "vivos"; senão,
// fica sóbrio com borda. `tom`: ok | alerta | risco | neutro (cor do valor).
export function StatCard({ rotulo, valor, sub, icone, gradiente, tom, onClick }) {
  const T = useTema();
  const corTom = tom === "ok" ? T.green : tom === "alerta" ? T.gold : tom === "risco" ? T.red : T.ink;
  if (gradiente) {
    return (
      <div onClick={onClick} style={{ background: `linear-gradient(135deg, ${gradiente}, ${gradiente}99)`, borderRadius: 13, padding: "12px 14px", position: "relative", overflow: "hidden", minHeight: 84, cursor: onClick ? "pointer" : "default" }}>
        <div style={{ fontSize: 11, color: "#0A1622", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.3, opacity: 0.85 }}>{rotulo}</div>
        <div className="num disp" style={{ fontSize: 25, fontWeight: 800, color: "#fff", lineHeight: 1.15, marginTop: 4, textShadow: "0 1px 2px #0004" }}>{valor}</div>
        {sub && <div style={{ fontSize: 10.5, color: "#0A1622", fontWeight: 600, marginTop: 2, opacity: 0.8 }}>{sub}</div>}
        {icone && <div style={{ position: "absolute", right: 10, bottom: 8, fontSize: 22, color: "#ffffff55" }}>{icone}</div>}
      </div>
    );
  }
  return (
    <div onClick={onClick} style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 14px", minHeight: 78, cursor: onClick ? "pointer" : "default" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.sub, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {icone && <span style={{ opacity: 0.8 }}>{icone}</span>}{rotulo}
      </div>
      <div className="num disp" style={{ fontSize: 24, fontWeight: 800, color: corTom, lineHeight: 1.15, marginTop: 5 }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: T.sub, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// Card de insight (leitura interpretada): borda colorida + frase curta.
export function InsightCard({ titulo, valor, sub, tom }) {
  const T = useTema();
  const cor = tom === "ok" ? T.green : tom === "alerta" ? T.gold : tom === "risco" ? T.red : T.gold;
  return (
    <div style={{ background: T.bg, border: `1px solid ${T.line}`, borderLeft: `4px solid ${cor}`, borderRadius: 10, padding: "11px 13px" }}>
      <div style={{ fontSize: 10.5, color: T.sub, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>{titulo}</div>
      <div className="disp" style={{ fontSize: 16, fontWeight: 700, color: T.ink, marginTop: 3, lineHeight: 1.2 }}>{valor}</div>
      {sub && <div style={{ fontSize: 11.5, color: T.sub, marginTop: 3, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  );
}

// Estado vazio inteligente: ícone + título + dica de próximo passo.
export function EmptyState({ icone = "✦", titulo, dica }) {
  const T = useTema();
  return (
    <div style={{ padding: "26px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 26, opacity: 0.5 }}>{icone}</div>
      <div className="disp" style={{ fontSize: 14.5, fontWeight: 700, color: T.ink, marginTop: 8 }}>{titulo}</div>
      {dica && <div style={{ fontSize: 12.5, color: T.sub, marginTop: 5, maxWidth: 320, marginInline: "auto", lineHeight: 1.5 }}>{dica}</div>}
    </div>
  );
}

// Selo de status: ok (verde), alerta (dourado), risco (vermelho), neutro.
export function StatusBadge({ tom = "neutro", children }) {
  const T = useTema();
  const cor = tom === "ok" ? T.green : tom === "alerta" ? T.gold : tom === "risco" ? T.red : T.sub;
  // neutro usa T.ink para texto (melhor contraste em fundo escuro)
  const corTexto = tom === "neutro" ? T.ink : cor;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: corTexto, border: `1px solid ${cor}55`, background: `${cor}14`, borderRadius: 6, padding: "2px 7px", whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cor }} />{children}
    </span>
  );
}

// Menu "Mais ações" (ações secundárias colapsadas — bom no mobile).
export function MaisAcoes({ acoes }) {
  const T = useTema();
  const [aberto, setAberto] = React.useState(false);
  if (!acoes?.length) return null;
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setAberto((v) => !v)}
        style={{ border: `1px solid ${T.line}`, background: "transparent", color: T.sub, borderRadius: 7, fontSize: 12, fontWeight: 600, padding: "6px 10px", minHeight: 32 }}>
        ⋯ Mais
      </button>
      {aberto && (
        <>
          <div onClick={() => setAberto(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
          <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 31, background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 10, padding: 4, minWidth: 180, boxShadow: "0 8px 24px #0007" }}>
            {acoes.map((a, i) => (
              <button key={i} onClick={() => { setAberto(false); a.aoClicar(); }} disabled={a.desabilitado}
                style={{ display: "block", width: "100%", textAlign: "left", border: "none", background: "transparent", color: a.perigo ? T.red : T.ink, borderRadius: 7, fontSize: 13, padding: "9px 11px", minHeight: 38, opacity: a.desabilitado ? 0.4 : 1 }}>
                {a.rotulo}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Barra de XP/progresso reutilizável (Fase 16.1). `pct` 0..100.
// `alt` controla a espessura; `brilho` acende o gradiente dourado→verde.
export function BarraXP({ pct = 0, alt = 8, brilho = true, trilho }) {
  const T = useTema();
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ height: alt, background: trilho ?? T.bg, borderRadius: alt, overflow: "hidden", border: `1px solid ${T.line}` }}>
      <div style={{ width: `${v}%`, height: "100%", background: `linear-gradient(90deg, ${T.gold}, ${T.green})`, boxShadow: brilho ? `0 0 8px ${T.gold}66` : "none", transition: "width .4s ease" }} />
    </div>
  );
}

// Selo de raridade de conquista (Fase 16.1) — discreto, sem exagero gamer.
// comum · destacada · rara · elite · lendária.
export const RARIDADES = {
  comum:     { rotulo: "Comum",     cor: "#8AA4BC" },
  destacada: { rotulo: "Destacada", cor: "#4FB477" },
  rara:      { rotulo: "Rara",      cor: "#5AA9E6" },
  elite:     { rotulo: "Elite",     cor: "#B98CE0" },
  lendaria:  { rotulo: "Lendária",  cor: "#CDA349" },
};

export function SeloRaridade({ raridade = "comum" }) {
  const r = RARIDADES[raridade] ?? RARIDADES.comum;
  return (
    <span style={{ fontSize: 9.5, fontWeight: 800, color: r.cor, border: `1px solid ${r.cor}66`, background: `${r.cor}14`, borderRadius: 5, padding: "1px 6px", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>
      {r.rotulo}
    </span>
  );
}

// Botão pequeno (ação secundária inline).
export function BotaoMini({ children, onClick, destaque, perigo, disabled }) {
  const T = useTema();
  const cor = perigo ? T.red : destaque ? T.gold : T.sub;
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ border: `1px solid ${destaque ? T.gold : T.line}`, background: destaque ? `${T.gold}14` : "transparent", color: cor, borderRadius: 7, fontSize: 12, fontWeight: 600, padding: "6px 10px", minHeight: 32, opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap" }}>
      {children}
    </button>
  );
}
