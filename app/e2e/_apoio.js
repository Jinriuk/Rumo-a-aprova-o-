// @ts-check
/* Apoio comum aos testes: credenciais do seed de demonstração,
   funções de login por papel e um guarda de erros de console. */
import { expect } from "./local/base.js";

// ETAPA 3: as contas vêm da fixture do E2E local (scripts/e2e/contas.mjs),
// criadas pela API admin do Auth local em scripts/e2e/semear.mjs, com os
// ids do seed 01. A senha só existe na stack descartável do runner.
import { CONTAS as FIXTURE, SENHA_E2E, SENHA_NOVA_E2E } from "../../scripts/e2e/contas.mjs";

const porEmail = (c) => ({ email: c.email, senha: SENHA_E2E, id: c.id });
const porCodigo = (c) => ({ codigo: c.codigo, senha: SENHA_E2E, id: c.id, alunoId: c.alunoId });
export const CONTAS = {
  coordenacaoVitrine: porEmail(FIXTURE.coordVitrine),
  coordenacaoBeta: porEmail(FIXTURE.coordBeta),
  coordenacaoRecuperacao: porEmail(FIXTURE.coordRecuperacao),
  superAdmin: porEmail(FIXTURE.superAdmin),
  alunoLucas: porCodigo(FIXTURE.lucas),     // Vitrine
  alunoBruno: porCodigo(FIXTURE.bruno),     // Beta
  responsavelLucas: porCodigo(FIXTURE.respLucas), // Vitrine
  responsavelBruno: porCodigo(FIXTURE.respBruno), // Beta
  alunaTroca: porCodigo(FIXTURE.alunaTroca), // entra exigindo troca de senha
};
export { SENHA_E2E, SENHA_NOVA_E2E };

// Erros de console que NÃO devem reprovar o teste (ruído conhecido e
// inofensivo de libs de terceiros / ambiente). Tudo o mais reprova.
const RUIDO_CONHECIDO = [
  /Download the React DevTools/i,
  /ResizeObserver loop/i,                       // recharts em viewport pequeno
  /favicon/i,
  /\[vite\]/i,
];

/** Liga um coletor de erros de console/página. Chame antes de navegar.
 *  Devolve um array vivo; asserte que está vazio ao fim do teste. */
export function coletarErros(page) {
  const erros = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const txt = msg.text();
    if (RUIDO_CONHECIDO.some((re) => re.test(txt))) return;
    erros.push(txt);
  });
  page.on("pageerror", (err) => erros.push(String(err)));
  return erros;
}

/** Não pode haver scroll horizontal (estouro lateral) no documento. */
export async function semEstouroHorizontal(page) {
  const estoura = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(estoura, "não deve haver rolagem horizontal (estouro lateral)").toBe(false);
}

/** Campo de formulário pelo rótulo. Desde a UX1 cada <label> tem
 *  htmlFor apontando para o seu controle, então o rótulo acessível é o
 *  caminho estável (o seletor antigo, "label + input", parou de casar
 *  quando o campo ganhou ícone e passou meses sem ninguém ver, porque o
 *  E2E ficava pulado). `exact` separa "Senha" de "Mostrar senha". */
export function campo(page, rotulo) {
  return page.getByLabel(rotulo, { exact: true });
}

/** O botão de entrar da tela de login ("Entrar na missão"). */
export function botaoEntrar(page) {
  return page.getByRole("button", { name: /^Entrar na missão/ });
}

/** Botão VISÍVEL pelo nome. O menu existe duplicado no DOM (sidebar
 *  do desktop + barra inferior do celular; um deles sempre escondido
 *  por CSS) — sem o filtro de visibilidade o strict mode estoura. */
export function botaoVisivel(page, nome) {
  // aba pode trazer um contador no nome ("Hoje 6"): casa o rótulo no começo
  const alvo = typeof nome === "string" ? new RegExp(`^${nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s+\\d+)?$`) : nome;
  return page.getByRole("button", { name: alvo }).filter({ visible: true }).first();
}

async function abrirLogin(page) {
  await page.goto("/");
  await expect(botaoEntrar(page)).toBeVisible();
}

