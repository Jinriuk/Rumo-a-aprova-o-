/* Tela de redefinição de senha — chamada quando o coordenador clica no
   link de acesso enviado pelo backoffice ou no "Esqueci minha senha".

   REGRA DESTA TELA: ela NÃO cria sessão. O `access_token` do link é lido
   à mão do hash da URL e usado só como credencial de uma chamada avulsa
   ao GoTrue (db.redefinirSenha). Nada é gravado na sessão compartilhada,
   então quem já estava logado neste navegador — SuperADM, coordenação,
   qualquer papel, em qualquer aba da mesma origem — continua logado.
   Era exatamente isso que quebrava antes, quando o SDK processava o hash
   sozinho e sobrescrevia a chave de localStorage da sessão ativa.

   Consequência de desenho, de propósito: no fim NÃO logamos ninguém.
   A senha muda, e o usuário entra de novo pelo login normal. */
import React, { useId, useState } from "react";
import { BASE, FONTES_CSS } from "../../shared/ui/tema.js";
import * as db from "../../shared/data/index.js";
import { forcaSenha } from "../../shared/lib/senha.js";
import {
  lerHashRecuperacao,
  mensagemLinkInvalido,
  mensagemErroRedefinicao,
  RECUPERACAO_VALIDA,
  RECUPERACAO_ERRO,
} from "../../shared/lib/recuperacao.js";

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

function voltarAoLogin() {
  // `replace` (e não `assign`) para o hash com o token não ficar na
  // pilha de navegação: o botão "voltar" do navegador não retorna a ele.
  window.location.replace("/");
}

function Moldura({ children }) {
  return (
    <div style={{ background: `radial-gradient(1200px 600px at 50% -10%, ${T.bg2}, ${T.bg})`, minHeight: "100vh", color: T.ink, fontFamily: "Archivo, system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <style>{FONTES_CSS}</style>
      <div style={{ width: "100%", maxWidth: 380, background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 22 }}>
        {children}
      </div>
    </div>
  );
}

function BotaoVoltar({ destaque = false }) {
  return (
    <button
      type="button"
      onClick={voltarAoLogin}
      style={destaque
        ? { width: "100%", marginTop: 18, background: T.gold, color: "#0A1622", border: "none", borderRadius: 10, padding: "14px", minHeight: 50, fontWeight: 800, fontSize: 15, cursor: "pointer" }
        : { display: "block", marginTop: 8, background: "none", border: "none", color: T.gold, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}
    >
      {destaque ? "Ir para o login" : "← Voltar ao login"}
    </button>
  );
}

export default function RedefinirSenha() {
  // Lido UMA vez, na montagem: o hash não muda enquanto a tela vive, e
  // guardar em estado evita reler `window` a cada render.
  const [link] = useState(() => lerHashRecuperacao(typeof window === "undefined" ? "" : window.location.hash));
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [estado, setEstado] = useState("idle"); // idle | salvando | sucesso | erro
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
      // Sem setSession, sem updateUser: só o token do link no header.
      await db.redefinirSenha(link.accessToken, senha);
      setEstado("sucesso");
      // Sem `db.sair()`: derrubar a sessão do cliente aqui seria derrubar
      // a de quem já estava logado no navegador — o bug que esta tela
      // existe para não repetir. Quem redefiniu entra pelo login normal.
      setTimeout(voltarAoLogin, 4000);
    } catch (err) {
      setErro(mensagemErroRedefinicao(err));
      setEstado("erro");
    }
  }

  const corForca = [T.red, T.red, T.gold, T.green][forca.nivel] ?? T.sub;

  // Link vencido, já usado ou ausente: mensagem explícita. Nunca tela em
  // branco e nunca redirecionamento silencioso para o login.
  if (link.tipo !== RECUPERACAO_VALIDA) {
    const texto = link.tipo === RECUPERACAO_ERRO
      ? mensagemLinkInvalido(link.codigo)
      : "Este endereço não tem um link de recuperação válido. Abra o link direto do e-mail que você recebeu, ou peça um novo na tela de login.";
    return (
      <Moldura>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <div className="disp" style={{ fontSize: 20, fontWeight: 700, color: T.gold, marginBottom: 10 }}>Link inválido</div>
          <p role="alert" style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.6, margin: 0 }}>{texto}</p>
          <BotaoVoltar destaque />
        </div>
      </Moldura>
    );
  }

  if (estado === "sucesso") {
    return (
      <Moldura>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
          <div className="disp" style={{ fontSize: 20, fontWeight: 700, color: T.green, marginBottom: 8 }}>Senha alterada!</div>
          <div role="status" style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.6 }}>
            Sua senha foi atualizada. Faça login com a senha nova para entrar.
          </div>
          <BotaoVoltar destaque />
        </div>
      </Moldura>
    );
  }

  return (
    <Moldura>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ width: 42, height: 42, borderRadius: 9, background: `linear-gradient(135deg,${T.gold},#9c7d2e)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#0A1622", fontWeight: 700, fontSize: 20 }}>⚓</div>
        <div>
          <div style={{ color: T.gold, fontWeight: 800, letterSpacing: 1, fontSize: 12 }}>COORDENAÇÃO</div>
          <div className="disp" style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1 }}>Definir senha</div>
        </div>
      </div>

      <p style={{ fontSize: 13, color: T.sub, lineHeight: 1.6, marginBottom: 20, marginTop: 0 }}>
        Escolha uma senha segura para acessar o painel de coordenação. Depois de salvar, entre com ela na tela de login.
      </p>

      <form onSubmit={submit}>
        <label htmlFor={idSenha} style={lbl}>Nova senha</label>
        <input
          id={idSenha}
          type="password"
          value={senha}
          onChange={(e) => { setSenha(e.target.value); setErro(""); }}
          autoComplete="new-password"
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
          <div style={{ color: T.red, fontSize: 12.5, marginBottom: 12, padding: "10px 12px", background: `${T.red}14`, borderRadius: 8, border: `1px solid ${T.red}44` }}>
            <span role="alert">{erro}</span>
            <BotaoVoltar />
          </div>
        )}

        <button
          type="submit"
          disabled={!pronto}
          style={{ width: "100%", marginTop: 4, background: !pronto ? T.line : T.gold, color: !pronto ? T.sub : "#0A1622", border: "none", borderRadius: 10, padding: "14px", minHeight: 50, fontWeight: 800, fontSize: 15, cursor: !pronto ? "not-allowed" : "pointer" }}
        >
          {estado === "salvando" ? "Salvando…" : "Salvar nova senha"}
        </button>
      </form>
    </Moldura>
  );
}
