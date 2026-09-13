/* Faixa fixa e pouco intrusiva que sinaliza ambiente de demonstração
   (Tarefa 3). Só renderiza quando EH_DEMO — ver ambiente.js. Não
   intercepta clique (pointerEvents: none) e não empurra o layout
   (position: fixed, sem alterar o fluxo do resto da página).

   I3 — compensação: "sem empurrar o layout" cobria o h1. A faixa é
   position:fixed top:0 com zIndex:9999, acima de QUALQUER cabeçalho
   sticky top:0 da árvore (Cabecalho.jsx, o header de AreaAdmin.jsx —
   FaixaDemo é irmã de AppRoteado em App.jsx, então cobre as duas). Em
   vez de fazer cada cabeçalho importar FaixaDemo (acoplamento que não
   existe hoje, e não deveria: um cabeçalho de tela não precisa saber
   que existe faixa de demo) publica a altura como variável CSS no
   `:root`. Quem tem `position: sticky` e pode ficar embaixo da faixa
   lê `var(--altura-faixa-demo, 0px)` no próprio `top` — 0px quando a
   faixa não está montada, então o consumidor não precisa de nenhuma
   lógica condicional própria. Um elemento sticky cujo `top` já viola
   sua posição de fluxo (0 < 20) nasce deslocado, não só ao rolar —
   resolve tanto a primeira pintura quanto o comportamento ao rolar. */
import React from "react";

export const ALTURA_FAIXA_DEMO = 20;

export function FaixaDemo() {
  return (
    <>
      <style>{`:root { --altura-faixa-demo: ${ALTURA_FAIXA_DEMO}px; }`}</style>
      <div
        role="status"
        aria-label="Ambiente de demonstração"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: ALTURA_FAIXA_DEMO,
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: 0.5,
          color: "#3A2E00",
          background: "#E8C468",
          pointerEvents: "none",
          fontFamily: "Archivo, system-ui, sans-serif",
        }}
      >
        AMBIENTE DE DEMONSTRAÇÃO — dados fictícios
      </div>
    </>
  );
}
