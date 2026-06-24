/* Gerenciamento de responsáveis de um aluno: lista + revogação.
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
      aoMudar?.();
    } catch (e) {
      setErro(mensagemAmigavel(e, "revogar"));
    }
    setRevogando(null);
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
        borderRadius: 14, padding: 20, width: "100%", maxWidth: 420, maxHeight: "90vh",
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

        {carregando ? (
          <div style={{ color: T.sub, fontSize: 13, textAlign: "center", padding: 16 }}>Carregando…</div>
        ) : vinculos.length === 0 ? (
          <EmptyState icone="👨‍👧" titulo="Nenhum responsável" dica="Use 'Adicionar responsável' na lista de alunos para vincular um responsável." />
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

        <button onClick={aoFechar}
          style={{ marginTop: 16, width: "100%", background: T.line, border: "none", color: T.sub, borderRadius: 9, padding: "11px", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
          Fechar
        </button>
      </div>
    </div>
  );
}
