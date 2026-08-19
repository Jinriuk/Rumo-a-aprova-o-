/* "Objetivos da semana" — a lista de atividades da missão, redesenhada
   (ref. designs): título em destaque; disciplina, prioridade e XP como
   info secundária; ação principal CONCLUIR e secundária ADIAR. Menos
   poluição: um único selo de prioridade, sem estrelas concorrendo.
   Quem GERA a meta é o servidor; aqui o aluno só marca. */
import React, { useState } from "react";
import { SectionCard, EmptyState, Erro, StatusBadge } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { L, PRIORIDADE, xpPorPrioridade, questoesSugeridas } from "./jargao.js";
import { contextoRegistroDaAtividade } from "./jornada.js";
import { mensagemAmigavel } from "../../shared/lib/erros.js";
import * as db from "../../shared/data/index.js";

export function MetaSemana({ meta, trilha, podeEditar, aoMudar, aoAbrirDesempenho, aoPraticar, compacta = false }) {
  const T = useTema();
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [mostrarTodos, setMostrarTodos] = useState(false);

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

  // Semana 100% concluída: mostrar card de parabenização com próximos passos
  if (podeEditar && consideradas > 0 && feitas >= consideradas) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ background: `linear-gradient(135deg, ${T.green}22, ${T.card})`, border: `1.5px solid ${T.green}66`, borderRadius: 14, padding: "16px" }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>🎯</div>
          <div className="disp" style={{ fontSize: 16, fontWeight: 800, color: T.green }}>Semana concluída!</div>
          <div style={{ fontSize: 13, color: T.sub, marginTop: 5, lineHeight: 1.5 }}>
            Você cumpriu todos os {feitas} objetivos desta semana. Ótimo trabalho!
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            {aoAbrirDesempenho && (
              <button onClick={aoAbrirDesempenho}
                style={{ border: `1px solid ${T.gold}`, background: `${T.gold}14`, color: T.gold, borderRadius: 9, fontWeight: 700, fontSize: 13, padding: "10px 16px", minHeight: 42 }}>
                Ver meu desempenho
              </button>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: T.sub, marginTop: 12, lineHeight: 1.4, borderTop: `1px solid ${T.line}`, paddingTop: 10 }}>
            💡 <b>Próximos passos sugeridos:</b> revise matérias com acerto abaixo de 60%, faça questões extras ou aguarde a próxima semana começar.
          </div>
        </div>
        {/* ainda mostra a lista completa abaixo do card, para referência */}
        <SectionCard titulo={L.objetivos} sub={`${feitas} de ${consideradas} concluídos`} semPadding>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {itens.map((item, i) => (
              <ObjetivoItem key={item.id} item={item} trilha={trilha} podeEditar={false}
                ocupado={false} ultimo={i === itens.length - 1}
                aoConcluir={() => {}} aoAdiar={() => {}} aoPraticar={() => {}} />
            ))}
          </div>
        </SectionCard>
      </div>
    );
  }

  async function mudar(item, novo) {
    if (!podeEditar || ocupado) return;
    setOcupado(item.id); setErro(null);
    try {
      await db.definirEstadoAtividade(item.id, novo);
      aoMudar?.();
    } catch (e) { setErro(mensagemAmigavel(e, "acao")); }
    setOcupado(null);
  }

  const limite = compacta && !mostrarTodos ? 3 : null;
  const praticaveis = itens.filter((item) => item.estado === "pendente");
  const visiveis = limite == null ? itens : praticaveis.slice(0, limite);
  const ocultos = Math.max(0, itens.length - visiveis.length);

  return (
    <SectionCard titulo={L.objetivos} sub={`${feitas} de ${consideradas} concluídos`} semPadding>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {visiveis.map((item, i) => (
          <ObjetivoItem key={item.id} item={item} trilha={trilha} podeEditar={podeEditar}
            ocupado={ocupado === item.id} ultimo={i === visiveis.length - 1 && ocultos === 0}
            aoPraticar={() => aoPraticar?.(contextoRegistroDaAtividade(item, trilha))}
            aoConcluir={() => mudar(item, item.estado === "concluida" ? "pendente" : "concluida")}
            aoAdiar={() => mudar(item, item.estado === "ignorada" ? "pendente" : "ignorada")} />
        ))}
      </div>
      {ocultos > 0 && (
        <div className="objective-list-more">
          <button onClick={() => setMostrarTodos(true)}>
            Ver todos os {itens.length} objetivos <span aria-hidden="true">↓</span>
          </button>
        </div>
      )}
      {erro && <div style={{ padding: "0 14px 12px" }}><Erro>{erro}</Erro></div>}
    </SectionCard>
  );
}

function ObjetivoItem({ item, trilha, podeEditar, ocupado, ultimo, aoPraticar, aoConcluir, aoAdiar }) {
  const T = useTema();
  const at = item.atividade;
  const disc = trilha.porCodigo[at.disciplina_codigo];
  const concluida = item.estado === "concluida";
  const adiada = item.estado === "ignorada";
  const pri = PRIORIDADE[at.prioridade] ?? PRIORIDADE.X;
  const xp = xpPorPrioridade[at.prioridade] ?? 40;

  return (
    <div className="objective-row" data-state={item.estado}
      style={{ padding: "13px 14px", borderBottom: ultimo ? "none" : `1px solid ${T.line}`, opacity: adiada ? 0.5 : 1, background: concluida ? `${T.green}0c` : "transparent" }}>
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
            <div className="objective-actions">
              {!concluida && !adiada && aoPraticar && (
                <button className="objective-practice" onClick={aoPraticar} disabled={ocupado}>
                  Praticar agora <span aria-hidden="true">→</span>
                </button>
              )}
              <button className="objective-secondary" onClick={aoConcluir} disabled={ocupado}>
                {concluida ? "↺ Reabrir" : `✓ ${L.concluir}`}
              </button>
              {!concluida && (
                <button className="objective-secondary" onClick={aoAdiar} disabled={ocupado}>
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
