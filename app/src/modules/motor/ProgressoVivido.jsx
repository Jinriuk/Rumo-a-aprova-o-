/* ============================================================
   PROGRESSO VIVIDO (PED1) — feedback e leitura do que o MOTOR
   concedeu de verdade no banco. Nada aqui calcula XP: só LÊ o que
   foi persistido (ledger de XP, missões fechadas, conquistas) e dá
   ao aluno o retorno no momento da ação.
   ============================================================ */
import React, { useEffect, useRef } from "react";
import { SectionCard, StatusBadge, BarraXP, Erro } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { resumoRegistroConfirmado, contextoRegistroDaMissao } from "./jornada.js";
import { podeResolverAqui } from "./questoesIntegradas.js";

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
              <button type="button" className="journey-confirmation-objective-action"
                onClick={aoConcluirObjetivo} disabled={concluindoObjetivo}>
                {concluindoObjetivo ? "Concluindo…" : "Concluir este objetivo"}
              </button>
            </>
          )}
          {erroObjetivo && <div className="journey-confirmation-objective-error"><Erro>{erroObjetivo}</Erro></div>}
        </div>
      )}

      <div className="journey-confirmation-actions">
        <button type="button" className="journey-confirmation-primary" onClick={aoVerMissao}>
          Voltar para a missão <span aria-hidden="true">→</span>
        </button>
        <button type="button" className="journey-confirmation-secondary" onClick={aoRegistrarOutro}>
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
  /* Missão do motor e objetivo da trilha são concessões DIFERENTES do
     ledger (`origem` = motor_missao vs meta_atividades) e cada uma vale
     o próprio XP. Somar as duas em "2 missões" mentiria sobre o que o
     banco fez; por isso cada origem é nomeada pelo que ela é. */
  const partes = [];
  if (feedback.missoes > 0) partes.push(`${feedback.missoes} ${feedback.missoes === 1 ? "missão cumprida" : "missões cumpridas"}`);
  if (feedback.objetivos > 0) partes.push(`${feedback.objetivos} ${feedback.objetivos === 1 ? "objetivo concluído" : "objetivos concluídos"}`);
  if (feedback.conquistas > 0) partes.push(`${feedback.conquistas} ${feedback.conquistas === 1 ? "conquista desbloqueada" : "conquistas desbloqueadas"}`);
  if (feedback.xp > 0) partes.push(`+${feedback.xp} XP`);
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
      <button type="button" className="reward-island-close" onClick={aoFechar} aria-label="Fechar confirmação de progresso">×</button>
    </div>
  );
}

const ROTULO_MATERIA = { mat: "Matemática", por: "Português", ing: "Inglês", fis: "Física", qui: "Química", bio: "Biologia", his: "História", geo: "Geografia", red: "Redação", soc: "Estudos Sociais" };

/* Fila de missões do aluno, por matéria, como o motor da 0061 a vê:
   concluídas, a atual e as próximas ("a seguir"), na ordem do catálogo.
   Uma missão por vez em cada matéria; cada registro conta para uma só, e
   só registros com acertos informados contam (o Registrar avisa).
   P0.4 (0064): só conta a prática registrada pelo botão da missão
   ("Praticar esta missão"); registro livre soma volume e não fecha
   missão; "Registrar revisão" liga ao assunto de uma missão já feita.

   EST1-A5 segue valendo: o alvo mostrado é o critério REAL que fecha a
   missão (meta da escola, senão a do catálogo, + acurácia), não o texto
   aspiracional; e a matéria que o aluno não registra na própria trilha
   aparece marcada, em vez de travada em 0% para sempre.
   `fila` = filaDeMissoes() (modules/conteudo/missoes.js);
   `disciplinas` = as registráveis da trilha (mesma lista do Registrar).
   `compacta` (modo essencial): só a missão da vez de cada matéria, com o
   botão. Desde a 0064 o botão é o único caminho que avança missão, então
   o modo essencial não pode escondê-lo junto com o resto do painel.
   P1.1: `questoesIntegradas` (Set de ids que o servidor ligou) e
   `aoResolver(missao, tipo)` acrescentam "Resolver questões aqui"; sem
   eles, o painel é o mesmo de antes. */
