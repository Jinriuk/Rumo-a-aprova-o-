/* As tarefas da semana (antes "Objetivos da semana"): título em destaque;
   disciplina, prioridade e XP como info secundária; ação principal
   CONCLUIR e secundária ADIAR. Um único selo de prioridade, sem estrelas
   concorrendo. Quem GERA a meta é o servidor; aqui o aluno só marca. */
import React, { useState } from "react";
import { Erro, StatusBadge } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { L, PRIORIDADE, xpPorPrioridade, questoesSugeridas } from "./jargao.js";
import { contextoRegistroDaAtividade, textoDaTarefa } from "./jornada.js";
import { mensagemAmigavel } from "../../shared/lib/erros.js";
import * as db from "../../shared/data/index.js";

/* Raio-x fase 2, PR 3 (decisões de 18/10): as tarefas moram dentro do
   bloco de cada semana no Plano. Pendentes e adiadas à vista; concluídas
   recolhidas em "X concluídas". `meta` é a meta daquela semana; semana que
   ainda não começou não tem meta, e a lista mostra o previsto
   (`atividades` da trilha), sem estado. Só a semana atual edita. */
export function TarefasDaSemana({ meta = null, atividades = [], trilha, podeEditar = false, aoMudar, aoPraticar }) {
  const T = useTema();
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [verFeitas, setVerFeitas] = useState(false);

  const itens = (meta
    ? (meta.meta_atividades ?? []).map((ma) => ({ ...ma, atividade: trilha.atividadesPorId[ma.atividade_modelo_id] }))
    : atividades.map((at) => ({ id: at.id, estado: null, atividade: at })))
    .filter((x) => x.atividade)
    .sort((a, b) => (a.atividade.ordem ?? 0) - (b.atividade.ordem ?? 0));
  const abertas = itens.filter((x) => x.estado !== "concluida");
  const feitas = itens.filter((x) => x.estado === "concluida");

  if (!itens.length) {
    return <div style={{ fontSize: 12.5, color: T.sub, padding: "6px 0" }}>Nenhuma tarefa nesta semana.</div>;
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
  const linha = (item, ultimo) => (
    <ObjetivoItem key={item.id} item={item} trilha={trilha} podeEditar={podeEditar}
      ocupado={ocupado === item.id} ultimo={ultimo}
      aoPraticar={aoPraticar ? () => aoPraticar(contextoRegistroDaAtividade(item, trilha)) : undefined}
      aoConcluir={() => mudar(item, item.estado === "concluida" ? "pendente" : "concluida")}
      aoAdiar={() => mudar(item, item.estado === "ignorada" ? "pendente" : "ignorada")} />
  );

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {abertas.map((item, i) => linha(item, i === abertas.length - 1 && !feitas.length))}
      {!abertas.length && (
        <div style={{ fontSize: 13, color: T.green, fontWeight: 600, padding: "10px 14px" }}>
          ✓ Todas as tarefas desta semana estão concluídas.
        </div>
      )}
      {feitas.length > 0 && (
        <div className="objective-list-more">
          <button type="button" aria-expanded={verFeitas} onClick={() => setVerFeitas((v) => !v)}>
            {verFeitas ? "Ocultar concluídas" : `${feitas.length} ${feitas.length === 1 ? "concluída" : "concluídas"}`}
            <span aria-hidden="true"> {verFeitas ? "↑" : "↓"}</span>
          </button>
        </div>
      )}
      {verFeitas && feitas.map((item, i) => linha(item, i === feitas.length - 1))}
      {erro && <div style={{ padding: "0 14px 12px" }}><Erro>{erro}</Erro></div>}
    </div>
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
            {textoDaTarefa(at.texto)}
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
              {/* T4: a hierarquia era invertida — "Praticar agora" (só
                  navega, não muda estado) tinha o peso visual sólido, e
                  "Concluir" (a ação que de fato grava progresso, via
                  aoConcluir → definirEstadoAtividade) era o texto apagado.
                  Concluir vira a ação com peso; Praticar agora vira
                  contorno. "Reabrir" mantém o registro discreto de
                  .objective-secondary — desfazer não precisa de destaque. */}
              {!concluida && !adiada && aoPraticar && (
                <button type="button" className="objective-practice" onClick={aoPraticar} disabled={ocupado}>
                  Registrar estudo <span aria-hidden="true">→</span>
                </button>
              )}
              <button type="button" className={concluida ? "objective-secondary" : "objective-confirm"} onClick={aoConcluir} disabled={ocupado}>
                {concluida ? "↺ Reabrir" : `✓ ${L.concluir}`}
              </button>
              {!concluida && (
                <button type="button" className="objective-secondary" onClick={aoAdiar} disabled={ocupado}>
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
