/* A visão de estudo de UM aluno, com cara de missão (ref. designs):
   Hoje / Plano / Registrar / Desempenho / Simulados / Histórico.
   Mesma composição para aluno (edita) e para coordenação (lê) — o
   banco decide o que cada um PODE; aqui só se esconde o que não cabe. */
import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ErroComRetry, BarraXP, StatusBadge, CarregandoBloco } from "../../shared/ui/componentes.jsx";
import { FeedbackProgresso } from "../../modules/motor/ProgressoVivido.jsx";
import { Icone } from "../../shared/ui/Icones.jsx";
import { MenuPrincipal } from "../../shared/ui/MenuPrincipal.jsx";
import { Cronometro } from "../../shared/ui/Cronometro.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { useTrilha } from "../../modules/conteudo/useTrilha.js";
import { FaixaAspirante, CicloEncerrado } from "../../modules/motor/MetaHero.jsx";
import { MissaoDeAgora, MissoesDoHoje, ListaMissoes } from "../../modules/motor/MissoesDaSemana.jsx";
import { TarefasDaSemana } from "../../modules/motor/MetaSemana.jsx";
import { ResolverQuestoes } from "../../modules/motor/ResolverQuestoes.jsx";
import { contextoRegistroDaMissao } from "../../modules/motor/jornada.js";
import { Registrar } from "../../modules/motor/Registrar.jsx";
import { Arquivo } from "../../modules/motor/Arquivo.jsx";
import { Conquistas } from "../../modules/motor/Conquistas.jsx";
import { filaDeMissoes } from "../../modules/conteudo/missoes.js";
import { montarMissoesPorSemana, resumoMissoesDaSemana } from "../../modules/conteudo/missoesPorSemana.js";
import { calcularXP, patente } from "../../modules/motor/jargao.js";
import { InsightsDesempenho } from "../../modules/desempenho/Insights.jsx";
import { NiveisPorMateria } from "../../modules/desempenho/Niveis.jsx";
import { LinhaMaturidade } from "../../modules/conteudo/SeloMaturidade.jsx";
import { useEnvioUnico } from "../../shared/hooks/useEnvioUnico.js";
import { useGuia } from "../../shared/guia/GuiaPassoAPasso.jsx";
import { ROTEIRO_ALUNO, chaveGuia } from "../../shared/guia/roteiros.js";

// ETAPA 3 — code-splitting: os painéis de gráfico carregam o recharts
// (a maior dependência do bundle). Importados sob demanda (só quando o
// aluno abre as abas Desempenho/Simulados), saem do bundle principal.
const Progresso = lazy(() => import("../../modules/desempenho/Progresso.jsx").then((m) => ({ default: m.Progresso })));
const Simulados = lazy(() => import("../../modules/desempenho/Progresso.jsx").then((m) => ({ default: m.Simulados })));
const Acumulado = lazy(() => import("../../modules/desempenho/Acumulado.jsx").then((m) => ({ default: m.Acumulado })));
const RadarDesempenho = lazy(() => import("../../modules/desempenho/RadarDesempenho.jsx").then((m) => ({ default: m.RadarDesempenho })));
import { calcularMetricas } from "../../modules/desempenho/metricas.js";
import { semanaAtual, estadoDoCiclo, fmtBR } from "../../shared/regras/regras.js";
import { mensagemAmigavel } from "../../shared/lib/erros.js";
import * as db from "../../shared/data/index.js";

function SecaoDesempenho({ rotulo }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: "#7E93A6", margin: "4px 2px 0" }}>
      {rotulo}
    </div>
  );
}

