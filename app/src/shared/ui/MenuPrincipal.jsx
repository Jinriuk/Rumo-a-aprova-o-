/* Menu principal responsivo (Fase 1 do doc central):
   - CELULAR e TABLET (≤1023px): barra inferior fixa (zona do polegar),
     ícones SVG + rótulo, 4 itens principais + "Mais". Safe-area iOS.
     Tablet usa a MESMA navegação do celular — a sidebar só entra
     quando a tela tem largura de sobra.
   - DESKTOP (≥1024px): MENU LATERAL fixo (sidebar, ref. Guruja) — o
     conteúdo ocupa praticamente a tela toda (classe .com-sidebar).
   Contrato: abas = [[chave, rótulo, badge?, nomeDoÍcone]]. */
import React, { useState } from "react";
import { useTema, useBranding } from "../branding/BrandingContext.jsx";
import { Icone } from "./Icones.jsx";

const MAX_NA_BARRA = 4;
export const LARGURA_SIDEBAR = 236;

export function MenuPrincipal({ abas, ativo, aoTrocar, usuario }) {
  const T = useTema();
  const { escola } = useBranding();
  const [maisAberto, setMaisAberto] = useState(false);
  const iniciais = (usuario?.nome ?? "")
    .split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");

  const precisaMais = abas.length > MAX_NA_BARRA + 1;
  const naBarra = precisaMais ? abas.slice(0, MAX_NA_BARRA) : abas;
  const noMais = precisaMais ? abas.slice(MAX_NA_BARRA) : [];
  const ativoNoMais = noMais.some(([k]) => k === ativo);

  function trocar(k) {
    setMaisAberto(false);
    aoTrocar(k);
    // trocar de aba = página nova: sempre nasce no TOPO
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }

  const ItemBarra = ({ rotulo, badge, icone, on, aoClicar }) => (
    <button onClick={aoClicar}
      style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 2px 7px", position: "relative", color: on ? T.gold : T.sub }}>
      <span style={{ position: "absolute", top: 0, left: "22%", right: "22%", height: 3, borderRadius: "0 0 3px 3px", background: on ? T.gold : "transparent", boxShadow: on ? `0 0 10px ${T.gold}88` : "none" }} />
      <Icone nome={icone} tam={21} grosso={on ? 2.4 : 2} />
      <span style={{ fontSize: 10, fontWeight: on ? 800 : 600, letterSpacing: 0.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{rotulo}</span>
      {badge != null && badge !== 0 && (
        <span className="num" style={{ position: "absolute", top: 4, right: "calc(50% - 21px)", background: T.gold, color: "#0A1622", fontSize: 9.5, fontWeight: 800, borderRadius: 8, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", boxShadow: "0 1px 4px #0007" }}>{badge}</span>
      )}
    </button>
  );

  return (
    <>
      <style>{`
        .menu-lateral { display:none; }
        .menu-barra { display:none; }
        @media (max-width: 1023px) {
          .menu-barra { display:flex; }
        }
        @media (min-width: 1024px) {
          .menu-lateral { display:flex; }
          .com-sidebar { margin-left: ${LARGURA_SIDEBAR}px !important; max-width: none !important; }
        }
        .mi { transition: background .15s, color .15s, transform .15s; }
        .mi:hover { background: ${T.cardHi} !important; color: ${T.ink} !important; transform: translateX(2px); }
        .mi:hover .mi-ic { color: ${T.gold} !important; }
        /* rolagem do menu: vertical fina e discreta, lateral nunca */
        .menu-rolagem { scrollbar-width: none; }
        .menu-rolagem::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ============ DESKTOP: menu lateral fixo ============ */}
      <nav className="menu-lateral" style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: LARGURA_SIDEBAR, zIndex: 10, flexDirection: "column", background: `linear-gradient(180deg, ${T.bg2} 0%, ${T.bg} 100%)`, borderRight: `1px solid ${T.line}`, padding: "86px 12px 14px", overflow: "hidden" }}>

        {/* perfil VERTICAL: avatar centralizado em cima, nome embaixo
            (quebra em até 2 linhas — nada de "…" em nome grande).
            Foto/modelos de avatar entram na Fase 15. */}
        {usuario && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: "16px 12px 13px", marginBottom: 16 }}>
            <div className="disp" style={{ width: 56, height: 56, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${T.gold}, #9c7d2e)`, color: "#0A1622", fontWeight: 800, fontSize: 19, boxShadow: `0 4px 14px ${T.gold}44`, border: `2.5px solid ${T.gold}` }}>
              {iniciais || "•"}
            </div>
            <div className="disp" style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, marginTop: 9, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word" }}>
              {usuario.nome}
            </div>
            {usuario.sub && (
              <div style={{ fontSize: 10.5, color: T.gold, fontWeight: 700, marginTop: 4, background: `${T.gold}12`, border: `1px solid ${T.gold}33`, borderRadius: 7, padding: "2px 9px", maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{usuario.sub}</div>
            )}
          </div>
        )}

        <div style={{ fontSize: 10.5, color: T.sub, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.4, padding: "0 12px 10px", opacity: 0.8 }}>
          Menu
        </div>

        <div className="menu-rolagem" style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {abas.map(([k, lb, badge, icone]) => {
            const on = ativo === k;
            return (
              <button key={k} className={on ? "" : "mi"} onClick={() => trocar(k)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                  border: "none", borderRadius: 11, padding: "9px 10px", minHeight: 48,
                  fontSize: 14.5, fontWeight: on ? 800 : 600, fontFamily: "inherit",
                  background: on ? `linear-gradient(90deg, ${T.gold}1f, ${T.gold}08)` : "transparent",
                  color: on ? T.ink : T.sub, position: "relative", flexShrink: 0,
                }}>
                {/* indicador lateral do ativo (dentro do item — nada vaza) */}
                <span style={{ position: "absolute", left: 0, top: 9, bottom: 9, width: 3.5, borderRadius: "0 4px 4px 0", background: on ? T.gold : "transparent", boxShadow: on ? `0 0 12px ${T.gold}` : "none" }} />
                {/* pílula do ícone */}
                <span className="mi-ic" style={{
                  width: 34, height: 34, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  background: on ? `linear-gradient(135deg, ${T.gold}, #9c7d2e)` : T.card,
                  border: on ? "none" : `1px solid ${T.line}`,
                  color: on ? "#0A1622" : T.sub,
                  boxShadow: on ? `0 3px 12px ${T.gold}44` : "none",
                  transition: "color .15s",
                }}>
                  <Icone nome={icone} tam={18} grosso={on ? 2.4 : 2} />
                </span>
                <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lb}</span>
                {badge != null && badge !== 0 && (
                  <span className="num" style={{ background: T.gold, color: "#0A1622", fontSize: 11, fontWeight: 800, borderRadius: 9, padding: "2px 8px", boxShadow: `0 2px 8px ${T.gold}55` }}>{badge}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* rodapé da sidebar: assinatura discreta da plataforma */}
        <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 12, marginTop: 10, display: "flex", alignItems: "center", gap: 9, padding: "12px 10px 0" }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${T.gold}, #9c7d2e)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#0A1622", flexShrink: 0 }}>
            <Icone nome="ancora" tam={15} grosso={2.4} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="disp" style={{ fontSize: 12, fontWeight: 700, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{escola?.nome ?? "Rumo à Aprovação"}</div>
            <div style={{ fontSize: 9.5, color: T.sub, letterSpacing: 0.4, textTransform: "uppercase" }}>Rumo à Aprovação</div>
          </div>
        </div>
      </nav>

      {/* ============ CELULAR/TABLET: barra inferior fixa ============
          fundo SÓLIDO de propósito: backdrop-filter (blur) em elemento
          fixo repinta a cada pixel rolado e trava o scroll em tablet */}
      <nav className="menu-barra" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40, background: T.bg2, borderTop: `1px solid ${T.line}`, paddingBottom: "env(safe-area-inset-bottom)", boxShadow: "0 -4px 16px #0006" }}>
        {naBarra.map(([k, lb, badge, icone]) => (
          <ItemBarra key={k} rotulo={lb} badge={badge} icone={icone} on={ativo === k} aoClicar={() => trocar(k)} />
        ))}
        {precisaMais && (
          <ItemBarra rotulo="Mais" icone="mais" on={ativoNoMais || maisAberto} aoClicar={() => setMaisAberto((v) => !v)} />
        )}
      </nav>

      {/* folha do "Mais" */}
      {maisAberto && (
        <>
          <div onClick={() => setMaisAberto(false)} style={{ position: "fixed", inset: 0, zIndex: 41, background: "#0008" }} />
          <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", width: "min(440px, calc(100% - 20px))", bottom: `calc(66px + env(safe-area-inset-bottom))`, zIndex: 42, background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 12px 40px #000a" }}>
            {noMais.map(([k, lb, badge, icone], i) => {
              const on = ativo === k;
              return (
                <button key={k} onClick={() => trocar(k)}
                  style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", border: "none", background: on ? `${T.gold}14` : "transparent", color: on ? T.gold : T.ink, padding: "14px 16px", minHeight: 52, fontSize: 15, fontWeight: on ? 800 : 600, borderBottom: i === noMais.length - 1 ? "none" : `1px solid ${T.line}` }}>
                  <Icone nome={icone} tam={19} />
                  <span style={{ flex: 1 }}>{lb}</span>
                  {badge != null && badge !== 0 && (
                    <span className="num" style={{ background: T.gold, color: "#0A1622", fontSize: 10.5, fontWeight: 800, borderRadius: 9, padding: "1px 7px" }}>{badge}</span>
                  )}
                  {on && <Icone nome="check" tam={16} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
