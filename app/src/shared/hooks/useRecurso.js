/* Carregamento de dado assíncrono — extrai o padrão repetido nas
   telas: estado de carregando/erro, Promise no useEffect, guarda
   `vivo` para não setar estado depois de desmontar, e um gatilho de
   recarga. Substitui o boilerplate de AreaEscola/AreaAluno/FichaAluno.

   `carregando` só é true no PRIMEIRO carregamento (sem dado ainda).
   Numa recarga (recarregar), mantém o dado atual na tela enquanto
   revalida — stale-while-revalidate. Isso importa: telas que escondem
   o conteúdo atrás de `!carregando` não podem desmontar a cada
   mutação (ex.: o "Marca salva" sumiria antes de aparecer).

   const { dados, carregando, erro, recarregar } = useRecurso(
     () => Promise.all([db.a(), db.b()]).then(([a, b]) => ({ a, b })),
     [dep],            // dispara novo carregamento quando muda
   );
*/
import { useCallback, useEffect, useState } from "react";
import { mensagemAmigavel } from "../lib/erros.js";

export function useRecurso(carregar, deps = []) {
  const [estado, setEstado] = useState({ dados: null, carregando: true, erro: null });
  const [versao, setVersao] = useState(0);
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  useEffect(() => {
    let vivo = true;
    // só "carrega" do zero quando ainda não há dado; recarga mantém o
    // que está na tela (sem piscar "Carregando…" nem desmontar a aba).
    setEstado((e) => (e.dados == null ? { ...e, carregando: true, erro: null } : { ...e, erro: null }));
    Promise.resolve()
      .then(carregar)
      .then((dados) => vivo && setEstado({ dados, carregando: false, erro: null }))
      .catch((e) => vivo && setEstado((prev) => ({ dados: prev.dados, carregando: false, erro: mensagemAmigavel(e, "carregar") })));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, versao]);

  return { ...estado, recarregar };
}

