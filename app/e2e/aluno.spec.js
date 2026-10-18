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

const idsDasMissoes = async (alunoId) => (await sql(
  `select m.id from missoes m join concursos c on c.codigo = m.exam_tag join alunos a on a.concurso_id = c.id
    where a.id = $1`, [alunoId])).map((r) => r.id);

test.afterAll(async () => { await fecharBanco(); });

test.describe("aluno", { tag: ["@j:aluno", "@critica"] }, () => {
  test.beforeEach(async ({ page }) => {
    await loginAluno(page, CONTA);
  });

  // Raio-x fase 2 (mudanças 2 e 3): uma ação no Hoje
  test("Hoje mostra a missão da vez com um botão, a semana numa linha, o cronômetro e o XP", async ({ page }) => {
    const erros = coletarErros(page);
    const cartao = page.getByRole("region", { name: "Sua missão agora" });
    await expect(cartao).toBeVisible();
    await expect(cartao.getByText(/^\d+ de \d+ questões/)).toBeVisible();
    await expect(cartao.getByRole("button")).toHaveCount(1);
    await expect(cartao.getByRole("button", { name: /^(Resolver questões|Registrar estudo)$/ })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /^Semana \d+ de \d+ · \d+ de \d+ tarefas?/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Iniciar estudo/ })).toBeVisible();
    await expect(page.getByText(/\d[\d.]*\s*XP/).first()).toBeVisible();
    // saíram do Hoje: a semana como "Missão N", a lista de missões, as tarefas e o radar
    for (const fora of [/^MISSÃO \d+$/, "Radar de desempenho", "Tarefas da semana", "Próxima Missão"]) {
      await expect(page.getByText(fora)).toHaveCount(0);
    }
    await expect(page.getByRole("button", { name: "Iniciar missão" })).toHaveCount(0);
    await semEstouroHorizontal(page);
    expect(erros).toEqual([]);
  });

  // Raio-x fase 2, PR 3: o Plano no lugar da Trilha
  test("Plano: semanas em blocos, a atual aberta com as tarefas, as outras fechadas, concluídas recolhidas e missões abaixo", async ({ page }) => {
    const erros = coletarErros(page);
    await irParaAba(page, "Plano");
    const atual = page.getByRole("button", { name: /Em andamento/ });
    await expect(atual).toHaveAttribute("aria-expanded", "true");
    const fechadas = page.getByRole("button", { name: /^Semana \d+\b.*(Encerrada|Próxima)/ });
    expect(await fechadas.count(), "há outras semanas").toBeGreaterThan(0);
    for (const b of await fechadas.all()) await expect(b).toHaveAttribute("aria-expanded", "false");
    // dentro da atual: as pendentes com Concluir; as concluídas recolhidas
    await expect(page.getByRole("button", { name: "✓ Concluir" }).first()).toBeVisible();
    const recolhidas = page.getByRole("button", { name: /^\d+ concluídas?$/ });
    if (await recolhidas.count()) {
      await expect(page.getByRole("button", { name: "↺ Reabrir" })).toHaveCount(0);
      await recolhidas.click();
      await expect(page.getByRole("button", { name: "↺ Reabrir" }).first()).toBeVisible();
    }
    // uma semana fechada abre e mostra as tarefas dela, sem ações
    const outra = fechadas.first();
    await outra.click();
    await expect(outra).toHaveAttribute("aria-expanded", "true");
    const corpo = page.locator(`#${await outra.getAttribute("aria-controls")}`);
    await expect(corpo.locator(".objective-row").first()).toBeVisible();
    await expect(corpo.getByRole("button", { name: "✓ Concluir" })).toHaveCount(0);
    // as missões por matéria, abaixo das semanas
    await expect(page.getByRole("heading", { name: "Missão da vez" })).toBeVisible();
    expect(erros).toEqual([]);
  });

  test("metas: concluir uma tarefa (no Plano) grava no banco, continua concluída depois de atualizar e a linha do Hoje acompanha", async ({ page }) => {
    const linha = page.getByRole("button", { name: /^Semana \d+ de \d+ · \d+ de \d+ tarefas?/ });
    const linhaAntes = await linha.innerText();
    await linha.click(); // a linha da semana leva ao Plano, onde moram as tarefas
    // o bloco da semana atual: nasce aberto, com "X de Y tarefas" no cabeçalho
    const atual = page.getByRole("button", { name: /Em andamento/, expanded: true });
    const contador = atual.getByText(/^\d+ de \d+ tarefas?$/);
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
    await expect(botaoVisivel(page, "Hoje")).toBeVisible({ timeout: 15_000 });
    await expect(linha).not.toHaveText(linhaAntes, { timeout: 15_000 });
    await irParaAba(page, "Plano");
    await expect(contador).toHaveText(new RegExp(`^${depois.feitas} de ${textoAntes.match(/de (\d+)/)[1]} tarefas?$`), { timeout: 15_000 });
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
  // caminho, o botão mandava ao registro. Rede lenta simulada: a resposta
  // da RPC só sai quando o teste libera. Raio-x fase 2: o botão é o do
  // cartão do Hoje, e a sessão abre direto (sem "Quantas questões por vez?").
  test("Resolver questões espera saber se a missão tem questões (rede lenta) e nunca cai no registro por falta de resposta", async ({ page }) => {
    const erros = coletarErros(page);
    const ids = await idsDasMissoes(CONTA.alunoId);
    let liberar;
    const lenta = new Promise((ok) => { liberar = ok; });
    await page.route("**/rest/v1/rpc/quest_missoes_disponiveis*", async (route) => {
      await lenta;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ids) });
    });
    await page.reload();

    const cartao = page.getByRole("region", { name: "Sua missão agora" });
    const botao = cartao.getByRole("button");
    await expect(botao).toHaveText("Carregando…", { timeout: 15_000 });
    await expect(botao).toBeDisabled();
    await expect(botao).toHaveAttribute("aria-busy", "true");
    await botao.click({ force: true });           // o toque impaciente
    await page.waitForTimeout(800);
    await expect(page.getByText("Registro rápido"), "não foi ao registro").toHaveCount(0);
    await expect(page.getByLabel("Questões da missão")).toHaveCount(0);

    liberar();
    await expect(botao).toHaveText("Resolver questões");
    await expect(botao).toBeEnabled();
    await botao.click();
    await expect(page.getByLabel("Questões da missão"), "abriu a sessão de questões").toBeVisible();
    await expect(page.getByText("Quantas questões por vez?"), "sem tela de escolha antes do lote").toHaveCount(0);
    await expect(page.getByText("Registro rápido")).toHaveCount(0);
    expect(erros).toEqual([]);
  });

  test("Resolver questões abre direto com o último tamanho (padrão 10) e troca o tamanho dentro da sessão", async ({ page }) => {
    const ids = await idsDasMissoes(CONTA.alunoId);
    await page.route("**/rest/v1/rpc/quest_missoes_disponiveis*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ids) }));
    const pedidos = [];
    await page.route("**/functions/v1/questoes-integradas", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      const corpo = route.request().postDataJSON();
      pedidos.push(corpo);
      await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({
        estado: "ok", retomado: false,
        entrega: { id: "e2e-entrega", tipo_pratica: "missao", questoes: [
          { id: "e2e-q1", enunciado: "Questão de teste do E2E.", alternativas: [{ letra: "A", texto: "um" }, { letra: "B", texto: "dois" }] },
        ] },
      }) });
    });
    await page.evaluate(() => localStorage.removeItem("triliva-tamanho-lote"));
    await page.reload();
    await page.getByRole("region", { name: "Sua missão agora" }).getByRole("button", { name: "Resolver questões" }).click({ timeout: 15_000 });
    const sessao = page.getByLabel("Questões da missão");
    await expect(sessao.getByText("Questão de teste do E2E.")).toBeVisible();
    expect(pedidos[0]).toMatchObject({ acao: "entregar", tamanho: 10 });
    const por = sessao.getByRole("radiogroup", { name: "Por vez:" });
    await expect(por.getByRole("radio", { name: "10" })).toHaveAttribute("aria-checked", "true");
    await por.getByRole("radio", { name: "20" }).click();
    await expect(por.getByRole("radio", { name: "20" })).toHaveAttribute("aria-checked", "true");
    expect(await page.evaluate(() => localStorage.getItem("triliva-tamanho-lote"))).toBe("20");

    await sessao.getByRole("button", { name: "Fechar" }).click();
    await page.reload();
    await page.getByRole("region", { name: "Sua missão agora" }).getByRole("button", { name: "Resolver questões" }).click({ timeout: 15_000 });
    await expect(page.getByLabel("Questões da missão").getByText("Questão de teste do E2E.")).toBeVisible();
    expect(pedidos.at(-1)).toMatchObject({ acao: "entregar", tamanho: 20 });
  });

  // achado do Codex no #194: antes de o catálogo de missões chegar, o cartão
  // não oferece tarefa nem "semana em dia" no lugar da missão
  test("com o catálogo de missões lento, o cartão espera e depois mostra a missão", async ({ page }) => {
    let liberar;
    const lenta = new Promise((ok) => { liberar = ok; });
    await page.route("**/rest/v1/missoes?*", async (route) => { await lenta; await route.fallback(); });
    await page.reload();
    const cartao = page.getByRole("region", { name: "Sua missão agora" });
    await expect(cartao.getByRole("heading", { name: "Buscando a sua missão…" })).toBeVisible({ timeout: 15_000 });
    await expect(cartao.getByRole("button")).toBeDisabled();
    await expect(page.getByText("Sua próxima tarefa")).toHaveCount(0);
    liberar();
    await expect(cartao.getByText(/^\d+ de \d+ questões/)).toBeVisible({ timeout: 15_000 });
    await expect(cartao.getByRole("button")).toBeEnabled();
  });

  test("sem questões ligadas, o botão é Registrar estudo e abre o registro já preenchido com a missão", async ({ page }) => {
    await page.route("**/rest/v1/rpc/quest_missoes_disponiveis*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await page.reload();
    const cartao = page.getByRole("region", { name: "Sua missão agora" });
    const assunto = (await cartao.getByRole("heading").innerText()).trim();
    await cartao.getByRole("button", { name: "Registrar estudo" }).click({ timeout: 15_000 });
    await expect(page.getByText("Registro rápido")).toBeVisible();
    await expect(page.getByText(assunto).first(), "o registro sabe de que missão é").toBeVisible();
    await expect(campo(page, "Matéria")).toBeDisabled();
  });

  test("navega por todas as abas sem erro de console", async ({ page }) => {
    const erros = coletarErros(page);
    // raio-x fase 2, PR 3: a ordem nova; Trilha e Conquistas fora do menu
    const menu = page.getByRole("navigation").filter({ has: botaoVisivel(page, "Hoje") }).first();
    for (const fora of ["Trilha", "Conquistas"]) await expect(menu.getByRole("button", { name: fora, exact: true })).toHaveCount(0);
    for (const aba of ["Plano", "Registrar", "Desempenho", "Simulados", "Histórico", "Hoje"]) {
      await irParaAba(page, aba);
    }
    await expect(botaoVisivel(page, "Hoje")).toBeVisible();
    // Conquistas abre pelo XP do topo do Hoje e volta
    await page.locator(".player-rank").click();
    await expect(page.getByText(/Evolução de patentes/)).toBeVisible();
    await page.getByRole("button", { name: "← Voltar ao Hoje" }).click();
    await expect(page.getByRole("region", { name: "Sua missão agora" })).toBeVisible();
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
    await expect(page.getByRole("region", { name: "Sua missão agora" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Preferência desta tela")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Modo (completo|essencial)/ })).toHaveCount(0);
    // o cartão da missão da vez também diz a matéria pelo nome
    await expect(page.getByRole("region", { name: "Sua missão agora" })).toContainText(/Matemática|Português|Inglês|Física|Química|Biologia|História|Geografia/);
    await irParaAba(page, "Plano"); // raio-x fase 2: o painel de missões mora no Plano
    await expect(page.getByRole("heading", { name: "Missão da vez" })).toBeVisible({ timeout: 15_000 });
    // o cartão inteiro: o ancestral mais próximo que já contém as missões
    const painel = page.getByRole("heading", { name: "Missão da vez" }).locator("xpath=ancestor::*[.//li][1]");
    const texto = await painel.textContent();
    expect(texto).toMatch(/Matemática|Português|Inglês|Física|Química|Biologia|História|Geografia/);
    expect(texto, "nenhum código cru de matéria").not.toMatch(/\b(mat|por|ing|fis|qui|bio|his|geo|dir_[a-z_]+)\b/);
    expect(erros).toEqual([]);
  });

  // achado do Codex no #193: com o painel sempre compacto, a missão
  // concluída sumia e com ela o único "Registrar revisão". O banco local
  // não tem missão concluída: a leitura de aluno_missoes marca uma.
  test("missão concluída fica recolhida, mas a revisão continua a um toque", async ({ page }) => {
    await page.route("**/rest/v1/aluno_missoes*", async (route) => {
      const resposta = await route.fetch();
      const linhas = await resposta.json();
      if (Array.isArray(linhas) && linhas.length) {
        linhas[0] = { ...linhas[0], estado: "concluida", questoes_acumuladas: linhas[0].meta_questoes ?? 20, acuracia: 80, xp_concedido: 100 };
      }
      await route.fulfill({ response: resposta, json: linhas });
    });
    await loginAluno(page, CONTAS.alunoJornada);
    await irParaAba(page, "Plano"); // raio-x fase 2: o painel de missões mora no Plano
    const recolhidas = page.getByRole("button", { name: /^▸ 1 concluída · revisar$/ });
    await expect(recolhidas).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Registrar revisão" })).toHaveCount(0);
    await recolhidas.click();
    await page.getByRole("button", { name: "Registrar revisão" }).first().click();
    await expect(page.getByText("Registro rápido")).toBeVisible();
    await expect(page.getByText("Fica no assunto desta missão; não avança a fila.")).toBeVisible();
  });

  test("exemplos coerentes: tópico serve a qualquer concurso; código no formato real", async ({ page }) => {
    await loginAluno(page, CONTAS.alunoJornada);
    await irParaAba(page, "Registrar");
    await expect(campo(page, "Tópico *")).toHaveAttribute("placeholder", "ex: assunto que estudou");
    await sair(page);
    await expect(page.getByPlaceholder("Ex.: ABCD-2345-EFGH")).toBeVisible();
  });
});
