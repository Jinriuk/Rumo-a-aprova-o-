// ============================================================
// ETAPA 4 — prova do FRONT em navegador real, com o coletor interceptado
// ------------------------------------------------------------
// Uso:  node scripts/alertas/prova-front.mjs
// (requer `npm ci` em app/ e o Chromium do Playwright; PW_CHROMIUM_PATH
// aponta outro executável)
//
// Builda o front (--mode e2e, fora de app/dist) com VITE_ERROR_REPORT_URL
// apontando para um endereço local que NÃO existe, serve com `vite
// preview` e intercepta, no navegador, o POST para o coletor. Não precisa
// de Supabase nem de rede: prova o que o navegador manda e que a tela não
// cai, independentemente do coletor (que tem prova própria na stack
// local: scripts/alertas/provas.sh, no PR de banco).
//
//   F1 erro de render do React: a ErroFronteira aparece com "Código do
//      erro", e o relato leva release (SHA do build), rota, papel,
//      correlation_id (o mesmo código da tela) e componente
//   F2 promessa rejeitada e erro de janela chegam ao coletor
//   F3 POST text/plain, sem preflight, sem credencial
//   F4 coletor recusando, com 503 ou pendurado: a tela segue respondendo
//   F5 tempestade de 30 erros: no máximo 10 relatos saem da página
// ============================================================
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const APP = resolve(RAIZ, "app");
const { chromium } = createRequire(resolve(APP, "package.json"))("@playwright/test");
const SAIDA = process.env.PROVAS_SAIDA || resolve(RAIZ, "e2e-artefatos/alertas-front");
mkdirSync(SAIDA, { recursive: true });

const PORTA = 4174;
const FRONT = `http://127.0.0.1:${PORTA}`;
const COLETOR = "http://127.0.0.1:59999/functions/v1/registrar-erro";
const DIST = mkdtempSync(join(tmpdir(), "prova-front-"));
const RELEASE = (process.env.GITHUB_SHA || execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { cwd: RAIZ, encoding: "utf8" }).trim()).slice(0, 12);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

execFileSync("npx", ["vite", "build", "--mode", "e2e", "--outDir", DIST, "--emptyOutDir"], {
  cwd: APP, stdio: ["ignore", "ignore", "inherit"],
  env: { ...process.env, VITE_SUPABASE_URL: "http://127.0.0.1:59998", VITE_SUPABASE_ANON_KEY: "anon-so-desta-prova", VITE_ERROR_REPORT_URL: COLETOR },
});
const servidor = spawn("npx", ["vite", "preview", "--outDir", DIST, "--port", String(PORTA), "--host", "127.0.0.1", "--strictPort"], { cwd: APP, stdio: "ignore" });
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(FRONT)).ok) break; } catch { /* subindo */ }
  await new Promise((r) => setTimeout(r, 500));
}

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const resultados = [];
const exigir = (c, m) => { if (!c) throw new Error(m); };
async function prova(id, titulo, fn) {
  try {
    const d = await fn();
    resultados.push({ id, titulo, ok: true, detalhe: d ?? "" });
    console.log(`✔ ${id} ${titulo}${d ? ` — ${d}` : ""}`);
  } catch (e) {
    resultados.push({ id, titulo, ok: false, detalhe: e.message });
    console.error(`✘ ${id} ${titulo} — ${e.message}`);
  }
}

const QUEBRA = `export default function ErroSintetico() { throw new Error("erro sintético de render (prova front E4)"); }`;
async function pagina(coletor = (r) => r.fulfill({ status: 202, body: '{"ok":true}' })) {
  const ctx = await browser.newContext({ locale: "pt-BR" });
  const page = await ctx.newPage();
  const relatos = [];
  const preflights = [];
  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message));
  // a tela de redefinição é lazy: trocar o chunk dela por um componente
  // que lança é um erro de render real, dentro da ErroFronteira real
  await page.route(/\/assets\/RedefinirSenha-[^/]+\.js$/, (r) => r.fulfill({ contentType: "text/javascript", body: QUEBRA }));
  await page.route(/registrar-erro/, (r) => {
    const req = r.request();
    if (req.method() === "OPTIONS") { preflights.push(req.url()); return r.fulfill({ status: 204 }); }
    relatos.push({ headers: req.headers(), corpo: JSON.parse(req.postData() || "{}") });
    return coletor(r);
  });
  return { ctx, page, relatos, preflights, erros };
}
const esperar = async (fn, ms = 8000) => { const fim = Date.now() + ms; while (Date.now() < fim) { const v = fn(); if (v) return v; await new Promise((r) => setTimeout(r, 100)); } return fn(); };
const rejeitar = (page, m) => page.evaluate((x) => { setTimeout(() => { Promise.reject(new Error(x)); }, 0); }, m);

await prova("F1", "erro de render do React: tela de erro com código, e relato completo", async () => {
  const { ctx, page, relatos } = await pagina();
  await page.goto(`${FRONT}/redefinir-senha`);
  await page.getByText("Algo deu errado nesta tela.").waitFor({ timeout: 15000 });
  const r = await esperar(() => relatos.find((x) => x.corpo.origem === "react-error-boundary"));
  exigir(r, "nenhum relato do React saiu");
  const c = r.corpo;
  exigir(/erro sintético de render/.test(c.mensagem), `mensagem: ${c.mensagem}`);
  exigir(c.release === RELEASE, `release ${c.release}, esperava ${RELEASE}`);
  exigir(c.rota === "/redefinir-senha", `rota ${c.rota}`);
  exigir(c.papel === "anonimo", `papel ${c.papel}`);
  exigir(UUID_RE.test(c.correlation_id), `correlation_id ${c.correlation_id}`);
  exigir(typeof c.componente === "string" && c.componente.length > 0, "sem componentStack");
  const codigo = (await page.locator("code").first().textContent())?.trim();
  exigir(codigo === c.correlation_id.slice(0, 8), `código na tela ${codigo} ≠ início do correlation_id ${c.correlation_id}`);
  await page.getByRole("button", { name: "Atualizar página" }).waitFor();
  await ctx.close();
  writeFileSync(resolve(SAIDA, "f1-relato.json"), JSON.stringify(c, null, 2));
  return `release=${c.release}, rota=${c.rota}, papel=${c.papel}, correlation_id=${c.correlation_id}, código na tela=${codigo}`;
});

