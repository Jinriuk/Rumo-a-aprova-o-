/* "Objetivos da semana" — a lista de atividades da missão, redesenhada
   (ref. designs): título em destaque; disciplina, prioridade e XP como
   info secundária; ação principal CONCLUIR e secundária ADIAR. Menos
   poluição: um único selo de prioridade, sem estrelas concorrendo.
   Quem GERA a meta é o servidor; aqui o aluno só marca. */
import React, { useState } from "react";
import { SectionCard, EmptyState, Erro, StatusBadge } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { L, PRIORIDADE, xpPorPrioridade, questoesSugeridas } from "./jargao.js";
import * as db from "../../shared/data/index.js";

export function MetaSemana({ meta, trilha, podeEditar, aoMudar }) {
  const T = useTema();
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(null);

  if (!meta) {
    return (
      <SectionCard titulo={L.objetivos}>
        <EmptyState icone="⚓" titulo="Nenhum objetivo ainda" dica="A missão da semana é gerada no servidor. Ela aparece aqui automaticamente." />
      </SectionCard>
    );
  }

  const itens = (meta.meta_atividades ?? [])
    .map((ma) => ({ ...ma, atividade: trilha.atividadesPorId[ma.atividade_modelo_id] }))
    .filter((x) => x.atividade)
    .sort((a, b) => {
      // pendentes primeiro, cumpridos no fim, adiados antes dos cumpridos
      const ordem = { pendente: 0, ignorada: 1, concluida: 2 };
      return (ordem[a.estado] - ordem[b.estado]) || (a.atividade.ordem - b.atividade.ordem);
    });

  const feitas = itens.filter((x) => x.estado === "concluida").length;
  const consideradas = itens.filter((x) => x.estado !== "ignorada").length;

  async function mudar(item, novo) {
    if (!podeEditar || ocupado) return;
    setOcupado(item.id); setErro(null);
    try {
      await db.definirEstadoAtividade(item.id, novo);
      aoMudar?.();
    } catch (e) { setErro(e.message); }
    setOcupado(null);
  }

  return (
    <SectionCard titulo={L.objetivos} sub={`${feitas} de ${consideradas} concluídos`} semPadding>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {itens.map((item, i) => (
          <ObjetivoItem key={item.id} item={item} trilha={trilha} podeEditar={podeEditar}
            ocupado={ocupado === item.id} ultimo={i === itens.length - 1}
            aoConcluir={() => mudar(item, item.estado === "concluida" ? "pendente" : "concluida")}
            aoAdiar={() => mudar(item, item.estado === "ignorada" ? "pendente" : "ignorada")} />
        ))}
      </div>
      {erro && <div style={{ padding: "0 14px 12px" }}><Erro>{erro}</Erro></div>}
    </SectionCard>
  );
}

function ObjetivoItem({ item, trilha, podeEditar, ocupado, ultimo, aoConcluir, aoAdiar }) {
  const T = useTema();
  const at = item.atividade;
  const disc = trilha.porCodigo[at.disciplina_codigo];
  const concluida = item.estado === "concluida";
  const adiada = item.estado === "ignorada";
  const pri = PRIORIDADE[at.prioridade] ?? PRIORIDADE.X;
  const xp = xpPorPrioridade[at.prioridade] ?? 40;

  return (
    <div style={{ padding: "13px 14px", borderBottom: ultimo ? "none" : `1px solid ${T.line}`, opacity: adiada ? 0.5 : 1, background: concluida ? `${T.green}0c` : "transparent" }}>
      <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
        <div style={{ flexShrink: 0, marginTop: 1, width: 22, height: 22, borderRadius: "50%", border: `2px solid ${concluida ? T.green : adiada ? T.line : T.gold}`, background: concluida ? T.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#0A1622", fontWeight: 800 }}>
          {concluida ? "✓" : ""}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: concluida ? T.sub : T.ink, textDecoration: concluida ? "line-through" : "none", lineHeight: 1.3 }}>
            {at.texto}
          </div>
          <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
            {disc && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: T.sub }}>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: disc.cor }} />{disc.nome}
              </span>
            )}
            {concluida ? <StatusBadge tom="ok">Cumprido</StatusBadge> : <StatusBadge tom={pri.tom}>{pri.texto}</StatusBadge>}
            <span style={{ fontSize: 11, fontWeight: 800, color: concluida ? T.green : T.gold }}>+{xp} XP</span>
            {!concluida && !adiada && (
              <span title="Sugestão de prática: resolva e registre na aba Registrar"
                style={{ fontSize: 11, fontWeight: 700, color: T.sub, border: `1px solid ${T.line}`, borderRadius: 6, padding: "1px 7px" }}>
                ✦ ≈{questoesSugeridas[at.prioridade] ?? 10} questões
              </span>
            )}
          </div>

          {podeEditar && (
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button onClick={aoConcluir} disabled={ocupado}
                style={{ border: "none", background: concluida ? "transparent" : T.gold, color: concluida ? T.sub : "#0A1622", borderRadius: 8, fontWeight: 800, fontSize: 13, padding: concluida ? "8px 0" : "9px 18px", minHeight: 38 }}>
                {concluida ? "↺ Reabrir" : `✓ ${L.concluir}`}
              </button>
              {!concluida && (
                <button onClick={aoAdiar} disabled={ocupado}
                  style={{ border: `1px solid ${T.line}`, background: "transparent", color: T.sub, borderRadius: 8, fontWeight: 600, fontSize: 13, padding: "9px 16px", minHeight: 38 }}>
                  {adiada ? "Retomar" : L.adiar}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
