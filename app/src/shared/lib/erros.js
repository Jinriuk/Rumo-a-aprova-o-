/* Traduz erros técnicos (Supabase, rede, RLS) em mensagens que o usuário
   entende (Fase A.5). O detalhe técnico nunca vai para a tela — fica no
   console (capturado por observabilidade.js) e, se configurado, no
   serviço de monitoramento. Aqui só decidimos o que o usuário lê. */
const MENSAGENS = {
  carregar: "Não conseguimos carregar esses dados. Atualize a página ou tente novamente.",
  salvar: "Não foi possível salvar agora. Tente novamente em alguns instantes.",
  acao: "Não foi possível concluir a ação. Tente novamente.",
};

const REDE = /failed to fetch|network|timeout|conex[aã]o|offline/i;

export function mensagemAmigavel(erro, contexto = "acao") {
  console.error(erro);
  const tecnica = erro?.message ?? String(erro ?? "");
  if (REDE.test(tecnica)) return "Sua conexão parece instável. Verifique e tente de novo.";
  return MENSAGENS[contexto] ?? MENSAGENS.acao;
}
