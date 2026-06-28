/* ============================================================
   TRAVA DE ENVIO EM CURSO — núcleo SÍNCRONO da prevenção de
   duplo envio (FE1, tarefa 82).
   ------------------------------------------------------------
   O problema real: o padrão espalhado pelas telas é
       if (ocupado) return; setOcupado(true); await fn();
   `ocupado` é ESTADO do React — só vira `true` no PRÓXIMO render.
   Dois disparos no MESMO tick (duplo-clique, clique + Enter, toque
   fantasma no mobile) leem `ocupado === false` os DOIS e executam
   `fn` DUAS vezes — dois alunos cadastrados, duas credenciais, dois
   registros. O `disabled` do botão ajuda, mas também só vale depois
   do render, e nem todo disparo passa pelo botão.

   Esta trava é um latch EM MEMÓRIA (não estado de render): a segunda
   entrada é recusada no mesmo tick, antes de qualquer re-render. É
   módulo PURO (sem React) de propósito — testável sem renderizar e
   reusado por useEnvioUnico.

   A idempotência de verdade (não criar duas linhas se a rede repetir)
   é responsabilidade do banco/Edge Function; esta trava elimina a
   causa mais comum no cliente: o clique duplo.
   ============================================================ */

// Latch simples: trancar() é atômico do ponto de vista do laço de
// eventos do JS (single-thread) — não há janela entre ler e setar.
export function criarTrava() {
  let trancada = false;
  return {
    get ocupada() {
      return trancada;
    },
    // Tenta trancar. Devolve true se CONSEGUIU entrar (estava livre);
    // false se já estava trancada (chamada concorrente — ignore-a).
    tentar() {
      if (trancada) return false;
      trancada = true;
      return true;
    },
    liberar() {
      trancada = false;
    },
  };
}

// Executa `fn` no máximo uma vez por vez. Chamadas concorrentes
// (enquanto a anterior não terminou) são IGNORADAS e devolvem
// { ignorado: true } sem efeito. A trava é SEMPRE liberada ao fim,
// mesmo se `fn` lançar — senão um erro deixaria a tela travada para
// sempre. Devolve { ignorado, valor } ou repropaga a exceção de `fn`
// (quem trata o erro é o chamador / useEnvioUnico).
export async function executarUnico(trava, fn) {
  if (!trava.tentar()) return { ignorado: true };
  try {
    const valor = await fn();
    return { ignorado: false, valor };
  } finally {
    trava.liberar();
  }
}
