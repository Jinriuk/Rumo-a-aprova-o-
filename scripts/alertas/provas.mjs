// ============================================================
// ETAPA 4 — provas dos alertas na stack local da E3
// ------------------------------------------------------------
// Roda depois de scripts/alertas/provas.sh ter subido: a stack local
// (Postgres 17 com pg_net e Vault, Auth, PostgREST, Edge Runtime), o
// banco (migrations + seeds), o simulador de Resend e healthchecks e o
// front (build --mode e2e com VITE_ERROR_REPORT_URL apontando para a
// função registrar-erro LOCAL), servido em 127.0.0.1:4173.
//
// Provas (cada uma reprova o script se falhar):
//   P1 origem não permitida é recusada (403) e nada é gravado
//   P2 nenhum dado pessoal gravado nem enviado por e-mail
//   P3 50 erros iguais geram 1 e-mail só (mesmo IP e IPs diferentes)
//   P4 erro sintético do React e promessa rejeitada chegam à tabela e
//      geram 1 e-mail cada (Resend simulado)
//   P5 coletor fora do ar (recusado, 503, pendurado) não derruba a tela
//   P6 resposta 5xx de outra Edge Function entra no mesmo coletor
//   P7 heartbeat da virada pelo pg_net e pelo Vault de verdade
// Nada aqui fala com projeto hospedado: as URLs vêm do local.env da
// stack e a trava da E3 (scripts/e2e/trava.mjs) já rodou antes.
// ============================================================
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { carregarLocalEnv } from "../e2e/ambiente.mjs";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const env = carregarLocalEnv({ ...process.env });
const { chromium } = createRequire(resolve(RAIZ, "app/package.json"))("@playwright/test");
const pg = createRequire(resolve(RAIZ, "tests/package.json"))("pg");

for (const k of ["E2E_FUNCTIONS_URL", "E2E_DB_URL", "E2E_SERVICE_ROLE_KEY", "E2E_ANON_KEY", "SIMULADOR_LOG", "PROVAS_HC_BASE"]) {
  if (!env[k]) { console.error(`provas: falta ${k}`); process.exit(2); }
}
for (const u of [env.E2E_FUNCTIONS_URL, env.E2E_DB_URL]) {
  if (/supabase\.co/i.test(u)) { console.error("provas: URL hospedada recusada"); process.exit(2); }
}

const COLETOR = `${env.E2E_FUNCTIONS_URL}/registrar-erro`;
const FRONT = env.PROVAS_FRONT || "http://127.0.0.1:4173";
const SAIDA = env.PROVAS_SAIDA || resolve(RAIZ, "e2e-artefatos/alertas");
const CONTEXTO_COMPLETO = env.PROVA_CONTEXTO_COMPLETO === "1";

const db = new pg.Client({ connectionString: env.E2E_DB_URL });
await db.connect();
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
async function esperar(fn, ms = 20000) {
  const fim = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > fim) return v;
    await dormir(300);
  }
}
const simulador = () => existsSync(env.SIMULADOR_LOG)
  ? readFileSync(env.SIMULADOR_LOG, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
  : [];
const emails = () => simulador().filter((x) => x.tipo === "email");
const emailsCom = (trecho) => emails().filter((x) => String(x.corpo?.subject ?? "").includes(trecho));

const resultados = [];
async function prova(id, titulo, fn) {
  const t0 = Date.now();
  try {
    const detalhe = await fn();
    resultados.push({ id, titulo, ok: true, detalhe: detalhe ?? "", ms: Date.now() - t0 });
    console.log(`✔ ${id} ${titulo}${detalhe ? ` — ${detalhe}` : ""}`);
  } catch (e) {
    resultados.push({ id, titulo, ok: false, detalhe: e.message, ms: Date.now() - t0 });
    console.error(`✘ ${id} ${titulo} — ${e.message}`);
  }
}
const exigir = (cond, msg) => { if (!cond) throw new Error(msg); };

async function relatar(corpo, { origin = FRONT, ip, tipo = "text/plain;charset=UTF-8" } = {}) {
  const headers = { "content-type": tipo };
  if (origin) headers.origin = origin;
  if (ip) headers["cf-connecting-ip"] = ip;
  const r = await fetch(COLETOR, { method: "POST", headers, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) });
  await r.text().catch(() => "");
  return r.status;
}
const contarOcorrencias = async () => +(await q("select count(*) n from app.erros_ocorrencias"))[0].n;

