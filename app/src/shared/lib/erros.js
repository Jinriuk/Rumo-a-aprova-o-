/* Traduz erros técnicos (Supabase, rede, RLS) em mensagens que o usuário
   entende (Fase A.5). O detalhe técnico nunca vai para a tela — fica no
   console (capturado por observabilidade.js) e, se configurado, no
   serviço de monitoramento. Aqui só decidimos o que o usuário lê. */
const MENSAGENS = {
  carregar: "Não conseguimos carregar esses dados. Atualize a página ou tente novamente.",
  salvar: "Não foi possível salvar agora. Tente novamente em alguns instantes.",
  acao: "Não foi possível concluir a ação. Tente novamente.",
  provisionar: "Não foi possível criar o acesso do coordenador. Tente novamente.",
  reenviar: "Não foi possível reenviar o acesso. Tente novamente.",
  // FIX1 (OBS-RC1-008): contextos usados por VinculosResponsavel que
  // antes caíam no genérico "Não foi possível concluir a ação."
  revogar: "Não foi possível revogar o acesso agora. Tente novamente.",
  "vincular responsável": "Não foi possível vincular o responsável agora. Tente novamente.",
  "carregar responsáveis": "Não conseguimos carregar a lista de responsáveis. Tente novamente.",
};

const REDE = /failed to fetch|network|timeout|conex[aã]o|offline/i;

// Mensagens funcionais seguras vindas das Edge Functions — podem ser exibidas
// diretamente ao usuário (não contêm detalhes técnicos internos).
const EDGE_SEGURAS = [
  { test: /e-?mail inv[aá]lido/i, msg: "O e-mail informado é inválido." },
  { test: /acesso restrito|sem permiss[aã]o|super_admin/i, msg: "Você não tem permissão para esta ação." },
  { test: /escola n[aã]o encontrada/i, msg: "Escola não encontrada. Atualize a página." },
  { test: /informe.*escola_id|informe.*nome|informe.*email/i, msg: "Preencha todos os campos obrigatórios." },
  { test: /informe o email/i, msg: "Informe o e-mail do coordenador." },
];

export function mensagemAmigavel(erro, contexto = "acao") {
  // FIX1 (OBS-RC1-003): falha ESPERADA (ex.: credencial errada digitada
  // pelo usuário) é ruído previsível, não erro de sistema — warn em dev,
  // silêncio em produção. Falha inesperada continua em console.error.
  if (erro?.esperada) {
    if (import.meta.env?.DEV) console.warn(erro);
  } else {
    console.error(erro);
  }
  const tecnica = erro?.message ?? String(erro ?? "");
  if (REDE.test(tecnica)) return "Sua conexão parece instável. Verifique e tente de novo.";
  for (const { test, msg } of EDGE_SEGURAS) {
    if (test.test(tecnica)) return msg;
  }
  return MENSAGENS[contexto] ?? MENSAGENS.acao;
}
