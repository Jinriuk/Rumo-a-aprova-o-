/* Cronômetro de estudo (ideia do guruja): roda no topo da área do
   aluno e, ao parar, manda os minutos direto para o registro —
   menos digitação, mais registro fiel. Só estado de tela. */
import React, { useEffect, useRef, useState } from "react";
import { useTema } from "../branding/BrandingContext.jsx";

const fmt = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

export function Cronometro({ aoUsarMinutos }) {
  const T = useTema();
  const [rodando, setRodando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    if (rodando) {
      ref.current = setInterval(() => setSegundos((s) => s + 1), 1000);
    }
    return () => clearInterval(ref.current);
  }, [rodando]);

  const minutos = Math.round(segundos / 60);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.card, border: `1px solid ${rodando ? T.gold : T.line}`, borderRadius: 10, padding: "6px 10px", flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, color: T.sub, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>Cronômetro</span>
      <span className="num disp" style={{ fontSize: 18, fontWeight: 700, color: rodando ? T.gold : T.ink, minWidth: 86, textAlign: "center" }}>{fmt(segundos)}</span>
      <button onClick={() => setRodando(!rodando)}
        style={{ border: `1px solid ${T.line}`, background: rodando ? T.goldSoft : T.bg, color: rodando ? T.gold : T.ink, borderRadius: 7, padding: "6px 12px", fontSize: 12.5, fontWeight: 700, minHeight: 34 }}>
        {rodando ? "⏸ Pausar" : segundos > 0 ? "▶ Continuar" : "▶ Iniciar"}
      </button>
      {segundos > 0 && !rodando && (
        <>
          <button onClick={() => setSegundos(0)}
            style={{ border: `1px solid ${T.line}`, background: "transparent", color: T.sub, borderRadius: 7, padding: "6px 10px", fontSize: 12.5, minHeight: 34 }}>
            ↺
          </button>
          {minutos >= 1 && (
            <button onClick={() => { aoUsarMinutos?.(minutos); setSegundos(0); }}
              style={{ border: "none", background: T.gold, color: "#0A1622", borderRadius: 7, padding: "6px 12px", fontSize: 12.5, fontWeight: 800, minHeight: 34 }}>
              → Registrar {minutos}min
            </button>
          )}
        </>
      )}
    </div>
  );
}
