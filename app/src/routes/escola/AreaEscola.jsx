/* Área da coordenação — painel de gestão, não só cadastro (ref. spec):
   Painel / Alunos / Ranking / Turmas / LGPD / Marca. */
import React, { useEffect, useMemo, useReducer, useState } from "react";
import { Cabecalho } from "../../shared/ui/Cabecalho.jsx";
import { SectionCard, Erro, ErroComRetry, EmptyState, CarregandoBloco, StatusBadge, useDialogo } from "../../shared/ui/componentes.jsx";
import { nomeValido, limparNome } from "../../shared/validacao.js";
import { MenuPrincipal } from "../../shared/ui/MenuPrincipal.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { NovaTurma, PainelCadastroAlunos, CredencialGerada } from "../../modules/pessoas/CadastroAlunos.jsx";
import { useGuia } from "../../shared/guia/GuiaPassoAPasso.jsx";
import { ROTEIRO_COORDENACAO, chaveGuia } from "../../shared/guia/roteiros.js";
import { ListaAlunos } from "../../modules/pessoas/ListaAlunos.jsx";
import { Marca } from "../../modules/escola/Marca.jsx";
import { ProximoCiclo } from "../../modules/escola/ProximoCiclo.jsx";
import { PainelConformidade } from "../../modules/consentimento/PainelConformidade.jsx";
import { ClassificacaoTurma } from "../../modules/desempenho/ClassificacaoTurma.jsx";
import { Relatorios } from "../../modules/desempenho/Relatorios.jsx";
import { PainelGestao } from "../../modules/desempenho/PainelGestao.jsx";
import { FichaAluno } from "../../modules/desempenho/FichaAluno.jsx";
import { useRecurso } from "../../shared/hooks/useRecurso.js";
import { adaptarResumoEscola } from "../../shared/metricas/agregados.js";
import { mensagemAmigavel } from "../../shared/lib/erros.js";
import { navReducer, NAV_INICIAL } from "./navegacaoEscola.js";
import * as db from "../../shared/data/index.js";

const VAZIO_NUCLEO = { turmas: [], alunos: [], concursos: [], resumo: [], trilhas: [], consentimentos: [] };
const VAZIO_EXTRA = { logs: [], simuladosEscola: [], logsTotal: 0 };

