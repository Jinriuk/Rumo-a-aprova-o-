// @ts-check
/* Jornada do ALUNO (Etapa 3): Hoje, trilha, metas, registro de estudo e
   simulado, com os dados conferidos no banco local e de novo depois de
   atualizar a página (persistência de verdade, não estado de tela).

   Conta dedicada (alunoJornada, aluno do seed 13 com meta ativa): as
   escritas daqui não mexem no Lucas, que a jornada do responsável lê. */
import { test, expect } from "./local/base.js";
import { sql, fecharBanco } from "./local/api.js";
import {
  CONTAS, coletarErros, loginAluno, irParaAba, semEstouroHorizontal, campo, botaoVisivel, sufixo, retratoDaTela,
} from "./_apoio.js";

const CONTA = CONTAS.alunoJornada;

test.afterAll(async () => { await fecharBanco(); });

test.describe("aluno", { tag: ["@j:aluno", "@critica"] }, () => {
  test.beforeEach(async ({ page }) => {
    await loginAluno(page, CONTA);
  });

  test("Hoje mostra a missão da semana, o cronômetro e o XP", async ({ page }) => {
    const erros = coletarErros(page);
    await expect(page.getByText(/Sua missão: concluir \d+ objetivos/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Iniciar estudo/ })).toBeVisible();
    await expect(page.getByText(/\d[\d.]*\s*XP/).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Objetivos da semana" })).toBeVisible();
    await semEstouroHorizontal(page);
    expect(erros).toEqual([]);
  });

  test("trilha: plano e missões do concurso do aluno", async ({ page }) => {
    const erros = coletarErros(page);
    await irParaAba(page, "Trilha");
    await expect(page.getByRole("heading", { name: "Trilha do concurso" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Missões do seu concurso" })).toBeVisible();
    expect(erros).toEqual([]);
  });

  test("metas: concluir um objetivo grava no banco e continua concluído depois de atualizar", async ({ page }) => {
    const contador = page.getByText(/^\d+ de \d+ concluídos$/).first();
    await expect(contador).toBeVisible();
    const [antes] = await sql(
      `select count(*) filter (where ma.estado = 'concluida')::int as feitas
         from meta_atividades ma join metas m on m.id = ma.meta_id
        where m.aluno_id = $1 and m.status = 'ativa'`, [CONTA.alunoId]);
    const textoAntes = await contador.innerText();

    await page.getByRole("button", { name: "✓ Concluir" }).first().click();
    await expect(contador).not.toHaveText(textoAntes, { timeout: 15_000 });

    const [depois] = await sql(
      `select count(*) filter (where ma.estado = 'concluida')::int as feitas
         from meta_atividades ma join metas m on m.id = ma.meta_id
        where m.aluno_id = $1 and m.status = 'ativa'`, [CONTA.alunoId]);
    expect(depois.feitas, "uma atividade a mais concluída no banco").toBe(antes.feitas + 1);

    await page.reload();
    await expect(page.getByText(/^\d+ de \d+ concluídos$/).first()).toHaveText(`${depois.feitas} de ${textoAntes.match(/de (\d+)/)[1]} concluídos`, { timeout: 15_000 });
  });

  test("registro de estudo: salva, aparece nos recentes e sobrevive ao refresh", async ({ page }) => {
    const topico = `E2E registro ${sufixo()}`;
    await irParaAba(page, "Registrar");
    await expect(page.getByRole("heading", { name: "Registro rápido" })).toBeVisible();
    await campo(page, "Matéria").selectOption({ label: "Matemática" });
    await campo(page, "Tópico *").fill(topico);
    await campo(page, "Questões").fill("12");
    await campo(page, "Acertos").fill("9");
    await campo(page, "Tempo").fill("35min");
    await page.getByRole("button", { name: "Confirmar estudo" }).click();
    await expect(page.getByRole("heading", { name: "Seu estudo entrou no radar." }), await retratoDaTela(page)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Registrar outro estudo" }).click();
    await expect(page.getByText(new RegExp(`Matemática · ${topico}`))).toBeVisible({ timeout: 15_000 });

    const linhas = await sql("select questoes, acertos, minutos, disciplina_codigo from registros_estudo where aluno_id = $1 and topico = $2", [CONTA.alunoId, topico]);
    expect(linhas).toEqual([{ questoes: 12, acertos: 9, minutos: 35, disciplina_codigo: "mat" }]);

    await page.reload();
    await irParaAba(page, "Registrar");
    await expect(page.getByText(new RegExp(`Matemática · ${topico}`))).toBeVisible({ timeout: 15_000 });
  });

  test("registro: validações (tópico obrigatório, acertos ≤ questões, tempo livre)", async ({ page }) => {
    await irParaAba(page, "Registrar");
    await campo(page, "Questões").fill("10");
    await expect(page.getByRole("button", { name: "Confirmar estudo" })).toBeDisabled();
    await campo(page, "Tópico *").fill("e2e validação, não salvar");
    await campo(page, "Acertos").fill("11");
    await expect(page.getByText(/Acertos não podem passar/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar estudo" })).toBeDisabled();
    await campo(page, "Acertos").fill("");
    await campo(page, "Tempo").fill("1h30");
    await expect(page.getByText(/90 minutos/)).toBeVisible();
  });

  test("simulado: registra no formato do concurso e persiste", async ({ page }) => {
    const nome = `E2E Simulado ${sufixo()}`;
    await irParaAba(page, "Simulados");
    await expect(page.getByRole("heading", { name: /Registrar simulado/ })).toBeVisible();
    await campo(page, "Nome").fill(nome);
    for (const sb of await page.getByRole("spinbutton").all()) {
      const rotulo = (await sb.getAttribute("aria-label")) ?? "";
      if (/redação/i.test(rotulo)) continue;
      await sb.fill("3");
    }
    const redacao = page.getByRole("spinbutton", { name: /Nota da redação/ });
    if (await redacao.count()) await redacao.fill("70");
    await page.getByRole("button", { name: "+ Salvar simulado" }).click();
    await expect(page.getByText(nome).first(), await retratoDaTela(page)).toBeVisible({ timeout: 15_000 });

    const linhas = await sql("select count(*)::int as n from simulados where aluno_id = $1 and nome = $2", [CONTA.alunoId, nome]);
    expect(linhas[0].n).toBe(1);
    await page.reload();
    await irParaAba(page, "Simulados");
    await expect(page.getByText(nome).first()).toBeVisible({ timeout: 15_000 });
  });

  test("cronômetro: iniciar, pausar, retomar e finalizar leva o tempo ao registro", async ({ page }) => {
    await page.getByRole("button", { name: /Iniciar estudo/ }).click();
    await expect(page.getByText("estudando")).toBeVisible();
    await page.getByRole("button", { name: /Pausar/ }).click();
    await expect(page.getByText("em pausa")).toBeVisible();
    await page.getByRole("button", { name: /Retomar/ }).click();
    await expect(page.getByText("estudando")).toBeVisible();
    await page.getByRole("button", { name: /Pausar/ }).click();
    await page.getByRole("button", { name: /Finalizar/ }).click();
    await expect(page.getByText("Registro rápido")).toBeVisible();
    await expect(page.getByText(/puxado do cronômetro/)).toBeVisible();
  });

  test("navega por todas as abas sem erro de console", async ({ page }) => {
    const erros = coletarErros(page);
    for (const aba of ["Trilha", "Registrar", "Desempenho", "Simulados", "Conquistas", "Histórico", "Plano", "Hoje"]) {
      await irParaAba(page, aba);
    }
    await expect(botaoVisivel(page, "Hoje")).toBeVisible();
    await semEstouroHorizontal(page);
    expect(erros).toEqual([]);
  });
});
