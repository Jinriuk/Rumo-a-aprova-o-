/* ============================================================
   Leitura do hash do link de recuperação de senha.
   ------------------------------------------------------------
   Módulo PURO de propósito: não importa o cliente Supabase, não
   lê `window`, não escreve em lugar nenhum. Quem passa o hash é
   quem chama — assim isto é testável sem navegador e, mais
   importante, o token do link NUNCA passa perto do cliente
   compartilhado (que é o que trocava a sessão de quem já estava
   logado — ver comentário em lib/supabase.js).

   O GoTrue devolve dois formatos possíveis no fragmento:
     sucesso  #access_token=...&type=recovery&refresh_token=...
     falha    #error=access_denied&error_code=otp_expired&error_description=...
   O segundo é o caso do link velho ou já usado. Ele PRECISA ser
   reconhecido: sem isso o app cai no roteamento normal e o usuário
   vê a tela de login (ou o painel de quem estiver logado) sem
   nenhuma explicação de que o link não valia mais.
   ============================================================ */

export const RECUPERACAO_AUSENTE = "ausente";
export const RECUPERACAO_VALIDA = "recuperacao";
export const RECUPERACAO_ERRO = "erro";

// Devolve sempre um objeto com `tipo`; nunca lança.
export function lerHashRecuperacao(hash) {
  const bruto = String(hash ?? "").replace(/^#/, "");
  if (!bruto) return { tipo: RECUPERACAO_AUSENTE };

  let p;
  try {
    p = new URLSearchParams(bruto);
  } catch {
    return { tipo: RECUPERACAO_AUSENTE };
  }

  const erro = p.get("error_code") || p.get("error");
  if (erro) {
    return {
      tipo: RECUPERACAO_ERRO,
      codigo: erro,
      descricao: p.get("error_description") ?? "",
    };
  }

  const accessToken = p.get("access_token");
  if (accessToken && p.get("type") === "recovery") {
    return { tipo: RECUPERACAO_VALIDA, accessToken };
  }

  return { tipo: RECUPERACAO_AUSENTE };
}

// Caminho para onde o `redirectTo` do GoTrue aponta (ver recuperarSenha /
// solicitarRecuperacaoSenha em shared/data/index.js).
export const CAMINHO_RECUPERACAO = "/redefinir-senha";

export function ehCaminhoRecuperacao(caminho) {
  return String(caminho ?? "").replace(/\/+$/, "").toLowerCase() === CAMINHO_RECUPERACAO;
}

// A tela de redefinição atende TRÊS entradas, não só a feliz:
//   • hash válido        → formulário de nova senha;
//   • hash de erro       → "este link expirou";
//   • /redefinir-senha
//     sem hash utilizável → "este endereço não tem link válido".
// A terceira existe porque cliente de e-mail e scanner de link às vezes
// entregam a URL sem o fragmento. Sem ela, o usuário cairia no login sem
// entender por que o link "não fez nada" — o redirect silencioso que a
// correção precisa evitar.
export function ehRotaRecuperacao(hash, caminho) {
  const { tipo } = lerHashRecuperacao(hash);
  if (tipo === RECUPERACAO_VALIDA || tipo === RECUPERACAO_ERRO) return true;
  return ehCaminhoRecuperacao(caminho);
}

/* ---------- mensagens ao usuário (puras, sem React) ---------- */

export const LINK_INVALIDO =
  "Este link expirou ou já foi usado. Solicite um novo link de recuperação na tela de login.";

// Hash de erro do GoTrue (link velho / já usado / revogado).
export function mensagemLinkInvalido(codigo) {
  if (codigo === "otp_expired" || codigo === "access_denied") return LINK_INVALIDO;
  return "Não foi possível validar este link de recuperação. Solicite um novo na tela de login.";
}

// Falha do PATCH /auth/v1/user. Cada caso previsível ganha texto próprio:
// mandar "tente novamente" para quem repetiu a senha antiga é o tipo de
// mensagem que faz o usuário rodar em círculo.
export function mensagemErroRedefinicao(erro) {
  const codigo = erro?.codigoGoTrue ?? "";
  const status = erro?.status ?? 0;
  const msg = String(erro?.message ?? "");

  if (codigo === "same_password" || /different from the old password/i.test(msg)) {
    return "A nova senha precisa ser diferente da senha atual.";
  }
  if (codigo === "weak_password" || /weak.?password/i.test(msg)) {
    return "O servidor recusou esta senha por ser fraca. Use uma combinação mais longa, com letras, números e símbolos.";
  }
  if (status === 401 || status === 403 || /expired|invalid|not found|bad_?jwt/i.test(msg)) {
    return LINK_INVALIDO;
  }
  return "Não foi possível atualizar a senha. Tente novamente ou solicite um novo link.";
}
