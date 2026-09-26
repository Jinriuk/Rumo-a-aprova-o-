// @ts-check
/* Jornada da COORDENAÇÃO (Etapa 3): turma, aluno, meta, credencial,
   vínculo de responsável e progresso — cada passo conferido na tela E no
   banco local. Roda em série: o aluno criado no começo é o mesmo que
   recebe credencial, responsável e registro de estudo depois.

   Mais os testes de leitura do painel que já existiam (KPIs, abas,
   ficha do aluno, destaques, marca com persistência). */
import { test, expect } from "./local/base.js";
import { sql, fecharBanco } from "./local/api.js";
import {
  CONTAS, SENHA_NOVA_E2E, coletarErros, loginCoordenacao, irParaAba, semEstouroHorizontal, campo,
  sufixo, dialogoAberto, entrarCom, botaoVisivel, retratoDaTela, sair,
} from "./_apoio.js";

const VITRINE = "11111111-1111-4111-8111-111111111111";

test.afterAll(async () => { await fecharBanco(); });

test.describe("coordenação: turma → aluno → meta → credencial → vínculo → progresso", { tag: ["@j:coordenacao", "@critica"] }, () => {
  test.describe.configure({ mode: "serial" });

  const s = sufixo();
  const turma = `E2E Turma ${s}`;
  const aluno = `E2E Aluno ${s}`;
  const resp = `E2E Responsável ${s}`;
  let credAluno = null;
  let credResp = null;

  test("cria turma e ela aparece em Turmas e no banco", async ({ page }) => {
    await loginCoordenacao(page);
    await irParaAba(page, "Turmas");
    await campo(page, "Nome da turma").fill(turma);
    await page.getByRole("button", { name: "+ Criar turma" }).click();
    await expect(page.getByRole("button", { name: new RegExp(turma) })).toBeVisible({ timeout: 15_000 });
    const linhas = await sql("select escola_id from turmas where nome = $1", [turma]);
    expect(linhas).toEqual([{ escola_id: VITRINE }]);
  });

  test("cadastra aluno na turma, com trilha, e a meta da semana nasce", async ({ page }) => {
    await loginCoordenacao(page);
    await irParaAba(page, "Alunos");
    await page.getByRole("button", { name: /Cadastrar alunos/ }).click();
    await campo(page, "Nome do aluno").fill(aluno);
    await campo(page, "Turma").selectOption({ label: turma });
    await page.getByRole("button", { name: "+ Cadastrar aluno" }).click();
    await expect(page.getByText(`${aluno} cadastrado. Gere a credencial na lista abaixo.`)).toBeVisible({ timeout: 20_000 });

    const [a] = await sql(
      `select a.id, a.trilha_id, a.status_provisionamento, t.nome as turma,
              (select count(*)::int from metas m where m.aluno_id = a.id and m.status = 'ativa') as metas
         from alunos a
         join alunos_turmas at on at.aluno_id = a.id
         join turmas t on t.id = at.turma_id
        where a.nome = $1`, [aluno]);
    expect(a, "aluno no banco").toBeTruthy();
    expect(a.turma).toBe(turma);
    expect(a.trilha_id, "trilha semanal atribuída").toBeTruthy();
    expect(a.status_provisionamento).toBe("ok");
    expect(a.metas, "meta da semana gerada pelo gerar-meta").toBe(1);
  });

  test("gera credencial do aluno: código e senha aparecem uma vez", async ({ page }) => {
    await loginCoordenacao(page);
    await irParaAba(page, "Alunos");
    await page.getByRole("textbox", { name: "Buscar aluno por nome" }).fill(aluno);
    await page.getByRole("button", { name: "Gerar credencial" }).first().click();
    const codigo = page.getByText("Código (identificação)").locator("xpath=following-sibling::div[1]");
    const senha = page.getByText("Senha temporária").locator("xpath=following-sibling::div[1]");
    await expect(codigo).toBeVisible({ timeout: 20_000 });
    credAluno = { codigo: (await codigo.innerText()).trim(), senha: (await senha.innerText()).trim() };
    expect(credAluno.codigo).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(credAluno.senha.length).toBeGreaterThanOrEqual(16);
    await page.getByRole("button", { name: "Entreguei, fechar" }).click();
    await expect(page.getByText("com credencial").first()).toBeVisible();
    const [u] = await sql("select u.must_change_password, u.papel from alunos a join usuarios u on u.id = a.usuario_id where a.nome = $1", [aluno]);
    expect(u).toEqual({ must_change_password: true, papel: "aluno" });
  });

  test("o aluno novo entra com a credencial, troca a senha e vê a meta", async ({ novoContexto }) => {
    expect(credAluno, "depende do passo da credencial").toBeTruthy();
    const ctx = await novoContexto();
    const page = await ctx.newPage();
    try {
      await entrarCom(page, { codigo: credAluno.codigo }, credAluno.senha);
      await expect(page.getByText("Escolha sua senha")).toBeVisible({ timeout: 20_000 });
      await campo(page, "Nova senha").fill(SENHA_NOVA_E2E);
      await campo(page, "Confirmar senha").fill(SENHA_NOVA_E2E);
      await page.getByRole("button", { name: "Definir senha e continuar" }).click();
      await expect(botaoVisivel(page, "Hoje"), await retratoDaTela(page)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/Sua missão: concluir \d+ objetivos/)).toBeVisible();
      const [u] = await sql("select u.must_change_password from alunos a join usuarios u on u.id = a.usuario_id where a.nome = $1", [aluno]);
      expect(u.must_change_password).toBe(false);
    } finally { await ctx.close(); }
  });

  test("adiciona responsável: credencial, vínculo no banco e leitura só do vinculado", async ({ page, novoContexto }) => {
    await loginCoordenacao(page);
    await irParaAba(page, "Alunos");
    await page.getByRole("textbox", { name: "Buscar aluno por nome" }).fill(aluno);
    await page.getByRole("button", { name: "Mais ações" }).first().click();
    await page.getByRole("menuitem", { name: "+ Adicionar responsável" }).or(page.getByRole("button", { name: "+ Adicionar responsável" })).first().click();
    const dlg = dialogoAberto(page);
    await dlg.getByRole("textbox").fill(resp);
    await dlg.getByRole("button", { name: "Confirmar" }).click();
    const codigo = page.getByText("Código (identificação)").locator("xpath=following-sibling::div[1]");
    const senha = page.getByText("Senha temporária").locator("xpath=following-sibling::div[1]");
    await expect(codigo).toBeVisible({ timeout: 20_000 });
    credResp = { codigo: (await codigo.innerText()).trim(), senha: (await senha.innerText()).trim() };
    await page.getByRole("button", { name: "Entreguei, fechar" }).click();

    const vinc = await sql(
      `select v.escola_id from vinculos_responsaveis v join usuarios u on u.id = v.responsavel_id
         join alunos a on a.id = v.aluno_id where u.nome = $1 and a.nome = $2`, [resp, aluno]);
    expect(vinc).toEqual([{ escola_id: VITRINE }]);

    const ctx = await novoContexto();
    const p2 = await ctx.newPage();
    try {
      await entrarCom(p2, { codigo: credResp.codigo }, credResp.senha);
      await expect(p2.getByText("Escolha sua senha")).toBeVisible({ timeout: 20_000 });
      await campo(p2, "Nova senha").fill(SENHA_NOVA_E2E);
      await campo(p2, "Confirmar senha").fill(SENHA_NOVA_E2E);
      await p2.getByRole("button", { name: "Definir senha e continuar" }).click();
      await expect(p2.getByText("Atividades da semana"), await retratoDaTela(p2)).toBeVisible({ timeout: 20_000 });
      await expect(p2.getByText(aluno.split(" ")[0]).first()).toBeVisible();
      // só o vinculado: nenhum outro aluno da vitrine aparece
      await expect(p2.getByText("Lucas", { exact: false })).toHaveCount(0);
    } finally { await ctx.close(); }
  });

  test("progresso: o registro do aluno aparece na ficha da coordenação", async ({ page }) => {
    // o aluno registra estudo pelo banco como o app faria (a jornada do
    // aluno cobre o formulário); aqui o que se prova é a leitura da escola
    const [a] = await sql("select id, escola_id from alunos where nome = $1", [aluno]);
    await sql(`insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, minutos)
               values ($1, $2, (now() at time zone 'America/Sao_Paulo')::date, 'mat', 'E2E progresso', 20, 15, 40)`, [a.escola_id, a.id]);
    await loginCoordenacao(page);
    await irParaAba(page, "Alunos");
    await page.getByRole("textbox", { name: "Buscar aluno por nome" }).fill(aluno);
    await page.getByRole("button", { name: "Ver desempenho" }).first().click();
    await expect(page.getByRole("button", { name: /voltar ao painel/ })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Histórico de progresso")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Registro de estudo/).first()).toBeVisible({ timeout: 15_000 });
    const [ev] = await sql("select count(*)::int as n from aluno_eventos_progresso where aluno_id = $1", [a.id]);
    expect(ev.n, "o registro virou evento no ledger").toBeGreaterThan(0);
  });
});

