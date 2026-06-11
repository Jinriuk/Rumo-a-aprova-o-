/* A visão de estudo de UM aluno, com cara de missão (ref. designs):
   Hoje / Registrar / Desempenho / Simulados / Histórico / Plano.
   Mesma composição para aluno (edita) e para coordenação (lê) — o
   banco decide o que cada um PODE; aqui só se esconde o que não cabe. */
import React, { useEffect, useMemo, useState } from "react";
import { SectionCard, Empty, Tag, SubjDot, Estrelas, Erro } from "../../shared/ui/componentes.jsx";
import { MenuPrincipal } from "../../shared/ui/MenuPrincipal.jsx";
import { Cronometro } from "../../shared/ui/Cronometro.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { useTrilha } from "../../modules/conteudo/useTrilha.js";
import { FaixaAspirante, MissaoAtual } from "../../modules/motor/MetaHero.jsx";
import { MetaSemana } from "../../modules/motor/MetaSemana.jsx";
import { Registrar } from "../../modules/motor/Registrar.jsx";
import { Arquivo } from "../../modules/motor/Arquivo.jsx";
import { Conquistas } from "../../modules/motor/Conquistas.jsx";
import { calcularXP, patente } from "../../modules/motor/jargao.js";
import { Progresso, Simulados } from "../../modules/desempenho/Progresso.jsx";
import { InsightsDesempenho } from "../../modules/desempenho/Insights.jsx";
import { Acumulado } from "../../modules/desempenho/Acumulado.jsx";
import { RadarDesempenho } from "../../modules/desempenho/RadarDesempenho.jsx";
import { Resumo } from "../../modules/desempenho/Resumo.jsx";
import { calcularMetricas } from "../../modules/desempenho/metricas.js";
import { semanaAtual, fmtBR } from "../../shared/regras/regras.js";
import * as db from "../../shared/data/index.js";

export function VisaoEstudo({ aluno, podeEditar, comResumo, concurso = null, contexto = "Plano de estudos" }) {
  const T = useTema();
  const [tab, setTab] = useState("hoje");
  const [dados, setDados] = useState({ carregando: true, metas: [], registros: [], simulados: [], erro: null });
  const { trilha, carregando: carregandoTrilha, erro: erroTrilha } = useTrilha(aluno?.trilha_id);
  const [versao, setVersao] = useState(0);
  const [minutosSugeridos, setMinutosSugeridos] = useState(0);
  const recarregar = () => setVersao((v) => v + 1);

  useEffect(() => {
    if (!aluno) return;
    let vivo = true;
    Promise.all([db.listarMetas(aluno.id), db.listarRegistros(aluno.id), db.listarSimulados(aluno.id)])
      .then(([metas, registros, simulados]) => vivo && setDados({ carregando: false, metas, registros, simulados, erro: null }))
      .catch((e) => vivo && setDados((d) => ({ ...d, carregando: false, erro: e.message })));
    return () => { vivo = false; };
  }, [aluno?.id, versao]);

  const meta = dados.metas.find((x) => x.status === "ativa") ?? dados.metas[0] ?? null;

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

  if (carregandoTrilha || dados.carregando) return <Empty txt="Carregando…" />;
  if (erroTrilha || dados.erro) return <Erro>{erroTrilha || dados.erro}</Erro>;
  if (!trilha) return <Empty txt="Aluno sem trilha de estudo." />;

  const itensMeta = (meta?.meta_atividades ?? []);
  const pendentes = itensMeta.filter((x) => x.estado === "pendente").length;
  const xp = calcularXP({ metas: dados.metas, totalQuestoes: m?.totDone ?? 0, simulados: dados.simulados.length });

  const ABAS = [
    ["hoje", "Hoje", null, "ancora"], ["registrar", "Registrar", null, "lapis"],
    ["desempenho", "Desempenho", null, "grafico"], ["simulados", "Simulados", null, "alvo"],
    ["conquistas", "Conquistas", null, "medalha"], ["historico", "Histórico", null, "arquivo"], ["plano", "Plano", null, "mapa"],
  ].filter(([k]) => podeEditar || k !== "registrar").map(
    ([k, lb, badge, icone]) => (k === "hoje" && podeEditar && pendentes > 0 ? [k, lb, pendentes, icone] : [k, lb, badge, icone]),
  );

  return (
    <div>
      {/* cronômetro: começa agora, e o tempo vai direto pro registro */}
      {podeEditar && (
        <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}>
          <Cronometro aoFinalizar={(min) => { setMinutosSugeridos(min); setTab("registrar"); }} />
        </div>
      )}

      <MenuPrincipal abas={ABAS} ativo={tab} aoTrocar={setTab}
        usuario={{ nome: aluno.nome, sub: `${patente(xp).nome} · ${xp.toLocaleString("pt-BR")} XP` }} />

      <div className="fade" key={tab}>
        {tab === "hoje" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <FaixaAspirante nome={aluno.nome.split(" ")[0]} contexto={contexto} xp={xp} streak={m?.streak ?? 0}
              aoAbrirConquistas={() => setTab("conquistas")} />
            {comResumo && m && (
              <Resumo m={m} semanaAtiva={semanaAtiva} totalSemanas={semanasRegras.length}
                doneCount={itensMeta.filter((x) => x.estado === "concluida").length}
                totalTasks={itensMeta.filter((x) => x.estado !== "ignorada").length} diasProva={null} />
            )}
            <MissaoAtual meta={meta} trilha={trilha} m={m} />
            <MetaSemana meta={meta} trilha={trilha} podeEditar={podeEditar} aoMudar={recarregar} />
            {podeEditar && (
              <button onClick={() => setTab("registrar")}
                style={{ border: `1px dashed ${T.gold}66`, background: `${T.gold}0c`, color: T.gold, borderRadius: 12, fontWeight: 700, fontSize: 14, padding: "14px", minHeight: 50 }}>
                ✎ Registrar estudo de hoje
              </button>
            )}
          </div>
        )}
        {tab === "registrar" && podeEditar && (
          <Registrar aluno={aluno} trilha={trilha} registros={dados.registros}
            aoMudar={recarregar} minutosSugeridos={minutosSugeridos} />
        )}
        {tab === "desempenho" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {m && <InsightsDesempenho m={m} />}
            <RadarDesempenho m={m} trilha={trilha} aoRegistrar={podeEditar ? () => setTab("registrar") : null} />
            <Acumulado registros={dados.registros} trilha={trilha} />
            <Progresso registros={dados.registros} trilha={trilha} />
          </div>
        )}
        {tab === "simulados" && (
          <Simulados aluno={aluno} simulados={dados.simulados} podeEditar={podeEditar} semanaAtiva={semanaAtiva} concurso={concurso} aoMudar={recarregar} />
        )}
        {tab === "conquistas" && m && (
          <Conquistas nome={aluno.nome.split(" ")[0]} xp={xp} m={m} metas={dados.metas} simulados={dados.simulados} />
        )}
        {tab === "historico" && (
          <Arquivo metas={dados.metas} trilha={trilha} registros={dados.registros} />
        )}
        {tab === "plano" && <Plano trilha={trilha} semanaAtiva={semanaAtiva} meta={meta} />}
      </div>
    </div>
  );
}

