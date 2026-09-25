// @ts-check
/* Jornada de AUTENTICAÇÃO (Etapa 3), contra o Auth local:
   login válido e inválido nos dois caminhos, troca obrigatória de senha,
   recuperação pelo e-mail que chega ao capturador LOCAL (Mailpit),
   logout, refresh da página e sessão expirada.

   As contas que mudam de senha (alunaTroca, coordRecuperacao) voltam ao
   estado da fixture no afterAll, para a suíte poder rodar de novo na
   mesma stack. */
import { test, expect } from "./local/base.js";
import { amb, sql, esperarEmail, fecharBanco } from "./local/api.js";
import { createClient } from "../../scripts/e2e/deps.mjs";
import {
  CONTAS, SENHA_E2E, SENHA_NOVA_E2E, coletarErros, loginAluno, loginResponsavel, loginCoordenacao, sair,
  botaoVisivel, campo, botaoEntrar, entrarCom, retratoDaTela,
} from "./_apoio.js";

const admin = createClient(amb.apiUrl, amb.serviceKey, { auth: { persistSession: false } });

test.afterAll(async () => {
  // devolve as contas que a jornada mexe ao estado da fixture
  for (const c of [CONTAS.alunaTroca, CONTAS.coordenacaoRecuperacao]) {
    await admin.auth.admin.updateUserById(c.id, { password: SENHA_E2E });
  }
  await sql("update usuarios set must_change_password = true where id = $1", [CONTAS.alunaTroca.id]);
  await fecharBanco();
});