// ── P1 ───────────────────────────────────────────────────────────
await prova("P1", "origem não permitida é recusada e nada é gravado", async () => {
  const antes = await contarOcorrencias();
  const corpo = { mensagem: "prova P1", origem: "window.onerror", rota: "/" };
  const s1 = await relatar(corpo, { origin: "https://evil.example", ip: "198.51.100.1" });
  const s2 = await relatar(corpo, { origin: null, ip: "198.51.100.1" });
  const s3 = await relatar(corpo, { origin: "https://app.trilivaedu.com.br.evil.example", ip: "198.51.100.1" });
  exigir(s1 === 403 && s2 === 403 && s3 === 403, `esperava 403/403/403, veio ${s1}/${s2}/${s3}`);
  let semCors = "não medido (sem E2E_EDGE_URL)";
  if (env.E2E_EDGE_URL) {
    const op = await fetch(`${env.E2E_EDGE_URL}/registrar-erro`, { method: "OPTIONS", headers: { origin: "https://evil.example", "access-control-request-method": "POST" } });
    exigir(!op.headers.get("access-control-allow-origin"), "preflight de origem estranha recebeu Access-Control-Allow-Origin");
    semCors = "preflight sem Access-Control-Allow-Origin";
  }
  await dormir(500);
  exigir((await contarOcorrencias()) === antes, "relato de origem recusada virou ocorrência");
  return `403 para origem estranha, sem Origin e sufixo forjado; ${semCors}`;
});

// ── P2 ───────────────────────────────────────────────────────────
const JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJwcm92YS1lNCIsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.YXNzaW5hdHVyYS1mYWxzYS1kYS1wcm92YQ";
const PESSOAIS = ["maria.prova@escola.com.br", JWT, "S3nh4-Prova!", "tok_prova_123456", "WXYZ-ABCD-EF23", "123.456.789-09", "(21) 99876-5432", "0f8fad5b-d9cb-469f-a165-70867728950e", "198.51.100.2"];
await prova("P2", "nenhum dado pessoal gravado nem enviado por e-mail", async () => {
  const s = await relatar({
    mensagem: "prova P2: falha para maria.prova@escola.com.br token=tok_prova_123456 senha=S3nh4-Prova! código WXYZ-ABCD-EF23 cpf 123.456.789-09 tel (21) 99876-5432",
    pilha: `Error\n at x (a.js:1:2)\n Authorization: Bearer ${JWT}\n aluno 0f8fad5b-d9cb-469f-a165-70867728950e`,
    origem: "window.onerror",
    rota: `/aluno/0f8fad5b-d9cb-469f-a165-70867728950e?email=maria.prova@escola.com.br#access_token=${JWT}`,
    extra: "maria.prova@escola.com.br",
  }, { ip: "198.51.100.2" });
  exigir(s === 202, `esperava 202, veio ${s}`);
  const linha = await esperar(async () => (await q("select * from app.erros_ocorrencias where mensagem like 'prova P2:%'"))[0]);
  exigir(linha, "o relato não chegou à tabela");
  await esperar(async () => emailsCom("prova P2").length > 0, 10000);
  const banco = JSON.stringify(await q(`select (select json_agg(o) from app.erros_ocorrencias o) o, (select json_agg(g) from app.erros_grupos g) g,
                                               (select json_agg(l) from app.erros_limite l) l, (select json_agg(e) from app.erros_emails e) e`));
  const correio = JSON.stringify(emails());
  const vazou = PESSOAIS.filter((p) => banco.includes(p) || correio.includes(p));
  exigir(vazou.length === 0, `vazou: ${vazou.join(", ")}`);
  exigir(/\[email\]/.test(linha.mensagem) && /\[redigido\]/.test(linha.mensagem) && /\[jwt\]/.test(linha.pilha), "redação não aparece na linha gravada");
  exigir(linha.rota === "/aluno/[id]", `rota gravada: ${linha.rota}`);
  writeFileSync(resolve(SAIDA, "p2-linha-gravada.json"), JSON.stringify(linha, null, 2));
  return `linha gravada: mensagem="${linha.mensagem}", rota=${linha.rota}; IP fora das 4 tabelas; e-mail sem dado pessoal`;
});