await prova("F2/F3", "promessa rejeitada e erro de janela chegam; POST text/plain sem preflight nem credencial", async () => {
  const { ctx, page, relatos, preflights } = await pagina();
  await page.goto(`${FRONT}/`);
  await page.locator("input").first().waitFor({ timeout: 15000 });
  await rejeitar(page, "promessa rejeitada sintética (prova front E4)");
  await page.evaluate(() => { setTimeout(() => { throw new Error("erro de janela sintético (prova front E4)"); }, 0); });
  const p = await esperar(() => relatos.find((x) => x.corpo.origem === "unhandledrejection"));
  const w = await esperar(() => relatos.find((x) => x.corpo.origem === "window.onerror"));
  exigir(p && /promessa rejeitada sintética/.test(p.corpo.mensagem), "promessa rejeitada não saiu");
  exigir(w && /erro de janela sintético/.test(w.corpo.mensagem), "erro de janela não saiu");
  exigir(p.corpo.rota === "/" && p.corpo.release === RELEASE && UUID_RE.test(p.corpo.correlation_id), `relato da promessa: ${JSON.stringify(p.corpo)}`);
  exigir(p.corpo.correlation_id !== w.corpo.correlation_id, "dois erros com o mesmo correlation_id");
  exigir(/^text\/plain/.test(p.headers["content-type"] ?? ""), `content-type ${p.headers["content-type"]}`);
  exigir(!p.headers.cookie && !p.headers.authorization, "relato levou credencial");
  exigir(preflights.length === 0, `houve preflight: ${preflights.length}`);
  await ctx.close();
  return `2 relatos (unhandledrejection, window.onerror), content-type ${p.headers["content-type"]}, 0 preflight, sem cookie nem Authorization`;
});

await prova("F4", "coletor recusando, com 503 ou pendurado: a tela segue respondendo", async () => {
  const modos = {
    recusado: (r) => r.abort("connectionrefused"),
    "503": (r) => r.fulfill({ status: 503, body: "fora" }),
    pendurado: () => new Promise(() => {}),
  };
  const notas = [];
  for (const [nome, coletor] of Object.entries(modos)) {
    const { ctx, page, erros, relatos } = await pagina(coletor);
    await page.goto(`${FRONT}/`);
    const campo = page.locator("input").first();
    await campo.waitFor({ timeout: 15000 });
    for (let i = 0; i < 3; i++) await rejeitar(page, `rejeição com coletor ${nome} ${i}`);
    await page.evaluate(() => { setTimeout(() => { throw new Error("erro de janela com coletor fora"); }, 0); });
    await new Promise((r) => setTimeout(r, 1500));
    await campo.fill("ABCD");
    exigir((await campo.inputValue()) !== "", `${nome}: a tela de entrada parou de responder`);
    const estranhos = erros.filter((m) => !/rejeição com coletor|erro de janela com coletor fora/.test(m));
    exigir(estranhos.length === 0, `${nome}: erro novo na página: ${estranhos.join(" | ")}`);
    const tentados = relatos.length;
    exigir(tentados === 4, `${nome}: ${tentados} relatos tentados, esperava os 4 provocados`);
    await page.goto(`${FRONT}/redefinir-senha`);
    await page.getByRole("button", { name: "Atualizar página" }).waitFor({ timeout: 15000 });
    notas.push(`${nome}: entrada responde, ${tentados} relatos tentados (os 4 provocados), nenhum erro novo, fronteira com "Atualizar página"`);
    await ctx.close();
  }
  return notas.join("; ");
});

await prova("F5", "tempestade de 30 erros: no máximo 10 relatos saem da página", async () => {
  const { ctx, page, relatos } = await pagina();
  await page.goto(`${FRONT}/`);
  await page.locator("input").first().waitFor({ timeout: 15000 });
  await page.evaluate(() => { for (let i = 0; i < 30; i++) setTimeout(() => { Promise.reject(new Error(`tempestade ${i}`)); }, 0); });
  await new Promise((r) => setTimeout(r, 2000));
  exigir(relatos.length === 10, `saíram ${relatos.length} relatos`);
  await ctx.close();
  return `30 rejeições, ${relatos.length} relatos enviados`;
});

await browser.close();
servidor.kill();

const md = [
  "## Etapa 4 · prova do front em navegador (coletor interceptado)",
  "",
  `Build: --mode e2e, release ${RELEASE}, VITE_ERROR_REPORT_URL=${COLETOR} (interceptado no navegador). Chromium ${browser.version?.() ?? ""}`.trim(),
  "",
  "| Prova | Resultado | Detalhe |",
  "| --- | --- | --- |",
  ...resultados.map((r) => `| ${r.id} ${r.titulo} | ${r.ok ? "passou" : "**FALHOU**"} | ${String(r.detalhe).replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\n/g, " ")} |`),
].join("\n");
writeFileSync(resolve(SAIDA, "relatorio.md"), md + "\n");
console.log("\n" + md);
process.exit(resultados.every((r) => r.ok) ? 0 : 1);
