/* P1.1 — o caminho do dono, de ponta a ponta no DEMO:
   coordenação cadastra um aluno no CFO PMERJ (antes da correção o
   cadastro bloqueava o concurso: o front o tratava como "Indisponível"),
   gera a credencial, o aluno entra com a senha temporária, troca a senha,
   toca em "Iniciar missão" na M01-ADM, fica com o lote de 5 e o resolve.
   Precisa de uma coordenação de teste numa escola de teste:
     DEMO_COORD_EMAIL=... DEMO_COORD_SENHA=... (ver playwright.demo.config.js)
   O aluno criado fica com o nome "Aluno jornada P1.1 <sufixo>" para a
   limpeza achar. Código e senha do aluno só existem na memória do teste. */
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { transporteDemo } from "./_transporte.js";

const MISSAO = "Organização administrativa: direta, indireta e delegação";
const SAIDA = process.env.DEMO_SAIDA || "e2e-demo-resultados";

test("coordenação cadastra aluno PMERJ, gera credencial e o aluno resolve 5 questões", async ({ browser }) => {
  const email = process.env.DEMO_COORD_EMAIL;
  const senhaCoord = process.env.DEMO_COORD_SENHA || process.env.DEMO_ALUNO_SENHA;
  test.skip(!email || !senhaCoord, "sem coordenação de teste do demo");
  mkdirSync(SAIDA, { recursive: true });
  const nome = `Aluno jornada P1.1 ${Date.now().toString(36)}`;

  // 1) coordenação: cadastro no CFO PMERJ
  const ctxCoord = await browser.newContext();
  const coord = await ctxCoord.newPage();
  await transporteDemo(coord);
  await coord.goto("/");
  await coord.getByRole("button", { name: /Coordenação/ }).click();
  await coord.getByLabel("E-mail", { exact: true }).fill(email);
  await coord.getByLabel("Senha", { exact: true }).fill(senhaCoord);
  await coord.getByRole("button", { name: /^Entrar na missão/ }).click();
  await expect(coord.getByText("Painel de gestão")).toBeVisible({ timeout: 45_000 });
  await coord.getByRole("button", { name: /^Alunos(\s+\d+)?$/ }).filter({ visible: true }).first().click();
  await coord.getByRole("button", { name: /Cadastrar alunos/ }).click();
  await coord.getByLabel("Nome do aluno", { exact: true }).fill(nome);
  const concurso = coord.getByLabel("Concurso", { exact: true });
  const opcao = await concurso.locator("option", { hasText: "CFO PMERJ" }).first().getAttribute("value");
  await concurso.selectOption(opcao);
  await expect(coord.getByText("Este concurso está indisponível")).toHaveCount(0);
  await expect(coord.getByRole("button", { name: "+ Cadastrar aluno" })).toBeEnabled();
  await coord.screenshot({ path: `${SAIDA}/j1-cadastro.png`, fullPage: true });
  await coord.getByRole("button", { name: "+ Cadastrar aluno" }).click();
  await expect(coord.getByText(`${nome} cadastrado. Gere a credencial na lista abaixo.`)).toBeVisible({ timeout: 30_000 });

  // 2) credencial
  await coord.getByRole("textbox", { name: "Buscar aluno por nome" }).fill(nome);
  await coord.getByRole("button", { name: "Gerar credencial" }).first().click();
  const codigoEl = coord.getByText("Código (identificação)").locator("xpath=following-sibling::div[1]");
  const senhaEl = coord.getByText("Senha temporária").locator("xpath=following-sibling::div[1]");
  await expect(codigoEl).toBeVisible({ timeout: 30_000 });
  const codigo = (await codigoEl.innerText()).trim();
  const senhaTemp = (await senhaEl.innerText()).trim();
  await coord.getByRole("button", { name: "Entreguei, fechar" }).click();
  await ctxCoord.close();

  // 3) aluno: primeira entrada, troca de senha
  const ctxAluno = await browser.newContext();
  const page = await ctxAluno.newPage();
  await transporteDemo(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Aluno \/ Responsável/ }).click();
  await page.getByLabel("Código de acesso", { exact: true }).fill(codigo);
  await page.getByLabel("Senha", { exact: true }).fill(senhaTemp);
  await page.getByRole("button", { name: /^Entrar na missão/ }).click();
  await expect(page.getByText("Escolha sua senha")).toBeVisible({ timeout: 45_000 });
  // minúscula, maiúscula e dígito garantidos: o Auth do demo exige os três
  const nova = `Nova-7${randomBytes(9).toString("base64url")}`;
  await page.getByLabel("Nova senha", { exact: true }).fill(nova);
  await page.getByLabel("Confirmar senha", { exact: true }).fill(nova);
  await page.getByRole("button", { name: "Definir senha e continuar" }).click();

  // 4) o botão e o lote
  await expect(page.getByText("Este concurso ainda não recebe alunos")).toHaveCount(0, { timeout: 45_000 });
  const botao = page.locator("li").filter({ hasText: MISSAO }).first().getByRole("button", { name: "Iniciar missão" });
  await expect(botao).toBeVisible({ timeout: 45_000 });
  await page.screenshot({ path: `${SAIDA}/j2-hoje-aluno.png`, fullPage: true });
  await botao.click();
  await expect(page.getByText("Quantas questões por vez?")).toBeVisible();
  await page.getByRole("button", { name: "Começar" }).click();
  const contador = page.getByText(/^Questão 1 de \d+$/);
  await expect(contador).toBeVisible({ timeout: 45_000 });
  const total = Number((await contador.textContent()).match(/de (\d+)/)[1]);
  expect(total).toBe(5);
  for (let i = 1; i <= total; i++) {
    await expect(page.getByText(`Questão ${i} de ${total}`)).toBeVisible();
    await page.getByRole("radio").nth(i % 2).check();
    await page.getByRole("button", { name: "Confirmar resposta" }).click();
    await expect(page.getByText(/^(Certa\.|Errada\. Gabarito: [A-J]\.)$/)).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: i < total ? "Próxima questão" : "Ver resultado" }).click();
  }
  await expect(page.getByText(/^\d de 5 certas?$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar: mais 5" })).toBeVisible();
  await page.screenshot({ path: `${SAIDA}/j3-resultado.png`, fullPage: true });
  await ctxAluno.close();
});
