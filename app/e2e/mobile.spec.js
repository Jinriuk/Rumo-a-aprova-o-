// @ts-check
/* Mobile (projeto "mobile", ~390px): sem estouro horizontal em cada
   papel e barra de navegação inferior presente para aluno/coordenação. */
import { test, expect } from "@playwright/test";
import {
  CONTAS, coletarErros, loginAluno, loginResponsavel, loginCoordenacao, semEstouroHorizontal, botaoVisivel,
} from "./_apoio.js";

// só faz sentido no viewport de celular
test.skip(({ }, testInfo) => testInfo.project.name !== "mobile", "apenas no projeto mobile");

test("aluno em 390px: sem estouro e com barra inferior", async ({ page }) => {
  const erros = coletarErros(page);
  await loginAluno(page, CONTAS.alunoLucas);
  await semEstouroHorizontal(page);
  // a barra inferior traz as 4 abas principais + "Mais"
  await expect(botaoVisivel(page, "Hoje")).toBeVisible();
  await expect(botaoVisivel(page, "Mais")).toBeVisible();
  expect(erros).toEqual([]);
});

test("coordenação em 390px: sem estouro e com barra inferior", async ({ page }) => {
  const erros = coletarErros(page);
  await loginCoordenacao(page, CONTAS.coordenacaoVitrine);
  await semEstouroHorizontal(page);
  await expect(botaoVisivel(page, "Painel")).toBeVisible();
  expect(erros).toEqual([]);
});

test("responsável em 390px: sem estouro horizontal", async ({ page }) => {
  await loginResponsavel(page, CONTAS.responsavelLucas);
  await expect(page.getByText("Atividades da semana")).toBeVisible({ timeout: 15_000 });
  await semEstouroHorizontal(page);
});
