/* "Radar de Bordo" — leitura interpretada do desempenho do aluno
   (ref. designs): cards de insight ANTES dos gráficos, eficiência
   por setor (acerto por matéria) e trajetória de precisão por
   semana. Estado vazio inteligente quando há pouco dado. */
import React from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { SectionCard, EmptyState, InsightCard } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { calcularInsights } from "./metricas.js";

export function RadarDesempenho({ m, trilha, aoRegistrar }) {
  const T = useTema();
  // fora do período da trilha (ou trilha sem semanas) não há métricas
  const insights = m ? calcularInsights(m) : { temDados: false };

  if (!insights.temDados) {
    return (
      <SectionCard titulo="Radar de bordo">
        <EmptyState icone="🛰" titulo="Inteligência incompleta"
          dica="Ainda há poucos dados para mapear seu desempenho. Continue registrando seus estudos — os indicadores aparecem aqui." />
        {aoRegistrar && (
          <div style={{ textAlign: "center", marginTop: 4 }}>
            <button onClick={aoRegistrar} style={{ border: "none", background: T.gold, color: "#0A1622", borderRadius: 9, fontWeight: 800, fontSize: 14, padding: "11px 22px", minHeight: 46 }}>
              Registrar estudo
            </button>
          </div>
        )}
      </SectionCard>
    );
  }

  // minutos por disciplina (para o "maior volume" em tempo)
  const minutosPorMateria = (codigo) => {
    const stat = m.matStats.find((s) => s.id === codigo);
    return stat?.q ?? 0;
  };

  const trend = m.accTrend;
  const setores = m.matStats
    .filter((s) => s.comAcc)
    .sort((a, b) => b.acc - a.acc)
    .map((s) => ({ ...s, cor: trilha.porCodigo[s.id]?.cor ?? T.gold }));

  const trajetoria = m.weeksData
    .filter((w) => w.isPast || w.isNow)
    .map((w) => ({ label: w.label, acc: w.acc }));
  const temTrajetoria = trajetoria.some((x) => x.acc != null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* CARDS DE INSIGHT */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        <InsightCard tom="ok" titulo="★ Melhor matéria"
          valor={insights.melhor ? `${insights.melhor.acc}%` : "—"}
          sub={insights.melhor ? insights.melhor.name : "registre acertos para ver"} />
        <InsightCard tom={insights.atencao ? "risco" : "neutro"} titulo="⚠ Atenção"
          valor={insights.atencao
            ? (insights.atencao.tipo === "materia" ? `${insights.atencao.acc}%`
              : insights.atencao.tipo === "queda" ? `↓ ${insights.atencao.para}%` : `${insights.atencao.dias} dias`)
            : "tudo ok"}
          sub={insights.atencao
            ? (insights.atencao.tipo === "materia" ? insights.atencao.materia
              : insights.atencao.tipo === "queda" ? "acerto caindo entre semanas" : "poucos dias nesta semana")
            : "sem alertas no momento"} />
        <InsightCard tom="neutro" titulo="▲ Maior volume"
          valor={insights.volume ? `${insights.volume.q}` : "—"}
          sub={insights.volume ? `questões · ${insights.volume.name}` : "—"} />
        <InsightCard tom={trend ? (trend.delta > 0 ? "ok" : trend.delta < 0 ? "risco" : "neutro") : "neutro"} titulo="↗ Evolução geral"
          valor={`${m.acerto}%`}
          sub={trend ? `${trend.delta > 0 ? "+" : ""}${trend.delta}% vs. semana anterior` : "acerto acumulado"} />
      </div>

      {/* EFICIÊNCIA POR SETOR */}
      <SectionCard titulo="Eficiência por setor" sub="Acerto por matéria (com volume suficiente)">
        {setores.length === 0 ? (
          <EmptyState icone="◎" titulo="Sem acerto consolidado" dica="Registre acertos em mais questões para liberar este radar." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {setores.map((s) => (
              <div key={s.id}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                  <span style={{ color: T.ink, fontWeight: 600 }}>{s.name}</span>
                  <span className="num" style={{ fontWeight: 800, color: s.acc >= 70 ? T.green : s.acc >= 55 ? T.gold : T.red }}>{s.acc}%</span>
                </div>
                <div style={{ height: 8, background: T.bg, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${s.acc}%`, height: "100%", background: s.acc >= 55 ? s.cor : T.red, borderRadius: 4, transition: "width .4s" }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* TRAJETÓRIA DE PRECISÃO */}
      <SectionCard titulo="Trajetória de precisão" sub="Acerto médio por semana">
        {!temTrajetoria ? (
          <EmptyState icone="📈" titulo="Ainda sem tendência"
            dica="A trajetória aparece quando há acerto registrado em pelo menos uma semana." />
        ) : (
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={trajetoria} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradPrecisao" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.gold} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={T.gold} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.line} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: T.sub, fontSize: 11 }} axisLine={{ stroke: T.line }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: T.sub, fontSize: 10 }} axisLine={false} tickLine={false} width={34} />
              <Tooltip contentStyle={{ background: T.bg2, border: `1px solid ${T.line}`, borderRadius: 8 }} formatter={(v) => [v == null ? "—" : `${v}%`, "precisão"]} />
              <Area type="monotone" dataKey="acc" stroke={T.gold} strokeWidth={2.5} fill="url(#gradPrecisao)" dot={{ r: 3, fill: T.gold }} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </SectionCard>
    </div>
  );
}
