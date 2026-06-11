/* Lista de alunos da coordenação (ref. spec): ação principal "Ver
   desempenho"; ação importante "Gerar credencial"; secundárias
   (responsável, exportar/excluir LGPD) recolhidas em "Mais ações".
   Status visual claro com selos. */
import React, { useState } from "react";
import { SectionCard, EmptyState, Erro, StatusBadge, BotaoMini, MaisAcoes } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import * as db from "../../shared/data/index.js";

export function ListaAlunos({ alunos, consentimentos, concursos = [], aoMudar, aoGerarCredencial, aoVerAluno }) {
  const T = useTema();
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [busca, setBusca] = useState("");
  const comConsentimento = new Set(consentimentos.map((c) => c.aluno_id));

  async function comAcao(aluno, fn) {
    setOcupado(aluno.id); setErro(null);
    try { await fn(); aoMudar?.(); } catch (e) { setErro(e.message); }
    setOcupado(null);
  }

  const credencialAluno = (a) => comAcao(a, async () => aoGerarCredencial(await db.provisionarAluno(a.id)));
  const credencialResp = (a) => {
    const nome = window.prompt(`Nome do responsável de ${a.nome}:`);
    if (!nome?.trim()) return;
    return comAcao(a, async () => aoGerarCredencial(await db.provisionarResponsavel(a.id, nome.trim())));
  };
  const consentir = (a) => {
    const nome = window.prompt(`Nome do responsável que consente pelo aluno ${a.nome} (termo v1):`);
    if (!nome?.trim()) return;
    return comAcao(a, () => db.registrarConsentimento(a.id, nome.trim()));
  };
  const trocarConcurso = (a, concursoId) => comAcao(a, () => db.atualizarAluno(a.id, { concurso_id: concursoId || null }));
  async function exportar(a) {
    setOcupado(a.id); setErro(null);
    try {
      const { dossie } = await db.lgpdTitular("exportar", a.id);
      const blob = new Blob([JSON.stringify(dossie, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `dados-${a.nome.toLowerCase().replace(/\s+/g, "-")}.json`;
      link.click(); URL.revokeObjectURL(link.href);
    } catch (e) { setErro(e.message); }
    setOcupado(null);
  }
  const excluir = (a) => {
    const ok = window.confirm(`Apagar TODOS os dados de ${a.nome} (registros, metas, simulados, contas de acesso)? Atende um pedido do titular (LGPD) e não tem volta.`);
    if (ok) return comAcao(a, () => db.lgpdTitular("excluir", a.id));
  };

  const filtrados = busca.trim()
    ? alunos.filter((a) => a.nome.toLowerCase().includes(busca.trim().toLowerCase()))
    : alunos;

  return (
    <SectionCard titulo="Alunos da escola" sub={`${alunos.length} cadastrado(s)`} semPadding
      acao={alunos.length > 6 ? (
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar aluno…"
          style={{ background: T.bg, border: `1px solid ${T.line}`, color: T.ink, borderRadius: 8, padding: "7px 11px", fontSize: 13, width: 150 }} />
      ) : null}>
      {erro && <div style={{ padding: "10px 14px 0" }}><Erro>{erro}</Erro></div>}
      {filtrados.length === 0 ? (
        <div style={{ padding: 8 }}><EmptyState icone="👥" titulo={busca ? "Nenhum aluno encontrado" : "Nenhum aluno ainda"} dica={busca ? "Tente outro nome." : "Cadastre alunos no formulário acima — um a um ou em lote."} /></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {filtrados.map((a, i) => {
            const turmas = (a.alunos_turmas ?? []).map((v) => v.turmas?.nome).filter(Boolean).join(", ");
            const temCred = !!a.usuario_id;
            const temCons = comConsentimento.has(a.id);
            const trabalhando = ocupado === a.id;
            return (
              <div key={a.id} style={{ padding: "13px 15px", borderBottom: i === filtrados.length - 1 ? "none" : `1px solid ${T.line}` }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700 }}>{a.nome}</div>
                    <div style={{ fontSize: 11.5, color: T.sub, marginTop: 2 }}>{turmas || "sem turma"}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
                      <StatusBadge tom={temCred ? "ok" : "alerta"}>{temCred ? "com credencial" : "sem credencial"}</StatusBadge>
                      <StatusBadge tom={temCons ? "ok" : "risco"}>{temCons ? "consentimento ok" : "sem consentimento"}</StatusBadge>
                    </div>
                    {concursos.length > 0 && (
                      <select value={a.concurso_id ?? ""} disabled={trabalhando}
                        onChange={(e) => trocarConcurso(a, e.target.value)} title="Concurso do aluno"
                        style={{ marginTop: 8, background: T.bg, border: `1px solid ${T.line}`, color: T.sub, borderRadius: 7, padding: "5px 9px", fontSize: 11.5, maxWidth: "100%" }}>
                        <option value="" style={{ background: T.bg2 }}>— sem concurso —</option>
                        {concursos.map((c) => <option key={c.id} value={c.id} style={{ background: T.bg2 }}>{c.nome}</option>)}
                      </select>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <BotaoMini destaque onClick={() => aoVerAluno(a)}>Ver desempenho</BotaoMini>
                    {!temCred && <BotaoMini destaque disabled={trabalhando} onClick={() => credencialAluno(a)}>{trabalhando ? "…" : "Gerar credencial"}</BotaoMini>}
                    <MaisAcoes acoes={[
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