export default function AreaEscola({ perfil }) {
  const T = useTema();
  // Navegação coordenada (aba + filtro + ficha) num reducer só — ver
  // navegacaoEscola.js. Cada transição deixa o estado coerente.
  const [nav, despacharNav] = useReducer(navReducer, NAV_INICIAL);
  const { tab, filtroStatus: filtroAlunosStatus, alunoAberto } = nav;
  // PERF: antes eram 8 leituras num Promise.all só, e as SEIS abas ficavam
  // atrás dele. A aba Painel — a que abre por padrão — precisa de duas.
  // Agora a carga é em duas ondas:
  //
  //   NÚCLEO  o que o Painel, a navegação e a lista de alunos precisam.
  //           É esta onda que o `carregando` segura.
  //   EXTRA   o que pertence a UMA aba só: os 100 logs de acesso (LGPD) e
  //           os simulados da escola (Ranking). Carrega em paralelo e não
  //           atrasa a tela; as duas abas mostram o próprio "carregando".
  //
  // `consentimentos` fica no NÚCLEO de propósito, mesmo sendo lido só pela
  // aba LGPD e pela lista: ele alimenta o filtro "sem consentimento", que o
  // Painel alcança direto por `aoIrFiltrado`. Na onda extra, a lista
  // apareceria com todo mundo marcado como sem consentimento até o dado
  // chegar — seria trocar latência por resposta errada.
  //
  // Cancelamento (tarefa 81) preservado nas duas: o signal do useRecurso é
  // repassado a cada leitura, então sair da tela aborta as viagens em curso.
  const { dados: carregado, carregando, erro, recarregar } = useRecurso(
    (signal) => Promise.all([
      db.listarTurmas({ signal }), db.listarAlunos({ signal }), db.listarConcursos({ signal }),
      db.resumoEscola({ signal }), db.listarTrilhas({ signal }), db.listarConsentimentos({ signal }),
    ]).then(([turmas, alunos, concursos, resumo, trilhas, consentimentos]) =>
      ({ turmas, alunos, concursos, resumo, trilhas, consentimentos })),
    [],
  );
  const { dados: carregadoExtra, carregando: carregandoExtra, recarregar: recarregarExtra } = useRecurso(
    (signal) => Promise.all([
      db.listarLogsAcesso(100, { signal }), db.listarSimuladosEscola({ signal }), db.contarLogsAcesso({ signal }),
    ]).then(([logs, simuladosEscola, logsTotal]) => ({ logs, simuladosEscola, logsTotal })),
    [],
  );
  const dados = { ...VAZIO_NUCLEO, ...VAZIO_EXTRA, ...(carregado ?? {}), ...(carregadoExtra ?? {}) };
  // Carga do núcleo falhou e não há dado anterior: as abas que dependem
  // dele NÃO desenham. Antes elas caíam no VAZIO_NUCLEO e diziam "Nenhum
  // aluno cadastrado ainda" / "0 de 0" embaixo do aviso de erro, como se a
  // escola estivesse vazia (produção, 25/09/2026, com o HTTP 300). Numa
  // recarga que falha, o dado anterior continua na tela com o aviso.
  const semNucleo = !!erro && !carregado;
  const mostrarAbas = !carregando && !semNucleo;
  // Toda mutação da tela pode mexer nas duas ondas (cadastrar aluno mexe no
  // núcleo; registrar consentimento mexe no extra), então o retry recarrega
  // as duas — o custo é o mesmo de antes e evita tela desatualizada.
  const recarregarTudo = () => { recarregar(); recarregarExtra(); };
  const [credencial, setCredencial] = useState(null);

  // Em bloco, sem devolver nada: usado como efeito, o que ele devolvesse
  // viraria a "limpeza", e nos Chromium novos scrollTo devolve Promise
  // (ver AreaAluno.jsx; achado do E2E local).
  const aoTopo = () => { window.scrollTo({ top: 0, left: 0, behavior: "instant" }); };
  useEffect(() => { aoTopo(); }, []); // entrar no sistema = nascer no topo

  function irPara(t) { despacharNav({ tipo: "ir", tab: t }); aoTopo(); }

  // Passo a passo guiado (shared/guia): convida na primeira vez desta
  // conta neste navegador, depois que a escola carregou; o botão "Guia"
  // do cabeçalho reabre a qualquer hora.
  const guia = useGuia({
    roteiro: ROTEIRO_COORDENACAO,
    chave: chaveGuia("coordenacao", perfil.usuario.id),
    irPara,
    podeIniciar: mostrarAbas,
  });
  function irParaFiltrado(tab, filtro) { despacharNav({ tipo: "irFiltrado", tab, filtro }); aoTopo(); }

  function verAluno(aluno) {
    despacharNav({ tipo: "abrirAluno", aluno });
    aoTopo();
    db.registrarAcesso(perfil.escola.id, aluno.id, perfil.usuario.id, "coordenacao", "leitura-desempenho");
  }

  const alunosPorId = useMemo(() => Object.fromEntries(dados.alunos.map((a) => [a.id, a])), [dados.alunos]);
  const concursosPorId = useMemo(() => Object.fromEntries(dados.concursos.map((c) => [c.id, c])), [dados.concursos]);
  // T31: semanas de cada trilha (já embutidas por listarTrilhas), por id —
  // adaptarResumoEscola usa para não contar aluno de ciclo encerrado como
  // "sem atividade" (ele não tem mais missão nenhuma).
  const trilhasPorId = useMemo(
    () => Object.fromEntries(dados.trilhas.map((t) => [t.id, t])),
    [dados.trilhas],
  );
  const semanasPorTrilha = useMemo(
    () => Object.fromEntries(dados.trilhas.map((t) => [t.id, t.trilha_semanas ?? []])),
    [dados.trilhas],
  );
  // Agregado por aluno: vem PRONTO do banco (RPC resumo_escola) e é
  // calculado uma única vez aqui — Painel, Ranking e Turmas reusam.
  const resumoLista = useMemo(
    () => adaptarResumoEscola(dados.resumo, alunosPorId, semanasPorTrilha),
    [dados.resumo, alunosPorId, semanasPorTrilha],
  );
  const resumoPorAluno = useMemo(() => Object.fromEntries(resumoLista.map((x) => [x.aluno.id, x])), [resumoLista]);

  // quantos alunos estão parados no fim do plano. Vira selo na aba
  // "Ciclo": sem ele, a única forma de descobrir que uma turma inteira
  // terminou seria abrir a aba por acaso — e a tela do responsável já
  // prometeu ao pai que a coordenação abriria o próximo ciclo.
  const encerrados = useMemo(
    () => resumoLista.filter((x) => x.cicloEncerrado).length,
    [resumoLista],
  );

  const ABAS = [
    ["painel", "Painel", null, "painel"], ["alunos", "Alunos", null, "alunos"],
    ["ranking", "Ranking", null, "trofeu"], ["turmas", "Turmas", null, "turmas"],
    ["ciclo", "Ciclo", encerrados || null, "relogio"],
    ["conformidade", "LGPD", null, "escudo"], ["marca", "Marca", null, "pincel"],
  ];

  // T39/T40: a ficha agora tem ações que mudam trilha/concurso/turma do
  // próprio aluno aberto — sem reler de alunosPorId, a ficha continuaria
  // mostrando os valores de ANTES da troca (o snapshot que abrirAluno
  // guardou) até fechar e abrir de novo. alunosPorId já é o dado fresco
  // pós-recarregarTudo(); cai no snapshot só enquanto ele ainda não chegou.
  const alunoAbertoFresco = alunoAberto ? (alunosPorId[alunoAberto.id] ?? alunoAberto) : null;
  const concursoDoAluno = alunoAbertoFresco ? concursosPorId[alunoAbertoFresco.concurso_id] : null;

  return (
    <div>
      <Cabecalho subtitulo="Painel de gestão" nomeUsuario={perfil.usuario.nome} rotuloPapel="Coordenação" aoAbrirGuia={guia.abrir} />
      <main className="com-sidebar" style={{ maxWidth: 1080, margin: "0 auto", padding: "16px max(16px, env(safe-area-inset-right)) calc(88px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))" }}>
        {/* C2: alunoAberto é um terceiro estado de tela que não está em
            nenhuma aba — sem rotuloExtra o título da aba do navegador
            continuaria preso na última aba visitada enquanto a tela
            mostra a ficha de um aluno específico. */}
        <MenuPrincipal abas={ABAS} ativo={tab} aoTrocar={irPara}
          usuario={{ nome: perfil.usuario.nome, sub: "Coordenação" }}
          rotuloExtra={alunoAberto ? `Ficha de ${alunoAberto.nome}` : undefined} />

        {/* T25: alvo do skip-link renderizado por <MenuPrincipal> acima. */}
        <div id="conteudo-principal" tabIndex={-1} className="fade" key={tab + (alunoAberto?.id ?? "")}>
          {erro && <ErroComRetry aoTentar={recarregarTudo}>{erro}</ErroComRetry>}
          {carregando && <CarregandoBloco titulo="Carregando dados da escola…" cartoes={4} linhas={4} />}

          {mostrarAbas && alunoAberto && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <button type="button" onClick={() => { despacharNav({ tipo: "fecharAluno" }); aoTopo(); }} style={{ alignSelf: "flex-start", border: `1px solid ${T.line}`, background: T.card, color: T.sub, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>← voltar ao painel</button>
              <FichaAluno aluno={alunoAbertoFresco} concurso={concursoDoAluno}
                turmas={dados.turmas} concursos={dados.concursos} trilhas={dados.trilhas}
                aoMudar={recarregarTudo} aoGerarCredencial={setCredencial} />
            </div>
          )}

          {mostrarAbas && !alunoAberto && tab === "painel" && (
            <PainelGestao resumo={resumoLista} aoIr={irPara} aoIrFiltrado={irParaFiltrado} />
          )}

          {mostrarAbas && !alunoAberto && tab === "alunos" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <PainelCadastroAlunos turmas={dados.turmas} trilhas={dados.trilhas} concursos={dados.concursos} aoMudar={recarregarTudo}
                indisponivel={!!erro} />
              <ListaAlunos alunos={dados.alunos} consentimentos={dados.consentimentos} concursos={dados.concursos}
                turmas={dados.turmas} trilhas={dados.trilhas} resumoPorAluno={resumoPorAluno}
                aoMudar={recarregarTudo} aoGerarCredencial={setCredencial} aoVerAluno={verAluno}
                filtroStatusInicial={filtroAlunosStatus} />
            </div>
          )}

          {/* Ranking depende dos simulados, que vêm na onda extra: enquanto
              não chegam, a aba diz que está carregando em vez de desenhar
              uma classificação sem simulado nenhum. */}
          {mostrarAbas && !alunoAberto && tab === "ranking" && carregandoExtra && (
            <CarregandoBloco titulo="Carregando a classificação…" cartoes={2} linhas={4} />
          )}

          {mostrarAbas && !alunoAberto && tab === "ranking" && !carregandoExtra && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <ClassificacaoTurma alunos={dados.alunos} turmas={dados.turmas}
                resumoPorAluno={resumoPorAluno}
                simulados={dados.simuladosEscola} concursosPorId={concursosPorId} />
              <Relatorios alunos={dados.alunos} turmas={dados.turmas}
                concursosPorId={concursosPorId} resumoPorAluno={resumoPorAluno}
                escolaNome={perfil.escola.nome} />
            </div>
          )}

          {mostrarAbas && !alunoAberto && tab === "turmas" && (
            <Turmas turmas={dados.turmas} alunos={dados.alunos} porAluno={resumoPorAluno}
              aoMudar={recarregarTudo} aoVerRanking={() => irPara("ranking")}
              aoVerAluno={verAluno} />
          )}

          {/* A porta do próximo ciclo (0051). Fica em aba própria porque
              é ação de coordenação com consequência estrutural — mover
              aluno de edição — e não um indicador do painel. */}
          {mostrarAbas && !alunoAberto && tab === "ciclo" && (
            <ProximoCiclo resumo={resumoLista} trilhasPorId={trilhasPorId}
              concursosPorId={concursosPorId} aoMudar={recarregarTudo} />
          )}

          {/* LGPD depende dos logs de acesso, que vêm na onda extra. */}
          {mostrarAbas && !alunoAberto && tab === "conformidade" && carregandoExtra && (
            <CarregandoBloco titulo="Carregando a trilha de acesso…" cartoes={2} linhas={5} />
          )}

          {mostrarAbas && !alunoAberto && tab === "conformidade" && !carregandoExtra && (
            <PainelConformidade consentimentos={dados.consentimentos} logs={dados.logs} logsTotal={dados.logsTotal} alunosPorId={alunosPorId} />
          )}

          {!carregando && !alunoAberto && tab === "marca" && (
            <Marca escola={perfil.escola} aoMudar={recarregarTudo} />
          )}
        </div>
      </main>

      <CredencialGerada credencial={credencial} aoFechar={() => setCredencial(null)} />
      {guia.elemento}
    </div>
  );
}

