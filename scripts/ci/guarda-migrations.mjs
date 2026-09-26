// ============================================================
// ETAPA 5 — guardas de migration no diff do PR (build-e-unitarios)
// ------------------------------------------------------------
// A Vercel publica todo merge na main e as migrations são aplicadas à
// mão. Até o workflow `publicar` (adiado para a E8), a ordem é: PR de
// banco, backup, aplicar nos dois ambientes, depois PR do front
// (docs/operacao/proposta-ordem-publicacao.md). Duas guardas seguram o
// que dá para segurar olhando só o diff:
//
//   1. BANCO E FRONT SEPARADOS: reprova o diff que ADICIONA arquivo em
//      supabase/migrations/ e ALTERA qualquer coisa em app/. Se os dois
//      vão no mesmo merge, o front sobe antes de a migration existir no
//      banco.
//   2. NADA DESTRUTIVO NA PRIMEIRA FASE: reprova migration nova (ou linha
//      nova em migration existente) com DROP COLUMN, DROP FUNCTION,
//      DROP TABLE ou RENAME, inclusive `ALTER TABLE t DROP c` sem a
//      palavra COLUMN. O site no ar ainda usa o que sai. Passa só com o
//      marcador explícito numa linha própria da migration:
//        -- segunda-fase: <motivo, com pelo menos 10 caracteres>
//      Comentário não conta (os blocos de ROLLBACK citam drop o tempo
//      todo); SQL dinâmico dentro de string conta.
//
// O diff é sempre contra o ponto em que o branch saiu da base:
//   GUARDA_BASE (o CI passa o base.sha do PR) ou, sem ele, o merge-base
//   com GUARDA_REF_PADRAO (padrão origin/main). Push na própria main dá
//   diff vazio e passa: o PR já passou por aqui. Sem base resolvível,
//   REPROVA.
// Uso: node scripts/ci/guarda-migrations.mjs
// ============================================================
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIR_MIGRATIONS = "supabase/migrations/";
const MOTIVO_MINIMO = 10;

// ── guarda 1 ─────────────────────────────────────────────────────

/** arquivos: [{ status: "A"|"M"|"D"|..., caminho }] do diff do PR. */
export function conferirMistura(arquivos) {
  const migrations = arquivos.filter((a) => a.status === "A" && a.caminho.startsWith(DIR_MIGRATIONS)).map((a) => a.caminho);
  const app = arquivos.filter((a) => a.caminho.startsWith("app/")).map((a) => a.caminho);
  if (!migrations.length || !app.length) return [];
  const amostra = (l) => l.slice(0, 5).join(", ") + (l.length > 5 ? ` e mais ${l.length - 5}` : "");
  return [`o mesmo PR adiciona migration (${amostra(migrations)}) e altera app/ (${amostra(app)}): `
    + "banco e front vão em PRs separados, o de banco primeiro e aplicado nos dois ambientes"];
}

// ── guarda 2 ─────────────────────────────────────────────────────

/** Tira comentários (-- e /* *\/) mantendo as quebras de linha, para a
 *  linha reportada ser a do arquivo. */
export function semComentarios(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/--[^\n]*/g, "");
}

