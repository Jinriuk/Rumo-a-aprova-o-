/* Resumo do responsável — experiência PRÓPRIA, simples e objetiva
   (ref. spec). Linguagem clara para o pai/mãe, sem jargão de jogo e
   sem controles administrativos. Tudo leitura. */
import React from "react";
import { SectionCard, StatCard, EmptyState, StatusBadge, InsightCard } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { fmtBR } from "../../shared/regras/regras.js";
import { fmtHoras } from "../motor/jargao.js";
import { provaDoConcurso, notaPct, totalAcertos, totalQuestoes } from "../conteudo/provas.js";

export function ResumoResponsavel({ aluno, m, meta, trilha, simulados, semanaAtiva, concurso }) {
  const T = useTema();

  const itens = (meta?.meta_atividades ?? [])
    .map((ma) => ({ ...ma, atividade: trilha.atividadesPorId[ma.atividade_modelo_id] }))
    .filter((x) => x.atividade)
    .sort((a, b) => a.atividade.ordem - b.atividade.ordem);
  const feitas = itens.filter((x) => x.estado === "concluida").length;
  const consideradas = itens.filter((x) => x.estado !== "ignorada").length;
  const pendentes = consideradas - feitas;
  const metaConcluida = consideradas > 0 && pendentes === 0;

  // frase interpretativa. QA1.7: quando a meta foi concluída MAS em
  // poucos dias, o tom reconhece o mérito e orienta sem alarmar — em vez
  // de "🎉" cru ao lado de um alerta de "poucos dias" (dissonância).
  const primeiroNome = aluno.nome.split(" ")[0];
  const poucosDias = m.diasSemana > 0 && m.diasSemana < 3;
  const fechoMeta = metaConcluida
    ? (poucosDias
        ? "A meta da semana foi concluída — parabéns. Como o estudo se concentrou em poucos dias, vale incentivar uma rotina mais distribuída ao longo da próxima semana. 👏"
        : "A meta da semana foi concluída. 🎉")
    : consideradas > 0 ? `Faltam ${pendentes} ${pendentes === 1 ? "atividade" : "atividades"} para concluir a meta.`
    : "";
  const frase = m.diasSemana === 0
    ? `${primeiroNome} ainda não registrou estudos nesta semana.`
    : `${primeiroNome} estudou em ${m.diasSemana} ${m.diasSemana === 1 ? "dia" : "dias"} nesta semana, ` +
      `resolveu ${m.qSem} ${m.qSem === 1 ? "questão" : "questões"}` +
      (m.acerto > 0 ? ` e está com ${m.acerto}% de acerto geral` : "") + ". " +
      fechoMeta;

  // alertas simples. Quando a meta foi concluída, o "poucos dias" já é
  // tratado com tom positivo na frase acima — não repetimos como alerta
  // (evita assustar o responsável diante de uma semana, no fim, cumprida).
  const alertas = [];
  if (m.totalDias > 0 && poucosDias && !metaConcluida) alertas.push("Poucos dias de estudo nesta semana — vale distribuir melhor a rotina.");
  if (m.accTrend && m.accTrend.delta <= -5) alertas.push(`O acerto caiu de ${m.accTrend.de}% para ${m.accTrend.para}% nas últimas semanas.`);
  const fracas = m.matStats.filter((s) => s.comAcc && s.acc < 60).map((s) => s.name);
  if (fracas.length) alertas.push(`Matérias para reforçar: ${fracas.join(", ")}.`);

  const ultimoSim = simulados.length
    ? [...simulados].sort((a, b) => String(a.data).localeCompare(String(b.data)))[simulados.length - 1] : null;
  const prova = provaDoConcurso(concurso?.codigo);
  const notaSimulado = (s) => notaPct(prova, s.acertos);

  const materias = m.matStats.filter((s) => s.q > 0).sort((a, b) => b.q - a.q);
  const comAcc = m.matStats.filter((s) => s.comAcc);
  const melhor = comAcc.length ? [...comAcc].sort((a, b) => b.acc - a.acc)[0] : null;
  const pior = comAcc.length > 1 ? [...comAcc].sort((a, b) => a.acc - b.acc)[0] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* frase interpretativa */}
      <div style={{ background: `linear-gradient(160deg, ${T.cardHi}, ${T.card})`, border: `1px solid ${T.line}`, borderLeft: `4px solid ${metaConcluida ? T.green : T.gold}`, borderRadius: 12, padding: "14px 16px" }}>
        <div style={{ fontSize: 14.5, color: T.ink, lineHeight: 1.55 }}>{frase}</div>
      </div>

      {/* resumo da semana */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        <StatCard rotulo="Meta da semana" valor={`${feitas}/${consideradas || "—"}`} sub="atividades concluídas" icone="🎯"
          tom={metaConcluida ? "ok" : pendentes > 0 ? "alerta" : "neutro"} />
        <StatCard rotulo="Questões" valor={m.qSem} sub="nesta semana" icone="✦" />
        <StatCard rotulo="Tempo estudado" valor={fmtHoras(m.minutosSemana ?? 0)} sub="nesta semana" icone="◷" />
        <StatCard rotulo="Acerto geral" valor={m.acerto > 0 ? `${m.acerto}%` : "—"} icone="◎"
          tom={m.acerto >= 70 ? "ok" : m.acerto > 0 ? "alerta" : "neutro"} />
        <StatCard rotulo="Dias ativos" valor={`${m.diasSemana}/7`} icone="📆"
          tom={m.diasSemana >= 5 ? "ok" : m.diasSemana >= 3 ? "alerta" : "risco"} />
      </div>

      {/* meta — lista simples */}
      <SectionCard titulo="Atividades da semana" sub={semanaAtiva ? semanaAtiva.foco : undefined} semPadding>
        {itens.length === 0 ? (
          <div style={{ padding: 8 }}><EmptyState icone="🎯" titulo="Meta ainda não disponível" dica="A meta aparece quando a semana de estudos começa." /></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {itens.map((item, i) => {
              const disc = trilha.porCodigo[item.atividade.disciplina_codigo];
              const tom = item.estado === "concluida" ? "ok" : item.estado === "ignorada" ? "neutro" : "alerta";
              const rotulo = item.estado === "concluida" ? "Concluída" : item.estado === "ignorada" ? "Adiada" : "Pendente";
              return (
                <div key={item.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "11px 14px", borderBottom: i === itens.length - 1 ? "none" : `1px solid ${T.line}` }}>
                  {disc && <span style={{ width: 9, height: 9, borderRadius: 3, background: disc.cor, flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: item.estado === "concluida" ? T.sub : T.ink, textDecoration: item.estado === "concluida" ? "line-through" : "none", lineHeight: 1.35 }}>{item.atividade.texto}</div>
                    {disc && <div style={{ fontSize: 11, color: T.sub, marginTop: 2 }}>{disc.nome}</div>}
                  </div>
                  <StatusBadge tom={tom}>{rotulo}</StatusBadge>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* melhor e pior matéria — leitura direta para o responsável */}
      {melhor && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          <InsightCard tom="ok" titulo="Melhor matéria" valor={melhor.name} sub={`${melhor.acc}% de acerto`} />
          {pior && pior.id !== melhor.id && (
            <InsightCard tom={pior.acc < 60 ? "risco" : "alerta"} titulo="Matéria para reforçar" valor={pior.name} sub={`${pior.acc}% de acerto`} />
          )}
        </div>
      )}

      {/* desempenho por matéria */}
      <SectionCard titulo="Desempenho por matéria">
        {materias.length === 0 ? (
          <EmptyState icone="📚" titulo="Sem registros ainda" dica="Os números por matéria aparecem conforme o aluno registra estudos." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {materias.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, fontSize: 13, color: T.ink }}>{s.name}</div>
                <div style={{ fontSize: 12, color: T.sub, width: 90, textAlign: "right" }}>{s.q} questões</div>
                <div className="num" style={{ width: 52, textAlign: "right", fontWeight: 700, color: s.acc == null ? T.sub : s.acc >= 70 ? T.green : s.acc >= 55 ? T.gold : T.red }}>
                  {s.acc == null ? "—" : `${s.acc}%`}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* último simulado */}
      {ultimoSim && (
        <SectionCard titulo="Último simulado">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div className="disp" style={{ fontSize: 15, fontWeight: 700 }}>{ultimoSim.nome}</div>
              <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>{fmtBR(String(ultimoSim.data))} · {totalAcertos(prova, ultimoSim.acertos)}/{totalQuestoes(prova)} acertos · {prova.rotulo}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="num disp" style={{ fontSize: 26, fontWeight: 800, color: notaSimulado(ultimoSim) >= 70 ? T.green : notaSimulado(ultimoSim) >= 50 ? T.gold : T.red }}>{notaSimulado(ultimoSim)}</div>
              <div style={{ fontSize: 10.5, color: T.sub }}>{prova.notaRotulo ?? "nota projetada"} /100</div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* alertas */}
      {alertas.length > 0 && (
        <SectionCard titulo="Pontos de atenção">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alertas.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: T.ink, alignItems: "flex-start" }}>
                <span style={{ color: T.gold }}>•</span>{a}
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
