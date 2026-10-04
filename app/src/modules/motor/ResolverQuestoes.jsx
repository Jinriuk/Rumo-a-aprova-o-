/* P1.1 — resolver questões da missão dentro do app (Quest API).

   O servidor entrega o lote SEM gabarito, corrige cada resposta e grava
   a tentativa uma vez só; o lote vira um registro de estudo que conta
   para a missão pelo caminho da 0064. Esta tela só mostra e envia.

   - pedido_id fixo por abertura: reabrir depois de uma queda de rede
     devolve o mesmo lote, não gasta outro.
   - Reenviar uma resposta é seguro: o servidor devolve a primeira
     correção.
   - Qualquer falha (Quest fora, limite, sem questão) oferece o registro
     manual da mesma missão, que não depende da Quest.
   - Enunciado e alternativas são TEXTO (textoSimples), nunca HTML. */
import { useEffect, useRef, useState } from "react";
import { SectionCard, Botao, StatusBadge } from "../../shared/ui/componentes.jsx";
import { useTema } from "../../shared/branding/BrandingContext.jsx";
import { useEnvioUnico } from "../../shared/hooks/useEnvioUnico.js";
import * as db from "../../shared/data/index.js";
import { mensagemDoEstado, novoPedidoId, textoSimples, origemDaQuestao, resumoDoLote } from "./questoesIntegradas.js";

