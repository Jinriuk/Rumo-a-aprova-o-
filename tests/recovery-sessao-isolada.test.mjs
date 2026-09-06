// ============================================================
// Link de recuperação não pode mais substituir sessão alheia
// ------------------------------------------------------------
// O BUG: o cliente Supabase é um singleton com `detectSessionInUrl`
// no padrão (true). Qualquer `#access_token=...` na URL era processado
// sozinho pelo SDK e gravado na MESMA chave de localStorage da sessão
// normal. Abrir o link de recuperação de um coordenador num navegador
// onde o SuperADM já estava logado sobrescrevia a sessão do SuperADM,
// em todas as abas da origem, sem aviso.
//
// A CORREÇÃO tem duas metades, e este arquivo cobre as duas:
//   1. lógica pura — leitura do hash e mensagens (testada de verdade,
//      importando o módulo e exercitando as entradas);
//   2. contrato de fonte — as travas que impedem a regressão voltar
//      por um caminho lateral (updateUser, setSession, sair()).
// ============================================================
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  lerHashRecuperacao,
  ehRotaRecuperacao,
  ehCaminhoRecuperacao,
  CAMINHO_RECUPERACAO,
  mensagemLinkInvalido,
  mensagemErroRedefinicao,
  LINK_INVALIDO,
  RECUPERACAO_AUSENTE,
  RECUPERACAO_VALIDA,
  RECUPERACAO_ERRO,
} from "../app/src/shared/lib/recuperacao.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const ler = (rel) => readFileSync(resolve(root, rel), "utf8");

// As travas de "isto NÃO pode aparecer" precisam olhar CÓDIGO, não prosa:
// os comentários destes arquivos explicam justamente por que `updateUser`,
// `setSession` e `sair()` não são usados — citar o nome não é chamá-lo.
function semComentarios(fonte) {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, "")      // blocos /* ... */
    .replace(/(^|[^:\\])\/\/.*$/gm, "$1");   // linha // ... (preserva https://)
}
const lerCodigo = (rel) => semComentarios(ler(rel));

// Hash real que o GoTrue devolve depois de verificar o OTP do link.
const HASH_OK =
  "#access_token=eyJhbGciOiJIUzI1NiJ9.payload.assinatura&expires_in=3600" +
  "&refresh_token=v1lk3r&token_type=bearer&type=recovery";

// Hash real de link velho / já usado.
const HASH_EXPIRADO =
  "#error=access_denied&error_code=otp_expired" +
  "&error_description=Email+link+is+invalid+or+has+expired";

describe("recovery — leitura do hash (lógica pura)", () => {
  it("link válido devolve o access_token", () => {
    const r = lerHashRecuperacao(HASH_OK);
    assert.equal(r.tipo, RECUPERACAO_VALIDA);
    assert.equal(r.accessToken, "eyJhbGciOiJIUzI1NiJ9.payload.assinatura");
  });

  it("aceita o hash sem o '#' na frente", () => {
    assert.equal(lerHashRecuperacao(HASH_OK.slice(1)).tipo, RECUPERACAO_VALIDA);
  });

  it("link expirado vira ERRO com código e descrição legível", () => {
    const r = lerHashRecuperacao(HASH_EXPIRADO);
    assert.equal(r.tipo, RECUPERACAO_ERRO);
    assert.equal(r.codigo, "otp_expired");
    // '+' do querystring precisa virar espaço, senão a mensagem sai ilegível
    assert.equal(r.descricao, "Email link is invalid or has expired");
  });

  it("hash vazio, nulo ou indefinido não quebra e não vira recuperação", () => {
    for (const h of ["", "#", null, undefined]) {
      assert.equal(lerHashRecuperacao(h).tipo, RECUPERACAO_AUSENTE, `falhou para ${JSON.stringify(h)}`);
    }
  });

  it("token SEM type=recovery não é tratado como recuperação", () => {
    // trava contra reintroduzir por acidente o comportamento antigo de
    // aceitar qualquer token de sessão que apareça na URL
    const r = lerHashRecuperacao("#access_token=abc&token_type=bearer");
    assert.equal(r.tipo, RECUPERACAO_AUSENTE);
    assert.equal(r.accessToken, undefined);
  });

  it("type=recovery SEM token não é tratado como recuperação", () => {
    assert.equal(lerHashRecuperacao("#type=recovery").tipo, RECUPERACAO_AUSENTE);
  });

  it("erro tem precedência sobre token — GoTrue nunca manda os dois", () => {
    const r = lerHashRecuperacao("#error=access_denied&error_code=otp_expired&access_token=x&type=recovery");
    assert.equal(r.tipo, RECUPERACAO_ERRO);
  });

  it("ehRotaRecuperacao cobre link válido E link expirado", () => {
    // o expirado PRECISA entrar: é na tela de redefinição que o usuário
    // lê que o link venceu. Fora dela, viraria redirect silencioso.
    assert.equal(ehRotaRecuperacao(HASH_OK, "/"), true);
    assert.equal(ehRotaRecuperacao(HASH_EXPIRADO, "/"), true);
    assert.equal(ehRotaRecuperacao("", "/"), false);
    assert.equal(ehRotaRecuperacao("#qualquer=coisa", "/"), false);
  });

  it("o caminho /redefinir-senha sozinho já leva à tela (e-mail sem fragmento)", () => {
    assert.equal(ehRotaRecuperacao("", CAMINHO_RECUPERACAO), true);
    assert.equal(ehRotaRecuperacao("#type=recovery", CAMINHO_RECUPERACAO), true);
    assert.equal(ehCaminhoRecuperacao("/redefinir-senha/"), true, "barra final deveria contar");
    assert.equal(ehCaminhoRecuperacao("/Redefinir-Senha"), true, "caixa não deveria importar");
    assert.equal(ehCaminhoRecuperacao("/"), false);
    assert.equal(ehCaminhoRecuperacao("/redefinir-senha-x"), false);
    assert.equal(ehCaminhoRecuperacao(undefined), false);
  });

  it("o caminho de recuperação bate com o redirectTo enviado no e-mail", () => {
    const dados = ler("app/src/shared/data/index.js");
    assert.ok(dados.includes(`${CAMINHO_RECUPERACAO.slice(1)}`), "redirectTo e rota divergiram");
  });
});

