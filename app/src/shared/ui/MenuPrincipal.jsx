/* Menu principal responsivo:
   - CELULAR: barra inferior fixa (zona do polegar), ícones + rótulo,
     até 4 itens principais + "Mais" para o restante. Safe-area do iOS.
   - DESKTOP (>700px): abas no topo, como antes.
   Mesmo contrato do Tabs: abas = [[chave, rótulo, badge?, ícone?]]. */
import React, { useState } from "react";
import { useTema } from "../branding/BrandingContext.jsx";

const MAX_NA_BARRA = 4;

export function MenuPrincipal({ abas, ativo, aoTrocar }) {
  const T = useTema();
  const [maisAberto, setMaisAberto] = useState(false);

  const precisaMais = abas.length > MAX_NA_BARRA + 1;
  const naBarra = precisaMais ? abas.slice(0, MAX_NA_BARRA) : abas;
  const noMais = precisaMais ? abas.slice(MAX_NA_BARRA) : [];
  const ativoNoMais = noMais.some(([k]) => k === ativo);

  function trocar(k) {
    setMaisAberto(false);
    aoTrocar(k);
  }

  const ItemBarra = ({ chave, rotulo, badge, icone, on, aoClicar }) => (
    <button onClick={aoClicar}
      style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "7px 2px 6px", position: "relative", color: on ? T.gold : T.sub }}>
      <span style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 2.5, borderRadius: 2, background: on ? T.gold : "transparent" }} />
      <span style={{ fontSize: 19, lineHeight: 1, filter: on ? "none" : "grayscale(1) opacity(.75)" }}>{icone}</span>
      <span style={{ fontSize: 9.5, fontWeight: on ? 800 : 600, letterSpacing: 0.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{rotulo}</span>
      {badge != null && badge !== 0 && (
        <span className="num" style={{ position: "absolute", top: 3, right: "calc(50% - 19px)", background: T.gold, color: "#0A1622", fontSize: 9, fontWeight: 800, borderRadius: 8, minWidth: 15, height: 15, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{badge}</span>
      )}
    </button>
  );

  return (
    <>
      <style>{`
        .menu-topo { display:flex; }
        .menu-barra { display:none; }
        @media (max-width: 700px) {
          .menu-topo { display:none; }
          .menu-barra { display:flex; }
        }
      `}</style>

      {/* DESKTOP: abas no topo */}
      <div className="menu-topo navwrap" style={{ gap: 2, overflowX: "auto", borderBottom: `1px solid ${T.line}`, marginBottom: 16 }}>
        {abas.map(([k, lb, badge]) => {
          const on = ativo === k;
          return (
            <button key={k} className="tab" onClick={() => trocar(k)}
              style={{ border: "none", background: "transparent", color: on ? T.gold : T.sub, fontWeight: 600, fontSize: 13.5, padding: "12px 13px", minHeight: 46, whiteSpace: "nowrap", borderBottom: on ? `2px solid ${T.gold}` : "2px solid transparent", display: "inline-flex", alignItems: "center", gap: 6 }}>
              {lb}
              {badge != null && badge !== 0 && (
                <span style={{ fontSize: 10.5, fontWeight: 800, background: on ? T.gold : T.line, color: on ? "#0A1622" : T.sub, borderRadius: 9, padding: "1px 6px", minWidth: 17, textAlign: "center" }}>{badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* CELULAR: barra inferior fixa */}
      <nav className="menu-barra" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40, background: `${T.bg2}f2`, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderTop: `1px solid ${T.line}`, paddingBottom: "env(safe-area-inset-bottom)" }}>
        {naBarra.map(([k, lb, badge, icone]) => (
          <ItemBarra key={k} chave={k} rotulo={lb} badge={badge} icone={icone ?? "•"} on={ativo === k} aoClicar={() => trocar(k)} />
        ))}
        {precisaMais && (
          <ItemBarra chave="__mais" rotulo="Mais" icone="⋯" on={ativoNoMais || maisAberto} aoClicar={() => setMaisAberto((v) => !v)} />
        )}
      </nav>

      {/* folha do "Mais" */}
      {maisAberto && (
        <>
          <div onClick={() => setMaisAberto(false)} style={{ position: "fixed", inset: 0, zIndex: 41, background: "#0008" }} />
          <div style={{ position: "fixed", left: 10, right: 10, bottom: `calc(64px + env(safe-area-inset-bottom))`, zIndex: 42, background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 12px 40px #000a" }}>
            {noMais.map(([k, lb, badge, icone], i) => {
              const on = ativo === k;
              return (
                <button key={k} onClick={() => trocar(k)}
                  style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", border: "none", background: on ? `${T.gold}14` : "transparent", color: on ? T.gold : T.ink, padding: "14px 16px", minHeight: 50, fontSize: 14.5, fontWeight: on ? 800 : 600, borderBottom: i === noMais.length - 1 ? "none" : `1px solid ${T.line}` }}>
                  <span style={{ fontSize: 18 }}>{icone ?? "•"}</span>
                  <span style={{ flex: 1 }}>{lb}</span>
                  {badge != null && badge !== 0 && (
                    <span className="num" style={{ background: T.gold, color: "#0A1622", fontSize: 10.5, fontWeight: 800, borderRadius: 9, padding: "1px 7px" }}>{badge}</span>
                  )}
                  {on && <span>✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
