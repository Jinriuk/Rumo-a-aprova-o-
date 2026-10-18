/* Hoje com uma ação (raio-x fase 2, mudanças 2 e 3; decisões de 18/10).
   O topo do Hoje deixa de ser a semana ("Missão 1 · alvo atual") e passa a
   ser a missão da vez: matéria, assunto e "X de N questões", com UM botão.
     - missão com questões ligadas → "Resolver questões" (abre a sessão);
     - sem questões → "Registrar estudo", já preenchido com a missão;
     - sem missão → a primeira tarefa pendente, pelo registro;
     - nada pendente → registro livre.
   Quem escolhe a missão é acaoDaVez (jornada.js). A semana vira uma linha
   ("Semana 1 de 12 · 2 de 3 tarefas") que abre o Plano, onde ficam as
   tarefas com Concluir/Adiar. */
import React from "react";
import { BarraXP } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { questoesSugeridas } from "./jargao.js";
import { nomeDaMateria, contextoRegistroDaMissao, contextoRegistroDaAtividade, tituloDaTarefa } from "./jornada.js";
import { destinoDoInicio } from "./questoesIntegradas.js";

export function MissaoDaVez({ acao, trilha, nomesMateria, questoesIntegradas, aoResolver, aoRegistrar }) {
  const T = useTema();
  let materia, titulo, detalhe = null, pct = null, destino = "registro", contexto = null;

  if (acao.tipo === "missao") {
    const mi = acao.missao;
    materia = nomeDaMateria(mi.materia_codigo, nomesMateria);
    titulo = mi.nome;
    detalhe = mi.meta_questoes ? `${mi.questoes} de ${mi.meta_questoes} questões` : `${mi.questoes} questões`;
    if (mi.volume_batido && mi.falta_acerto) detalhe += ` · falta chegar a ${mi.meta_acuracia}% de acerto`;
    pct = mi.pct;
    destino = destinoDoInicio(mi, questoesIntegradas, { podeResolver: !!aoResolver });
    contexto = contextoRegistroDaMissao(mi, "missao");
  } else if (acao.tipo === "carregando") {
    // catálogo e progresso das missões ainda a caminho: não decide nada
    materia = null;
    titulo = "Buscando a sua missão…";
    destino = "carregando";
  } else if (acao.tipo === "tarefa") {
    materia = trilha.porCodigo[acao.atividade.disciplina_codigo]?.nome ?? nomeDaMateria(acao.atividade.disciplina_codigo, nomesMateria);
    titulo = tituloDaTarefa(acao.atividade.texto);
    detalhe = `cerca de ${questoesSugeridas[acao.atividade.prioridade] ?? 10} questões`;
    contexto = contextoRegistroDaAtividade(acao.tarefa, trilha);
  } else {
    materia = null;
    titulo = "As tarefas desta semana estão em dia";
    detalhe = "Se estudou mais alguma coisa, registre: entra no seu histórico.";
  }

  const carregando = destino === "carregando";
  const acionar = () => {
    if (destino === "questoes") aoResolver(acao.missao);
    else if (destino === "registro") aoRegistrar(contexto);
  };
  const rotulo = carregando ? "Carregando…" : destino === "questoes" ? "Resolver questões" : "Registrar estudo";

  return (
    <section aria-label="Sua missão agora" className="mission-card"
      style={{ "--mission-accent": T.gold, background: `linear-gradient(160deg, ${T.cardHi}, ${T.card})`, border: `1.5px solid ${T.gold}66`, borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: 11, color: T.gold, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {acao.tipo === "missao" || acao.tipo === "carregando" ? "Sua missão agora" : acao.tipo === "tarefa" ? "Sua próxima tarefa" : "Semana em dia"}
        {materia && <span style={{ color: T.sub }}> · {materia}</span>}
      </div>
      <h2 className="disp" style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.25, margin: "6px 0 0" }}>{titulo}</h2>
      {pct != null && <div style={{ marginTop: 12 }}><BarraXP pct={pct} alt={8} brilho={false} /></div>}
      {detalhe && <div className="num" style={{ fontSize: 12.5, color: T.sub, marginTop: 6 }}>{detalhe}</div>}
      {aoRegistrar && (
        <button type="button" className="mission-primary-action" onClick={acionar}
          disabled={carregando} aria-busy={carregando || undefined}
          style={{ display: "block", width: "100%", marginTop: 14, background: T.gold, color: "#0A1622", border: `1.5px solid ${T.gold}`, borderRadius: 9, padding: "12px 16px", fontWeight: 700, fontSize: 14, cursor: carregando ? "progress" : "pointer", opacity: carregando ? 0.7 : 1 }}>
          {rotulo}
        </button>
      )}
    </section>
  );
}

// A semana em uma linha; tocar abre o Plano (as tarefas e o Concluir moram lá).
export function LinhaDaSemana({ resumo, aoAbrir }) {
  const T = useTema();
  if (!resumo) return null;
  return (
    <button type="button" onClick={aoAbrir}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", minHeight: 44,
               background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "10px 14px", color: T.ink,
               fontSize: 13.5, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
      <span className="num">{resumo.texto}</span>
      <span aria-hidden="true" style={{ color: T.sub }}>›</span>
    </button>
  );
}
