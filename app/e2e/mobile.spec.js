// @ts-check
/* Jornada MOBILE (projeto "mobile", Pixel 7): cada papel sem estouro
   horizontal, navegação pela barra inferior e uma escrita de verdade no
   celular (o aluno registra estudo e o dado persiste). */
import { test, expect } from "./local/base.js";
import { sql, fecharBanco } from "./local/api.js";
import {
  CONTAS, coletarErros, loginAluno, loginResponsavel, loginCoordenacao, semEstouroHorizontal, botaoVisivel,
  irParaAba, campo, sufixo,
} from "./_apoio.js";

test.afterAll(async () => { await fecharBanco(); });

test.describe("mobile", { tag: ["@j:mobile", "@critica"] }, () => {
  test("aluno: sem estouro, barra inferior com Mais e troca de aba", async ({ page }) => {
    const erros = coletarErros(page);
    await loginAluno(page, CONTAS.alunoLucas);
    await semEstouroHorizontal(page);
    await expect(botaoVisivel(page, "Hoje")).toBeVisible();
    await expect(botaoVisivel(page, "Mais")).toBeVisible();
    await irParaAba(page, "Conquistas"); // fica atrás do "Mais" no celular
    await expect(page.getByText(/Evolução de patentes/)).toBeVisible();
    await semEstouroHorizontal(page);
    expect(erros).toEqual([]);
  });

  test("aluno registra estudo no celular e o registro persiste", async ({ page }) => {
    const conta = CONTAS.alunoJornada;
    const topico = `E2E celular ${sufixo()}`;
    await loginAluno(page, conta);
    await irParaAba(page, "Registrar");
    await campo(page, "Tópico *").fill(topico);
    await campo(page, "Questões").fill("5");
    await campo(page, "Acertos").fill("4");
    await page.getByRole("button", { name: "Confirmar estudo" }).click();
    await expect(page.getByRole("heading", { name: "Seu estudo entrou no radar." })).toBeVisible({ timeout: 15_000 });
    await semEstouroHorizontal(page);
    const [r] = await sql("select count(*)::int as n from registros_estudo where aluno_id = $1 and topico = $2", [conta.alunoId, topico]);
    expect(r.n).toBe(1);
  });

  test("coordenação: sem estouro e com barra inferior", async ({ page }) => {
    const erros = coletarErros(page);
    await loginCoordenacao(page, CONTAS.coordenacaoVitrine);
    await semEstouroHorizontal(page);
    await expect(botaoVisivel(page, "Painel")).toBeVisible();
    await irParaAba(page, "Alunos");
    await expect(page.getByText("Alunos da escola")).toBeVisible();
    await semEstouroHorizontal(page);
    expect(erros).toEqual([]);
  });

  test("responsável: sem estouro horizontal", async ({ page }) => {
    await loginResponsavel(page, CONTAS.responsavelLucas);
    await expect(page.getByText("Atividades da semana")).toBeVisible({ timeout: 15_000 });
    await semEstouroHorizontal(page);
  });
});
