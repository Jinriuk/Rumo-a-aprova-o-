/* Topo comum, refinado: compacto, institucional, mobile-first.
   Marca da escola (white-label), contexto, contagem pra prova e sair.
   No celular o nome do usuário some e a contagem fica enxuta. */
import React from "react";
import { useBranding, MarcaEscola } from "../branding/BrandingContext.jsx";
import * as db from "../data/index.js";

export function Cabecalho({ titulo, subtitulo, diasProva, diasProvaMedia, nomeUsuario, rotuloPapel }) {
  const { escola, tema: T } = useBranding();
  return (
    <header style={{ borderBottom: `1px solid ${T.line}`, background: `linear-gradient(180deg, ${T.bg2}, ${T.bg})`, position: "sticky", top: 0, zIndex: 20, paddingTop: "env(safe-area-inset-top)" }}>
      <style>{`@media (max-width:560px){ .hdr-user{display:none !important;} .hdr-prova-num{font-size:18px !important;} }`}</style>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "10px max(14px, env(safe-area-inset-right)) 10px max(14px, env(safe-area-inset-left))", display: "flex", alignItems: "center", gap: 11 }}>
        <MarcaEscola tamanho={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="disp hdr-title" style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {escola?.nome ?? titulo}
          </div>
          {subtitulo && <div style={{ fontSize: 11, color: T.sub, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtitulo}</div>}
        </div>

        {rotuloPapel && (
          <span style={{ fontSize: 11, color: T.gold, border: `1px solid ${T.gold}44`, background: `${T.gold}12`, borderRadius: 7, padding: "5px 9px", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>{rotuloPapel}</span>
        )}

        {diasProva != null && (
          <div style={{ textAlign: "center", flexShrink: 0, lineHeight: 1, paddingLeft: 2 }} title={diasProvaMedia ? "Estimativa pela data média histórica da prova" : "Pela data da prova"}>
            <div className="num disp hdr-prova-num" style={{ fontSize: 21, fontWeight: 800, color: T.gold }}>{diasProva}</div>
            <div style={{ fontSize: 9.5, color: T.sub, marginTop: 2 }}>dias p/ prova{diasProvaMedia ? "*" : ""}</div>
          </div>
        )}

        <span className="hdr-user" style={{ fontSize: 12, color: T.sub, whiteSpace: "nowrap", flexShrink: 0, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>{nomeUsuario}</span>
        <button onClick={() => db.sair().catch((e) => console.error(e))} title="Sair" aria-label="Sair"
          style={{ border: `1px solid ${T.line}`, background: T.card, color: T.sub, borderRadius: 8, padding: "7px 11px", minHeight: 38, fontSize: 12.5, fontWeight: 600, flexShrink: 0 }}>
          Sair
        </button>
      </div>
    </header>
  );
}
