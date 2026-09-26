// ============================================================
// ETAPA 6 — dump lógico com retrato consistente (só leitura)
// ------------------------------------------------------------
// Abre UMA transação REPEATABLE READ READ ONLY na origem, exporta o
// snapshot dela, tira o retrato (metadados.mjs) e roda o pg_dump com
// --snapshot: contagens, estrutura e dump enxergam o MESMO instante.
// Sem isso, um logs_acesso gravado entre o retrato e o dump faria o
// ensaio de restore acusar divergência que não existe.
//
// Antes de ler qualquer coisa, confere que a URL é do projeto pedido:
//   • prod e demo: a URL contém o ref esperado (BACKUP_REF_ESPERADO), e
//     o schema `demo` existe só no demo. Secret trocado (a URL do demo
//     em PROD_DB_URL) reprova aqui, em vez de gerar um "backup de
//     produção" com o conteúdo da vitrine;
//   • sintetico: só host local (o ensaio da stack da E3).
//
// Entrada (ambiente): BACKUP_DB_URL, BACKUP_PROJETO, BACKUP_REF_ESPERADO
// (prod/demo), PG_BIN (opcional: pasta do pg_dump 17+).
// Saída: <dir>/dump.pgcustom, <dir>/manifesto-interno.json e, em
// stdout, um JSON curto com o que o manifesto público precisa.
// Uso: node scripts/backup/despejar.mjs <dir>
// ============================================================
import { spawnSync, execFileSync } from "node:child_process";
import { writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { carregarPg } from "../_pg.mjs";
import { coletar, configCliente } from "./metadados.mjs";
import { SCHEMAS_APP, AUTH_SEM_DADOS } from "./toc.mjs";

const HOSTS_LOCAIS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/** Recusa a URL que não é do projeto pedido. Lança Error com o motivo. */
export function conferirOrigem({ url, projeto, refEsperado }) {
  let u;
  try { u = new URL(url); } catch { throw new Error("BACKUP_DB_URL não é uma URL postgresql://"); }
  if (!/^postgres(ql)?:$/.test(u.protocol)) throw new Error("BACKUP_DB_URL não é uma URL postgresql://");
  if (projeto === "sintetico") {
    if (!HOSTS_LOCAIS.has(u.hostname)) throw new Error("projeto sintetico só lê banco local (stack da E3)");
    return;
  }
  if (projeto !== "prod" && projeto !== "demo") throw new Error(`projeto desconhecido: ${projeto}`);
  if (!refEsperado || !/^[a-z0-9]{20}$/.test(refEsperado)) throw new Error("BACKUP_REF_ESPERADO ausente ou inválido");
  // pooler: usuário postgres.<ref>; conexão direta: host db.<ref>.supabase.co
  const temRef = decodeURIComponent(u.username).endsWith(`.${refEsperado}`) || u.hostname.split(".").includes(refEsperado);
  if (!temRef) throw new Error(`a URL de ${projeto} não é do projeto esperado (ref ${refEsperado}): secret trocado?`);
}

export function argsPgDump({ arquivo, snapshot, schemas }) {
  return [
    "--format=custom", "--compress=6", `--file=${arquivo}`,
    `--snapshot=${snapshot}`, "--lock-wait-timeout=60000",
    "--no-publications", "--no-subscriptions", "--no-security-labels",
    ...schemas.map((s) => `--schema=${s}`), "--schema=auth",
    ...AUTH_SEM_DADOS.map((t) => `--exclude-table-data=auth.${t}`),
  ];
}

const majorDe = (texto) => Number((texto.match(/(\d+)(?:\.\d+)?/) ?? [])[1]);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  const { BACKUP_DB_URL: url, BACKUP_PROJETO: projeto, BACKUP_REF_ESPERADO: ref, PG_BIN } = process.env;
  const falhar = (msg) => { console.error(`::error::${msg}`); process.exit(1); };
  if (!dir) falhar("uso: node scripts/backup/despejar.mjs <dir>");
  if (!url) falhar("BACKUP_DB_URL vazio: o secret deste projeto não está cadastrado no environment backup");
  try { conferirOrigem({ url, projeto, refEsperado: ref }); } catch (e) { falhar(e.message); }

  const pgDump = PG_BIN ? join(PG_BIN, "pg_dump") : "pg_dump";
  const versaoDump = execFileSync(pgDump, ["--version"], { encoding: "utf8" }).trim();

  const pg = await carregarPg();
  if (!pg) falhar("pacote pg ausente: rode `npm ci` em tests/");
  const { Client } = pg.default ?? pg;
  const c = new Client(configCliente(url));
  try {
    await c.connect();
  } catch (e) {
    falhar(`conexão com a origem falhou: ${e.message}`);
  }
  try {
    await c.query("begin transaction isolation level repeatable read read only");
    const snapshot = (await c.query("select pg_export_snapshot() as s")).rows[0].s;
    const meta = await coletar(c);

    if (majorDe(versaoDump) < meta.postgres.major) {
      throw new Error(`${versaoDump} não lê Postgres ${meta.postgres.versao}: suba o cliente no workflow`);
    }
    if (projeto === "prod" && meta.schemas.includes("demo")) throw new Error("PROD_DB_URL aponta para um banco com o schema demo: é o demo?");
    if (projeto === "demo" && !meta.schemas.includes("demo")) throw new Error("DEMO_DB_URL aponta para um banco sem o schema demo: é a produção?");
    for (const s of ["public", "app"]) if (!meta.schemas.includes(s)) throw new Error(`schema ${s} ausente na origem`);
    if (!meta.contagens["public.escolas"]) throw new Error("public.escolas vazia na origem: banco errado ou vazio");

    const arquivo = join(dir, "dump.pgcustom");
    const schemas = SCHEMAS_APP.filter((s) => meta.schemas.includes(s));
    const u = new URL(url);
    const senha = decodeURIComponent(u.password);
    u.password = "";
    const inicio = Date.now();
    const r = spawnSync(pgDump, [...argsPgDump({ arquivo, snapshot, schemas }), `--dbname=${u.toString()}`], {
      env: { ...process.env, PGPASSWORD: senha, PGAPPNAME: "triliva-backup" },
      stdio: ["ignore", 2, 2], // stdout é o JSON de resumo; o pg_dump fala no stderr
    });
    if (r.status !== 0) throw new Error(`pg_dump saiu com ${r.status ?? r.signal}`);
    const tamanho = statSync(arquivo).size;
    if (tamanho < 1024) throw new Error(`dump com ${tamanho} bytes: vazio`);
    await c.query("commit");

    const interno = {
      projeto,
      schemas_dump: [...schemas, "auth"],
      auth_sem_dados: AUTH_SEM_DADOS,
      pg_dump: versaoDump,
      pg_dump_segundos: Math.round((Date.now() - inicio) / 100) / 10,
      ...meta,
    };
    writeFileSync(join(dir, "manifesto-interno.json"), JSON.stringify(interno, null, 1) + "\n");
    console.log(JSON.stringify({
      postgres: meta.postgres.versao,
      pg_dump: versaoDump,
      ultima_migration: meta.ultima_migration,
      ledger_linhas: meta.ledger_linhas,
      schemas: interno.schemas_dump,
      dump_bytes: tamanho,
    }));
  } catch (e) {
    await c.query("rollback").catch(() => {});
    falhar(`dump: ${e.message}`);
  } finally {
    await c.end().catch(() => {});
  }
}
