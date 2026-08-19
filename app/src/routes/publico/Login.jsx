/* Login — aluno/responsável entram com código; coordenação com e-mail+senha.
   D1B: campo senha com olhinho, "Esqueci minha senha" para coordenação,
   "Esqueci meu código de acesso" para aluno/responsável.

   UXG1+: esta é a única tela em que o produto se apresenta antes de
   pedir credencial, então é a que mais muda. O que entrou aqui é
   interação com função, nunca enfeite:
     • a cena chega em ordem (propósito → promessa → provas → formulário);
     • o cartão responde ao ponteiro com um foco de luz discreto;
     • a troca de papel desliza, em vez de piscar;
     • o código mostra a chave se completando (a MESMA regra dos 12
       caracteres que libera o botão), e não uma barra inventada;
     • Caps Lock avisa antes de o erro acontecer;
     • credencial recusada sacode o cartão uma vez;
     • enquanto o servidor verifica, a barra de envio prova que o
       pedido está vivo.
   Nada disso altera o fluxo: os mesmos estados, as mesmas chamadas,
   as mesmas mensagens. Tudo desliga com prefers-reduced-motion. */
import React, { useEffect, useId, useRef, useState } from "react";
import { BASE, FONTES_CSS } from "../../shared/ui/tema.js";
import { criarTrava } from "../../shared/lib/travaEnvio.js";
import * as db from "../../shared/data/index.js";

const T = BASE;

// Tamanho mínimo do código de acesso — é a regra que libera o botão
// (`normalizarCodigo(...).length >= 12`) e também o que a carga desenha.
const CODIGO_MIN = 12;

const PAPEIS = [
  ["codigo", "Aluno / Responsável", "Entra com o código entregue pela escola"],
  ["coordenacao", "Coordenação", "Entra com e-mail e senha"],
];