// PERF: `trilhaEstado` vem de fora (AreaAluno) de propósito. Esta tela já
// chamava `useTrilha(aluno.trilha_id)` enquanto AreaAluno carregava a MESMA
// trilha para a contagem da prova — as duas buscavam as mesmas 4 tabelas por
// entrada de aluno. Agora quem monta a tela carrega uma vez e passa adiante.
// O fallback mantém o componente utilizável sozinho (e é o mesmo hook, então
// não há caminho de dado diferente): se ninguém passar `trilhaEstado`, ele
// busca por conta própria, como antes.
export function VisaoEstudo({ aluno, podeEditar, concurso = null, contexto = "Plano de estudos", trilhaEstado = null, usuarioId = null, pedidoGuia = 0 }) {
  const T = useTema();
  const [tab, setTab] = useState("hoje");
  const [dados, setDados] = useState({ carregando: true, metas: [], registros: [], simulados: [], xpPersistido: null, erro: null, versao: -1 });
  const trilhaPropria = useTrilha(trilhaEstado ? null : aluno?.trilha_id);
  const { trilha, carregando: carregandoTrilha, erro: erroTrilha, recarregar: recarregarTrilha } = trilhaEstado ?? trilhaPropria;
  const [versao, setVersao] = useState(0);
  const [minutosSugeridos, setMinutosSugeridos] = useState(0);
  const [contextoRegistro, setContextoRegistro] = useState(null);
  const [confirmacaoRegistro, setConfirmacaoRegistro] = useState(null);
  const [objetivoConcluido, setObjetivoConcluido] = useState(false);
  const [realceMissao, setRealceMissao] = useState(0);
  // "Registrar" no Hoje abre o registro ali mesmo: nada no Hoje troca de aba
  const [registroNoHoje, setRegistroNoHoje] = useState(false);
  // voltar das Conquistas devolve o foco ao XP que as abriu (sem isto o
  // botão desmonta e o foco cai no <body>)
  const [focoXp, setFocoXp] = useState(false);
  const missaoRef = useRef(null);
  const fecharObjetivo = useEnvioUnico("acao");
  // Alvo da confirmação em tela AGORA, lido dentro do await de
  // concluirObjetivoDaJornada. Sem isto, concluir o objetivo A enquanto
  // o aluno já navegou pra B e está vendo a confirmação de B faz o
  // "true" de A vazar pra tela de B quando a resposta de A chega depois.
  const alvoConfirmacaoRef = useRef(null);
  useEffect(() => {
    alvoConfirmacaoRef.current = confirmacaoRegistro?.contexto?.metaAtividadeId ?? null;
  }, [confirmacaoRegistro]);
  const recarregar = () => setVersao((v) => v + 1);
  const recarregarTudo = () => { recarregar(); recarregarTrilha(); };

  // ---- missões PERSISTIDAS (PED1): fecham sozinhas quando o aluno bate
  // volume + acurácia. Lê a tabela aluno_missoes (motor no banco).
  const examTag = concurso?.codigo ?? null;
  const [gam, setGam] = useState({ missoes: [], versao: -1 });
  const [feedback, setFeedback] = useState(null);
  const snapRef = useRef(null);

  useEffect(() => {
    if (!aluno?.id || !examTag) { setGam({ missoes: [], versao }); snapRef.current = null; return; }
    let vivo = true;
    db.carregarMissoesAluno(aluno.id)
      .then((missoes) => { if (vivo) setGam({ missoes: missoes ?? [], versao }); })
      .catch(() => {
        // Missões são complementares: não derrubam a tela, mas marcam
        // esta versão como lida para não deixar a reconciliação presa.
        if (vivo) setGam((atual) => ({ ...atual, versao }));
      });
    return () => { vivo = false; };
  }, [aluno?.id, examTag, versao]);

  // Fila inteira de missões (0061): o catálogo do concurso e os ajustes da
  // escola dizem quais missões existem e em que ordem; aluno_missoes diz
  // quais já começaram ou fecharam. As que ainda não começaram aparecem
  // como "a seguir" (o banco não cria linha para elas antes da hora).
  const [catalogoMissoes, setCatalogoMissoes] = useState({ examTag: null, missoes: [], ajustes: [], nomes: {}, vinculos: [] });
  const [tentativaCatalogo, setTentativaCatalogo] = useState(0);
  useEffect(() => {
    if (!examTag) return;
    let vivo = true;
    // nomes do catálogo `materias`: a matéria de uma missão pode não estar
    // na trilha do aluno, e o painel nunca mostra o código cru (dir_adm)
    // e a semana de cada missão no plano do concurso (desenho de 18/10)
    Promise.all([db.carregarMissoes(examTag), db.carregarMissoesEscola(examTag), db.carregarNomesMateria().catch(() => ({})),
      db.carregarSemanasDasMissoes(examTag).catch(() => [])])
      .then(([missoes, ajustes, nomes, vinculos]) => { if (vivo) setCatalogoMissoes({ examTag, missoes: missoes ?? [], ajustes: ajustes ?? [], nomes: nomes ?? {}, vinculos: vinculos ?? [] }); })
      // falha não é "concurso sem missões": o cartão do Hoje diz que não
      // carregou e oferece tentar de novo (a tela fica)
      .catch(() => { if (vivo) setCatalogoMissoes({ examTag, missoes: [], ajustes: [], nomes: {}, vinculos: [], erro: true }); });
    return () => { vivo = false; };
  }, [examTag, tentativaCatalogo]);
  // P1.1: em quais missões o servidor ligou as questões integradas. Só o
  // aluno resolve (podeEditar). undefined = ainda perguntando: "Iniciar
  // missão" fica carregando e não decide nada. Set = a resposta (vazio sem
  // a 0065). null = não deu para saber depois de 3 tentativas: "Iniciar
  // missão" abre a sessão e o servidor decide (sem questões, ela oferece o
  // registro manual). Nunca vai ao registro por falta de resposta.
  const [questoesIntegradas, setQuestoesIntegradas] = useState(undefined);
  const [resolvendo, setResolvendo] = useState(null);
  const resolvendoRef = useRef(null);
  useEffect(() => {
    if (!podeEditar || !examTag) return undefined;   // o painel nem recebe aoResolver
    let vivo = true;
    let espera = null;
    const pedir = (tentativa) => db.missoesComQuestoesIntegradas()
      .catch(() => null)
      .then((ids) => {
        if (!vivo) return;
        if (ids === null && tentativa < 3) { espera = setTimeout(() => pedir(tentativa + 1), 1500 * tentativa); return; }
        // recarga que falha não apaga uma resposta que já veio
        setQuestoesIntegradas((antes) => (ids === null && antes instanceof Set ? antes : ids));
      });
    pedir(1);
    return () => { vivo = false; clearTimeout(espera); };
  }, [podeEditar, examTag, versao]);

  const filaMissoes = useMemo(() => {
    const doAlvo = catalogoMissoes.examTag === examTag;
    return filaDeMissoes({
      catalogo: doAlvo ? catalogoMissoes.missoes : [],
      ajustesEscola: doAlvo ? catalogoMissoes.ajustes : [],
      progresso: gam.missoes,
    });
  }, [catalogoMissoes, examTag, gam.missoes]);

  // Missões por semana (desenho de 18/10): a semana delas é a do ritmo do
  // aluno; a missão de agora é a primeira não concluída dessa semana.
  const missoesSemana = useMemo(() => {
    const doAlvo = catalogoMissoes.examTag === examTag;
    return montarMissoesPorSemana({
      fila: filaMissoes,
      catalogo: doAlvo ? catalogoMissoes.missoes : [],
      ajustesEscola: doAlvo ? catalogoMissoes.ajustes : [],
      vinculos: doAlvo ? catalogoMissoes.vinculos : [],
      totalSemanas: trilha?.semanas?.length ?? null,
      materiasDaTrilha: (trilha?.disciplinas ?? []).map((d) => d.codigo),
    });
  }, [catalogoMissoes, examTag, filaMissoes, trilha]);

  // Raio-x, mudança 8: matéria sempre pelo nome. A trilha do aluno manda
  // (é o nome que ele vê no Registrar); o catálogo cobre o resto.
  const nomesMateria = useMemo(() => ({
    ...catalogoMissoes.nomes,
    ...Object.fromEntries((trilha?.disciplinas ?? []).map((d) => [d.codigo, d.nome])),
  }), [catalogoMissoes.nomes, trilha]);

  // feedback no MOMENTO DA AÇÃO: compara o XP do ledger (fonte de verdade
  // C0) e as missões fechadas entre recargas, e celebra o delta (só para
  // quem registrou — o aluno).
  useEffect(() => {
    if (!podeEditar || !examTag) return;
    // Dados, XP e missões precisam pertencer à MESMA recarga. Sem este
    // gate, duas respostas em velocidades diferentes podem produzir
    // duas celebrações parciais para uma única ação.
    if (dados.versao !== versao || gam.versao !== versao) return;
    // Objetivo da trilha concluído entra no ledger como `missao_concluida`
    // com origem `meta_atividades`; a missão do motor tem origem própria e
    // vive em aluno_missoes. São concessões distintas, cada uma com o seu
    // XP — contá-las juntas viraria "2 missões", que o banco não fez.
    const objetivosNoLedger = (dados.xpPersistido?.eventos ?? []).filter(
      (e) => e.status !== "estornado" && e.tipo_evento === "missao_concluida" && e.origem === "meta_atividades",
    ).length;
    const snap = {
      xp: dados.xpPersistido?.total ?? 0,
      missoes: gam.missoes.filter((mi) => mi.estado === "concluida").map((mi) => mi.missao_id),
      objetivos: objetivosNoLedger,
    };
    const prev = snapRef.current;
    snapRef.current = snap;
    if (!prev) return; // 1ª carga é a linha de base, sem festejar nada
    const ganhouXp = snap.xp - prev.xp;
    const novasMissoes = snap.missoes.filter((id) => !prev.missoes.includes(id)).length;
    const novosObjetivos = Math.max(0, snap.objetivos - (prev.objetivos ?? 0));
    if (ganhouXp > 0 || novasMissoes > 0 || novosObjetivos > 0) {
      setFeedback({ xp: ganhouXp, missoes: novasMissoes, objetivos: novosObjetivos, conquistas: 0, em: Date.now() });
    }
  }, [gam, dados.xpPersistido, dados.versao, versao, podeEditar, examTag]);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 6000);
    return () => clearTimeout(t);
  }, [feedback]);
  // Toda troca de aba nasce no topo. Quando a origem é um objetivo, o
  // contexto acompanha a navegação; entradas genéricas em Registrar
  // continuam abrindo um formulário livre.
  const irAba = (k, contexto = null) => {
    setResolvendo(null);
    setRegistroNoHoje(false);
    if (k === "registrar") {
      setContextoRegistro(contexto);
      setConfirmacaoRegistro(null);
      setObjetivoConcluido(false);
      fecharObjetivo.setErro(null);
    }
    setTab(k);
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  };

  const registroConfirmado = ({ registro, contexto }) => {
    setConfirmacaoRegistro({ registro, contexto });
    setObjetivoConcluido(false);
    fecharObjetivo.setErro(null);
    recarregar();
  };

  /* O registro não fecha o objetivo — o aluno fecha, se quiser. Só
     marcamos como concluído depois que o banco devolve a linha; se a
     RLS ou a rede recusarem, o erro aparece e nada muda na tela. */
  const concluirObjetivoDaJornada = async () => {
    const alvo = confirmacaoRegistro?.contexto?.metaAtividadeId;
    if (!alvo) return;
    await fecharObjetivo.enviar(async () => {
      await db.definirEstadoAtividade(alvo, "concluida");
      // a confirmação em tela pode ter trocado de objetivo enquanto
      // este pedido estava em voo — só marca concluído se ainda for a
      // mesma que o aluno está vendo.
      if (alvoConfirmacaoRef.current === alvo) setObjetivoConcluido(true);
      recarregar();
    });
  };

  const verMissaoAtualizada = () => {
    setConfirmacaoRegistro(null);
    setContextoRegistro(null);
    setObjetivoConcluido(false);
    fecharObjetivo.setErro(null);
    setRegistroNoHoje(false);
    setTab("hoje");
    setRealceMissao(Date.now());
  };

  // o registro aberto do Hoje (missão sem questões): mesmo formulário, sem
  // trocar de aba
  const abrirRegistroNoHoje = (contexto) => {
    setContextoRegistro(contexto);
    setConfirmacaoRegistro(null);
    setObjetivoConcluido(false);
    fecharObjetivo.setErro(null);
    setRegistroNoHoje(true);
  };

  /* O botão de uma missão (cartão ou linha), pelo desenho de 18/10: com
     questões ligadas abre a sessão na hora (no Hoje ou no Plano, onde o
     toque aconteceu); sem, abre o registro já com a missão. "Revisar" só
     existe no Plano. */
  const agirNaMissao = (missao, acao) => {
    if (!missao || !acao) return;
    if (acao.tipo === "questoes") setResolvendo({ missao, tipo: "missao" });
    else if (acao.tipo === "revisar-questoes") setResolvendo({ missao, tipo: "revisao" });
    else if (acao.tipo === "registro") {
      const ctx = contextoRegistroDaMissao(missao, "missao");
      if (tab === "hoje") abrirRegistroNoHoje(ctx); else irAba("registrar", ctx);
    } else if (acao.tipo === "revisar-registro") irAba("registrar", contextoRegistroDaMissao(missao, "revisao"));
  };

  const registrarOutro = () => {
    setConfirmacaoRegistro(null);
    setContextoRegistro(null);
    setObjetivoConcluido(false);
    fecharObjetivo.setErro(null);
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  };

  useEffect(() => {
    if (!realceMissao || tab !== "hoje") return undefined;
    const quadro = requestAnimationFrame(() => {
      const reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      missaoRef.current?.scrollIntoView({ behavior: reduzido ? "auto" : "smooth", block: "start" });
      // rolar move a página, não o foco: sem isto o teclado volta ao <body>
      missaoRef.current?.focus?.({ preventScroll: true });
    });
    const timer = setTimeout(() => setRealceMissao(0), 1800);
    return () => { cancelAnimationFrame(quadro); clearTimeout(timer); };
  }, [realceMissao, tab]);

  useEffect(() => {
    if (!focoXp || tab !== "hoje") return undefined;
    const quadro = requestAnimationFrame(() => {
      document.querySelector(".player-rank")?.focus?.();
      setFocoXp(false);
    });
    return () => cancelAnimationFrame(quadro);
  }, [focoXp, tab]);

  // A sessão de questões abre acima da lista de missões: no celular, quem
  // toca "Iniciar missão" lá embaixo não a veria. Rola até ela e leva o foco.
  const chaveResolvendo = resolvendo ? `${resolvendo.missao.id}:${resolvendo.tipo}` : null;
  useEffect(() => {
    if (!chaveResolvendo) return undefined;
    const quadro = requestAnimationFrame(() => {
      const reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      resolvendoRef.current?.scrollIntoView({ behavior: reduzido ? "auto" : "smooth", block: "start" });
      resolvendoRef.current?.focus?.({ preventScroll: true });
    });
    return () => cancelAnimationFrame(quadro);
  }, [chaveResolvendo]);

  // índice de navegação da aba Desempenho (rola até a seção) — reduz a
  // sensação de "parede de blocos" sem esconder conteúdo (UX1.2).
  const refResumo = useRef(null), refMaterias = useRef(null), refHistorico = useRef(null);
  const rolarPara = (ref) => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  useEffect(() => {
    if (!aluno) return;
    let vivo = true;
    Promise.all([db.listarMetas(aluno.id), db.listarRegistros(aluno.id), db.listarSimulados(aluno.id), db.carregarXpPersistido(aluno.id)])
      .then(([metas, registros, simulados, xpPersistido]) => vivo && setDados({ carregando: false, metas, registros, simulados, xpPersistido, erro: null, versao }))
      .catch((e) => vivo && setDados((d) => ({ ...d, carregando: false, erro: mensagemAmigavel(e, "carregar"), versao })));
    return () => { vivo = false; };
  }, [aluno?.id, versao]);

  const meta = dados.metas.find((x) => x.status === "ativa") ?? dados.metas[0] ?? null;

  const semanasRegras = useMemo(
    () => (trilha ? trilha.semanas.map((s) => ({ ...s, inicio: String(s.inicio), fim: String(s.fim) })) : []),
    [trilha],
  );
  const semanaAtiva = semanasRegras.length ? semanaAtual(semanasRegras) : null;

  // A1: `semanaAtiva` gruda na última semana depois do fim da trilha —
  // é o clamp que tornava o fim do ciclo invisível. Ela continua sendo
  // a referência das MÉTRICAS (o resumo do ciclo encerrado precisa de
  // uma semana contra a qual calcular), mas quem decide o que a tela
  // DIZ é estadoDoCiclo, que sabe distinguir "última semana" de
  // "passou da última semana".
  const ciclo = useMemo(() => estadoDoCiclo(semanasRegras), [semanasRegras]);

  const m = useMemo(() => {
    if (!trilha || !semanaAtiva) return null;
    return calcularMetricas({
      registros: dados.registros, simulados: dados.simulados,
      semanas: semanasRegras, semanaAtiva, disciplinas: trilha.disciplinas,
      metaQuestoes: semanaAtiva.meta_questoes ?? 250,
    });
  }, [dados, trilha, semanaAtiva]);

  // Passo a passo guiado (shared/guia). Só com a trilha carregada: sem
  // ela esta tela não tem abas para mostrar. `pedidoGuia` sobe quando o
  // aluno toca em "Guia" no cabeçalho (que mora em AreaAluno).
  const guia = useGuia({
    roteiro: ROTEIRO_ALUNO,
    chave: chaveGuia("aluno", usuarioId ?? aluno?.id),
    irPara: (k) => irAba(k),
    podeIniciar: podeEditar && !!trilha && !carregandoTrilha && !dados.carregando,
  });
  const abrirGuia = guia.abrir;
  useEffect(() => { if (pedidoGuia > 0) abrirGuia(); }, [pedidoGuia]); // eslint-disable-line react-hooks/exhaustive-deps

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
      {/* sem trilha não há Plano: a linha do aviso de maturidade fica aqui
          (concurso beta/esqueleto recebe aluno sem calendário semanal) */}
      <LinhaMaturidade codigo={examTag} style={{ justifyContent: "center", marginTop: 14 }} />
    </div>
  );

  const itensMeta = (meta?.meta_atividades ?? []);
  const pendentes = itensMeta.filter((x) => x.estado === "pendente").length;
  // achado do Codex no #194: catálogo e progresso das missões não entram no
  // gate de carregamento da tela. Antes de chegarem, a fila está vazia e o
  // cartão ofereceria a tarefa ou "semana em dia" no lugar da missão; o
  // toque nesse meio-tempo registraria sem ligar à missão. Espera os dois.
  const missoesProntas = !examTag || (catalogoMissoes.examTag === examTag && gam.versao >= 0);
  // XP da FONTE DE VERDADE (ledger persistido, Fase C0 + PED1). Se o aluno
  // ainda não tem eventos (base nova/antes do backfill), cai na estimativa legada.
  const xp = dados.xpPersistido?.eventos?.length
    ? dados.xpPersistido.total
    : calcularXP({ metas: dados.metas, totalQuestoes: m?.totDone ?? 0, simulados: dados.simulados.length });

  // Raio-x fase 2, PR 3 (18/10): a Trilha sai (o Plano mostra as semanas) e
  // Conquistas sai do menu (abre pelo XP no topo do Hoje). No celular cabem
  // Hoje, Plano, Registrar e Desempenho; Simulados e Histórico vão ao "Mais".
  const ABAS = [
    ["hoje", "Hoje", null, "ancora"], ["plano", "Plano", null, "mapa"], ["registrar", "Registrar", null, "lapis"],
    ["desempenho", "Desempenho", null, "grafico"], ["simulados", "Simulados", null, "alvo"],
    ["historico", "Histórico", null, "arquivo"],
  ].filter(([k]) => podeEditar || k !== "registrar").map(
    // as tarefas pendentes moram no Plano (raio-x fase 2): o número vai com elas
    ([k, lb, badge, icone]) => (k === "plano" && podeEditar && pendentes > 0 ? [k, lb, pendentes, icone] : [k, lb, badge, icone]),
  );

  // a sessão de questões abre onde o toque aconteceu (Hoje ou Plano)
  const sessaoDeQuestoes = podeEditar && resolvendo ? (
    <div ref={resolvendoRef} tabIndex={-1} aria-label="Questões da missão" style={{ scrollMarginTop: 18 }}>
      <ResolverQuestoes key={`${resolvendo.missao.id}:${resolvendo.tipo}`}
        missao={resolvendo.missao} tipo={resolvendo.tipo}
        aoFechar={() => setResolvendo(null)}
        aoMudar={recarregar}
        aoRegistrarManual={(tipoEfetivo = resolvendo.tipo) => {
          // depois que a missão fecha na sessão, o registro de reserva é
          // revisão, não prática da missão
          const ctx = contextoRegistroDaMissao(resolvendo.missao, tipoEfetivo);
          setResolvendo(null);
          if (tab === "hoje") abrirRegistroNoHoje(ctx); else irAba("registrar", ctx);
        }} />
    </div>
  ) : null;

  // no Hoje, só o formulário (sem o resumo do dia e os recentes)
  const formularioRegistro = (compacto = false) => (
    <Registrar compacto={compacto} aluno={aluno} trilha={trilha} registros={dados.registros}
      aoMudar={recarregar} minutosSugeridos={minutosSugeridos}
      contextoInicial={contextoRegistro} confirmacao={confirmacaoRegistro}
      aoConfirmar={registroConfirmado} aoVerMissao={verMissaoAtualizada}
      aoRegistrarOutro={registrarOutro} aoSairContexto={() => setContextoRegistro(null)}
      aoConcluirObjetivo={concluirObjetivoDaJornada} objetivoConcluido={objetivoConcluido}
      concluindoObjetivo={fecharObjetivo.ocupado} erroObjetivo={fecharObjetivo.erro} />
  );

  return (
    <div>
      {feedback && <FeedbackProgresso feedback={feedback} aoFechar={() => setFeedback(null)} />}
      {/* cronômetro: só onde o estudo acontece (Hoje, Registrar e a sessão
          de questões, que o liga sozinha e o zera ao fechar: o lote já grava
          os minutos no servidor) */}
      {podeEditar && (tab === "hoje" || tab === "registrar" || resolvendo) && (
        <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}>
          <Cronometro sessao={!!resolvendo} aoFinalizar={(min) => { setMinutosSugeridos(min); irAba("registrar"); }} />
        </div>
      )}

      {guia.elemento}
      <MenuPrincipal abas={ABAS} ativo={tab} aoTrocar={irAba}
        rotuloExtra={tab === "conquistas" ? "Conquistas" : undefined}
        usuario={{ nome: aluno.nome, sub: `${patente(xp).nome} · ${xp.toLocaleString("pt-BR")} XP` }} />

      <Suspense fallback={<CarregandoBloco titulo="Carregando o painel…" cartoes={2} linhas={3} />}>
      {/* T25: alvo do skip-link renderizado por <MenuPrincipal> acima. */}
      <div id="conteudo-principal" tabIndex={-1} className="fade" key={tab}>
        {tab === "hoje" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 4 }}>
            {/* Desenho aprovado em 18/10: o cartão da missão de agora e as
                missões da semana abertas, sem clique. A sessão de questões e o
                registro abrem aqui mesmo, no lugar deles. Radar, textos longos
                e tarefas ficam fora do Hoje (as tarefas moram no Plano). */}
            {ciclo.estado === "encerrado" ? (
              <CicloEncerrado trilha={trilha} m={m} metas={dados.metas} aoAvancar={podeEditar ? irAba : undefined} />
            ) : resolvendo ? sessaoDeQuestoes : registroNoHoje && podeEditar ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button type="button" onClick={() => { setRegistroNoHoje(false); setContextoRegistro(null); }}
                  style={{ alignSelf: "flex-start", background: "none", border: "none", color: T.sub, fontSize: 13, fontWeight: 600, padding: "6px 0", minHeight: 36, cursor: "pointer" }}>
                  ← Voltar às missões
                </button>
                {formularioRegistro(true)}
              </div>
            ) : (
              <>
                <div ref={missaoRef} tabIndex={-1} aria-label="Missão de agora, destaque"
                  className={realceMissao ? "mission-impact" : undefined} style={{ scrollMarginTop: 18 }}>
                  <MissaoDeAgora missao={missoesSemana.missaoDeAgora} nomesMateria={nomesMateria}
                    questoesIntegradas={questoesIntegradas} carregando={!missoesProntas}
                    semMissoes={missoesProntas && !missoesSemana.comMeta}
                    erroAoCarregar={missoesProntas && !!catalogoMissoes.erro}
                    aoTentarDeNovo={() => { setCatalogoMissoes((c) => ({ ...c, examTag: null, erro: false })); setTentativaCatalogo((n) => n + 1); }}
                    aoAgir={podeEditar ? agirNaMissao : undefined}
                    aoRegistrarLivre={podeEditar ? () => abrirRegistroNoHoje(null) : undefined} />
                </div>
                {missoesProntas && (
                  <MissoesDoHoje montagem={missoesSemana} totalSemanas={trilha.semanas.length}
                    nomesMateria={nomesMateria} questoesIntegradas={questoesIntegradas}
                    aoAgir={podeEditar ? agirNaMissao : undefined} />
                )}
              </>
            )}
            {/* patente e XP: abre as Conquistas, que saíram do menu */}
            <FaixaAspirante nome={aluno.nome.split(" ")[0]} contexto={contexto} xp={xp} streak={m?.streak ?? 0}
              aoAbrirConquistas={() => irAba("conquistas")} />
          </div>
        )}
        {tab === "registrar" && podeEditar && formularioRegistro()}
        {tab === "desempenho" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <nav aria-label="Seções do desempenho" className="navwrap" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
              {[["Resumo", refResumo], ["Por matéria", refMaterias], ["Histórico", refHistorico]].map(([rot, r]) => (
                <button type="button" key={rot} onClick={() => rolarPara(r)}
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
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* fora do menu: sem aba acesa, a volta fica explícita */}
            <button type="button" onClick={() => { irAba("hoje"); setFocoXp(true); }}
              style={{ alignSelf: "flex-start", background: "none", border: "none", color: T.sub, fontSize: 13, fontWeight: 600, padding: "6px 0", minHeight: 36, cursor: "pointer" }}>
              ← Voltar ao Hoje
            </button>
            <Conquistas nome={aluno.nome.split(" ")[0]} xp={xp} m={m} metas={dados.metas} simulados={dados.simulados} />
          </div>
        )}
        {tab === "historico" && (
          <Arquivo metas={dados.metas} trilha={trilha} registros={dados.registros} />
        )}
        {tab === "plano" && (
          <Plano trilha={trilha} semanaAtiva={semanaAtiva} meta={meta} metas={dados.metas} codigoConcurso={examTag}
            podeEditar={podeEditar} aoMudar={recarregar} aoPraticar={(alvo) => irAba("registrar", alvo)}
            missoesSemana={missoesProntas ? missoesSemana : null} nomesMateria={nomesMateria}
            questoesIntegradas={questoesIntegradas} aoAgir={podeEditar ? agirNaMissao : undefined}>
            {resolvendo && sessaoDeQuestoes}
          </Plano>
        )}
      </div>
      </Suspense>
    </div>
  );
}

