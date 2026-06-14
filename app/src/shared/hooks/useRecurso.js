/* Carregamento de dado assíncrono — extrai o padrão repetido nas
   telas: estado de carregando/erro, Promise no useEffect, guarda
   `vivo` para não setar estado depois de desmontar, e um gatilho de
   recarga. Substitui o boilerplate de AreaEscola/AreaAluno/FichaAluno.

   const { dados, carregando, erro, recarregar } = useRecurso(
     () => Promise.all([db.a(), db.b()]).then(([a, b]) => ({ a, b })),
     [dep],            // dispara novo carregamento quando muda
   );
*/
import { useCallback, useEffect, useState } from "react";

export function useRecurso(carregar, deps = []) {
  const [estado, setEstado] = useState({ dados: null, carregando: true, erro: null });
  const [versao, setVersao] = useState(0);
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  useEffect(() => {
    let vivo = true;
    setEstado((e) => ({ ...e, carregando: true, erro: null }));
    Promise.resolve()
      .then(carregar)
      .then((dados) => vivo && setEstado({ dados, carregando: false, erro: null }))
      .catch((e) => vivo && setEstado({ dados: null, carregando: false, erro: e.message }));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, versao]);

  return { ...estado, recarregar };
}
