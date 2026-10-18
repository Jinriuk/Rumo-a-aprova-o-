/* P1.1 — sessão de questões da missão, de ponta a ponta no DEMO, no
   celular (390×844, toque).
   Aluno PMERJ de teste (criado para a ocasião, apagado depois) entra pelo
   código; se a conta pedir troca de senha, troca (a senha nova só existe
   na memória do teste). No Plano, na M01-ADM, toca em "Iniciar missão",
   que abre a sessão de questões direto no Hoje (não o registro), com o
   último tamanho escolhido (o teste deixa 5 guardado; raio-x fase 2), e
   segue "Continuar: mais 5" até a meta da missão. O lote seguinte sai na hora:
   antes da 0067 o pedido logo depois de uma busca cheia recebia "Não há
   questão nova" (17/10, 22:35).
   Ver playwright.demo.config.js para rodar. Gasta créditos da Quest se a
   missão não tiver estoque guardado (a 0067 busca até 20 de uma vez).
   Só com conta descartável (código E2E…, escola de teste): com conta da
   vitrine o teste se recusa a rodar (e2e-demo/_contas.js). Se falhar
   depois da troca de senha, a senha nova se perdeu com o processo: apague
   a conta e crie outra. */
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { transporteDemo } from "./_transporte.js";
import { recusaCodigoDoDemo, recusarEscolaDaVitrine } from "./_contas.js";

const MISSAO = "Organização administrativa: direta, indireta e delegação";
const SAIDA = process.env.DEMO_SAIDA || "e2e-demo-resultados";

test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
});

async function responderLote(page, { total, aoMeio }) {
  for (let i = 1; i <= total; i++) {
    await expect(page.getByText(`Questão ${i} de ${total}`)).toBeVisible();
    // só as alternativas: "Por vez: 5 · 10 · 20" também são rádios
    await page.getByRole("radio", { name: /^Alternativa / }).nth(i % 2).check();
    await page.getByRole("button", { name: "Confirmar resposta" }).click();
    await expect(page.getByText(/^(Certa\.|Errada\. Gabarito: [A-J]\.)$/)).toBeVisible({ timeout: 30_000 });
    if (i === Math.ceil(total / 2)) await aoMeio?.();
    await page.getByRole("button", { name: i < total ? "Próxima questão" : "Ver resultado" }).click();
  }
}

