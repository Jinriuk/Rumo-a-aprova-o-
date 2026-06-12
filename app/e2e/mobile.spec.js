// @ts-check
/* Mobile (projeto "mobile", ~390px): sem estouro horizontal em cada
   papel e barra de navegação inferior presente para aluno/coordenação. */
import { test, expect } from "@playwright/test";
import {
  CONTAS, coletarErros, loginAluno, loginResponsavel, loginCoordenacao, semEstouroHorizontal,
} from "./_apoio.js";

// só faz sentido no viewport de celular
test.skip(({ }, testInfo) => testInfo.project.name !== "mobile", "apenas no projeto mobile");

test("aluno em 390px: sem estouro e com barra inferior", async ({ page }) => {
  const erros = coletarErros(page);
  await loginAluno(page, CONTAS.alunoLucas);
  await semEstouroHorizontal(page);
  // a barra inferior traz as 4 abas principais + "Mais"
  await expect(page.getByRole("button", { name: "Hoje", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mais", exact: true })).toBeVisible();
  expect(erros).toEqual([]);
});

test("coordenação em 390px: sem estouro e com barra inferior", async ({ page }) => {
  const erros = coletarErros(page);
  await loginCoordenacao(page, CONTAS.coordenacaoVitrine);
  await semEstouroHorizontal(page);
  await expect(page.getByRole("button", { name: "Painel", exact: true })).toBeVisible();
  expect(erros).toEqual([]);
});

test("responsável em 390px: sem estouro horizontal", async ({ page }) => {
  await loginResponsavel(page, CONTAS.responsavelLucas);
  await expect(page.getByText("Atividades da semana")).toBeVisible({ timeout: 15_000 });
  await semEstouroHorizontal(page);
});
