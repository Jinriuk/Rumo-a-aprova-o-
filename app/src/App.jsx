/* Casca do app: sessão e roteamento por PAPEL. Magra de propósito —
   o monólito ficou na versão antiga (Doc 5). O papel vem do token;
   o banco aplica a mesma matriz por RLS. */
import React from "react";
import Login from "./routes/publico/Login.jsx";
import AreaAluno from "./routes/aluno/AreaAluno.jsx";
import AreaEscola from "./routes/escola/AreaEscola.jsx";
import AreaResponsavel from "./routes/responsavel/AreaResponsavel.jsx";
import AreaAdmin from "./routes/admin/AreaAdmin.jsx";
import { useSessao } from "./shared/hooks/useSessao.js";
import { BrandingProvider, useTema } from "./shared/branding/BrandingContext.jsx";
import { FONTES_CSS } from "./shared/ui/tema.js";
import * as db from "./shared/data/index.js";

const AREAS = {
  coordenacao: AreaEscola,
  aluno: AreaAluno,
  responsavel: AreaResponsavel,
};

// Rota discreta do backoffice (D0). Não aparece em nenhum menu de
// aluno/responsável/coordenação — chega-se por URL direta.
const ROTA_ADMIN = "/admin-interno";
const naRotaAdmin = () =>
  typeof window !== "undefined" && window.location.pathname.startsWith(ROTA_ADMIN);

export default function App() {
  const { carregando, sessao, perfil, superAdmin, erro } = useSessao();

  if (carregando) return <TelaNeutra>Carregando…</TelaNeutra>;
  if (!sessao) return <Login />;

  // Backoffice interno (D0): o gate REAL é o banco (super_admin ativo
  // em internal_admins); a URL é só o endereço discreto. O super_admin
  // entra direto no backoffice e a URL é normalizada para /admin-interno.
  if (superAdmin) {
    if (typeof window !== "undefined" && !naRotaAdmin()) {
      window.history.replaceState(null, "", ROTA_ADMIN);
    }
    return (
      <BrandingProvider escola={{ nome: "Backoffice", slug: "admin", logo_url: null, cor_acento: null }}>
        <Casca><AreaAdmin /></Casca>
      </BrandingProvider>
    );
  }

  // Usuário comum (aluno/responsável/coordenação) que tenta abrir a
  // URL do backoffice: acesso restrito (regra D0.5.3) — sem vazar nada.
  if (naRotaAdmin()) {
    return (
      <TelaNeutra>
        <div className="disp" style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Acesso restrito</div>
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 18 }}>
          Esta área é exclusiva da operação interna.
        </div>
        <button onClick={() => { window.location.href = "/"; }}
          style={{ padding: "10px 18px", borderRadius: 8, border: "none", fontWeight: 700 }}>
          Voltar ao início
        </button>
      </TelaNeutra>
    );
  }

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