const PADROES = [
  { nome: "DROP COLUMN", re: /\bdrop\s+column\b/gi },
  { nome: "DROP FUNCTION", re: /\bdrop\s+function\b/gi },
  { nome: "DROP TABLE", re: /\bdrop\s+table\b/gi },
  { nome: "RENAME", re: /\brename\b/gi },
];
// ALTER TABLE t DROP [IF EXISTS] c: a palavra COLUMN é opcional no Postgres
const ALTER_TABLE = /\balter\s+table\b[^;]*/gi;
const DROP_SEM_COLUMN = /\bdrop\s+(?:if\s+exists\s+)?(?!column\b|constraint\b|default\b|not\s+null\b|identity\b|expression\b)[a-z_"]/gi;

const linhaDe = (texto, indice) => texto.slice(0, indice).split("\n").length;

/** [{ padrao, linha, trecho }] do que é destrutivo, fora de comentário. */
export function achadosDestrutivos(sql) {
  const limpo = semComentarios(sql);
  const linhas = sql.split("\n");
  const achados = [];
  const anotar = (padrao, indice) => {
    const linha = linhaDe(limpo, indice);
    achados.push({ padrao, linha, trecho: linhas[linha - 1].trim().slice(0, 120) });
  };
  for (const { nome, re } of PADROES) for (const m of limpo.matchAll(re)) anotar(nome, m.index);
  for (const alt of limpo.matchAll(ALTER_TABLE)) {
    for (const m of alt[0].matchAll(DROP_SEM_COLUMN)) anotar("DROP COLUMN (sem a palavra COLUMN)", alt.index + m.index);
  }
  return achados.sort((a, b) => a.linha - b.linha);
}

/** O motivo do marcador de segunda fase, ou null. */
export function marcadorSegundaFase(sql) {
  for (const l of sql.split("\n")) {
    const m = l.match(/^\s*--\s*segunda-fase:\s*(.*?)\s*$/i);
    if (m && m[1].length >= MOTIVO_MINIMO) return m[1];
  }
  return null;
}

/** migracoes: [{ caminho, sql (o que entrou: arquivo inteiro se novo,
 *  linhas adicionadas se modificado), completo (arquivo inteiro) }]. */
export function conferirDestrutivas(migracoes) {
  const problemas = [];
  for (const { caminho, sql, completo } of migracoes) {
    const achados = achadosDestrutivos(sql);
    if (!achados.length || marcadorSegundaFase(completo ?? sql)) continue;
    for (const a of achados) {
      problemas.push(`${caminho}: ${a.padrao} na linha ${a.linha} (\`${a.trecho}\`) sem o marcador "-- segunda-fase: <motivo>": `
        + "o site no ar ainda usa o que sai; remova numa segunda fase, depois que nenhum deploy depender disso");
    }
  }
  return problemas;
}

// ── git ──────────────────────────────────────────────────────────

const git = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

export function resolverBase(cwd, { base = process.env.GUARDA_BASE, refPadrao = process.env.GUARDA_REF_PADRAO || "origin/main" } = {}) {
  if (base) return git(["rev-parse", "--verify", `${base}^{commit}`], cwd);
  return git(["merge-base", refPadrao, "HEAD"], cwd);
}

/** Lê o diff base...HEAD e devolve { arquivos, migracoes }. */
export function lerDiff(cwd, base) {
  const arquivos = git(["diff", "--name-status", "--no-renames", `${base}...HEAD`], cwd)
    .split("\n").filter(Boolean)
    .map((l) => { const [status, caminho] = l.split("\t"); return { status: status[0], caminho }; });
  const migracoes = arquivos
    .filter((a) => a.caminho.startsWith(DIR_MIGRATIONS) && a.caminho.endsWith(".sql") && a.status !== "D")
    .map(({ status, caminho }) => {
      const completo = readFileSync(resolve(cwd, caminho), "utf8");
      if (status === "A") return { caminho, sql: completo, completo };
      // modificada: só o que entrou (migration aplicada não se edita, mas se editarem, o drop novo conta)
      const adicionadas = git(["diff", "-U0", `${base}...HEAD`, "--", caminho], cwd)
        .split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).map((l) => l.slice(1));
      return { caminho, sql: adicionadas.join("\n"), completo };
    });
  return { arquivos, migracoes };
}

// ── linha de comando ──────────────────────────────────────────
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let raiz, base;
  try {
    raiz = git(["rev-parse", "--show-toplevel"], process.cwd());
    base = resolverBase(raiz);
  } catch (e) {
    console.error(`::error::guarda de migrations: não consegui achar a base do diff (${String(e.stderr || e.message).trim().split("\n")[0]}). `
      + "No CI o checkout precisa de fetch-depth: 0. Sem base, reprova.");
    process.exit(1);
  }
  const { arquivos, migracoes } = lerDiff(raiz, base);
  const problemas = [...conferirMistura(arquivos), ...conferirDestrutivas(migracoes)];
  const novas = arquivos.filter((a) => a.status === "A" && a.caminho.startsWith(DIR_MIGRATIONS)).length;
  console.log(`guarda de migrations: diff ${base.slice(0, 7)}...HEAD, ${arquivos.length} arquivo(s), `
    + `${novas} migration(s) nova(s), ${arquivos.filter((a) => a.caminho.startsWith("app/")).length} em app/`);
  for (const m of migracoes) {
    const motivo = marcadorSegundaFase(m.completo);
    if (motivo) console.log(`  ${m.caminho}: segunda fase declarada (${motivo})`);
  }
  if (problemas.length) {
    for (const p of problemas) console.error(`::error::guarda de migrations: ${p}`);
    process.exit(1);
  }
  console.log("guarda de migrations: ok");
}

