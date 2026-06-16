/* Roda `fn` para cada item de `itens` com no máximo `limite`
   chamadas em paralelo (Fase B-min, B.6). Usado onde antes havia um
   `for (const x of itens) await fn(x)` — correto, mas em lote (ex.:
   gerar a meta de 300+ alunos importados de uma vez) cada chamada é
   uma viagem de rede separada e a espera somada fica perceptível
   para quem está na tela. Mantém um teto de chamadas simultâneas
   (não dispara as N de uma vez, que sobrecarregaria a Edge Function/
   banco) sem voltar a ser uma fila estritamente sequencial. */

export async function comConcorrenciaLimitada(itens, limite, fn) {
  const fila = itens.slice();
  const trabalhadores = Math.max(1, Math.min(limite, fila.length));
  await Promise.all(
    Array.from({ length: trabalhadores }, async function trabalhar() {
      while (fila.length) {
        const item = fila.shift();
        await fn(item);
      }
    }),
  );
}
