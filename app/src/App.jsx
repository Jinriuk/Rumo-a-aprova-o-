/* Casca do app: sessão e roteamento por PAPEL. Magra de propósito —
   o monólito ficou na versão antiga (Doc 5). O papel vem do token;
   o banco aplica a mesma matriz por RLS. */
import React from "react";
import Login from "./routes/publico/Login.jsx";
import AreaAluno from "./routes/aluno/AreaAluno.jsx";
import AreaEscola from "./routes/escola/AreaEscola.jsx";
import AreaResponsavel from "./routes/responsavel/AreaResponsavel.jsx";
import { useSessao } from "./shared/hooks/useSessao.js";
import { BrandingProvider, useTema } from "./shared/branding/BrandingContext.jsx";
import { FONTES_CSS } from "./shared/ui/tema.js";
import * as db from "./shared/data/index.js";

const AREAS = {
  coordenacao: AreaEscola,
  aluno: AreaAluno,
  responsavel: AreaResponsavel,
};

export default function App() {
  const { carregando, sessao, perfil, erro } = useSessao();

  if (carregando) return <TelaNeutra>Carregando…</TelaNeutra>;
  if (!sessao) return <Login />;
  if (erro || !perfil) {
    return (
      <TelaNeutra>
        <div style={{ marginBottom: 12 }}>Não foi possível carregar seu perfil.</div>
        <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 18 }}>{erro}</div>
        <button onClick={() => db.sair().catch(console.error)} style={{ padding: "10px 18px", borderRadius: 8, border: "none", fontWeight: 700 }}>
          Sair e tentar de novo
        </button>
      </TelaNeutra>
    );
  }

  const Area = AREAS[perfil.usuario.papel];
  if (!Area) return <TelaNeutra>Papel desconhecido: {perfil.usuario.papel}</TelaNeutra>;

  return (
    <BrandingProvider escola={perfil.escola}>
      <Casca>
        <Area perfil={perfil} />
      </Casca>
    </BrandingProvider>
  );
}

function Casca({ children }) {
  const T = useTema();
  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.ink, fontFamily: "Archivo, system-ui, sans-serif" }}>
      <style>{FONTES_CSS}</style>
      <style>{`
        ::selection { background:${T.gold}; color:#0A1622; }
        .tab:hover { color:${T.ink} !important; }
        .row:hover { background:${T.cardHi} !important; }
      `}</style>
      {children}
    </div>
  );
}

function TelaNeutra({ children }) {
  return (
    <div style={{ background: "#0A1622", color: "#8AA4BC", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Archivo, sans-serif", padding: 24, textAlign: "center" }}>
      <style>{FONTES_CSS}</style>
      {children}
    </div>
  );
}
