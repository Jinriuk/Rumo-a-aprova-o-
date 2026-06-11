/* Resumo de acompanhamento (o "relatório do responsável" da versão
   atual) + Diagnóstico em linguagem clara. Portados sem mudança de
   regra: mesmos thresholds de status, tendência e alertas. */
import React from "react";
import { Card, MiniStat } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { fmtBR } from "../../shared/regras/regras.js";

export function Resumo({ m, semanaAtiva, totalSemanas, doneCount, totalTasks, diasProva }) {
  const T = useTema();
  let cor = T.gold, rotulo = "Atenção", txt = "";
  const semDados = m.qSem === 0 && m.diasSemana === 0;
  if (semDados) { cor = T.sub; rotulo = "Sem registros"; txt = "Nenhum estudo registrado nesta semana ainda."; }
  else if (m.diasSemana >= 5 && m.acerto >= 70 && m.metaPct >= 80) { cor = T.green; rotulo = "No caminho"; txt = "Ritmo e acerto dentro do esperado. Mantendo o plano."; }
  else if (m.diasSemana < 3 || (m.acerto > 0 && m.acerto < 55) || m.metaPct < 40) { cor = T.red; rotulo = "Precisa de atenção"; txt = m.diasSemana < 3 ? "Poucos dias de estudo nesta semana." : m.metaPct < 40 ? "Volume de questões abaixo do necessário." : "Acerto baixo — está errando muito."; }
  else { cor = T.gold; rotulo = "Parcial"; txt = "Estudando, mas ainda fora do ritmo ou do acerto ideal."; }
  const linha = `Esta semana: estudou em ${m.diasSemana} de 7 dias, fez ${m.qSem} questões (${m.metaPct}% da meta) com ${m.acerto}% de acerto. Cumpriu ${doneCount} de ${totalTasks} tarefas do plano.`;

  const trendTxt = m.accTrend
    ? (m.accTrend.delta > 0 ? `subindo (${m.accTrend.de}% → ${m.accTrend.para}%)`
      : m.accTrend.delta < 0 ? `caindo (${m.accTrend.de}% → ${m.accTrend.para}%)`
      : `estável (${m.accTrend.para}%)`)
    : null;
  const trendCor = m.accTrend ? (m.accTrend.delta > 0 ? T.green : m.accTrend.delta < 0 ? T.red : T.sub) : T.sub;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ background: T.card, border: `1px solid ${cor}`, borderRadius: 12, padding: 16, borderLeft: `5px solid ${cor}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
          <span style={{ width: 12, height: 12, borderRadius: 6, background: cor }} />
          <span className="disp" style={{ fontSize: 17, fontWeight: 700, color: cor }}>{rotulo}</span>
          <span style={{ fontSize: 12, color: T.sub }}>· Semana {semanaAtiva.numero} de {totalSemanas}{diasProva != null ? ` · faltam ${diasProva} dias p/ prova` : ""}</span>
        </div>
        <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.5 }}>{txt}</div>
        {!semDados && <div style={{ fontSize: 12.5, color: T.sub, marginTop: 6, lineHeight: 1.5 }}>{linha}</div>}
        {m.lastSim && (
          <div style={{ fontSize: 12.5, color: T.ink, marginTop: 8 }}>
            Último simulado ({m.lastSim.label}) — nota projetada no Dia 1: <b style={{ color: m.lastSim.nota >= 70 ? T.green : m.lastSim.nota >= 50 ? T.gold : T.red }}>{m.lastSim.nota}/100</b>
          </div>
        )}
        {m.weak.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 12.5, color: T.ink }}>
            <span style={{ color: T.red, fontWeight: 700 }}>Pontos fracos:</span> {m.weak.map((w) => `${w.name} (${w.acc}%)`).join(" · ")}
          </div>
        )}
      </div>

      <Card>
        <div className="disp" style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Visão geral do período</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
          <MiniStat label="Total de questões" value={m.totDone} />
          <MiniStat label="Dias estudados" value={m.totalDias} />
          <MiniStat label="Média por dia" value={m.mediaDia} sub="nos dias que estudou" />
          <MiniStat label="Acerto geral" value={`${m.acerto}%`} color={m.acerto >= 70 ? T.green : m.acerto > 0 ? T.gold : T.sub} />
          <MiniStat label="Consistência" value={`${m.consistencia}%`} sub="semanas com ≥4 dias" color={m.consistencia >= 70 ? T.green : m.consistencia >= 40 ? T.gold : T.red} />
          {trendTxt && <MiniStat label="Acerto recente" value={m.accTrend.delta > 0 ? "↑" : m.accTrend.delta < 0 ? "↓" : "→"} sub={trendTxt} color={trendCor} />}
        </div>
        {m.primeiraData && <div style={{ fontSize: 11.5, color: T.sub, marginTop: 10 }}>Estudando e registrando desde {fmtBR(m.primeiraData)}.</div>}
      </Card>

      <Diagnostico m={m} />
    </div>
  );
}

export function Diagnostico({ m }) {
  const T = useTema();
  const fortes = m.matStats.filter((s) => s.comAcc && s.acc >= 75).sort((a, b) => b.acc - a.acc);
  const fracas = m.matStats.filter((s) => s.comAcc && s.acc < 60).sort((a, b) => a.acc - b.acc);
  const semDados = m.matStats.filter((s) => s.q === 0).map((s) => s.name);

  const alertas = [];
  if (m.totalDias === 0) alertas.push("Ainda não há registros de estudo.");
  if (m.accTrend && m.accTrend.delta <= -5) alertas.push(`O acerto caiu de ${m.accTrend.de}% para ${m.accTrend.para}% entre as últimas semanas.`);
  if (m.consistencia > 0 && m.consistencia < 50) alertas.push("A frequência está irregular — várias semanas com menos de 4 dias de estudo.");
  if (m.diasSemana < 3 && m.totalDias > 0) alertas.push("Poucos dias de estudo nesta semana.");
  if (semDados.length >= 3) alertas.push(`Matérias ainda sem nenhuma questão: ${semDados.join(", ")}.`);

  const Bloco = ({ titulo, cor, itens, vazio }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: cor, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>{titulo}</div>
      {itens.length === 0
        ? <div style={{ fontSize: 12.5, color: T.sub }}>{vazio}</div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{itens}</div>}
    </div>
  );

  return (
    <Card>
      <div className="disp" style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Diagnóstico</div>
      <Bloco titulo="Indo bem" cor={T.green} vazio="Ainda sem matéria com acerto consolidado acima de 75%."
        itens={fortes.map((s) => (
          <div key={s.id} style={{ fontSize: 13, color: T.ink }}>✓ <b>{s.name}</b> — {s.acc}% de acerto ({s.q} questões)</div>
        ))} />
      <Bloco titulo="Precisa reforçar" cor={T.red} vazio="Nenhuma matéria com acerto abaixo de 60% (com volume suficiente)."
        itens={fracas.map((s) => (
          <div key={s.id} style={{ fontSize: 13, color: T.ink }}>! <b>{s.name}</b> — {s.acc}% de acerto ({s.q} questões)</div>
        ))} />
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.gold, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Atenção</div>
        {alertas.length === 0
          ? <div style={{ fontSize: 12.5, color: T.sub }}>Sem alertas no momento. Bom andamento.</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{alertas.map((a, i) => <div key={i} style={{ fontSize: 13, color: T.ink }}>• {a}</div>)}</div>}
      </div>
    </Card>
  );
}
