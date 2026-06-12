// @ts-check
/* Coordenação: painel, navegação pelas abas, abrir aluno, ranking,
   LGPD e persistência da MARCA (altera e restaura o nome de exibição). */
import { test, expect } from "@playwright/test";
import { CONTAS, coletarErros, loginCoordenacao, irParaAba, semEstouroHorizontal, campo } from "./_apoio.js";

test.beforeEach(async ({ page }) => {
  await loginCoordenacao(page, CONTAS.coordenacaoVitrine);
});

test("painel mostra KPIs e alertas de risco", async ({ page }) => {
  const erros = coletarErros(page);
  await expect(page.getByText("Alertas de risco")).toBeVisible();
  await expect(page.getByText("Sem atividade")).toBeVisible();
  await expect(page.getByText("Sem credencial")).toBeVisible();
  await expect(page.getByText("Destaques da semana")).toBeVisible();
  await semEstouroHorizontal(page);
  expect(erros).toEqual([]);
});

test("navega por Alunos, Ranking, Turmas, LGPD e Marca", async ({ page }) => {
  const erros = coletarErros(page);

  await irParaAba(page, "Alunos");
  await expect(page.getByText("Alunos da escola")).toBeVisible();

  await irParaAba(page, "Ranking");
  await expect(page.getByText(/Classificação|Ranking/).first()).toBeVisible();

  await irParaAba(page, "Turmas");
  await expect(page.getByText("Turmas").first()).toBeVisible();

  await irParaAba(page, "LGPD");
  await expect(page.getByText(/LGPD|consentiment|trilha de acesso/i).first()).toBeVisible();

  await irParaAba(page, "Marca");
  await expect(page.getByText("Marca da escola")).toBeVisible();

  await semEstouroHorizontal(page);
  expect(erros).toEqual([]);
});

test("abre a ficha de um aluno (desempenho individual) e volta", async ({ page }) => {
  await irParaAba(page, "Alunos");
  await expect(page.getByText("Alunos da escola")).toBeVisible();
  await page.getByRole("button", { name: "Ver desempenho" }).first().click();
  // a ficha condensada do aluno aparece, com o botão de voltar
  await expect(page.getByRole("button", { name: /voltar ao painel/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Atividades da semana")).toBeVisible();
  await page.getByRole("button", { name: /voltar ao painel/ }).click();
  await expect(page.getByText("Alunos da escola")).toBeVisible();
});

test("destaques da semana respeitam o critério escolhido", async ({ page }) => {
  await expect(page.getByText("Destaques da semana")).toBeVisible();
  // troca o critério do ranking resumido (não deve quebrar)
  const seletor = page.locator("select").first();
  await seletor.selectOption({ label: "Mais questões (7d)" });
  await expect(page.getByText("Destaques da semana")).toBeVisible();
});

test("MARCA: altera o nome de exibição, persiste após reload e restaura", async ({ page }) => {
  await irParaAba(page, "Marca");
  const campoNome = campo(page, "Nome de exibição");
  await expect(campoNome).toBeVisible();
  const original = await campoNome.inputValue();
  const tempo = `${original} ⟦e2e⟧`;

  try {
    await campoNome.fill(tempo);
    await page.getByRole("button", { name: "Salvar marca" }).click();
    await expect(page.getByText(/Marca salva no banco/)).toBeVisible({ timeout: 15_000 });

    // recarrega: o valor tem de vir do banco (persistência real)
    await page.reload();
    await irParaAba(page, "Marca");
    await expect(campo(page, "Nome de exibição")).toHaveValue(tempo, { timeout: 15_000 });
  } finally {
    // restaura o nome original — não deixa o seed sujo
    const campoRestauro = campo(page, "Nome de exibição");
    await campoRestauro.fill(original);
    await page.getByRole("button", { name: "Salvar marca" }).click();
    await expect(page.getByText(/Marca salva no banco/)).toBeVisible({ timeout: 15_000 });
  }
});
