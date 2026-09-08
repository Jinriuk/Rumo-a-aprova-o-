/* Etapa 7 / BLOCO B2 — troca obrigatória da senha temporária.
   App.jsx renderiza esta tela no lugar de QUALQUER área (aluno,
   responsável — e coordenação também, se um dia a flag chegar a valer
   pra ela) enquanto perfil.usuario.must_change_password for true.
   Nenhuma tela do app aparece atrás disto: é o gate, não um aviso. */
import React, { useId, useState } from "react";
import { BASE, FONTES_CSS } from "../../shared/ui/tema.js";
import * as db from "../../shared/data/index.js";
import { forcaSenha } from "../../shared/lib/senha.js";

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

// props: aoConcluir() — chamado depois que o servidor confirma a troca;
// quem chama (App.jsx) é responsável por recarregar o perfil, não esta
// tela — ela só sabe que terminou.
export default function TrocarSenhaObrigatoria({ nome, aoConcluir }) {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [estado, setEstado] = useState("idle"); // idle | salvando | erro
  const [erro, setErro] = useState("");
  const uid = useId();
  const idSenha = `${uid}-senha`, idConfirma = `${uid}-confirma`;

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
      await db.trocarSenha(senha);
      aoConcluir?.();
    } catch (err) {
      setErro(mensagemErro(err));
      setEstado("erro");
    }
  }

  const corForca = [T.red, T.red, T.gold, T.green][forca.nivel] ?? T.sub;

  return (
    <div style={{ background: `radial-gradient(1200px 600px at 50% -10%, ${T.bg2}, ${T.bg})`, minHeight: "100vh", color: T.ink, fontFamily: "Archivo, system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <style>{FONTES_CSS}</style>
      <div style={{ width: "100%", maxWidth: 380, background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ width: 42, height: 42, borderRadius: 9, background: `linear-gradient(135deg,${T.gold},#9c7d2e)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#0A1622", fontWeight: 700, fontSize: 20 }}>🔑</div>
          <div>
            <div style={{ color: T.gold, fontWeight: 800, letterSpacing: 1, fontSize: 12 }}>PRIMEIRO ACESSO</div>
            <div className="disp" style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1 }}>Escolha sua senha</div>
          </div>
        </div>

        <p style={{ fontSize: 13, color: T.sub, lineHeight: 1.6, marginBottom: 20, marginTop: 0 }}>
          {nome ? `Olá, ${nome}. ` : ""}A senha que você usou pra entrar foi gerada pela escola e é só temporária.
          Escolha uma senha SUA agora — a coordenação não vê nem guarda essa senha depois.
        </p>

        <form onSubmit={submit}>
          <label htmlFor={idSenha} style={lbl}>Nova senha</label>
          <input
            id={idSenha}
            type="password"
            value={senha}
            onChange={(e) => { setSenha(e.target.value); setErro(""); }}
            autoComplete="new-password"
            autoFocus
            placeholder="Mínimo 8 caracteres"
            aria-invalid={senha && !senhaOk ? true : undefined}
            style={{ ...inputS, borderColor: senha && !senhaOk ? T.red : T.line }}
          />
          {senha && (
            <div style={{ fontSize: 11.5, color: corForca, marginTop: -8, marginBottom: 12 }}>
              {forca.texto}
            </div>
          )}

          <label htmlFor={idConfirma} style={lbl}>Confirmar senha</label>
          <input
            id={idConfirma}
            type="password"
            value={confirmacao}
            onChange={(e) => { setConfirmacao(e.target.value); setErro(""); }}
            autoComplete="new-password"
            placeholder="Digite a senha novamente"
            aria-invalid={confirmacao && !igual ? true : undefined}
            style={{ ...inputS, borderColor: confirmacao && !igual ? T.red : T.line }}
          />
          {confirmacao && !igual && (
            <div style={{ fontSize: 11.5, color: T.red, marginTop: -8, marginBottom: 12 }}>
              As senhas não coincidem.
            </div>
          )}

          {erro && (
            <div role="alert" style={{ color: T.red, fontSize: 12.5, marginBottom: 12, padding: "10px 12px", background: `${T.red}14`, borderRadius: 8, border: `1px solid ${T.red}44` }}>
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={!pronto}
            style={{ width: "100%", marginTop: 4, background: !pronto ? T.line : T.gold, color: !pronto ? T.sub : "#0A1622", border: "none", borderRadius: 10, padding: "14px", minHeight: 50, fontWeight: 800, fontSize: 15, cursor: !pronto ? "not-allowed" : "pointer" }}
          >
            {estado === "salvando" ? "Salvando…" : "Definir senha e continuar"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => db.sair().catch(console.error)}
          style={{ display: "block", marginTop: 14, background: "none", border: "none", color: T.sub, fontSize: 12, cursor: "pointer", padding: 0, width: "100%", textAlign: "center" }}
        >
          Sair
        </button>
      </div>
    </div>
  );
}

function mensagemErro(erro) {
  if (erro?.estado === "senha_fraca") {
    // mensagem já pronta em pt-BR, vinda do servidor (trocar-senha); só
    // tira o prefixo "trocar-senha: " que falha() adiciona pro console.
    return erro.message?.replace(/^trocar-senha:\s*/i, "") || "Senha recusada. Tente uma combinação mais forte.";
  }
  return "Não foi possível salvar a senha agora. Tente novamente em instantes.";
}
