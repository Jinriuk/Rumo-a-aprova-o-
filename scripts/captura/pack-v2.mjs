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
// No fim, encerra as sessões que ela mesma abriu (os três logins e o da
// conferência) com signOut scope "local": o login cria a sessão no Auth,
// o logout apaga só ela, e as outras sessões da conta ficam intactas.
//
// Saída (CAPTURA_SAIDA, padrão .captura/):
//   pack-triliva-v2-AAAA-MM-DD/   → pack comercial (sem id do projeto)
//   interno-AAAA-MM-DD/           → id do projeto, commit, bloqueios,
//                                   avisos, tela 18 (se pedida)
// Com CAPTURA_TELA=24 captura só a tela 24 e completa o pack que está em
// CAPTURA_BASE (o da execução principal do mesmo sábado): ver
// docs/pack/README.md, "Tela 24".
//
// Não grava trace, vídeo nem HAR do Playwright (o trace registraria o
// que é digitado no login) e recusa rodar com DEBUG/PWDEBUG do Playwright.
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
// de sábado depois das 18:00 de Brasília (aborta fora dela). O workflow
// só roda por workflow_dispatch, então não há modo automático.
const MODO = env.CAPTURA_MODO === "oficial" ? "oficial" : "ensaio";
const OFICIAL = MODO === "oficial";
const SO_TELA_24 = env.CAPTURA_TELA === "24";
const COM_TELA_18 = env.CAPTURA_TELA_18 === "true" && !SO_TELA_24;
const BASE = env.CAPTURA_BASE_URL ?? "http://127.0.0.1:4173";
const SAIDA = path.resolve(env.CAPTURA_SAIDA ?? path.join(RAIZ, ".captura"));
const AGORA = new Date();
const janela = L.janelaOficial(AGORA);
const DATA = L.dataLocal(AGORA);

// ── pré-condições ─────────────────────────────────────────────
// Com DEBUG=pw:* ou PWDEBUG o Playwright escreve no log o que é digitado.
if (/pw:/.test(env.DEBUG ?? "") || env.PWDEBUG) {
  console.error("ERRO: DEBUG/PWDEBUG do Playwright ligado registraria o que é digitado no login. Nada capturado.");
  process.exit(6);
}
const faltando = L.SEGREDOS.filter((n) => !env[n]);
if (faltando.length) {
  const msg = `segredos ausentes no repositório: ${faltando.join(", ")}`;
  if (OFICIAL) { console.error(`ERRO: ${msg}`); process.exit(2); }
  console.log(`::warning::${msg} — ensaio pulado, nada capturado.`);
  process.exit(0);
}
if (OFICIAL && !janela.ok) {
  console.error(`ERRO: captura oficial fora da janela (${janela.motivo}). Use a captura de ensaio.`);
  process.exit(3);
}
// Tela 24: completa o pack da execução principal (baixado em CAPTURA_BASE).
let packBase = null;
// O artefato baixado pode trazer o CAPTURA.json na raiz ou numa subpasta
// com o nome do pack, conforme o upload gravou; aceita os dois.
async function acharPackBase(dir) {
  if (!dir) return null;
  const tem = (d) => fs.access(path.join(d, "CAPTURA.json")).then(() => true, () => false);
  if (await tem(dir)) return dir;
  for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    if (e.isDirectory() && await tem(path.join(dir, e.name))) return path.join(dir, e.name);
  }
  return null;
}
if (SO_TELA_24) {
  const dirBase = await acharPackBase(env.CAPTURA_BASE ? path.resolve(env.CAPTURA_BASE) : null);
  packBase = dirBase && JSON.parse(await fs.readFile(path.join(dirBase, "CAPTURA.json"), "utf8").catch(() => "null"));
  if (!packBase) { console.error("ERRO: a tela 24 completa um pack; não achei o CAPTURA.json da execução principal em CAPTURA_BASE."); process.exit(7); }
  if (packBase.oficial !== OFICIAL) { console.error(`ERRO: o pack base é ${packBase.oficial ? "oficial" : "de ensaio"} e esta execução é ${MODO}.`); process.exit(7); }
  if (packBase.dataLocal !== DATA) { console.error(`ERRO: o pack base é de ${packBase.dataLocal}; a 24 completa o pack do mesmo dia (${DATA}).`); process.exit(7); }
  packBase.dir = dirBase;
}
const PACK = packBase ? packBase.pack : L.nomeDoPack(DATA) + (OFICIAL ? "" : "-ensaio");
const DIR_PACK = path.join(SAIDA, PACK);
const DIR_INTERNO = path.join(SAIDA, `interno-${DATA}${OFICIAL ? "" : "-ensaio"}${SO_TELA_24 ? "-tela24" : ""}`);
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

