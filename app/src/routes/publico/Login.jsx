/* Login — fim do PIN. Aluno e responsável entram com o CÓDIGO
   provisionado pela escola; a coordenação entra com e-mail e senha.
   A marca aqui ainda é neutra: a escola só aparece depois que o
   token diz qual escola é. */
import React, { useState } from "react";
import { BASE, FONTES_CSS } from "../../shared/ui/tema.js";
import * as db from "../../shared/data/index.js";

const T = BASE;

export default function Login() {
  const [modo, setModo] = useState("codigo"); // codigo | coordenacao
  const [codigo, setCodigo] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function entrar(e) {
    e?.preventDefault();
    setBusy(true); setErr("");
    try {
      if (modo === "codigo") await db.entrarComCodigo(codigo);
      else await db.entrarComEmail(email.trim(), senha);
      // a sessão muda; o App troca a tela sozinho
    } catch {
      setErr(modo === "codigo" ? "Código não reconhecido. Confira com a escola." : "E-mail ou senha incorretos.");
      setBusy(false);
    }
  }

  const inputS = { width: "100%", background: T.bg, border: `1px solid ${err ? T.red : T.line}`, color: T.ink, borderRadius: 10, padding: "13px 14px" };
  const pronto = modo === "codigo" ? db.normalizarCodigo(codigo).length >= 12 : email && senha;

  return (
    <div style={{ background: `radial-gradient(1200px 600px at 50% -10%, ${T.bg2}, ${T.bg})`, minHeight: "100vh", color: T.ink, fontFamily: "Archivo, system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <style>{FONTES_CSS}</style>
      <div style={{ width: "100%", maxWidth: 380, background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div className="disp" style={{ width: 42, height: 42, borderRadius: 9, background: `linear-gradient(135deg,${T.gold},#9c7d2e)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#0A1622", fontWeight: 700, fontSize: 20 }}>⚓</div>
          <div>
            <div style={{ color: T.gold, fontWeight: 800, letterSpacing: 1, fontSize: 12 }}>PAINEL DE ESTUDOS</div>
            <div className="disp" style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1 }}>Entrar</div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          {[
            ["codigo", "Aluno / Responsável", "Entra com o código entregue pela escola"],
            ["coordenacao", "Coordenação", "Entra com e-mail e senha"],
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
              <label style={{ fontSize: 12, color: T.sub, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 0.4 }}>Código de acesso</label>
              <input value={codigo} autoComplete="off" autoCapitalize="characters"
                onChange={(e) => { setCodigo(e.target.value.toUpperCase()); setErr(""); }}
                placeholder="XXXX-XXXX-XXXX"
                style={{ ...inputS, letterSpacing: 2, textAlign: "center", fontFamily: "monospace" }} />
            </>
          ) : (
            <>
              <label style={{ fontSize: 12, color: T.sub, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 0.4 }}>E-mail</label>
              <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} style={{ ...inputS, marginBottom: 12 }} />
              <label style={{ fontSize: 12, color: T.sub, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 0.4 }}>Senha</label>
              <input type="password" value={senha} onChange={(e) => { setSenha(e.target.value); setErr(""); }} style={inputS} />
            </>
          )}
          {err && <div style={{ color: T.red, fontSize: 12.5, marginTop: 8 }}>{err}</div>}
          <button type="submit" disabled={busy || !pronto}
            style={{ width: "100%", marginTop: 16, background: (busy || !pronto) ? T.line : T.gold, color: (busy || !pronto) ? T.sub : "#0A1622", border: "none", borderRadius: 10, padding: "14px", minHeight: 50, fontWeight: 800, fontSize: 15 }}>
            {busy ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <div style={{ fontSize: 11.5, color: T.sub, marginTop: 14, lineHeight: 1.5, textAlign: "center" }}>
          O código do aluno e do responsável é gerado e entregue pela escola.
        </div>
      </div>
    </div>
  );
}