export async function loginCoordenacao(page, conta = CONTAS.coordenacaoVitrine) {
  await abrirLogin(page);
  await page.getByRole("button", { name: /Coordenação/ }).click();
  await campo(page, "E-mail").fill(conta.email);
  await campo(page, "Senha").fill(conta.senha);
  await botaoEntrar(page).click();
  // entrou: o cabeçalho da coordenação aparece
  await expect(page.getByText("Painel de gestão")).toBeVisible({ timeout: 15_000 });
}

export async function loginPorCodigo(page, conta) {
  await abrirLogin(page);
  await page.getByRole("button", { name: /Aluno \/ Responsável/ }).click();
  // Seletor por rótulo (label "Código de acesso" + input). Antes usava
  // getByPlaceholder("XXXX-XXXX-XXXX"), que deixou de casar quando o
  // placeholder virou "Ex.: LUCASDEMO2026" — quebrava todo login por código.
  await campo(page, "Código de acesso").fill(conta.codigo);
  // Etapa 7 / BLOCO B1: sem preencher a senha o botão fica DESABILITADO
  // (o gate `pronto` exige os dois campos) e o clique abaixo não faz nada
  // — foi exatamente assim que esta suíte quebrou ao virar o modelo.
  await campo(page, "Senha").fill(conta.senha);
  await botaoEntrar(page).click();
}

const soPath = (u) => { try { return new URL(u).pathname; } catch { return u; } };

export async function loginAluno(page, conta = CONTAS.alunoLucas) {
  // DIAGNÓSTICO (Fase 17): se a área do aluno não concluir, lança o erro
  // COM evidência embutida na MENSAGEM (console/página, falhas de rede e
  // o texto visível) — o reporter sempre mostra a mensagem da falha. Em
  // paralelo, trace+vídeo+screenshot ficam no artefato (playwright.config).
  // Só no caminho de erro — não mascara nada.
  const diag = [];
  const net = [];
  page.on("console", (m) => { if (m.type() === "error") diag.push("console: " + m.text()); });
  page.on("pageerror", (e) => diag.push("pageerror: " + String(e)));
  page.on("requestfailed", (r) => net.push(`FAIL ${r.method()} ${soPath(r.url())} — ${r.failure()?.errorText ?? ""}`));
  page.on("response", (r) => { if (r.status() >= 400) net.push(`${r.status()} ${soPath(r.url())}`); });
  await loginPorCodigo(page, conta);
  try {
    await expect(botaoVisivel(page, "Hoje")).toBeVisible({ timeout: 15_000 });
  } catch {
    const corpo = await page.locator("body").innerText().catch(() => "(sem corpo)");
    throw new Error(
      "[DIAG] aluno não mostrou 'Hoje'." +
      "\n[console/página]: " + (diag.join(" | ") || "(nenhum)") +
      "\n[network 4xx/5xx/falha]: " + (net.join(" | ") || "(nenhum)") +
      "\n[tela]: " + String(corpo).replace(/\s+/g, " ").trim().slice(0, 500),
    );
  }
}

export async function loginResponsavel(page, conta = CONTAS.responsavelLucas) {
  await loginPorCodigo(page, conta);
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible({ timeout: 15_000 });
}

export async function sair(page) {
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(botaoEntrar(page)).toBeVisible({ timeout: 15_000 });
}

/** Navega para uma aba pelo rótulo, funcionando tanto na sidebar do
 *  desktop quanto na barra inferior do celular (onde abas excedentes
 *  ficam atrás do botão "Mais"). */
export async function irParaAba(page, rotulo) {
  const alvo = botaoVisivel(page, rotulo);
  const mais = botaoVisivel(page, "Mais");
  // pós-reload o menu demora a renderizar: espera a aba OU o "Mais"
  // aparecer antes de decidir o caminho (sem isso, count()=0 cedo
  // demais manda pro "Mais", que não existe no desktop → trava)
  await expect(alvo.or(mais).first()).toBeVisible({ timeout: 15_000 });
  if (await alvo.count()) {
    await alvo.click();
    return;
  }
  // está escondida atrás de "Mais" (barra inferior do celular)
  await mais.click();
  await botaoVisivel(page, rotulo).click();
}

