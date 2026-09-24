// ============================================================
// Pack de capturas v2 (Bloco 5, P01 a P07) — runner
// ------------------------------------------------------------
// Roda no GitHub Actions (.github/workflows/captura-pack-v2.yml): o
// build do commit atual servido em 127.0.0.1:4173, apontando para o
// projeto de DEMONSTRAÇÃO, e três logins pela própria tela (e-mail ou
// código + senha) com os segredos do repositório. Não usa função de
// Edge nem service role: a captura de 19/09 dependia da
// capture-oidc-20260919, que a Etapa 2 manda remover.
//
// Nada é escrito no banco pelo navegador: toda requisição que não é
// leitura é bloqueada (lista no arquivo interno). A única exceção é a
// tela 21, em que a resposta de provisionar-aluno é SIMULADA no
// navegador, com código e senha mascarados: clicar em "Gerar
// credencial" de verdade daria credencial ao Enzo e desmancharia o D01.
//
// Saída (CAPTURA_SAIDA, padrão .captura/):
//   pack-triliva-v2-AAAA-MM-DD/   → pack comercial (sem id do projeto)
//   interno-AAAA-MM-DD/           → id do projeto, commit, bloqueios,
//                                   avisos, tela 18 (se pedida)
// Uso: node scripts/captura/pack-v2.mjs (a partir da raiz do repo)
// ============================================================
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as L from "./pack-v2-lib.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const APP = path.join(RAIZ, "app");
// Em ESM o import nu resolve pelo diretório do módulo; as dependências
// moram em app/node_modules.
const requireApp = createRequire(path.join(APP, "package.json"));
const { chromium } = requireApp("@playwright/test");
const { createClient } = requireApp("@supabase/supabase-js");
const { PNG } = requireApp(path.join(path.dirname(requireApp.resolve("playwright-core/package.json")), "lib/utilsBundle.js"));

const env = process.env;
// ensaio: qualquer dia, sai com sufixo "-ensaio"; oficial: só na janela
// de sábado (aborta fora dela); auto (push na branch): oficial se estiver
// na janela, ensaio fora dela.
const MODO = ["ensaio", "oficial", "auto"].includes(env.CAPTURA_MODO) ? env.CAPTURA_MODO : "ensaio";
const COM_TELA_18 = env.CAPTURA_TELA_18 === "true";
const BASE = env.CAPTURA_BASE_URL ?? "http://127.0.0.1:4173";
const SAIDA = path.resolve(env.CAPTURA_SAIDA ?? path.join(RAIZ, ".captura"));
const AGORA = new Date();
const janela = L.janelaOficial(AGORA);
const OFICIAL = MODO === "oficial" || (MODO === "auto" && janela.ok);
const DATA = L.dataLocal(AGORA);
const PACK = L.nomeDoPack(DATA) + (OFICIAL ? "" : "-ensaio");
const DIR_PACK = path.join(SAIDA, PACK);
const DIR_INTERNO = path.join(SAIDA, `interno-${DATA}${OFICIAL ? "" : "-ensaio"}`);

