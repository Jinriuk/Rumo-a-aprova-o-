/* Desempenho Acumulado — a visão do guruja que o Doc 4 §9 já previa
   reaproveitar: tabela por disciplina (acertos, questões, % e tempo
   médio), treemap de tempo por disciplina e a linha de desempenho
   por meta. Tudo calculado dos registros que já existem. */
import React, { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Treemap,
} from "recharts";
import { Card, Empty } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { resumirRegistros } from "../../shared/metricas/agregados.js";

const fmtH = (min) => {
  if (!min) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h${String(m).padStart(2, "0")}m` : `${m}m`;
};

export function Acumulado({ registros, trilha }) {
  const T = useTema();
  const [ordem, setOrdem] = useState({ campo: "q", desc: true });
  const [vistaTreemap, setVistaTreemap] = useState("tempo"); // tempo | questoes
  const logs = registros.map((r) => ({ ...r, data: String(r.data) }));

  const linhas = useMemo(() => trilha.disciplinas.map((d) => {
    const ls = logs.filter((l) => l.disciplina_codigo === d.codigo);
    const q = ls.reduce((a, l) => a + (+l.questoes || 0), 0);
    const cd = ls.filter((l) => l.acertos !== null).reduce((a, l) => a + (+l.questoes || 0), 0);
    const cc = ls.filter((l) => l.acertos !== null).reduce((a, l) => a + (+l.acertos || 0), 0);
    const min = ls.reduce((a, l) => a + (+l.minutos || 0), 0);
    const sessoesComTempo = ls.filter((l) => +l.minutos > 0).length;
    return {
      codigo: d.codigo, nome: d.nome, abrev: d.abrev, cor: d.cor,
      acertos: cc, q, acc: cd ? Math.round((cc / cd) * 1000) / 10 : null,
      minutos: min, tempoMedio: sessoesComTempo ? Math.round(min / sessoesComTempo) : 0,
    };
  }).filter((x) => x.q > 0 || x.minutos > 0), [registros, trilha]);

  const total = useMemo(() => {
    const q = linhas.reduce((a, x) => a + x.q, 0);
    const acertos = linhas.reduce((a, x) => a + x.acertos, 0);
    const minutos = linhas.reduce((a, x) => a + x.minutos, 0);
    const sessoes = logs.filter((l) => +l.minutos > 0).length;
    return {
      q, acertos, minutos,
      acc: q ? Math.round((acertos / q) * 1000) / 10 : 0,
      tempoMedio: sessoes ? Math.round(minutos / sessoes) : 0,
    };
  }, [linhas]);

  const ordenadas = useMemo(() => {
    const arr = [...linhas].sort((a, b) => {
      const va = a[ordem.campo] ?? -1, vb = b[ordem.campo] ?? -1;
      return ordem.desc ? vb - va : va - vb;
    });
    return arr;
  }, [linhas, ordem]);

  const porMeta = useMemo(() => trilha.semanas.map((w) => {
    const wl = logs.filter((l) => l.data >= String(w.inicio) && l.data <= String(w.fim));
    return { label: `S${w.numero}`, acc: resumirRegistros(wl).acc };
  }), [registros, trilha]);

  const treemapDados = linhas
    .map((x) => ({ name: x.abrev, nomeCompleto: x.nome, size: vistaTreemap === "tempo" ? x.minutos : x.q, cor: x.cor }))
    .filter((x) => x.size > 0);
  const treemapTotal = treemapDados.reduce((a, x) => a + x.size, 0);

  const th = (campo, rotulo, alinha = "right") => (
    <th onClick={() => setOrdem({ campo, desc: ordem.campo === campo ? !ordem.desc : true })}
      style={{ padding: "9px 10px", textAlign: alinha, fontSize: 11.5, color: T.sub, textTransform: "uppercase", letterSpacing: 0.4, cursor: "pointer", whiteSpace: "nowrap", userSelect: "none" }}>
      {rotulo} {ordem.campo === campo ? (ordem.desc ? "↓" : "↑") : "⇅"}
    </th>
  );

  if (!linhas.length) return <Card><Empty txt="O desempenho acumulado aparece conforme os registros entram." /></Card>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.line}` }}>
          <div className="disp" style={{ fontSize: 15, fontWeight: 700 }}>Desempenho acumulado</div>
          <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>Cada disciplina: questões resolvidas, acerto e tempo estudado.</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.line}` }}>
                <th style={{ padding: "9px 10px", textAlign: "left", fontSize: 11.5, color: T.sub, textTransform: "uppercase", letterSpacing: 0.4 }}>Disciplina</th>
                {th("acertos", "Acertos")}
                {th("q", "Questões")}
                {th("acc", "% de acertos")}
                {th("minutos", "Tempo total")}
                {th("tempoMedio", "Tempo médio")}
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((x) => (
                <tr key={x.codigo} className="row" style={{ borderBottom: `1px solid ${T.line}` }}>
                  <td style={{ padding: "10px", fontSize: 13 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: x.cor }} />{x.nome}
                    </span>
                  </td>
                  <td className="num" style={{ padding: "10px", textAlign: "right", fontSize: 13 }}>{x.acertos}</td>
                  <td className="num" style={{ padding: "10px", textAlign: "right", fontSize: 13 }}>{x.q}</td>
                  <td className="num" style={{ padding: "10px", textAlign: "right", fontSize: 13, color: x.acc == null ? T.sub : x.acc >= 70 ? T.green : x.acc >= 55 ? T.gold : T.red, fontWeight: 700 }}>
                    {x.acc == null ? "—" : `${x.acc}%`}
                  </td>
                  <td className="num" style={{ padding: "10px", textAlign: "right", fontSize: 13, color: T.sub }}>{fmtH(x.minutos)}</td>
                  <td className="num" style={{ padding: "10px", textAlign: "right", fontSize: 13, color: T.sub }}>{fmtH(x.tempoMedio)}</td>
                </tr>
              ))}
              <tr style={{ background: T.bg }}>
                <td className="disp" style={{ padding: "11px 10px", fontWeight: 800, fontSize: 13.5 }}>TOTAL</td>
                <td className="num" style={{ padding: "11px 10px", textAlign: "right", fontWeight: 800 }}>{total.acertos}</td>
                <td className="num" style={{ padding: "11px 10px", textAlign: "right", fontWeight: 800 }}>{total.q}</td>
                <td className="num" style={{ padding: "11px 10px", textAlign: "right", fontWeight: 800, color: total.acc >= 70 ? T.green : T.gold }}>{total.acc}%</td>
                <td className="num" style={{ padding: "11px 10px", textAlign: "right", fontWeight: 800, color: T.sub }}>{fmtH(total.minutos)}</td>
                <td className="num" style={{ padding: "11px 10px", textAlign: "right", fontWeight: 800, color: T.sub }}>{fmtH(total.tempoMedio)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 }}>
        <Card>
          <div className="disp" style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Desempenho por meta</div>
          {porMeta.every((x) => x.acc == null) ? <Empty txt="Aparece conforme as semanas passam." /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={porMeta} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.line} />
                <XAxis dataKey="label" tick={{ fill: T.sub, fontSize: 11 }} axisLine={{ stroke: T.line }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: T.sub, fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
                <Tooltip contentStyle={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 8 }} formatter={(v) => [v == null ? "—" : `${v}%`, "acerto"]} />
                <Line type="monotone" dataKey="acc" stroke={T.gold} strokeWidth={2.5} dot={{ r: 4, fill: T.gold }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <div className="disp" style={{ fontSize: 15, fontWeight: 700 }}>Desempenho por disciplina</div>
            <div style={{ display: "flex", background: T.bg, borderRadius: 8, padding: 3, border: `1px solid ${T.line}` }}>
              {[["tempo", "Tempo"], ["questoes", "Questões"]].map(([k, lb]) => (
                <button key={k} onClick={() => setVistaTreemap(k)}
                  style={{ border: "none", background: vistaTreemap === k ? T.gold : "transparent", color: vistaTreemap === k ? "#0A1622" : T.sub, fontWeight: 600, fontSize: 12, padding: "6px 11px", borderRadius: 6 }}>
                  {lb}
                </button>
              ))}
            </div>
          </div>
          {treemapDados.length === 0 ? <Empty txt={vistaTreemap === "tempo" ? "Registre os minutos pra ver o tempo por disciplina." : "Sem questões ainda."} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <Treemap data={treemapDados} dataKey="size" stroke={T.bg} isAnimationActive={false}
                content={<CelulaTreemap total={treemapTotal} tema={T} />} />
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}

function CelulaTreemap({ x, y, width, height, name, nomeCompleto, size, total, tema, cor, root, index }) {
  if (width < 4 || height < 4 || size == null) return null;
  const corCel = cor ?? root?.children?.[index]?.cor ?? tema.gold;
  const pct = total ? Math.round((size / total) * 1000) / 10 : 0;
  const completo = nomeCompleto || name;
  // #16/#27 — toda célula é identificável no hover, mesmo as pequenas
  // (ex.: Português numa fatia estreita). O title nativo do SVG vira tooltip.
  const grande = width > 52 && height > 34;
  const media = width > 30 && height > 18;
  return (
    <g>
      <title>{completo} — {pct}%</title>
      <rect x={x} y={y} width={width} height={height} rx={4} fill={corCel} fillOpacity={0.85} stroke={tema.bg} strokeWidth={2} />
      {grande ? (
        <>
          <text x={x + width / 2} y={y + height / 2 - 4} textAnchor="middle" fill="#0A1622" fontWeight={800} fontSize={12}>{name}</text>
          <text x={x + width / 2} y={y + height / 2 + 12} textAnchor="middle" fill="#0A1622" fontWeight={600} fontSize={11}>{pct}%</text>
        </>
      ) : media ? (
        <text x={x + width / 2} y={y + height / 2 + 4} textAnchor="middle" fill="#0A1622" fontWeight={800} fontSize={11}>{name}</text>
      ) : null}
    </g>
  );
}
