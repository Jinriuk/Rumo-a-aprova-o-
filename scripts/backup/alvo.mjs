// ============================================================
// ETAPA 6 — trava de DESTINO do restore
// ------------------------------------------------------------
// O restore escreve. Esta trava decide onde ele pode escrever:
//   • RESTAURO_ALVO=local (padrão): só 127.0.0.1/localhost, ou um host
//     interno declarado em E2E_HOSTS_INTERNOS (a stack da E3). Recusa
//     *.supabase.co/.com/.in sempre;
//   • RESTAURO_ALVO=<ref de 20 letras>: um projeto HOSPEDADO NOVO, e a
//     URL tem de ser desse ref. É o caminho do retorno de verdade.
// Nos dois casos o banco tem de estar VAZIO e ter cara de Supabase:
//   • auth.users existe e não tem linha nenhuma;
//   • nenhum dos schemas da aplicação tem tabela (public.escolas,
//     app.*, demo.*, supabase_migrations.*).
// Não existe modo "por cima": restaurar sobre um banco com dado é outra
// operação (ver "retorno parcial" em docs/operacao/backup-e-restauracao.md).
//
// Uso: node scripts/backup/alvo.mjs          (lê RESTAURO_DB_URL e RESTAURO_ALVO)
// ============================================================
import { fileURLToPath } from "node:url";
import { carregarPg } from "../_pg.mjs";
import { SCHEMAS_APP } from "./toc.mjs";
import { configCliente } from "./metadados.mjs";

const HOSTS_LOCAIS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const HOSPEDADO = /(^|\.)supabase\.(co|com|in)$/i;

/** Passo sem banco: a URL combina com o alvo declarado. Lança Error. */
export function conferirUrlAlvo({ url, alvo = "local", internos = [] }) {
  let u;
  try { u = new URL(url); } catch { throw new Error("RESTAURO_DB_URL não é uma URL postgresql://"); }
  const host = u.hostname.toLowerCase();
  if (alvo === "local") {
    if (HOSPEDADO.test(host)) throw new Error(`restore local recusado: ${host} é projeto hospedado`);
    if (!HOSTS_LOCAIS.has(host) && !internos.includes(host)) {
      throw new Error(`restore local recusado: ${host} não é local nem interno declarado (E2E_HOSTS_INTERNOS)`);
    }
    return { modo: "local" };
  }
  if (!/^[a-z0-9]{20}$/.test(alvo)) throw new Error("RESTAURO_ALVO é 'local' ou o ref (20 letras) do projeto NOVO");
  const doRef = decodeURIComponent(u.username).endsWith(`.${alvo}`) || host.split(".").includes(alvo);
  if (!doRef) throw new Error(`a URL não é do projeto ${alvo}`);
  return { modo: "hospedado", ref: alvo };
}

/** Passo com banco: vazio e com o Auth do Supabase. Lança Error. */
export async function conferirBancoVazio(c) {
  const { rows: [a] } = await c.query("select to_regclass('auth.users') as t");
  if (!a.t) throw new Error("destino sem auth.users: não é um projeto Supabase (nem a stack local)");
  const { rows: [u] } = await c.query("select count(*)::int as n from auth.users");
  if (u.n > 0) throw new Error(`destino tem ${u.n} conta(s) em auth.users: o restore só entra em projeto vazio`);
  const { rows } = await c.query(`
    select n.nspname || '.' || c.relname as t from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where c.relkind in ('r','p') and n.nspname = any($1) limit 5`, [SCHEMAS_APP]);
  if (rows.length) throw new Error(`destino já tem tabelas da aplicação (${rows.map((r) => r.t).join(", ")}): o restore só entra em projeto vazio`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.env.RESTAURO_DB_URL;
  const alvo = process.env.RESTAURO_ALVO || "local";
  const internos = (process.env.E2E_HOSTS_INTERNOS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  try {
    if (!url) throw new Error("RESTAURO_DB_URL vazio");
    const r = conferirUrlAlvo({ url, alvo, internos });
    const pg = await carregarPg();
    if (!pg) throw new Error("pacote pg ausente: rode `npm ci` em tests/");
    const { Client } = pg.default ?? pg;
    const c = new Client(configCliente(url, "triliva-restauro"));
    await c.connect();
    try { await conferirBancoVazio(c); } finally { await c.end(); }
    console.log(`trava do restore ok: destino ${r.modo}${r.ref ? ` (${r.ref})` : ""}, vazio`);
  } catch (e) {
    console.error(`::error::${e.message}`);
    process.exit(3);
  }
}
