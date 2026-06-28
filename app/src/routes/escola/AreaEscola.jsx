/* Área da coordenação — painel de gestão, não só cadastro (ref. spec):
   Painel / Alunos / Ranking / Turmas / LGPD / Marca. */
import React, { useEffect, useMemo, useReducer, useState } from "react";
import { Cabecalho } from "../../shared/ui/Cabecalho.jsx";
import { SectionCard, Empty, Erro, ErroComRetry, EmptyState, CarregandoBloco, useDialogo } from "../../shared/ui/componentes.jsx";
import { nomeValido, limparNome } from "../../shared/validacao.js";
import { MenuPrincipal } from "../../shared/ui/MenuPrincipal.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { NovaTurma, PainelCadastroAlunos, CredencialGerada } from "../../modules/pessoas/CadastroAlunos.jsx";
import { ListaAlunos } from "../../modules/pessoas/ListaAlunos.jsx";
import { Marca } from "../../modules/escola/Marca.jsx";
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

const VAZIO = { turmas: [], alunos: [], consentimentos: [], logs: [], trilha: null, concursos: [], resumo: [], simuladosEscola: [], trilhas: [] };

export default function AreaEscola({ perfil }) {
  const T = useTema();
  // Navegação coordenada (aba + filtro + ficha) num reducer só — ver
  // navegacaoEscola.js. Cada transição deixa o estado coerente.
  const [nav, despacharNav] = useReducer(navReducer, NAV_INICIAL);
  const { tab, filtroStatus: filtroAlunosStatus, alunoAberto } = nav;
  // Cancelamento (tarefa 81): a carga mais pesada do app são estas 9
  // leituras paralelas da coordenação. O signal do useRecurso é
  // repassado a cada uma; se a coordenação sai da tela (ou recarrega)
  // no meio, as viagens em curso são abortadas em vez de só ignoradas.
  const { dados: carregado, carregando, erro, recarregar } = useRecurso(
    (signal) => Promise.all([
      db.listarTurmas({ signal }), db.listarAlunos({ signal }), db.listarConsentimentos({ signal }),
      db.listarLogsAcesso(100, { signal }), db.trilhaPadrao({ signal }), db.listarConcursos({ signal }),
      db.resumoEscola({ signal }), db.listarSimuladosEscola({ signal }), db.listarTrilhas({ signal }),
    ]).then(([turmas, alunos, consentimentos, logs, trilha, concursos, resumo, simuladosEscola, trilhas]) =>
      ({ turmas, alunos, consentimentos, logs, trilha, concursos, resumo, simuladosEscola, trilhas })),
    [],
  );
  const dados = carregado ?? VAZIO;
  const [credencial, setCredencial] = useState(null);

  const aoTopo = () => window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  useEffect(aoTopo, []); // entrar no sistema = nascer no topo

  function irPara(t) { despacharNav({ tipo: "ir", tab: t }); aoTopo(); }
  function irParaFiltrado(tab, filtro) { despacharNav({ tipo: "irFiltrado", tab, filtro }); aoTopo(); }

  function verAluno(aluno) {
    despacharNav({ tipo: "abrirAluno", aluno });
    aoTopo();
    db.registrarAcesso(perfil.escola.id, aluno.id, perfil.usuario.id, "coordenacao", "leitura-desempenho");
  }

  const alunosPorId = useMemo(() => Object.fromEntries(dados.alunos.map((a) => [a.id, a])), [dados.alunos]);
  const concursosPorId = useMemo(() => Object.fromEntries(dados.concursos.map((c) => [c.id, c])), [dados.concursos]);
  // Agregado por aluno: vem PRONTO do banco (RPC resumo_escola) e é
  // calculado uma única vez aqui — Painel, Ranking e Turmas reusam.
  const resumoLista = useMemo(() => adaptarResumoEscola(dados.resumo, alunosPorId), [dados.resumo, alunosPorId]);
  const resumoPorAluno = useMemo(() => Object.fromEntries(resumoLista.map((x) => [x.aluno.id, x])), [resumoLista]);

  const ABAS = [
    ["painel", "Painel", null, "painel"], ["alunos", "Alunos", null, "alunos"],
    ["ranking", "Ranking", null, "trofeu"], ["turmas", "Turmas", null, "turmas"],
    ["conformidade", "LGPD", null, "escudo"], ["marca", "Marca", null, "pincel"],
  ];

  const concursoDoAluno = alunoAberto ? concursosPorId[alunoAberto.concurso_id] : null;

  return (
    <div>
      <Cabecalho subtitulo="Painel de gestão" nomeUsuario={perfil.usuario.nome} rotuloPapel="Coordenação" />
      <main className="com-sidebar" style={{ maxWidth: 1080, margin: "0 auto", padding: "16px max(16px, env(safe-area-inset-right)) calc(88px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))" }}>
        <MenuPrincipal abas={ABAS} ativo={tab} aoTrocar={irPara}
          usuario={{ nome: perfil.usuario.nome, sub: "Coordenação" }} />

        <div className="fade" key={tab + (alunoAberto?.id ?? "")}>
          {erro && <ErroComRetry aoTentar={recarregar}>{erro}</ErroComRetry>}
          {carregando && <CarregandoBloco titulo="Carregando dados da escola…" cartoes={4} linhas={4} />}

          {!carregando && alunoAberto && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <button onClick={() => { despacharNav({ tipo: "fecharAluno" }); aoTopo(); }} style={{ alignSelf: "flex-start", border: `1px solid ${T.line}`, background: T.card, color: T.sub, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>← voltar ao painel</button>
              <FichaAluno aluno={alunoAberto} concurso={concursoDoAluno} />
            </div>
          )}

          {!carregando && !alunoAberto && tab === "painel" && (
            <PainelGestao resumo={resumoLista} aoIr={irPara} aoIrFiltrado={irParaFiltrado} />
          )}

          {!carregando && !alunoAberto && tab === "alunos" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <PainelCadastroAlunos turmas={dados.turmas} trilhaPadrao={dados.trilha} concursos={dados.concursos} aoMudar={recarregar} />
              <ListaAlunos alunos={dados.alunos} consentimentos={dados.consentimentos} concursos={dados.concursos}
                turmas={dados.turmas} trilhas={dados.trilhas} resumoPorAluno={resumoPorAluno}
                aoMudar={recarregar} aoGerarCredencial={setCredencial} aoVerAluno={verAluno}
                filtroStatusInicial={filtroAlunosStatus} />
            </div>
          )}

          {!carregando && !alunoAberto && tab === "ranking" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <ClassificacaoTurma alunos={dados.alunos} turmas={dados.turmas}
                resumoPorAluno={resumoPorAluno}
                simulados={dados.simuladosEscola} concursosPorId={concursosPorId} />
              <Relatorios alunos={dados.alunos} turmas={dados.turmas}
                concursosPorId={concursosPorId} resumoPorAluno={resumoPorAluno}
                escolaNome={perfil.escola.nome} />
            </div>
          )}

          {!carregando && !alunoAberto && tab === "turmas" && (
            <Turmas turmas={dados.turmas} alunos={dados.alunos} porAluno={resumoPorAluno}
              aoMudar={recarregar} aoVerRanking={() => irPara("ranking")}
              aoVerAluno={verAluno} />
          )}

          {!carregando && !alunoAberto && tab === "conformidade" && (
            <PainelConformidade consentimentos={dados.consentimentos} logs={dados.logs} alunosPorId={alunosPorId} />
          )}

          {!carregando && !alunoAberto && tab === "marca" && (
            <Marca escola={perfil.escola} aoMudar={recarregar} />
          )}
        </div>
      </main>

      <CredencialGerada credencial={credencial} aoFechar={() => setCredencial(null)} />
    </div>
  );
}

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
    const mapa = new Map(turmas.map((t) => [t.id, { alunos: [], n: 0, questoes: 0, acerto: null, risco: 0 }]));
    for (const a of alunos) {
      for (const v of a.alunos_turmas ?? []) {
        const entrada = mapa.get(v.turma_id);
        if (entrada) entrada.alunos.push(a);
      }
    }
    for (const entrada of mapa.values()) {
      const linhas = entrada.alunos.map((a) => porAluno[a.id]).filter(Boolean);
      const comAcc = linhas.filter((x) => x.acc != null);
      entrada.n = entrada.alunos.length;
      entrada.questoes = linhas.reduce((s, x) => s + x.q, 0);
      entrada.acerto = comAcc.length ? Math.round(comAcc.reduce((s, x) => s + x.acc, 0) / comAcc.length) : null;
      entrada.risco = linhas.filter((x) => x.semAtividade).length;
    }
    return mapa;
  }, [turmas, alunos, porAluno]);
  const vazia = { alunos: [], n: 0, questoes: 0, acerto: null, risco: 0 };
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
        rotuloCancelar: "Fechar",
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
                  <button onClick={() => setTurmaAberta(aberta ? null : t.id)}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", width: "100%", border: "none", background: "transparent", textAlign: "left", padding: 0, color: T.ink }}>
                    <div className="disp" style={{ fontSize: 15, fontWeight: 700 }}>
                      {t.nome} <span style={{ fontSize: 11, color: T.gold, fontWeight: 700, marginLeft: 6 }}>{aberta ? "fechar alunos ▴" : "ver alunos ▾"}</span>
                    </div>
                    {s.risco > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: T.red, background: `${T.red}14`, border: `1px solid ${T.red}44`, borderRadius: 6, padding: "2px 8px" }}>{s.risco} em risco</span>}
                  </button>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 8, marginTop: 10 }}>
                    <Mini rotulo="Alunos" valor={s.n} />
                    <Mini rotulo="Acerto" valor={s.acerto == null ? "—" : `${s.acerto}%`} cor={s.acerto == null ? null : s.acerto >= 70 ? T.green : T.gold} />
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
                        return (
                          <button key={a.id} className="row" onClick={() => aoVerAluno(a)}
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
                            </div>
                            <span style={{ color: T.gold, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>›</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <button onClick={aoVerRanking} style={{ border: `1px solid ${T.line}`, background: "transparent", color: T.gold, borderRadius: 8, fontSize: 12.5, fontWeight: 700, padding: "7px 14px", minHeight: 36 }}>
                      Ver classificação ›
                    </button>
                    <button onClick={() => renomear(t)} style={{ border: `1px solid ${T.line}`, background: "transparent", color: T.sub, borderRadius: 8, fontSize: 12.5, fontWeight: 600, padding: "7px 14px", minHeight: 36 }}>
                      ✎ Renomear
                    </button>
                    <button onClick={() => excluir(t, s.n)} style={{ border: `1px solid ${s.n ? T.line : T.red + "66"}`, background: "transparent", color: s.n ? T.sub : T.red, borderRadius: 8, fontSize: 12.5, fontWeight: 600, padding: "7px 14px", minHeight: 36, opacity: s.n ? 0.6 : 1 }}>
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
    <div style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 9, padding: "8px 10px" }}>
      <div style={{ fontSize: 10, color: T.sub, textTransform: "uppercase", letterSpacing: 0.4 }}>{rotulo}</div>
      <div className="num disp" style={{ fontSize: 18, fontWeight: 800, color: cor || T.ink, marginTop: 2 }}>{valor}</div>
    </div>
  );
});
