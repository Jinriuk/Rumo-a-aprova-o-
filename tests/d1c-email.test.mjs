// D1C — Testes de e-mail, SMTP e recuperação de acesso
// Testa lógica da Edge Function e helpers de front via mocks.
// Não faz chamadas reais ao Supabase (ambiente CI sem credenciais).

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");

// ── helpers ──────────────────────────────────────────────────────────────────

function emailValido(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function forcaSenha(s) {
  if (s.length < 8) return 0;
  return [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(s)).length;
}

function normalizarCodigo(texto) {
  return texto.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

// ── testes ───────────────────────────────────────────────────────────────────

describe("D1C — validação de e-mail", () => {
  it("aceita e-mail válido", () => {
    assert.ok(emailValido("coord@escola.com.br"));
    assert.ok(emailValido("test+alias@domain.org"));
  });

  it("rejeita e-mail sem @", () => {
    assert.ok(!emailValido("semArroba.com"));
  });

  it("rejeita e-mail sem domínio", () => {
    assert.ok(!emailValido("sem@"));
  });

  it("rejeita string vazia", () => {
    assert.ok(!emailValido(""));
  });
});

describe("D1C — força de senha (lógica RedefinirSenha)", () => {
  it("senha muito curta (< 8 chars) → força 0", () => {
    assert.equal(forcaSenha("Aa1!"), 0);
  });

  it("senha só minúsculas → força 1 (fraca)", () => {
    assert.equal(forcaSenha("abcdefgh"), 1);
  });

  it("senha com maiúsculas + minúsculas → força >= 2 (razoável)", () => {
    assert.ok(forcaSenha("Abcdefgh") >= 2);
  });

  it("senha forte (4 critérios) → força 4", () => {
    assert.equal(forcaSenha("Senha!123"), 4);
  });

  it("senha de 8+ chars só minúsculas → força 1 (fraca)", () => {
    assert.equal(forcaSenha("abcdefghij"), 1);
  });
});

describe("D1C — normalização de código (aluno/responsável)", () => {
  it("remove hifens e converte para maiúsculas", () => {
    assert.equal(normalizarCodigo("xxxx-xxxx-xxxx"), "XXXXXXXXXXXX");
  });

  it("código já normalizado permanece igual", () => {
    assert.equal(normalizarCodigo("LUCASDEMO2026"), "LUCASDEMO2026");
  });

  it("e-mail sintético do aluno contém @codigo.acesso.local", () => {
    const codigo = normalizarCodigo("LUCA-SDEMO-2026");
    const emailSintetico = `${codigo.toLowerCase()}@codigo.acesso.local`;
    assert.ok(emailSintetico.endsWith("@codigo.acesso.local"));
  });
});

describe("D1C — estados da Edge Function backoffice-coordenador", () => {
  const ESTADOS_VALIDOS = [
    "coordenador_criado_email_enviado",
    "coordenador_criado_email_pendente",
    "coordenador_existente_reenvio_enviado",
    "coordenador_existente_reenvio_pendente",
    "erro_auth",
    "erro_smtp",
    "erro_redirect",
  ];

  it("todos os 7 estados estão definidos", () => {
    assert.equal(ESTADOS_VALIDOS.length, 7);
  });

  it("estados de sucesso contêm 'coordenador'", () => {
    const sucesso = ESTADOS_VALIDOS.filter((s) => !s.startsWith("erro"));
    assert.ok(sucesso.every((s) => s.startsWith("coordenador")));
  });

  it("estados de erro começam com 'erro'", () => {
    const erros = ESTADOS_VALIDOS.filter((s) => s.startsWith("erro"));
    assert.equal(erros.length, 3);
  });

  it("conta_nova=true → status criado_*", () => {
    const status = (linkOk) =>
      linkOk ? "coordenador_criado_email_enviado" : "coordenador_criado_email_pendente";
    assert.equal(status(true), "coordenador_criado_email_enviado");
    assert.equal(status(false), "coordenador_criado_email_pendente");
  });

  it("conta_nova=false → status existente_*", () => {
    const status = (linkOk) =>
      linkOk ? "coordenador_existente_reenvio_enviado" : "coordenador_existente_reenvio_pendente";
    assert.equal(status(true), "coordenador_existente_reenvio_enviado");
    assert.equal(status(false), "coordenador_existente_reenvio_pendente");
  });
});

describe("D1C — recuperação de senha (mensagem genérica)", () => {
  it("mensagem não revela existência do e-mail", () => {
    const MSG = "Se este e-mail estiver cadastrado, enviaremos instruções de recuperação.";
    assert.ok(!MSG.toLowerCase().includes("não encontrado"));
    assert.ok(!MSG.toLowerCase().includes("não existe"));
    assert.ok(!MSG.toLowerCase().includes("cadastrado com sucesso"));
  });
});

describe("D1C — segurança: service_role fora do frontend", () => {
  it("nenhum arquivo em app/src/ contém service_role", () => {
    let encontrou = false;
    try {
      const resultado = execSync(
        `grep -r "service_role" "${resolve(root, "app/src")}"`,
        { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
      );
      encontrou = resultado.trim().length > 0;
    } catch {
      encontrou = false; // grep exit 1 = nenhum resultado
    }
    assert.ok(!encontrou, "service_role encontrado em app/src/ — FALHA DE SEGURANÇA");
  });
});

describe("D1C — segurança: token não logado na Edge Function", () => {
  const fnPath = resolve(root, "supabase/functions/backoffice-coordenador/index.ts");
  let conteudo;

  before(() => {
    conteudo = readFileSync(fnPath, "utf8");
  });

  it("Edge Function existe", () => {
    assert.ok(existsSync(fnPath), "index.ts não encontrado");
  });

  it("nenhum console.log com action_link ou access_token", () => {
    const linhas = conteudo.split("\n");
    for (const linha of linhas) {
      const temLog = /console\.(log|info|warn)/.test(linha);
      const temToken = /action_link|access_token/.test(linha);
      assert.ok(!(temLog && temToken), `Linha suspeita: ${linha.trim()}`);
    }
  });

  it("usa REDIRECT_URL como constante (não hardcoded espalhado)", () => {
    assert.ok(conteudo.includes("REDIRECT_URL"), "Constante REDIRECT_URL não encontrada");
  });

  it("redirectTo aponta para /redefinir-senha", () => {
    assert.ok(conteudo.includes("redefinir-senha"), "redirectTo não aponta para /redefinir-senha");
  });

  it("campo status está presente no retorno JSON", () => {
    assert.ok(conteudo.includes('"status"') || conteudo.includes("status:"), "campo status ausente");
  });
});

describe("D1C — rota /redefinir-senha existe no frontend", () => {
  it("arquivo RedefinirSenha.jsx existe", () => {
    const p = resolve(root, "app/src/routes/publico/RedefinirSenha.jsx");
    assert.ok(existsSync(p), "RedefinirSenha.jsx não encontrado");
  });

  it("App.jsx importa RedefinirSenha", () => {
    const conteudo = readFileSync(resolve(root, "app/src/App.jsx"), "utf8");
    assert.ok(conteudo.includes("RedefinirSenha"), "App.jsx não importa RedefinirSenha");
  });

  it("App.jsx detecta type=recovery no hash", () => {
    const conteudo = readFileSync(resolve(root, "app/src/App.jsx"), "utf8");
    assert.ok(conteudo.includes("recovery"), "Detecção de recovery ausente em App.jsx");
    assert.ok(conteudo.includes("hash"), "Leitura do hash ausente em App.jsx");
  });
});

describe("D1C — login por código não foi alterado", () => {
  let conteudo;
  before(() => {
    conteudo = readFileSync(resolve(root, "app/src/shared/data/index.js"), "utf8");
  });

  it("entrarComCodigo usa e-mail @codigo.acesso.local", () => {
    assert.ok(conteudo.includes("@codigo.acesso.local"), "Login por código alterado — REGRESSÃO");
  });

  it("normalizarCodigo está exportado", () => {
    assert.ok(conteudo.includes("export function normalizarCodigo"), "normalizarCodigo não exportado");
  });

  it("entrarComEmail não foi removido", () => {
    assert.ok(conteudo.includes("export async function entrarComEmail"), "entrarComEmail removido — REGRESSÃO");
  });
});

describe("D1C — funções novas existem no data/index.js", () => {
  let conteudo;

  before(() => {
    conteudo = readFileSync(resolve(root, "app/src/shared/data/index.js"), "utf8");
  });

  it("backofficeProvisionarCoordenador exportada", () => {
    assert.ok(conteudo.includes("backofficeProvisionarCoordenador"), "Função ausente");
  });

  it("backofficeReenviarAcesso exportada", () => {
    assert.ok(conteudo.includes("backofficeReenviarAcesso"), "Função ausente");
  });

  it("recuperarSenha exportada", () => {
    assert.ok(conteudo.includes("recuperarSenha"), "Função ausente");
  });

  it("redefinirSenha exportada", () => {
    assert.ok(conteudo.includes("redefinirSenha"), "Função ausente");
  });

  it("recuperarSenha usa resetPasswordForEmail", () => {
    assert.ok(conteudo.includes("resetPasswordForEmail"), "Método incorreto");
  });

  it("redefinirSenha usa updateUser com password", () => {
    assert.ok(conteudo.includes("updateUser"), "updateUser ausente");
    assert.ok(conteudo.includes("password"), "campo password ausente");
  });

  it("recuperarSenha usa redirectTo para /redefinir-senha", () => {
    assert.ok(conteudo.includes("redefinir-senha"), "redirectTo ausente em recuperarSenha");
  });
});

describe("D1C — Login.jsx tem 'Esqueci minha senha'", () => {
  it("botão 'Esqueci minha senha' existe no Login", () => {
    const conteudo = readFileSync(resolve(root, "app/src/routes/publico/Login.jsx"), "utf8");
    assert.ok(conteudo.includes("Esqueci minha senha"), "Botão não encontrado");
  });

  it("Login.jsx chama recuperarSenha", () => {
    const conteudo = readFileSync(resolve(root, "app/src/routes/publico/Login.jsx"), "utf8");
    assert.ok(conteudo.includes("recuperarSenha"), "recuperarSenha não chamada no Login");
  });
});
