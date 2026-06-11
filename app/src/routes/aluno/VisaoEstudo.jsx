/* A visão de estudo de UM aluno: Meta / Registrar / Desempenho /
   Simulados / Arquivo / Plano. É a mesma composição para o aluno
   (edita), o responsável e a coordenação (leem) — quem decide o que
   cada um PODE é o banco; aqui só se esconde o que não cabe ao papel. */
import React, { useEffect, useMemo, useState } from "react";
import { Card, Empty, Tag, SubjDot, Estrelas, Erro } from "../../shared/ui/componentes.jsx";
import { Cronometro } from "../../shared/ui/Cronometro.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { useTrilha } from "../../modules/conteudo/useTrilha.js";
import { MetaHero } from "../../modules/motor/MetaHero.jsx";
import { MetaSemana } from "../../modules/motor/MetaSemana.jsx";
import { Registrar } from "../../modules/motor/Registrar.jsx";
import { Arquivo } from "../../modules/motor/Arquivo.jsx";
import { Progresso, Simulados } from "../../modules/desempenho/Progresso.jsx";
import { Acumulado } from "../../modules/desempenho/Acumulado.jsx";
import { Resumo } from "../../modules/desempenho/Resumo.jsx";
import { calcularMetricas } from "../../modules/desempenho/metricas.js";
import { todayISO, fmtBR, daysBetween, semanaAtual } from "../../shared/regras/regras.js";
import * as db from "../../shared/data/index.js";

export function VisaoEstudo({ aluno, podeEditar, comResumo, abaInicial = "painel" }) {
  const T = useTema();
  const [tab, setTab] = useState(abaInicial);
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

  if (carregandoTrilha || dados.carregando) return <Empty txt="Carregando painel…" />;
  if (erroTrilha || dados.erro) return <Erro>{erroTrilha || dados.erro}</Erro>;
  if (!trilha) return <Empty txt="Aluno sem trilha de estudo." />;

  const ultimaSemana = semanasRegras[semanasRegras.length - 1];
  const diasProva = Math.max(0, daysBetween(new Date(todayISO()), new Date(String(ultimaSemana.fim))));

  const itensMeta = (meta?.meta_atividades ?? []);
  const doneCount = itensMeta.filter((x) => x.estado === "concluida").length;
  const totalTasks = itensMeta.filter((x) => x.estado !== "ignorada").length;

  const ABAS = [
    ["painel", "Meta"], ["registrar", "Registrar"], ["desempenho", "Desempenho"],
    ["simulados", "Simulados"], ["arquivo", "Arquivo"], ["plano", "Plano"],
  ].filter(([k]) => podeEditar || k !== "registrar");

  return (
    <div>
      {/* saudação + cronômetro: a cara de "começa agora" do jogo */}
      {podeEditar && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <div className="disp" style={{ fontSize: 21, fontWeight: 800 }}>Oi, {aluno.nome.split(" ")[0]} <span style={{ fontSize: 16 }}>⚓</span></div>
            <div style={{ fontSize: 12.5, color: T.sub, marginTop: 2 }}>Acompanhe seu progresso e veja o que falta para atingir sua meta.</div>
          </div>
          <Cronometro aoUsarMinutos={(min) => { setMinutosSugeridos(min); setTab("registrar"); }} />
        </div>
      )}

      <div className="navwrap" style={{ display: "flex", gap: 2, overflowX: "auto", borderBottom: `1px solid ${T.line}`, marginBottom: 16 }}>
        {ABAS.map(([k, lb]) => (
          <button key={k} className="tab" onClick={() => setTab(k)}
            style={{ border: "none", background: "transparent", color: tab === k ? T.gold : T.sub, fontWeight: 600, fontSize: 14, padding: "13px 14px", minHeight: 46, whiteSpace: "nowrap", borderBottom: tab === k ? `2px solid ${T.gold}` : "2px solid transparent" }}>
            {lb}
          </button>
        ))}
      </div>

      <div className="fade" key={tab}>
        {tab === "painel" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {comResumo && m && (
              <Resumo m={m} semanaAtiva={semanaAtiva} totalSemanas={semanasRegras.length}
                doneCount={doneCount} totalTasks={totalTasks} diasProva={diasProva} />
            )}
            <MetaHero meta={meta} trilha={trilha} m={m} />
            <MetaSemana meta={meta} trilha={trilha} podeEditar={podeEditar} aoMudar={recarregar} />
            {m && <QuestoesPorMateria m={m} trilha={trilha} />}
          </div>
        )}
        {tab === "registrar" && podeEditar && (
          <Registrar aluno={aluno} trilha={trilha} registros={dados.registros}
            aoMudar={recarregar} minutosSugeridos={minutosSugeridos} />
        )}
        {tab === "desempenho" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Acumulado registros={dados.registros} trilha={trilha} />
            <Progresso registros={dados.registros} trilha={trilha} />
          </div>
        )}
        {tab === "simulados" && (
          <Simulados aluno={aluno} simulados={dados.simulados} podeEditar={podeEditar} semanaAtiva={semanaAtiva} aoMudar={recarregar} />
        )}
        {tab === "arquivo" && (
          <Arquivo metas={dados.metas} trilha={trilha} registros={dados.registros} />
        )}
        {tab === "plano" && <Plano trilha={trilha} semanaAtiva={semanaAtiva} meta={meta} />}
      </div>
    </div>
  );
}

