// @ts-check
/* Responsável: experiência de LEITURA. Vê resumo, meta, desempenho e
   último simulado — e NÃO tem nenhum controle de edição/registro. */
import { test, expect } from "@playwright/test";
import { coletarErros, loginResponsavel, semEstouroHorizontal } from "./_apoio.js";

test.beforeEach(async ({ page }) => {
  await loginResponsavel(page);
});

test("vê o resumo do aluno vinculado (meta, desempenho, matérias)", async ({ page }) => {
  const erros = coletarErros(page);
  // frase interpretativa + blocos de leitura
  await expect(page.getByText("Atividades da semana")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Desempenho por matéria")).toBeVisible();
  await expect(page.getByText("Meta da semana").first()).toBeVisible();
  await semEstouroHorizontal(page);
  expect(erros).toEqual([]);
});

test("NÃO tem controles de edição/registro/conclusão", async ({ page }) => {
  await expect(page.getByText("Atividades da semana")).toBeVisible({ timeout: 15_000 });
  // nada de cronômetro, registro ou abas de aluno
  await expect(page.getByRole("button", { name: /Iniciar estudo/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Adicionar registro/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Registrar", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Concluir/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Adiar/ })).toHaveCount(0);
});
