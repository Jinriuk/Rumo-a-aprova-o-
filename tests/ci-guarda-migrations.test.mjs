// Etapa 5 — guardas de migration (scripts/ci/guarda-migrations.mjs).
// Cada guarda tem um caso que reprova e um que passa, primeiro na lógica
// e depois de ponta a ponta num repositório git de verdade (o script
// rodando como no CI, com GUARDA_BASE). No fim, o ci.yml lido como
// texto: o passo existe no build-e-unitarios e o checkout traz histórico.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { conferirMistura, conferirDestrutivas, achadosDestrutivos, marcadorSegundaFase } from "../scripts/ci/guarda-migrations.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/ci/guarda-migrations.mjs", import.meta.url));
const CI = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const MARCADOR = "-- segunda-fase: front sem chamada à assinatura antiga desde o PR #999";
const nova = (sql, caminho = "supabase/migrations/0059_x.sql") => [{ caminho, sql, completo: sql }];

// ── guarda 1: banco e front no mesmo diff ────────────────────────

test("guarda 1 reprova: migration nova e app/ no mesmo diff", () => {
  const p = conferirMistura([
    { status: "A", caminho: "supabase/migrations/0059_coluna_nova.sql" },
    { status: "M", caminho: "app/src/shared/data/index.js" },
  ]);
  assert.equal(p.length, 1);
  assert.match(p[0], /adiciona migration \(supabase\/migrations\/0059_coluna_nova\.sql\) e altera app\/ \(app\/src\/shared\/data\/index\.js\)/);
  // apagar ou criar arquivo em app/ também é alterar app/
  assert.equal(conferirMistura([{ status: "A", caminho: "supabase/migrations/0059_x.sql" }, { status: "D", caminho: "app/src/velho.js" }]).length, 1);
});

test("guarda 1 passa: só banco (com teste e doc), só front, ou migration editada sem migration nova", () => {
  assert.deepEqual(conferirMistura([
    { status: "A", caminho: "supabase/migrations/0059_coluna_nova.sql" },
    { status: "A", caminho: "tests/coluna-nova-db.test.mjs" },
    { status: "M", caminho: "docs/operacao/aplicacao-0059.md" },
  ]), []);
  assert.deepEqual(conferirMistura([{ status: "M", caminho: "app/src/App.jsx" }, { status: "M", caminho: "tests/x.test.mjs" }]), []);
  assert.deepEqual(conferirMistura([{ status: "M", caminho: "supabase/migrations/0058_x.sql" }, { status: "M", caminho: "app/src/App.jsx" }]), []);
});

// ── guarda 2: destrutivo sem segunda fase ────────────────────────

test("guarda 2 reprova: DROP COLUMN, DROP FUNCTION, DROP TABLE, RENAME e DROP sem a palavra COLUMN", () => {
  const casos = [
    ["alter table alunos drop column status_provisionamento;", "DROP COLUMN"],
    ["drop function if exists public.backoffice_escolas();", "DROP FUNCTION"],
    ["DROP TABLE app.login_tentativas;", "DROP TABLE"],
    ["alter table turmas rename column nome to titulo;", "RENAME"],
    ["alter function public.resumo_escola() rename to resumo_escola_v1;", "RENAME"],
    ["alter table alunos\n  drop if exists apelido;", "DROP COLUMN (sem a palavra COLUMN)"],
    ["do $$ begin execute 'drop table if exists _velha'; end $$;", "DROP TABLE"],
  ];
  for (const [sql, padrao] of casos) {
    const p = conferirDestrutivas(nova(sql));
    assert.equal(p.length, 1, `${sql} → ${p.join(" | ")}`);
    assert.ok(p[0].includes(`: ${padrao} na linha`), `${sql} → ${p[0]}`);
  }
  // a linha reportada é a do arquivo, mesmo com comentário de bloco antes
  const sql = "/* cabeçalho\n   de três linhas */\nselect 1;\nalter table escolas drop column observacao;\n";
  assert.match(conferirDestrutivas(nova(sql))[0], /DROP COLUMN na linha 4 \(`alter table escolas drop column observacao;`\)/);
});

test("guarda 2 passa: com o marcador de segunda fase, em comentário, ou não destrutivo", () => {
  assert.deepEqual(conferirDestrutivas(nova(`${MARCADOR}\nalter table alunos drop column apelido;\ndrop function public.velha(uuid);\n`)), []);
  // os blocos de ROLLBACK citam drop em comentário o tempo todo
  assert.deepEqual(conferirDestrutivas(nova("-- ROLLBACK:\n--   drop table aluno_missoes;\n/* alter table missoes drop column meta; */\nselect 1;")), []);
  // o que não tira nada do site no ar
  assert.deepEqual(achadosDestrutivos([
    "alter table escolas drop constraint if exists escolas_status_check;",
    "alter table alunos alter column apelido drop not null;",
    "alter table alunos alter column criado_em drop default;",
    "drop policy if exists p on alunos;",
    "drop trigger if exists t on alunos;",
    "create or replace function public.f() returns int language sql as $$ select 1 $$;",
    "create table registro_renames (id int);",
  ].join("\n")), []);
});

