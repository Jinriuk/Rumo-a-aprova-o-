/* Sessão e papel atual. O papel vem do TOKEN (app_metadata), a
   mesma fonte que a RLS lê no banco — o front só decide qual tela
   mostrar; quem decide o dado é o banco (Doc 6, seção 5). */
import { useEffect, useState, useSyncExternalStore } from "react";
import * as db from "../data/index.js";
import { mensagemAmigavel } from "../lib/erros.js";

export function useSessao() {
  // useSyncExternalStore (não useState+useEffect) de propósito: o
  // PASSWORD_RECOVERY pode disparar entre a criação do client e a
  // primeira renderização, ou entre a renderização e a montagem do
  // efeito — qualquer versão baseada em efeito tem uma janela onde o
  // evento passa despercebido. useSyncExternalStore lê o snapshot atual
  // de forma síncrona no render E garante que nenhuma atualização entre
  // o render e a inscrição se perca (contrato do próprio React).
  const recuperacaoSenha = useSyncExternalStore(db.aoEntrarEmRecuperacao, db.recuperacaoDeSenhaAtiva);

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
        // Escola suspensa/cancelada NÃO passa por aqui: meuPerfil devolve
        // o perfil com `escola.status`, e é o App quem decide a tela via
        // escolaOperacional(perfil.escola). O bloqueio de dado é da RLS
        // (migration 0027). FIX1 (OBS-RC1-005): removido o branch morto
        // de ESCOLA_SUSPENSA — nenhum código lança esse código de erro.
        if (vivo) setEstado({ carregando: false, sessao, perfil: null, superAdmin: false, erro: mensagemAmigavel(e, "carregar") });
      }
    }

    db.sessaoAtual().then(carregarPerfil).catch((e) => {
      if (vivo) setEstado({ carregando: false, sessao: null, perfil: null, superAdmin: false, erro: mensagemAmigavel(e, "carregar") });
    });

    const parar = db.aoMudarSessao((sessao, evento) => {
      // Tarefa 3: PASSWORD_RECOVERY não é um login normal — a sessão é a
      // do dono do link de recuperação, só para permitir o updateUser()
      // de troca de senha. Carregar perfil/papel pra ela é trabalho
      // descartado (App.jsx ignora perfil/sessao enquanto recuperacaoSenha
      // for true) e chega a soar como um login de verdade em qualquer log.
      if (evento === "PASSWORD_RECOVERY") return;
      // re-carrega o perfil a cada troca de sessão (login/logout)
      carregarPerfil(sessao);
    });
    return () => { vivo = false; parar(); };
  }, []);

  return { ...estado, recuperacaoSenha };
}