test.describe("autenticação", { tag: ["@j:auth", "@critica"] }, () => {
  test("tela de login aparece com as duas formas de entrar", async ({ page }) => {
    const erros = coletarErros(page);
    await page.goto("/");
    await expect(page.getByRole("button", { name: /Aluno \/ Responsável/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Coordenação/ })).toBeVisible();
    await expect(botaoEntrar(page)).toBeDisabled();
    expect(erros).toEqual([]);
  });

  test("login válido por código (aluno e responsável) e por e-mail (coordenação), com logout", async ({ page }) => {
    const erros = coletarErros(page);
    await loginAluno(page, CONTAS.alunoLucas);
    await sair(page);
    await loginResponsavel(page, CONTAS.responsavelLucas);
    await sair(page);
    await loginCoordenacao(page, CONTAS.coordenacaoVitrine);
    await sair(page);
    expect(erros).toEqual([]);
  });

  test("login inválido: código inexistente e senha errada dão a MESMA mensagem", async ({ page }) => {
    await entrarCom(page, { codigo: "ZZZZ9999ZZZZ" }, "Qualquer-Senha-1");
    await expect(page.getByText("Código ou senha não reconhecidos.")).toBeVisible({ timeout: 15_000 });
    await entrarCom(page, { codigo: CONTAS.alunoLucas.codigo }, "Qualquer-Senha-1");
    await expect(page.getByText("Código ou senha não reconhecidos.")).toBeVisible({ timeout: 15_000 });
    await entrarCom(page, { email: CONTAS.coordenacaoVitrine.email }, "Qualquer-Senha-1");
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible({ timeout: 15_000 });
    // e nenhuma sessão ficou no navegador
    const chaves = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.endsWith("-auth-token")));
    expect(chaves).toEqual([]);
  });

  test("só o código não libera o botão: a senha é obrigatória", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Aluno \/ Responsável/ }).click();
    await campo(page, "Código de acesso").fill("AAAABBBBCCCC");
    await expect(botaoEntrar(page)).toBeDisabled();
  });

  test("troca obrigatória: primeiro acesso exige senha nova, e só a nova vale depois", async ({ page }) => {
    const conta = CONTAS.alunaTroca;
    await entrarCom(page, { codigo: conta.codigo }, SENHA_E2E);
    await expect(page.getByText("Escolha sua senha")).toBeVisible({ timeout: 20_000 });
    // nenhuma área aparece atrás da troca
    await expect(botaoVisivel(page, "Hoje")).toHaveCount(0);
    // a senha não pode ser o próprio código
    await campo(page, "Nova senha").fill(conta.codigo);
    await campo(page, "Confirmar senha").fill(conta.codigo);
    await page.getByRole("button", { name: "Definir senha e continuar" }).click();
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 15_000 });
    await campo(page, "Nova senha").fill(SENHA_NOVA_E2E);
    await campo(page, "Confirmar senha").fill(SENHA_NOVA_E2E);
    await page.getByRole("button", { name: "Definir senha e continuar" }).click();
    await expect(botaoVisivel(page, "Hoje"), await retratoDaTela(page)).toBeVisible({ timeout: 20_000 });
    const [u] = await sql("select must_change_password from usuarios where id = $1", [conta.id]);
    expect(u.must_change_password).toBe(false);
    await sair(page);

    await entrarCom(page, { codigo: conta.codigo }, SENHA_E2E);
    await expect(page.getByText("Código ou senha não reconhecidos."), "a senha antiga não entra mais").toBeVisible({ timeout: 15_000 });
    await entrarCom(page, { codigo: conta.codigo }, SENHA_NOVA_E2E);
    await expect(botaoVisivel(page, "Hoje")).toBeVisible({ timeout: 20_000 });
  });

  test("recuperação: o e-mail chega ao capturador local, o link redefine e a senha nova entra", async ({ page }) => {
    const conta = CONTAS.coordenacaoRecuperacao;
    const desde = Date.now() - 1000;
    await page.goto("/");
    await page.getByRole("button", { name: /Coordenação/ }).click();
    await page.getByRole("button", { name: "Esqueci minha senha" }).click();
    await page.getByLabel("E-mail", { exact: true }).fill(conta.email);
    await page.getByRole("button", { name: "Enviar instruções" }).click();
    await expect(page.getByText("Solicitação recebida")).toBeVisible({ timeout: 15_000 });

    const email = await esperarEmail(conta.email, { desde });
    const link = (email.html.match(/href="([^"]+)"/) ?? email.texto.match(/(http\S+verify\S+)/))?.[1]?.replace(/&amp;/g, "&");
    expect(link, "link de recuperação no e-mail").toBeTruthy();
    const destino = new URL(link);
    expect(["127.0.0.1", "localhost"], "o link aponta para o Auth LOCAL").toContain(destino.hostname);
    expect(destino.searchParams.get("redirect_to")).toBe(`${new URL(page.url()).origin}/redefinir-senha`);

    await page.goto(link);
    await expect(page.getByText("Definir senha")).toBeVisible({ timeout: 20_000 });
    await campo(page, "Nova senha").fill(SENHA_NOVA_E2E);
    await campo(page, "Confirmar senha").fill(SENHA_NOVA_E2E);
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    // PUT /auth/v1/user (o PATCH dava 405 em produção em 25/09)
    await expect(page.getByText("Senha alterada!"), await retratoDaTela(page)).toBeVisible({ timeout: 20_000 });

    await page.goto("/");
    await entrarCom(page, { email: conta.email }, SENHA_NOVA_E2E);
    await expect(page.getByText("Painel de gestão")).toBeVisible({ timeout: 20_000 });
  });

  test("refresh da página mantém a sessão", async ({ page }) => {
    await loginCoordenacao(page, CONTAS.coordenacaoVitrine);
    await page.reload();
    await expect(page.getByText("Painel de gestão")).toBeVisible({ timeout: 20_000 });
    await sair(page);
  });

  test("sessão expirada e revogada no servidor: volta ao login, sem tela de erro", async ({ page }) => {
    const erros = coletarErros(page);
    await loginCoordenacao(page, CONTAS.coordenacaoVitrine);
    const chave = await page.evaluate(() => Object.keys(localStorage).find((k) => k.endsWith("-auth-token")));
    expect(chave, "sessão no localStorage").toBeTruthy();
    // encerra as sessões no servidor (refresh token deixa de valer) ...
    const token = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).access_token, chave);
    const r = await fetch(`${amb.apiUrl}/auth/v1/logout?scope=global`, {
      method: "POST", headers: { apikey: amb.anonKey, authorization: `Bearer ${token}` },
    });
    expect(r.status).toBe(204);
    // ... e faz o access token local parecer vencido
    await page.evaluate((k) => {
      const s = JSON.parse(localStorage.getItem(k));
      s.expires_at = Math.floor(Date.now() / 1000) - 60;
      localStorage.setItem(k, JSON.stringify(s));
    }, chave);
    await page.reload();
    await expect(botaoEntrar(page), await retratoDaTela(page)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Algo deu errado|Não foi possível carregar seu perfil/)).toHaveCount(0);
    // o supabase-js registra no console a falha do refresh revogado; isso é
    // o esperado aqui, não erro do app
    expect(erros.filter((e) => !/refresh|Refresh Token|400|401|403/i.test(e))).toEqual([]);
  });
});
