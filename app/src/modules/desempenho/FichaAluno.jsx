/* FICHA DO ALUNO — visão da COORDENAÇÃO (pedido do produto): UMA
   página condensada, sem os menus do aluno. A escola vê o que
   importa: a semana na trilha, o desempenho e o histórico recente —
   no mesmo formato enxuto do responsável. Tudo leitura. */
import React, { useMemo } from "react";
import { SectionCard, Empty, Erro, EmptyState } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { useTrilha } from "../conteudo/useTrilha.js";
import { useRecurso } from "../../shared/hooks/useRecurso.js";
import { calcularMetricas } from "./metricas.js";
import { ResumoResponsavel } from "./ResumoResponsavel.jsx";
import { ListaRegistros } from "../../shared/ui/ListaRegistros.jsx";
import { calcularXP, patente, fmtHoras } from "../motor/jargao.js";
import { semanaAtual } from "../../shared/regras/regras.js";
import * as db from "../../shared/data/index.js";

export function FichaAluno({ aluno, concurso }) {
  const T = useTema();
  const examTag = concurso?.codigo ?? null;
  const { dados: carregado, carregando: carregandoDados, erro: erroDados } = useRecurso(
    () => (aluno
      ? Promise.all([
          db.listarMetas(aluno.id), db.listarRegistros(aluno.id), db.listarSimulados(aluno.id),
          // XP PERSISTIDO do aluno (motor PED1): best-effort, isolado por RLS
          examTag ? db.carregarGamificacaoAluno(aluno.id, examTag).catch(() => ({ eventos: [] })) : Promise.resolve({ eventos: [] }),
        ])
          .then(([metas, registros, simulados, gam]) => ({ metas, registros, simulados, gam }))
      : Promise.resolve({ metas: [], registros: [], simulados: [], gam: { eventos: [] } })),
    [aluno?.id, examTag],
  );
  const dados = carregado ?? { metas: [], registros: [], simulados: [], gam: { eventos: [] } };
  const { trilha, carregando: carregandoTrilha, erro: erroTrilha } = useTrilha(aluno?.trilha_id);

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

  if (carregandoTrilha || carregandoDados) return <Empty txt="Carregando ficha do aluno…" />;
  if (erroTrilha || erroDados) return <Erro>{erroTrilha || erroDados}</Erro>;
  if (!trilha) return <Empty txt="Aluno sem trilha de estudo." />;
  if (!m || !semanaAtiva) return <Empty txt="Fora do período da trilha deste aluno." />;

  const meta = dados.metas.find((x) => x.status === "ativa") ?? dados.metas[0] ?? null;
  // XP PERSISTIDO manda quando há ledger; sem evento ainda, cai no derivado.
  const xpPersistido = (dados.gam?.eventos ?? []).reduce((s, e) => s + (Number(e.pontos) || 0), 0);
  const xp = (examTag && (dados.gam?.eventos ?? []).length > 0)
    ? xpPersistido
    : calcularXP({ metas: dados.metas, totalQuestoes: m.totDone, simulados: dados.simulados.length });
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
          <ListaRegistros registros={recentes} porCodigo={trilha.porCodigo} />
        )}
      </SectionCard>
    </div>
  );
}
