// @ts-check
/* Apoio comum aos testes: credenciais do seed de demonstração,
   funções de login por papel e um guarda de erros de console. */
import { expect } from "@playwright/test";

// Credenciais provisionadas pelo seed (supabase/seed/04_usuarios_auth_dev.sql).
// Conferidas em auth.users no projeto de demo.
export const CONTAS = {
  coordenacaoVitrine: { email: "coordenacao@vitrine.demo", senha: "vitrine-coord-2026" },
  coordenacaoBeta: { email: "coordenacao@beta.demo", senha: "beta-coord-2026" },
  alunoLucas: { codigo: "LUCASDEMO2026" },     // Vitrine
  alunoBruno: { codigo: "BRUNODEMO2026" },     // Beta
  responsavelLucas: { codigo: "RESPDEMO2026X" }, // Vitrine
};

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

/** Campo de formulário pelo rótulo. Os <label> do app NÃO são
 *  associados ao input (sem htmlFor) — são irmãos no DOM, então o
 *  getByLabel não acha. Selecionamos o input vizinho do label.
 *  (Associar labels de verdade fica anotado como melhoria de a11y.) */
export function campo(page, rotulo) {
  return page.locator(`label:has-text("${rotulo}") + input`).first();
}

/** Botão VISÍVEL pelo nome. O menu existe duplicado no DOM (sidebar
 *  do desktop + barra inferior do celular; um deles sempre escondido
 *  por CSS) — sem o filtro de visibilidade o strict mode estoura. */
export function botaoVisivel(page, nome) {
  return page.getByRole("button", { name: nome, exact: true }).filter({ visible: true }).first();
}

async function abrirLogin(page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
}

export async function loginCoordenacao(page, conta = CONTAS.coordenacaoVitrine) {
  await abrirLogin(page);
  await page.getByRole("button", { name: /Coordenação/ }).click();
  await page.locator('input[type="email"]').fill(conta.email);
  await page.locator('input[type="password"]').fill(conta.senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  // entrou: o cabeçalho da coordenação aparece
  await expect(page.getByText("Painel de gestão")).toBeVisible({ timeout: 15_000 });
}

async function loginPorCodigo(page, codigo) {
  await abrirLogin(page);
  await page.getByRole("button", { name: /Aluno \/ Responsável/ }).click();
  await page.getByPlaceholder("XXXX-XXXX-XXXX").fill(codigo);
  await page.getByRole("button", { name: "Entrar" }).click();
}

export async function loginAluno(page, conta = CONTAS.alunoLucas) {
  await loginPorCodigo(page, conta.codigo);
  // espera o MENU do aluno (não só o cabeçalho): ele só aparece
  // depois que os dados carregam — navegação antes disso falharia
  await expect(botaoVisivel(page, "Hoje")).toBeVisible({ timeout: 15_000 });
}

export async function loginResponsavel(page, conta = CONTAS.responsavelLucas) {
  await loginPorCodigo(page, conta.codigo);
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible({ timeout: 15_000 });
}

export async function sair(page) {
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible({ timeout: 15_000 });
}

/** Navega para uma aba pelo rótulo, funcionando tanto na sidebar do
 *  desktop quanto na barra inferior do celular (onde abas excedentes
 *  ficam atrás do botão "Mais"). */
export async function irParaAba(page, rotulo) {
  const direto = botaoVisivel(page, rotulo);
  if (await direto.count()) {
    await direto.click();
    return;
  }
  // está escondida atrás de "Mais" (barra inferior do celular)
  await botaoVisivel(page, "Mais").click();
  await botaoVisivel(page, rotulo).click();
}

