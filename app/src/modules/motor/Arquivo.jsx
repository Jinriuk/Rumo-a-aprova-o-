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
        <div className="disp" style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Arquivo</div>
        <div style={{ fontSize: 12, color: T.sub, marginBottom: 14 }}>Acesse suas metas anteriores e veja o que ficou pra trás.</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 10 }}>
          {metas.map((meta) => {
            const itens = meta.meta_atividades ?? [];
            const feitas = itens.filter((x) => x.estado === "concluida").length;
            const ignoradas = itens.filter((x) => x.estado === "ignorada").length;
            const pendentes = itens.length - feitas - ignoradas;
            const ativa = meta.status === "ativa";
            const comPendencia = !ativa && pendentes > 0;
            const sel = aberta === meta.id;
            return (
              <button key={meta.id} onClick={() => setAberta(sel ? null : meta.id)}
                style={{ textAlign: "left", background: T.bg, border: `1.5px solid ${sel || ativa ? T.gold : T.line}`, borderRadius: 10, padding: 12, color: T.ink }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <span className="disp" style={{ fontWeight: 700, fontSize: 13.5 }}>Semana {meta.semana_numero}</span>
                  {ativa ? (
                    <span style={{ fontSize: 9.5, fontWeight: 800, color: "#0A1622", background: T.gold, borderRadius: 5, padding: "2px 6px" }}>AGORA</span>
                  ) : comPendencia ? (
                    <span style={{ fontSize: 9.5, fontWeight: 800, color: "#0A1622", background: T.red, borderRadius: 5, padding: "2px 6px" }}>PENDÊNCIAS</span>
                  ) : (
                    <span style={{ fontSize: 9.5, fontWeight: 800, color: "#0A1622", background: T.green, borderRadius: 5, padding: "2px 6px" }}>FECHADA</span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: T.sub, marginBottom: 8 }}>Atividades: {itens.length}</div>
                <div style={{ display: "flex", gap: 10, fontSize: 12, fontWeight: 700 }}>
                  <span style={{ color: T.sub }}>○ {pendentes}</span>
                  <span style={{ color: T.green }}>● {feitas}</span>
                  <span style={{ color: T.red }}>● {ignoradas}</span>
                </div>
                <div style={{ fontSize: 10.5, color: T.sub, marginTop: 8 }}>
                  {fmtBR(String(meta.inicio))}–{fmtBR(String(meta.fim))}
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
