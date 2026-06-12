// @ts-check
/* Aluno: tela inicial, cronômetro (iniciar/pausar/retomar), validações
   do registro (SEM salvar no banco) e navegação por todas as abas. */
import { test, expect } from "@playwright/test";
import { coletarErros, loginAluno, irParaAba, semEstouroHorizontal } from "./_apoio.js";

test.beforeEach(async ({ page }) => {
  await loginAluno(page);
});

test("tela inicial mostra a missão atual e o cronômetro", async ({ page }) => {
  const erros = coletarErros(page);
  await expect(page.getByRole("button", { name: "Hoje", exact: true }).first()).toBeVisible();
  // o cronômetro do aluno começa parado, pronto pra iniciar
  await expect(page.getByRole("button", { name: /Iniciar estudo/ })).toBeVisible();
  await semEstouroHorizontal(page);
  expect(erros).toEqual([]);
});

test("cronômetro: iniciar → pausar (mostra pausa) → retomar → finalizar", async ({ page }) => {
  await page.getByRole("button", { name: /Iniciar estudo/ }).click();
  await expect(page.getByText("estudando")).toBeVisible();

  await page.getByRole("button", { name: /Pausar/ }).click();
  await expect(page.getByText("em pausa")).toBeVisible();
  await expect(page.getByText("pausa", { exact: false })).toBeVisible();

  // retomar volta a contar
  await page.getByRole("button", { name: /Retomar/ }).click();
  await expect(page.getByText("estudando")).toBeVisible();

  // finalizar leva o tempo pro Registrar (não salvamos — só checamos o salto)
  await page.getByRole("button", { name: /Pausar/ }).click();
  await page.getByRole("button", { name: /Finalizar/ }).click();
  await expect(page.getByText("Registro rápido")).toBeVisible();
  // o tempo do cronômetro foi puxado pro campo Tempo
  await expect(page.getByText(/puxado do cronômetro/)).toBeVisible();
});

test("registro: tópico é obrigatório (botão fica travado sem ele)", async ({ page }) => {
  await irParaAba(page, "Registrar");
  await expect(page.getByText("Registro rápido")).toBeVisible();
  // preenche questões mas não o tópico → não pode salvar
  await page.getByLabel("Questões").fill("10");
  await expect(page.getByRole("button", { name: /Adicionar registro/ })).toBeDisabled();
  await expect(page.getByText(/Falta o/)).toBeVisible();
  // com tópico, libera
  await page.getByLabel("Tópico").fill("teste e2e — não salvar");
  await expect(page.getByRole("button", { name: /Adicionar registro/ })).toBeEnabled();
});

test("registro: acertos não podem passar das questões", async ({ page }) => {
  await irParaAba(page, "Registrar");
  await page.getByLabel("Tópico").fill("teste e2e");
  await page.getByLabel("Questões").fill("10");
  await page.getByLabel("Acertos").fill("11");
  await expect(page.getByText(/Acertos não podem passar/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Adicionar registro/ })).toBeDisabled();
});

test("registro: tempo em formato livre é entendido (1h30)", async ({ page }) => {
  await irParaAba(page, "Registrar");
  await page.getByLabel("Tempo").fill("1h30");
  await expect(page.getByText(/90 minutos/)).toBeVisible();
});

test("navega por Desempenho, Simulados, Conquistas, Histórico e Plano", async ({ page }) => {
  const erros = coletarErros(page);

  await irParaAba(page, "Desempenho");
  await expect(page.getByText(/Radar de bordo|Eficiência por setor|Inteligência incompleta/)).toBeVisible();

  await irParaAba(page, "Simulados");
  await expect(page.getByText(/Evolução nos simulados/)).toBeVisible();

  await irParaAba(page, "Conquistas");
  await expect(page.getByText(/Evolução de patentes/)).toBeVisible();

  await irParaAba(page, "Histórico");
  await irParaAba(page, "Plano");
  await expect(page.getByText(/Missão/).first()).toBeVisible();

  await semEstouroHorizontal(page);
  expect(erros).toEqual([]);
});