// ── P3 ───────────────────────────────────────────────────────────
await prova("P3", "50 erros iguais geram 1 e-mail só", async () => {
  const msgA = "prova P3 mesmo IP: TypeError undefined";
  // o limite é por chave e MINUTO: começa no início de um minuto para os
  // 50 relatos caberem na mesma janela
  const seg = new Date().getUTCSeconds();
  if (seg > 30) await dormir((61 - seg) * 1000);
  const estA = {};
  for (let i = 0; i < 50; i++) {
    const s = await relatar({ mensagem: msgA, origem: "window.onerror", rota: "/escola" }, { ip: "198.51.100.3" });
    estA[s] = (estA[s] ?? 0) + 1;
  }
  const msgB = "prova P3 IPs diferentes: TypeError undefined";
  const estB = {};
  for (let i = 0; i < 50; i++) {
    const s = await relatar({ mensagem: msgB, origem: "window.onerror", rota: "/escola" }, { ip: `203.0.113.${i + 1}` });
    estB[s] = (estB[s] ?? 0) + 1;
  }
  await dormir(3000);
  const gA = (await q("select ocorrencias from app.erros_grupos where mensagem = $1", [msgA]))[0];
  const gB = (await q("select ocorrencias from app.erros_grupos where mensagem = $1", [msgB]))[0];
  const eA = emailsCom("prova P3 mesmo IP").length;
  const eB = emailsCom("prova P3 IPs diferentes").length;
  exigir(estA[202] === 20 && estA[429] === 30, `mesmo IP: esperava 20×202 e 30×429, veio ${JSON.stringify(estA)}`);
  exigir(estB[202] === 50, `IPs diferentes: esperava 50×202, veio ${JSON.stringify(estB)}`);
  exigir(+gA.ocorrencias === 20 && +gB.ocorrencias === 50, `ocorrências no grupo: ${gA?.ocorrencias}/${gB?.ocorrencias}`);
  exigir(eA === 1 && eB === 1, `e-mails: mesmo IP ${eA}, IPs diferentes ${eB}`);
  return `mesmo IP: 20 aceitos + 30 limitados (429), 1 e-mail; 50 IPs: 50 aceitos num grupo, 1 e-mail`;
});

// ── navegador ────────────────────────────────────────────────────
const browser = await chromium.launch({ executablePath: env.PW_CHROMIUM_PATH || undefined });
const MODULO_QUE_QUEBRA = `export default function ErroSintetico() { throw new Error("erro sintético de render (prova E4 ${Date.now()})"); }`;
async function novaPagina({ coletor } = {}) {
  const ctx = await browser.newContext({ locale: "pt-BR" });
  const page = await ctx.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message));
  // a tela de redefinição é carregada sob demanda (lazy); trocar o chunk
  // dela por um componente que lança no render é um erro de React real,
  // dentro da ErroFronteira de verdade, sem gancho de teste no app
  await page.route(/\/assets\/RedefinirSenha-[^/]+\.js$/, (r) => r.fulfill({ contentType: "text/javascript", body: MODULO_QUE_QUEBRA }));
  if (coletor) await page.route(/\/functions\/v1\/registrar-erro/, coletor);
  return { ctx, page, erros };
}
const rejeitar = (page, msg) => page.evaluate((m) => { setTimeout(() => { Promise.reject(new Error(m)); }, 0); }, msg);