describe("recovery — mensagens de erro (lógica pura)", () => {
  it("otp_expired e access_denied explicam link vencido", () => {
    assert.equal(mensagemLinkInvalido("otp_expired"), LINK_INVALIDO);
    assert.equal(mensagemLinkInvalido("access_denied"), LINK_INVALIDO);
  });

  it("código desconhecido ainda produz mensagem acionável", () => {
    const m = mensagemLinkInvalido("coisa_nova_do_gotrue");
    assert.match(m, /novo/i);
    assert.ok(m.length > 20, "mensagem genérica demais");
  });

  it("401 do PATCH vira 'link expirou ou já foi usado'", () => {
    assert.equal(mensagemErroRedefinicao({ status: 401, message: "redefinir senha: invalid claim" }), LINK_INVALIDO);
    assert.equal(mensagemErroRedefinicao({ status: 403, message: "redefinir senha: bad_jwt" }), LINK_INVALIDO);
  });

  it("senha repetida ganha mensagem própria, não 'tente novamente'", () => {
    const m = mensagemErroRedefinicao({
      status: 422,
      codigoGoTrue: "same_password",
      message: "redefinir senha: New password should be different from the old password.",
    });
    assert.match(m, /diferente/i);
    assert.notEqual(m, LINK_INVALIDO);
  });

  it("senha fraca recusada pelo servidor ganha mensagem própria", () => {
    const m = mensagemErroRedefinicao({ status: 422, codigoGoTrue: "weak_password", message: "redefinir senha: weak" });
    assert.match(m, /fraca/i);
  });

  it("falha desconhecida cai no genérico, nunca em string vazia", () => {
    const m = mensagemErroRedefinicao({ status: 500, message: "redefinir senha: boom" });
    assert.match(m, /Tente novamente/i);
  });
});

