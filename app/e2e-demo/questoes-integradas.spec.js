/* P1.1 — questões integradas de ponta a ponta no DEMO.
   Aluno PMERJ de teste (criado para a ocasião, apagado depois) entra
   pelo código, vê "Resolver questões aqui" na M01-ADM, recebe um lote de
   5 questões, responde as 5 e vê a correção feita no servidor.
   Ver playwright.demo.config.js para rodar. Gasta créditos da Quest se a
   missão ainda não tiver estoque guardado. */
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { transporteDemo } from "./_transporte.js";

const MISSAO = "Organização administrativa: direta, indireta e delegação";
const SAIDA = process.env.DEMO_SAIDA || "e2e-demo-resultados";

test("aluno PMERJ resolve um lote de 5 questões da M01-ADM, corrigidas no servidor", async ({ page }) => {
  test.skip(!process.env.DEMO_ALUNO_CODIGO || !process.env.DEMO_ALUNO_SENHA, "sem aluno de teste do demo");
  mkdirSync(SAIDA, { recursive: true });
  const chamadas = [];
  page.on("response", (r) => {
    if (/functions\/v1\/questoes-integradas/.test(r.url())) chamadas.push(r.status());
  });
  await transporteDemo(page);

  await page.goto("/");
  await page.getByRole("button", { name: /Aluno \/ Responsável/ }).click();
  await page.getByLabel("Código de acesso", { exact: true }).fill(process.env.DEMO_ALUNO_CODIGO);
  await page.getByLabel("Senha", { exact: true }).fill(process.env.DEMO_ALUNO_SENHA);
  await page.getByRole("button", { name: /^Entrar na missão/ }).click();

  // o botão aparece na missão ligada
  const cartao = page.locator("li").filter({ hasText: MISSAO }).first();
  const botao = cartao.getByRole("button", { name: "Resolver questões aqui" });
  await expect(botao).toBeVisible({ timeout: 45_000 });
  await page.screenshot({ path: `${SAIDA}/1-botao.png`, fullPage: true });
  await botao.click();

  // lote de 5, sem gabarito à vista
  const contador = page.getByText(/^Questão 1 de \d+$/);
  await expect(contador).toBeVisible({ timeout: 45_000 });
  const total = Number((await contador.textContent()).match(/de (\d+)/)[1]);
  expect(total, "o lote pedido é de 5 questões").toBe(5);
  await expect(page.getByText(/Gabarito:/)).toHaveCount(0);
  await page.screenshot({ path: `${SAIDA}/2-questao.png`, fullPage: true });

  // responde as 5: correção vem do servidor (Certa. / Errada. Gabarito: X.)
  for (let i = 1; i <= total; i++) {
    await expect(page.getByText(`Questão ${i} de ${total}`)).toBeVisible();
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Confirmar resposta" }).click();
    await expect(page.getByText(/^(Certa\.|Errada\. Gabarito: [A-J]\.)$/)).toBeVisible({ timeout: 30_000 });
    if (i === 1) await page.screenshot({ path: `${SAIDA}/3-correcao.png`, fullPage: true });
    await page.getByRole("button", { name: i < total ? "Próxima questão" : "Ver resultado" }).click();
  }

  // resultado do lote
  await expect(page.getByText(/^\d de 5 certas?$/)).toBeVisible();
  await page.screenshot({ path: `${SAIDA}/4-resultado.png`, fullPage: true });
  expect(chamadas.filter((s) => s >= 400), "nenhuma chamada à função falhou").toEqual([]);
  expect(chamadas.length, "1 entrega + 5 respostas").toBe(6);
});