// T31 (Bloco 3): a turma só acende "em risco" quando a PROPORÇÃO de
// alunos sem atividade (entre os que ainda estão em ciclo ativo —
// ver adaptarResumoEscola) passa deste limiar. Qualquer contagem > 0
// disparava o badge mesmo numa turma de 40 alunos com 1 só inativo.
const PROPORCAO_TURMA_EM_RISCO = 0.3;

/* Turmas com indicadores: alunos, acerto, questões e alunos em risco.
   Clicar na turma abre a lista de alunos dela; clicar no aluno abre o
   desempenho individual (Fase 10 do doc). */
function Turmas({ turmas, alunos, porAluno, aoMudar, aoVerRanking, aoVerAluno }) {
  const T = useTema();
  const [turmaAberta, setTurmaAberta] = useState(null);
  const dialogo = useDialogo();

  // Fase B-min, B.6: antes recalculava alunos+stats de TODAS as turmas
  // a cada render (inclusive ao só abrir/fechar uma turma) — O(turmas
  // × alunos) repetido sem necessidade. Agora é uma passada só por turma.
  const porTurma = useMemo(() => {
    const mapa = new Map(turmas.map((t) => [t.id, { alunos: [], n: 0, questoes: 0, acerto: null, risco: 0, emRisco: false }]));
    for (const a of alunos) {
      for (const v of a.alunos_turmas ?? []) {
        const entrada = mapa.get(v.turma_id);
        if (entrada) entrada.alunos.push(a);
      }
    }
    for (const entrada of mapa.values()) {
      const linhas = entrada.alunos.map((a) => porAluno[a.id]).filter(Boolean);
      const comAcc = linhas.filter((x) => x.acc != null);
      // T31: numerador (risco) e denominador (emCicloAtivo) excluem ciclo
      // encerrado do MESMO jeito — senão uma turma toda formada, ou com
      // parte dela formada, dilui a proporção dos que ainda estudam.
      const emCicloAtivo = linhas.filter((x) => !x.cicloEncerrado);
      entrada.n = entrada.alunos.length;
      entrada.questoes = linhas.reduce((s, x) => s + x.q, 0);
      entrada.acerto = comAcc.length ? Math.round(comAcc.reduce((s, x) => s + x.acc, 0) / comAcc.length) : null;
      entrada.risco = linhas.filter((x) => x.semAtividade).length;
      entrada.emRisco = emCicloAtivo.length > 0 && entrada.risco / emCicloAtivo.length > PROPORCAO_TURMA_EM_RISCO;
    }
    return mapa;
  }, [turmas, alunos, porAluno]);
  const vazia = { alunos: [], n: 0, questoes: 0, acerto: null, risco: 0, emRisco: false };
  const alunosDaTurma = (turmaId) => (porTurma.get(turmaId) ?? vazia).alunos;
  const statsTurma = (turmaId) => porTurma.get(turmaId) ?? vazia;

  const [erroAcao, setErroAcao] = useState(null);

  // a escola gerencia as próprias turmas: renomear e excluir (Fase 10).
  // Diálogos do design system (UX1.2) no lugar de prompt/confirm/alert nativos.
  async function renomear(t) {
    const nome = await dialogo.prompt({
      titulo: "Renomear turma",
      mensagem: `Escolha um novo nome para a turma "${t.nome}".`,
      rotulo: "Nome da turma",
      valorInicial: t.nome,
      placeholder: "ex: Turma CN 2026 — manhã",
      rotuloConfirmar: "Salvar nome",
      validar: (v) => (nomeValido(v) ? null : "Use de 2 a 80 caracteres."),
    });
    if (!nome || limparNome(nome) === t.nome) return;
    setErroAcao(null);
    try { await db.renomearTurma(t.id, limparNome(nome)); aoMudar?.(); }
    catch (e) { setErroAcao(mensagemAmigavel(e, "salvar")); }
  }
  async function excluir(t, n) {
    if (n > 0) {
      await dialogo.confirmar({
        titulo: "Não é possível excluir agora",
        mensagem: `A turma "${t.nome}" tem ${n} aluno(s). Mova os alunos para outra turma antes de excluí-la.`,
        rotuloConfirmar: "Entendi",
        // T46: aviso puramente informativo (o código faz return logo
        // abaixo, incondicional) — não uma decisão binária. Botão único.
        rotuloCancelar: null,
      });
      return;
    }
    const ok = await dialogo.confirmar({
      titulo: "Excluir turma",
      mensagem: `Excluir a turma "${t.nome}"? Esta ação não pode ser desfeita.`,
      rotuloConfirmar: "Excluir turma",
      rotuloCancelar: "Cancelar",
      perigo: true,
    });
    if (!ok) return;
    setErroAcao(null);
    try { await db.removerTurma(t.id); aoMudar?.(); }
    catch (e) { setErroAcao(mensagemAmigavel(e, "acao")); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {dialogo.elemento}
      <NovaTurma aoMudar={aoMudar} />
      {erroAcao && <Erro>{erroAcao}</Erro>}
      <SectionCard titulo="Turmas" sub="Visão rápida do desempenho de cada turma" semPadding>
        {turmas.length === 0 ? (
          <div style={{ padding: 8 }}><EmptyState icone="🎓" titulo="Nenhuma turma ainda" dica="Crie a primeira turma acima e cadastre alunos na aba Alunos." /></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {turmas.map((t, i) => {
              const s = statsTurma(t.id);
              const aberta = turmaAberta === t.id;
              return (
                <div key={t.id} style={{ padding: "13px 15px", borderBottom: i === turmas.length - 1 ? "none" : `1px solid ${T.line}`, background: aberta ? `${T.gold}06` : "transparent" }}>
                  {/* T1: o padding vivia só no <div> pai (não-clicável);
                      o botão em si tinha padding:0. */}
                  <button type="button" onClick={() => setTurmaAberta(aberta ? null : t.id)}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", width: "100%", border: "none", background: "transparent", textAlign: "left", padding: "8px 0", minHeight: 44, color: T.ink }}>
                    <div className="disp" style={{ fontSize: 15, fontWeight: 700 }}>
                      {t.nome} <span style={{ fontSize: 11, color: T.gold, fontWeight: 700, marginLeft: 6 }}>{aberta ? "fechar alunos ▴" : "ver alunos ▾"}</span>
                    </div>
                    {s.emRisco && <span style={{ fontSize: 11, fontWeight: 700, color: T.red, background: `${T.red}14`, border: `1px solid ${T.red}44`, borderRadius: 6, padding: "2px 8px" }}>{s.risco} em risco</span>}
                  </button>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 8, marginTop: 10 }}>
                    <Mini rotulo="Alunos" valor={s.n} />
                    {/* média SIMPLES do acerto do ciclo de cada aluno (statsTurma): o
                        rótulo diz a janela e o tipo de média, como o D15 (24/09) */}
                    <Mini rotulo="Acerto médio no ciclo" valor={s.acerto == null ? "—" : `${s.acerto}%`} cor={s.acerto == null ? null : s.acerto >= 70 ? T.green : T.gold} />
                    <Mini rotulo="Questões" valor={s.questoes} />
                    <Mini rotulo="Sem atividade" valor={s.risco} cor={s.risco ? T.red : T.green} />
                  </div>
                  {/* lista de alunos da turma (cards básicos → desempenho) */}
                  {aberta && (
                    <div style={{ marginTop: 12, border: `1px solid ${T.line}`, borderRadius: 11, overflow: "hidden" }}>
                      {alunosDaTurma(t.id).length === 0 ? (
                        <div style={{ padding: "14px", fontSize: 12.5, color: T.sub, textAlign: "center" }}>Nenhum aluno nesta turma ainda — vincule na aba Alunos.</div>
                      ) : alunosDaTurma(t.id).map((a, j, arr) => {
                        const r = porAluno[a.id];
                        // I11: mesma leitura de dado e mesmo componente que
                        // ListaAlunos.jsx já usa para o selo de credencial.
                        const temCred = !!a.usuario_id;
                        const credRevogada = temCred && a.usuarios?.credencial_status === "revogada";
                        const aguardaTroca = temCred && !credRevogada && a.usuarios?.must_change_password === true;
                        return (
                          <button type="button" key={a.id} className="row" onClick={() => aoVerAluno(a)}
                            style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", border: "none", background: "transparent", padding: "11px 13px", borderBottom: j === arr.length - 1 ? "none" : `1px solid ${T.line}`, color: T.ink }}>
                            <div className="disp" style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: T.cardHi, border: `1px solid ${T.line}`, color: T.gold, fontWeight: 800, fontSize: 12 }}>
                              {a.nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("")}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nome}</div>
                              {r && (
                                <div className="num" style={{ fontSize: 11, color: T.sub, marginTop: 1 }}>
                                  {r.qSem} questões (7d) · acerto <b style={{ color: r.accSem == null ? T.sub : r.accSem >= 70 ? T.green : T.gold }}>{r.accSem == null ? "—" : `${r.accSem}%`}</b> · {r.diasSem} dias
                                  {r.semAtividade && <b style={{ color: T.red }}> · sem atividade</b>}
                                </div>
                              )}
                              {(credRevogada || aguardaTroca) && (
                                <div style={{ display: "flex", gap: 5, marginTop: 4, flexWrap: "wrap" }}>
                                  {credRevogada && <StatusBadge tom="risco">credencial revogada</StatusBadge>}
                                  {aguardaTroca && <StatusBadge tom="alerta">aguardando troca de senha</StatusBadge>}
                                </div>
                              )}
                            </div>
                            <span style={{ color: T.gold, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>›</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <button type="button" onClick={aoVerRanking} style={{ border: `1px solid ${T.line}`, background: "transparent", color: T.gold, borderRadius: 8, fontSize: 12.5, fontWeight: 700, padding: "7px 14px", minHeight: 36 }}>
                      Ver classificação ›
                    </button>
                    <button type="button" onClick={() => renomear(t)} style={{ border: `1px solid ${T.line}`, background: "transparent", color: T.sub, borderRadius: 8, fontSize: 12.5, fontWeight: 600, padding: "7px 14px", minHeight: 36 }}>
                      ✎ Renomear
                    </button>
                    {/* I10: mesmo com a turma ainda tendo alunos (visualmente
                        inerte, opacity 0.6), o botão precisa de cor de aviso —
                        antes era idêntico ao "Renomear" (T.line/T.sub) ao
                        lado. Fica na família de PERIGO nos dois estados, só
                        rebaixada quando inerte (borda mais fraca + a opacity
                        de 0.6 que já existia): dourado aqui competiria com o
                        dourado de ação principal do "Ver classificação ›". */}
                    <button type="button" onClick={() => excluir(t, s.n)} style={{ border: `1px solid ${T.red}${s.n ? "33" : "66"}`, background: "transparent", color: T.red, borderRadius: 8, fontSize: 12.5, fontWeight: 600, padding: "7px 14px", minHeight: 36, opacity: s.n ? 0.6 : 1 }}>
                      × Excluir
                    </button>
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

// Memoizado: aparece 4×/turma e re-renderiza a cada abrir/fechar de
// turma, com props primitivas (rotulo/valor/cor). É o caso seguro de
// React.memo — props estáveis, sem callbacks. Não é decoração: corta
// re-render de tiles cujos números não mudaram (FE1, tarefa 84).
const Mini = React.memo(function Mini({ rotulo, valor, cor }) {
  const T = useTema();
  return (
    // coluna com o valor embaixo: um rótulo que quebra em duas linhas
    // ("Acerto médio no ciclo" no celular) não desalinha os números da linha
    <div style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 9, padding: "8px 10px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div style={{ fontSize: 10, color: T.sub, textTransform: "uppercase", letterSpacing: 0.4 }}>{rotulo}</div>
      <div className="num disp" style={{ fontSize: 18, fontWeight: 800, color: cor || T.ink, marginTop: 2 }}>{valor}</div>
    </div>
  );
});
