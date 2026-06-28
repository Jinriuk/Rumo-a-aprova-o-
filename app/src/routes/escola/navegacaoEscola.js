/* ============================================================
   Navegação da Área da Escola — reducer PURO (FE1, tarefa 83).
   ------------------------------------------------------------
   A Área da Escola tem três peças de estado que SEMPRE mudam juntas:
   a aba ativa (`tab`), o filtro de status dos alunos (`filtroStatus`)
   e a ficha de aluno aberta (`alunoAberto`). Com três `useState`
   soltos, cada navegação tinha que lembrar de zerar as outras duas —
   trocar de aba sem fechar a ficha aberta, ou sem limpar o filtro,
   era um bug fácil de introduzir (e que já exigia 3 setters por clique).

   Um reducer concentra essas transições num lugar só: cada ação deixa
   o estado COERENTE por construção. Não é "useReducer por decoração" —
   é o caso em que ele paga (estado acoplado, transições nomeadas). O
   resto do estado da tela (credencial em modal, dados carregados) NÃO
   entra aqui: são independentes e seguem em useState/useRecurso.

   Puro e sem React: testável isolado (tests/fe1-navegacao-escola).
   ============================================================ */

export const NAV_INICIAL = { tab: "painel", filtroStatus: "", alunoAberto: null };

export function navReducer(estado, acao) {
  switch (acao?.tipo) {
    // trocar de aba: zera filtro e fecha qualquer ficha aberta.
    case "ir":
      return { tab: acao.tab, filtroStatus: "", alunoAberto: null };
    // ir para a aba "alunos" já com um filtro de status aplicado
    // (ex.: clicar "12 sem atividade" no painel).
    case "irFiltrado":
      return { tab: acao.tab, filtroStatus: acao.filtro ?? "", alunoAberto: null };
    // abrir a ficha de um aluno (sobrepõe a aba atual).
    case "abrirAluno":
      return { ...estado, alunoAberto: acao.aluno };
    case "fecharAluno":
      return { ...estado, alunoAberto: null };
    default:
      return estado;
  }
}
