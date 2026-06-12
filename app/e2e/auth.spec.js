// @ts-check
/* Autenticação: login dos três papéis, logout e rejeição de credencial. */
import { test, expect } from "@playwright/test";
import { CONTAS, coletarErros, loginAluno, loginResponsavel, loginCoordenacao, sair } from "./_apoio.js";

test("tela de login aparece com as duas formas de entrar", async ({ page }) => {
  const erros = coletarErros(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Aluno \/ Responsável/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Coordenação/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeDisabled(); // sem credencial ainda
  expect(erros).toEqual([]);
});

test("código inválido é rejeitado com mensagem clara", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Aluno \/ Responsável/ }).click();
  await page.getByPlaceholder("XXXX-XXXX-XXXX").fill("AAAABBBBCCCC");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText(/Código não reconhecido/)).toBeVisible({ timeout: 15_000 });
});

test("login do aluno (código) e logout", async ({ page }) => {
  const erros = coletarErros(page);
  await loginAluno(page, CONTAS.alunoLucas);
  await expect(page.getByRole("button", { name: "Hoje", exact: true }).first()).toBeVisible();
  await sair(page);
  expect(erros).toEqual([]);
});

test("login do responsável (código) e logout", async ({ page }) => {
  await loginResponsavel(page, CONTAS.responsavelLucas);
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
  await sair(page);
});

test("login da coordenação (e-mail+senha) e logout", async ({ page }) => {
  const erros = coletarErros(page);
  await loginCoordenacao(page, CONTAS.coordenacaoVitrine);
  await expect(page.getByText("Painel de gestão")).toBeVisible();
  await sair(page);
  expect(erros).toEqual([]);
});
