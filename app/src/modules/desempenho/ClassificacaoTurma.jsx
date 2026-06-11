/* Classificação da turma — visão da COORDENAÇÃO. Ranqueia os alunos
   da escola por esforço e resultado, com filtro por turma e janela
   (últimos 7 dias / geral). Decisão registrada: o ranking é só da
   escola; aluno não vê classificação de aluno (comparativo social
   entre alunos é Fase 3, travada nos documentos). */
import React, { useMemo, useState } from "react";
import { Card, Empty } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { todayISO } from "../../shared/regras/regras.js";

const MEDALHAS = ["🥇", "🥈", "🥉"];
const fmtH = (min) => {
  if (!min) return "0m";
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h}h${String(m).padStart(2, "0")}m` : `${m}m`;
};

export function ClassificacaoTurma({ alunos, turmas, registros, metas, concursosPorId }) {
  const T = useTema();
  const [turmaId, setTurmaId] = useState("");
  const [janela, setJanela] = useState("semana"); // semana (últimos 7 dias) | geral

  const ranking = useMemo(() => {
    const hoje = todayISO();
    const d = new Date(`${hoje}T00:00:00`);
    d.setDate(d.getDate() - 6);
    const corte = d.toISOString().slice(0, 10);

    const metaAtivaPorAluno = {};
    for (const m of metas) if (m.status === "ativa") metaAtivaPorAluno[m.aluno_id] = m;

    const visiveis = alunos.filter(
      (a) => !turmaId || (a.alunos_turmas ?? []).some((v) => v.turma_id === turmaId),
    );

    return visiveis.map((a) => {
      const ls = registros
        .filter((r) => r.aluno_id === a.id)
        .filter((r) => janela === "geral" || String(r.data) >= corte);
      const q = ls.reduce((s, r) => s + (+r.questoes || 0), 0);
      const cd = ls.filter((r) => r.acertos !== null).reduce((s, r) => s + (+r.questoes || 0), 0);
      const cc = ls.filter((r) => r.acertos !== null).reduce((s, r) => s + (+r.acertos || 0), 0);
      const minutos = ls.reduce((s, r) => s + (+r.minutos || 0), 0);
      const dias = new Set(ls.map((r) => String(r.data))).size;

      const meta = metaAtivaPorAluno[a.id];
      const itens = meta?.meta_atividades ?? [];
      const feitas = itens.filter((x) => x.estado === "concluida").length;
      const consideradas = itens.filter((x) => x.estado !== "ignorada").length;
      const metaPct = consideradas ? Math.round((feitas / consideradas) * 100) : null;

      return {
        aluno: a, q, minutos, dias,
        acc: cd ? Math.round((cc / cd) * 100) : null,
        metaPct, feitas, consideradas,
      };
    }).sort((x, y) => (y.q - x.q) || ((y.acc ?? -1) - (x.acc ?? -1)) || (y.minutos - x.minutos));
  }, [alunos, registros, metas, turmaId, janela]);

  const maxQ = Math.max(1, ...ranking.map((r) => r.q));

  const seletor = (valor, setValor, opcoes) => (
    <div style={{ display: "flex", background: T.bg, borderRadius: 8, padding: 3, border: `1px solid ${T.line}` }}>
      {opcoes.map(([k, lb]) => (
        <button key={k} onClick={() => setValor(k)}
          style={{ border: "none", background: valor === k ? T.gold : "transparent", color: valor === k ? "#0A1622" : T.sub, fontWeight: 600, fontSize: 12, padding: "7px 11px", minHeight: 36, borderRadius: 6, whiteSpace: "nowrap" }}>
          {lb}
        </button>
      ))}
    </div>
  );

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
        <div>
          <div className="disp" style={{ fontSize: 15, fontWeight: 700 }}>Classificação da turma</div>
          <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>
            Ordenada por questões resolvidas; desempate por acerto e tempo. Visível só para a coordenação.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {seletor(janela, setJanela, [["semana", "Últimos 7 dias"], ["geral", "Geral"]])}
          {turmas.length > 0 && (
            <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)}
              style={{ background: T.bg, border: `1px solid ${T.line}`, color: T.ink, borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
              <option value="" style={{ background: T.bg2 }}>Todas as turmas</option>
              {turmas.map((t) => <option key={t.id} value={t.id} style={{ background: T.bg2 }}>{t.nome}</option>)}
            </select>
          )}
        </div>
      </div>

      {ranking.length === 0 ? <Empty txt="Nenhum aluno nesta seleção." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 12 }}>
          {ranking.map((r, i) => {
            const concurso = concursosPorId?.[r.aluno.concurso_id];
            const destaque = i < 3 && r.q > 0;
            return (
              <div key={r.aluno.id} className="row" style={{
                display: "flex", alignItems: "center", gap: 12, padding: "11px 10px", borderRadius: 10,
                border: `1px solid ${destaque ? T.gold : "transparent"}`,
                background: destaque ? T.cardHi : "transparent",
                borderBottom: `1px solid ${T.line}`, flexWrap: "wrap",
              }}>
                <div className="num disp" style={{ width: 36, textAlign: "center", fontSize: destaque ? 20 : 14, fontWeight: 800, color: destaque ? T.gold : T.sub, flexShrink: 0 }}>
                  {destaque ? MEDALHAS[i] : `${i + 1}º`}
                </div>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{r.aluno.nome}</div>
                  <div style={{ fontSize: 11, color: T.sub, marginTop: 1 }}>
                    {concurso ? concurso.nome.split(" (")[0] : "sem concurso"}
                    {r.metaPct !== null && <> · meta da semana: <b style={{ color: r.metaPct >= 80 ? T.green : r.metaPct >= 40 ? T.gold : T.red }}>{r.feitas}/{r.consideradas} ({r.metaPct}%)</b></>}
                  </div>
                  <div style={{ height: 5, background: T.bg, borderRadius: 3, overflow: "hidden", marginTop: 6, maxWidth: 360 }}>
                    <div style={{ width: `${(r.q / maxQ) * 100}%`, height: "100%", background: `linear-gradient(90deg,${T.gold},${T.green})` }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 14, fontSize: 12, color: T.sub, flexShrink: 0, textAlign: "right" }}>
                  <span><b className="num" style={{ color: T.ink, fontSize: 15 }}>{r.q}</b><br />questões</span>
                  <span><b className="num" style={{ color: r.acc == null ? T.sub : r.acc >= 70 ? T.green : r.acc >= 55 ? T.gold : T.red, fontSize: 15 }}>{r.acc == null ? "—" : `${r.acc}%`}</b><br />acerto</span>
                  <span><b className="num" style={{ color: T.ink, fontSize: 15 }}>{fmtH(r.minutos)}</b><br />tempo</span>
                  <span><b className="num" style={{ color: T.ink, fontSize: 15 }}>{r.dias}</b><br />dias</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