// ── pré-condições ─────────────────────────────────────────────
const faltando = L.SEGREDOS.filter((n) => !env[n]);
if (faltando.length) {
  const msg = `segredos ausentes no repositório: ${faltando.join(", ")}`;
  if (MODO === "oficial") { console.error(`ERRO: ${msg}`); process.exit(2); }
  console.log(`::warning::${msg} — ensaio pulado, nada capturado.`);
  process.exit(0);
}
if (OFICIAL && !janela.ok) {
  console.error(`ERRO: captura oficial fora da janela (${janela.motivo}). Use a captura de ensaio.`);
  process.exit(3);
}
const envTexto = await fs.readFile(path.join(APP, ".env.production"), "utf8");
const SUPA_URL = envTexto.match(/^VITE_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
const ANON = envTexto.match(/^VITE_SUPABASE_ANON_KEY=(.+)$/m)?.[1]?.trim();
if (!SUPA_URL?.includes(L.PROJETO_DEMO) || !ANON) {
  console.error("ERRO: app/.env.production não aponta para o projeto de demonstração — nada capturado.");
  process.exit(4);
}
const VALORES_SECRETOS = L.SEGREDOS.map((n) => env[n]);
// Toda mensagem que sai (log, arquivo interno) passa por aqui: um alerta
// da tela de login pode repetir o código digitado.
const redigir = (t) => VALORES_SECRETOS.reduce((acc, v) => (v && v.length >= 4 ? acc.split(v).join("•••") : acc), String(t));
const CODIGOS = [env.TRILIVA_CAPTURA_ALUNO_CODIGO, env.TRILIVA_CAPTURA_RESP_CODIGO];

const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, isMobile: false, hasTouch: false },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  mobile360: { viewport: { width: 360, height: 800 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};
// RPCs que só leem (as únicas chamadas por POST que o app faz lendo).
const RPCS_DE_LEITURA = new Set(["resumo_escola", "sou_super_admin"]);

const manifesto = [];
const naoIncluidas = [];
const falhas = [];
const avisos = [];
const bloqueadas = [];
const textos = {};
const checks360 = [];

await Promise.all(["00-publico", "01-aluno", "02-coordenacao", "03-responsavel", "04-estados"]
  .map((d) => fs.mkdir(path.join(DIR_PACK, d), { recursive: true })));
await fs.mkdir(path.join(DIR_INTERNO, "02-coordenacao"), { recursive: true });

const browser = await chromium.launch({
  executablePath: env.CHROME_PATH || undefined, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

// ── guarda de escrita ─────────────────────────────────────────
async function contexto(device, estado = null, { credencialSimulada = false } = {}) {
  const c = await browser.newContext({
    ...DEVICES[device], locale: "pt-BR", timezoneId: "America/Sao_Paulo", storageState: estado ?? undefined,
  });
  await c.route("**/*", async (route) => {
    const req = route.request();
    const metodo = req.method();
    if (["GET", "HEAD", "OPTIONS"].includes(metodo)) return route.continue();
    const url = new URL(req.url());
    if (url.origin === new URL(BASE).origin) return route.continue();
    if (url.pathname.startsWith("/auth/v1/")) return route.continue(); // login e renovação do token
    if (url.pathname.startsWith("/rest/v1/rpc/") && RPCS_DE_LEITURA.has(url.pathname.split("/").pop())) return route.continue();
    if (credencialSimulada && url.pathname === "/functions/v1/provisionar-aluno") {
      const corpo = req.postDataJSON?.() ?? {};
      if (corpo.tipo === "aluno") {
        bloqueadas.push({ metodo, caminho: url.pathname, destino: "simulada (tela 21)" });
        return route.fulfill({
          status: 200,
          headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
          body: JSON.stringify({ codigo: "ENZO••••", senhaTemporaria: "••••••••", papel: "aluno", nome: "Enzo Bandeira", estado: "aluno_criado" }),
        });
      }
    }
    bloqueadas.push({ metodo, caminho: url.pathname, destino: "bloqueada" });
    return route.abort("blockedbyclient");
  });
  return c;
}

// ── espera, segurança, abas ───────────────────────────────────
async function assentar(page, marcador = null) {
  if (marcador) await marcador.waitFor({ state: "visible", timeout: 20000 }).catch(() => {});
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  for (let i = 0; i < 20; i++) {
    const ocupado = await page.locator('[aria-busy="true"], [data-carregando="true"], .skel').filter({ visible: true }).count().catch(() => 0);
    if (!ocupado) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(800);
}

async function conferirSeguranca(page) {
  const texto = await page.locator("body").innerText();
  if (L.TENANTS_PROIBIDOS.test(texto)) throw new Error("texto de outro tenant visível");
  const senhas = await page.locator("input[type=password]").evaluateAll((es) => es.map((e) => e.value));
  if (senhas.some(Boolean)) throw new Error("campo de senha preenchido visível");
  const minusculo = texto.toLowerCase();
  if (CODIGOS.some((c) => c && minusculo.includes(c.toLowerCase()))) throw new Error("código de acesso visível na tela");
  return texto;
}

const botaoVisivel = (page, nome) => page.getByRole("button", { name: nome, exact: true }).filter({ visible: true }).first();
async function aba(page, nome) {
  const direto = botaoVisivel(page, nome), mais = botaoVisivel(page, "Mais");
  await direto.or(mais).first().waitFor({ state: "visible", timeout: 15000 });
  if (await direto.count()) await direto.click();
  else { await mais.click(); await botaoVisivel(page, nome).click(); }
  await assentar(page);
}

// A linha da lista de alunos: a div mais interna que tem o nome E o
// botão "Ver desempenho" (o runner de 19/09 clicava no primeiro da lista).
function linhaDoAluno(page, nome) {
  return page.locator("div")
    .filter({ has: page.getByText(nome, { exact: true }) })
    .filter({ has: page.getByRole("button", { name: "Ver desempenho" }) })
    .last();
}

// ── login pela tela ───────────────────────────────────────────
const MARCADOR = {
  aluno: (p) => botaoVisivel(p, "Hoje"),
  responsavel: (p) => p.getByRole("button", { name: "Sair" }).first(),
  coordenacao: (p) => p.getByText("Painel de gestão").first(),
};
async function entrar(perfil) {
  const c = await contexto("desktop");
  const p = await c.newPage();
  try {
    await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
    await p.getByRole("button", { name: /^Entrar/ }).waitFor({ timeout: 30000 });
    if (perfil === "coordenacao") {
      await p.getByRole("button", { name: /^Coordenação/ }).click();
      await p.getByLabel("E-mail", { exact: true }).fill(env.TRILIVA_CAPTURA_COORD_EMAIL);
      await p.getByLabel("Senha", { exact: true }).fill(env.TRILIVA_CAPTURA_COORD_SENHA);
    } else {
      await p.getByRole("button", { name: /^Aluno/ }).click();
      const aluno = perfil === "aluno";
      await p.getByLabel("Código de acesso", { exact: true }).fill(aluno ? env.TRILIVA_CAPTURA_ALUNO_CODIGO : env.TRILIVA_CAPTURA_RESP_CODIGO);
      await p.getByLabel("Senha", { exact: true }).fill(aluno ? env.TRILIVA_CAPTURA_ALUNO_SENHA : env.TRILIVA_CAPTURA_RESP_SENHA);
    }
    await p.getByRole("button", { name: /^Entrar/ }).click();
    const trocaSenha = p.getByText(/Escolha sua senha/i).first();
    await MARCADOR[perfil](p).or(trocaSenha).waitFor({ state: "visible", timeout: 30000 });
    if (await trocaSenha.isVisible().catch(() => false)) {
      throw new Error(`a conta de ${perfil} pede troca de senha: faça o primeiro acesso à mão e cadastre a senha definitiva no segredo`);
    }
    await assentar(p);
    await conferirSeguranca(p);
    return await c.storageState(); // só em memória: nunca com { path }
  } catch (e) {
    const alerta = await p.locator('[role="alert"]').first().innerText().catch(() => "");
    throw new Error(redigir(`login de ${perfil} falhou: ${String(e.message ?? e).split("\n")[0]}${alerta ? ` (tela: ${alerta.slice(0, 120)})` : ""}`));
  } finally {
    await c.close();
  }
}

// ── captura integral, dobra e recorte ─────────────────────────
async function retangulos(page, ancora) {
  const alvo = ancora.first();
  await alvo.waitFor({ state: "visible", timeout: 15000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  return alvo.evaluate((el) => {
    const temCaixa = (n) => {
      const cs = getComputedStyle(n);
      return parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== "none" || cs.backgroundColor !== "rgba(0, 0, 0, 0)";
    };
    const vw = document.documentElement.clientWidth;
    // sobe até o componente: a primeira caixa larga o bastante
    let comp = el;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const r = n.getBoundingClientRect();
      if (n.getAttribute("role") === "dialog" || (r.width >= Math.min(300, vw - 32) && r.height >= 90 && r.height <= 2400 && temCaixa(n))) { comp = n; break; }
    }
    const doc = (r) => ({ x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height });
    // vizinhos que não podem sair cortados: caixas (borda, sombra ou
    // fundo) e também TEXTO solto (uma linha cortada ao meio é o P03)
    const temTextoProprio = (n) => [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
    const componentes = [];
    for (const n of document.body.querySelectorAll("*")) {
      if (n === comp || n.contains(comp) || comp.contains(n)) continue;
      const r = n.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const caixa = temCaixa(n) && r.width >= 40 && r.height >= 24;
      if (!caixa && !temTextoProprio(n) && !["IMG", "SVG", "svg", "CANVAS", "INPUT", "BUTTON"].includes(n.tagName)) continue;
      const cs = getComputedStyle(n);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
      componentes.push(doc(r));
      if (componentes.length > 5000) break;
    }
    // rolagem interna: a "página inteira" não mostraria o que está dentro
    const internas = [...document.body.querySelectorAll("*")].filter((n) => {
      const cs = getComputedStyle(n);
      return /(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 4 && n.clientHeight > 200;
    }).length;
    return {
      alvo: doc(comp.getBoundingClientRect()), componentes,
      pagina: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      rolagemInterna: internas,
    };
  });
}

async function capturar({ page, def, device, comercial = true, notaExtra = "" }) {
  const texto = await conferirSeguranca(page);
  const dir = path.join(comercial ? DIR_PACK : DIR_INTERNO, def.pasta);
  const raiz = comercial ? DIR_PACK : DIR_INTERNO;
  const dpr = DEVICES[device].deviceScaleFactor;
  const geo = await retangulos(page, def.ancora(page));
  const arquivo = path.join(dir, `${def.base}-${device}.png`);
  const integral = await page.screenshot({ path: arquivo, fullPage: true, animations: "disabled" });
  let dobra = null;
  if (device === "mobile" && !def.semDobra) {
    dobra = path.join(dir, `${def.base}-${device}-dobra.png`);
    await page.screenshot({ path: dobra, fullPage: false, animations: "disabled" });
  }
  // P03: o recorte sai da imagem integral, não de outra captura
  const png = PNG.sync.read(integral);
  const { rect, margens, aviso } = L.retanguloDeRecorte({ alvo: geo.alvo, componentes: geo.componentes, pagina: geo.pagina });
  const px = L.paraPixels(rect, dpr, png);
  const corte = new PNG({ width: px.width, height: px.height });
  PNG.bitblt(png, corte, px.x, px.y, px.width, px.height, 0, 0);
  const recorte = path.join(dir, `${def.base}-${device}-recorte.png`);
  await fs.writeFile(recorte, PNG.sync.write(corte));
  if (aviso) avisos.push({ tela: def.tela, device, aviso, margens });
  if (geo.rolagemInterna) avisos.push({ tela: def.tela, device, aviso: "rolagem_interna", detalhe: "a página inteira pode não mostrar o conteúdo de um contêiner com rolagem própria" });
  textos[`${String(def.tela).padStart(2, "0")} ${device}`] = texto;
  manifesto.push({
    tela: def.tela, nome: def.nome, papel: def.papel, device,
    viewport: `${page.viewportSize().width}x${page.viewportSize().height}`, dpr,
    arquivo: path.relative(raiz, arquivo), dobra: dobra && path.relative(raiz, dobra), recorte: path.relative(raiz, recorte),
    margensRecorte: margens, escola: L.ESCOLA_DEMO, aluno: def.aluno ?? "",
    nota: [def.nota, notaExtra].filter(Boolean).join(" "),
    comercial,
  });
}

async function abrir(device, estado, marcador, opcoes) {
  const c = await contexto(device, estado, opcoes);
  const p = await c.newPage();
  await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
  await assentar(p, marcador?.(p));
  return { c, p };
}

async function seguro(rotulo, fn) {
  try { await fn(); console.log(`OK   ${rotulo}`); }
  catch (e) { const erro = redigir(String(e.message ?? e).split("\n")[0]).slice(0, 300); falhas.push({ rotulo, erro }); console.log(`FALTA ${rotulo}: ${erro}`); }
}

// ── as telas (lista de 19/09, com P02, P06 e a 06 refeita) ─────
const porTexto = (t) => (p) => p.getByText(t).filter({ visible: true }).first();
const TELAS = [
  { tela: 1, base: "01-portal", nome: "Portal", pasta: "00-publico", papel: "publico", devices: ["desktop", "mobile"],
    ancora: (p) => p.getByRole("button", { name: /^Entrar/ }), nota: "Portal público; campos vazios." },
  { tela: 2, base: "02-login-coordenacao", nome: "Login da coordenação", pasta: "00-publico", papel: "publico", devices: ["desktop", "mobile"],
    antes: (p) => p.getByRole("button", { name: /^Coordenação/ }).click(), ancora: (p) => p.getByLabel("E-mail", { exact: true }), nota: "Sem credenciais preenchidas." },
  { tela: 3, base: "03-recuperacao-acesso", nome: "Recuperação de acesso", pasta: "04-estados", papel: "publico", devices: ["mobile"],
    antes: (p) => p.getByText(/Esqueci meu código de acesso/i).filter({ visible: true }).first().click(), ancora: porTexto("Como recuperar"), nota: "Orienta procurar a coordenação; nenhum código exposto." },
  { tela: 5, base: "05-hoje", nome: "Hoje", pasta: "01-aluno", papel: "aluno", aba: "Hoje", devices: ["mobile", "desktop"], aluno: L.ALUNA_REFERENCIA,
    ancora: porTexto(/Meta da semana|Missão atual/i), nota: "Semana corrente (semana 4 em repetição)." },
  { tela: 6, base: "06-trilha", nome: "Trilha", pasta: "01-aluno", papel: "aluno", aba: "Trilha", devices: ["desktop", "mobile"], aluno: L.ALUNA_REFERENCIA,
    ancora: porTexto(/Geometria pesada|Semana 4/i), nota: "Refeita no v2." },
  { tela: 7, base: "07-registrar", nome: "Registrar", pasta: "01-aluno", papel: "aluno", aba: "Registrar", devices: ["mobile"], aluno: L.ALUNA_REFERENCIA,
    ancora: porTexto(/Questões/i), nota: "Formulário sem envio." },
  { tela: 8, base: "08-desempenho", nome: "Desempenho", pasta: "01-aluno", papel: "aluno", aba: "Desempenho", devices: ["desktop", "mobile"], aluno: L.ALUNA_REFERENCIA,
    ancora: porTexto(/por matéria|Desempenho/i) },
  { tela: 9, base: "09-simulados", nome: "Simulados", pasta: "01-aluno", papel: "aluno", aba: "Simulados", devices: ["desktop", "mobile"], aluno: L.ALUNA_REFERENCIA,
    ancora: porTexto(/Simulados/i), nota: "P04: datas em pt-BR." },
  { tela: 10, base: "10-conquistas", nome: "Conquistas", pasta: "01-aluno", papel: "aluno", aba: "Conquistas", devices: ["mobile"], aluno: L.ALUNA_REFERENCIA,
    ancora: porTexto(/Patente|XP/i) },
  { tela: 11, base: "11-historico", nome: "Histórico", pasta: "01-aluno", papel: "aluno", aba: "Histórico", devices: ["desktop", "mobile"], aluno: L.ALUNA_REFERENCIA,
    ancora: porTexto(/Histórico|Acumulado/i) },
  { tela: 12, base: "12-plano", nome: "Plano", pasta: "01-aluno", papel: "aluno", aba: "Plano", devices: ["desktop", "mobile"], aluno: L.ALUNA_REFERENCIA,
    ancora: porTexto(/Semana 4|Sua jornada|Plano/i) },
  { tela: 13, base: "13-responsavel", nome: "Responsável", pasta: "03-responsavel", papel: "responsavel", devices: ["mobile", "desktop"], aluno: L.ALUNA_REFERENCIA,
    ancora: porTexto(/Resumo|acerto|semana/i), nota: "Mesma aluna da área do aluno e da ficha." },
  { tela: 14, base: "14-painel", nome: "Painel de gestão", pasta: "02-coordenacao", papel: "coordenacao", aba: "Painel", devices: ["desktop", "mobile"],
    ancora: porTexto("Alertas de risco") },
  { tela: 15, base: "15-alunos", nome: "Alunos", pasta: "02-coordenacao", papel: "coordenacao", aba: "Alunos", devices: ["desktop", "mobile"],
    ancora: porTexto("Alunos da escola") },
  { tela: 16, base: "16-ranking", nome: "Ranking", pasta: "02-coordenacao", papel: "coordenacao", aba: "Ranking", devices: ["desktop"],
    ancora: porTexto(/Ranking —/), nota: "Critério e janela visíveis." },
  { tela: 17, base: "17-turmas", nome: "Turmas", pasta: "02-coordenacao", papel: "coordenacao", aba: "Turmas", devices: ["desktop", "mobile"],
    ancora: porTexto("Visão rápida do desempenho de cada turma") },
  { tela: 18, base: "18-lgpd", nome: "LGPD", pasta: "02-coordenacao", papel: "coordenacao", aba: "LGPD", devices: ["desktop"], interna: true,
    ancora: porTexto("Para que serve esta área"), nota: "Só na pasta interna: fora do material comercial até o D02." },
  { tela: 19, base: "19-marca", nome: "Marca", pasta: "02-coordenacao", papel: "coordenacao", aba: "Marca", devices: ["desktop", "mobile"],
    ancora: porTexto("Marca da escola"), nota: "Sem salvar alteração." },
  { tela: 20, base: "20-ficha", nome: "Ficha do aluno", pasta: "02-coordenacao", papel: "coordenacao", devices: ["desktop", "mobile"], aluno: L.ALUNA_REFERENCIA,
    antes: async (p) => {
      await aba(p, "Alunos");
      await linhaDoAluno(p, L.ALUNA_REFERENCIA).getByRole("button", { name: "Ver desempenho" }).click();
      await assentar(p, p.getByRole("button", { name: /voltar ao painel/i }));
    },
    ancora: porTexto(/Atividades da semana/i) },
  { tela: 21, base: "21-credencial", nome: "Gerar credencial", pasta: "02-coordenacao", papel: "coordenacao", devices: ["desktop", "mobile"], aluno: "Enzo Bandeira",
    credencialSimulada: true, semDobra: true,
    antes: async (p) => {
      await aba(p, "Alunos");
      const botao = linhaDoAluno(p, "Enzo Bandeira").getByRole("button", { name: "Gerar credencial" });
      if (!(await botao.count())) throw new Error("o Enzo não mostra 'Gerar credencial' (já tem credencial?)");
      await botao.click();
      await porTexto("Credencial de aluno")(p).waitFor({ timeout: 15000 });
    },
    ancora: porTexto("Credencial de aluno"),
    nota: "P02: modal real; a resposta de provisionar-aluno foi simulada no navegador (nenhuma credencial criada) e código e senha estão mascarados." },
  { tela: 22, base: "22-vinculos-responsaveis", nome: "Responsáveis da aluna", pasta: "02-coordenacao", papel: "coordenacao", devices: ["desktop", "mobile"], aluno: L.ALUNA_REFERENCIA,
    semDobra: true,
    antes: async (p, device) => {
      await aba(p, "Alunos");
      await linhaDoAluno(p, L.ALUNA_REFERENCIA).getByRole("button", { name: "Mais ações" }).click();
      await p.getByText(/Gerenciar responsáveis/i).filter({ visible: true }).first().click();
      const dialogo = p.getByRole("dialog").first();
      await dialogo.waitFor({ timeout: 15000 });
      await assentar(p);
      // P06: modal inteiro. Com rolagem interna, a janela cresce até caber.
      const alto = await dialogo.evaluate((d) => d.scrollHeight);
      const vp = DEVICES[device].viewport;
      if (alto + 36 > vp.height) {
        await p.setViewportSize({ width: vp.width, height: alto + 60 });
        await assentar(p);
        return `P06: janela ampliada para ${vp.width}x${alto + 60} para o modal caber inteiro.`;
      }
      return "P06: modal inteiro.";
    },
    ancora: (p) => p.getByRole("dialog") },
];

const NAO_RECAPTURADAS = [
  { tela: 4, nome: "Troca de senha obrigatória", motivo: "estado especial: exige preparar a conta da Helena, e a semana repetida está no ar; a de 19/09 segue válida (nenhuma correção dos Blocos 1 a 4 muda esta tela)." },
  { tela: 24, nome: "Onboarding", motivo: "estado especial: exige preparar a conta; o Bloco 4 mudou o exemplo do objetivo (D12), então a de 19/09 não deve ser usada. Recaptura depende de decisão (ver relatório)." },
  { tela: 25, nome: "Trilha não configurada", motivo: "estado especial: exige tirar a trilha da Helena, o que pararia a semana repetida; a de 19/09 segue válida." },
];

// ── execução ──────────────────────────────────────────────────
let estados = {};
await seguro("login aluno", async () => { estados.aluno = await entrar("aluno"); });
await seguro("login responsável", async () => { estados.responsavel = await entrar("responsavel"); });
await seguro("login coordenação", async () => { estados.coordenacao = await entrar("coordenacao"); });

for (const def of TELAS) {
  if (def.interna && !COM_TELA_18) { naoIncluidas.push({ tela: def.tela, nome: def.nome, motivo: "não pedida nesta execução (fora do material comercial até o D02)" }); continue; }
  for (const device of def.devices) {
    await seguro(`${String(def.tela).padStart(2, "0")} ${device}`, async () => {
      if (def.papel !== "publico" && !estados[def.papel]) throw new Error(`sem sessão de ${def.papel}`);
      const estado = def.papel === "publico" ? null : estados[def.papel];
      const { c, p } = await abrir(device, estado, def.papel === "publico" ? (pg) => pg.getByRole("button", { name: /^Entrar/ }) : MARCADOR[def.papel], { credencialSimulada: !!def.credencialSimulada });
      try {
        if (def.aba) await aba(p, def.aba);
        const notaExtra = def.antes ? await def.antes(p, device) : "";
        await assentar(p);
        await capturar({ page: p, def, device, comercial: !def.interna, notaExtra: typeof notaExtra === "string" ? notaExtra : "" });
      } finally { await c.close(); }
    });
  }
}

// 360 px: só evidência de que não há rolagem lateral (vai para o interno)
for (const [tela, perfil, nomeAba] of [[5, "aluno", "Hoje"], [7, "aluno", "Registrar"], [13, "responsavel", null]]) {
  await seguro(`360 ${tela}`, async () => {
    if (!estados[perfil]) throw new Error(`sem sessão de ${perfil}`);
    const { c, p } = await abrir("mobile360", estados[perfil], MARCADOR[perfil]);
    try {
      if (nomeAba) await aba(p, nomeAba);
      const d = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      checks360.push({ tela, ...d, ok: d.sw <= d.cw + 1 });
    } finally { await c.close(); }
  });
}
await browser.close();

// ── conferência contra o banco (P05) ──────────────────────────
let esperado = null;
await seguro("dados para a conferência", async () => {
  const sb = createClient(SUPA_URL, ANON, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { error: eLogin } = await sb.auth.signInWithPassword({ email: env.TRILIVA_CAPTURA_COORD_EMAIL, password: env.TRILIVA_CAPTURA_COORD_SENHA });
  if (eLogin) throw new Error(`login da conferência: ${eLogin.message}`);
  const [r, a, x] = await Promise.all([
    sb.rpc("resumo_escola"),
    sb.from("alunos").select("id,nome,usuario_id,alunos_turmas(turma_id,turmas(nome))"),
    sb.from("vw_aluno_xp_total").select("aluno_id,xp_total"),
  ]);
  for (const q of [r, a, x]) if (q.error) throw new Error(q.error.message);
  const xpPorAluno = {};
  for (const l of x.data) xpPorAluno[l.aluno_id] = (xpPorAluno[l.aluno_id] ?? 0) + Number(l.xp_total);
  esperado = L.esperadoDaEscola({ linhas: r.data, alunos: a.data, xpPorAluno });
  // sem signOut: o padrão dele é global e derrubaria outras sessões da conta
});

// ── arquivos do pack ──────────────────────────────────────────
const commit = (() => { try { return execFileSync("git", ["rev-parse", "HEAD"], { cwd: RAIZ }).toString().trim(); } catch { return env.GITHUB_SHA ?? "desconhecido"; } })();
const existe = async (p) => fs.access(path.join(RAIZ, p)).then(() => true, () => false);
const blocos = {
  "Bloco 1 · semana 4 em repetição (dados, só demonstração)": await existe("supabase/demo/04_funcoes.sql"),
  "Bloco 2 · LGPD e coerência": await existe("app/src/modules/consentimento/conformidade.js"),
  "Bloco 3 · números do painel": await existe("app/src/modules/desempenho/ranking.js"),
  "Bloco 4 · acabamento": await existe("app/src/modules/escola/proximoCiclo.js") && (await fs.readFile(path.join(APP, "src/shared/ui/tema.js"), "utf8")).includes("body { font-family"),
};

const comerciais = manifesto.filter((m) => m.comercial);
// Toda tela ou aparelho da lista que não saiu entra como NÃO INCLUÍDA.
function faltantes() {
  const out = [];
  for (const def of TELAS.filter((d) => !d.interna)) {
    const sem = def.devices.filter((d) => !comerciais.some((m) => m.tela === def.tela && m.device === d));
    if (!sem.length) continue;
    const todos = sem.length === def.devices.length;
    out.push({ tela: def.tela, nome: def.nome, motivo: `NÃO INCLUÍDA${todos ? "" : ` em ${sem.join(", ")}`}: a captura falhou nesta execução (motivo no arquivo interno).` });
  }
  return out;
}
const telasCapturadas = [...new Set(comerciais.map((m) => m.tela))].sort((a, b) => a - b);
const captura = {
  pack: PACK, oficial: OFICIAL, capturadoEm: AGORA.toISOString(), dataLocal: DATA, fusoHorario: "America/Sao_Paulo", idioma: "pt-BR",
  escola: L.ESCOLA_DEMO, telas: telasCapturadas, arquivos: comerciais.map(({ comercial, ...m }) => m),
  naoIncluidas: [...NAO_RECAPTURADAS, ...naoIncluidas, ...faltantes()],
};

const linhaTela = (m) => `| ${String(m.tela).padStart(2, "0")} | ${m.nome} | ${m.device} | ${m.viewport} @${m.dpr}x | \`${m.arquivo}\`${m.dobra ? ` · \`${m.dobra}\`` : ""} · \`${m.recorte}\` | ${m.nota || "·"} |`;
const MANIFESTO = [
  `# ${PACK}`, "",
  `Capturado em ${DATA} (America/Sao_Paulo), ${OFICIAL ? "captura oficial" : "**ENSAIO, não usar em material**"}. Escola: ${L.ESCOLA_DEMO} (fictícia).`,
  "Navegador: Chromium, pt-BR, America/Sao_Paulo. Celular 390 px @3x; desktop 1440 px @2x.",
  "Cada tela tem a captura integral (página inteira); no celular também a primeira dobra. O recorte sai da integral, com 24 px de margem, sem cortar componente.", "",
  "| Tela | Nome | Aparelho | Janela | Arquivos | Nota |", "|---|---|---|---|---|---|",
  ...comerciais.map(linhaTela), "",
  "## Não incluídas", "",
  ...captura.naoIncluidas.map((n) => `- **${String(n.tela).padStart(2, "0")} ${n.nome}**: ${n.motivo}`), "",
].join("\n");

const CHANGELOG = [
  `# CHANGELOG · ${PACK}`, "", "Em relação ao pack de 19/09/2026:", "",
  "- **P01** Versão no nome (`pack-triliva-v2-AAAA-MM-DD`). O sufixo `_1_1` do pack anterior era duplicata de download, não versão.",
  "- **P02** Tela 21 refeita com o modal \"Gerar credencial\" (a de 19/09 era cópia da 15). Código e senha mascarados; a resposta foi simulada no navegador, nenhuma credencial foi criada.",
  "- **P03** Recortes tirados da captura integral, com 24 px de margem e sem componente cortado ao meio.",
  "- **P04** Navegador em pt-BR e America/Sao_Paulo (a data do simulado saía 09/19/2026).",
  "- **P05** `COERENCIA-HELENA.md` reconcilia também os agregados da turma: Painel, Turmas e Ranking.",
  "- **P06** Tela 22 com o modal inteiro.",
  "- **P07** O identificador do projeto saiu do `CAPTURA.json` e do `MANIFESTO.md`; fica só no arquivo interno.",
  "- Tela 06 (Trilha) refeita, celular e desktop. Hoje, Ficha e Responsável em página inteira no celular.",
  "- Tela 18 (LGPD) fora do pack comercial até a validação jurídica do D02.", "",
  "## Correções de produto presentes neste build", "",
  ...Object.entries(blocos).map(([b, ok]) => `- ${ok ? "sim" : "**não**"} · ${b}`), "",
].join("\n");

let COERENCIA = `# COERENCIA-HELENA · ${PACK}\n\nA conferência não pôde ser feita: ${falhas.find((f) => f.rotulo === "dados para a conferência")?.erro ?? "sem dados"}.\n`;
if (esperado) {
  const telasHelena = Object.fromEntries(Object.entries(textos).filter(([k]) => /^(05|08|10|13|20) /.test(k)));
  const matriz = L.conferir(L.numerosDaReferencia(esperado), telasHelena);
  const cab = Object.keys(telasHelena);
  const turmaTexto = (n) => Object.entries(textos).filter(([k]) => k.startsWith(`${n} `)).map(([, t]) => t).join("\n");
  // um número de 1 ou 2 caracteres aparece em qualquer tela: só a imagem diz
  const aparece = (n, s) => (s.length < 3 ? "conferir na imagem" : turmaTexto(n).includes(s) ? "aparece" : "**não encontrado**");
  const p = esperado.painel;
  const h = esperado.porAluno.find((x) => x.nome === L.ALUNA_REFERENCIA);
  COERENCIA = [
    `# COERENCIA-HELENA · ${PACK}`, "",
    "Valores esperados calculados do banco (resumo_escola, alunos, XP) no momento da captura, de forma independente das telas.",
    "\"não encontrado\" quer dizer que a grafia não está no texto daquela tela: confira na imagem (a tela pode não mostrar o número).", "",
    `## Helena Vasconcelos${h ? ` · ${h.turmas.join(", ")}` : ""}`, "",
    "Acerto é **no ciclo** (D15); os outros números são da semana (7 dias).", "",
    `| Número | Valor | ${cab.join(" | ")} |`, `|---|---|${cab.map(() => "---").join("|")}|`,
    ...matriz.map((n) => `| ${n.numero} | ${n.valor} | ${cab.map((t) => (n.telas[t] ? "aparece" : "não encontrado")).join(" | ")} |`), "",
    "## Agregados da turma", "",
    "| Onde | Número | Janela | Valor esperado | Na tela (desktop) |", "|---|---|---|---|---|",
    `| Painel (14) | Ativos | 7 dias | ${p.ativos7d} | ${aparece(14, String(p.ativos7d))} |`,
    `| Painel (14) | Questões | 7 dias | ${fmtNum(p.questoes7d)} | ${aparece(14, fmtNum(p.questoes7d))} |`,
    `| Painel (14) | Acerto, ponderado (D04) | 7 dias | ${p.acerto7dPonderado ?? "—"}% | ${aparece(14, `${p.acerto7dPonderado}%`)} |`,
    `| Painel (14) | Sem atividade | 7 dias | ${p.semAtividade.length} (${p.semAtividade.join(", ") || "ninguém"}) | · |`,
    `| Painel (14) | Sem credencial | · | ${p.semCredencial.length} (${p.semCredencial.join(", ") || "ninguém"}) | · |`,
    ...esperado.turmas.flatMap((t) => [
      `| Turmas (17) · ${t.nome} | Alunos | · | ${t.alunos} | ${aparece(17, t.nome)} |`,
      `| Turmas (17) · ${t.nome} | Questões | ciclo | ${fmtNum(t.questoesCiclo)} | ${aparece(17, fmtNum(t.questoesCiclo))} |`,
      `| Turmas (17) · ${t.nome} | Acerto (média simples dos alunos) | ciclo | ${t.acertoCicloMediaSimples ?? "—"}% | ${aparece(17, `${t.acertoCicloMediaSimples}%`)} |`,
    ]),
    `| Painel (14) e Ranking (16) | Pódio "Melhor acerto (7d)" (D05) | 7 dias, piso de ${L.VOLUME_MINIMO} questões | ${esperado.podioAcerto7d.join(", ")} | Painel: ${esperado.podioAcerto7d.every((n) => turmaTexto(14).includes(n)) ? "aparece" : "**não encontrado**"} · Ranking: ${esperado.podioAcerto7d.every((n) => turmaTexto(16).includes(n)) ? "aparece" : "**não encontrado**"} |`,
    "",
    "Atenção: a tela Turmas mostra \"Acerto\" como média simples do acerto do ciclo de cada aluno, e \"Questões\" do ciclo; o Painel mostra acerto ponderado de 7 dias. São números diferentes por definição, não erro de captura.", "",
  ].join("\n");
}
function fmtNum(n) { return L.fmtMilhar(n); }

const INTERNO = {
  pack: PACK, projetoSupabase: L.PROJETO_DEMO, commit, run: env.GITHUB_RUN_ID ?? null,
  modo: MODO, janela: janela.motivo, oficial: OFICIAL, telaLgpd: COM_TELA_18,
  falhas, avisos, requisicoesNaoLeitura: bloqueadas, checks360,
  arquivosInternos: manifesto.filter((m) => !m.comercial),
};

await fs.writeFile(path.join(DIR_PACK, "MANIFESTO.md"), MANIFESTO);
await fs.writeFile(path.join(DIR_PACK, "CAPTURA.json"), JSON.stringify(captura, null, 2));
await fs.writeFile(path.join(DIR_PACK, "CHANGELOG.md"), CHANGELOG);
await fs.writeFile(path.join(DIR_PACK, "COERENCIA-HELENA.md"), COERENCIA);
await fs.writeFile(path.join(DIR_INTERNO, "CAPTURA-INTERNA.json"), JSON.stringify(INTERNO, null, 2));

// P07 e segredos: o pack comercial não pode levar id do projeto nem segredo
const textosDoPack = {};
for (const f of ["MANIFESTO.md", "CAPTURA.json", "CHANGELOG.md", "COERENCIA-HELENA.md"]) textosDoPack[f] = await fs.readFile(path.join(DIR_PACK, f), "utf8");
const violacoes = L.violacoesDoPackComercial(textosDoPack, { segredos: VALORES_SECRETOS });
const internoTexto = await fs.readFile(path.join(DIR_INTERNO, "CAPTURA-INTERNA.json"), "utf8");
const vazouNoInterno = L.violacoesDoPackComercial({ interno: internoTexto }, { projeto: null, segredos: VALORES_SECRETOS });

// SHA256SUMS de tudo o que está no pack
async function listar(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await listar(p)); else out.push(p);
  }
  return out;
}
const somas = [];
for (const f of (await listar(DIR_PACK)).sort()) {
  const h = crypto.createHash("sha256").update(await fs.readFile(f)).digest("hex");
  somas.push(`${h}  ${path.relative(DIR_PACK, f)}`);
}
await fs.writeFile(path.join(DIR_PACK, "SHA256SUMS.txt"), `${somas.join("\n")}\n`);

console.log(`CAPTURA_TELAS=${telasCapturadas.join(",")}`);
console.log(`CAPTURA_FALHAS=${falhas.length} CAPTURA_AVISOS=${avisos.length} REQUISICOES_NAO_LEITURA=${bloqueadas.length}`);
if (violacoes.length || vazouNoInterno.length) {
  console.error(`ERRO: o pack levaria dado proibido: ${JSON.stringify([...violacoes, ...vazouNoInterno].map((v) => `${v.arquivo}: ${v.motivo}`))}`);
  await fs.rm(DIR_PACK, { recursive: true, force: true });
  process.exit(5);
}
process.exit(falhas.length ? 1 : 0);
