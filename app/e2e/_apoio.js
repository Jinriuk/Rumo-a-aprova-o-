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

async function abrirLogin(page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
}

export async function loginCoordenacao(page, conta = CONTAS.coordenacaoVitrine) {
  await abrirLogin(page);
  await page.getByRole("button", { name: /Coordenação/ }).click();
  await page.getByLabel("E-mail").fill(conta.email);
  await page.getByLabel("Senha").fill(conta.senha);
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
  // a tela do aluno traz o botão Sair e as abas do estudo
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible({ timeout: 15_000 });
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
  const direto = page.getByRole("button", { name: rotulo, exact: true });
  if (await direto.isVisible().catch(() => false)) {
    await direto.first().click();
    return;
  }
  // está escondida atrás de "Mais" (barra inferior do celular)
  await page.getByRole("button", { name: "Mais", exact: true }).click();
  await page.getByRole("button", { name: rotulo, exact: true }).first().click();
}

