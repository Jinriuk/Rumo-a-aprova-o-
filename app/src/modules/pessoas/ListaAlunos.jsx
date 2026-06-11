/* A lista de alunos da escola: credencial, responsável, consentimento,
   desempenho e LGPD por aluno — o dia a dia da coordenação. */
import React, { useState } from "react";
import { Card, Empty, Erro, Botao } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import * as db from "../../shared/data/index.js";

export function ListaAlunos({ alunos, consentimentos, concursos = [], aoMudar, aoGerarCredencial, aoVerAluno }) {
  const T = useTema();
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const comConsentimento = new Set(consentimentos.map((c) => c.aluno_id));

  async function trocarConcurso(aluno, concursoId) {
    setOcupado(aluno.id); setErro(null);
    try {
      await db.atualizarAluno(aluno.id, { concurso_id: concursoId || null });
      aoMudar?.();
    } catch (e) { setErro(e.message); }
    setOcupado(null);
  }

  async function credencialAluno(aluno) {
    setOcupado(aluno.id); setErro(null);
    try {
      const r = await db.provisionarAluno(aluno.id);
      aoGerarCredencial(r);
      aoMudar?.();
    } catch (e) { setErro(e.message); }
    setOcupado(null);
  }

  async function credencialResponsavel(aluno) {
    const nome = window.prompt(`Nome do responsável de ${aluno.nome}:`);
    if (!nome?.trim()) return;
    setOcupado(aluno.id); setErro(null);
    try {
      const r = await db.provisionarResponsavel(aluno.id, nome.trim());
      aoGerarCredencial(r);
      aoMudar?.();
    } catch (e) { setErro(e.message); }
    setOcupado(null);
  }

  async function consentir(aluno) {
    const nome = window.prompt(`Nome do responsável que consente pelo aluno ${aluno.nome} (termo v1):`);
    if (!nome?.trim()) return;
    setOcupado(aluno.id); setErro(null);
    try {
      await db.registrarConsentimento(aluno.id, nome.trim());
      aoMudar?.();
    } catch (e) { setErro(e.message); }
    setOcupado(null);
  }

  async function exportar(aluno) {
    setOcupado(aluno.id); setErro(null);
    try {
      const { dossie } = await db.lgpdTitular("exportar", aluno.id);
      const blob = new Blob([JSON.stringify(dossie, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `dados-${aluno.nome.toLowerCase().replace(/\s+/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { setErro(e.message); }
    setOcupado(null);
  }

  async function excluir(aluno) {
    const ok = window.confirm(
      `Apagar TODOS os dados de ${aluno.nome} (registros, metas, simulados, contas de acesso)? ` +
      `Isso atende um pedido do titular (LGPD) e não tem volta.`,
    );
    if (!ok) return;
    setOcupado(aluno.id); setErro(null);
    try {
      await db.lgpdTitular("excluir", aluno.id);
      aoMudar?.();
    } catch (e) { setErro(e.message); }
    setOcupado(null);
  }

  const botaoMini = (rotulo, fn, destaque) => (
    <button onClick={fn} disabled={!!ocupado}
      style={{ border: `1px solid ${destaque ? T.gold : T.line}`, background: "transparent", color: destaque ? T.gold : T.sub, borderRadius: 6, fontSize: 11.5, fontWeight: 600, padding: "6px 10px", minHeight: 32 }}>
      {rotulo}
    </button>
  );

  return (
    <Card>
      <div className="disp" style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Alunos da escola</div>
      {alunos.length === 0 ? <Empty txt="Nenhum aluno ainda. Cadastre acima." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {alunos.map((a) => {
            const turmas = (a.alunos_turmas ?? []).map((v) => v.turmas?.nome).filter(Boolean).join(", ");
            const temCredencial = !!a.usuario_id;
            const temConsentimento = comConsentimento.has(a.id);
            return (
              <div key={a.id} className="row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderRadius: 8, borderBottom: `1px solid ${T.line}`, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{a.nome}</div>
                  <div style={{ fontSize: 11.5, color: T.sub, marginTop: 2 }}>
                    {turmas || "sem turma"}
                    {" · "}
                    <span style={{ color: temCredencial ? T.green : T.gold }}>{temCredencial ? "com credencial" : "sem credencial"}</span>
                    {" · "}
                    <span style={{ color: temConsentimento ? T.green : T.red }}>{temConsentimento ? "consentimento ok" : "sem consentimento"}</span>
                  </div>
                  {concursos.length > 0 && (
                    <select value={a.concurso_id ?? ""} disabled={!!ocupado}
                      onChange={(e) => trocarConcurso(a, e.target.value)}
                      title="Concurso em que o aluno está inscrito"
                      style={{ marginTop: 6, background: T.bg, border: `1px solid ${T.line}`, color: T.sub, borderRadius: 6, padding: "4px 8px", fontSize: 11.5, maxWidth: 280 }}>
                      <option value="" style={{ background: T.bg2 }}>— sem concurso —</option>
                      {concursos.map((c) => (
                        <option key={c.id} value={c.id} style={{ background: T.bg2 }}>{c.nome}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {botaoMini("desempenho", () => aoVerAluno(a), true)}
                  {!temCredencial && botaoMini(ocupado === a.id ? "…" : "gerar credencial", () => credencialAluno(a), true)}
                  {botaoMini("+ responsável", () => credencialResponsavel(a))}
                  {!temConsentimento && botaoMini("registrar consentimento", () => consentir(a))}
                  {botaoMini("exportar (LGPD)", () => exportar(a))}
                  {botaoMini("excluir (LGPD)", () => excluir(a))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Erro>{erro}</Erro>
    </Card>
  );
}
