/* P1.1 — contrato puro das questões integradas (Quest), lado do front.
   O servidor (Edge Function questoes-integradas + 0065) corrige, conta e
   limita; aqui só o que a tela precisa decidir: o que dizer em cada
   estado, quando oferecer o registro manual e como mostrar o enunciado
   sem interpretar HTML. A chave da Quest nunca passa pelo front. */

// Estados que o servidor devolve e o que a tela diz. `manual: true`
// oferece o registro manual da missão no lugar (seção 9.2, passo 7).
const ESTADOS = {
  fornecedor_indisponivel: { texto: "O banco de questões não respondeu agora. Registre o seu estudo manualmente; ele conta do mesmo jeito.", manual: true },
  sem_questoes: { texto: "Não há questão nova deste assunto disponível agora. Registre o seu estudo manualmente.", manual: true },
  erro: { texto: "Não deu para abrir as questões agora. Registre o seu estudo manualmente.", manual: true },
  limite: { texto: "Você chegou ao limite de questões integradas por agora. Volte mais tarde ou registre manualmente.", manual: true },
  indisponivel: { texto: "Esta missão não tem questões integradas. Registre o estudo manualmente.", manual: true },
  fora_da_vez: { texto: "Esta missão ainda não é a da vez nesta matéria.", manual: false },
  missao_invalida: { texto: "Esta missão não está disponível para você.", manual: false },
  sem_aluno: { texto: "Só o aluno resolve questões integradas.", manual: false },
  expirada: { texto: "Este lote venceu. Abra um novo.", manual: false },
  anulada: { texto: "Esta questão foi anulada e não conta. Siga para a próxima.", manual: false },
  resposta_invalida: { texto: "Escolha uma das alternativas.", manual: false },
  nao_encontrada: { texto: "Esta questão não está no seu lote.", manual: false },
};

export const ESTADOS_ESPERADOS_QUEST = Object.keys(ESTADOS);

export function mensagemDoEstado(estado) {
  return ESTADOS[estado] ?? ESTADOS.erro;
}

// Id do pedido de lote: o mesmo em toda retransmissão da mesma abertura.
export function novoPedidoId(cripto = globalThis.crypto) {
  return cripto.randomUUID();
}

const ENTIDADES = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'" };

// Enunciado e alternativas vêm de fora: viram TEXTO, nunca HTML (nada de
// dangerouslySetInnerHTML). Quebras de bloco viram quebra de linha.
export function textoSimples(valor) {
  if (valor == null) return "";
  return String(valor)
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/g, (m) => ENTIDADES[m])
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(Number(n), 0x10ffff)))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Origem da questão para a linha de rodapé ("FGV · PMERJ · 2024").
export function origemDaQuestao(q) {
  return [q?.banca, q?.orgao, q?.ano].filter((x) => x != null && String(x).trim()).join(" · ");
}

// Em que missões o botão aparece: a da vez (praticar) ou já iniciada
// (revisar), e só se o servidor disse que ela tem questões integradas.
export function podeResolverAqui(missao, disponiveis) {
  if (!missao?.id || !disponiveis?.has?.(missao.id)) return false;
  return missao.estado === "atual" || !!missao.proxima || missao.estado === "concluida";
}

// Resumo do lote a partir das questões respondidas.
export function resumoDoLote(questoes = []) {
  const respondidas = questoes.filter((q) => q.respondida);
  return {
    total: questoes.length,
    respondidas: respondidas.length,
    acertos: respondidas.filter((q) => q.acerto).length,
    proxima: questoes.findIndex((q) => !q.respondida && !q.anulada),
  };
}