if (packBase && path.resolve(packBase.dir) !== DIR_PACK) await fs.rename(packBase.dir, DIR_PACK);
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
    const estado = await c.storageState(); // só em memória: nunca com { path }
    lembrarSessao(perfil, estado);
    return estado;
  } catch (e) {
    const alerta = await p.locator('[role="alert"]').first().innerText().catch(() => "");
    throw new Error(redigir(`login de ${perfil} falhou: ${String(e.message ?? e).split("\n")[0]}${alerta ? ` (tela: ${alerta.slice(0, 120)})` : ""}`));
  } finally {
    await c.close();
  }
}

// ── sessões abertas por esta execução ─────────────────────────
// Cada login abre uma sessão no Auth, e not_after é nulo no projeto:
// sem encerrar, ela fica lá para sempre. signOut() sem escopo é GLOBAL
// e derrubaria qualquer outra sessão da conta (quem estiver
// apresentando a vitrine), então o fim usa scope "local": o Auth apaga
// só a sessão cujo id está no token, a que esta execução abriu.
const sessoes = {}; // perfil → { access_token, refresh_token }, só em memória
const sessoesEncerradas = []; // vai para o arquivo interno, sem token

// Tokens entram na lista de valores que nunca podem sair em arquivo ou
// log: redigir() os troca por •••, e a conferência do fim derruba o pack.
function guardarTokens(s) {
  for (const t of [s?.access_token, s?.refresh_token]) if (t && !VALORES_SECRETOS.includes(t)) VALORES_SECRETOS.push(t);
}

function lembrarSessao(perfil, estado) {
  const s = L.sessaoDoEstado(estado, L.PROJETO_DEMO);
  if (!s) {
    avisos.push({ aviso: "sessao_nao_encontrada", detalhe: `o estado de ${perfil} não tem sessão do Auth; ela não será encerrada no fim` });
    return;
  }
  guardarTokens(s);
  sessoes[perfil] = s;
}

// Uma aba aberta com o estado pode renovar o token (o refresh token
// gira). Guardar o estado mais novo mantém válido o par usado no fim.
async function renovarEstado(perfil, c) {
  if (!perfil || perfil === "publico") return;
  const novo = await c.storageState().catch(() => null);
  if (novo && L.sessaoDoEstado(novo, L.PROJETO_DEMO)) {
    estados[perfil] = novo;
    lembrarSessao(perfil, novo);
  }
}

