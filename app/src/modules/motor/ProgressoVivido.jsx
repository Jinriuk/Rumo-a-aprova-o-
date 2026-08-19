/* ============================================================
   PROGRESSO VIVIDO (PED1) — feedback e leitura do que o MOTOR
   concedeu de verdade no banco. Nada aqui calcula XP: só LÊ o que
   foi persistido (ledger de XP, missões fechadas, conquistas) e dá
   ao aluno o retorno no momento da ação.
   ============================================================ */
import React, { useEffect, useRef } from "react";
import { SectionCard, StatusBadge, BarraXP, Erro } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { resumoRegistroConfirmado } from "./jornada.js";

const tempoConfirmado = (minutos) => {
  if (minutos == null) return null;
  if (minutos < 60) return `${minutos} min`;
  const resto = minutos % 60;
  return `${Math.floor(minutos / 60)}h${resto ? String(resto).padStart(2, "0") : ""}`;
};

/* Primeira camada da confirmação: usa exclusivamente a linha devolvida
   pelo insert. XP, missão e conquista não aparecem aqui — pertencem à
   ilha abaixo, que só nasce quando a recarga lê o ledger do servidor. */
export function ConfirmacaoRegistro({
  confirmacao, trilha, aoVerMissao, aoRegistrarOutro,
  aoConcluirObjetivo, objetivoConcluido = false, concluindoObjetivo = false, erroObjetivo = null,
}) {
  // O formulário que tinha o foco acabou de sair da árvore. Sem trazer o
  // foco para cá, o teclado volta ao <body> e o aluno perde o lugar.
  const tituloRef = useRef(null);
  useEffect(() => { tituloRef.current?.focus(); }, []);

  if (!confirmacao?.registro) return null;
  const resumo = resumoRegistroConfirmado(confirmacao.registro, trilha?.porCodigo);
  const tempo = tempoConfirmado(resumo.minutos);
  // Registrar estudo NÃO fecha o objetivo: quem decide isso é o aluno.
  const podeFecharObjetivo = !!aoConcluirObjetivo && !!confirmacao.contexto?.metaAtividadeId;

  return (
    <section className="journey-confirmation" role="status" aria-live="polite" aria-labelledby="registro-confirmado-titulo">
      <div className="journey-confirmation-orbit" aria-hidden="true">
        <span>✓</span>
      </div>
      <div className="journey-confirmation-kicker">Registro confirmado</div>
      <h2 id="registro-confirmado-titulo" className="disp" ref={tituloRef} tabIndex={-1}>Seu estudo entrou no radar.</h2>
      <p>
        {confirmacao.contexto?.titulo
          ? <>Você avançou em <strong>{confirmacao.contexto.titulo}</strong>.</>
          : <>A atividade já está salva no seu histórico.</>}
      </p>

      <div className="journey-confirmation-facts" aria-label="Dados gravados">
        <span><small>Matéria</small><strong>{resumo.materia}</strong></span>
        <span><small>Questões</small><strong>{resumo.questoes}</strong></span>
        {resumo.acuracia != null && <span><small>Acerto</small><strong>{resumo.acuracia}%</strong></span>}
        {tempo && <span><small>Tempo</small><strong>{tempo}</strong></span>}
      </div>

      <div className="journey-confirmation-engine">
        <span aria-hidden="true" />
        XP e missões aparecem separadamente quando forem confirmados no seu progresso.
      </div>

      {/* Fechar o objetivo é o passo que move a missão de verdade — e é
          uma decisão do aluno, nunca um efeito automático do registro.
          O estado só vira "concluído" depois que o banco devolve a linha. */}
      {podeFecharObjetivo && (
        <div className="journey-confirmation-objective">
          {objetivoConcluido ? (
            <p className="journey-objective-done">
              <span aria-hidden="true">✓</span> Objetivo concluído. A missão avançou.
            </p>
          ) : (
            <>
              <p>Este registro entrou no seu histórico. O objetivo continua em aberto até você fechá-lo.</p>
              <button className="journey-confirmation-objective-action"
                onClick={aoConcluirObjetivo} disabled={concluindoObjetivo}>
                {concluindoObjetivo ? "Concluindo…" : "Concluir este objetivo"}
              </button>
            </>
          )}
          {erroObjetivo && <div className="journey-confirmation-objective-error"><Erro>{erroObjetivo}</Erro></div>}
        </div>
      )}

      <div className="journey-confirmation-actions">
        <button className="journey-confirmation-primary" onClick={aoVerMissao}>
          Voltar para a missão <span aria-hidden="true">→</span>
        </button>
        <button className="journey-confirmation-secondary" onClick={aoRegistrarOutro}>
          Registrar outro estudo
        </button>
      </div>
    </section>
  );
}

/* Toast de retorno imediato: aparece quando uma recarga revela que o
   banco concedeu algo (XP, missão fechada, conquista). É honesto — só
   celebra o que o motor de fato gravou. Some sozinho. */