test("guarda 2: marcador fraco não vale, e linha nova em migration existente conta", () => {
  assert.equal(marcadorSegundaFase("-- segunda-fase: sim\n"), null, "motivo curto demais");
  assert.equal(marcadorSegundaFase("select 1; -- segunda-fase: motivo comprido o bastante\n"), null, "tem de ser linha própria");
  assert.equal(conferirDestrutivas(nova("-- segunda-fase: ok\ndrop table x;")).length, 1);
  // migration modificada: só o que entrou é analisado; o que já estava não
  const p = conferirDestrutivas([{ caminho: "supabase/migrations/0021_x.sql", sql: "drop table app.coisa;", completo: "drop function if exists a();\ndrop table app.coisa;" }]);
  assert.equal(p.length, 1);
  assert.match(p[0], /DROP TABLE na linha 1/);
});

// ── de ponta a ponta, num repositório git ───────────────────────

function repo() {
  const dir = mkdtempSync(join(tmpdir(), "guarda-mig-"));
  const g = (...a) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...a], { cwd: dir, stdio: "pipe" }).toString().trim();
  g("init", "-q", "-b", "main");
  mkdirSync(join(dir, "supabase/migrations"), { recursive: true });
  mkdirSync(join(dir, "app/src"), { recursive: true });
  writeFileSync(join(dir, "supabase/migrations/0001_base.sql"), "create table t (id int, apelido text);\n");
  writeFileSync(join(dir, "app/src/a.js"), "export const a = 1;\n");
  g("add", "-A"); g("commit", "-q", "-m", "base");
  const base = g("rev-parse", "HEAD");
  g("checkout", "-q", "-b", "pr");
  const commitar = (arquivos) => { for (const [c, t] of Object.entries(arquivos)) writeFileSync(join(dir, c), t); g("add", "-A"); g("commit", "-q", "-m", "pr"); };
  const rodar = (env = { GUARDA_BASE: base }) => spawnSync(process.execPath, [SCRIPT], { cwd: dir, env: { ...process.env, GUARDA_BASE: "", ...env }, encoding: "utf8" });
  return { commitar, rodar };
}

test("CLI guarda 1: reprova migration + app/ no mesmo PR; passa só a migration", () => {
  const misto = repo();
  misto.commitar({ "supabase/migrations/0002_col.sql": "alter table t add column nota int;\n", "app/src/a.js": "export const a = 2;\n" });
  const r1 = misto.rodar();
  assert.equal(r1.status, 1, r1.stdout + r1.stderr);
  assert.match(r1.stderr, /adiciona migration \(supabase\/migrations\/0002_col\.sql\) e altera app\//);

  const soBanco = repo();
  soBanco.commitar({ "supabase/migrations/0002_col.sql": "alter table t add column nota int;\n" });
  const r2 = soBanco.rodar();
  assert.equal(r2.status, 0, r2.stdout + r2.stderr);
  assert.match(r2.stdout, /1 migration\(s\) nova\(s\), 0 em app\/[\s\S]*ok/);
});

test("CLI guarda 2: reprova DROP COLUMN sem marcador; passa com o marcador", () => {
  const sem = repo();
  sem.commitar({ "supabase/migrations/0002_tira.sql": "alter table t drop column apelido;\n" });
  const r1 = sem.rodar();
  assert.equal(r1.status, 1, r1.stdout + r1.stderr);
  assert.match(r1.stderr, /0002_tira\.sql: DROP COLUMN na linha 1/);

  const com = repo();
  com.commitar({ "supabase/migrations/0002_tira.sql": `${MARCADOR}\nalter table t drop column apelido;\n` });
  const r2 = com.rodar();
  assert.equal(r2.status, 0, r2.stdout + r2.stderr);
  assert.match(r2.stdout, /segunda fase declarada \(front sem chamada/);
});

test("CLI: sem base resolvível reprova (fail-closed)", () => {
  const r = repo();
  r.commitar({ "supabase/migrations/0002_col.sql": "select 1;\n" });
  const s = r.rodar({ GUARDA_BASE: "", GUARDA_REF_PADRAO: "origin/main" }); // repositório sem origin
  assert.equal(s.status, 1, s.stdout + s.stderr);
  assert.match(s.stderr, /não consegui achar a base do diff/);
});

// ── o ci.yml ─────────────────────────────────────────────────────

test("CI: a guarda roda no build-e-unitarios, com histórico e a base do PR", () => {
  const i = CI.indexOf("\n  build-e-unitarios:\n");
  const job = CI.slice(i, CI.indexOf("\n  # ----", i + 5));
  assert.match(job, /- uses: actions\/checkout@v\d+\n\s+with:\n(?:\s+#.*\n)*\s+fetch-depth: 0\s*$/m, "sem histórico não há merge-base");
  const passo = job.split("\n      - ").find((p) => /guarda-migrations\.mjs/.test(p)) ?? "";
  assert.match(passo, /GUARDA_BASE: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
  assert.match(passo, /run: node scripts\/ci\/guarda-migrations\.mjs\s*$/m);
  assert.doesNotMatch(passo, /^\s+if:/m, "a guarda não pode ser condicional");
});