async function encerrarSessao(rotulo, sessao) {
  const sb = createClient(SUPA_URL, ANON, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  try {
    const { error: eSessao } = await sb.auth.setSession(sessao);
    if (eSessao) throw new Error(`a sessão já não vale (${eSessao.message})`);
    const { error } = await sb.auth.signOut({ scope: "local" });
    if (error) throw new Error(error.message);
    sessoesEncerradas.push({ perfil: rotulo, resultado: "encerrada (scope local)" });
  } catch (e) {
    const motivo = redigir(String(e.message ?? e).split("\n")[0]).slice(0, 200);
    sessoesEncerradas.push({ perfil: rotulo, resultado: `NÃO encerrada: ${motivo}` });
    console.log(`::warning::sessão de ${rotulo} não foi encerrada: ${motivo}`);
  }
}

// ── captura integral, dobra e recorte ─────────────────────────
async function retangulos(page, ancora) {
  const alvo = ancora.first();
  await alvo.waitFor({ state: "visible", timeout: 15000 });
  return alvo.evaluate(L.coletarGeometria);
}

async function capturar({ page, def, device, comercial = true, notaExtra = "" }) {
  const texto = await conferirSeguranca(page);
  const dir = path.join(comercial ? DIR_PACK : DIR_INTERNO, def.pasta);
  const raiz = comercial ? DIR_PACK : DIR_INTERNO;
  const dpr = DEVICES[device].deviceScaleFactor;
  const geo = await retangulos(page, def.ancora(page));
  const arquivo = path.join(dir, `${def.base}-${device}.png`);
  // modal: a integral é a janela (camada fixa); o resto, a página inteira
  const integral = await page.screenshot({ path: arquivo, fullPage: !geo.modal, animations: "disabled" });
  let dobra = null;
  if (device === "mobile" && !def.semDobra && !geo.modal) {
    dobra = path.join(dir, `${def.base}-${device}-dobra.png`);
    await page.screenshot({ path: dobra, fullPage: false, animations: "disabled" });
  }
  // P03: o recorte sai da imagem integral, não de outra captura
  const png = PNG.sync.read(integral);
  const { rect, margens, aviso, cortados } = L.retanguloDeRecorte({ alvo: geo.alvo, componentes: geo.componentes, pagina: geo.pagina });
  let recorte = null;
  if (rect) { // sem recorte válido, fica só a integral: nunca um recorte com componente cortado
    const px = L.paraPixels(rect, dpr, png);
    const corte = new PNG({ width: px.width, height: px.height });
    PNG.bitblt(png, corte, px.x, px.y, px.width, px.height, 0, 0);
    recorte = path.join(dir, `${def.base}-${device}-recorte.png`);
    await fs.writeFile(recorte, PNG.sync.write(corte));
  }
  if (aviso) avisos.push({ tela: def.tela, device, aviso, margens, ...(cortados ? { cortados } : {}) });
  if (geo.rolagemInterna) avisos.push({ tela: def.tela, device, aviso: "rolagem_interna", detalhe: "a página inteira pode não mostrar o conteúdo de um contêiner com rolagem própria" });
  textos[`${String(def.tela).padStart(2, "0")} ${device}`] = texto;
  manifesto.push({
    tela: def.tela, nome: def.nome, papel: def.papel, device,
    viewport: `${page.viewportSize().width}x${page.viewportSize().height}`, dpr,
    integral: geo.modal ? "janela (modal em camada fixa)" : "página inteira",
    arquivo: path.relative(raiz, arquivo), dobra: dobra && path.relative(raiz, dobra), recorte: recorte && path.relative(raiz, recorte),
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
  { tela: 24, nome: "Onboarding", motivo: "NÃO INCLUÍDA nesta execução: estado especial, capturado por último em execução própria, depois do critério de aceite, com preparo e restauração da Helena. Se esta linha estiver no pack final, a 24 não entrou." },
  { tela: 25, nome: "Trilha não configurada", motivo: "estado especial: exige tirar a trilha da Helena, o que pararia a semana repetida; a de 19/09 segue válida." },
];

// Tela 24: só na execução própria (CAPTURA_TELA=24), com a Helena preparada
// por supabase/demo/captura/tela24_preparar.sql (onboarding pendente).
const TELA_24 = {
  tela: 24, base: "24-onboarding", nome: "Onboarding", pasta: "04-estados", papel: "aluno", devices: ["mobile"], aluno: L.ALUNA_REFERENCIA,
  antes: async (p) => {
    const cartao = p.getByText(/^Bem-vind[oa], Helena/).first();
    await cartao.waitFor({ state: "visible", timeout: 15000 })
      .catch(() => { throw new Error("o onboarding da Helena não está pendente (o preparo da tela 24 rodou?)"); });
  },
  ancora: porTexto(/^Bem-vind[oa], Helena/),
  nota: "Estado preparado no tenant fictício só para esta captura (onboarding pendente) e restaurado em seguida; formulário sem envio.",
};

// ── execução ──────────────────────────────────────────────────
async function capturarDef(def) {
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
      } finally { await renovarEstado(def.papel, c); await c.close(); }
    });
  }
}

