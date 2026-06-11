/* Cards de INSIGHT do desempenho (Fase 5 do doc central): leitura
   interpretada ANTES dos gráficos — melhor matéria, ponto de atenção,
   volume, acerto geral, totais e a evolução semanal com seta. */
import React from "react";
import { InsightCard, StatCard } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { calcularInsights } from "./metricas.js";
import { fmtHoras } from "../motor/jargao.js";

export function InsightsDesempenho({ m }) {
  const T = useTema();
  const ins = calcularInsights(m);
  if (!ins.temDados) return null;

  const seta = m.accTrend
    ? { txt: `${m.accTrend.delta >= 0 ? "▲" : "▼"} ${Math.abs(m.accTrend.delta)} pts`, sub: `de ${m.accTrend.de}% para ${m.accTrend.para}%`, tom: m.accTrend.delta >= 0 ? "ok" : "risco" }
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 11, color: T.sub, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, margin: "2px 2px 0" }}>
        ◈ Leitura rápida
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
        {ins.melhor && (
          <InsightCard tom="ok" titulo="Melhor matéria" valor={ins.melhor.name}
            sub={`${ins.melhor.acc}% de acerto em ${ins.melhor.q} questões`} />
        )}
        {ins.atencao?.tipo === "materia" && (
          <InsightCard tom="risco" titulo="Precisa de atenção" valor={ins.atencao.materia}
            sub={`${ins.atencao.acc}% de acerto — reforce esta matéria nos próximos registros`} />
        )}
        {ins.atencao?.tipo === "queda" && (
          <InsightCard tom="risco" titulo="Precisa de atenção" valor="Acerto em queda"
            sub={`caiu de ${ins.atencao.de}% para ${ins.atencao.para}% entre as últimas semanas`} />
        )}
        {ins.atencao?.tipo === "frequencia" && (
          <InsightCard tom="risco" titulo="Precisa de atenção" valor="Poucos dias de estudo"
            sub={`${ins.atencao.dias} ${ins.atencao.dias === 1 ? "dia" : "dias"} nesta semana — constância pesa mais que volume`} />
        )}
        {ins.volume && (
          <InsightCard tom="alerta" titulo="Maior volume" valor={ins.volume.name}
            sub={`${ins.volume.q} questões registradas`} />
        )}
        {seta && (
          <InsightCard tom={seta.tom} titulo="Evolução semanal" valor={seta.txt} sub={seta.sub} />
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        <StatCard rotulo="Acerto geral" valor={m.acerto > 0 ? `${m.acerto}%` : "—"} icone="◎"
          tom={m.acerto >= 70 ? "ok" : m.acerto > 0 ? "alerta" : "neutro"} />
        <StatCard rotulo="Questões no total" valor={m.totDone.toLocaleString("pt-BR")} icone="✦" />
        <StatCard rotulo="Tempo total" valor={fmtHoras(m.minutosTotais ?? 0)} icone="◷" />
        <StatCard rotulo="Dias de estudo" valor={m.totalDias} sub={`média ${m.mediaDia} questões/dia`} icone="📆" />
      </div>
    </div>
  );
}
