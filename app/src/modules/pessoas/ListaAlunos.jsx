/* Lista de alunos da coordenação (ref. spec): ação principal "Ver
   desempenho"; ação importante "Gerar credencial"; secundárias
   (responsável, exportar/excluir LGPD) recolhidas em "Mais ações".
   Status visual claro com selos. */
import React, { useMemo, useState } from "react";
import { SectionCard, EmptyState, Erro, StatusBadge, BotaoMini, MaisAcoes } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { limparNome, nomeValido } from "../../shared/validacao.js";
import { mensagemAmigavel } from "../../shared/lib/erros.js";
import * as db from "../../shared/data/index.js";

export function ListaAlunos({ alunos, consentimentos, concursos = [], turmas = [], resumoPorAluno = {}, aoMudar, aoGerarCredencial, aoVerAluno }) {
  const T = useTema();
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [busca, setBusca] = useState("");
  const [fTurma, setFTurma] = useState("");
  const [fStatus, setFStatus] = useState("");
  const comConsentimento = useMemo(() => new Set(consentimentos.map((c) => c.aluno_id)), [consentimentos]);

  async function comAcao(aluno, fn) {
    setOcupado(aluno.id); setErro(null);
    try { await fn(); aoMudar?.(); } catch (e) { setErro(mensagemAmigavel(e, "acao")); }
    setOcupado(null);
  }

  const credencialAluno = (a) => comAcao(a, async () => aoGerarCredencial(await db.provisionarAluno(a.id)));
  const pedirNome = (mensagem, atual) => {
    const nome = window.prompt(mensagem, atual);
    if (nome === null) return null; // cancelou
    if (!nomeValido(nome)) { setErro("Nome inválido: use de 2 a 80 caracteres."); return null; }
    return limparNome(nome);
  };
  const credencialResp = (a) => {
    const nome = pedirNome(`Nome do responsável de ${a.nome}:`);
    if (!nome) return;
    return comAcao(a, async () => aoGerarCredencial(await db.provisionarResponsavel(a.id, nome)));
  };
  const consentir = (a) => {
    const nome = pedirNome(`Nome do responsável que consente pelo aluno ${a.nome} (termo v1):`);
    if (!nome) return;
    return comAcao(a, () => db.registrarConsentimento(a.id, nome));
  };
  const trocarConcurso = (a, concursoId) => comAcao(a, () => db.atualizarAluno(a.id, { concurso_id: concursoId || null }));
  const trocarTurma = (a, turmaId) => comAcao(a, () => db.definirTurma(a.id, turmaId || null));
  const renomear = (a) => {
    const nome = pedirNome("Novo nome do aluno:", a.nome);
    if (!nome || nome === a.nome) return;
    return comAcao(a, () => db.atualizarAluno(a.id, { nome }));
  };
  async function exportar(a) {
    setOcupado(a.id); setErro(null);
    try {
      const { dossie } = await db.lgpdTitular("exportar", a.id);
      const blob = new Blob([JSON.stringify(dossie, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `dados-${a.nome.toLowerCase().replace(/\s+/g, "-")}.json`;
      link.click(); URL.revokeObjectURL(link.href);
    } catch (e) { setErro(mensagemAmigavel(e, "acao")); }
    setOcupado(null);
  }
  const excluir = (a) => {
    const ok = window.confirm(`Apagar TODOS os dados de ${a.nome} (registros, metas, simulados, contas de acesso)? Atende um pedido do titular (LGPD) e não tem volta.`);
    if (ok) return comAcao(a, () => db.lgpdTitular("excluir", a.id));
  };

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return alunos
      .filter((a) => !termo || a.nome.toLowerCase().includes(termo))
      .filter((a) => !fTurma || (a.alunos_turmas ?? []).some((v) => v.turma_id === fTurma))
      .filter((a) => {
        if (!fStatus) return true;
        const r = resumoPorAluno[a.id];
        if (fStatus === "sem-credencial") return !a.usuario_id;
        if (fStatus === "sem-consentimento") return !comConsentimento.has(a.id);
        if (fStatus === "sem-atividade") return r ? r.semAtividade : true;
        if (fStatus === "meta-atrasada") return r?.metaIncompleta;
        return true;
      });
  }, [alunos, busca, fTurma, fStatus, resumoPorAluno, comConsentimento]);

  const selS = { background: T.bg, border: `1px solid ${T.line}`, color: T.ink, borderRadius: 8, padding: "7px 9px", fontSize: 12.5 };

  return (
    <SectionCard titulo="Alunos da escola" sub={`${filtrados.length} de ${alunos.length}`} semPadding
      acao={
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…"
            style={{ ...selS, width: 120 }} />
          {turmas.length > 0 && (
            <select value={fTurma} onChange={(e) => setFTurma(e.target.value)} style={selS}>
              <option value="" style={{ background: T.bg2 }}>Todas as turmas</option>
              {turmas.map((t) => <option key={t.id} value={t.id} style={{ background: T.bg2 }}>{t.nome}</option>)}
            </select>
          )}
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={selS}>
            <option value="" style={{ background: T.bg2 }}>Todos os status</option>
            <option value="sem-credencial" style={{ background: T.bg2 }}>Sem credencial</option>
            <option value="sem-consentimento" style={{ background: T.bg2 }}>Sem consentimento</option>
            <option value="sem-atividade" style={{ background: T.bg2 }}>Sem atividade (7d)</option>
            <option value="meta-atrasada" style={{ background: T.bg2 }}>Meta atrasada</option>
          </select>
        </div>
      }>
      {erro && <div style={{ padding: "10px 14px 0" }}><Erro>{erro}</Erro></div>}
      {filtrados.length === 0 ? (
        <div style={{ padding: 8 }}><EmptyState icone="👥" titulo={busca ? "Nenhum aluno encontrado" : "Nenhum aluno ainda"} dica={busca ? "Tente outro nome." : "Cadastre alunos no formulário acima — um a um ou em lote."} /></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {filtrados.map((a, i) => {
            const turmaAtual = (a.alunos_turmas ?? [])[0]?.turma_id ?? "";
            const temCred = !!a.usuario_id;
            const temCons = comConsentimento.has(a.id);
            const trabalhando = ocupado === a.id;
            const r = resumoPorAluno[a.id];
            const selMini = { background: T.bg, border: `1px solid ${T.line}`, color: T.sub, borderRadius: 7, padding: "5px 9px", fontSize: 11.5, maxWidth: "100%" };
            return (
              <div key={a.id} style={{ padding: "13px 15px", borderBottom: i === filtrados.length - 1 ? "none" : `1px solid ${T.line}` }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700 }}>{a.nome}</div>
                    {/* desempenho resumido direto na listagem (Fase 10) */}
                    {r && (
                      <div className="num" style={{ fontSize: 11.5, color: T.sub, marginTop: 3 }}>
                        <b style={{ color: T.ink }}>{r.qSem}</b> questões (7d) · acerto{" "}
                        <b style={{ color: r.acc == null ? T.sub : r.acc >= 70 ? T.green : r.acc >= 55 ? T.gold : T.red }}>{r.acc == null ? "—" : `${r.acc}%`}</b>
                        {" · "}<b style={{ color: r.diasSem >= 3 ? T.ink : T.red }}>{r.diasSem}</b> dias
                        {r.consideradas > 0 && <> · meta <b style={{ color: r.feitas >= r.consideradas ? T.green : T.gold }}>{r.feitas}/{r.consideradas}</b></>}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
                      <StatusBadge tom={temCred ? "ok" : "alerta"}>{temCred ? "com credencial" : "sem credencial"}</StatusBadge>
                      <StatusBadge tom={temCons ? "ok" : "risco"}>{temCons ? "consentimento ok" : "sem consentimento"}</StatusBadge>
                      {r?.semAtividade && <StatusBadge tom="risco">sem atividade 7d</StatusBadge>}
                    </div>
                    <div style={{ display: "flex", gap: 7, marginTop: 8, flexWrap: "wrap" }}>
                      {turmas.length > 0 && (
                        <select value={turmaAtual} disabled={trabalhando} onChange={(e) => trocarTurma(a, e.target.value)} title="Turma do aluno" style={selMini}>
                          <option value="" style={{ background: T.bg2 }}>— sem turma —</option>
                          {turmas.map((t) => <option key={t.id} value={t.id} style={{ background: T.bg2 }}>{t.nome}</option>)}
                        </select>
                      )}
                      {concursos.length > 0 && (
                        <select value={a.concurso_id ?? ""} disabled={trabalhando} onChange={(e) => trocarConcurso(a, e.target.value)} title="Concurso do aluno" style={selMini}>
                          <option value="" style={{ background: T.bg2 }}>— sem concurso —</option>
                          {concursos.map((c) => <option key={c.id} value={c.id} style={{ background: T.bg2 }}>{c.nome}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <BotaoMini destaque onClick={() => aoVerAluno(a)}>Ver desempenho</BotaoMini>
                    {!temCred && <BotaoMini destaque disabled={trabalhando} onClick={() => credencialAluno(a)}>{trabalhando ? "…" : "Gerar credencial"}</BotaoMini>}
                    <MaisAcoes acoes={[
                      { rotulo: "✎ Renomear aluno", aoClicar: () => renomear(a) },
                      { rotulo: "+ Adicionar responsável", aoClicar: () => credencialResp(a) },
                      ...(!temCons ? [{ rotulo: "Registrar consentimento", aoClicar: () => consentir(a) }] : []),
                      ...(temCred ? [{ rotulo: "Regerar credencial do aluno", aoClicar: () => credencialAluno(a) }] : []),
                      { rotulo: "Exportar dados (LGPD)", aoClicar: () => exportar(a) },
                      { rotulo: "Excluir dados (LGPD)", aoClicar: () => excluir(a), perigo: true },
                    ]} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
