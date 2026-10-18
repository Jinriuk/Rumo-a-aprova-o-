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

// Tamanho do lote: 5, 10 ou 20. O servidor corta para caber no limite da
// hora e do dia e, desde a 0067, busca à frente o que falta para a meta: o
// lote seguinte costuma sair do estoque, sem esperar a Quest.
// Raio-x fase 2 (18/10): "Iniciar missão" abre a sessão direto, com o
// último tamanho que o aluno escolheu (padrão 10); trocar fica na sessão.
export const TAMANHOS_LOTE = [5, 10, 20];
export const TAMANHO_LOTE = 10;
const CHAVE_TAMANHO = "triliva-tamanho-lote";

// O acesso a globalThis.localStorage fica dentro do try: com o
// armazenamento bloqueado, ler a propriedade já lança (SecurityError), e
// num parâmetro padrão isso escaparia do try e derrubaria a sessão.
export function tamanhoLembrado(armazenamento) {
  try {
    const n = Number((armazenamento ?? globalThis.localStorage)?.getItem(CHAVE_TAMANHO));
    return TAMANHOS_LOTE.includes(n) ? n : TAMANHO_LOTE;
  } catch { return TAMANHO_LOTE; }
}

export function lembrarTamanho(n, armazenamento) {
  if (!TAMANHOS_LOTE.includes(n)) return;
  try { (armazenamento ?? globalThis.localStorage)?.setItem(CHAVE_TAMANHO, String(n)); } catch { /* sem armazenamento: vale só nesta sessão */ }
}

// "X de N questões desta missão". X = o que já contava para a missão ao
// abrir (questoes_acumuladas) + o que o aluno respondeu nesta sessão
// valendo para ela. Em revisão nada soma (fica no assunto, não na missão).
export function progressoDaMissao(missao, respondidasValendo = 0) {
  const meta = missao?.meta_questoes ?? null;
  const feitas = (missao?.questoes ?? 0) + respondidasValendo;
  return { feitas, meta, texto: meta ? `${feitas} de ${meta} questões desta missão` : `${feitas} questões desta missão` };
}

// Depois de concluída, a missão não soma mais: o servidor entrega os lotes
// seguintes como revisão (ficam no assunto). A tela diz isso no lugar de
// "X de N desta missão" (achado 3 do #192).
export const TEXTO_REVISAO = "Revisão: estas questões ficam no assunto e não contam para a missão, que já está concluída.";

// Botões do fim do lote. Até a missão fechar no servidor: "Continuar: mais
// N". No lote que a fechou: "Missão concluída" e "Continuar praticando",
// avisando que dali em diante é revisão. Nos lotes de revisão: "Continuar
// praticando".
export function fimDoLote({ fechouNesteLote = false, emRevisao = false, tamanho }) {
  if (fechouNesteLote) {
    return { titulo: "Missão concluída", principal: "Continuar praticando",
             aviso: "“Continuar praticando” abre questões de revisão: ficam no assunto e não contam para a missão." };
  }
  if (emRevisao) return { titulo: null, principal: "Continuar praticando", aviso: null };
  return { titulo: null, principal: `Continuar: mais ${tamanho}`, aviso: null };
}

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
  let s = String(valor)
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|tr|h[1-6])\s*>/gi, "\n");
  // Tira tag até não sobrar nenhuma: numa passada só, "<<b>script>" deixaria
  // "<script>" (CodeQL js/incomplete-multi-character-sanitization).
  for (let antes = null; antes !== s;) {
    antes = s;
    s = s.replace(/<[^>]*>/g, "");
  }
  return s
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

// Para onde "Iniciar missão" leva (18/10). `disponiveis`: undefined enquanto
// a lista do servidor não chegou, Set com a resposta, null quando não deu
// para saber. Enquanto não sabe, carrega: nunca manda ao registro por
// falta de resposta (achado 5 do #192). Sem saber depois das tentativas,
// abre as questões e o servidor decide; sem questões, a sessão oferece o
// registro manual.
export function destinoDoInicio(missao, disponiveis, { podeResolver = true } = {}) {
  if (!podeResolver) return "registro";
  if (disponiveis === undefined) return "carregando";
  if (disponiveis === null) return "questoes";
  return podeResolverAqui(missao, disponiveis) ? "questoes" : "registro";
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
