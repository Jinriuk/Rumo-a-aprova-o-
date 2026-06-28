/* Casca do app: sessão e roteamento por PAPEL. Magra de propósito —
   o monólito ficou na versão antiga (Doc 5). O papel vem do token;
   o banco aplica a mesma matriz por RLS. */
import React from "react";
import Login from "./routes/publico/Login.jsx";
import RedefinirSenha from "./routes/publico/RedefinirSenha.jsx";
import AreaAluno from "./routes/aluno/AreaAluno.jsx";
import AreaEscola from "./routes/escola/AreaEscola.jsx";
import AreaResponsavel from "./routes/responsavel/AreaResponsavel.jsx";
import AreaAdmin from "./routes/admin/AreaAdmin.jsx";
import { useSessao } from "./shared/hooks/useSessao.js";
import { BrandingProvider, useTema } from "./shared/branding/BrandingContext.jsx";
import { FONTES_CSS } from "./shared/ui/tema.js";
import * as db from "./shared/data/index.js";

// Detecta fluxo de recuperação de senha via hash da URL.
// O Supabase redireciona com #access_token=...&type=recovery após verificar o OTP.
function detectarRecuperacao() {
  if (typeof window === "undefined") return false;
  const hash = new URLSearchParams(window.location.hash.slice(1));
  return hash.get("type") === "recovery" && !!hash.get("access_token");
}

const AREAS = {
  coordenacao: AreaEscola,
  aluno: AreaAluno,
  responsavel: AreaResponsavel,
};

export default function App() {
  const { carregando, sessao, perfil, superAdmin, erro } = useSessao();

  // Fluxo de recuperação detectado antes de qualquer roteamento por papel.
  // Verifica o hash da URL na renderização inicial (síncrono) para garantir
  // que o coordenador veja a tela de redefinição mesmo se já estiver logado.
  if (detectarRecuperacao()) {
    return (
      <BrandingProvider escola={{ nome: "Rumo à Aprovação", slug: "app", logo_url: null, cor_acento: null }}>
        <RedefinirSenha />
      </BrandingProvider>
    );
  }

  if (carregando) return (
    <TelaNeutra>
      <div role="status" aria-live="polite" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div className="skel" style={{ width: 44, height: 44, borderRadius: 11 }} />
        <div style={{ fontSize: 14 }}>Preparando seu painel…</div>
      </div>
    </TelaNeutra>
  );
  if (!sessao) return <Login />;

  // Backoffice interno (17.4): invisível para qualquer papel de escola;
  // só aparece para super_admin (gate no banco, não só na tela).
  if (superAdmin) {
    return (
      <BrandingProvider escola={{ nome: "Backoffice", slug: "admin", logo_url: null, cor_acento: null }}>
        <Casca><AreaAdmin /></Casca>
      </BrandingProvider>
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

  // Escola suspensa/cancelada (S1, migration 0027): a RLS já esconde
  // todo o dado da escola — sem este gate o usuário entraria num painel
  // VAZIO sem explicação (era o sintoma do bug D1A). Aqui mostramos o
  // motivo de forma clara. O bloqueio continua sendo do banco; o front
  // só o torna legível (não o aplica e não o afrouxa).
  if (!db.escolaOperacional(perfil.escola)) {
    return <TelaAcessoSuspenso escola={perfil.escola} />;
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

function TelaAcessoSuspenso({ escola }) {
  const cancelada = escola?.status === "cancelada";
  return (
    <TelaNeutra>
      <div style={{ fontSize: 40, marginBottom: 14 }}>{cancelada ? "🚫" : "⏸️"}</div>
      <div style={{ color: "#E8D8A8", fontWeight: 800, fontSize: 18, marginBottom: 10 }}>
        {cancelada ? "Acesso encerrado" : "Acesso temporariamente suspenso"}
      </div>
      <div style={{ fontSize: 14, maxWidth: 380, lineHeight: 1.6, marginBottom: 22 }}>
        O acesso de <b style={{ color: "#C8D8E8" }}>{escola?.nome ?? "sua escola"}</b>{" "}
        {cancelada
          ? "foi encerrado. Fale com o responsável pela conta para mais informações."
          : "está suspenso no momento. Assim que for reativado pela administração, seu painel volta automaticamente."}
      </div>
      <button onClick={() => db.sair().catch(console.error)}
        style={{ padding: "11px 20px", borderRadius: 9, border: "1px solid #1E3A52", background: "#102236", color: "#8AA4BC", fontWeight: 700, fontSize: 14 }}>
        Sair
      </button>
    </TelaNeutra>
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
