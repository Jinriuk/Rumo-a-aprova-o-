/* HISTÓRICO DE PROGRESSO (Fase C0) — visão mínima da COORDENAÇÃO no
   detalhe do aluno: os últimos eventos PERSISTIDOS do motor (XP real,
   missões, conquistas, simulados). Tudo leitura; a RLS já garante que
   só sai a escola da coordenação. Paginado e com empty-state humano. */
import React, { useEffect, useState } from "react";
import { SectionCard, Empty, Erro, EmptyState, CarregandoBloco } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { fmtBR } from "../../shared/regras/regras.js";
import { mensagemAmigavel } from "../../shared/lib/erros.js";
import * as db from "../../shared/data/index.js";

// rótulo humano por tipo de evento (sem jargão técnico na tela)
const ROTULO = {
  registro_estudo: "Registro de estudo",
  missao_concluida: "Objetivo de missão concluído",
  conquista_desbloqueada: "Conquista desbloqueada",
  simulado_finalizado: "Simulado finalizado",
  ajuste_coordenacao: "Ajuste da coordenação",
};

const POR_PAGINA = 8;

export function HistoricoProgresso({ alunoId }) {
  const T = useTema();
  const [estado, setEstado] = useState({ carregando: true, eventos: [], erro: null });
  const [limite, setLimite] = useState(POR_PAGINA);

  useEffect(() => {
    if (!alunoId) return;
    let vivo = true;
    setEstado({ carregando: true, eventos: [], erro: null });
    db.carregarEventosProgresso(alunoId, { limite: 50 })
      .then((eventos) => vivo && setEstado({ carregando: false, eventos, erro: null }))
      .catch((e) => vivo && setEstado({ carregando: false, eventos: [], erro: mensagemAmigavel(e, "carregar") }));
    return () => { vivo = false; };
  }, [alunoId]);

  if (estado.carregando) return <SectionCard titulo="Histórico de progresso"><CarregandoBloco titulo="Carregando o histórico…" linhas={4} /></SectionCard>;
  if (estado.erro) return <SectionCard titulo="Histórico de progresso"><Erro>{estado.erro}</Erro></SectionCard>;

  const total = estado.eventos.length;
  const xp = estado.eventos.reduce((a, e) => a + (e.status === "estornado" ? 0 : (+e.xp_delta || 0)), 0);
  const visiveis = estado.eventos.slice(0, limite);

  return (
    <SectionCard titulo="Histórico de progresso" sub={total ? `${total} eventos · ${xp.toLocaleString("pt-BR")} XP somados` : null} semPadding>
      {total === 0 ? (
        <div style={{ padding: 8 }}>
          <EmptyState icone="◷" titulo="Nenhum evento ainda"
            dica="Os eventos aparecem quando o aluno registra estudo, conclui objetivos ou lança simulados." />
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {visiveis.map((e, i) => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 15px", borderBottom: i === visiveis.length - 1 ? "none" : `1px solid ${T.line}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {ROTULO[e.tipo_evento] ?? e.tipo_evento}
                    {e.status === "estornado" ? <span style={{ color: T.red }}> · estornado</span> : null}
                  </div>
                  <div className="num" style={{ fontSize: 11, color: T.sub, marginTop: 1 }}>{fmtBR(String(e.criado_em).slice(0, 10))}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: e.xp_delta > 0 ? T.gold : T.sub, flexShrink: 0 }}>
                  {e.xp_delta > 0 ? `+${e.xp_delta} XP` : "—"}
                </span>
              </div>
            ))}
          </div>
          {total > limite && (
            <div style={{ textAlign: "center", padding: 12 }}>
              <button onClick={() => setLimite((n) => n + POR_PAGINA)}
                style={{ border: `1px solid ${T.line}`, background: T.bg, color: T.gold, borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, minHeight: 38 }}>
                Ver mais · {limite} de {total}
              </button>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}
