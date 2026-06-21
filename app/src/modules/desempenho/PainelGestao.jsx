/* "Painel de Gestão" da coordenação (ref. designs): indicadores de
   gestão, cards de ALERTA de risco (sem atividade, sem credencial,
   meta atrasada) e ranking resumido. Tudo leitura, dentro do tenant
   (a RLS já limita à escola). Clicar num alerta leva à aba útil. */
import React, { useState } from "react";
import { SectionCard, StatCard, EmptyState } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { fmtHorasCurto } from "../motor/jargao.js";

// `resumo` já vem agregado por aluno (RPC resumo_escola, adaptado em
// adaptarResumoEscola) — o painel só lê e exibe; nenhuma varredura de
// registros no cliente.
export function PainelGestao({ resumo, aoIr, aoIrFiltrado }) {
  const T = useTema();
  const ag = resumo;

  if (ag.length === 0) {
    return (
      <SectionCard titulo="Painel de gestão">
        <EmptyState icone="📋" titulo="Nenhum aluno cadastrado ainda"
          dica="Cadastre turmas e alunos na aba Alunos. Os indicadores de gestão aparecem aqui." />
      </SectionCard>
    );
  }

  const total = ag.length;
  const ativos = ag.filter((x) => !x.semAtividade).length;
  const semAtividade = ag.filter((x) => x.semAtividade).length;
  const semCredencial = ag.filter((x) => x.semCredencial).length;
  // semana em curso: meta incompleta é PENDÊNCIA (em aberto), não "atraso".
  const metaPendente = ag.filter((x) => x.metaIncompleta).length;
  const comAcc = ag.filter((x) => x.acc != null);
  const mediaAcerto = comAcc.length ? Math.round(comAcc.reduce((s, x) => s + x.acc, 0) / comAcc.length) : null;
  const questoesSemana = ag.reduce((s, x) => s + x.qSem, 0);

  // Destaques: a escola escolhe o critério (Fase 9 do doc central)
  const [criterio, setCriterio] = useState("acerto");
  const CRITERIOS = {
    acerto: { rotulo: "Melhor acerto", v: (x) => x.acc ?? -1, fmt: (x) => (x.acc == null ? "—" : `${x.acc}%`), sub: "acerto" },
    questoes: { rotulo: "Mais questões (7d)", v: (x) => x.qSem, fmt: (x) => x.qSem, sub: "questões 7d" },
    tempo: { rotulo: "Mais tempo (7d)", v: (x) => x.minSem, fmt: (x) => fmtHorasCurto(x.minSem), sub: "tempo 7d" },
    dias: { rotulo: "Mais dias (7d)", v: (x) => x.diasSem, fmt: (x) => `${x.diasSem}d`, sub: "dias 7d" },
  };
  const crit = CRITERIOS[criterio];
  const ranking = [...ag]
    .filter((x) => x.q > 0)
    .sort((a, b) => crit.v(b) - crit.v(a) || b.q - a.q)
    .slice(0, 3);

  const nomeTurma = (a) => (a.alunos_turmas ?? []).map((v) => v.turmas?.nome).filter(Boolean)[0];

  // ir é uma função onClick (ou null quando n===0)
  const Alerta = ({ tom, icone, titulo, sub, n, ir, rotuloCta, nomes = [] }) => {
    const cor = tom === "risco" ? T.red : tom === "alerta" ? T.gold : T.sub;
    const preview = nomes.slice(0, 3);
    return (
      <button onClick={ir ?? undefined}
        style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "flex-start", gap: 12, background: T.card, border: `1px solid ${T.line}`, borderLeft: `4px solid ${cor}`, borderRadius: 12, padding: "13px 15px", cursor: ir ? "pointer" : "default" }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${cor}1a`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, marginTop: 1 }}>{icone}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="disp" style={{ fontSize: 14.5, fontWeight: 700 }}>{titulo}</div>
          <div style={{ fontSize: 11.5, color: T.sub, marginTop: 1 }}>{sub}</div>
          {preview.length > 0 && (
            <div style={{ fontSize: 11, color: T.sub, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {preview.join(", ")}{nomes.length > 3 ? ` e mais ${nomes.length - 3}` : ""}
            </div>
          )}
          {ir && rotuloCta && (
            <div style={{ fontSize: 11.5, color: cor, fontWeight: 700, marginTop: 6 }}>{rotuloCta} →</div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div className="num disp" style={{ fontSize: 22, fontWeight: 800, color: cor }}>{n}</div>
          <div style={{ fontSize: 9.5, color: T.sub, textTransform: "uppercase", letterSpacing: 0.4 }}>{n === 1 ? "aluno" : "alunos"}</div>
        </div>
      </button>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
        <StatCard rotulo="Alunos" valor={total} icone="👥" />
        <StatCard rotulo="Ativos na semana" valor={ativos} sub={`de ${total}`} icone="✦" tom={ativos >= total * 0.6 ? "ok" : "alerta"} />
        <StatCard rotulo="Acerto médio" valor={mediaAcerto == null ? "—" : `${mediaAcerto}%`} icone="◎" tom={mediaAcerto == null ? "neutro" : mediaAcerto >= 70 ? "ok" : "alerta"} />
        <StatCard rotulo="Questões (7 dias)" valor={questoesSemana} icone="📈" />
      </div>

      {/* ALERTAS DE RISCO */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 11, color: T.sub, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, margin: "2px 2px 0" }}>⚠ Alertas de risco</div>
        <Alerta tom="risco" icone="💤" titulo="Sem atividade" sub="Nenhum registro nos últimos 7 dias" n={semAtividade}
          ir={semAtividade ? () => aoIrFiltrado ? aoIrFiltrado("alunos", "sem-atividade") : aoIr("ranking") : null}
          rotuloCta="Ver lista filtrada"
          nomes={ag.filter((x) => x.semAtividade).map((x) => x.aluno.nome.split(" ")[0])} />
        <Alerta tom="alerta" icone="🔑" titulo="Sem credencial" sub="Acesso ainda não liberado" n={semCredencial}
          ir={semCredencial ? () => aoIrFiltrado ? aoIrFiltrado("alunos", "sem-credencial") : aoIr("alunos") : null}
          rotuloCta="Liberar credenciais"
          nomes={ag.filter((x) => x.semCredencial).map((x) => x.aluno.nome.split(" ")[0])} />
        <Alerta tom="neutro" icone="🏁" titulo="Pendências da semana" sub="Missão desta semana ainda em aberto (semana em curso)" n={metaPendente}
          ir={metaAtrasada ? () => aoIrFiltrado ? aoIrFiltrado("alunos", "meta-atrasada") : aoIr("ranking") : null}
          rotuloCta="Ver alunos com pendências"
          nomes={ag.filter((x) => x.metaIncompleta).map((x) => x.aluno.nome.split(" ")[0])} />
      </div>

      {/* RANKING RESUMIDO — critério escolhido pela escola */}
      <SectionCard titulo="Destaques da semana" acao={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={criterio} onChange={(e) => setCriterio(e.target.value)}
            style={{ background: T.bg, border: `1px solid ${T.line}`, color: T.ink, borderRadius: 8, padding: "7px 9px", fontSize: 12 }}>
            {Object.entries(CRITERIOS).map(([k, c]) => <option key={k} value={k} style={{ background: T.bg2 }}>{c.rotulo}</option>)}
          </select>
          <button onClick={() => aoIr("ranking")} style={{ border: "none", background: "transparent", color: T.gold, fontSize: 12.5, fontWeight: 700 }}>Ver completo ›</button>
        </div>
      } semPadding>
        {ranking.length === 0 ? (
          <div style={{ padding: 8 }}><EmptyState icone="🏆" titulo="Sem dados para ranking" dica="Os destaques aparecem quando os alunos começam a registrar questões." /></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {ranking.map((r, i) => (
              <div key={r.aluno.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderBottom: i === ranking.length - 1 ? "none" : `1px solid ${T.line}` }}>
                <div className="num disp" style={{ width: 28, textAlign: "center", fontSize: 18, fontWeight: 800, color: T.gold }}>{["🥇", "🥈", "🥉"][i]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{r.aluno.nome}</div>
                  <div style={{ fontSize: 11, color: T.sub }}>{nomeTurma(r.aluno) || "sem turma"} · {r.q} questões</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="num disp" style={{ fontSize: 16, fontWeight: 800, color: T.gold }}>{crit.fmt(r)}</div>
                  <div style={{ fontSize: 9.5, color: T.sub, textTransform: "uppercase" }}>{crit.sub}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
