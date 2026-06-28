/* ============================================================
   useEnvioUnico — envio sensível com DUPLO ENVIO IMPOSSÍVEL por
   construção (FE1, tarefa 82).
   ------------------------------------------------------------
   Substitui o padrão repetido `setOcupado/if(ocupado)return` por uma
   garantia real. Junta três coisas que as telas faziam à mão (e às
   vezes esqueciam):

     1. Trava SÍNCRONA (ref + criarTrava): recusa reentrância no mesmo
        tick, antes do render — é o que o estado `ocupado` sozinho não
        garante (ver lib/travaEnvio.js).
     2. Estado `ocupado`: só para a UI — texto "Salvando…", disable
        visual do botão. Não é o que protege; o latch é.
     3. Guarda de desmontagem: não chama setState depois que a tela
        saiu (navegação rápida durante o await) — evita o warning e o
        vazamento. Combina com o AbortController do useRecurso.
     4. Erro padronizado: traduz a exceção por mensagemAmigavel e
        expõe `erro` — a tela não repete try/catch nem decide texto.

   Uso:
     const { ocupado, erro, enviar } = useEnvioUnico("salvar");
     <Botao disabled={!pronto || ocupado} onClick={() => enviar(async () => {
        await db.algo();
        aoMudar?.();
     })}>{ocupado ? "Salvando…" : "Salvar"}</Botao>
     <Erro>{erro}</Erro>

   `enviar(fn)` devolve { ignorado } | { valor } | { erro, excecao }:
   - ignorado:true  → era um disparo duplo, nada aconteceu
   - valor          → sucesso (o retorno de fn)
   - erro/excecao   → falhou; `erro` já foi setado e exibido
   ============================================================ */
import { useCallback, useEffect, useRef, useState } from "react";
import { criarTrava } from "../lib/travaEnvio.js";
import { mensagemAmigavel } from "../lib/erros.js";

export function useEnvioUnico(contextoErro = "salvar") {
  // Uma trava por instância do hook, criada uma única vez (lazy ref).
  const travaRef = useRef(null);
  if (travaRef.current === null) travaRef.current = criarTrava();

  const montadoRef = useRef(true);
  useEffect(() => () => { montadoRef.current = false; }, []);

  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);

  // `contexto` opcional sobrepõe o padrão do hook por chamada — útil
  // quando o mesmo componente faz ações diferentes (ex.: revogar vs.
  // vincular) que merecem mensagens de erro distintas.
  const enviar = useCallback(async (fn, contexto = contextoErro) => {
    // GUARDA SÍNCRONA: segundo clique no mesmo tick cai aqui e some.
    if (!travaRef.current.tentar()) return { ignorado: true };
    setOcupado(true);
    setErro(null);
    try {
      const valor = await fn();
      return { ignorado: false, valor };
    } catch (e) {
      const msg = mensagemAmigavel(e, contexto);
      if (montadoRef.current) setErro(msg);
      return { ignorado: false, erro: msg, excecao: e };
    } finally {
      travaRef.current.liberar();
      if (montadoRef.current) setOcupado(false);
    }
  }, [contextoErro]);

  return { ocupado, erro, setErro, enviar };
}
