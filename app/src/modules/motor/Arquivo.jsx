/* Arquivo — as metas anteriores em grade (ideia do guruja), com a
   contagem por estado e o sinal de pendência. Tudo leitura: o
   passado não se edita; quem fecha meta é a virada no servidor. */
import React, { useState } from "react";
import { Card, Empty } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { fmtBR } from "../../shared/regras/regras.js";

export function Arquivo({ metas, trilha, registros }) {
  const T = useTema();
  const [aberta, setAberta] = useState(null);

  if (!metas?.length) return <Card><Empty txt="Nenhuma meta no arquivo ainda. Elas se acumulam aqui a cada virada de semana." /></Card>;

  const logs = registros.map((r) => ({ ...r, data: String(r.data) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div className="disp" style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Histórico da jornada</div>
        <div style={{ fontSize: 12.5, color: T.sub, marginBottom: 14 }}>Semana a semana: o que foi a missão, o que você cumpriu e o que rendeu. Toque numa semana para ver os detalhes.</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 10 }}>
          {metas.map((meta) => {
            const itens = meta.meta_atividades ?? [];
            const feitas = itens.filter((x) => x.estado === "concluida").length;
            const ignoradas = itens.filter((x) => x.estado === "ignorada").length;
            const pendentes = itens.length - feitas - ignoradas;
            const ativa = meta.status === "ativa";
            const comPendencia = !ativa && pendentes > 0;
            const sel = aberta === meta.id;
            const semana = trilha.semanas.find((s) => s.numero === meta.semana_numero);

            // o que a semana RENDEU (questões, acerto, tempo)
            const wl = logs.filter((l) => l.data >= String(meta.inicio) && l.data <= String(meta.fim));
            const q = wl.reduce((a, l) => a + (+l.questoes || 0), 0);
            const cd = wl.filter((l) => l.acertos !== null).reduce((a, l) => a + (+l.questoes || 0), 0);
            const cc = wl.filter((l) => l.acertos !== null).reduce((a, l) => a + (+l.acertos || 0), 0);
            const acc = cd ? Math.round((cc / cd) * 100) : null;
            const min = wl.reduce((a, l) => a + (+l.minutos || 0), 0);

            return (
              <button key={meta.id} onClick={() => setAberta(sel ? null : meta.id)}
                style={{ textAlign: "left", background: T.bg, border: `1.5px solid ${sel || ativa ? T.gold : T.line}`, borderRadius: 12, padding: 13, color: T.ink }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                  <span className="disp" style={{ fontWeight: 700, fontSize: 14.5 }}>Semana {meta.semana_numero}</span>
                  {ativa ? (
                    <span style={{ fontSize: 9.5, fontWeight: 800, color: "#0A1622", background: T.gold, borderRadius: 5, padding: "2px 7px" }}>AGORA</span>
                  ) : comPendencia ? (
                    <span style={{ fontSize: 9.5, fontWeight: 800, color: "#0A1622", background: T.red, borderRadius: 5, padding: "2px 7px" }}>PARCIAL</span>
                  ) : (
                    <span style={{ fontSize: 9.5, fontWeight: 800, color: "#0A1622", background: T.green, borderRadius: 5, padding: "2px 7px" }}>CONCLUÍDA</span>
                  )}
                </div>
                {semana?.foco && <div style={{ fontSize: 11.5, color: T.sub, fontStyle: "italic", marginTop: 5, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{semana.foco}</div>}

                {/* barra de cumprimento */}
                <div style={{ height: 5, background: T.bg2, borderRadius: 3, overflow: "hidden", marginTop: 9 }}>
                  <div style={{ width: `${itens.length - ignoradas > 0 ? Math.round((feitas / (itens.length - ignoradas)) * 100) : 0}%`, height: "100%", background: `linear-gradient(90deg,${T.gold},${T.green})` }} />
                </div>
                <div style={{ display: "flex", gap: 9, fontSize: 11.5, fontWeight: 700, marginTop: 7 }}>
                  <span style={{ color: T.green }}>● {feitas} feitas</span>
                  {pendentes > 0 && <span style={{ color: T.sub }}>○ {pendentes} pend.</span>}
                  {ignoradas > 0 && <span style={{ color: T.red }}>● {ignoradas} adiadas</span>}
                </div>

                {/* o que rendeu */}
                <div className="num" style={{ display: "flex", gap: 10, fontSize: 11, color: T.sub, marginTop: 8, borderTop: `1px solid ${T.line}`, paddingTop: 8, flexWrap: "wrap" }}>
                  <span><b style={{ color: T.ink }}>{q}</b> questões</span>
                  <span>acerto <b style={{ color: acc == null ? T.sub : acc >= 70 ? T.green : T.gold }}>{acc == null ? "—" : `${acc}%`}</b></span>
                  {min > 0 && <span><b style={{ color: T.ink }}>{Math.floor(min / 60)}h{String(min % 60).padStart(2, "0")}</b></span>}
                </div>
                <div style={{ fontSize: 10.5, color: T.sub, marginTop: 7 }}>
                  {fmtBR(String(meta.inicio))}–{fmtBR(String(meta.fim))} · <span style={{ color: T.gold, fontWeight: 700 }}>{sel ? "fechar ▴" : "ver detalhes ▾"}</span>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {aberta && <DetalheMeta meta={metas.find((x) => x.id === aberta)} trilha={trilha} logs={logs} />}
    </div>
  );
}

function DetalheMeta({ meta, trilha, logs }) {
  const T = useTema();
  if (!meta) return null;

  const wl = logs.filter((l) => l.data >= String(meta.inicio) && l.data <= String(meta.fim));
  const q = wl.reduce((a, l) => a + (+l.questoes || 0), 0);
  const min = wl.reduce((a, l) => a + (+l.minutos || 0), 0);
  const cd = wl.filter((l) => l.acertos !== null).reduce((a, l) => a + (+l.questoes || 0), 0);
  const cc = wl.filter((l) => l.acertos !== null).reduce((a, l) => a + (+l.acertos || 0), 0);
  const acc = cd ? Math.round((cc / cd) * 100) : null;

  const itens = (meta.meta_atividades ?? [])
    .map((ma) => ({ ...ma, atividade: trilha.atividadesPorId[ma.atividade_modelo_id] }))
    .filter((x) => x.atividade)
    .sort((a, b) => a.atividade.ordem - b.atividade.ordem);

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <div className="disp" style={{ fontSize: 15, fontWeight: 700 }}>Semana {meta.semana_numero} em detalhe</div>
        <div style={{ fontSize: 12, color: T.sub }}>
          {q} questões{acc !== null ? ` · ${acc}% acerto` : ""}{min ? ` · ${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}m` : ""}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {itens.map((item) => {
          const cor = item.estado === "concluida" ? T.green : item.estado === "ignorada" ? T.red : T.sub;
          return (
            <div key={item.id} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "7px 4px", borderBottom: `1px solid ${T.line}` }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: cor, marginTop: 5, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12.5, color: item.estado === "pendente" ? T.ink : T.sub, textDecoration: item.estado === "concluida" ? "line-through" : "none" }}>
                {item.atividade.texto}
              </span>
              <span style={{ fontSize: 10.5, color: cor, fontWeight: 700, textTransform: "uppercase" }}>{item.estado}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
