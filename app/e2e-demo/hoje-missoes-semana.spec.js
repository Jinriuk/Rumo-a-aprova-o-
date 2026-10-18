/* Raio-x fase 2 — Hoje e Plano pelo desenho aprovado em 18/10, no DEMO,
   no celular (390×844, toque). Dois alunos PMERJ de teste, numa escola de
   teste (nunca a vitrine), criados para a ocasião:
     A (DEMO_ALUNO_CODIGO / DEMO_ALUNO_SENHA): missão de agora com
       questões reais. "Iniciar missão" abre a sessão na hora, com o último
       tamanho (padrão 10), e liga o cronômetro; fechar zera o cronômetro.
     B (DEMO_ALUNO_B_CODIGO / DEMO_ALUNO_B_SENHA): fecha pela sessão a
       missão de Penal Militar da semana 1 (13 questões); a da vez passa a
       ser "Crime militar", sem questões ligadas, e a linha dela diz
       "Registrar", que abre o registro já com a missão, no próprio Hoje.
   As contas criadas pela coordenação recebem código comum (não E2E…):
   só passam se o código estiver em DEMO_CODIGOS_DESCARTAVEIS (lista
   separada por vírgula, dita por quem roda) e, depois do login, a escola
   não for a da vitrine. Qualquer outro código é recusado.
   Capturas em DEMO_SAIDA. Ver playwright.demo.config.js para rodar
   (o projeto deste arquivo é o celular). Gasta créditos da Quest quando a
   missão não tem estoque guardado. */
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { transporteDemo } from "./_transporte.js";
import { recusaCodigoDoDemo, recusarEscolaDaVitrine } from "./_contas.js";

const SAIDA = process.env.DEMO_SAIDA || "e2e-demo-resultados";

test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
});

async function entrar(page, codigo, senha) {
  const recusa = recusaCodigoDoDemo(codigo);
  const normal = (c) => String(c ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const descartaveis = (process.env.DEMO_CODIGOS_DESCARTAVEIS ?? "").split(",").map(normal).filter(Boolean);
  if (recusa && !descartaveis.includes(normal(codigo))) throw new Error(`Recusado: ${recusa}`);
  await transporteDemo(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Aluno \/ Responsável/ }).click();
  await page.getByLabel("Código de acesso", { exact: true }).fill(codigo);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: /^Entrar na missão/ }).click();
  await expect(page.getByRole("region", { name: "Missão de agora" })).toBeVisible({ timeout: 45_000 });
  await recusarEscolaDaVitrine(page);
  const agoraNao = page.getByRole("button", { name: "Agora não" });
  if (await agoraNao.count()) await agoraNao.click();
  await expect(page.getByRole("region", { name: "Missão de agora" }).getByRole("button")).toBeEnabled({ timeout: 45_000 });
}

const noTopo = (loc) => loc.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 120));

async function responderLote(page) {
  const sessao = page.getByLabel("Questões da missão", { exact: true });
  const contador = sessao.getByText(/^Questão \d+ de \d+$/);
  await expect(contador).toBeVisible({ timeout: 90_000 });
  const total = Number((await contador.textContent()).match(/de (\d+)/)[1]);
  for (let i = 1; i <= total; i++) {
    await expect(sessao.getByText(`Questão ${i} de ${total}`)).toBeVisible();
    await sessao.getByRole("radio", { name: /^Alternativa / }).nth(i % 2).check();
    await sessao.getByRole("button", { name: "Confirmar resposta" }).click();
    await expect(sessao.getByText(/^(Certa\.|Errada\. Gabarito: [A-J]\.)$/)).toBeVisible({ timeout: 30_000 });
    await sessao.getByRole("button", { name: i < total ? "Próxima questão" : "Ver resultado" }).click();
  }
  return total;
}

