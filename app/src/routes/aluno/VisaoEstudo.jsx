/* A visão de estudo de UM aluno, com cara de missão (ref. designs):
   Hoje / Registrar / Desempenho / Simulados / Histórico / Plano.
   Mesma composição para aluno (edita) e para coordenação (lê) — o
   banco decide o que cada um PODE; aqui só se esconde o que não cabe. */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Tag, SubjDot, ErroComRetry, BarraXP, StatusBadge, CarregandoBloco } from "../../shared/ui/componentes.jsx";
import { FeedbackProgresso, MissoesPersistidas } from "../../modules/motor/ProgressoVivido.jsx";
import { Icone } from "../../shared/ui/Icones.jsx";
import { MenuPrincipal } from "../../shared/ui/MenuPrincipal.jsx";
import { Cronometro } from "../../shared/ui/Cronometro.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { useTrilha } from "../../modules/conteudo/useTrilha.js";
import { FaixaAspirante, MissaoAtual } from "../../modules/motor/MetaHero.jsx";
import { MetaSemana } from "../../modules/motor/MetaSemana.jsx";
import { Registrar } from "../../modules/motor/Registrar.jsx";
import { Arquivo } from "../../modules/motor/Arquivo.jsx";
import { Conquistas, ConquistasRecentes } from "../../modules/motor/Conquistas.jsx";
import { TrilhaConcurso } from "../../modules/conteudo/TrilhaConcurso.jsx";
import { calcularXP, patente } from "../../modules/motor/jargao.js";
import { Progresso, Simulados } from "../../modules/desempenho/Progresso.jsx";
import { InsightsDesempenho } from "../../modules/desempenho/Insights.jsx";
import { Acumulado } from "../../modules/desempenho/Acumulado.jsx";
import { RadarDesempenho } from "../../modules/desempenho/RadarDesempenho.jsx";
import { NiveisPorMateria } from "../../modules/desempenho/Niveis.jsx";
import { calcularMetricas } from "../../modules/desempenho/metricas.js";
import { semanaAtual, fmtBR } from "../../shared/regras/regras.js";
import { mensagemAmigavel } from "../../shared/lib/erros.js";
import * as db from "../../shared/data/index.js";

function SecaoDesempenho({ rotulo }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: "#7E93A6", margin: "4px 2px 0" }}>
      {rotulo}
    </div>
  );
}

