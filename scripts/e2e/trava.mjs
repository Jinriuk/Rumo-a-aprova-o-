// ============================================================
// ETAPA 3 — TRAVA DE DESTINO do E2E local
// ------------------------------------------------------------
// Roda ANTES de criar usuário, rodar seed ou limpar dado. Exige, todos
// ao mesmo tempo:
//   1. host local: 127.0.0.1, localhost, ::1, ou um hostname interno
//      declarado em E2E_HOSTS_INTERNOS (CSV, ex.: "kong,db");
//   2. nenhum *.supabase.co / *.supabase.com / *.supabase.in em lugar
//      nenhum da configuração (API, banco, functions, e-mail);
//   3. id de execução (E2E_RUN_ID), no formato de um run do Actions ou
//      de um carimbo local;
//   4. o marcador da fixture no PRÓPRIO banco: a linha em
//      e2e_local.execucao com esse run_id e fixture = "triliva-e2e-local".
//      O marcador só nasce num banco sem marcador (a stack recém-criada)
//      e a trava recusa banco com marcador de outra execução.
// Um banco hospedado nunca tem o schema e2e_local: mesmo que alguém
// burle o host (DNS, túnel), o passo 4 recusa.
//
// Uso:  node scripts/e2e/trava.mjs destino   (1 a 3)
//       node scripts/e2e/trava.mjs marcar    (1 a 3 + cria o marcador)
//       node scripts/e2e/trava.mjs conferir  (1 a 4)
// Lê E2E_API_URL, E2E_DB_URL, E2E_FUNCTIONS_URL, E2E_MAIL_URL, E2E_RUN_ID.
// ============================================================
import { fileURLToPath } from "node:url";

export const FIXTURE = "triliva-e2e-local";
const HOSTS_LOCAIS = ["127.0.0.1", "localhost", "::1", "[::1]"];
const HOSTS_PROIBIDOS = /(^|\.)supabase\.(co|com|in)$/i;
const RUN_ID_OK = /^[A-Za-z0-9][A-Za-z0-9._-]{3,79}$/;

function hostDe(valor) {
  try { return new URL(valor).hostname.toLowerCase(); } catch { return null; }
}

export function hostsInternos(env = process.env) {
  return (env.E2E_HOSTS_INTERNOS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
}

/** Passos 1 a 3. Lança Error com o motivo; não toca em nada. */
export function conferirDestino({ urls, runId, internos = [] }) {
  if (!runId || !RUN_ID_OK.test(runId)) {
    throw new Error("trava E2E: E2E_RUN_ID ausente ou inválido — sem id de execução não há E2E");
  }
  const permitidos = new Set([...HOSTS_LOCAIS, ...internos]);
  const entradas = Object.entries(urls);
  if (!entradas.length) throw new Error("trava E2E: nenhuma URL para conferir");
  for (const [nome, valor] of entradas) {
    if (!valor) throw new Error(`trava E2E: ${nome} ausente`);
    const host = hostDe(valor);
    if (!host) throw new Error(`trava E2E: ${nome} não é uma URL`);
    if (HOSTS_PROIBIDOS.test(host)) {
      throw new Error(`trava E2E: ${nome} aponta para ${host} — projeto hospedado do Supabase é recusado sempre`);
    }
    if (!permitidos.has(host)) {
      throw new Error(`trava E2E: ${nome} aponta para ${host}, que não é local nem interno declarado (E2E_HOSTS_INTERNOS)`);
    }
  }
}

export function urlsDoAmbiente(env = process.env) {
  return {
    E2E_API_URL: env.E2E_API_URL,
    E2E_DB_URL: env.E2E_DB_URL,
    E2E_FUNCTIONS_URL: env.E2E_FUNCTIONS_URL,
    E2E_MAIL_URL: env.E2E_MAIL_URL,
  };
}

/** Passo 4 (criação): só num banco sem marcador. */
export async function criarMarcador(client, runId) {
  await client.query("create schema if not exists e2e_local");
  await client.query(`create table if not exists e2e_local.execucao (
    run_id text primary key, fixture text not null, criado_em timestamptz not null default now())`);
  await client.query("revoke all on schema e2e_local from public");
  const { rows } = await client.query("select run_id from e2e_local.execucao");
  if (rows.length && !rows.some((r) => r.run_id === runId)) {
    throw new Error(`trava E2E: este banco já tem o marcador de outra execução (${rows[0].run_id}); recrie a stack`);
  }
  await client.query(
    "insert into e2e_local.execucao (run_id, fixture) values ($1, $2) on conflict (run_id) do nothing",
    [runId, FIXTURE]);
}

/** Passo 4 (conferência): o banco tem de ter o marcador DESTA execução. */
export async function conferirMarcador(client, runId) {
  const { rows: s } = await client.query("select to_regclass('e2e_local.execucao') as t");
  if (!s[0].t) throw new Error("trava E2E: banco sem o marcador da fixture (e2e_local.execucao) — não é a stack local deste E2E");
  const { rows } = await client.query("select run_id, fixture from e2e_local.execucao");
  if (rows.length !== 1 || rows[0].run_id !== runId || rows[0].fixture !== FIXTURE) {
    throw new Error(`trava E2E: marcador não confere (esperado run_id=${runId}, fixture=${FIXTURE})`);
  }
}

/** Tudo de uma vez, para os scripts que escrevem (semear, limpar). */
export async function travaCompleta(client, env = process.env) {
  conferirDestino({ urls: urlsDoAmbiente(env), runId: env.E2E_RUN_ID, internos: hostsInternos(env) });
  await conferirMarcador(client, env.E2E_RUN_ID);
}

// ── linha de comando ──────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const etapa = process.argv[2];
  const { carregarLocalEnv } = await import("./ambiente.mjs");
  const env = carregarLocalEnv(process.env);
  try {
    conferirDestino({ urls: urlsDoAmbiente(env), runId: env.E2E_RUN_ID, internos: hostsInternos(env) });
    if (etapa === "marcar" || etapa === "conferir") {
      const { pg } = await import("./deps.mjs");
      const client = new pg.Client({ connectionString: env.E2E_DB_URL });
      await client.connect();
      try {
        if (etapa === "marcar") await criarMarcador(client, env.E2E_RUN_ID);
        await conferirMarcador(client, env.E2E_RUN_ID);
      } finally { await client.end(); }
    } else if (etapa !== "destino") {
      throw new Error("uso: node scripts/e2e/trava.mjs destino | marcar | conferir");
    }
    console.log(`trava E2E ok (${etapa}): destino local, run ${env.E2E_RUN_ID}`);
  } catch (e) {
    console.error(`::error::${e.message}`);
    process.exit(3);
  }
}