await prova("P4", "erro sintético do React e promessa rejeitada chegam à tabela e geram 1 e-mail cada", async () => {
  const { ctx, page } = await novaPagina();
  await page.goto(`${FRONT}/redefinir-senha`);
  await page.getByText("Algo deu errado nesta tela.").waitFor({ timeout: 15000 });
  const react = await esperar(async () => (await q("select * from app.erros_ocorrencias where origem = 'react-error-boundary' and mensagem like '%erro sintético de render%' order by id desc limit 1"))[0]);
  exigir(react, "o erro do React não chegou à tabela");

  await page.goto(`${FRONT}/`);
  await page.locator("input").first().waitFor({ timeout: 15000 });
  await rejeitar(page, "promessa rejeitada sintética (prova E4)");
  const promessa = await esperar(async () => (await q("select * from app.erros_ocorrencias where origem = 'unhandledrejection' and mensagem like '%promessa rejeitada sintética%' order by id desc limit 1"))[0]);
  exigir(promessa, "a promessa rejeitada não chegou à tabela");
  await ctx.close();

  await esperar(async () => emailsCom("erro sintético de render").length && emailsCom("promessa rejeitada sintética").length, 10000);
  const eR = emailsCom("erro sintético de render").length;
  const eP = emailsCom("promessa rejeitada sintética").length;
  exigir(eR === 1 && eP === 1, `e-mails: React ${eR}, promessa ${eP}`);
  const email = emailsCom("erro sintético de render")[0];
  exigir(email.corpo.to === "dono@exemplo.invalid" && email.autorizacao === "presente", "e-mail sem destinatário ALERTA_EMAIL ou sem chave");

  if (CONTEXTO_COMPLETO) {
    for (const [nome, l, rota] of [["React", react, "/redefinir-senha"], ["promessa", promessa, "/"]]) {
      exigir(l.release && l.release !== "dev", `${nome}: release ausente (${l.release})`);
      exigir(l.papel === "anonimo", `${nome}: papel ${l.papel}`);
      exigir(/^[0-9a-f-]{36}$/.test(l.correlation_id ?? ""), `${nome}: correlation_id ${l.correlation_id}`);
      exigir(l.rota === rota, `${nome}: rota ${l.rota}`);
    }
  }
  writeFileSync(resolve(SAIDA, "p4-linhas.json"), JSON.stringify({ react, promessa }, null, 2));
  return `React: release=${react.release ?? "-"} papel=${react.papel} rota=${react.rota} correlation_id=${react.correlation_id ?? "-"}; `
    + `promessa: rota=${promessa.rota}; 1 e-mail para cada, para ALERTA_EMAIL${CONTEXTO_COMPLETO ? "" : " (front sem release/papel/correlation_id: campos conferidos só com o front da Etapa 4)"}`;
});

await prova("P5", "coletor fora do ar não derruba a tela", async () => {
  const modos = {
    recusado: (r) => r.abort("connectionrefused"),
    "503": (r) => r.fulfill({ status: 503, body: "fora" }),
    pendurado: () => new Promise(() => {}),
  };
  const antes = await contarOcorrencias();
  const notas = [];
  for (const [nome, coletor] of Object.entries(modos)) {
    const { ctx, page, erros } = await novaPagina({ coletor });
    await page.goto(`${FRONT}/`);
    const campo = page.locator("input").first();
    await campo.waitFor({ timeout: 15000 });
    for (let i = 0; i < 3; i++) await rejeitar(page, `rejeição com coletor ${nome} ${i}`);
    await page.evaluate(() => { setTimeout(() => { throw new Error("erro de janela com coletor fora"); }, 0); });
    await dormir(1500);
    await campo.fill("ABCD");
    exigir((await campo.inputValue()).length > 0, `${nome}: a tela de entrada parou de responder`);
    const estranhos = erros.filter((m) => !/rejeição com coletor|erro de janela com coletor fora/.test(m));
    exigir(estranhos.length === 0, `${nome}: erro novo na página: ${estranhos.join(" | ")}`);
    await page.goto(`${FRONT}/redefinir-senha`);
    await page.getByRole("button", { name: "Atualizar página" }).waitFor({ timeout: 15000 });
    notas.push(`${nome}: entrada responde, fronteira mostra "Atualizar página"`);
    await ctx.close();
  }
  await dormir(1000);
  exigir((await contarOcorrencias()) === antes, "relato chegou ao banco com o coletor 'fora do ar'");
  return notas.join("; ");
});

await browser.close();

