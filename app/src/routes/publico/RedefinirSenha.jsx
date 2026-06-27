/* Tela de redefinição de senha — chamada quando coordenador clica no
   link de acesso enviado pelo backoffice ou no "Esqueci minha senha".
   O Supabase processa o hash da URL automaticamente e cria a sessão de
   recuperação; esta tela só lida com o updateUser. */
import React, { useState } from "react";
import { BASE, FONTES_CSS } from "../../shared/ui/tema.js";
import * as db from "../../shared/data/index.js";

const T = BASE;
const inputS = {
  width: "100%",
  background: T.bg,
  border: `1px solid ${T.line}`,
  color: T.ink,
  borderRadius: 10,
  padding: "13px 14px",
  marginBottom: 12,
};
const lbl = { fontSize: 12, color: T.sub, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 0.4 };

function forcaSenha(s) {
  if (s.length < 8) return { nivel: 0, texto: "Muito curta (mín. 8 caracteres)" };
  const tem = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(s)).length;
  if (tem <= 1) return { nivel: 1, texto: "Fraca — adicione letras maiúsculas, números ou símbolos" };
  if (tem === 2) return { nivel: 2, texto: "Razoável" };
  return { nivel: 3, texto: "Forte" };
}

export default function RedefinirSenha() {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [estado, setEstado] = useState("idle"); // idle | salvando | sucesso | erro
  const [erro, setErro] = useState("");

  const forca = forcaSenha(senha);
  const senhaOk = forca.nivel >= 2;
  const igual = senha === confirmacao;
  const pronto = senhaOk && igual && confirmacao.length > 0 && estado !== "salvando";

  async function submit(e) {
    e?.preventDefault();
    if (!pronto) return;
    setEstado("salvando");
    setErro("");
    try {
      await db.redefinirSenha(senha);
      setEstado("sucesso");
      setTimeout(async () => {
        try { await db.sair(); } catch { /* ignora */ }
        window.location.replace("/");
      }, 2500);
    } catch (err) {
      const msg = err?.message ?? "";
      if (/expired|invalid|not found/i.test(msg)) {
        setErro("Este link expirou ou já foi usado. Solicite um novo link de recuperação na tela de login.");
      } else {
        setErro("Não foi possível atualizar a senha. Tente novamente ou solicite um novo link.");
      }
      setEstado("erro");
    }
  }

  const corForca = [T.red, T.red, T.gold, T.green][forca.nivel] ?? T.sub;

  if (estado === "sucesso") {
    return (
      <div style={{ background: T.bg, minHeight: "100vh", color: T.ink, fontFamily: "Archivo, system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
        <style>{FONTES_CSS}</style>
        <div style={{ width: "100%", maxWidth: 380, background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
          <div className="disp" style={{ fontSize: 20, fontWeight: 700, color: T.green, marginBottom: 8 }}>Senha definida!</div>
          <div style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.6 }}>
            Sua senha foi atualizada com sucesso. Redirecionando para o login…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: `radial-gradient(1200px 600px at 50% -10%, ${T.bg2}, ${T.bg})`, minHeight: "100vh", color: T.ink, fontFamily: "Archivo, system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <style>{FONTES_CSS}</style>
      <div style={{ width: "100%", maxWidth: 380, background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ width: 42, height: 42, borderRadius: 9, background: `linear-gradient(135deg,${T.gold},#9c7d2e)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#0A1622", fontWeight: 700, fontSize: 20 }}>⚓</div>
          <div>
            <div style={{ color: T.gold, fontWeight: 800, letterSpacing: 1, fontSize: 12 }}>COORDENAÇÃO</div>
            <div className="disp" style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1 }}>Definir senha</div>
          </div>
        </div>

        <p style={{ fontSize: 13, color: T.sub, lineHeight: 1.6, marginBottom: 20, marginTop: 0 }}>
          Escolha uma senha segura para acessar o painel de coordenação.
        </p>

        <form onSubmit={submit}>
          <label style={lbl}>Nova senha</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => { setSenha(e.target.value); setErro(""); }}
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            style={{ ...inputS, borderColor: senha && !senhaOk ? T.red : T.line }}
          />
          {senha && (
            <div style={{ fontSize: 11.5, color: corForca, marginTop: -8, marginBottom: 12 }}>
              {forca.texto}
            </div>
          )}

          <label style={lbl}>Confirmar senha</label>
          <input
            type="password"
            value={confirmacao}
            onChange={(e) => { setConfirmacao(e.target.value); setErro(""); }}
            autoComplete="new-password"
            placeholder="Digite a senha novamente"
            style={{ ...inputS, borderColor: confirmacao && !igual ? T.red : T.line }}
          />
          {confirmacao && !igual && (
            <div style={{ fontSize: 11.5, color: T.red, marginTop: -8, marginBottom: 12 }}>
              As senhas não coincidem.
            </div>
          )}

          {erro && (
            <div style={{ color: T.red, fontSize: 12.5, marginBottom: 12, padding: "10px 12px", background: `${T.red}14`, borderRadius: 8, border: `1px solid ${T.red}44` }}>
              {erro}
              <button
                type="button"
                onClick={() => window.location.replace("/")}
                style={{ display: "block", marginTop: 8, background: "none", border: "none", color: T.gold, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}
              >
                ← Voltar ao login
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={!pronto}
            style={{ width: "100%", marginTop: 4, background: !pronto ? T.line : T.gold, color: !pronto ? T.sub : "#0A1622", border: "none", borderRadius: 10, padding: "14px", minHeight: 50, fontWeight: 800, fontSize: 15, cursor: !pronto ? "not-allowed" : "pointer" }}
          >
            {estado === "salvando" ? "Salvando…" : "Definir senha e entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