export default function Login() {
  const [modo, setModo] = useState("codigo"); // codigo | coordenacao
  const [tela, setTela] = useState("login");  // login | esqueciSenha | esqueciCodigo | confirmacao
  const [codigo, setCodigo] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [capsLigado, setCapsLigado] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // Conta as recusas para que a MESMA mensagem de erro sacuda o cartão
  // de novo (o texto não muda entre duas tentativas iguais).
  const [recusas, setRecusas] = useState(0);
  const [emailRecup, setEmailRecup] = useState("");
  const [msgConfirmacao, setMsgConfirmacao] = useState("");
  // AV2 MEL-P3-004: o login da coordenação leva ~6s (Supabase Auth). Para
  // não parecer travado, depois de ~2,5s mostramos um aviso de que segue
  // em andamento — feedback honesto enquanto a credencial é verificada.
  const [demorando, setDemorando] = useState(false);
  useEffect(() => {
    if (!busy) { setDemorando(false); return; }
    const t = setTimeout(() => setDemorando(true), 2500);
    return () => clearTimeout(t);
  }, [busy]);

  // Trava SÍNCRONA contra duplo envio do login e dos pedidos de
  // recuperação (FE1, tarefa 82). O `busy`/`disabled` só vale no
  // próximo render; o latch recusa o segundo disparo no mesmo tick
  // (duplo clique, clique + Enter). As telas nunca são simultâneas, um
  // latch só serve às três. Mantemos as mensagens de erro próprias
  // daqui (texto específico de login) — por isso não usamos o hook.
  const travaRef = useRef(null);
  if (travaRef.current === null) travaRef.current = criarTrava();

  // ids estáveis para associar cada <label> ao seu controle (a11y, UX1).
  const uid = useId();
  const idCodigo = `${uid}-codigo`, idEmail = `${uid}-email`, idSenha = `${uid}-senha`, idRecup = `${uid}-recup`;

  function recusar(mensagem) {
    setErr(mensagem);
    setRecusas((n) => n + 1);
  }

  async function entrar(e) {
    e?.preventDefault();
    if (!travaRef.current.tentar()) return;
    setBusy(true); setErr("");
    try {
      if (modo === "codigo") await db.entrarComCodigo(codigo);
      else await db.entrarComEmail(email.trim(), senha);
    } catch {
      recusar(modo === "codigo" ? "Código não reconhecido. Confira com a escola." : "E-mail ou senha incorretos.");
      setBusy(false);
    } finally {
      travaRef.current.liberar();
    }
  }

  async function solicitarSenha(e) {
    e?.preventDefault();
    if (!emailRecup.trim()) { recusar("Informe o e-mail."); return; }
    if (!travaRef.current.tentar()) return;
    setBusy(true); setErr("");
    try {
      await db.recuperarSenha(emailRecup.trim());
    } catch { /* mensagem genérica independentemente do resultado */ }
    finally { travaRef.current.liberar(); }
    setBusy(false);
    setMsgConfirmacao("Se este e-mail estiver cadastrado, enviaremos instruções de recuperação.");
    setTela("confirmacao");
  }

  const inputS = { width: "100%", background: T.bg, border: `1px solid ${err ? T.red : T.line}`, color: T.ink, borderRadius: 10, padding: "13px 14px" };
  const codigoLimpo = db.normalizarCodigo(codigo);
  const pronto = modo === "codigo" ? codigoLimpo.length >= CODIGO_MIN : email && senha;
  const emailRecupValido = emailRecup.trim().length > 0 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailRecup.trim());

  // ── Tela de confirmação de recuperação ──
  if (tela === "confirmacao") {
    return (
      <Wrapper recusas={recusas}>
        <LogoTopo />
        <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>✉️</div>
          <div className="disp" style={{ fontSize: 17, fontWeight: 700, color: T.ink, marginBottom: 8 }}>Solicitação recebida</div>
          <div style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.6 }}>{msgConfirmacao}</div>
        </div>
        <button className="login-primary" onClick={() => { setTela("login"); setEmailRecup(""); setErr(""); }}
          style={{ width: "100%", marginTop: 8, background: T.gold, color: "#0A1622", border: "none", borderRadius: 10, padding: "14px", minHeight: 50, fontWeight: 800, fontSize: 15 }}>
          ← Voltar ao login
        </button>
      </Wrapper>
    );
  }

  // ── Tela "Esqueci minha senha" (coordenação) ──
  if (tela === "esqueciSenha") {
    return (
      <Wrapper recusas={recusas}>
        <LogoTopo />
        <div style={{ fontSize: 13, color: T.sub, marginBottom: 16, lineHeight: 1.5 }}>
          Informe o e-mail da sua conta de coordenação. Enviaremos instruções de recuperação.
        </div>
        <form onSubmit={solicitarSenha}>
          <label htmlFor={idRecup} style={lblS}>E-mail</label>
          <input className="login-input" id={idRecup} type="email" value={emailRecup} onChange={(e) => { setEmailRecup(e.target.value); setErr(""); }}
            placeholder="coord@escola.com.br" autoFocus style={{ ...inputS, marginBottom: 12 }} />
          {err && <div className="login-erro" role="alert" style={{ marginTop: 0, marginBottom: 8 }}>{err}</div>}
          <button className="login-primary" type="submit" disabled={busy || !emailRecupValido} data-carregando={busy ? "true" : undefined}
            style={{ width: "100%", background: (busy || !emailRecupValido) ? T.line : T.gold, color: (busy || !emailRecupValido) ? T.sub : "#0A1622", border: "none", borderRadius: 10, padding: "14px", minHeight: 50, fontWeight: 800, fontSize: 15 }}>
            {busy ? "Enviando…" : "Enviar instruções"}
            {busy && <span className="login-loading-bar" aria-hidden="true" />}
          </button>
        </form>
        <BotaoVoltar onClick={() => { setTela("login"); setEmailRecup(""); setErr(""); }} />
      </Wrapper>
    );
  }

  // ── Tela "Esqueci meu código de acesso" (aluno/responsável) ──
  // FIX2 (P1-5): a versão anterior coletava um e-mail e gravava numa tabela
  // que NÃO existe (`solicitacoes_acesso`) — o usuário via "solicitação
  // recebida" e nada acontecia. Sem fila real e sem e-mail transacional de
  // aluno (decisão de produto pendente), a única resposta honesta é
  // orientar: o código é emitido e reenviado PELA ESCOLA, que já tem essa
  // ferramenta no painel (reenvio/regeração de acesso). Nada de formulário
  // que finge enviar.
  if (tela === "esqueciCodigo") {
    return (
      <Wrapper recusas={recusas}>
        <LogoTopo />
        <div style={{ textAlign: "center", padding: "4px 0 8px" }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>🎖️</div>
          <div className="disp" style={{ fontSize: 16.5, fontWeight: 700, color: T.ink, marginBottom: 10 }}>
            Seu código é entregue pela escola
          </div>
        </div>
        <div style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.65, marginBottom: 14 }}>
          O código de acesso do aluno e do responsável é gerado pela
          coordenação da escola — por segurança, ele não é recuperado por
          e-mail neste painel.
        </div>
        <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 14px", fontSize: 13, color: T.sub, lineHeight: 1.6 }}>
          <b style={{ color: T.ink }}>Como recuperar:</b> fale com a coordenação
          da sua escola (secretaria ou responsável pela plataforma) e peça um
          novo código. É a coordenação que gera e entrega o acesso, pelo
          painel da escola.
        </div>
        <BotaoVoltar onClick={() => { setTela("login"); setErr(""); }} />
      </Wrapper>
    );
  }

  // ── Tela de login principal ──
  return (
    <Wrapper recusas={recusas}>
      <LogoTopo />

      <SeletorPapel modo={modo} aoTrocar={(id) => { setModo(id); setErr(""); setCapsLigado(false); }} />

      <form onSubmit={entrar}>
        {/* A troca de papel remonta os campos (key): a transição é vista,
            e nenhum valor do outro modo fica pendurado na tela. */}
        <div className="login-fields" key={modo}>
          {modo === "codigo" ? (
            <>
              <label htmlFor={idCodigo} style={lblS}>Código de acesso</label>
              <input className="login-input" id={idCodigo} value={codigo} autoComplete="off" autoCapitalize="characters"
                onChange={(e) => { setCodigo(e.target.value.toUpperCase()); setErr(""); }}
                placeholder="Ex.: LUCASDEMO2026"
                style={{ ...inputS, letterSpacing: 1.5, textAlign: "center", fontFamily: "monospace" }} />
              <CargaCodigo preenchidos={codigoLimpo.length} />
            </>
          ) : (
            <>
              <label htmlFor={idEmail} style={lblS}>E-mail</label>
              <input className="login-input" id={idEmail} type="email" value={email} placeholder="coordenacao@escola.com.br"
                onChange={(e) => { setEmail(e.target.value); setErr(""); }}
                style={{ ...inputS, marginBottom: 12 }} />
              <label htmlFor={idSenha} style={lblS}>Senha</label>
              <div style={{ position: "relative" }}>
                <input className="login-input" id={idSenha} type={mostrarSenha ? "text" : "password"} value={senha}
                  placeholder="Senha de acesso"
                  onChange={(e) => { setSenha(e.target.value); setErr(""); }}
                  onKeyUp={(e) => verCapsLock(e, setCapsLigado)}
                  onKeyDown={(e) => verCapsLock(e, setCapsLigado)}
                  onBlur={() => setCapsLigado(false)}
                  style={{ ...inputS, paddingRight: 46 }} />
                <button type="button" onClick={() => setMostrarSenha((v) => !v)} tabIndex={-1}
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: T.sub, cursor: "pointer", padding: 4, fontSize: 18, lineHeight: 1 }}>
                  {mostrarSenha ? "🙈" : "👁"}
                </button>
              </div>
              {capsLigado && (
                <div className="login-aviso" role="status">
                  ⇪ Caps Lock ligado — a senha diferencia maiúsculas de minúsculas.
                </div>
              )}
            </>
          )}
        </div>

        {err && <div className="login-erro" role="alert">{err}</div>}

        <button className="login-primary" type="submit" disabled={busy || !pronto} data-carregando={busy ? "true" : undefined}
          style={{ width: "100%", marginTop: 16, background: (busy || !pronto) ? T.line : T.gold, color: (busy || !pronto) ? T.sub : "#0A1622", border: "none", borderRadius: 10, padding: "14px", minHeight: 50, fontWeight: 800, fontSize: 15 }}>
          {busy ? "Entrando…" : "Entrar"}
          {busy && <span className="login-loading-bar" aria-hidden="true" />}
        </button>
        {demorando && (
          <div role="status" aria-live="polite" style={{ fontSize: 12, color: T.sub, marginTop: 10, textAlign: "center", lineHeight: 1.5 }}>
            Verificando suas credenciais com segurança… só um instante.
          </div>
        )}
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

      {modo === "codigo" && (
        <div style={{ fontSize: 11.5, color: T.sub, marginTop: 12, lineHeight: 1.5, textAlign: "center" }}>
          O código do aluno e do responsável é gerado e entregue pela escola.
        </div>
      )}
    </Wrapper>
  );
}

