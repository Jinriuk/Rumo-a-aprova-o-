/* Cronômetro de estudo (Fase 4 do doc central). Fluxo:
   Iniciar → conta · Pausar → para E mostra cronômetro de PAUSA +
   duas opções: Retomar ou Finalizar (manda o tempo pro registro).
   Baseado em TIMESTAMPS (não perde tempo com a aba em segundo
   plano) e persistido no localStorage (sobrevive a F5). */
import React, { useEffect, useState } from "react";
import { useTema } from "../branding/BrandingContext.jsx";

const CHAVE = "rumo-cronometro-v1";

const fmt = (ms) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

function carregar() {
  try {
    const x = JSON.parse(localStorage.getItem(CHAVE));
    if (x && ["rodando", "pausa"].includes(x.fase) && x.marcoMs > 0) return x;
  } catch { /* estado corrompido: começa zerado */ }
  return { fase: "parado", acumuladoMs: 0, marcoMs: 0 };
}

export function Cronometro({ aoFinalizar }) {
  const T = useTema();
  const [st, setSt] = useState(carregar);
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    if (st.fase === "parado") localStorage.removeItem(CHAVE);
    else localStorage.setItem(CHAVE, JSON.stringify(st));
  }, [st]);

  useEffect(() => {
    if (st.fase === "parado") return;
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [st.fase]);

  const estudoMs = st.acumuladoMs + (st.fase === "rodando" ? Math.max(0, agora - st.marcoMs) : 0);
  const pausaMs = st.fase === "pausa" ? Math.max(0, agora - st.marcoMs) : 0;
  const minutos = Math.max(1, Math.round(estudoMs / 60000));

  const iniciar = () => { setAgora(Date.now()); setSt({ fase: "rodando", acumuladoMs: st.acumuladoMs, marcoMs: Date.now() }); };
  const pausar = () => setSt({ fase: "pausa", acumuladoMs: estudoMs, marcoMs: Date.now() });
  const zerar = () => setSt({ fase: "parado", acumuladoMs: 0, marcoMs: 0 });
  const finalizar = () => { aoFinalizar?.(minutos); zerar(); };

  const btn = (extra) => ({ border: `1px solid ${T.line}`, background: T.bg, color: T.ink, borderRadius: 8, padding: "8px 13px", fontSize: 12.5, fontWeight: 700, minHeight: 38, whiteSpace: "nowrap", ...extra });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, background: T.card, border: `1px solid ${st.fase === "rodando" ? T.gold : T.line}`, borderRadius: 12, padding: "8px 12px", flexWrap: "wrap" }}>
      <div style={{ minWidth: 96 }}>
        <div style={{ fontSize: 9.5, color: T.sub, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {st.fase === "rodando" ? "● estudando" : st.fase === "pausa" ? "em pausa" : "Cronômetro"}
        </div>
        <span className="num disp" style={{ fontSize: 19, fontWeight: 800, color: st.fase === "rodando" ? T.gold : T.ink, lineHeight: 1.1 }}>{fmt(estudoMs)}</span>
      </div>

      {/* cronômetro de PAUSA, visível enquanto pausado */}
      {st.fase === "pausa" && (
        <div style={{ borderLeft: `1px solid ${T.line}`, paddingLeft: 10 }}>
          <div style={{ fontSize: 9.5, color: T.red, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>⏸ pausa</div>
          <span className="num" style={{ fontSize: 15, fontWeight: 700, color: T.red }}>{fmt(pausaMs)}</span>
        </div>
      )}

      {st.fase === "parado" && (
        <button onClick={iniciar} style={btn({ background: T.gold, color: "#0A1622", border: "none" })}>▶ Iniciar estudo</button>
      )}
      {st.fase === "rodando" && (
        <button onClick={pausar} style={btn({ background: T.goldSoft, color: T.gold, borderColor: T.gold })}>⏸ Pausar</button>
      )}
      {st.fase === "pausa" && (
        <>
          <button onClick={iniciar} style={btn({ background: T.gold, color: "#0A1622", border: "none" })}>▶ Retomar</button>
          <button onClick={finalizar} style={btn({ borderColor: T.green, color: T.green })}>■ Finalizar → registrar {minutos}min</button>
          <button onClick={zerar} title="Descartar tempo" style={btn({ color: T.sub, padding: "8px 10px" })}>↺</button>
        </>
      )}
    </div>
  );
}
