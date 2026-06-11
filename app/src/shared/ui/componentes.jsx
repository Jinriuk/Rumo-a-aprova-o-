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