export function ResolverQuestoes({ missao, tipo = "missao", aoFechar, aoRegistrarManual, aoMudar }) {
  const T = useTema();
  const pedidoRef = useRef(null);
  if (pedidoRef.current === null) pedidoRef.current = novoPedidoId();
  const inicioRef = useRef(0);   // instante em que a questão apareceu (abrir/seguir)
  const mudouRef = useRef(false);
  const [lote, setLote] = useState(null);
  const [falha, setFalha] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [indice, setIndice] = useState(0);
  const [escolha, setEscolha] = useState(null);
  const [fechouMissao, setFechouMissao] = useState(false);
  const { ocupado, enviar } = useEnvioUnico("questões integradas");

  const abrir = () => enviar(async () => {
    setFalha(null);
    setAviso(null);
    try {
      const r = await db.entregarQuestoes({ missaoId: missao.id, pedidoId: pedidoRef.current });
      if (r?.estado !== "ok" || !r.entrega?.questoes?.length) { setFalha(r?.estado ?? "erro"); return; }
      setLote(r.entrega);
      const { proxima } = resumoDoLote(r.entrega.questoes);
      setIndice(proxima >= 0 ? proxima : r.entrega.questoes.length);
      inicioRef.current = Date.now();
    } catch (e) {
      setFalha(e?.estado ?? "erro");
    }
  });

  useEffect(() => { abrir(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fechar = () => { if (mudouRef.current) aoMudar?.(); aoFechar?.(); };
  const manual = () => { if (mudouRef.current) aoMudar?.(); aoRegistrarManual?.(); };

  const questoes = lote?.questoes ?? [];
  const atual = questoes[indice];
  const resumo = resumoDoLote(questoes);

  const atualizarQuestao = (id, campos) =>
    setLote((l) => ({ ...l, questoes: l.questoes.map((q) => (q.id === id ? { ...q, ...campos } : q)) }));

  const responder = () => enviar(async () => {
    if (!atual || !escolha) return;
    setAviso(null);
    try {
      const r = await db.responderQuestao({
        entregaId: lote.id, questaoId: atual.id, resposta: escolha, duracaoMs: Date.now() - inicioRef.current,
      });
      if (r?.estado !== "ok") { setAviso(mensagemDoEstado(r?.estado).texto); return; }
      mudouRef.current = true;
      atualizarQuestao(atual.id, { respondida: true, resposta: r.resposta, acerto: r.acerto, gabarito: r.gabarito });
      if (r.missao_concluida) setFechouMissao(true);
    } catch (e) {
      const estado = e?.estado ?? "erro";
      if (estado === "anulada") { atualizarQuestao(atual.id, { anulada: true }); }
      if (estado === "expirada") { setFalha("expirada"); return; }
      setAviso(mensagemDoEstado(estado).texto);
    }
  });

  const seguir = () => {
    const prox = questoes.findIndex((q, i) => i > indice && !q.respondida && !q.anulada);
    setIndice(prox >= 0 ? prox : questoes.length);
    setEscolha(null);
    setAviso(null);
    inicioRef.current = Date.now();
  };

  const novoLote = () => { pedidoRef.current = novoPedidoId(); setLote(null); abrir(); };

  const titulo = `Questões · ${missao.nome}`;
  const sub = tipo === "revisao"
    ? "Revisão: corrigidas no servidor, ficam no assunto desta missão e não avançam a fila."
    : "Corrigidas no servidor e contadas para esta missão. Não registre estas mesmas questões de novo à mão.";

  if (falha) {
    const m = mensagemDoEstado(falha);
    return (
      <SectionCard titulo={titulo} sub={sub}>
        <div role="status" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{m.texto}</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {falha === "expirada" && <Botao onClick={novoLote} disabled={ocupado}>Abrir novo lote</Botao>}
            {m.manual && aoRegistrarManual && <Botao onClick={manual}>Registrar estudo manualmente</Botao>}
            <Botao secundario onClick={fechar}>Fechar</Botao>
          </div>
        </div>
      </SectionCard>
    );
  }

  if (!lote) {
    return (
      <SectionCard titulo={titulo} sub={sub}>
        <div role="status" aria-busy="true" style={{ padding: 16, fontSize: 13.5, color: T.sub }}>Buscando questões desta missão…</div>
      </SectionCard>
    );
  }

  if (!atual) {
    return (
      <SectionCard titulo={titulo} sub={sub}>
        <div role="status" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            {resumo.acertos} de {resumo.respondidas} certa{resumo.respondidas === 1 ? "" : "s"}
          </div>
          {fechouMissao && <StatusBadge tom="ok">Missão concluída com estas questões</StatusBadge>}
          <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.5 }}>
            Estas questões já entraram no seu histórico. Registrar de novo à mão contaria duas vezes.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Botao onClick={novoLote} disabled={ocupado}>Mais questões</Botao>
            <Botao secundario onClick={fechar}>Fechar</Botao>
          </div>
        </div>
      </SectionCard>
    );
  }

  const respondida = atual.respondida;
  const origem = origemDaQuestao(atual);
  return (
    <SectionCard titulo={titulo} sub={sub}>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: T.sub, flexWrap: "wrap" }}>
          <span>Questão {indice + 1} de {questoes.length}</span>
          {origem && <span>{origem}</span>}
        </div>
        <fieldset style={{ border: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}
          disabled={respondida || ocupado}>
          <legend style={{ fontSize: 14.5, lineHeight: 1.55, whiteSpace: "pre-wrap", marginBottom: 10, padding: 0 }}>
            {textoSimples(atual.enunciado)}
          </legend>
          {atual.alternativas.map((alt) => {
            const marcada = (respondida ? atual.resposta : escolha) === alt.letra;
            const certa = respondida && alt.letra === atual.gabarito;
            const errada = respondida && marcada && !atual.acerto;
            const borda = certa ? T.green : errada ? T.red : marcada ? T.gold : T.line;
            const idAlt = `questao-${atual.id}-${alt.letra}`;
            return (
              <label key={alt.letra} htmlFor={idAlt}
                style={{ display: "flex", gap: 10, alignItems: "flex-start", border: `1px solid ${borda}`, borderRadius: 10,
                         padding: "10px 12px", cursor: respondida ? "default" : "pointer", background: marcada ? `${borda}12` : T.card }}>
                <input id={idAlt} type="radio" name={`questao-${atual.id}`} value={alt.letra} checked={marcada}
                  aria-label={`Alternativa ${alt.letra}`}
                  onChange={() => setEscolha(alt.letra)} style={{ marginTop: 3 }} />
                <span style={{ fontWeight: 700, minWidth: 16 }}>{alt.letra}</span>
                <span style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{textoSimples(alt.texto)}</span>
              </label>
            );
          })}
        </fieldset>
        {respondida && (
          <div role="status" style={{ fontSize: 13.5, fontWeight: 700, color: atual.acerto ? T.green : T.red }}>
            {atual.acerto ? "Certa." : `Errada. Gabarito: ${atual.gabarito}.`}
          </div>
        )}
        {aviso && <div role="alert" style={{ fontSize: 13, color: T.red }}>{aviso}</div>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {!respondida && !atual.anulada && (
            <Botao onClick={responder} disabled={!escolha || ocupado}>Confirmar resposta</Botao>
          )}
          {(respondida || atual.anulada) && (
            <Botao onClick={seguir}>{resumo.proxima >= 0 ? "Próxima questão" : "Ver resultado"}</Botao>
          )}
          <Botao secundario onClick={fechar}>Fechar</Botao>
        </div>
        <div style={{ fontSize: 11.5, color: T.sub }}>
          {resumo.respondidas} de {resumo.total} respondida{resumo.respondidas === 1 ? "" : "s"} · {resumo.acertos} certa{resumo.acertos === 1 ? "" : "s"}
        </div>
      </div>
    </SectionCard>
  );
}