function QuestoesPorMateria({ m, trilha }) {
  const T = useTema();
  const porMat = trilha.disciplinas.map((s) => ({
    ...s, q: m.wlogs.filter((l) => l.disciplina_codigo === s.codigo).reduce((a, l) => a + (+l.questoes || 0), 0),
  })).filter((x) => x.q > 0);

  return (
    <Card>
      <div className="disp" style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Questões por matéria — esta semana</div>
      {porMat.length === 0 ? <Empty txt="Sem registros nesta semana ainda." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {porMat.sort((a, b) => b.q - a.q).map((s) => {
            const max = Math.max(...porMat.map((x) => x.q));
            return (
              <div key={s.codigo} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 92, fontSize: 12.5, color: T.sub, flexShrink: 0 }}>{s.nome}</div>
                <div style={{ flex: 1, background: T.bg, borderRadius: 5, height: 22, overflow: "hidden" }}>
                  <div style={{ width: `${(s.q / max) * 100}%`, height: "100%", background: s.cor, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8, borderRadius: 5 }}>
                    <span className="num" style={{ fontSize: 12, fontWeight: 700, color: "#0A1622" }}>{s.q}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* O Plano: as semanas inteiras da trilha. Os textos vêm do conteúdo
   global (a metodologia importada); o estado vem da meta do aluno
   quando há (semana corrente). */
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
          <Card key={w.numero} style={{ borderColor: isNow ? T.gold : T.line, borderWidth: isNow ? 2 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <div className="disp" style={{ fontSize: 16, fontWeight: 700, color: isNow ? T.gold : T.ink }}>
                Semana {w.numero} {isNow && <span style={{ fontSize: 11, color: T.gold }}>· agora</span>}
              </div>
              <div style={{ fontSize: 12, color: T.sub }}>
                {fmtBR(String(w.inicio))}–{fmtBR(String(w.fim))}{isNow ? ` · ${dc}/${tarefas.length}` : ""}
              </div>
            </div>
            <div style={{ fontStyle: "italic", color: T.sub, fontSize: 13, margin: "3px 0 6px" }}>{w.foco}</div>
            {w.simulado && <div style={{ fontSize: 12, color: T.red, fontWeight: 600, marginBottom: 8 }}>⚑ {w.simulado}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {tarefas.map((tk) => {
                const estado = estadosPorAtividade[tk.id];
                const ch = estado === "concluida";
                return (
                  <div key={tk.id} className="chk" style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "9px 4px", minHeight: 44, opacity: estado === "ignorada" ? 0.45 : 1 }}>
                    <input type="checkbox" checked={ch} disabled style={{ marginTop: 2, accentColor: T.gold, width: 20, height: 20, flexShrink: 0 }} />
                    <span style={{ flex: 1, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <SubjDot disciplina={trilha.porCodigo[tk.disciplina_codigo]} /><Tag p={tk.prioridade} /><Estrelas p={tk.prioridade} />
                      <span style={{ fontSize: 13, color: ch ? T.sub : T.ink, textDecoration: ch ? "line-through" : "none", flexBasis: "100%" }}>{tk.texto}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
