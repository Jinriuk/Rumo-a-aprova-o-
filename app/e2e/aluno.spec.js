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

  // Raio-x fase 2, desenho de 18/10: a missão de agora e as da semana no Hoje
  test("Hoje mostra a missão de agora com um botão, as missões da semana abertas, o cronômetro e o XP", async ({ page }) => {
    const erros = coletarErros(page);
    const cartao = page.getByRole("region", { name: "Missão de agora" });
    await expect(cartao).toBeVisible();
    await expect(cartao.getByText(/^\d+ de \d+ questões/)).toBeVisible();
    await expect(cartao.getByRole("button")).toHaveCount(1);
    await expect(cartao.getByRole("button", { name: /^(▶ Iniciar missão|Registrar)$/ })).toBeVisible({ timeout: 15_000 });
    // a semana das missões (ritmo do aluno) aberta, sem clique; a de agora
    // está nela. No CN local, a da semana 3 (Citologia, Biologia) fica com a
    // coordenação (Biologia não está na trilha) e as outras passam da semana
    // 9: a lista é a das missões do concurso.
    const semana = page.getByRole("region", { name: /^Missões (da semana|do concurso)$/ });
    await expect(semana.getByText(/^(Semana \d+ de \d+|Missões do concurso) · \d+ de \d+ miss(ão|ões)$/)).toBeVisible();
    const assunto = (await cartao.getByRole("heading").innerText()).trim();
    await expect(semana.getByRole("listitem").filter({ hasText: assunto })).toHaveCount(1);
    await expect(page.getByRole("button", { name: /Iniciar estudo/ })).toBeVisible();
    await expect(page.getByText(/\d[\d.]*\s*XP/).first()).toBeVisible();
    // saíram do Hoje: a semana como "Missão N", a lista de missões, as tarefas e o radar
    for (const fora of [/^MISSÃO \d+$/, "Radar de desempenho", "Tarefas da semana", "Próxima Missão", "✓ Concluir"]) {
      await expect(page.getByText(fora)).toHaveCount(0);
    }
    await semEstouroHorizontal(page);
    expect(erros).toEqual([]);
  });

  // Raio-x fase 2: o Plano no lugar da Trilha, com as missões dentro das semanas
  test("Plano: semanas em blocos com as missões dentro, a do calendário e a das missões abertas, tarefas abaixo", async ({ page }) => {
    const erros = coletarErros(page);
    await irParaAba(page, "Plano");
    const atual = page.getByRole("button", { name: /Em andamento/ });
    await expect(atual).toHaveAttribute("aria-expanded", "true");
    // as missões dentro da sua semana: Citologia (semana 3 do plano do CN),
    // com a coordenação porque Biologia não está na trilha, sem botão
    const blocoDaMissao = page.getByRole("region", { name: "Semana 3" });
    const citologia = blocoDaMissao.getByRole("listitem").filter({ hasText: "Citologia sem susto" });
    await expect(citologia).toContainText("coordenação");
    await expect(citologia.getByRole("button")).toHaveCount(0);
    await expect(blocoDaMissao.getByText("Tarefas da semana")).toBeVisible();
    const fechadas = page.getByRole("button", { name: /^Semana \d+\b.*(Encerrada|Próxima)/ });
    expect(await fechadas.count(), "há outras semanas").toBeGreaterThan(0);
    expect(await page.getByRole("button", { name: /^Semana \d+\b/, expanded: true }).count(), "só a do calendário e a das missões").toBeLessThanOrEqual(2);
    // dentro da atual: as pendentes com Concluir; as concluídas recolhidas
    await expect(page.getByRole("button", { name: "✓ Concluir" }).first()).toBeVisible();
    const recolhidas = page.getByRole("button", { name: /^\d+ concluídas?$/ });
    if (await recolhidas.count()) {
      await expect(page.getByRole("button", { name: "↺ Reabrir" })).toHaveCount(0);
      await recolhidas.click();
      await expect(page.getByRole("button", { name: "↺ Reabrir" }).first()).toBeVisible();
    }
    // semana passada sem meta (a conta entrou na semana 3): nada inventado
    const passada = page.getByRole("button", { name: /^Semana 1\b.*Encerrada/ });
    await passada.click();
    const corpoPassada = page.locator(`#${await passada.getAttribute("aria-controls")}`);
    await expect(corpoPassada.getByText("nenhuma tarefa dela foi atribuída a você", { exact: false })).toBeVisible();
    await expect(corpoPassada.locator(".objective-row")).toHaveCount(0);
    // semana futura abre e mostra o previsto, sem ações
    const controla = await page.getByRole("button", { name: /^Semana \d+\b.*Próxima/, expanded: false }).first().getAttribute("aria-controls");
    const futura = page.locator(`button[aria-controls="${controla}"]`);
    await futura.click();
    await expect(futura).toHaveAttribute("aria-expanded", "true");
    const corpo = page.locator(`#${await futura.getAttribute("aria-controls")}`);
    await expect(corpo.locator(".objective-row").first()).toBeVisible();
    await expect(corpo.getByRole("button", { name: "✓ Concluir" })).toHaveCount(0);
    // missões além das semanas da trilha (Crase, semana 12 de um ciclo de 9)
    await expect(page.getByText("Outras missões do concurso")).toBeVisible();
    expect(erros).toEqual([]);
  });

  test("metas: concluir uma tarefa (no Plano) grava no banco e continua concluída depois de atualizar", async ({ page }) => {
    await irParaAba(page, "Plano"); // as tarefas moram no Plano
    // o bloco da semana atual: nasce aberto, com "X de Y tarefas" no cabeçalho
    const atual = page.getByRole("button", { name: /Em andamento/, expanded: true });
    const contador = atual.getByText(/\d+ de \d+ tarefas?$/);
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
    await irParaAba(page, "Plano");
    await expect(contador).toHaveText(new RegExp(`${depois.feitas} de ${textoAntes.match(/(\d+) tarefas?$/)[1]} tarefas?$`), { timeout: 15_000 });
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
  test("Iniciar missão espera saber se a missão tem questões (rede lenta) e nunca cai no registro por falta de resposta", async ({ page }) => {
    const erros = coletarErros(page);
    const ids = await idsDasMissoes(CONTA.alunoId);
    let liberar;
    const lenta = new Promise((ok) => { liberar = ok; });
    await page.route("**/rest/v1/rpc/quest_missoes_disponiveis*", async (route) => {
      await lenta;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ids) });
    });
    await page.reload();

    const cartao = page.getByRole("region", { name: "Missão de agora" });
    const botao = cartao.getByRole("button");
    await expect(botao).toHaveText("Carregando…", { timeout: 15_000 });
    await expect(botao).toBeDisabled();
    await expect(botao).toHaveAttribute("aria-busy", "true");
    await botao.click({ force: true });           // o toque impaciente
    await page.waitForTimeout(800);
    await expect(page.getByText("Registro rápido"), "não foi ao registro").toHaveCount(0);
    await expect(page.getByLabel("Questões da missão")).toHaveCount(0);

    liberar();
    await expect(botao).toHaveText("▶ Iniciar missão");
    await expect(botao).toBeEnabled();
    await botao.click();
    await expect(page.getByLabel("Questões da missão"), "abriu a sessão de questões").toBeVisible();
    await expect(page.getByText("Quantas questões por vez?"), "sem tela de escolha antes do lote").toHaveCount(0);
    await expect(page.getByText("Registro rápido")).toHaveCount(0);
    expect(erros).toEqual([]);
  });

  test("Iniciar missão abre direto com o último tamanho (padrão 10) e troca o tamanho dentro da sessão", async ({ page }) => {
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
    await page.getByRole("region", { name: "Missão de agora" }).getByRole("button", { name: "▶ Iniciar missão" }).click({ timeout: 15_000 });
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
    await page.getByRole("region", { name: "Missão de agora" }).getByRole("button", { name: "▶ Iniciar missão" }).click({ timeout: 15_000 });
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
    const cartao = page.getByRole("region", { name: "Missão de agora" });
    await expect(cartao.getByRole("heading", { name: "Buscando a sua missão…" })).toBeVisible({ timeout: 15_000 });
    await expect(cartao.getByRole("button")).toBeDisabled();
    await expect(page.getByText("Sua próxima tarefa")).toHaveCount(0);
    liberar();
    await expect(cartao.getByText(/^\d+ de \d+ questões/)).toBeVisible({ timeout: 15_000 });
    await expect(cartao.getByRole("button")).toBeEnabled();
  });

  test("sem questões ligadas, o botão é Registrar e abre o registro já preenchido com a missão, no próprio Hoje", async ({ page }) => {
    await page.route("**/rest/v1/rpc/quest_missoes_disponiveis*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await page.reload();
    const cartao = page.getByRole("region", { name: "Missão de agora" });
    const assunto = (await cartao.getByRole("heading").innerText()).trim();
    const titulo = await page.title();
    await cartao.getByRole("button", { name: "Registrar", exact: true }).click({ timeout: 15_000 });
    await expect(page.getByText("Registro rápido")).toBeVisible();
    await expect(page.getByText(assunto).first(), "o registro sabe de que missão é").toBeVisible();
    await expect(campo(page, "Matéria")).toBeDisabled();
    expect(await page.title(), "nada no Hoje troca de aba").toBe(titulo);
    await expect(page.getByText("Registros recentes"), "no Hoje, só o formulário").toHaveCount(0);
    await page.getByRole("button", { name: "← Voltar às missões" }).click();
    await expect(cartao).toBeVisible();
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
    await expect(page, "a tela fora do menu tem título próprio").toHaveTitle(/^Conquistas · /);
    await page.getByRole("button", { name: "← Voltar ao Hoje" }).click();
    await expect(page.getByRole("region", { name: "Missão de agora" })).toBeVisible();
    await expect(page.locator(".player-rank"), "o foco volta ao XP").toBeFocused();
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
    await expect(page.getByRole("region", { name: "Missão de agora" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Preferência desta tela")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Modo (completo|essencial)/ })).toHaveCount(0);
    // o cartão da missão da vez também diz a matéria pelo nome
    await expect(page.getByRole("region", { name: "Missão de agora" })).toContainText(/Matemática|Português|Inglês|Física|Química|Biologia|História|Geografia/);
    // as linhas das missões, no Hoje e no Plano, dizem a matéria pelo nome
    const linhas = page.getByRole("region", { name: /^Missões (da semana|do concurso)$/ }).getByRole("listitem");
    await expect(linhas.first()).toBeVisible({ timeout: 15_000 });
    expect(await linhas.first().textContent()).toMatch(/Matemática|Português|Inglês|Física|Química|Biologia|História|Geografia/);
    await irParaAba(page, "Plano");
    await expect(page.locator("li[data-estado]").first()).toBeVisible({ timeout: 15_000 });
    const texto = (await page.locator("li[data-estado]").allTextContents()).join(" ");
    expect(texto).toMatch(/Matemática|Português|Inglês|Física|Química|Biologia|História|Geografia/);
    expect(texto, "nenhum código cru de matéria").not.toMatch(/\b(mat|por|ing|fis|qui|bio|his|geo|dir_[a-z_]+)\b/);
    expect(erros).toEqual([]);
  });

  // Decisão de 18/10: concluída fica com ✓ e sem botão no Hoje; a revisão
  // ("Revisar") só no Plano. O banco local não tem missão concluída: a
  // leitura de aluno_missoes marca uma. Sem questões ligadas, Revisar abre o
  // registro de revisão.
  test("missão concluída: ✓ sem botão no Hoje e Revisar só no Plano", async ({ page }) => {
    let concluida = null;
    await page.route("**/rest/v1/aluno_missoes*", async (route) => {
      const resposta = await route.fetch();
      const linhas = await resposta.json();
      if (Array.isArray(linhas) && linhas.length) {
        linhas[0] = { ...linhas[0], estado: "concluida", questoes_acumuladas: linhas[0].meta_questoes ?? 30, acuracia: 80, xp_concedido: 100 };
        concluida = linhas[0].missao_id;
      }
      await route.fulfill({ response: resposta, json: linhas });
    });
    await page.route("**/rest/v1/rpc/quest_missoes_disponiveis*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await loginAluno(page, CONTAS.alunoJornada);
    await expect(page.getByRole("region", { name: "Missão de agora" })).toBeVisible({ timeout: 15_000 });
    expect(concluida, "a conta tem progresso de missão para marcar").toBeTruthy();
    const [{ nome }] = await sql("select nome from missoes where id = $1", [concluida]);
    await irParaAba(page, "Plano");
    const linha = page.locator("li[data-estado='concluida']").filter({ hasText: nome });
    await expect(linha).toBeVisible({ timeout: 15_000 });
    await linha.getByRole("button", { name: `Revisar: ${nome}` }).click();
    await expect(page.getByText("Registro rápido")).toBeVisible();
    await expect(page.getByText("Fica no assunto desta missão; não avança a fila.")).toBeVisible();
    await irParaAba(page, "Hoje");
    const naSemana = page.getByRole("region", { name: /^Missões (da semana|do concurso)$/ }).locator("li[data-estado='concluida']").filter({ hasText: nome });
    if (await naSemana.count()) await expect(naSemana.getByRole("button"), "no Hoje, ✓ sem botão").toHaveCount(0);
  });

  test("exemplos coerentes: tópico serve a qualquer concurso; código no formato real", async ({ page }) => {
    await loginAluno(page, CONTAS.alunoJornada);
    await irParaAba(page, "Registrar");
    await expect(campo(page, "Tópico *")).toHaveAttribute("placeholder", "ex: assunto que estudou");
    await sair(page);
    await expect(page.getByPlaceholder("Ex.: ABCD-2345-EFGH")).toBeVisible();
  });
});
