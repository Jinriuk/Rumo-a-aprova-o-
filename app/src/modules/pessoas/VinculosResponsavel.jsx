/* Gerenciamento de responsáveis de um aluno: lista + revogação + re-vinculação.
   Usar como modal ou painel inline — recebe aluno e onClose. */
import React, { useEffect, useState } from "react";
import { SectionCard, BotaoMini, Erro, EmptyState } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { mensagemAmigavel } from "../../shared/lib/erros.js";
import * as db from "../../shared/data/index.js";

export function VinculosResponsavel({ aluno, aoMudar, aoFechar }) {
  const T = useTema();
  const [vinculos, setVinculos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [revogando, setRevogando] = useState(null);
  const [confirmando, setConfirmando] = useState(null);

  // Estado para re-vinculação
  const [mostraRevincular, setMostraRevincular] = useState(false);
  const [responsaveisDisponiveis, setResponsaveisDisponiveis] = useState([]);
  const [carregandoDisp, setCarregandoDisp] = useState(false);
  const [vinculando, setVinculando] = useState(null);
  const [feedbackRevincular, setFeedbackRevincular] = useState(null);

  useEffect(() => {
    if (!aluno?.id) return;
    setCarregando(true);
    db.listarVinculos(aluno.id)
      .then(setVinculos)
      .catch((e) => setErro(mensagemAmigavel(e, "carregar")))
      .finally(() => setCarregando(false));
  }, [aluno?.id]);

  async function revogar(vinculo) {
    setRevogando(vinculo.id);
    setErro(null);
    try {
      await db.revogarResponsavel(vinculo.id);
      setVinculos((v) => v.filter((x) => x.id !== vinculo.id));
      setConfirmando(null);
      setFeedbackRevincular(null);
      aoMudar?.();
    } catch (e) {
      setErro(mensagemAmigavel(e, "revogar"));
    }
    setRevogando(null);
  }

  async function abrirRevincular() {
    setMostraRevincular(true);
    setFeedbackRevincular(null);
    setCarregandoDisp(true);
    try {
      const todos = await db.listarResponsaveisEscola();
      const jaVinculados = new Set(vinculos.map((v) => v.responsavel_id));
      setResponsaveisDisponiveis(todos.filter((r) => !jaVinculados.has(r.id)));
    } catch (e) {
      setErro(mensagemAmigavel(e, "carregar responsáveis"));
    }
    setCarregandoDisp(false);
  }

  async function vincularExistente(responsavelId) {
    setVinculando(responsavelId);
    setErro(null);
    setFeedbackRevincular(null);
    try {
      const resultado = await db.vincularResponsavelExistente(aluno.id, responsavelId);
      if (resultado?.estado === "vinculo_ja_existente") {
        setFeedbackRevincular(`Este responsável já estava vinculado a ${aluno.nome}.`);
      } else {
        setFeedbackRevincular(`Responsável vinculado novamente a ${aluno.nome}.`);
      }
      // Recarrega lista de vínculos
      const novosVinculos = await db.listarVinculos(aluno.id);
      setVinculos(novosVinculos);
      setMostraRevincular(false);
      aoMudar?.();
    } catch (e) {
      setErro(mensagemAmigavel(e, "vincular responsável"));
    }
    setVinculando(null);
  }

  function fmtData(iso) {
    try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#000a", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 60, padding: 18,
    }}>
      <div style={{
        background: T.card, border: `1px solid ${T.line}`, borderTop: `3px solid ${T.gold}`,
        borderRadius: 14, padding: 20, width: "100%", maxWidth: 440, maxHeight: "90vh",
        overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div className="disp" style={{ fontWeight: 700, fontSize: 15 }}>
            Responsáveis de {aluno?.nome}
          </div>
          <button onClick={aoFechar}
            style={{ background: "none", border: "none", color: T.sub, fontSize: 18, cursor: "pointer", padding: "4px 8px" }}>
            ×
          </button>
        </div>

        {erro && <Erro>{erro}</Erro>}
        {feedbackRevincular && (
          <div style={{ color: T.green, fontSize: 13, marginBottom: 10, padding: "8px 10px", background: `${T.green}18`, borderRadius: 8 }}>
            {feedbackRevincular}
          </div>
        )}

        {/* ── Lista de vínculos ativos ── */}
        {carregando ? (
          <div style={{ color: T.sub, fontSize: 13, textAlign: "center", padding: 16 }}>Carregando…</div>
        ) : vinculos.length === 0 ? (
          <EmptyState icone="👨‍👧" titulo="Nenhum responsável vinculado"
            dica="Use 'Adicionar responsável' para criar uma credencial nova, ou 'Vincular responsável existente' para reativar um vínculo anterior." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {vinculos.map((v) => {
              const nome = v.usuarios?.nome ?? "Responsável";
              const ehConfirmando = confirmando === v.id;
              return (
                <div key={v.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 10, padding: "10px 12px", border: `1px solid ${T.line}`,
                  borderRadius: 9, flexWrap: "wrap",
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{nome}</div>
                    <div style={{ fontSize: 11.5, color: T.sub }}>desde {fmtData(v.criado_em)}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {ehConfirmando ? (
                      <>
                        <BotaoMini perigo disabled={revogando === v.id}
                          onClick={() => revogar(v)}>
                          {revogando === v.id ? "Revogando…" : "Confirmar revogação"}
                        </BotaoMini>
                        <BotaoMini onClick={() => setConfirmando(null)}>Cancelar</BotaoMini>
                      </>
                    ) : (
                      <BotaoMini onClick={() => setConfirmando(v.id)}>Revogar acesso</BotaoMini>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Vincular responsável existente ── */}
        {!mostraRevincular ? (
          <div style={{ marginTop: 14 }}>
            <BotaoMini onClick={abrirRevincular} style={{ width: "100%" }}>
              + Vincular responsável existente
            </BotaoMini>
            <div style={{ fontSize: 11, color: T.sub, marginTop: 5, textAlign: "center" }}>
              Reativa vínculo de responsável já cadastrado na escola.
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 16, border: `1px solid ${T.line}`, borderRadius: 9, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Vincular responsável existente</div>
              <BotaoMini onClick={() => setMostraRevincular(false)}>Cancelar</BotaoMini>
            </div>
            {carregandoDisp ? (
              <div style={{ color: T.sub, fontSize: 13 }}>Carregando…</div>
            ) : responsaveisDisponiveis.length === 0 ? (
              <div style={{ color: T.sub, fontSize: 13 }}>
                Nenhum responsável disponível para vincular. Todos já estão vinculados a este aluno.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {responsaveisDisponiveis.map((r) => (
                  <div key={r.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 10px", border: `1px solid ${T.line}`, borderRadius: 8,
                  }}>
                    <div style={{ fontSize: 13 }}>{r.nome}</div>
                    <BotaoMini destaque disabled={vinculando === r.id}
                      onClick={() => vincularExistente(r.id)}>
                      {vinculando === r.id ? "Vinculando…" : "Vincular"}
                    </BotaoMini>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <button onClick={aoFechar}
          style={{ marginTop: 16, width: "100%", background: T.line, border: "none", color: T.sub, borderRadius: 9, padding: "11px", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
          Fechar
        </button>
      </div>
    </div>
  );
}
