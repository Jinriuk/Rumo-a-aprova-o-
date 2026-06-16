/* Paginação de uma lista já carregada/filtrada em memória (Fase
   B-min, B.2/B.6). Não é paginação de consulta ao banco: serve
   para telas como "Alunos da escola", que já têm o array inteiro
   (pequeno, ~500 linhas leves) em memória depois do filtro/busca e
   só precisam parar de jogar tudo no DOM de uma vez. Função pura,
   sem dependência de React. */

export function paginar(lista, pagina, porPagina) {
  const total = lista.length;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const paginaSegura = Math.min(Math.max(1, pagina), totalPaginas);
  const inicio = (paginaSegura - 1) * porPagina;
  return {
    pagina: paginaSegura,
    totalPaginas,
    total,
    itens: lista.slice(inicio, inicio + porPagina),
  };
}