// 360 px: só evidência de que não há rolagem lateral (vai para o interno)
async function checar360(tela, perfil, nomeAba) {
  await seguro(`360 ${tela}`, async () => {
    if (!estados[perfil]) throw new Error(`sem sessão de ${perfil}`);
    const { c, p } = await abrir("mobile360", estados[perfil], MARCADOR[perfil]);
    try {
      if (nomeAba) await aba(p, nomeAba);
      const d = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      checks360.push({ tela, ...d, ok: d.sw <= d.cw + 1 });
    } finally { await renovarEstado(perfil, c); await c.close(); }
  });
}

let estados = {};
await seguro("login aluno", async () => { estados.aluno = await entrar("aluno"); });
if (SO_TELA_24) {
  await capturarDef(TELA_24);
  await checar360(24, "aluno", null);
} else {
  await seguro("login responsável", async () => { estados.responsavel = await entrar("responsavel"); });
  await seguro("login coordenação", async () => { estados.coordenacao = await entrar("coordenacao"); });
  for (const def of TELAS) {
    if (def.interna && !COM_TELA_18) { naoIncluidas.push({ tela: def.tela, nome: def.nome, motivo: "não pedida nesta execução (fora do material comercial até o D02)" }); continue; }
    await capturarDef(def);
  }
  for (const [tela, perfil, nomeAba] of [[5, "aluno", "Hoje"], [7, "aluno", "Registrar"], [13, "responsavel", null]]) {
    await checar360(tela, perfil, nomeAba);
  }
}
await browser.close();

// ── conferência contra o banco (P05) ──────────────────────────
let esperado = null;
if (!SO_TELA_24) await seguro("dados para a conferência", async () => {
  const sb = createClient(SUPA_URL, ANON, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data: login, error: eLogin } = await sb.auth.signInWithPassword({ email: env.TRILIVA_CAPTURA_COORD_EMAIL, password: env.TRILIVA_CAPTURA_COORD_SENHA });
  if (eLogin) throw new Error(`login da conferência: ${eLogin.message}`);
  guardarTokens(login.session);
  try {
    const [r, a, x] = await Promise.all([
      sb.rpc("resumo_escola"),
      sb.from("alunos").select("id,nome,usuario_id,alunos_turmas(turma_id,turmas(nome))"),
      sb.from("vw_aluno_xp_total").select("aluno_id,xp_total"),
    ]);
    for (const q of [r, a, x]) if (q.error) throw new Error(q.error.message);
    const xpPorAluno = {};
    for (const l of x.data) xpPorAluno[l.aluno_id] = (xpPorAluno[l.aluno_id] ?? 0) + Number(l.xp_total);
    esperado = L.esperadoDaEscola({ linhas: r.data, alunos: a.data, xpPorAluno });
  } finally {
    // também é uma sessão desta execução; scope "local" para não derrubar as outras da conta
    const { error } = await sb.auth.signOut({ scope: "local" });
    sessoesEncerradas.push({ perfil: "coordenacao (conferência)", resultado: error ? `NÃO encerrada: ${redigir(error.message).slice(0, 200)}` : "encerrada (scope local)" });
  }
});

for (const [perfil, s] of Object.entries(sessoes)) await encerrarSessao(perfil, s);

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
const semMarcaComercial = (lista) => lista.map(({ comercial, ...m }) => m);
let captura;
if (SO_TELA_24) {
  const { dir, ...base } = packBase;
  captura = L.juntarTela24(base, {
    arquivos: semMarcaComercial(comerciais),
    falha: falhas.map((f) => `${f.rotulo}: ${f.erro}`).join("; ") || null,
    run: env.GITHUB_RUN_ID ?? null, capturadoEm: AGORA.toISOString(),
  });
} else {
  captura = {
    pack: PACK, oficial: OFICIAL, capturadoEm: AGORA.toISOString(), dataLocal: DATA, fusoHorario: "America/Sao_Paulo", idioma: "pt-BR",
    escola: L.ESCOLA_DEMO, telas: [...new Set(comerciais.map((m) => m.tela))].sort((a, b) => a - b), arquivos: semMarcaComercial(comerciais),
    naoIncluidas: [...NAO_RECAPTURADAS, ...naoIncluidas, ...faltantes()],
  };
}
const telasCapturadas = captura.telas;
const MANIFESTO = L.montarManifesto(captura);