export function FeedbackProgresso({ feedback, aoFechar }) {
  const T = useTema();
  if (!feedback) return null;
  const partes = [];
  if (feedback.xp > 0) partes.push(`+${feedback.xp} XP`);
  if (feedback.missoes > 0) partes.push(`${feedback.missoes} ${feedback.missoes === 1 ? "missão concluída" : "missões concluídas"}`);
  if (feedback.conquistas > 0) partes.push(`${feedback.conquistas} ${feedback.conquistas === 1 ? "conquista desbloqueada" : "conquistas desbloqueadas"}`);
  if (!partes.length) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ "--reward-accent": T.gold }}
      className="fade reward-island"
    >
      <span className="reward-island-signal" aria-hidden="true">★</span>
      <span><small>Progresso confirmado</small>{partes.join(" · ")}</span>
      <button className="reward-island-close" onClick={aoFechar} aria-label="Fechar confirmação de progresso">×</button>
    </div>
  );
}

const ROTULO_MATERIA = { mat: "Matemática", por: "Português", ing: "Inglês", fis: "Física", qui: "Química", bio: "Biologia", his: "História", geo: "Geografia", red: "Redação", soc: "Estudos Sociais" };

/* Lista das missões do aluno COMO O BANCO as vê: fechadas com check,
   em andamento com a barra de volume/acurácia. Substitui a leitura de
   "missão é só texto" — agora a missão fecha sozinha e isso aparece.

   EST1-A5: mostra o critério REAL que o motor aplica (meta_questoes +
   meta_acuracia), não o texto aspiracional (achado PEDAGOGIA-04); e
   marca honestamente as missões cuja matéria o aluno não pode registrar
   na própria trilha — em vez de deixá-las travadas em 0% para sempre
   (achado PEDAGOGIA-05, ex.: missão de Biologia numa trilha CN sem
   disciplina de Biologia). `disciplinas` = as disciplinas registráveis
   da trilha do aluno (mesma lista do seletor do Registrar). */
export function MissoesPersistidas({ missoes = [], disciplinas = [] }) {
  const T = useTema();
  if (!missoes.length) return null;
  const registraveis = new Set((disciplinas ?? []).map((d) => d.codigo));
  const podeRegistrar = (cod) => registraveis.size === 0 || !cod || registraveis.has(cod);
  const ordem = { concluida: 0, em_andamento: 1 };
  const lista = [...missoes].sort((a, b) => (ordem[a.estado] ?? 9) - (ordem[b.estado] ?? 9));
  const fechadas = missoes.filter((m) => m.estado === "concluida").length;

  return (
    <SectionCard titulo="Missões" sub={`${fechadas} de ${missoes.length} concluída${fechadas === 1 ? "" : "s"} — fecham sozinhas quando você bate o critério.`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lista.map((mi) => {
          const nome = mi.missoes?.nome ?? "Missão";
          const codMateria = mi.missoes?.materia_codigo;
          const materia = ROTULO_MATERIA[codMateria] ?? codMateria ?? "";
          const fechada = mi.estado === "concluida";
          const pct = mi.acuracia ?? 0;
          // critério REAL do motor (mesmo que fecha a missão): volume + acerto.
          const metaQ = mi.missoes?.meta_questoes ?? null;
          const metaAcc = mi.missoes?.meta_acuracia ?? null;
          const alvo = metaQ != null
            ? `alvo: ${metaQ} questões${metaAcc != null ? ` e ≥${metaAcc}% de acerto` : ""}`
            : "acompanhamento da coordenação (sem fechamento automático)";
          // não fecha sozinha se a matéria não é registrável na trilha do aluno.
          const inalcancavel = !fechada && metaQ != null && !podeRegistrar(codMateria);
          return (
            <div key={mi.id} style={{ background: T.card, border: `1px solid ${fechada ? T.green : T.line}`, borderRadius: 10, padding: "11px 13px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>{nome}</span>
                {materia && <span style={{ fontSize: 11, color: T.sub }}>· {materia}</span>}
                <span style={{ marginLeft: "auto" }}>
                  <StatusBadge tom={fechada ? "ok" : inalcancavel ? "neutro" : "alerta"}>
                    {fechada ? "✓ Concluída" : inalcancavel ? "Com a coordenação" : "Em andamento"}
                  </StatusBadge>
                </span>
              </div>
              {fechada ? (
                <div style={{ fontSize: 11.5, color: T.green, marginTop: 6, fontWeight: 600 }}>
                  +{mi.xp_concedido} XP concedidos · {mi.questoes_acumuladas} questões{mi.acuracia != null ? ` · ${mi.acuracia}% de acerto` : ""}
                </div>
              ) : inalcancavel ? (
                <div style={{ fontSize: 11.5, color: T.sub, marginTop: 6, lineHeight: 1.5 }}>
                  {materia} não está entre as matérias que você registra nesta trilha — esta missão é
                  acompanhada com a coordenação, não fecha sozinha pelo seu registro de estudo.
                </div>
              ) : (
                <div style={{ marginTop: 8 }}>
                  <BarraXP pct={Math.min(100, pct)} alt={5} brilho={false} />
                  <div style={{ fontSize: 11, color: T.sub, marginTop: 4 }}>
                    {mi.questoes_acumuladas}{metaQ != null ? `/${metaQ}` : ""} questões{mi.acuracia != null ? ` · ${mi.acuracia}% de acerto` : " · registre acertos para medir o domínio"} · {alvo}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