/* O Plano (desenho aprovado em 18/10). Para o aluno, ele substitui a aba
   Trilha: todas as semanas em blocos, com as mesmas linhas de missão do
   Hoje (semana pela trilha_plano_missoes.semana_sugerida) e, abaixo delas,
   as tarefas da semana, com as concluídas recolhidas em "X concluídas".
   Abertas: a semana das missões (ritmo do aluno) e a do calendário.
   Concluir/Adiar só na tarefa da meta ativa; "Revisar" só aqui.
   A sessão de questões aberta daqui aparece no topo (`children`).
   A coordenação continua com a visão própria (ficha). */
function Plano({ trilha, semanaAtiva, meta, metas = [], codigoConcurso = null, podeEditar = false, aoMudar, aoPraticar,
  missoesSemana = null, nomesMateria, questoesIntegradas, aoAgir, children }) {
  const T = useTema();
  // a semana atual vem do calendário (a virada pode atrasar e a meta ativa
  // ainda ser a da semana anterior); a meta só preenche o estado das tarefas
  const ativaNum = semanaAtiva?.numero ?? meta?.semana_numero ?? trilha.semanas[0]?.numero;
  const total = trilha.semanas.length;
  const posicao = Math.max(1, trilha.semanas.findIndex((w) => w.numero === ativaNum) + 1);
  const pctPlano = total > 1 ? Math.round(((posicao - 1) / (total - 1)) * 100) : 0;
  // a meta de cada semana (a atual e as já fechadas): o estado das tarefas
  // só as metas desta trilha: depois de um ciclo novo, o histórico das
  // edições anteriores tem os mesmos números de semana
  const trilhaId = trilha.trilha?.id ?? null;
  const metaPorSemana = Object.fromEntries((metas ?? [])
    .filter((x) => !trilhaId || !x.trilha_id || x.trilha_id === trilhaId)
    .map((x) => [x.semana_numero, x]));
  if (meta) metaPorSemana[meta.semana_numero] = meta;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: `linear-gradient(135deg, ${T.cardHi}, ${T.card})`, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, color: T.sub, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>Seu plano</div>
          <div className="num" style={{ fontSize: 11.5, color: T.sub }}>semana <b className="disp" style={{ color: T.gold, fontSize: 15 }}>{posicao}</b> de {total}</div>
        </div>
        <div style={{ marginTop: 9 }}><BarraXP pct={pctPlano} alt={7} /></div>
        {/* pré-edital: depois do "Entendi", a informação fica só aqui */}
        <LinhaMaturidade codigo={codigoConcurso} style={{ marginTop: 10 }} />
      </div>

      {children}

      <div style={{ position: "relative" }}>
        {/* trilho vertical que liga as semanas */}
        <div style={{ position: "absolute", left: 13, top: 14, bottom: 14, width: 2, background: T.line }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {trilha.semanas.map((w) => (
            <BlocoSemana key={w.numero} w={w} trilha={trilha} ativaNum={ativaNum}
              meta={metaPorSemana[w.numero] ?? null}
              podeEditar={podeEditar && w.numero === meta?.semana_numero && meta?.status === "ativa"}
              aoMudar={aoMudar} aoPraticar={aoPraticar} T={T}
              missoes={missoesSemana?.porSemana.get(w.numero) ?? []}
              abertaPeloRitmo={w.numero === missoesSemana?.semanaAtual}
              deAgoraId={missoesSemana?.missaoDeAgora?.id ?? null}
              nomesMateria={nomesMateria} questoesIntegradas={questoesIntegradas} aoAgir={aoAgir} />
          ))}
        </div>
      </div>

      {missoesSemana?.semSemana.length > 0 && (
        <section aria-label="Missões sem semana no plano" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Outras missões do concurso</div>
          <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>Sem semana definida no plano desta trilha.</div>
          <ListaMissoes linhas={missoesSemana.semSemana} nomesMateria={nomesMateria}
            questoesIntegradas={questoesIntegradas} aoAgir={aoAgir} modo="plano" />
        </section>
      )}
    </div>
  );
}