/* O Plano: as semanas inteiras da trilha. Textos da metodologia
   importada; estado vem da meta da semana corrente quando há. */
function Plano({ trilha, semanaAtiva, meta }) {
  const T = useTema();
  const estadosPorAtividade = Object.fromEntries(
    (meta?.meta_atividades ?? []).map((ma) => [ma.atividade_modelo_id, ma.estado]),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {trilha.semanas.map((w) => {
        const isNow = w.numero === semanaAtiva?.numero;
        const tarefas = trilha.atividadesPorSemana[w.numero] ?? [];
        const dc = tarefas.filter((tk) => estadosPorAtividade[tk.id] === "concluida").length;
        return (
          <SectionCard key={w.numero}
            titulo={`Missão ${w.numero}${isNow ? " · agora" : ""}`}
            sub={`${fmtBR(String(w.inicio))}–${fmtBR(String(w.fim))}${isNow ? ` · ${dc}/${tarefas.length}` : ""}`}
            style={isNow ? { borderColor: T.gold, borderWidth: 1.5 } : undefined}>
            <div style={{ fontStyle: "italic", color: T.sub, fontSize: 13, marginBottom: 8 }}>{w.foco}</div>
            {w.simulado && <div style={{ fontSize: 12, color: T.red, fontWeight: 600, marginBottom: 8 }}>⚑ {w.simulado}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {tarefas.map((tk) => {
                const estado = estadosPorAtividade[tk.id];
                const ch = estado === "concluida";
                return (
                  <div key={tk.id} className="chk" style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "9px 4px", minHeight: 40, opacity: estado === "ignorada" ? 0.45 : 1 }}>
                    <span style={{ marginTop: 3, width: 16, height: 16, borderRadius: "50%", border: `2px solid ${ch ? T.green : T.line}`, background: ch ? T.green : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#0A1622", fontWeight: 800 }}>{ch ? "✓" : ""}</span>
                    <span style={{ flex: 1, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <SubjDot disciplina={trilha.porCodigo[tk.disciplina_codigo]} /><Tag p={tk.prioridade} />
                      <span style={{ fontSize: 13, color: ch ? T.sub : T.ink, textDecoration: ch ? "line-through" : "none", flexBasis: "100%" }}>{tk.texto}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        );
      })}
    </div>
  );
}