describe("recovery — cliente Supabase não processa mais token da URL", () => {
  let cliente;
  before(() => { cliente = ler("app/src/lib/supabase.js"); });

  it("detectSessionInUrl está explicitamente desligado", () => {
    assert.match(
      cliente,
      /detectSessionInUrl:\s*false/,
      "sem isso o SDK volta a gravar na chave de sessão compartilhada",
    );
  });

  it("createClient recebe opções de auth (não é mais a chamada de 2 args)", () => {
    assert.match(cliente, /createClient\(\s*url,\s*anon,\s*\{/);
  });

  it("flowType fixado em implicit — o link precisa vir com hash, não com ?code", () => {
    assert.match(
      cliente,
      /flowType:\s*"implicit"/,
      "sem o pino, um padrão PKCE futuro quebraria a leitura do hash em silêncio",
    );
  });

  it("URL e anon key exportadas para a chamada avulsa ao GoTrue", () => {
    assert.ok(cliente.includes("export const SUPABASE_URL"), "SUPABASE_URL não exportada");
    assert.ok(cliente.includes("export const SUPABASE_ANON_KEY"), "SUPABASE_ANON_KEY não exportada");
  });

  it("a chave de serviço continua fora do front", () => {
    assert.ok(!/service_role|SERVICE_ROLE/.test(cliente.replace(/^\s*\/\/.*$/gm, "")), "service_role no front");
  });
});

describe("recovery — a troca de senha não toca a sessão compartilhada", () => {
  let dados, codigo;
  before(() => {
    dados = ler("app/src/shared/data/index.js");
    codigo = lerCodigo("app/src/shared/data/index.js");
  });

  it("redefinirSenha recebe o token do link como primeiro argumento", () => {
    assert.match(dados, /export async function redefinirSenha\(accessToken, novaSenha\)/);
  });

  it("usa fetch no endpoint do GoTrue com apikey + Bearer", () => {
    assert.ok(dados.includes("${SUPABASE_URL}/auth/v1/user"), "endpoint errado");
    assert.match(dados, /apikey:\s*SUPABASE_ANON_KEY/);
    assert.match(dados, /Authorization:\s*`Bearer \$\{accessToken\}`/);
  });

  it("nenhum caminho do seam chama setSession", () => {
    assert.ok(!codigo.includes("setSession"), "setSession sobrescreve a sessão ativa");
  });

  it("nenhum caminho do seam chama auth.updateUser", () => {
    assert.ok(!codigo.includes("auth.updateUser"), "updateUser exige sessão no singleton");
  });

  it("login normal seguiu intacto (senha e código, sem magic link)", () => {
    assert.ok(dados.includes("signInWithPassword"), "login por senha sumiu — REGRESSÃO");
    assert.ok(dados.includes("@codigo.acesso.local"), "login por código sumiu — REGRESSÃO");
  });
});

describe("recovery — o front não depende de token vindo pela URL", () => {
  it("nenhum fluxo de magic link / OAuth / PKCE no app", () => {
    // é o que autoriza desligar detectSessionInUrl sem quebrar login.
    // Se algum destes entrar depois, este teste falha e obriga a
    // reavaliar a opção do cliente antes do merge.
    const alvos = [
      "app/src/shared/data/index.js",
      "app/src/App.jsx",
      "app/src/routes/publico/Login.jsx",
      "app/src/routes/publico/PortalLogin.jsx",
      "app/src/routes/publico/RedefinirSenha.jsx",
    ];
    for (const alvo of alvos) {
      const c = lerCodigo(alvo);
      for (const proibido of ["signInWithOtp", "signInWithOAuth", "signInWithIdToken", "exchangeCodeForSession"]) {
        assert.ok(!c.includes(proibido), `${alvo} usa ${proibido} — depende de token na URL`);
      }
    }
  });
});

describe("recovery — tela de redefinição", () => {
  let tela, codigo;
  before(() => {
    tela = ler("app/src/routes/publico/RedefinirSenha.jsx");
    codigo = lerCodigo("app/src/routes/publico/RedefinirSenha.jsx");
  });

  it("lê o token do hash pelo módulo puro, não pelo cliente Supabase", () => {
    assert.ok(tela.includes("lerHashRecuperacao"), "leitura do hash ausente");
    assert.ok(!codigo.includes("lib/supabase"), "a tela importa o cliente direto");
  });

  it("passa o token do link para db.redefinirSenha", () => {
    assert.match(tela, /db\.redefinirSenha\(\s*link\.accessToken\s*,\s*senha\s*\)/);
  });

  it("NÃO chama db.sair() no sucesso — derrubaria a sessão de quem estava logado", () => {
    assert.ok(!/db\.sair\(/.test(codigo), "db.sair() de volta na tela de redefinição");
  });

  it("não tenta logar automaticamente depois de trocar a senha", () => {
    for (const proibido of ["entrarComEmail", "entrarComCodigo", "signIn"]) {
      assert.ok(!codigo.includes(proibido), `login automático via ${proibido}`);
    }
  });

  it("manda o usuário para o login normal, com hash fora do histórico", () => {
    assert.match(codigo, /window\.location\.replace\("\/"\)/);
    assert.ok(!/location\.assign|location\.href\s*=/.test(codigo), "hash com token ficaria no histórico");
  });

  it("link ausente/expirado tem tela própria de erro (não branco, não redirect)", () => {
    assert.ok(tela.includes("RECUPERACAO_VALIDA"), "sem gate de link válido");
    assert.ok(tela.includes("mensagemLinkInvalido"), "sem mensagem de link inválido");
    assert.ok(tela.includes('role="alert"'), "erro sem anúncio para leitor de tela");
  });

  it("nunca imprime o token em console", () => {
    for (const linha of tela.split("\n")) {
      const temLog = /console\.(log|info|warn|error)/.test(linha);
      const temToken = /accessToken|access_token/.test(linha);
      assert.ok(!(temLog && temToken), `linha suspeita: ${linha.trim()}`);
    }
  });
});

describe("recovery — roteamento em App.jsx", () => {
  let app, codigo;
  before(() => {
    app = ler("app/src/App.jsx");
    codigo = lerCodigo("app/src/App.jsx");
  });

  it("usa o helper compartilhado em vez de reimplementar o parse do hash", () => {
    assert.ok(app.includes("ehRotaRecuperacao"), "helper não usado");
    assert.ok(!codigo.includes("new URLSearchParams(window.location.hash"), "parse duplicado em App.jsx");
  });

  it("passa hash E caminho para o helper", () => {
    assert.match(codigo, /ehRotaRecuperacao\(window\.location\.hash,\s*window\.location\.pathname\)/);
  });

  it("a rota de recuperação continua ANTES do roteamento por papel", () => {
    const iRecuperacao = app.indexOf("detectarRecuperacao()");
    const iSessao = app.indexOf("if (!sessao)");
    assert.ok(iRecuperacao > -1 && iSessao > -1, "âncoras não encontradas");
    assert.ok(iRecuperacao < iSessao, "recuperação caiu para depois do gate de sessão");
  });
});