// Uma semana do Plano: nó na linha do tempo + bloco que abre e fecha.
function BlocoSemana({ w, trilha, ativaNum, meta, podeEditar, aoMudar, aoPraticar, T,
  missoes = [], abertaPeloRitmo = false, deAgoraId = null, nomesMateria, questoesIntegradas, aoAgir }) {
  const isNow = w.numero === ativaNum;
  const isPast = w.numero < ativaNum;
  const [aberto, setAberto] = useState(isNow || abertaPeloRitmo);
  // a semana das missões avança com o aluno no Plano: a nova abre sozinha
  useEffect(() => { if (abertaPeloRitmo) setAberto(true); }, [abertaPeloRitmo]);
  const previstas = trilha.atividadesPorSemana[w.numero] ?? [];
  const itens = meta?.meta_atividades ?? [];
  const consideradas = itens.filter((x) => x.estado !== "ignorada").length;
  const feitas = itens.filter((x) => x.estado === "concluida").length;
  const tom = isNow ? "alerta" : isPast ? "ok" : "neutro";
  const rotulo = isPast ? "Encerrada" : isNow ? "Em andamento" : "Próxima";
  // semana que já passou sem meta: o aluno entrou depois (o motor gera só a
  // semana corrente). Não houve tarefa atribuída; o previsto não é mostrado
  // como se tivesse sido.
  const semRegistro = isPast && !meta;
  const contagemTarefas = meta
    ? `${feitas} de ${consideradas} ${consideradas === 1 ? "tarefa" : "tarefas"}`
    : semRegistro ? "sem tarefas atribuídas"
    : `${previstas.length} ${previstas.length === 1 ? "tarefa prevista" : "tarefas previstas"}`;
  const contagem = missoes.length ? `${resumoMissoesDaSemana(missoes).texto} · ${contagemTarefas}` : contagemTarefas;
  const idCorpo = `semana-${w.numero}-tarefas`;

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

      <section aria-label={`Semana ${w.numero}`} style={{ flex: 1, minWidth: 0, background: T.card, border: `1px solid ${isNow ? T.gold : T.line}`, borderWidth: isNow ? 1.5 : 1, borderRadius: 12, overflow: "hidden" }}>
        <button type="button" aria-expanded={aberto} aria-controls={idCorpo} onClick={() => setAberto((v) => !v)}
          style={{ display: "block", width: "100%", minHeight: 44, textAlign: "left", background: "transparent", border: "none", color: T.ink, padding: "12px 14px", cursor: "pointer" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="disp" style={{ fontSize: 14.5, fontWeight: 700 }}>Semana {w.numero}</span>
            <StatusBadge tom={tom}>{rotulo}</StatusBadge>
            <span className="num" style={{ marginLeft: "auto", fontSize: 11, color: T.sub }}>{fmtBR(String(w.inicio))}–{fmtBR(String(w.fim))}</span>
          </span>
          {w.foco && <span style={{ display: "block", fontStyle: "italic", color: T.sub, fontSize: 13, marginTop: 6, lineHeight: 1.4 }}>{w.foco}</span>}
          {w.simulado && <span style={{ display: "block", fontSize: 12, color: T.red, fontWeight: 700, marginTop: 6 }}>⚑ {w.simulado}</span>}
          <span className="num" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.sub, marginTop: 8 }}>
            <span aria-hidden="true">{aberto ? "▾" : "▸"}</span><span>{contagem}</span>
          </span>
        </button>

        {aberto && (
          <div id={idCorpo} style={{ borderTop: `1px solid ${T.line}` }}>
            {missoes.length > 0 && (
              <div style={{ padding: "4px 14px 8px" }}>
                <ListaMissoes linhas={missoes} deAgoraId={deAgoraId} nomesMateria={nomesMateria}
                  questoesIntegradas={questoesIntegradas} aoAgir={aoAgir} modo="plano" />
              </div>
            )}
            <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: 0.5, padding: "10px 14px 0" }}>Tarefas da semana</div>
            {semRegistro ? (
              <div style={{ fontSize: 12.5, color: T.sub, padding: "10px 14px", lineHeight: 1.5 }}>
                Você começou depois desta semana: nenhuma tarefa dela foi atribuída a você.
              </div>
            ) : (
              <TarefasDaSemana meta={meta} atividades={previstas} trilha={trilha}
                podeEditar={podeEditar} aoMudar={aoMudar} aoPraticar={podeEditar ? aoPraticar : undefined} />
            )}
          </div>
        )}
      </section>
    </div>
  );
}