test.describe("coordenação: painel e navegação", { tag: ["@j:coordenacao"] }, () => {
  test.beforeEach(async ({ page }) => {
    await loginCoordenacao(page, CONTAS.coordenacaoVitrine);
  });

  test("painel mostra KPIs e alertas de risco", async ({ page }) => {
    const erros = coletarErros(page);
    await expect(page.getByText("Alertas de risco")).toBeVisible();
    await expect(page.getByText("Destaques da semana")).toBeVisible();
    await semEstouroHorizontal(page);
    expect(erros).toEqual([]);
  });

  test("navega por Alunos, Ranking, Turmas, Ciclo, LGPD e Marca", async ({ page }) => {
    const erros = coletarErros(page);
    await irParaAba(page, "Alunos");
    await expect(page.getByText("Alunos da escola")).toBeVisible();
    await irParaAba(page, "Ranking");
    await expect(page.getByText(/Ranking —/).first()).toBeVisible();
    await irParaAba(page, "Turmas");
    await expect(page.getByText("Visão rápida do desempenho de cada turma")).toBeVisible();
    await irParaAba(page, "Ciclo");
    await expect(page.getByRole("heading", { name: "Próximo ciclo" })).toBeVisible();
    await irParaAba(page, "LGPD");
    await expect(page.getByText("Para que serve esta área")).toBeVisible();
    await irParaAba(page, "Marca");
    await expect(page.getByText("Marca da escola")).toBeVisible();
    await semEstouroHorizontal(page);
    expect(erros).toEqual([]);
  });

  test("MARCA: altera o nome de exibição, persiste após reload e restaura", async ({ page }) => {
    test.setTimeout(60_000);
    await irParaAba(page, "Marca");
    const campoNome = campo(page, "Nome de exibição");
    await expect(campoNome).toBeVisible();
    const original = await campoNome.inputValue();
    const tempo = `${original} ⟦e2e⟧`;
    try {
      await campoNome.fill(tempo);
      await page.getByRole("button", { name: "Salvar marca" }).click();
      await expect(page.getByText(/Marca salva no banco/)).toBeVisible({ timeout: 15_000 });
      await page.reload();
      await irParaAba(page, "Marca");
      await expect(campo(page, "Nome de exibição")).toHaveValue(tempo, { timeout: 15_000 });
    } finally {
      await campo(page, "Nome de exibição").fill(original);
      await page.getByRole("button", { name: "Salvar marca" }).click();
      await expect(page.getByText(/Marca salva no banco/)).toBeVisible({ timeout: 15_000 });
    }
    await sair(page);
  });
});