export function MissoesPersistidas({ fila = [], disciplinas = [], aoPraticar, compacta = false, questoesIntegradas = null, aoResolver }) {
  const T = useTema();
  const registraveis = new Set((disciplinas ?? []).map((d) => d.codigo));
  const podeRegistrar = (cod) => registraveis.size === 0 || !cod || registraveis.has(cod);
  const todasDaFila = fila.flatMap((g) => g.missoes);
  const grupos = !compacta ? fila : fila
    .map((g) => ({ ...g, missoes: podeRegistrar(g.materia_codigo) ? g.missoes.filter((mi) => mi.estado === "atual" || mi.proxima).slice(0, 1) : [] }))
    .filter((g) => g.missoes.length > 0);
  const todas = grupos.flatMap((g) => g.missoes);
  if (!todas.length) return null;
  const fechadas = todasDaFila.filter((m) => m.estado === "concluida").length;
  const ROTULO_ESTADO = { concluida: "✓ Concluída", atual: "Atual", a_seguir: "A seguir" };
  const TOM_ESTADO = { concluida: "ok", atual: "alerta", a_seguir: "neutro" };

  return (
    <SectionCard titulo={compacta ? "Missão da vez" : "Missões"}
      sub={compacta
        ? "Conta para a missão só a prática registrada pelo botão dela."
        : `${fechadas} de ${todasDaFila.length} concluída${fechadas === 1 ? "" : "s"} — uma por vez em cada matéria; contam as práticas que você registra pelo botão da missão.`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {grupos.map(({ materia_codigo: cod, missoes }) => {
          const materia = ROTULO_MATERIA[cod] ?? cod ?? "";
          const inalcancavel = !podeRegistrar(cod);
          return (
            <div key={cod}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>{materia}</div>
              {inalcancavel && (
                <div style={{ fontSize: 11.5, color: T.sub, marginBottom: 6, lineHeight: 1.5 }}>
                  {materia} não está entre as matérias que você registra nesta trilha — estas missões são
                  acompanhadas com a coordenação, não fecham sozinhas pelo seu registro de estudo.
                </div>
              )}
              <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {missoes.map((mi) => {
                  const alvo = `alvo: ${mi.meta_questoes} questões${mi.meta_acuracia != null ? ` e ≥${mi.meta_acuracia}% de acerto` : ""}`;
                  // matéria fora da trilha: o aluno não registra, então não há
                  // "atual" nem "começa no próximo registro" (EST1-A5)
                  const coordenacao = inalcancavel && mi.estado !== "concluida";
                  const borda = mi.estado === "concluida" ? T.green : mi.estado === "atual" && !coordenacao ? T.gold : T.line;
                  return (
                    <li key={mi.id} data-estado={coordenacao ? "coordenacao" : mi.estado}
                      style={{ background: T.card, border: `1px solid ${borda}`, borderRadius: 10, padding: "11px 13px", opacity: mi.estado === "a_seguir" || coordenacao ? 0.75 : 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{mi.nome}</span>
                        <span style={{ marginLeft: "auto" }}>
                          <StatusBadge tom={coordenacao ? "neutro" : TOM_ESTADO[mi.estado]}>{coordenacao ? "Com a coordenação" : ROTULO_ESTADO[mi.estado]}</StatusBadge>
                        </span>
                      </div>
                      {mi.estado === "concluida" ? (
                        <div style={{ fontSize: 11.5, color: T.green, marginTop: 6, fontWeight: 600 }}>
                          +{mi.xp_concedido} XP concedidos · {mi.questoes} questões{mi.acuracia != null ? ` · ${mi.acuracia}% de acerto` : ""}
                        </div>
                      ) : coordenacao ? (
                        <div style={{ fontSize: 11, color: T.sub, marginTop: 4 }}>
                          {alvo} · +{mi.xp} XP
                        </div>
                      ) : mi.estado === "atual" ? (
                        <div style={{ marginTop: 8 }}>
                          {/* fecha com volume E acurácia: a barra é o menor dos dois */}
                          <BarraXP pct={mi.pct} alt={5} brilho={false} />
                          <div style={{ fontSize: 11, color: T.sub, marginTop: 4 }}>
                            {mi.questoes}/{mi.meta_questoes} questões{mi.acuracia != null ? ` · ${mi.acuracia}% de acerto` : ""} · {mi.volume_batido && mi.falta_acerto ? `volume batido; falta chegar a ≥${mi.meta_acuracia}% de acerto` : alvo}
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: T.sub, marginTop: 4 }}>
                          {mi.proxima ? "começa na sua próxima prática desta missão com acertos" : "começa depois da anterior"} · {alvo} · +{mi.xp} XP
                        </div>
                      )}
                      {/* P0.4 (0064): registrar a partir da missão é o que a liga
                          ao assunto dela. Praticar: a atual ou a próxima a começar.
                          Revisar: as que já começaram ou fecharam. */}
                      {aoPraticar && !coordenacao && (mi.estado === "atual" || mi.proxima) && (
                        <button type="button" className="journey-use-suggestion" style={{ marginTop: 8 }}
                          onClick={() => aoPraticar(contextoRegistroDaMissao(mi, "missao"))}>
                          Praticar esta missão
                        </button>
                      )}
                      {aoPraticar && !inalcancavel && mi.estado === "concluida" && (
                        <button type="button" className="journey-use-suggestion" style={{ marginTop: 8 }}
                          onClick={() => aoPraticar(contextoRegistroDaMissao(mi, "revisao"))}>
                          Registrar revisão
                        </button>
                      )}
                      {aoResolver && !coordenacao && !inalcancavel && podeResolverAqui(mi, questoesIntegradas) && (
                        <button type="button" className="journey-use-suggestion" style={{ marginTop: 8, marginLeft: 8 }}
                          onClick={() => aoResolver(mi, mi.estado === "concluida" ? "revisao" : "missao")}>
                          {mi.estado === "concluida" ? "Revisar com questões" : "Resolver questões aqui"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
