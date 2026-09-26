// @ts-check
/* ETAPA 3 — apoio HTTP e de banco para as jornadas e a camada_http.
   Tudo aqui fala SÓ com a stack local: as URLs vêm de carregarAmbiente()
   (que a trava de destino já conferiu no globalSetup) e o banco só abre
   depois de travaCompleta (host local + marcador desta execução).

   Nada aqui guarda token em arquivo: os tokens vivem na memória do
   processo de teste e morrem com ele. */
import { carregarAmbiente } from "./ambiente.js";
import { travaCompleta } from "../../../scripts/e2e/trava.mjs";
import { pg } from "../../../scripts/e2e/deps.mjs";

export const amb = carregarAmbiente();

// ── banco (como postgres: o "servidor" e o árbitro das provas) ──
let clientePg = null;
/** Cliente pg da stack local, aberto uma vez por worker, com a trava. */
export async function banco() {
  if (clientePg) return clientePg;
  const c = new pg.Client({ connectionString: amb.dbUrl });
  await c.connect();
  await travaCompleta(c, process.env);
  clientePg = c;
  return c;
}
export async function sql(texto, params = []) {
  const c = await banco();
  return (await c.query(texto, params)).rows;
}
export async function fecharBanco() {
  if (clientePg) { await clientePg.end().catch(() => {}); clientePg = null; }
}

/** md5 de todas as linhas das tabelas, como postgres (sem RLS). Igual ao
 *  hashTabelas da camada banco: negação só vale com hash igual. */
export async function hashTabelas(tabelas) {
  const out = {};
  for (const t of tabelas) {
    const [r] = await sql(`select md5(coalesce(string_agg(x::text, '|' order by x::text), '')) as h, count(*)::int as n from ${t} x`);
    out[t] = `${r.h}:${r.n}`;
  }
  return out;
}
export const mesmoHash = (a, b) => Object.keys(a).every((k) => a[k] === b[k]);

// ── Auth ──
/** Login real no Auth local (grant password). Devolve a sessão crua. */
export async function entrar(email, senha) {
  const r = await fetch(`${amb.apiUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: amb.anonKey, "content-type": "application/json" },
    body: JSON.stringify({ email, password: senha }),
  });
  const corpo = await r.json().catch(() => ({}));
  return { status: r.status, corpo, token: corpo.access_token ?? null, refresh: corpo.refresh_token ?? null };
}
export async function renovar(refresh) {
  const r = await fetch(`${amb.apiUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: amb.anonKey, "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  const corpo = await r.json().catch(() => ({}));
  return { status: r.status, corpo, token: corpo.access_token ?? null, refresh: corpo.refresh_token ?? null };
}
/** Claims do JWT sem verificar a assinatura (quem verifica é o servidor). */
export function claims(token) {
  const parte = String(token).split(".")[1] ?? "";
  return JSON.parse(Buffer.from(parte.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
}

/** JWT assinado com o segredo da stack local, com `exp` no passado.
 *  O segredo é o padrão público da CLI (não é segredo de ninguém) e só
 *  vale nesta stack: o teste recusa se a chave anon local não tiver sido
 *  assinada com ele, em vez de forjar um token que o servidor nem aceita. */
export async function tokenExpirado(sub, extra = {}) {
  const { createHmac } = await import("node:crypto");
  const segredo = process.env.E2E_JWT_SECRET || "super-secret-jwt-token-with-at-least-32-characters-long";
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const assinar = (h, p) => {
    const corpo = `${b64(h)}.${b64(p)}`;
    return `${corpo}.${createHmac("sha256", segredo).update(corpo).digest("base64url")}`;
  };
  // a anon local tem de conferir com o mesmo segredo; senão o token forjado
  // seria recusado por assinatura e o 401 não provaria nada sobre expiração
  const [h, p, s] = amb.anonKey.split(".");
  const conferida = createHmac("sha256", segredo).update(`${h}.${p}`).digest("base64url");
  if (conferida !== s) throw new Error("tokenExpirado: a chave anon local não foi assinada com o segredo esperado (defina E2E_JWT_SECRET)");
  const agora = Math.floor(Date.now() / 1000);
  return assinar({ alg: "HS256", typ: "JWT" }, {
    aud: "authenticated", role: "authenticated", sub, iat: agora - 7200, exp: agora - 3600, ...extra,
  });
}

// ── PostgREST ──
/** Requisição ao PostgREST local. `token` null = anon (só a chave). */
export async function rest(caminho, { token = null, method = "GET", body, headers = {} } = {}) {
  const r = await fetch(`${amb.apiUrl}/rest/v1/${caminho}`, {
    method,
    headers: {
      apikey: amb.anonKey,
      authorization: `Bearer ${token ?? amb.anonKey}`,
      "content-type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const texto = await r.text();
  let corpo = null;
  try { corpo = texto ? JSON.parse(texto) : null; } catch { corpo = texto; }
  return { status: r.status, corpo, headers: r.headers };
}

// ── Edge Functions ──
export const FUNCOES = ["gerar-meta", "virar-semana", "provisionar-aluno", "lgpd-titular", "backoffice-coordenador", "revogar-responsavel", "trocar-senha"];

/** Chama uma Edge Function pelo gateway (Kong), como o front chama. */
export async function funcao(nome, { token, method = "POST", body = {}, headers = {}, direto = false } = {}) {
  const base = direto ? edgeDireto() : amb.functionsUrl;
  const h = { apikey: amb.anonKey, "content-type": "application/json", ...headers };
  if (token !== undefined && token !== null) h.authorization = `Bearer ${token}`;
  const r = await fetch(`${base}/${nome}`, {
    method,
    headers: h,
    body: method === "GET" || method === "HEAD" || method === "OPTIONS" ? undefined : JSON.stringify(body),
  });
  const texto = await r.text();
  let corpo = null;
  try { corpo = texto ? JSON.parse(texto) : null; } catch { corpo = texto; }
  return { status: r.status, corpo, texto, headers: r.headers };
}

/** O Edge Runtime sem o Kong (o Kong local responde CORS "*" no lugar
 *  das funções; ver stack.sh). */
export function edgeDireto() {
  if (!process.env.E2E_EDGE_URL) throw new Error("E2E_EDGE_URL ausente: o stack.sh não achou o container do Edge Runtime");
  return process.env.E2E_EDGE_URL;
}

// ── capturador de e-mail (Mailpit) ──
/** Espera chegar ao capturador LOCAL um e-mail para `para` depois de
 *  `desde` e devolve o corpo em texto. Nada sai da stack. */
export async function esperarEmail(para, { desde = 0, timeout = 20_000 } = {}) {
  const fim = Date.now() + timeout;
  while (Date.now() < fim) {
    const r = await fetch(`${amb.mailUrl}/api/v1/search?query=${encodeURIComponent(`to:"${para}"`)}`);
    const lista = await r.json().catch(() => ({ messages: [] }));
    const msg = (lista.messages ?? [])
      .filter((m) => new Date(m.Created).getTime() >= desde)
      .sort((a, b) => new Date(b.Created).getTime() - new Date(a.Created).getTime())[0];
    if (msg) {
      const det = await (await fetch(`${amb.mailUrl}/api/v1/message/${msg.ID}`)).json();
      return { assunto: det.Subject, texto: det.Text ?? "", html: det.HTML ?? "" };
    }
    await new Promise((res) => setTimeout(res, 500));
  }
  throw new Error(`nenhum e-mail para ${para} chegou ao capturador local em ${timeout} ms`);
}