export function VisaoEstudo({ aluno, podeEditar, concurso = null, contexto = "Plano de estudos" }) {
  const T = useTema();
  const [tab, setTab] = useState("hoje");
  const [dados, setDados] = useState({ carregando: true, metas: [], registros: [], simulados: [], xpPersistido: null, erro: null });
  const { trilha, carregando: carregandoTrilha, erro: erroTrilha, recarregar: recarregarTrilha } = useTrilha(aluno?.trilha_id);
  const [versao, setVersao] = useState(0);
  const [minutosSugeridos, setMinutosSugeridos] = useState(0);
  const recarregar = () => setVersao((v) => v + 1);
  const recarregarTudo = () => { recarregar(); recarregarTrilha(); };

  // Modo essencial (UX1.2): reduz a aba "Hoje" ao núcleo "o que faço
  // agora" (faixa + missão + meta + registrar), recolhendo os extras de
  // gamificação. Preferência persistida por aluno neste navegador.
  const [essencial, setEssencial] = useState(() => {
    try { return localStorage.getItem("rumo-modo-essencial") === "1"; } catch { return false; }
  });
  const alternarEssencial = () => setEssencial((v) => {
    const n = !v;
    try { localStorage.setItem("rumo-modo-essencial", n ? "1" : "0"); } catch { /* ignora */ }
    return n;
  });

  // ---- missões PERSISTIDAS (PED1): fecham sozinhas quando o aluno bate
  // volume + acurácia. Lê a tabela aluno_missoes (motor no banco).
  const examTag = concurso?.codigo ?? null;
  const [gam, setGam] = useState({ missoes: [] });
  const [feedback, setFeedback] = useState(null);
  const snapRef = useRef(null);

  useEffect(() => {
    if (!aluno?.id || !examTag) { setGam({ missoes: [] }); snapRef.current = null; return; }
    let vivo = true;
    db.carregarMissoesAluno(aluno.id)
      .then((missoes) => { if (vivo) setGam({ missoes: missoes ?? [] }); })
      .catch(() => { /* missões são complementares: nunca derrubam a tela de estudo */ });
    return () => { vivo = false; };
  }, [aluno?.id, examTag, versao]);

  // feedback no MOMENTO DA AÇÃO: compara o XP do ledger (fonte de verdade
  // C0) e as missões fechadas entre recargas, e celebra o delta (só para
  // quem registrou — o aluno).
  useEffect(() => {
    if (!podeEditar || !examTag) return;
    const snap = {
      xp: dados.xpPersistido?.total ?? 0,
      missoes: gam.missoes.filter((mi) => mi.estado === "concluida").map((mi) => mi.missao_id),
    };
    const prev = snapRef.current;
    snapRef.current = snap;
    if (!prev) return; // 1ª carga é a linha de base, sem festejar nada
    const ganhouXp = snap.xp - prev.xp;
    const novasMissoes = snap.missoes.filter((id) => !prev.missoes.includes(id)).length;
    if (ganhouXp > 0 || novasMissoes > 0) {
      setFeedback({ xp: ganhouXp, missoes: novasMissoes, conquistas: 0, em: Date.now() });
    }
  }, [gam, dados.xpPersistido, podeEditar, examTag]);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 6000);
    return () => clearTimeout(t);
  }, [feedback]);
  // toda troca de aba (menu OU botões internos) nasce no topo da página
  const irAba = (k) => { setTab(k); window.scrollTo({ top: 0, left: 0, behavior: "instant" }); };

  // índice de navegação da aba Desempenho (rola até a seção) — reduz a
  // sensação de "parede de blocos" sem esconder conteúdo (UX1.2).
  const refResumo = useRef(null), refMaterias = useRef(null), refHistorico = useRef(null);
  const rolarPara = (ref) => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  useEffect(() => {
    if (!aluno) return;
    let vivo = true;
    Promise.all([db.listarMetas(aluno.id), db.listarRegistros(aluno.id), db.listarSimulados(aluno.id), db.carregarXpPersistido(aluno.id)])
      .then(([metas, registros, simulados, xpPersistido]) => vivo && setDados({ carregando: false, metas, registros, simulados, xpPersistido, erro: null }))
      .catch((e) => vivo && setDados((d) => ({ ...d, carregando: false, erro: mensagemAmigavel(e, "carregar") })));
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

  if (carregandoTrilha || dados.carregando) return <CarregandoBloco titulo="Carregando seu painel de estudos…" cartoes={3} linhas={4} />;
  if (dados.erro) return <ErroComRetry aoTentar={recarregarTudo}>{dados.erro}</ErroComRetry>;
  if (erroTrilha) return <ErroComRetry aoTentar={recarregarTudo}>{erroTrilha}</ErroComRetry>;
  if (!trilha) return (
    <div style={{ padding: "32px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 28, opacity: 0.4 }}>🗺️</div>
      <div style={{ fontSize: 15, fontWeight: 700, marginTop: 12 }}>Trilha ainda não configurada</div>
      <div style={{ fontSize: 13, color: "#7E93A6", marginTop: 6, lineHeight: 1.5, maxWidth: 300, marginInline: "auto" }}>
        Sua trilha de estudo ainda não foi configurada pela coordenação. Em breve você terá acesso ao seu plano.
      </div>
    </div>
  );

  const itensMeta = (meta?.meta_atividades ?? []);
  const pendentes = itensMeta.filter((x) => x.estado === "pendente").length;
  // XP da FONTE DE VERDADE (ledger persistido, Fase C0 + PED1). Se o aluno
  // ainda não tem eventos (base nova/antes do backfill), cai na estimativa legada.
  const xp = dados.xpPersistido?.eventos?.length
    ? dados.xpPersistido.total
    : calcularXP({ metas: dados.metas, totalQuestoes: m?.totDone ?? 0, simulados: dados.simulados.length });

  const ABAS = [
    ["hoje", "Hoje", null, "ancora"], ["concurso", "Trilha", null, "escudo"], ["registrar", "Registrar", null, "lapis"],
    ["desempenho", "Desempenho", null, "grafico"], ["simulados", "Simulados", null, "alvo"],
    ["conquistas", "Conquistas", null, "medalha"], ["historico", "Histórico", null, "arquivo"], ["plano", "Plano", null, "mapa"],
  ].filter(([k]) => podeEditar || k !== "registrar").map(
    ([k, lb, badge, icone]) => (k === "hoje" && podeEditar && pendentes > 0 ? [k, lb, pendentes, icone] : [k, lb, badge, icone]),
  );

  return (
    <div>
      {feedback && <FeedbackProgresso feedback={feedback} aoFechar={() => setFeedback(null)} />}
      {/* cronômetro: só nas abas onde o estudo é registrado (Hoje/Registrar),
          para não ocupar espaço em Desempenho, Plano etc. (UX1.2) */}
      {podeEditar && (tab === "hoje" || tab === "registrar") && (
        <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}>
          <Cronometro aoFinalizar={(min) => { setMinutosSugeridos(min); irAba("registrar"); }} />
        </div>
      )}

      <MenuPrincipal abas={ABAS} ativo={tab} aoTrocar={setTab}
        usuario={{ nome: aluno.nome, sub: `${patente(xp).nome} · ${xp.toLocaleString("pt-BR")} XP` }} />

      <div className="fade" key={tab}>
        {tab === "hoje" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 4 }}>
            {podeEditar && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: -6 }}>
                <button onClick={alternarEssencial}
                  aria-pressed={essencial}
                  title={essencial ? "Mostrar tudo na tela inicial" : "Reduzir a tela inicial ao essencial"}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, border: `1px solid ${essencial ? T.gold : T.line}`, background: essencial ? `${T.gold}14` : "transparent", color: essencial ? T.gold : T.sub, borderRadius: 999, fontSize: 12, fontWeight: 700, padding: "6px 13px", minHeight: 34 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: essencial ? T.gold : T.sub }} />
                  {essencial ? "Modo essencial" : "Modo completo"}
                </button>
              </div>
            )}
            <FaixaAspirante nome={aluno.nome.split(" ")[0]} contexto={contexto} xp={xp} streak={m?.streak ?? 0}
              aoAbrirConquistas={() => irAba("conquistas")} />
            <MissaoAtual meta={meta} trilha={trilha} m={m} aoAvancar={podeEditar ? irAba : undefined} />
            {!essencial && examTag && gam.missoes.length > 0 && <MissoesPersistidas missoes={gam.missoes} />}
            <MetaSemana meta={meta} trilha={trilha} podeEditar={podeEditar} aoMudar={recarregar}
              aoAbrirDesempenho={() => irAba("desempenho")} />
            {!essencial && m && <ConquistasRecentes m={m} metas={dados.metas} simulados={dados.simulados} aoAbrir={() => irAba("conquistas")} />}
            {podeEditar && (
              <button onClick={() => irAba("registrar")}
                style={{ border: `1px dashed ${T.gold}66`, background: `${T.gold}0c`, color: T.gold, borderRadius: 12, fontWeight: 700, fontSize: 14, padding: "16px", minHeight: 52, marginTop: 2 }}>
                ✎ Registrar estudo de hoje
              </button>
            )}
            {essencial && (
              <div style={{ fontSize: 11.5, color: T.sub, textAlign: "center", lineHeight: 1.5 }}>
                Modo essencial ativo — conquistas e missões extras estão recolhidas. Toque em “Modo essencial” acima para ver tudo.
              </div>
            )}
          </div>
        )}
        {tab === "concurso" && (
          <TrilhaConcurso examTag={concurso?.codigo ?? null} concursoNome={concurso?.nome ?? null} />
        )}
        {tab === "registrar" && podeEditar && (
          <Registrar aluno={aluno} trilha={trilha} registros={dados.registros}
            aoMudar={recarregar} minutosSugeridos={minutosSugeridos} />
        )}
        {tab === "desempenho" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <nav aria-label="Seções do desempenho" className="navwrap" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
              {[["Resumo", refResumo], ["Por matéria", refMaterias], ["Histórico", refHistorico]].map(([rot, r]) => (
                <button key={rot} onClick={() => rolarPara(r)}
                  style={{ flexShrink: 0, border: `1px solid ${T.line}`, background: T.card, color: T.sub, borderRadius: 999, fontSize: 12.5, fontWeight: 700, padding: "7px 14px", minHeight: 36, whiteSpace: "nowrap" }}>
                  {rot}
                </button>
              ))}
            </nav>
            <div ref={refResumo}>{m && <InsightsDesempenho m={m} />}</div>
            <div ref={refMaterias} style={{ display: "flex", flexDirection: "column", gap: 16, scrollMarginTop: 72 }}>
              <SecaoDesempenho rotulo="◉ Diagnóstico por matéria" />
              <NiveisPorMateria m={m} trilha={trilha} />
              <RadarDesempenho m={m} trilha={trilha} aoRegistrar={podeEditar ? () => irAba("registrar") : null} />
            </div>
            <div ref={refHistorico} style={{ display: "flex", flexDirection: "column", gap: 16, scrollMarginTop: 72 }}>
              <SecaoDesempenho rotulo="▣ Histórico acumulado" />
              <Acumulado registros={dados.registros} trilha={trilha} />
              <Progresso registros={dados.registros} trilha={trilha} />
            </div>
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

/* O Plano (Fase 16.4): a trilha vira JORNADA — uma linha do tempo de
   missões com estado claro (encerrada / em andamento / a desbloquear),
   "onde estou" e o próximo passo. Textos da metodologia importada;
   estado da semana corrente vem da meta. */
function Plano({ trilha, semanaAtiva, meta }) {
  const T = useTema();
  const estadosPorAtividade = Object.fromEntries(
    (meta?.meta_atividades ?? []).map((ma) => [ma.atividade_modelo_id, ma.estado]),
  );
  const ativaNum = semanaAtiva?.numero ?? trilha.semanas[0]?.numero;
  const total = trilha.semanas.length;
  const posicao = Math.max(1, trilha.semanas.findIndex((w) => w.numero === ativaNum) + 1);
  const pctJornada = total > 1 ? Math.round(((posicao - 1) / (total - 1)) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* onde estou — cabeçalho da jornada */}
      <div style={{ background: `linear-gradient(135deg, ${T.cardHi}, ${T.card})`, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, color: T.sub, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>Sua jornada</div>
          <div className="num" style={{ fontSize: 11.5, color: T.sub }}>semana <b className="disp" style={{ color: T.gold, fontSize: 15 }}>{posicao}</b> de {total}</div>
        </div>
        <div style={{ marginTop: 9 }}><BarraXP pct={pctJornada} alt={7} /></div>
      </div>

      <div style={{ position: "relative" }}>
        {/* trilho vertical que liga as missões */}
        <div style={{ position: "absolute", left: 13, top: 14, bottom: 14, width: 2, background: T.line }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {trilha.semanas.map((w) => (
            <MissaoJornada key={w.numero} w={w} trilha={trilha} ativaNum={ativaNum}
              estadosPorAtividade={estadosPorAtividade} T={T} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Uma etapa da jornada: nó na linha do tempo + cartão da semana.
function MissaoJornada({ w, trilha, ativaNum, estadosPorAtividade, T }) {
  const isNow = w.numero === ativaNum;
  const isPast = w.numero < ativaNum;
  const tarefas = trilha.atividadesPorSemana[w.numero] ?? [];
  const dc = tarefas.filter((tk) => estadosPorAtividade[tk.id] === "concluida").length;
  const [aberto, setAberto] = useState(isNow);
  const tom = isNow ? "alerta" : isPast ? "ok" : "neutro";
  const rotulo = isPast ? "Encerrada" : isNow ? "Em andamento" : "Próxima";
  const pct = tarefas.length ? Math.round((dc / tarefas.length) * 100) : 0;

  // nó: encerrada = check; agora = ponto vivo; futura = cadeado
  const no = isNow
    ? { bg: T.bg2, br: T.gold, cor: T.gold, icone: null }
    : isPast ? { bg: T.green, br: T.green, cor: "#0A1622", icone: "check" }
    : { bg: T.bg, br: T.line, cor: T.sub, icone: "cadeado" };

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ width: 28, display: "flex", justifyContent: "center", flexShrink: 0, zIndex: 1 }}>
        <span style={{ width: 28, height: 28, borderRadius: "50%", background: no.bg, border: `2px solid ${no.br}`, color: no.cor, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: isNow ? `0 0 0 4px ${T.gold}22` : "none" }}>
          {no.icone ? <Icone nome={no.icone} tam={14} grosso={no.icone === "check" ? 3 : 2} /> : <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.gold }} />}
        </span>
      </div>

      <div style={{ flex: 1, minWidth: 0, background: T.card, border: `1px solid ${isNow ? T.gold : T.line}`, borderWidth: isNow ? 1.5 : 1, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="disp" style={{ fontSize: 14.5, fontWeight: 700 }}>Semana {w.numero}</span>
            <StatusBadge tom={tom}>{rotulo}</StatusBadge>
            <span className="num" style={{ marginLeft: "auto", fontSize: 11, color: T.sub }}>{fmtBR(String(w.inicio))}–{fmtBR(String(w.fim))}</span>
          </div>
          <div style={{ fontStyle: "italic", color: T.sub, fontSize: 13, marginTop: 6, lineHeight: 1.4 }}>{w.foco}</div>
          {w.simulado && <div style={{ fontSize: 12, color: T.red, fontWeight: 700, marginTop: 6 }}>⚑ {w.simulado}</div>}

          {isNow && tarefas.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <BarraXP pct={pct} alt={5} brilho={false} />
              <div className="num" style={{ fontSize: 11, color: T.sub, marginTop: 4 }}>{dc}/{tarefas.length} objetivos · <b style={{ color: T.gold }}>{pct}%</b></div>
            </div>
          )}

          {tarefas.length > 0 && (
            <button onClick={() => setAberto((v) => !v)}
              style={{ marginTop: 10, border: "none", background: "transparent", color: T.sub, fontSize: 12, fontWeight: 600, padding: "4px 0", display: "flex", alignItems: "center", gap: 5 }}>
              {aberto ? "▾ ocultar" : `▸ ver ${tarefas.length} ${tarefas.length === 1 ? "objetivo" : "objetivos"}`}
            </button>
          )}
        </div>

        {aberto && tarefas.length > 0 && (
          <div style={{ borderTop: `1px solid ${T.line}`, padding: "8px 14px 12px" }}>
            {tarefas.map((tk) => {
              const estado = estadosPorAtividade[tk.id];
              const ch = estado === "concluida";
              return (
                <div key={tk.id} className="chk" style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "8px 0", opacity: estado === "ignorada" ? 0.45 : 1 }}>
                  <span style={{ marginTop: 3, width: 15, height: 15, borderRadius: "50%", border: `2px solid ${ch ? T.green : T.line}`, background: ch ? T.green : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#0A1622", fontWeight: 800 }}>{ch ? "✓" : ""}</span>
                  <span style={{ flex: 1, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <SubjDot disciplina={trilha.porCodigo[tk.disciplina_codigo]} /><Tag p={tk.prioridade} />
                    <span style={{ fontSize: 13, color: ch ? T.sub : T.ink, textDecoration: ch ? "line-through" : "none", flexBasis: "100%" }}>{tk.texto}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
