/* Área da coordenação — painel de gestão, não só cadastro (ref. spec):
   Painel / Alunos / Ranking / Turmas / LGPD / Marca. */
import React, { useEffect, useMemo, useState } from "react";
import { Cabecalho } from "../../shared/ui/Cabecalho.jsx";
import { SectionCard, Empty, Erro, EmptyState } from "../../shared/ui/componentes.jsx";
import { MenuPrincipal } from "../../shared/ui/MenuPrincipal.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { NovaTurma, NovosAlunos, CredencialGerada } from "../../modules/pessoas/CadastroAlunos.jsx";
import { ListaAlunos } from "../../modules/pessoas/ListaAlunos.jsx";
import { Marca } from "../../modules/escola/Marca.jsx";
import { PainelConformidade } from "../../modules/consentimento/PainelConformidade.jsx";
import { ClassificacaoTurma } from "../../modules/desempenho/ClassificacaoTurma.jsx";
import { PainelGestao, agregarEscola } from "../../modules/desempenho/PainelGestao.jsx";
import { FichaAluno } from "../../modules/desempenho/FichaAluno.jsx";
import * as db from "../../shared/data/index.js";

export default function AreaEscola({ perfil }) {
  const T = useTema();
  const [tab, setTab] = useState("painel");
  const [dados, setDados] = useState({
    carregando: true, erro: null, turmas: [], alunos: [], consentimentos: [],
    logs: [], trilha: null, concursos: [], registrosEscola: [], metasEscola: [], simuladosEscola: [],
  });
  const [credencial, setCredencial] = useState(null);
  const [alunoAberto, setAlunoAberto] = useState(null);
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao((v) => v + 1);

  useEffect(() => {
    let vivo = true;
    Promise.all([
      db.listarTurmas(), db.listarAlunos(), db.listarConsentimentos(), db.listarLogsAcesso(),
      db.trilhaPadrao(), db.listarConcursos(), db.listarRegistrosEscola(), db.listarMetasEscola(), db.listarSimuladosEscola(),
    ])
      .then(([turmas, alunos, consentimentos, logs, trilha, concursos, registrosEscola, metasEscola, simuladosEscola]) =>
        vivo && setDados({ carregando: false, erro: null, turmas, alunos, consentimentos, logs, trilha, concursos, registrosEscola, metasEscola, simuladosEscola }))
      .catch((e) => vivo && setDados((d) => ({ ...d, carregando: false, erro: e.message })));
    return () => { vivo = false; };
  }, [versao]);

  const aoTopo = () => window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  useEffect(aoTopo, []); // entrar no sistema = nascer no topo

  function irPara(t) { setTab(t); setAlunoAberto(null); aoTopo(); }

  function verAluno(aluno) {
    setAlunoAberto(aluno);
    aoTopo();
    db.registrarAcesso(perfil.escola.id, aluno.id, perfil.usuario.id, "coordenacao", "leitura-desempenho");
  }

  const alunosPorId = Object.fromEntries(dados.alunos.map((a) => [a.id, a]));
  const concursosPorId = Object.fromEntries(dados.concursos.map((c) => [c.id, c]));
  const resumoPorAluno = useMemo(
    () => Object.fromEntries(agregarEscola({ alunos: dados.alunos, registros: dados.registrosEscola, metas: dados.metasEscola }).map((x) => [x.aluno.id, x])),
    [dados.alunos, dados.registrosEscola, dados.metasEscola],
  );

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
          {dados.erro && <Erro>{dados.erro}</Erro>}
          {dados.carregando && <Empty txt="Carregando…" />}

          {!dados.carregando && alunoAberto && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <button onClick={() => { setAlunoAberto(null); aoTopo(); }} style={{ alignSelf: "flex-start", border: `1px solid ${T.line}`, background: T.card, color: T.sub, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>← voltar ao painel</button>
              <FichaAluno aluno={alunoAberto} concurso={concursoDoAluno} />
            </div>
          )}

          {!dados.carregando && !alunoAberto && tab === "painel" && (
            <PainelGestao alunos={dados.alunos} registros={dados.registrosEscola} metas={dados.metasEscola}
              turmas={dados.turmas} concursosPorId={concursosPorId} aoIr={irPara} />
          )}

          {!dados.carregando && !alunoAberto && tab === "alunos" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <NovosAlunos turmas={dados.turmas} trilhaPadrao={dados.trilha} concursos={dados.concursos} aoMudar={recarregar} />
              <ListaAlunos alunos={dados.alunos} consentimentos={dados.consentimentos} concursos={dados.concursos}
                turmas={dados.turmas} resumoPorAluno={resumoPorAluno}
                aoMudar={recarregar} aoGerarCredencial={setCredencial} aoVerAluno={verAluno} />
            </div>
          )}

          {!dados.carregando && !alunoAberto && tab === "ranking" && (
            <ClassificacaoTurma alunos={dados.alunos} turmas={dados.turmas}
              registros={dados.registrosEscola} metas={dados.metasEscola}
              simulados={dados.simuladosEscola} concursosPorId={concursosPorId} />
          )}

          {!dados.carregando && !alunoAberto && tab === "turmas" && (
            <Turmas turmas={dados.turmas} alunos={dados.alunos} registros={dados.registrosEscola}
              metas={dados.metasEscola} aoMudar={recarregar} aoVerRanking={() => irPara("ranking")}
              aoVerAluno={verAluno} />
          )}

          {!dados.carregando && !alunoAberto && tab === "conformidade" && (
            <PainelConformidade consentimentos={dados.consentimentos} logs={dados.logs} alunosPorId={alunosPorId} />
          )}

          {!dados.carregando && !alunoAberto && tab === "marca" && (
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
function Turmas({ turmas, alunos, registros, metas, aoMudar, aoVerRanking, aoVerAluno }) {
  const T = useTema();
  const [turmaAberta, setTurmaAberta] = useState(null);
  const ag = useMemo(() => agregarEscola({ alunos, registros, metas }), [alunos, registros, metas]);
  const porAluno = Object.fromEntries(ag.map((x) => [x.aluno.id, x]));
  const alunosDaTurma = (turmaId) =>
    alunos.filter((a) => (a.alunos_turmas ?? []).some((v) => v.turma_id === turmaId));

  function statsTurma(turmaId) {
    const da = alunos.filter((a) => (a.alunos_turmas ?? []).some((v) => v.turma_id === turmaId));
    const linhas = da.map((a) => porAluno[a.id]).filter(Boolean);
    const comAcc = linhas.filter((x) => x.acc != null);
    return {
      n: da.length,
      questoes: linhas.reduce((s, x) => s + x.q, 0),
      acerto: comAcc.length ? Math.round(comAcc.reduce((s, x) => s + x.acc, 0) / comAcc.length) : null,
      risco: linhas.filter((x) => x.semAtividade).length,
    };
  }

  // a escola gerencia as próprias turmas: renomear e excluir (Fase 10)
  async function renomear(t) {
    const nome = window.prompt("Novo nome da turma:", t.nome);
    if (!nome || nome.trim() === t.nome) return;
    try { await db.renomearTurma(t.id, nome.trim()); aoMudar?.(); } catch (e) { window.alert(e.message); }
  }
  async function excluir(t, n) {
    if (n > 0) { window.alert(`A turma "${t.nome}" tem ${n} aluno(s). Mova os alunos antes de excluir.`); return; }
    if (!window.confirm(`Excluir a turma "${t.nome}"? Esta ação não tem volta.`)) return;
    try { await db.removerTurma(t.id); aoMudar?.(); } catch (e) { window.alert(e.message); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <NovaTurma aoMudar={aoMudar} />
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
                                  {r.qSem} questões (7d) · acerto <b style={{ color: r.acc == null ? T.sub : r.acc >= 70 ? T.green : T.gold }}>{r.acc == null ? "—" : `${r.acc}%`}</b> · {r.diasSem} dias
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

function Mini({ rotulo, valor, cor }) {
  const T = useTema();
  return (
    <div style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 9, padding: "8px 10px" }}>
      <div style={{ fontSize: 10, color: T.sub, textTransform: "uppercase", letterSpacing: 0.4 }}>{rotulo}</div>
      <div className="num disp" style={{ fontSize: 18, fontWeight: 800, color: cor || T.ink, marginTop: 2 }}>{valor}</div>
    </div>
  );
}
