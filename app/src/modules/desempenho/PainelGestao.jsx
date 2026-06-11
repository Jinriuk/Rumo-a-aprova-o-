/* "Painel de Gestão" da coordenação (ref. designs): indicadores de
   gestão, cards de ALERTA de risco (sem atividade, sem credencial,
   meta atrasada) e ranking resumido. Tudo leitura, dentro do tenant
   (a RLS já limita à escola). Clicar num alerta leva à aba útil. */
import React, { useMemo } from "react";
import { SectionCard, StatCard, EmptyState } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { todayISO } from "../../shared/regras/regras.js";
import { fmtHorasCurto } from "../motor/jargao.js";

// agrega registros e metas por aluno (geral + últimos 7 dias)
export function agregarEscola({ alunos, registros, metas }) {
  const hoje = todayISO();
  const d = new Date(`${hoje}T00:00:00`); d.setDate(d.getDate() - 6);
  const corte = d.toISOString().slice(0, 10);

  const metaAtivaPorAluno = {};
  for (const m of metas) if (m.status === "ativa") metaAtivaPorAluno[m.aluno_id] = m;

  return alunos.map((a) => {
    const ls = registros.filter((r) => r.aluno_id === a.id);
    const sem = ls.filter((r) => String(r.data) >= corte);
    const q = ls.reduce((s, r) => s + (+r.questoes || 0), 0);
    const qSem = sem.reduce((s, r) => s + (+r.questoes || 0), 0);
    const minSem = sem.reduce((s, r) => s + (+r.minutos || 0), 0);
    const cd = ls.filter((r) => r.acertos !== null).reduce((s, r) => s + (+r.questoes || 0), 0);
    const cc = ls.filter((r) => r.acertos !== null).reduce((s, r) => s + (+r.acertos || 0), 0);
    const diasSem = new Set(sem.map((r) => String(r.data))).size;

    const meta = metaAtivaPorAluno[a.id];
    const itens = meta?.meta_atividades ?? [];
    const feitas = itens.filter((x) => x.estado === "concluida").length;
    const consideradas = itens.filter((x) => x.estado !== "ignorada").length;
    const metaIncompleta = consideradas > 0 && feitas < consideradas;

    return {
      aluno: a, q, qSem, minSem, diasSem,
      acc: cd ? Math.round((cc / cd) * 100) : null,
      semCredencial: !a.usuario_id,
      semAtividade: sem.length === 0,
      metaIncompleta, feitas, consideradas,
    };
  });
}

export function PainelGestao({ alunos, registros, metas, turmas, concursosPorId, aoIr }) {
  const T = useTema();
  const ag = useMemo(() => agregarEscola({ alunos, registros, metas }), [alunos, registros, metas]);

  if (alunos.length === 0) {
    return (
      <SectionCard titulo="Painel de gestão">
        <EmptyState icone="📋" titulo="Nenhum aluno cadastrado ainda"
          dica="Cadastre turmas e alunos na aba Alunos. Os indicadores de gestão aparecem aqui." />
      </SectionCard>
    );
  }

  const total = alunos.length;
  const ativos = ag.filter((x) => !x.semAtividade).length;
  const semAtividade = ag.filter((x) => x.semAtividade).length;
  const semCredencial = ag.filter((x) => x.semCredencial).length;
  const metaAtrasada = ag.filter((x) => x.metaIncompleta).length;
  const comAcc = ag.filter((x) => x.acc != null);
  const mediaAcerto = comAcc.length ? Math.round(comAcc.reduce((s, x) => s + x.acc, 0) / comAcc.length) : null;
  const questoesSemana = ag.reduce((s, x) => s + x.qSem, 0);

  const ranking = [...ag]
    .filter((x) => x.q > 0)
    .sort((a, b) => (b.acc ?? -1) - (a.acc ?? -1) || b.q - a.q)
    .slice(0, 3);

  const nomeTurma = (a) => (a.alunos_turmas ?? []).map((v) => v.turmas?.nome).filter(Boolean)[0];

  const Alerta = ({ tom, icone, titulo, sub, n, ir }) => {
    const cor = tom === "risco" ? T.red : tom === "alerta" ? T.gold : T.sub;
    return (
      <button onClick={ir ? () => aoIr(ir) : undefined}
        style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, background: T.card, border: `1px solid ${T.line}`, borderLeft: `4px solid ${cor}`, borderRadius: 12, padding: "13px 15px", cursor: ir ? "pointer" : "default" }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${cor}1a`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{icone}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="disp" style={{ fontSize: 14.5, fontWeight: 700 }}>{titulo}</div>
          <div style={{ fontSize: 11.5, color: T.sub, marginTop: 1 }}>{sub}</div>
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
        <Alerta tom="risco" icone="💤" titulo="Sem atividade" sub="Nenhum registro nos últimos 7 dias" n={semAtividade} ir={semAtividade ? "ranking" : null} />
        <Alerta tom="alerta" icone="🔑" titulo="Sem credencial" sub="Acesso ainda não liberado" n={semCredencial} ir={semCredencial ? "alunos" : null} />
        <Alerta tom="neutro" icone="🏁" titulo="Meta atrasada" sub="Missão da semana incompleta" n={metaAtrasada} ir={metaAtrasada ? "ranking" : null} />
      </div>

      {/* RANKING RESUMIDO */}
      <SectionCard titulo="Destaques da semana" acao={
        <button onClick={() => aoIr("ranking")} style={{ border: "none", background: "transparent", color: T.gold, fontSize: 12.5, fontWeight: 700 }}>Ver completo ›</button>
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
                  <div className="num disp" style={{ fontSize: 16, fontWeight: 800, color: r.acc >= 70 ? T.green : T.gold }}>{r.acc == null ? "—" : `${r.acc}%`}</div>
                  <div style={{ fontSize: 9.5, color: T.sub, textTransform: "uppercase" }}>acerto</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
