/* Faixa fixa e pouco intrusiva que sinaliza ambiente de demonstração
   (Tarefa 3). Só renderiza quando EH_DEMO — ver ambiente.js. Não
   intercepta clique (pointerEvents: none) e não empurra o layout
   (position: fixed, sem alterar o fluxo do resto da página). */
import React from "react";

export function FaixaDemo() {
  return (
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
        height: 20,
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
  );
}