// ── P6 ───────────────────────────────────────────────────────────
await prova("P6", "resposta 5xx de outra Edge Function entra no mesmo coletor, sem dado", async () => {
  const r = await fetch(`${env.E2E_FUNCTIONS_URL}/virar-semana`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.E2E_SERVICE_ROLE_KEY}`, apikey: env.E2E_SERVICE_ROLE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ escola_id: "00000000-0000-4000-8000-00000000dead" }),
  });
  await r.text();
  exigir(r.status === 500, `virar-semana com escola inexistente devolveu ${r.status}`);
  const cid = r.headers.get("x-correlation-id");
  exigir(cid, "resposta 5xx sem x-correlation-id");
  const linha = await esperar(async () => (await q("select * from app.erros_ocorrencias where correlation_id = $1", [cid]))[0]);
  exigir(linha, "o 5xx não chegou à tabela");
  exigir(linha.origem === "edge:virar-semana" && linha.papel === "servidor" && linha.mensagem === "HTTP 500 em virar-semana", `linha: ${JSON.stringify(linha)}`);
  exigir(linha.pilha === null, "o 5xx levou detalhe do erro para a tabela");
  await esperar(async () => emailsCom("edge:virar-semana").length > 0, 10000);
  exigir(emailsCom("edge:virar-semana").length === 1, "esperava 1 e-mail do 5xx");
  return `HTTP 500 → linha origem=${linha.origem}, mensagem="${linha.mensagem}", correlation_id=${cid} (o mesmo do cabeçalho)`;
});

// ── P7 ───────────────────────────────────────────────────────────
await prova("P7", "heartbeat da virada pelo pg_net e Vault de verdade", async () => {
  const ext = (await q("select extname from pg_extension where extname in ('pg_net', 'supabase_vault') order by 1")).map((x) => x.extname);
  exigir(ext.includes("pg_net") && ext.includes("supabase_vault"), `extensões presentes: ${ext.join(", ")}`);
  const uuid = randomUUID();
  const base = `${env.PROVAS_HC_BASE}/${uuid}`;
  const pings = () => simulador().filter((x) => x.tipo === "healthchecks" && x.url.startsWith(`/hc/${uuid}`));
  const segredo = (await q("select vault.create_secret($1, 'hc_virada_url', 'prova E4') as id", [base]))[0].id;

  const r = (await q("select * from app.virar_semana(current_date)"))[0];
  const esperado = r.alunos_com_erro > 0 ? `/hc/${uuid}/fail` : `/hc/${uuid}`;
  const p1 = await esperar(async () => pings()[0], 20000);
  exigir(p1, "o pg_net não chamou o healthchecks depois da virada");
  exigir(p1.url === esperado, `virada com ${r.alunos_com_erro} aluno(s) com erro chamou ${p1.url}, esperava ${esperado}`);
  exigir(p1.corpo?.metas_geradas === r.metas_geradas, `corpo do ping: ${JSON.stringify(p1.corpo)}`);

  await q("insert into virada_execucoes (escola_id, data_referencia, alunos_com_erro, erros) values (null, current_date, 2, '[]')");
  const p2 = await esperar(async () => pings().find((x) => x.url === `/hc/${uuid}/fail`), 20000);
  exigir(p2, "virada com aluno em erro não chamou /fail");

  // "tira" o segredo trocando o nome (o papel postgres pode atualizar, não apagar)
  await q("select vault.update_secret($1, new_name => 'hc_virada_url_desligado')", [segredo]);
  const antes = pings().length;
  const n0 = +(await q("select count(*) n from virada_execucoes"))[0].n;
  await q("select * from app.virar_semana(current_date)");
  const n1 = +(await q("select count(*) n from virada_execucoes"))[0].n;
  await dormir(4000);
  exigir(n1 === n0 + 1, "sem o segredo, a virada não gravou o heartbeat");
  exigir(pings().length === antes, "sem o segredo, algo foi chamado");
  const respostas = await q("select status_code from net._http_response order by id desc limit 5").catch(() => []);
  return `virada real (${r.metas_geradas} metas geradas, ${r.alunos_com_erro} com erro) → ${p1.url.replace(uuid, "<uuid>")}; `
    + `linha com 2 alunos em erro → /fail; sem segredo: virada gravada e nenhum ping; pg_net registrou HTTP ${respostas.map((x) => x.status_code).join(", ") || "-"}`;
});

// ── P8 ───────────────────────────────────────────────────────────
// Falha do motor de missões (0061): o registro do aluno é gravado, a falha
// vira ocorrência no coletor sem dado de aluno, e o e-mail sai pelo
// caminho real: reserva no banco → pg_net com a URL do Vault
// (project_url) → registrar-erro?despachar=1 → Resend simulado.
await prova("P8", "falha do motor de missões vira e-mail ao dono, sem dado de aluno", async () => {
  const temMotor = (await q("select to_regprocedure('app.missoes_aplicar(text, registros_estudo, registros_estudo)') is not null as tem"))[0].tem;
  if (!temMotor) return "não se aplica: este checkout não tem a 0061";
  exigir(env.PROVAS_PROJECT_URL, "falta PROVAS_PROJECT_URL");
  await q("select vault.create_secret($1, 'project_url', 'prova E4/0061')", [env.PROVAS_PROJECT_URL]);
  const aluno = (await q(`select a.id, a.escola_id from alunos a join concursos c on c.id = a.concurso_id
                           where c.codigo = 'espcex' order by a.id limit 1`))[0];
  exigir(aluno, "a stack precisa de um aluno da EsPCEx");
  await db.query("begin");
  try {
    await db.query("alter table app.missao_registros add constraint falha_injetada check (false) not valid");
    await db.query(`insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos)
                    values ($1, $2, current_date, 'mat', 'prova P8', 70, 60)`, [aluno.escola_id, aluno.id]);
    await db.query("alter table app.missao_registros drop constraint falha_injetada");
    await db.query("commit");
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
  exigir(+(await q("select count(*) n from registros_estudo where topico = 'prova P8'"))[0].n === 1, "o registro caiu junto com o motor");
  const oc = await q("select origem, mensagem, papel from app.erros_ocorrencias where origem = 'banco:motor_missoes'");
  exigir(oc.length === 1, `ocorrências do motor: ${oc.length}`);
  exigir(!/[0-9a-f]{8}-[0-9a-f]{4}-/.test(JSON.stringify(oc)), "id de aluno ou registro na ocorrência");
  const email = await esperar(async () => emailsCom("banco:motor_missoes")[0], 20000);
  exigir(email, "o e-mail da falha do motor não chegou ao Resend simulado");
  exigir(!/[0-9a-f]{8}-[0-9a-f]{4}-/.test(JSON.stringify(email.corpo)), "id de aluno ou registro no e-mail");
  const sit = await esperar(async () => (await q(`select e.situacao from app.erros_emails e join app.erros_grupos g on g.fingerprint = e.fingerprint
                                                   where g.origem = 'banco:motor_missoes'`))[0]?.situacao === "enviado", 10000);
  exigir(sit, "o e-mail não foi marcado como enviado");
  return `registro gravado; ocorrência "${oc[0].mensagem}"; e-mail "${email.corpo.subject}" para ${email.corpo.to}`;
});

await db.end();

// ── relatório ────────────────────────────────────────────────────
const falhas = resultados.filter((r) => !r.ok);
const md = [
  "## Etapa 4 · provas dos alertas na stack local da E3",
  "",
  `Front com release/papel/correlation_id: ${CONTEXTO_COMPLETO ? "sim (campos conferidos em P4)" : "não (front anterior à Etapa 4; P4 confere só a chegada e o e-mail)"}`,
  "",
  "| Prova | Resultado | Detalhe |",
  "| --- | --- | --- |",
  ...resultados.map((r) => `| ${r.id} ${r.titulo} | ${r.ok ? "passou" : "**FALHOU**"} | ${String(r.detalhe).replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\n/g, " ")} |`),
  "",
  `E-mails recebidos pelo Resend simulado: ${emails().length}. Pings recebidos pelo healthchecks simulado: ${simulador().filter((x) => x.tipo === "healthchecks").length}.`,
].join("\n");
writeFileSync(resolve(SAIDA, "relatorio.md"), md + "\n");
writeFileSync(resolve(SAIDA, "emails-recebidos.json"), JSON.stringify(emails().map((e) => ({ em: e.em, para: e.corpo?.to, assunto: e.corpo?.subject, texto: e.corpo?.text })), null, 2));
if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, md + "\n");
console.log("\n" + md);
process.exit(falhas.length ? 1 : 0);
