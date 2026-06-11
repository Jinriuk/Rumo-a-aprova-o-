/* Sessão e papel atual. O papel vem do TOKEN (app_metadata), a
   mesma fonte que a RLS lê no banco — o front só decide qual tela
   mostrar; quem decide o dado é o banco (Doc 6, seção 5). */
import { useEffect, useState } from "react";
import * as db from "../data/index.js";

export function useSessao() {
  const [estado, setEstado] = useState({ carregando: true, sessao: null, perfil: null, erro: null });

  useEffect(() => {
    let vivo = true;

    async function carregarPerfil(sessao) {
      if (!sessao) {
        if (vivo) setEstado({ carregando: false, sessao: null, perfil: null, erro: null });
        return;
      }
      try {
        const perfil = await db.meuPerfil();
        if (vivo) setEstado({ carregando: false, sessao, perfil, erro: null });
      } catch (e) {
        if (vivo) setEstado({ carregando: false, sessao, perfil: null, erro: e.message });
      }
    }

    db.sessaoAtual().then(carregarPerfil).catch((e) => {
      if (vivo) setEstado({ carregando: false, sessao: null, perfil: null, erro: e.message });
    });

    const parar = db.aoMudarSessao((sessao) => {
      // re-carrega o perfil a cada troca de sessão (login/logout)
      carregarPerfil(sessao);
    });
    return () => { vivo = false; parar(); };
  }, []);

  return estado;
}
