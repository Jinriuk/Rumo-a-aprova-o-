// @ts-check
/* Jornada do ALUNO (Etapa 3): Hoje, trilha, metas, registro de estudo e
   simulado, com os dados conferidos no banco local e de novo depois de
   atualizar a página (persistência de verdade, não estado de tela).

   Conta dedicada (alunoJornada, aluno do seed 13 com meta ativa): as
   escritas daqui não mexem no Lucas, que a jornada do responsável lê. */
import { test, expect } from "./local/base.js";
import { sql, fecharBanco } from "./local/api.js";
import {
  CONTAS, coletarErros, loginAluno, irParaAba, semEstouroHorizontal, campo, botaoVisivel, sufixo, retratoDaTela, sair,
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

  // 18/10, achado 5 do #192: com a lista de missões com questões ainda a
  // caminho, "Iniciar missão" mandava ao registro. Rede lenta simulada: a
  // resposta da RPC só sai quando o teste libera.
  test("Iniciar missão espera saber se a missão tem questões (rede lenta) e nunca cai no registro por falta de resposta", async ({ page }) => {
    const erros = coletarErros(page);
    const ids = (await sql(
      `select m.id from missoes m join concursos c on c.codigo = m.exam_tag join alunos a on a.concurso_id = c.id
        where a.id = $1`, [CONTA.alunoId])).map((r) => r.id);
    let liberar;
    const lenta = new Promise((ok) => { liberar = ok; });
    await page.route("**/rest/v1/rpc/quest_missoes_disponiveis*", async (route) => {
      await lenta;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ids) });
    });
    await page.reload();

    const iniciar = page.getByRole("button", { name: "Iniciar missão" }).first();
    await expect(iniciar).toBeVisible({ timeout: 15_000 });
    await expect(iniciar).toBeDisabled();
    await expect(iniciar).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("status").filter({ hasText: "Carregando…" }).first()).toBeVisible();
    await iniciar.click({ force: true });           // o toque impaciente
    await page.waitForTimeout(800);
    await expect(page.getByText("Registro rápido"), "não foi ao registro").toHaveCount(0);
    await expect(page.getByText("Quantas questões por vez?")).toHaveCount(0);

    liberar();
    await expect(iniciar).toBeEnabled();
    await expect(iniciar).not.toHaveAttribute("aria-busy", "true");
    await iniciar.click();
    await expect(page.getByText("Quantas questões por vez?"), "abriu a sessão de questões").toBeVisible();
    await expect(page.getByText("Registro rápido")).toHaveCount(0);
    expect(erros).toEqual([]);
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

/* Raio-x, mudança 8 (decisões de 18/10): o aviso de maturidade sai das
   telas fixas (uma vez, com "Entendi", e uma linha no Plano), o seletor
   de modo da tela some e a matéria aparece pelo nome. */
test.describe("aluno: menos ruído fixo", { tag: ["@j:aluno", "@critica"] }, () => {
  test("aviso de maturidade aparece uma vez, some no Entendi (também depois de atualizar) e fica uma linha no Plano", async ({ page }) => {
    const erros = coletarErros(page);
    await loginAluno(page, CONTAS.alunoAviso);
    const aviso = page.getByRole("note").filter({ hasText: "Só a estrutura da prova" });
    await expect(aviso).toBeVisible();
    await aviso.getByRole("button", { name: "Entendi" }).click();
    await expect(aviso).toHaveCount(0);
    await page.reload();
    await expect(botaoVisivel(page, "Hoje")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Só a estrutura da prova")).toHaveCount(0);
    for (const aba of ["Registrar", "Desempenho", "Hoje"]) {
      await irParaAba(page, aba);
      await expect(page.getByText("Só a estrutura da prova")).toHaveCount(0);
    }
    await irParaAba(page, "Plano");
    await expect(page.getByText("Conteúdo de estudo ainda não montado.")).toBeVisible();
    expect(erros).toEqual([]);
  });

  test("Hoje sem 'Preferência desta tela' e com a matéria pelo nome no painel de missões", async ({ page }) => {
    const erros = coletarErros(page);
    await loginAluno(page, CONTAS.alunoJornada);
    await expect(page.getByRole("heading", { name: "Missão da vez" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Preferência desta tela")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Modo (completo|essencial)/ })).toHaveCount(0);
    // o cartão inteiro: o ancestral mais próximo que já contém as missões
    const painel = page.getByRole("heading", { name: "Missão da vez" }).locator("xpath=ancestor::*[.//li][1]");
    const texto = await painel.textContent();
    expect(texto).toMatch(/Matemática|Português|Inglês|Física|Química|Biologia|História|Geografia/);
    expect(texto, "nenhum código cru de matéria").not.toMatch(/\b(mat|por|ing|fis|qui|bio|his|geo|dir_[a-z_]+)\b/);
    expect(erros).toEqual([]);
  });

  test("exemplos coerentes: tópico serve a qualquer concurso; código no formato real", async ({ page }) => {
    await loginAluno(page, CONTAS.alunoJornada);
    await irParaAba(page, "Registrar");
    await expect(campo(page, "Tópico *")).toHaveAttribute("placeholder", "ex: assunto que estudou");
    await sair(page);
    await expect(page.getByPlaceholder("Ex.: ABCD-2345-EFGH")).toBeVisible();
  });
});