const CHANGELOG_24 = "- Tela 24 (Onboarding) refeita: capturada por último, em execução própria, depois do critério de aceite, com preparo e restauração da Helena (o D12 mudou o exemplo do objetivo).";
const CHANGELOG = SO_TELA_24 ? null : [
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

// no modo 24 a conferência é a da execução principal (a 24 não muda números)
let COERENCIA = SO_TELA_24 ? null : `# COERENCIA-HELENA · ${PACK}\n\nA conferência não pôde ser feita: ${falhas.find((f) => f.rotulo === "dados para a conferência")?.erro ?? "sem dados"}.\n`;
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
      `| Turmas (17) · ${t.nome} | Acerto médio no ciclo (média simples dos alunos) | ciclo | ${t.acertoCicloMediaSimples ?? "—"}% | ${aparece(17, `${t.acertoCicloMediaSimples}%`)} |`,
    ]),
    `| Painel (14) e Ranking (16) | Pódio "Melhor acerto (7d)" (D05) | 7 dias, piso de ${L.VOLUME_MINIMO} questões | ${esperado.podioAcerto7d.join(", ")} | Painel: ${esperado.podioAcerto7d.every((n) => turmaTexto(14).includes(n)) ? "aparece" : "**não encontrado**"} · Ranking: ${esperado.podioAcerto7d.every((n) => turmaTexto(16).includes(n)) ? "aparece" : "**não encontrado**"} |`,
    "",
    "Atenção: \"Acerto médio no ciclo\" (Turmas) é a média simples do acerto do ciclo de cada aluno, e \"Questões\" em Turmas é do ciclo; o Painel mostra acerto ponderado de 7 dias. São números diferentes por definição, não erro de captura.", "",
  ].join("\n");
}
function fmtNum(n) { return L.fmtMilhar(n); }

const INTERNO = {
  pack: PACK, projetoSupabase: L.PROJETO_DEMO, commit, run: env.GITHUB_RUN_ID ?? null,
  modo: MODO, somenteTela24: SO_TELA_24, janela: janela.motivo, oficial: OFICIAL, telaLgpd: COM_TELA_18,
  falhas, avisos, requisicoesNaoLeitura: bloqueadas, checks360, sessoesEncerradas,
  arquivosInternos: manifesto.filter((m) => !m.comercial),
};

await fs.writeFile(path.join(DIR_PACK, "MANIFESTO.md"), MANIFESTO);
await fs.writeFile(path.join(DIR_PACK, "CAPTURA.json"), JSON.stringify(captura, null, 2));
if (CHANGELOG) await fs.writeFile(path.join(DIR_PACK, "CHANGELOG.md"), CHANGELOG);
else if (comerciais.length) {
  const atual = await fs.readFile(path.join(DIR_PACK, "CHANGELOG.md"), "utf8");
  if (!atual.includes(CHANGELOG_24)) {
    await fs.writeFile(path.join(DIR_PACK, "CHANGELOG.md"), atual.replace("\n## Correções de produto", `${CHANGELOG_24}\n\n## Correções de produto`));
  }
}
if (COERENCIA) await fs.writeFile(path.join(DIR_PACK, "COERENCIA-HELENA.md"), COERENCIA);
const ARQ_INTERNO = SO_TELA_24 ? "CAPTURA-INTERNA-TELA24.json" : "CAPTURA-INTERNA.json";
await fs.writeFile(path.join(DIR_INTERNO, ARQ_INTERNO), JSON.stringify(INTERNO, null, 2));

// P07 e segredos: o pack comercial não pode levar id do projeto nem segredo
const textosDoPack = {};
for (const f of ["MANIFESTO.md", "CAPTURA.json", "CHANGELOG.md", "COERENCIA-HELENA.md"]) textosDoPack[f] = await fs.readFile(path.join(DIR_PACK, f), "utf8");
const violacoes = L.violacoesDoPackComercial(textosDoPack, { segredos: VALORES_SECRETOS });
const internoTexto = await fs.readFile(path.join(DIR_INTERNO, ARQ_INTERNO), "utf8");
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
// sem o SHA256SUMS anterior (no modo 24 ele veio do pack base)
for (const f of (await listar(DIR_PACK)).filter((x) => path.basename(x) !== "SHA256SUMS.txt").sort()) {
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
