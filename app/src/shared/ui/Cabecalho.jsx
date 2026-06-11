/* Topo comum: marca da escola (white-label), nome de quem entrou,
   contagem pra prova e sair. */
import React from "react";
import { useBranding, MarcaEscola } from "../branding/BrandingContext.jsx";
import * as db from "../data/index.js";

export function Cabecalho({ titulo, subtitulo, diasProva, nomeUsuario, rotuloPapel }) {
  const { escola, tema: T } = useBranding();
  return (
    <header style={{ borderBottom: `1px solid ${T.line}`, background: T.bg2, position: "sticky", top: 0, zIndex: 20, paddingTop: "env(safe-area-inset-top)" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "12px max(16px, env(safe-area-inset-right)) 12px max(16px, env(safe-area-inset-left))", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <MarcaEscola />
        <div style={{ flex: 1, minWidth: 140 }}>
          <div className="disp hdr-title" style={{ fontSize: 19, fontWeight: 700, lineHeight: 1 }}>{escola?.nome ?? titulo}</div>
          <div style={{ fontSize: 11.5, color: T.sub, marginTop: 3 }}>{subtitulo}</div>
        </div>

        {rotuloPapel && (
          <div style={{ fontSize: 12, color: T.gold, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 12px", fontWeight: 600 }}>{rotuloPapel}</div>
        )}

        {diasProva != null && (
          <div style={{ textAlign: "right", paddingLeft: 4 }}>
            <div className="num disp" style={{ fontSize: 22, fontWeight: 700, color: T.gold, lineHeight: 1 }}>{diasProva}</div>
            <div style={{ fontSize: 10.5, color: T.sub }}>dias p/ prova</div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 4 }}>
          <span style={{ fontSize: 12, color: T.sub, whiteSpace: "nowrap" }}>{nomeUsuario}</span>
          <button onClick={() => db.sair().catch((e) => console.error(e))} title="Sair"
            style={{ border: `1px solid ${T.line}`, background: T.card, color: T.sub, borderRadius: 8, padding: "8px 12px", minHeight: 40, fontSize: 12.5, fontWeight: 600 }}>
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