test("A: Hoje com a missão de agora e a semana aberta; Iniciar abre a sessão na hora; Plano com missões dentro das semanas", async ({ page }) => {
  const codigo = process.env.DEMO_ALUNO_CODIGO, senha = process.env.DEMO_ALUNO_SENHA;
  test.skip(!codigo || !senha, "sem aluno A de teste do demo");
  test.setTimeout(600_000);
  mkdirSync(SAIDA, { recursive: true });
  await entrar(page, codigo, senha);

  // regra 1 e 3: a semana das missões (ritmo do aluno) aberta, sem clique
  const cartao = page.getByRole("region", { name: "Missão de agora" });
  const semana = page.getByRole("region", { name: "Missões da semana" });
  await expect(semana.getByText(/^Semana 1 de 12 · \d+ de 6 missões$/)).toBeVisible();
  await expect(semana.getByRole("listitem")).toHaveCount(6);
  // aluno novo: a de agora é a primeira da semana 1 (Administrativo); ao
  // rodar de novo, é a primeira ainda não concluída, talvez já começada
  if (await semana.getByText("Semana 1 de 12 · 0 de 6 missões", { exact: true }).count()) {
    await expect(cartao.getByText("Direito Administrativo")).toBeVisible();
    await expect(cartao.getByRole("heading", { name: "Organização administrativa: direta, indireta e delegação" })).toBeVisible();
  }
  await expect(cartao.getByRole("button", { name: "▶ Iniciar missão" })).toBeVisible();
  const nome = (await cartao.getByRole("heading").textContent()).trim();
  const [antes, meta] = (await cartao.getByText(/^\d+ de \d+ questões$/).textContent()).match(/\d+/g).map(Number);
  // regra 6: nada de radar, tarefas ou "Missão N" no Hoje
  for (const fora of ["Radar de desempenho", "Tarefas da semana", "Próxima Missão"]) await expect(page.getByText(fora)).toHaveCount(0);
  await noTopo(cartao);
  await page.screenshot({ path: `${SAIDA}/hoje.png` });

  // regra 4: próximas semanas abrem no próprio Hoje
  const titulo = await page.title();
  await semana.getByRole("button", { name: "Ver próximas semanas ▾" }).click();
  await expect(semana.getByText(/^Semana 2 · 0 de 6 missões$/)).toBeVisible();
  expect(await page.title(), "não trocou de aba").toBe(titulo);
  await semana.getByRole("button", { name: "Ocultar próximas semanas ▴" }).click();

  // regra 2: Iniciar missão abre a sessão na hora, com 10, e liga o cronômetro
  const entregas = [];
  page.on("request", (r) => {
    if (/functions\/v1\/questoes-integradas/.test(r.url()) && r.method() === "POST") {
      const corpo = r.postDataJSON?.() ?? {};
      if (corpo.acao === "entregar") entregas.push(corpo);
    }
  });
  await page.evaluate(() => localStorage.removeItem("triliva-tamanho-lote"));
  await cartao.getByRole("button", { name: "▶ Iniciar missão" }).tap();
  const sessao = page.getByLabel("Questões da missão", { exact: true });
  await expect(sessao.getByText(/^Questão 1 de \d+$/)).toBeVisible({ timeout: 90_000 });
  expect(entregas[0]?.tamanho, "último tamanho, padrão 10").toBe(10);
  await expect(page.getByText("● questões")).toBeVisible();
  await page.waitForTimeout(800);
  await noTopo(sessao);
  await page.screenshot({ path: `${SAIDA}/sessao.png` });
  const respondidas = await responderLote(page);
  await expect(sessao.getByText(/^\d+ de \d+ certas?$/)).toBeVisible();
  await sessao.getByRole("button", { name: "Fechar" }).tap();
  await expect(page.getByText("● questões"), "fechar a sessão zera o cronômetro dela").toHaveCount(0);
  const feitas = Math.min(meta, antes + respondidas);
  const linhaDela = semana.getByRole("listitem").filter({ hasText: nome });
  await expect(linhaDela).toContainText(`${feitas}/${meta}`, { timeout: 30_000 });
  // fecha só com a meta de questões E a de acerto: quem decide é o servidor
  const fechou = (await linhaDela.getAttribute("data-estado")) === "concluida";
  if (!fechou) await expect(cartao.getByText(`${feitas} de ${meta} questões`, { exact: true })).toBeVisible();
  else {
    // regra 1: concluída, a missão de agora passa à próxima da semana
    await expect(linhaDela).toHaveAttribute("data-estado", "concluida");
    await expect(linhaDela.getByRole("button"), "concluída: ✓ sem botão no Hoje").toHaveCount(0);
    await expect(cartao.getByRole("heading", { name: nome, exact: true })).toHaveCount(0);
  }
  await noTopo(cartao);
  await page.screenshot({ path: `${SAIDA}/hoje-depois.png` });

  // regra 5: Plano com as mesmas linhas por semana e as tarefas abaixo
  await page.getByRole("button", { name: /^Plano(\s+\d+)?$/ }).filter({ visible: true }).first().tap();
  const s1 = page.getByRole("region", { name: "Semana 1" });
  const s2 = page.getByRole("region", { name: "Semana 2" });
  await expect(s1.getByRole("listitem").filter({ hasText: nome })).toContainText(`${feitas}/${meta}`);
  if (fechou) await expect(s1.getByRole("button", { name: `Revisar: ${nome}` }), "revisão só no Plano").toBeVisible();
  await expect(s1.getByText("Tarefas da semana")).toBeVisible();
  await expect(s2.getByText("Tarefas da semana"), "a semana do calendário também abre").toBeVisible();
  await expect(s2.getByRole("button", { name: "✓ Concluir" }).first()).toBeVisible();
  await expect(page.getByText("Progresso confirmado"), "o aviso de progresso sai antes da foto").toHaveCount(0, { timeout: 15_000 });
  await noTopo(page.getByText("Seu plano"));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SAIDA}/plano.png` });
  await page.screenshot({ path: `${SAIDA}/plano-inteiro.png`, fullPage: true });
});

test("B: fecha Penal Militar da semana 1; a da vez sem questões mostra Registrar e abre o registro com a missão, no Hoje", async ({ page }) => {
  const codigo = process.env.DEMO_ALUNO_B_CODIGO, senha = process.env.DEMO_ALUNO_B_SENHA;
  test.skip(!codigo || !senha, "sem aluno B de teste do demo");
  test.setTimeout(900_000);
  mkdirSync(SAIDA, { recursive: true });
  await entrar(page, codigo, senha);
  const semana = page.getByRole("region", { name: "Missões da semana" });
  const penalMilitar = semana.getByRole("listitem").filter({ hasText: "Quando o caso é militar" });

  // fecha a missão da semana 1 de Penal Militar pela sessão (13 questões)
  if (!(await penalMilitar.getAttribute("data-estado"))?.includes("concluida")) {
    await page.evaluate(() => localStorage.setItem("triliva-tamanho-lote", "20"));
    await penalMilitar.getByRole("button", { name: /^Iniciar: / }).tap();
    for (let lote = 0; lote < 3; lote++) {
      await responderLote(page);
      const sessao = page.getByLabel("Questões da missão", { exact: true });
      if (await sessao.getByText("Missão concluída", { exact: true }).isVisible()) break;
      await sessao.getByRole("button", { name: /^Continuar: mais \d+$/ }).tap();
    }
    await page.getByLabel("Questões da missão", { exact: true }).getByRole("button", { name: "Fechar" }).tap();
  }
  await expect(penalMilitar).toHaveAttribute("data-estado", "concluida", { timeout: 30_000 });
  await expect(penalMilitar.getByRole("button"), "concluída: ✓ sem botão no Hoje").toHaveCount(0);

  // a da vez em Penal Militar agora é "Crime militar", sem questões: Registrar
  await semana.getByRole("button", { name: "Ver próximas semanas ▾" }).tap();
  const crimeMilitar = semana.getByRole("listitem").filter({ hasText: "Crime militar, imputabilidade e concurso de agentes" });
  const registrar = crimeMilitar.getByRole("button", { name: /^Registrar: / });
  await expect(registrar).toBeVisible();
  await expect(page.getByText("Progresso confirmado")).toHaveCount(0, { timeout: 15_000 });
  await noTopo(penalMilitar); // na mesma foto: a ✓ da semana 1 e a da vez sem questões
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SAIDA}/hoje-b-sem-questoes.png` });
  const titulo = await page.title();
  await registrar.tap();
  await expect(page.getByText("Registro rápido")).toBeVisible();
  await expect(page.getByText("Crime militar, imputabilidade e concurso de agentes").first()).toBeVisible();
  await expect(page.getByLabel("Matéria", { exact: true })).toBeDisabled();
  expect(await page.title(), "o registro abre no próprio Hoje").toBe(titulo);
  await expect(page.getByText("Progresso confirmado")).toHaveCount(0, { timeout: 15_000 });
  await noTopo(page.getByRole("button", { name: "← Voltar às missões" }));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SAIDA}/hoje-b-registro.png` });
  await page.getByRole("button", { name: "← Voltar às missões" }).tap();
  await expect(page.getByRole("region", { name: "Missão de agora" })).toBeVisible();
});
