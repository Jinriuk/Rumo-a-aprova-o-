/* Topo comum, refinado: compacto, institucional, mobile-first.
   Marca da escola (white-label), contexto, contagem pra prova e sair.
   No celular o nome do usuário some e a contagem fica enxuta. */
import React from "react";
import { useBranding, MarcaEscola } from "../branding/BrandingContext.jsx";
import * as db from "../data/index.js";

export function Cabecalho({ titulo, subtitulo, diasProva, diasProvaMedia, provaRealizada, nomeUsuario, rotuloPapel }) {
  const { escola, tema: T } = useBranding();
  return (
    // I3: `top` lê a variável que FaixaDemo.jsx publica no :root — 0px
    // quando a faixa não existe, então o header não precisa saber nada
    // sobre ambiente de demo, só respeitar o espaço se alguém reservar.
    <header className="app-header" style={{ borderBottom: `1px solid ${T.line}`, background: `linear-gradient(180deg, ${T.bg2}, ${T.bg})`, position: "sticky", top: "var(--altura-faixa-demo, 0px)", zIndex: 20, paddingTop: "env(safe-area-inset-top)" }}>
      <style>{`@media (max-width:560px){ .hdr-user{display:none !important;} .hdr-prova-num{font-size:18px !important;} }`}</style>
      <div style={{ padding: "10px max(18px, env(safe-area-inset-right)) 10px max(18px, env(safe-area-inset-left))", display: "flex", alignItems: "center", gap: 11 }}>
        <MarcaEscola tamanho={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="disp hdr-title" style={{ margin: 0, fontSize: 17, fontWeight: 700, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: T.ink }}>
            {escola?.nome ?? titulo}
          </h1>
          {subtitulo && <div style={{ fontSize: 11, color: T.sub, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtitulo}</div>}
        </div>

        {rotuloPapel && (
          <span style={{ fontSize: 11, color: T.gold, border: `1px solid ${T.gold}44`, background: `${T.gold}12`, borderRadius: 7, padding: "5px 9px", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>{rotuloPapel}</span>
        )}

        {/* T27: prova já realizada não tem contagem regressiva. Antes, o
            `Math.max(0, …)` de concursos.js entregava "0 dias p/ prova"
            para uma prova passada — um número inventado onde o certo é
            não haver número. Aqui o bloco troca de forma: vira rótulo,
            sem dígito grande, porque não há dígito verdadeiro. */}
        {provaRealizada ? (
          <div style={{ textAlign: "center", flexShrink: 0, lineHeight: 1.15, paddingLeft: 2 }} title="A data da prova deste aluno já passou">
            <div className="disp" style={{ fontSize: 12, fontWeight: 700, color: T.sub, whiteSpace: "nowrap" }}>prova</div>
            <div style={{ fontSize: 9.5, color: T.sub, marginTop: 2 }}>realizada</div>
          </div>
        ) : diasProva != null && (
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
