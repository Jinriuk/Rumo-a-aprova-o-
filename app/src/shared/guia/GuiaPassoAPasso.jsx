/* Passo a passo guiado, tela a tela (roteiros em ./roteiros.js).

   useGuia({ roteiro, chave, irPara, podeIniciar }) devolve
     { elemento, abrir }
   `elemento` vai uma vez na tela; `abrir()` começa o guia do passo 1
   (é o que o botão "Guia" do cabeçalho chama).

   Primeira vez da conta neste navegador: aparece um CONVITE ("Quer que
   eu te mostre o sistema?"), não o guia direto. Aceitar começa o passo
   1; "Agora não" guarda que já foi oferecido. Concluir ou sair do guia
   também guarda. Nada disso vai ao banco.

   Cada passo chama irPara(aba): a aba troca de verdade, e o cartão
   (encostado embaixo, sem escurecer a tela) explica o que está nela. */
import { useEffect, useRef, useState } from "react";
import { useTema } from "../branding/BrandingContext.jsx";
import { guiaJaVisto, marcarGuiaVisto } from "./roteiros.js";

export function useGuia({ roteiro, chave, irPara, podeIniciar = true }) {
  // null = fechado; "convite"; ou o índice do passo.
  const [estado, setEstado] = useState(null);
  const conviteFeito = useRef(false);

  useEffect(() => {
    if (!podeIniciar || conviteFeito.current || !roteiro.length) return;
    conviteFeito.current = true;
    if (!guiaJaVisto(chave)) setEstado("convite");
  }, [podeIniciar, chave, roteiro.length]);

  const irParaPasso = (i) => {
    setEstado(i);
    irPara?.(roteiro[i].aba);
  };
  const fechar = () => { marcarGuiaVisto(chave); setEstado(null); };
  const abrir = () => { if (roteiro.length) irParaPasso(0); };

  const elemento = estado === null ? null : (
    <CartaoGuia
      convite={estado === "convite"}
      passo={typeof estado === "number" ? roteiro[estado] : null}
      indice={typeof estado === "number" ? estado : 0}
      total={roteiro.length}
      aoComecar={() => irParaPasso(0)}
      aoVoltar={() => irParaPasso(Math.max(0, estado - 1))}
      aoAvancar={() => (estado + 1 < roteiro.length ? irParaPasso(estado + 1) : fechar())}
      aoFechar={fechar}
    />
  );

  return { elemento, abrir };
}

function CartaoGuia({ convite, passo, indice, total, aoComecar, aoVoltar, aoAvancar, aoFechar }) {
  const T = useTema();
  const tituloRef = useRef(null);
  // leva o foco ao título a cada passo: leitor de tela anuncia a troca e
  // o teclado fica dentro do cartão
  useEffect(() => { tituloRef.current?.focus(); }, [convite, indice]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") aoFechar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aoFechar]);

  const ultimo = indice + 1 === total;
  const botao = (destaque) => ({
    border: `1px solid ${destaque ? T.gold : T.line}`, background: destaque ? T.gold : "transparent",
    color: destaque ? "#0A1622" : T.ink, borderRadius: 9, padding: "9px 14px", minHeight: 40,
    fontSize: 13, fontWeight: 700, cursor: "pointer",
  });

  return (
    <div className="guia-cartao" role="dialog" aria-modal="false" aria-label="Guia do sistema"
      style={{ position: "fixed", zIndex: 45, background: T.card, border: `1px solid ${T.gold}66`, borderTop: `3px solid ${T.gold}`, borderRadius: 14, boxShadow: "0 16px 48px #000c", padding: "14px 16px 14px" }}>
      <style>{`
        .guia-cartao { left: 12px; right: 12px; bottom: calc(76px + env(safe-area-inset-bottom)); }
        @media (min-width: 1024px) { .guia-cartao { left: auto; right: 24px; bottom: 24px; width: 380px; } }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: T.gold, textTransform: "uppercase", letterSpacing: 1 }}>
          {convite ? "Guia do sistema" : `Passo ${indice + 1} de ${total}`}
        </span>
        <button type="button" onClick={aoFechar} aria-label="Fechar o guia"
          style={{ marginLeft: "auto", border: "none", background: "transparent", color: T.sub, fontSize: 18, lineHeight: 1, cursor: "pointer", padding: 4 }}>×</button>
      </div>

      {convite ? (
        <>
          <h2 ref={tituloRef} tabIndex={-1} className="disp" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.ink, outline: "none" }}>
            Primeira vez aqui?
          </h2>
          <p style={{ margin: "6px 0 12px", fontSize: 13, color: T.sub, lineHeight: 1.55 }}>
            Posso te mostrar o sistema tela a tela, em {total} passos rápidos. Você pode sair quando quiser e reabrir depois pelo botão “Guia” no topo.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button type="button" style={botao(false)} onClick={aoFechar}>Agora não</button>
            <button type="button" style={botao(true)} onClick={aoComecar}>Começar o guia</button>
          </div>
        </>
      ) : (
        <>
          <h2 ref={tituloRef} tabIndex={-1} className="disp" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.ink, outline: "none" }}>
            {passo.titulo}
          </h2>
          <p aria-live="polite" style={{ margin: "6px 0 0", fontSize: 13, color: T.sub, lineHeight: 1.55 }}>{passo.texto}</p>
          {passo.dica && (
            <p style={{ margin: "8px 0 0", fontSize: 12.5, color: T.ink, lineHeight: 1.5, background: `${T.gold}12`, border: `1px solid ${T.gold}33`, borderRadius: 8, padding: "7px 10px" }}>
              {passo.dica}
            </p>
          )}
          <div aria-hidden="true" style={{ display: "flex", gap: 4, margin: "12px 0" }}>
            {Array.from({ length: total }, (_, i) => (
              <span key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= indice ? T.gold : T.line }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            {indice > 0 && <button type="button" style={botao(false)} onClick={aoVoltar}>Voltar</button>}
            <button type="button" style={botao(true)} onClick={aoAvancar}>{ultimo ? "Concluir" : "Próximo"}</button>
          </div>
        </>
      )}
    </div>
  );
}
