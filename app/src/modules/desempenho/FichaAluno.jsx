/* FICHA DO ALUNO — visão da COORDENAÇÃO (pedido do produto): UMA
   página condensada, sem os menus do aluno. A escola vê o que
   importa: a semana na trilha, o desempenho e o histórico recente —
   no mesmo formato enxuto do responsável. Tudo leitura. */
import React, { useEffect, useMemo, useState } from "react";
import { SectionCard, Empty, Erro, EmptyState } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { useTrilha } from "../conteudo/useTrilha.js";
import { calcularMetricas } from "./metricas.js";
import { ResumoResponsavel } from "./ResumoResponsavel.jsx";
import { calcularXP, patente, fmtHoras } from "../motor/jargao.js";
import { semanaAtual, fmtBR } from "../../shared/regras/regras.js";
import * as db from "../../shared/data/index.js";

export function FichaAluno({ aluno, concurso }) {
  const T = useTema();
  const [dados, setDados] = useState({ carregando: true, metas: [], registros: [], simulados: [], erro: null });
  const { trilha, carregando: carregandoTrilha, erro: erroTrilha } = useTrilha(aluno?.trilha_id);

  useEffect(() => {
    if (!aluno) return;
    let vivo = true;
    Promise.all([db.listarMetas(aluno.id), db.listarRegistros(aluno.id), db.listarSimulados(aluno.id)])
      .then(([metas, registros, simulados]) => vivo && setDados({ carregando: false, metas, registros, simulados, erro: null }))
      .catch((e) => vivo && setDados((d) => ({ ...d, carregando: false, erro: e.message })));
    return () => { vivo = false; };
  }, [aluno?.id]);

  const semanasRegras = useMemo(
    () => (trilha ? trilha.semanas.map((s) => ({ ...s, inicio: String(s.inicio), fim: String(s.fim) })) : []),
    [trilha],
  );
  const semanaAtiva = semanasRegras.length ? semanaAtual(semanasRegras) : null;

  const m = useMemo(() => {
    if (!trilha || !semanaAtiva) return null;
    return calcularMetricas({
      registros: dados.registros, simulados: dados.simulados,
      semanas: semanasRegras, semanaAtiva, disciplinas: trilha.disciplinas,
      metaQuestoes: semanaAtiva.meta_questoes ?? 250,
    });
  }, [dados, trilha, semanaAtiva]);

  if (carregandoTrilha || dados.carregando) return <Empty txt="Carregando ficha do aluno…" />;
  if (erroTrilha || dados.erro) return <Erro>{erroTrilha || dados.erro}</Erro>;
  if (!trilha) return <Empty txt="Aluno sem trilha de estudo." />;
  if (!m || !semanaAtiva) return <Empty txt="Fora do período da trilha deste aluno." />;

  const meta = dados.metas.find((x) => x.status === "ativa") ?? dados.metas[0] ?? null;
  const xp = calcularXP({ metas: dados.metas, totalQuestoes: m.totDone, simulados: dados.simulados.length });
  const p = patente(xp);
  const turma = (aluno.alunos_turmas ?? []).map((v) => v.turmas?.nome).filter(Boolean)[0];
  const recentes = dados.registros.slice(0, 8);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* cabeçalho da ficha */}
      <div style={{ display: "flex", alignItems: "center", gap: 13, background: `linear-gradient(135deg, ${T.cardHi}, ${T.card})`, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 16px", flexWrap: "wrap" }}>
        <div className="disp" style={{ width: 48, height: 48, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${T.gold}, #9c7d2e)`, color: "#0A1622", fontWeight: 800, fontSize: 17, border: `2px solid ${T.gold}` }}>
          {aluno.nome.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join("")}
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="disp" style={{ fontSize: 18, fontWeight: 800 }}>{aluno.nome}</div>
          <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>
            {[turma, concurso ? concurso.nome.split(" (")[0] : null].filter(Boolean).join(" · ") || "sem turma"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 18, flexShrink: 0, textAlign: "center" }}>
          <div>
            <div className="disp" style={{ fontSize: 14, fontWeight: 800, color: T.gold }}>{p.nome}</div>
            <div className="num" style={{ fontSize: 10.5, color: T.sub }}>{xp.toLocaleString("pt-BR")} XP</div>
          </div>
          <div>
            <div className="disp num" style={{ fontSize: 14, fontWeight: 800 }}>{fmtHoras(m.minutosTotais ?? 0)}</div>
            <div style={{ fontSize: 10.5, color: T.sub }}>tempo total</div>
          </div>
        </div>
      </div>

      {/* o corpo condensado: mesmo formato do responsável */}
      <ResumoResponsavel aluno={aluno} m={m} meta={meta} trilha={trilha}
        simulados={dados.simulados} semanaAtiva={semanaAtiva} concurso={concurso} />

      {/* histórico recente do que ele tem feito */}
      <SectionCard titulo="Últimos registros de estudo" sub="O que o aluno lançou mais recentemente." semPadding>
        {recentes.length === 0 ? (
          <div style={{ padding: 8 }}><EmptyState icone="✎" titulo="Nenhum registro ainda" dica="Os lançamentos do aluno aparecem aqui." /></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {recentes.map((l, i) => {
              const s = trilha.porCodigo[l.disciplina_codigo];
              const acc = l.acertos !== null && l.questoes ? Math.round((l.acertos / l.questoes) * 100) : null;
              return (
                <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 15px", borderBottom: i === recentes.length - 1 ? "none" : `1px solid ${T.line}` }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: s?.cor, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {s?.nome}{l.topico ? <span style={{ color: T.sub }}> · {l.topico}</span> : null}
                    </div>
                    <div className="num" style={{ fontSize: 11, color: T.sub, marginTop: 1 }}>
                      {fmtBR(String(l.data))} · {l.questoes} questões{acc !== null ? ` · ${acc}%` : ""}{l.minutos ? ` · ${l.minutos}min` : ""}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