test("celular: Iniciar missão abre as questões com o último tamanho (5) e segue lote a lote até a meta", async ({ page }) => {
  test.skip(!process.env.DEMO_ALUNO_CODIGO || !process.env.DEMO_ALUNO_SENHA, "sem aluno de teste do demo");
  const recusa = recusaCodigoDoDemo(process.env.DEMO_ALUNO_CODIGO);
  if (recusa) throw new Error(`Recusado: ${recusa}. Este teste troca a senha e fecha missão; use uma conta descartável.`);
  test.setTimeout(600_000);
  mkdirSync(SAIDA, { recursive: true });
  const entregas = [];
  const chamadas = [];
  page.on("response", async (r) => {
    if (!/functions\/v1\/questoes-integradas/.test(r.url())) return;
    chamadas.push(r.status());
    const corpo = r.request().postDataJSON?.() ?? null;
    if (corpo?.acao === "entregar") {
      const j = await r.json().catch(() => ({}));
      entregas.push({ em: Date.now(), status: r.status(), estado: j?.estado, n: j?.entrega?.questoes?.length ?? 0, tipo: j?.entrega?.tipo_pratica });
    }
  });
  await transporteDemo(page);

  await page.goto("/");
  await page.getByRole("button", { name: /Aluno \/ Responsável/ }).click();
  await page.getByLabel("Código de acesso", { exact: true }).fill(process.env.DEMO_ALUNO_CODIGO);
  await page.getByLabel("Senha", { exact: true }).fill(process.env.DEMO_ALUNO_SENHA);
  await page.getByRole("button", { name: /^Entrar na missão/ }).click();

  // primeira entrada: troca de senha (PR C confere o log desta troca no banco)
  const gate = page.getByText("Escolha sua senha");
  const hoje = page.getByRole("region", { name: "Sua missão agora" });
  await expect(gate.or(hoje)).toBeVisible({ timeout: 45_000 });
  await recusarEscolaDaVitrine(page);   // antes de trocar a senha
  if (await gate.isVisible()) {
    const nova = `Nova-7${randomBytes(9).toString("base64url")}`;
    await page.getByLabel("Nova senha", { exact: true }).fill(nova);
    await page.getByLabel("Confirmar senha", { exact: true }).fill(nova);
    await page.getByRole("button", { name: "Definir senha e continuar" }).click();
  }
  await expect(hoje).toBeVisible({ timeout: 45_000 });
  // o teste conta lotes de 5: deixa 5 como o último tamanho escolhido
  await page.evaluate(() => localStorage.setItem("triliva-tamanho-lote", "5"));

  // 1) no Plano (as missões saíram do Hoje), "Iniciar missão" na missão
  // ligada: abre a sessão, não o registro
  await page.getByRole("button", { name: "Mais" }).filter({ visible: true }).first().tap();
  await page.getByRole("menu").getByRole("menuitem", { name: /^Plano(\s+\d+)?$/ }).tap();
  const cartao = page.locator("li").filter({ hasText: MISSAO }).first();
  const iniciar = cartao.getByRole("button", { name: "Iniciar missão" });
  await expect(iniciar).toBeVisible({ timeout: 45_000 });
  await expect(cartao.getByRole("button", { name: "Registrar à mão" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resolver questões aqui" })).toHaveCount(0);
  await iniciar.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SAIDA}/m1-iniciar-missao.png` });
  await iniciar.tap();

  // 2) a sessão abre direto, com o último tamanho (5); trocar fica nela
  const sessao = page.getByLabel("Questões da missão", { exact: true });
  await expect(sessao).toBeInViewport({ timeout: 60_000 });
  await expect(page.getByText("Quantas questões por vez?")).toHaveCount(0);
  const por = sessao.getByRole("radiogroup", { name: "Por vez:" });
  await expect(por.getByRole("radio", { name: "5" })).toHaveAttribute("aria-checked", "true", { timeout: 60_000 });
  await expect(por.getByRole("radio", { name: "10" })).toHaveAttribute("aria-checked", "false");
  await expect(por.getByRole("radio", { name: "20" })).toBeVisible();
  await page.waitForTimeout(600);   // fim da rolagem suave
  await page.screenshot({ path: `${SAIDA}/m2a-iniciar-abre-a-sessao.png` });
  const progresso = page.getByText(/^(\d+) de (\d+) questões desta missão$/);
  const lerProgresso = async () => (await progresso.first().textContent()).match(/^(\d+) de (\d+)/).slice(1).map(Number);
  const [inicio, meta] = await lerProgresso();
  expect(meta, "N = meta_questoes da missão").toBe(20);
  await sessao.screenshot({ path: `${SAIDA}/m2-sessao-aberta.png` });

  // 3) lotes de 5 até a meta; o seguinte sai na hora
  let feitas = inicio;
  let lote = 0;
  while (true) {
    lote++;
    const contador = page.getByText(/^Questão 1 de \d+$/);
    await expect(contador, `lote ${lote} abriu`).toBeVisible({ timeout: 60_000 });
    const total = Number((await contador.textContent()).match(/de (\d+)/)[1]);
    expect(total, "lote do tamanho escolhido").toBe(5);
    await responderLote(page, {
      total,
      aoMeio: lote === 1 ? () => sessao.screenshot({ path: `${SAIDA}/m3-meio-do-lote.png` }) : null,
    });
    await expect(page.getByText(/^\d+ de \d+ certas?$/)).toBeVisible();
    const [agora] = await lerProgresso();
    expect(agora, "o progresso soma o lote").toBe(feitas + total);
    feitas = agora;
    const concluida = page.getByText("Missão concluída", { exact: true });
    if (await concluida.isVisible()) {
      await expect(page.getByRole("button", { name: "Continuar praticando" })).toBeVisible();
      await expect(page.getByText(/“Continuar praticando” abre questões de revisão/)).toBeVisible();
      await sessao.screenshot({ path: `${SAIDA}/m5-missao-concluida.png` });
      // seguir praticando (revisão): com o estoque da missão já respondido,
      // é uma busca logo depois de outra cheia, o caso das 22:35
      await page.getByRole("button", { name: "Continuar praticando" }).tap();
      await expect(page.getByText(/^Questão 1 de \d+$/), "Continuar praticando abre lote").toBeVisible({ timeout: 60_000 });
      // é revisão: o título e a linha dizem isso, e "X de N desta missão" some
      await expect(page.getByText(/^Revisão · /)).toBeVisible();
      await expect(page.getByText(/^Revisão: estas questões ficam no assunto e não contam para a missão/)).toBeVisible();
      await expect(page.getByText(/questões desta missão$/)).toHaveCount(0);
      expect(entregas.at(-1)?.tipo, "o servidor entregou o lote como revisão").toBe("revisao");
      await sessao.screenshot({ path: `${SAIDA}/m6-continuar-praticando.png` });
      break;
    }
    const continuar = page.getByRole("button", { name: "Continuar: mais 5" });
    await expect(continuar).toBeVisible();
    if (lote === 1) await sessao.screenshot({ path: `${SAIDA}/m4-fim-do-lote.png` });
    expect(lote, "a meta fecha em até 6 lotes de 5 (ou falta acurácia: ver o relatório)").toBeLessThan(6);
    await continuar.tap();
  }

  // o lote 2 saiu antes dos 2 minutos de rebusca e veio cheio
  expect(entregas.length).toBeGreaterThanOrEqual(2);
  expect(entregas[1].em - entregas[0].em, "segundo lote logo depois do primeiro").toBeLessThan(120_000);
  for (const e of entregas) expect([e.status, e.estado, e.n]).toEqual([200, "ok", 5]);
  expect(chamadas.filter((s) => s >= 400), "nenhuma chamada à função falhou").toEqual([]);
  expect(page.getByText(/Não há questão nova/)).toHaveCount(0);
  console.log(`E2E sessão: ${lote} lotes, ${feitas} de ${meta}, entregas em ${entregas.map((e) => Math.round((e.em - entregas[0].em) / 1000) + "s").join(", ")}`);
});
