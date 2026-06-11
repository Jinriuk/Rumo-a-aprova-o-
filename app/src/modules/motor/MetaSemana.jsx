/* A meta da semana: o checklist de atividades da trilha com os três
   estados do motor (pendente → concluída; ignorar fica disponível
   sem drama). Quem GERA a meta é o servidor; aqui o aluno só marca. */
import React, { useState } from "react";
import { Card, Tag, SubjDot, Empty, Erro, Estrelas } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { fmtBR } from "../../shared/regras/regras.js";
import * as db from "../../shared/data/index.js";

export function MetaSemana({ meta, trilha, podeEditar, aoMudar }) {
  const T = useTema();
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(null);

  if (!meta) return <Card><Empty txt="A meta da semana ainda não foi gerada. Ela nasce no servidor — fale com a coordenação." /></Card>;

  const semana = trilha.semanas.find((s) => s.numero === meta.semana_numero);
  const itens = (meta.meta_atividades ?? [])
    .map((ma) => ({ ...ma, atividade: trilha.atividadesPorId[ma.atividade_modelo_id] }))
    .filter((x) => x.atividade)
    .sort((a, b) => a.atividade.ordem - b.atividade.ordem);

  const feitas = itens.filter((x) => x.estado === "concluida").length;
  const consideradas = itens.filter((x) => x.estado !== "ignorada").length;

  async function alternar(item) {
    if (!podeEditar || ocupado) return;
    const novo = item.estado === "concluida" ? "pendente" : "concluida";
    setOcupado(item.id); setErro(null);
    try {
      await db.definirEstadoAtividade(item.id, novo);
      aoMudar?.();
    } catch (e) { setErro(e.message); }
    setOcupado(null);
  }

  async function ignorar(item) {
    if (!podeEditar || ocupado) return;
    const novo = item.estado === "ignorada" ? "pendente" : "ignorada";
    setOcupado(item.id); setErro(null);
    try {
      await db.definirEstadoAtividade(item.id, novo);
      aoMudar?.();
    } catch (e) { setErro(e.message); }
    setOcupado(null);
  }

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, flexWrap: "wrap", gap: 6 }}>
        <div className="disp" style={{ fontSize: 17, fontWeight: 700 }}>
          Semana {meta.semana_numero} · {fmtBR(String(meta.inicio))}–{fmtBR(String(meta.fim))}
        </div>
        <div style={{ fontSize: 12, color: T.sub }}>{feitas}/{consideradas} atividades</div>
      </div>
      {semana && <div style={{ fontStyle: "italic", color: T.gold, fontSize: 13.5, marginBottom: 4 }}>{semana.foco}</div>}
      {semana?.simulado && <div style={{ fontSize: 12.5, color: T.red, fontWeight: 600, marginBottom: 8 }}>⚑ {semana.simulado} esta semana</div>}
      <div style={{ height: 6, background: T.bg, borderRadius: 4, overflow: "hidden", margin: "8px 0 14px" }}>
        <div style={{ width: `${consideradas ? (feitas / consideradas) * 100 : 0}%`, height: "100%", background: `linear-gradient(90deg,${T.gold},${T.green})`, transition: "width .3s" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {itens.map((item) => {
          const at = item.atividade;
          const concluida = item.estado === "concluida";
          const ignorada = item.estado === "ignorada";
          return (
            <div key={item.id} className="row chk" style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 8px", borderRadius: 8, minHeight: 44, opacity: ignorada ? 0.45 : 1 }}>
              <input type="checkbox" checked={concluida} disabled={!podeEditar || ignorada || ocupado === item.id}
                onChange={() => alternar(item)}
                style={{ marginTop: 2, accentColor: T.gold, width: 20, height: 20, flexShrink: 0, cursor: podeEditar ? "pointer" : "default" }} />
              <span style={{ flex: 1 }}>
                <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <SubjDot disciplina={trilha.porCodigo[at.disciplina_codigo]} />
                  <Tag p={at.prioridade} />
                  <Estrelas p={at.prioridade} />
                  {ignorada && <span style={{ fontSize: 10, color: T.sub, border: `1px solid ${T.line}`, borderRadius: 5, padding: "1px 6px" }}>IGNORADA</span>}
                </span>
                <span style={{ display: "block", fontSize: 13.5, color: concluida || ignorada ? T.sub : T.ink, textDecoration: concluida ? "line-through" : "none", marginTop: 2 }}>
                  {at.texto}
                </span>
              </span>
              {podeEditar && (
                <button onClick={() => ignorar(item)} title={ignorada ? "Voltar para pendente" : "Ignorar esta atividade"}
                  style={{ background: "transparent", border: `1px solid ${T.line}`, color: T.sub, borderRadius: 6, fontSize: 11, padding: "4px 8px", flexShrink: 0 }}>
                  {ignorada ? "retomar" : "ignorar"}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <Erro>{erro}</Erro>
    </Card>
  );
}
