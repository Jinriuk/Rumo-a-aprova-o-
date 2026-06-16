/* Sessão e papel atual. O papel vem do TOKEN (app_metadata), a
   mesma fonte que a RLS lê no banco — o front só decide qual tela
   mostrar; quem decide o dado é o banco (Doc 6, seção 5). */
import { useEffect, useState } from "react";
import * as db from "../data/index.js";
import { mensagemAmigavel } from "../lib/erros.js";

export function useSessao() {
  const [estado, setEstado] = useState({ carregando: true, sessao: null, perfil: null, superAdmin: false, erro: null });

  useEffect(() => {
    let vivo = true;

    async function carregarPerfil(sessao) {
      if (!sessao) {
        if (vivo) setEstado({ carregando: false, sessao: null, perfil: null, superAdmin: false, erro: null });
        return;
      }
      try {
        // Backoffice (17.4): o super_admin NÃO tem linha em `usuarios`
        // (não é de uma escola). Checa antes do perfil; se for, nem
        // tenta meuPerfil (que falharia por não achar o usuário).
        // Otimização: super_admin entra SEMPRE por e-mail; login por
        // código (aluno/responsável, @codigo.acesso.local) nunca é
        // super_admin — então pula o round-trip da RPC nesse caminho
        // (que é o mais sensível a latência: aluno no celular).
        const email = sessao.user?.email ?? "";
        const podeSerAdmin = !email.endsWith("@codigo.acesso.local");
        const superAdmin = podeSerAdmin ? await db.souSuperAdmin() : false;
        if (superAdmin) {
          if (vivo) setEstado({ carregando: false, sessao, perfil: null, superAdmin: true, erro: null });
          return;
        }
        const perfil = await db.meuPerfil();
        if (vivo) setEstado({ carregando: false, sessao, perfil, superAdmin: false, erro: null });
      } catch (e) {
        if (vivo) setEstado({ carregando: false, sessao, perfil: null, superAdmin: false, erro: mensagemAmigavel(e, "carregar") });
      }
    }

    db.sessaoAtual().then(carregarPerfil).catch((e) => {
      if (vivo) setEstado({ carregando: false, sessao: null, perfil: null, superAdmin: false, erro: mensagemAmigavel(e, "carregar") });
    });

    const parar = db.aoMudarSessao((sessao) => {
      // re-carrega o perfil a cada troca de sessão (login/logout)
      carregarPerfil(sessao);
    });
    return () => { vivo = false; parar(); };
  }, []);

  return estado;
}
