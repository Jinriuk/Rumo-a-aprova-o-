/* Sessão e papel atual. O papel vem do TOKEN (app_metadata), a
   mesma fonte que a RLS lê no banco — o front só decide qual tela
   mostrar; quem decide o dado é o banco (Doc 6, seção 5). */
import { useCallback, useEffect, useRef, useState } from "react";
import * as db from "../data/index.js";
import { mensagemAmigavel } from "../lib/erros.js";

export function useSessao() {
  const [estado, setEstado] = useState({ carregando: true, sessao: null, perfil: null, superAdmin: false, erro: null });
  // Guarda "ainda estou montado" fora do efeito: recarregarPerfil() pode
  // ser chamado a qualquer momento (não só na montagem), então precisa
  // do MESMO guarda que o efeito usa, não um local novo por chamada.
  const vivoRef = useRef(true);

  const carregarPerfil = useCallback(async (sessao) => {
    if (!sessao) {
      if (vivoRef.current) setEstado({ carregando: false, sessao: null, perfil: null, superAdmin: false, erro: null });
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
        if (vivoRef.current) setEstado({ carregando: false, sessao, perfil: null, superAdmin: true, erro: null });
        return;
      }
      const perfil = await db.meuPerfil();
      if (vivoRef.current) setEstado({ carregando: false, sessao, perfil, superAdmin: false, erro: null });
    } catch (e) {
      // Escola suspensa/cancelada NÃO passa por aqui: meuPerfil devolve
      // o perfil com `escola.status`, e é o App quem decide a tela via
      // escolaOperacional(perfil.escola). O bloqueio de dado é da RLS
      // (migration 0027). FIX1 (OBS-RC1-005): removido o branch morto
      // de ESCOLA_SUSPENSA — nenhum código lança esse código de erro.
      if (vivoRef.current) setEstado({ carregando: false, sessao, perfil: null, superAdmin: false, erro: mensagemAmigavel(e, "carregar") });
    }
  }, []);

  useEffect(() => {
    vivoRef.current = true;

    db.sessaoAtual().then(carregarPerfil).catch((e) => {
      if (vivoRef.current) setEstado({ carregando: false, sessao: null, perfil: null, superAdmin: false, erro: mensagemAmigavel(e, "carregar") });
    });

    const parar = db.aoMudarSessao((sessao) => {
      // re-carrega o perfil a cada troca de sessão (login/logout)
      carregarPerfil(sessao);
    });
    return () => { vivoRef.current = false; parar(); };
  }, [carregarPerfil]);

  // Etapa 7 / BLOCO B2: depois de trocar-senha, `usuarios.
  // must_change_password` muda no banco SEM gerar SIGNED_IN nem
  // TOKEN_REFRESHED (a Edge Function usa a Admin API, o JWT do cliente
  // nem é tocado) — então `aoMudarSessao` nunca dispara pra isso.
  // recarregarPerfil() é o jeito explícito de reler o perfil sem
  // esperar um evento de auth que não vai vir.
  const recarregarPerfil = useCallback(() => {
    return db.sessaoAtual().then(carregarPerfil).catch((e) => {
      if (vivoRef.current) setEstado((atual) => ({ ...atual, erro: mensagemAmigavel(e, "carregar") }));
    });
  }, [carregarPerfil]);

  return { ...estado, recarregarPerfil };
}
