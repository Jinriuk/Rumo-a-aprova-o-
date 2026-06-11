/* Menu principal responsivo (Fase 1 do doc central):
   - CELULAR (≤700px): barra inferior fixa (zona do polegar), ícones +
     rótulo, 4 itens principais + "Mais". Safe-area do iOS.
   - DESKTOP (>700px): MENU LATERAL fixo (sidebar, ref. Guruja) — o
     conteúdo ocupa praticamente a tela toda (classe .com-sidebar).
   Mesmo contrato do Tabs: abas = [[chave, rótulo, badge?, ícone?]]. */
import React, { useState } from "react";
import { useTema } from "../branding/BrandingContext.jsx";

const MAX_NA_BARRA = 4;
export const LARGURA_SIDEBAR = 204;

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

  const ItemBarra = ({ rotulo, badge, icone, on, aoClicar }) => (
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
        .menu-lateral { display:none; }
        .menu-barra { display:none; }
        @media (max-width: 700px) {
          .menu-barra { display:flex; }
        }
        @media (min-width: 701px) {
          .menu-lateral { display:flex; }
          .com-sidebar { margin-left: ${LARGURA_SIDEBAR}px !important; max-width: none !important; }
        }
        .menu-item-lat:hover { background: ${T.cardHi} !important; color: ${T.ink} !important; }
      `}</style>

      {/* DESKTOP: menu lateral fixo */}
      <nav className="menu-lateral" style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: LARGURA_SIDEBAR, zIndex: 10, flexDirection: "column", gap: 2, background: T.bg2, borderRight: `1px solid ${T.line}`, padding: "84px 10px 16px" }}>
        {abas.map(([k, lb, badge, icone]) => {
          const on = ativo === k;
          return (
            <button key={k} className={on ? "" : "menu-item-lat"} onClick={() => trocar(k)}
              style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", border: "none", borderRadius: 10, padding: "11px 13px", minHeight: 44, fontSize: 13.5, fontWeight: on ? 800 : 600, background: on ? `${T.gold}16` : "transparent", color: on ? T.gold : T.sub, borderLeft: `3px solid ${on ? T.gold : "transparent"}` }}>
              <span style={{ fontSize: 17, lineHeight: 1, filter: on ? "none" : "grayscale(1) opacity(.8)" }}>{icone ?? "•"}</span>
              <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lb}</span>
              {badge != null && badge !== 0 && (
                <span className="num" style={{ background: T.gold, color: "#0A1622", fontSize: 10.5, fontWeight: 800, borderRadius: 9, padding: "1px 7px" }}>{badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* CELULAR: barra inferior fixa */}
      <nav className="menu-barra" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40, background: `${T.bg2}f2`, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderTop: `1px solid ${T.line}`, paddingBottom: "env(safe-area-inset-bottom)" }}>
        {naBarra.map(([k, lb, badge, icone]) => (
          <ItemBarra key={k} rotulo={lb} badge={badge} icone={icone ?? "•"} on={ativo === k} aoClicar={() => trocar(k)} />
        ))}
        {precisaMais && (
          <ItemBarra rotulo="Mais" icone="⋯" on={ativoNoMais || maisAberto} aoClicar={() => setMaisAberto((v) => !v)} />
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
