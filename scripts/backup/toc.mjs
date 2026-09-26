// ============================================================
// ETAPA 6 — separa o índice (TOC) do dump nas três fases do restore
// ------------------------------------------------------------
// `pg_restore -l dump` lista uma entrada por linha:
//   <id>; <catálogo> <oid> <TIPO> <schema> <nome> <dono>
// TIPO pode ter mais de uma palavra (TABLE DATA, FK CONSTRAINT, SEQUENCE
// SET, DEFAULT ACL, ROW SECURITY). Entradas de nível de banco trazem "-"
// no lugar do schema (ACL - SCHEMA app postgres).
//
// As três fases (ver restaurar.sh):
//   estrutura — tudo dos schemas da aplicação, MENOS ACL: tabelas,
//               dados, funções, policies, índices, FKs, triggers, e o
//               CREATE SCHEMA de app/demo/supabase_migrations (o public
//               já existe em qualquer projeto Supabase);
//   acl       — as ACLs desses objetos e dos schemas. Vão num passo à
//               parte porque o destino Supabase soma os privilégios
//               padrão dele (EXECUTE para anon em toda função nova do
//               public) às ACLs do dump, que são diferenças contra o
//               default do Postgres. Ensaiado em 26/09: 66 funções
//               executáveis por anon sem o passo, 12 com ele (as do
//               schema app, que anon não alcança, como na origem).
//               DEFAULT ACL fica de fora: são da plataforma, o destino
//               já tem, e as de supabase_admin o papel postgres nem
//               pode aplicar;
//   auth      — só DADOS das tabelas do Auth (a estrutura é do GoTrue
//               do destino), menos schema_migrations, que é do GoTrue
//               de lá e não da origem.
// ============================================================
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const SCHEMAS_APP = ["public", "app", "demo", "supabase_migrations"];

// Tabelas do Auth cujos DADOS não entram no dump: sessão, token de uso
// único e fluxo em andamento. Restaurar isso só serviria para reabrir
// sessões e links de redefinição da origem; depois do retorno, todo
// mundo entra de novo. mfa_amr_claims depende de sessions.
export const AUTH_SEM_DADOS = [
  "sessions", "refresh_tokens", "mfa_amr_claims", "one_time_tokens", "flow_state",
  "mfa_challenges", "saml_relay_states", "oauth_authorizations", "oauth_client_states",
  "webauthn_challenges",
];

const LINHA = /^(\d+); (\d+) (\d+) ((?:[A-Z]+ )+)(\S+) (\S+)(?: (.*))?$/;

/** Uma linha do `pg_restore -l`, ou null para comentário/linha vazia. */
export function lerEntrada(linha) {
  const m = linha.match(LINHA);
  if (!m) return null;
  const tipo = m[4].trim();
  let schema = m[5];
  let nome = m[6];
  // "ACL - SCHEMA app postgres" / "COMMENT - SCHEMA public dono"
  if (schema === "-" && nome === "SCHEMA" && m[7]) {
    return { linha, tipo, alvo: "SCHEMA", schema: m[7].split(" ")[0], nome: m[7].split(" ")[0] };
  }
  return { linha, tipo, alvo: tipo, schema, nome };
}

/** Separa as linhas do TOC nas fases estrutura, acl e auth. */
export function separarToc(texto, { schemasApp = SCHEMAS_APP } = {}) {
  const app = new Set(schemasApp);
  const fases = { estrutura: [], acl: [], auth: [], fora: [] };
  for (const linha of texto.split("\n")) {
    const e = lerEntrada(linha);
    if (!e) continue;
    if (e.tipo === "DEFAULT ACL") { fases.fora.push(e); continue; }
    if (e.tipo === "SCHEMA") {
      // o CREATE SCHEMA: o public já existe no destino
      if (app.has(e.nome) && e.nome !== "public") fases.estrutura.push(e);
      else fases.fora.push(e);
      continue;
    }
    if (e.alvo === "SCHEMA") {
      // ACL e COMMENT do schema. O comentário do public é do dono do
      // banco, não do papel postgres, e não é nosso: fica de fora.
      if (!app.has(e.schema) || (e.tipo === "COMMENT" && e.schema === "public")) fases.fora.push(e);
      else if (e.tipo === "ACL" || e.tipo === "COMMENT") fases.acl.push(e);
      else fases.fora.push(e);
      continue;
    }
    if (app.has(e.schema)) {
      (e.tipo === "ACL" ? fases.acl : fases.estrutura).push(e);
      continue;
    }
    if (e.schema === "auth" && (e.tipo === "TABLE DATA" || e.tipo === "SEQUENCE SET") && e.nome !== "schema_migrations") {
      fases.auth.push(e);
      continue;
    }
    fases.fora.push(e);
  }
  return fases;
}

// ── linha de comando ──────────────────────────────────────────
// node scripts/backup/toc.mjs <toc.txt> <prefixo-de-saída> [schemas,csv]
// escreve <prefixo>-estrutura.txt, -acl.txt e -auth.txt
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [arquivo, prefixo, schemas] = process.argv.slice(2);
  if (!arquivo || !prefixo) {
    console.error("uso: node scripts/backup/toc.mjs <toc.txt> <prefixo> [schemas]");
    process.exit(2);
  }
  const fases = separarToc(readFileSync(arquivo, "utf8"), schemas ? { schemasApp: schemas.split(",") } : {});
  for (const f of ["estrutura", "acl", "auth"]) {
    writeFileSync(`${prefixo}-${f}.txt`, fases[f].map((e) => e.linha).join("\n") + "\n");
  }
  const dados = fases.estrutura.filter((e) => e.tipo === "TABLE DATA").length;
  console.log(`toc: estrutura ${fases.estrutura.length} (com ${dados} de dados), acl ${fases.acl.length}, auth ${fases.auth.length}, fora ${fases.fora.length}`);
  if (!dados || !fases.auth.some((e) => e.nome === "users")) {
    console.error("::error::o dump não tem dados das tabelas da aplicação ou de auth.users");
    process.exit(1);
  }
}
