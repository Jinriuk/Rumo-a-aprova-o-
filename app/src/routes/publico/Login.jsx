/* Login — aluno/responsável entram com código; coordenação com e-mail+senha.
   D1B: campo senha com olhinho, "Esqueci minha senha" para coordenação,
   "Esqueci meu código de acesso" para aluno/responsável. */
import React, { useState } from "react";
import { BASE, FONTES_CSS } from "../../shared/ui/tema.js";
import * as db from "../../shared/data/index.js";

const T = BASE;

export default function Login() {
  const [modo, setModo] = useState("codigo"); // codigo | coordenacao
  const [tela, setTela] = useState("login");  // login | esqueciSenha | esqueciCodigo | confirmacao
  const [codigo, setCodigo] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [emailRecup, setEmailRecup] = useState("");
  const [msgConfirmacao, setMsgConfirmacao] = useState("");

  async function entrar(e) {
    e?.preventDefault();
    setBusy(true); setErr("");
    try {
      if (modo === "codigo") await db.entrarComCodigo(codigo);
      else await db.entrarComEmail(email.trim(), senha);
    } catch {
      setErr(modo === "codigo" ? "Código não reconhecido. Confira com a escola." : "E-mail ou senha incorretos.");
      setBusy(false);
    }
  }

  async function solicitarSenha(e) {
    e?.preventDefault();
    if (!emailRecup.trim()) { setErr("Informe o e-mail."); return; }
    setBusy(true); setErr("");
    try {
      await db.solicitarRecuperacaoSenha(emailRecup.trim());
    } catch { /* mensagem genérica independentemente do resultado */ }
    setBusy(false);
    setMsgConfirmacao("Se este e-mail estiver cadastrado, enviaremos instruções de recuperação.");
    setTela("confirmacao");
  }

  async function solicitarCodigo(e) {
    e?.preventDefault();
    if (!emailRecup.trim()) { setErr("Informe o e-mail."); return; }
    setBusy(true); setErr("");
    try {
      await db.solicitarRecuperacaoCodigo(emailRecup.trim());
    } catch { /* silencioso */ }
    setBusy(false);
    setMsgConfirmacao("Se houver um acesso vinculado a este e-mail, enviaremos as instruções. Caso não receba, procure a coordenação da escola.");
    setTela("confirmacao");
  }

  const inputS = { width: "100%", background: T.bg, border: `1px solid ${err ? T.red : T.line}`, color: T.ink, borderRadius: 10, padding: "13px 14px" };
  const pronto = modo === "codigo" ? db.normalizarCodigo(codigo).length >= 12 : email && senha;
  const emailRecupValido = emailRecup.trim().length > 0 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailRecup.trim());

  // ── Tela de confirmação de recuperação ──
  if (tela === "confirmacao") {
    return (
      <Wrapper>
        <LogoTopo />
        <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>✉️</div>
          <div className="disp" style={{ fontSize: 17, fontWeight: 700, color: T.ink, marginBottom: 8 }}>Solicitação recebida</div>
          <div style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.6 }}>{msgConfirmacao}</div>
        </div>
        <button onClick={() => { setTela("login"); setEmailRecup(""); setErr(""); }}
          style={{ width: "100%", marginTop: 8, background: T.gold, color: "#0A1622", border: "none", borderRadius: 10, padding: "14px", minHeight: 50, fontWeight: 800, fontSize: 15 }}>
          ← Voltar ao login
        </button>
      </Wrapper>
    );
  }

  // ── Tela "Esqueci minha senha" (coordenação) ──
  if (tela === "esqueciSenha") {
    return (
      <Wrapper>
        <LogoTopo />
        <div style={{ fontSize: 13, color: T.sub, marginBottom: 16, lineHeight: 1.5 }}>
          Informe o e-mail da sua conta de coordenação. Enviaremos instruções de recuperação.
        </div>
        <form onSubmit={solicitarSenha}>
          <label style={lblS}>E-mail</label>
          <input type="email" value={emailRecup} onChange={(e) => { setEmailRecup(e.target.value); setErr(""); }}
            placeholder="coord@escola.com.br" autoFocus style={{ ...inputS, marginBottom: 12 }} />
          {err && <div style={{ color: T.red, fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
          <button type="submit" disabled={busy || !emailRecupValido}
            style={{ width: "100%", background: (busy || !emailRecupValido) ? T.line : T.gold, color: (busy || !emailRecupValido) ? T.sub : "#0A1622", border: "none", borderRadius: 10, padding: "14px", minHeight: 50, fontWeight: 800, fontSize: 15 }}>
            {busy ? "Enviando…" : "Enviar instruções"}
          </button>
        </form>
        <BotaoVoltar onClick={() => { setTela("login"); setEmailRecup(""); setErr(""); }} />
      </Wrapper>
    );
  }

  // ── Tela "Esqueci meu código de acesso" (aluno/responsável) ──
  if (tela === "esqueciCodigo") {
    return (
      <Wrapper>
        <LogoTopo />
        <div style={{ fontSize: 13, color: T.sub, marginBottom: 16, lineHeight: 1.5 }}>
          Informe o e-mail cadastrado. Se houver um acesso vinculado, enviaremos instruções.<br />
          Se não tiver e-mail cadastrado, procure a coordenação da sua escola.
        </div>
        <form onSubmit={solicitarCodigo}>
          <label style={lblS}>E-mail</label>
          <input type="email" value={emailRecup} onChange={(e) => { setEmailRecup(e.target.value); setErr(""); }}
            placeholder="seu@email.com" autoFocus style={{ ...inputS, marginBottom: 12 }} />
          {err && <div style={{ color: T.red, fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
          <button type="submit" disabled={busy || !emailRecupValido}
            style={{ width: "100%", background: (busy || !emailRecupValido) ? T.line : T.gold, color: (busy || !emailRecupValido) ? T.sub : "#0A1622", border: "none", borderRadius: 10, padding: "14px", minHeight: 50, fontWeight: 800, fontSize: 15 }}>
            {busy ? "Enviando…" : "Enviar instruções"}
          </button>
        </form>
        <div style={{ marginTop: 14, fontSize: 12, color: T.sub, lineHeight: 1.5, textAlign: "center" }}>
          Não tem e-mail cadastrado? Procure a coordenação da sua escola.
        </div>
        <BotaoVoltar onClick={() => { setTela("login"); setEmailRecup(""); setErr(""); }} />
      </Wrapper>
    );
  }

  // ── Tela de login principal ──
  return (
    <Wrapper>
      <LogoTopo />

      <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
        {[
          ["codigo",      "Aluno / Responsável", "Entra com o código entregue pela escola"],
          ["coordenacao", "Coordenação",          "Entra com e-mail e senha"],
        ].map(([id, titulo, desc]) => {
          const on = modo === id;
          return (
            <button type="button" key={id} onClick={() => { setModo(id); setErr(""); }}
              style={{ textAlign: "left", border: `1px solid ${on ? T.gold : T.line}`, background: on ? T.cardHi : T.bg, color: T.ink, borderRadius: 10, padding: "12px 14px", minHeight: 48 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{titulo}</div>
              <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>{desc}</div>
            </button>
          );
        })}
      </div>

      <form onSubmit={entrar}>
        {modo === "codigo" ? (
          <>
            <label style={lblS}>Código de acesso</label>
            <input value={codigo} autoComplete="off" autoCapitalize="characters"
              onChange={(e) => { setCodigo(e.target.value.toUpperCase()); setErr(""); }}
              placeholder="Ex.: LUCASDEMO2026"
              style={{ ...inputS, letterSpacing: 1.5, textAlign: "center", fontFamily: "monospace" }} />
          </>
        ) : (
          <>
            <label style={lblS}>E-mail</label>
            <input type="email" value={email} placeholder="coordenacao@escola.com.br"
              onChange={(e) => { setEmail(e.target.value); setErr(""); }}
              style={{ ...inputS, marginBottom: 12 }} />
            <label style={lblS}>Senha</label>
            <div style={{ position: "relative" }}>
              <input type={mostrarSenha ? "text" : "password"} value={senha}
                placeholder="Senha de acesso"
                onChange={(e) => { setSenha(e.target.value); setErr(""); }}
                style={{ ...inputS, paddingRight: 46 }} />
              <button type="button" onClick={() => setMostrarSenha((v) => !v)} tabIndex={-1}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: T.sub, cursor: "pointer", padding: 4, fontSize: 18, lineHeight: 1 }}>
                {mostrarSenha ? "🙈" : "👁"}
              </button>
            </div>
          </>
        )}

        {err && <div style={{ color: T.red, fontSize: 12.5, marginTop: 8 }}>{err}</div>}

        <button type="submit" disabled={busy || !pronto}
          style={{ width: "100%", marginTop: 16, background: (busy || !pronto) ? T.line : T.gold, color: (busy || !pronto) ? T.sub : "#0A1622", border: "none", borderRadius: 10, padding: "14px", minHeight: 50, fontWeight: 800, fontSize: 15 }}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>

      {/* Links de recuperação contextuais */}
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
        {modo === "coordenacao" && (
          <button type="button" onClick={() => { setTela("esqueciSenha"); setErr(""); }}
            style={{ background: "none", border: "none", color: T.gold, fontSize: 12.5, cursor: "pointer", textDecoration: "underline", padding: 4 }}>
            Esqueci minha senha
          </button>
        )}
        {modo === "codigo" && (
          <button type="button" onClick={() => { setTela("esqueciCodigo"); setErr(""); }}
            style={{ background: "none", border: "none", color: T.sub, fontSize: 12.5, cursor: "pointer", textDecoration: "underline", padding: 4 }}>
            Esqueci meu código de acesso
          </button>
        )}
      </div>

      <div style={{ fontSize: 11.5, color: T.sub, marginTop: 12, lineHeight: 1.5, textAlign: "center" }}>
        O código do aluno e do responsável é gerado e entregue pela escola.
      </div>
    </Wrapper>
  );
}

const lblS = { fontSize: 12, color: T.sub, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 0.4 };

function LogoTopo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
      <div className="disp" style={{ width: 42, height: 42, borderRadius: 9, background: `linear-gradient(135deg,${T.gold},#9c7d2e)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#0A1622", fontWeight: 700, fontSize: 20 }}>⚓</div>
      <div>
        <div style={{ color: T.gold, fontWeight: 800, letterSpacing: 1, fontSize: 12 }}>PAINEL DE ESTUDOS</div>
        <div className="disp" style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1 }}>Entrar</div>
      </div>
    </div>
  );
}

function Wrapper({ children }) {
  return (
    <div style={{ background: `repeating-linear-gradient(45deg, transparent, transparent 30px, rgba(30,58,85,0.25) 30px, rgba(30,58,85,0.25) 31px), repeating-linear-gradient(-45deg, transparent, transparent 30px, rgba(30,58,85,0.25) 30px, rgba(30,58,85,0.25) 31px), radial-gradient(1200px 600px at 50% -10%, ${T.bg2}, ${T.bg})`, minHeight: "100vh", color: T.ink, fontFamily: "Archivo, system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <style>{FONTES_CSS}</style>
      <div style={{ width: "100%", maxWidth: 380, background: T.card, border: `1px solid ${T.line}`, borderTop: `4px solid ${T.gold}`, borderRadius: 16, padding: 22 }}>
        {children}
      </div>
    </div>
  );
}

function BotaoVoltar({ onClick }) {
  return (
    <button type="button" onClick={onClick}
      style={{ marginTop: 14, background: "none", border: "none", color: T.sub, fontSize: 12.5, cursor: "pointer", textDecoration: "underline", display: "block", textAlign: "center", width: "100%", padding: 4 }}>
      ← Voltar ao login
    </button>
  );
}
