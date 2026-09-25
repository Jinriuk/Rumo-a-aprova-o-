/* ============================================================
   PASSO A PASSO GUIADO (tela a tela)
   ------------------------------------------------------------
   Módulo PURO: os roteiros e a memória de "já vi o guia". Quem desenha
   é GuiaPassoAPasso.jsx.

   Cada passo leva a pessoa até UMA aba de verdade (`aba` é a chave da
   aba em AreaEscola / VisaoEstudo) e explica o que ela está vendo ali.
   O guia não cobre a tela: fica num cartão encostado embaixo, para a
   pessoa enxergar a aba enquanto lê.

   A memória fica no navegador (localStorage), por papel e por conta.
   De propósito: não grava nada no banco. O pior caso (limpou o
   navegador, trocou de aparelho) é o convite aparecer de novo, e o
   botão "Guia" no topo abre o roteiro a qualquer hora.
   ============================================================ */

// Sobe quando o roteiro mudar o bastante para valer mostrar de novo.
export const VERSAO_GUIA = 1;

export const ROTEIRO_COORDENACAO = [
  {
    aba: "painel",
    titulo: "Painel: a escola num relance",
    texto: "Aqui ficam os números da escola: quantos alunos estudaram, o acerto médio no ciclo e quem está sem atividade. Clicar num cartão leva direto para a lista de alunos já filtrada.",
  },
  {
    aba: "turmas",
    titulo: "Turmas: comece por aqui",
    texto: "Crie as turmas da escola (por exemplo, \"CN Manhã\"). Elas aparecem no cadastro de alunos e no ranking. Clicar numa turma mostra os alunos dela e quem está em risco.",
  },
  {
    aba: "alunos",
    titulo: "Alunos: cadastro e acesso",
    texto: "Em \"+ Cadastrar\" você cadastra só o nome (um por vez ou em lote), escolhe a turma e o concurso; a trilha de estudo vem do concurso. Depois, \"Gerar credencial\" cria o código e a senha temporária para entregar ao aluno. No primeiro acesso ele troca a senha.",
    dica: "No menu \"⋯\" de cada aluno: adicionar responsável, registrar consentimento, resetar senha e os pedidos da LGPD.",
  },
  {
    aba: "ranking",
    titulo: "Ranking e relatórios",
    texto: "A classificação por turma e os comparativos. Mais abaixo, \"Exportar relatórios (CSV)\" baixa os dados para planilha.",
  },
  {
    aba: "ciclo",
    titulo: "Ciclo: quando o plano termina",
    texto: "Quando a trilha de uma turma chega ao fim, ela aparece aqui e você abre o próximo ciclo. O número ao lado da aba avisa quantos alunos estão esperando.",
  },
  {
    aba: "conformidade",
    titulo: "LGPD",
    texto: "Consentimentos dos responsáveis e o registro de quem leu os dados de cada aluno. Aluno sem consentimento aparece destacado.",
  },
  {
    aba: "marca",
    titulo: "Marca da escola",
    texto: "O nome de exibição, o logo e a cor de destaque que alunos e responsáveis veem. A pré-visualização mostra como fica antes de salvar.",
  },
];

export const ROTEIRO_ALUNO = [
  {
    aba: "hoje",
    titulo: "Hoje: o que fazer agora",
    texto: "Esta é a sua tela principal. Ela mostra a missão da semana e o que falta fazer. O número na aba \"Hoje\" é quantas atividades ainda estão pendentes.",
    dica: "Se aparecer o diagnóstico inicial no topo, responda primeiro: ele ajusta o seu plano.",
  },
  {
    aba: "registrar",
    titulo: "Registrar: conte o que você estudou",
    texto: "Depois de estudar, registre aqui a matéria, as questões feitas, os acertos e o tempo. É isso que alimenta o seu desempenho e o seu XP. O cronômetro no topo registra o tempo para você.",
  },
  {
    aba: "concurso",
    titulo: "Trilha do concurso",
    texto: "O caminho até a prova: o que cai, o peso de cada matéria e em que ponto da trilha você está.",
  },
  {
    aba: "desempenho",
    titulo: "Desempenho",
    texto: "Seu acerto por matéria e ao longo das semanas. Use para ver onde está forte e onde precisa reforçar.",
  },
  {
    aba: "simulados",
    titulo: "Simulados",
    texto: "Lance aqui o resultado dos simulados que você fizer, para acompanhar a evolução até a prova.",
  },
  {
    aba: "conquistas",
    titulo: "Conquistas",
    texto: "Seu XP, a sua patente e as conquistas que você desbloqueia estudando com constância.",
  },
  {
    aba: "historico",
    titulo: "Histórico",
    texto: "As metas das semanas que já passaram, com o que foi feito e o que ficou pendente em cada uma.",
  },
  {
    aba: "plano",
    titulo: "Plano",
    texto: "O plano completo das semanas, com o que está previsto em cada uma.",
  },
];

export function chaveGuia(papel, usuarioId) {
  return `triliva:guia:v${VERSAO_GUIA}:${papel}:${usuarioId ?? "anonimo"}`;
}

// localStorage pode não existir (teste, SSR) ou lançar (aba anônima,
// armazenamento bloqueado). Nos dois casos o guia segue funcionando: só
// não lembra que já foi visto.
export function guiaJaVisto(chave, armazenamento = globalThis.localStorage) {
  try { return armazenamento?.getItem(chave) === "visto"; } catch { return false; }
}

export function marcarGuiaVisto(chave, armazenamento = globalThis.localStorage) {
  try { armazenamento?.setItem(chave, "visto"); } catch { /* sem armazenamento: paciência */ }
}