const lblS = { fontSize: 12, color: T.sub, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 0.4 };

// Nem todo evento de teclado traz o estado do modificador (teclado
// virtual, por exemplo). Sem informação, não inventamos aviso.
function verCapsLock(e, definir) {
  if (typeof e.getModifierState !== "function") return;
  definir(e.getModifierState("CapsLock"));
}

/* Controle segmentado do papel. Continuam sendo dois <button> com
   aria-pressed (é o que a leitura de tela e a suíte E2E enxergam); o
   que muda é o realce, que DESLIZA de um para o outro — a troca vira
   um movimento visto, não um pisca. Setas navegam entre as opções. */
function SeletorPapel({ modo, aoTrocar }) {
  const refs = useRef([]);
  const ativo = Math.max(0, PAPEIS.findIndex(([id]) => id === modo));

  function navegar(e) {
    const passo = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1
      : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!passo) return;
    e.preventDefault();
    const alvo = (ativo + passo + PAPEIS.length) % PAPEIS.length;
    aoTrocar(PAPEIS[alvo][0]);
    refs.current[alvo]?.focus();
  }

  return (
    <div className="login-role-switch" role="group" aria-label="Como você vai entrar"
      onKeyDown={navegar} style={{ "--papel-ativo": ativo }}>
      <span className="login-role-pill" aria-hidden="true" />
      {PAPEIS.map(([id, titulo, desc], i) => {
        const on = modo === id;
        return (
          <button className="login-role" type="button" key={id} aria-pressed={on}
            ref={(el) => { refs.current[i] = el; }}
            onClick={() => aoTrocar(id)}
            style={{ textAlign: "left", border: `1px solid ${T.line}`, background: on ? T.cardHi : T.bg, color: T.ink, borderRadius: 10, padding: "12px 14px", minHeight: 48 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{titulo}</div>
            <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>{desc}</div>
          </button>
        );
      })}
    </div>
  );
}

/* A "chave" se completando. Cada traço é um caractere já digitado,
   contra o mínimo REAL de validação — quando fecha, o botão libera.
   O desenho é decorativo (aria-hidden); quem usa leitor de tela
   recebe o aviso de código completo uma única vez. */
function CargaCodigo({ preenchidos }) {
  const completo = preenchidos >= CODIGO_MIN;
  const acesos = Math.min(preenchidos, CODIGO_MIN);
  return (
    <>
      <div className="login-code-charge" aria-hidden="true" data-completo={completo ? "true" : undefined}>
        {Array.from({ length: CODIGO_MIN }, (_, i) => (
          <span key={i} data-on={i < acesos ? "true" : undefined} />
        ))}
      </div>
      <div className="login-hint">
        <span aria-hidden="true">
          {completo ? `${preenchidos} caracteres` : `${preenchidos} de ${CODIGO_MIN} caracteres`}
        </span>
        {completo ? <b role="status">Código completo</b> : <span aria-hidden="true">Sem espaços ou traços</span>}
      </div>
    </>
  );
}

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

/* Foco de luz sobre o cartão. As coordenadas do ponteiro viram
   variáveis CSS dentro de um requestAnimationFrame — nenhum estado
   de React é tocado, então mover o mouse não re-renderiza nada.
   Só liga em ponteiro fino (no toque não existe hover) e quando o
   usuário não pediu redução de movimento. */
function useFocoDeLuz() {
  const ref = useRef(null);
  useEffect(() => {
    const alvo = ref.current;
    if (!alvo || typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let quadro = 0, x = 50, y = 0;
    const pintar = () => {
      quadro = 0;
      alvo.style.setProperty("--luz-x", `${x}%`);
      alvo.style.setProperty("--luz-y", `${y}%`);
    };
    const mover = (e) => {
      const r = alvo.getBoundingClientRect();
      if (!r.width || !r.height) return;
      x = ((e.clientX - r.left) / r.width) * 100;
      y = ((e.clientY - r.top) / r.height) * 100;
      alvo.dataset.luz = "true";
      if (!quadro) quadro = requestAnimationFrame(pintar);
    };
    const sair = () => {
      if (quadro) cancelAnimationFrame(quadro);
      quadro = 0;
      delete alvo.dataset.luz;
    };

    alvo.addEventListener("pointermove", mover);
    alvo.addEventListener("pointerleave", sair);
    return () => {
      alvo.removeEventListener("pointermove", mover);
      alvo.removeEventListener("pointerleave", sair);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, []);
  return ref;
}

/* Sacode o cartão UMA vez a cada recusa. O atributo é retirado e
   recolocado entre quadros porque uma animação CSS não recomeça
   sozinha quando o valor do atributo não muda (duas tentativas com
   o mesmo erro). */
function useTremor(recusas, ref) {
  useEffect(() => {
    const alvo = ref.current;
    if (!alvo || !recusas) return;
    delete alvo.dataset.tremor;
    void alvo.offsetWidth; // força o navegador a reiniciar a animação
    alvo.dataset.tremor = "true";
  }, [recusas, ref]);
}

function HistoriaLogin() {
  return (
    <section className="login-story" aria-label="Sua jornada de preparação">
      <div className="login-kicker" style={{ "--entrada": 0 }}><span aria-hidden="true">◆</span> Central de preparação</div>
      <h1 style={{ "--entrada": 1 }}>Sua aprovação vira uma <em>missão possível.</em></h1>
      <p style={{ "--entrada": 2 }}>
        Entre, veja o alvo mais importante de hoje e avance com um plano que
        transforma constância, questões e domínio em progresso visível.
      </p>
      <div className="login-proof-grid" style={{ "--entrada": 3 }} aria-label="Como a experiência funciona">
        <div className="login-proof"><strong>01</strong><span>missão central por vez</span></div>
        <div className="login-proof"><strong>XP</strong><span>concedido pelo progresso real</span></div>
        <div className="login-proof"><strong>Ritmo</strong><span>semana, ofensiva e domínio</span></div>
      </div>
    </section>
  );
}

function Wrapper({ children, recusas = 0 }) {
  const cartao = useFocoDeLuz();
  useTremor(recusas, cartao);
  return (
    <div className="login-shell" style={{
      "--ui-bg": T.bg, "--ui-bg-2": T.bg2, "--ui-card": T.card,
      "--ui-card-hi": T.cardHi, "--ui-line": T.line, "--ui-ink": T.ink,
      "--ui-sub": T.sub, "--ui-accent": T.gold, "--ui-green": T.green,
      "--ui-red": T.red,
    }}>
      <style>{FONTES_CSS}</style>
      <div className="login-layout">
        <HistoriaLogin />
        <main className="login-card" ref={cartao}>
          {children}
        </main>
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
