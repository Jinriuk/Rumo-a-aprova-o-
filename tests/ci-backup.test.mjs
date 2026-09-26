// Etapa 6 — backup e restore. Duas metades:
//   • os workflows lidos como texto: backup só à mão, secrets só no
//     environment `backup` e só no job dele, cifra antes do artefato,
//     retenção de 30 dias, ensaio sintético sem secret;
//   • a lógica pura dos scripts de scripts/backup: índice do dump,
//     trava de origem e de destino, SQL do pós-restore, comparação
//     origem × destino e a exceção da matriz para o ensaio.
// Um PR que desfizer qualquer uma dessas regras quebra aqui, no
// build-e-unitarios, sem banco e sem rede.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { separarToc, lerEntrada, AUTH_SEM_DADOS } from "../scripts/backup/toc.mjs";
import { conferirOrigem, argsPgDump } from "../scripts/backup/despejar.mjs";
import { conferirUrlAlvo } from "../scripts/backup/alvo.mjs";
import { sqlPosRestauro, CHAMADA_EXTERNA } from "../scripts/backup/pos-restauro.mjs";
import { comparar, redigir } from "../scripts/backup/comparar.mjs";
import { NAO_COBERTO } from "../scripts/backup/relatorio-ensaio.mjs";
import { conferirAlvoLocal } from "./matriz-autorizacao.mjs";

const ler = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const BACKUP = ler(".github/workflows/backup.yml");
const ENSAIO = ler(".github/workflows/ensaio-restauro.yml");
const DUMP = ler("scripts/backup/dump.sh");
const RESTAURAR = ler("scripts/backup/restaurar.sh");
const sem = (t) => t.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n"); // sem comentários
const gatilhos = (t) => sem(t).slice(sem(t).indexOf("\non:"), sem(t).search(/\n(permissions|concurrency|env|jobs):/));
const job = (t, nome) => {
  const s = sem(t);
  const i = s.indexOf(`\n  ${nome}:\n`);
  const j = s.slice(i + 1).search(/\n  [a-z-]+:\n/);
  return j < 0 ? s.slice(i) : s.slice(i, i + 1 + j);
};
const SECRETS_BACKUP = ["PROD_DB_URL", "DEMO_DB_URL", "BACKUP_PASSPHRASE"];

// ── workflow Backup ───────────────────────────────────────────
test("backup.yml: só workflow_dispatch, nunca schedule, push ou pull_request", () => {
  const g = gatilhos(BACKUP);
  assert.match(g, /workflow_dispatch:/);
  assert.doesNotMatch(g, /schedule|cron:|push|pull_request|workflow_run|repository_dispatch/);
  assert.match(g, /options: \[ambos, prod, demo\]/);
});

test("backup.yml: environment backup, só a main, permissão mínima e nada de continue-on-error", () => {
  const b = job(BACKUP, "backup");
  assert.match(b, /environment: backup/);
  assert.match(b, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(sem(BACKUP), /permissions:\n  contents: read\n/);
  assert.doesNotMatch(sem(BACKUP), /continue-on-error|write-all|: write/);
});

test("backup.yml: os três secrets, só pelo nome, e a URL escolhida no shell (sem `&& secrets || secrets`)", () => {
  const usados = [...sem(BACKUP).matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(usados)].sort(), [...SECRETS_BACKUP].sort());
  assert.doesNotMatch(sem(BACKUP), /&&\s*secrets\.|\|\|\s*secrets\./, "com o secret de prod vazio, a expressão cairia no do demo");
  assert.match(job(BACKUP, "backup"), /prod\) export BACKUP_DB_URL="\$PROD_DB_URL"/);
  assert.match(job(BACKUP, "backup"), /bash scripts\/backup\/dump\.sh/);
});

test("backup.yml: artefato só com o cifrado e o manifesto, retido 30 dias, e reprova sem arquivo", () => {
  const b = job(BACKUP, "backup");
  const up = b.slice(b.indexOf("upload-artifact"));
  assert.match(up, /path: \$\{\{ runner\.temp \}\}\/backup\/publicar\/\s*$/m);
  assert.match(up, /retention-days: 30/);
  assert.match(up, /if-no-files-found: error/);
  assert.match(b, /! -name 'triliva-\*\.tar\.gpg' ! -name 'triliva-\*\.json'/, "lista fechada do que sobe");
});

test("secrets do backup não aparecem em nenhum outro workflow", () => {
  const dir = new URL("../.github/workflows/", import.meta.url);
  for (const f of readdirSync(dir)) {
    if (f === "backup.yml" || f === "ensaio-restauro.yml") continue;
    const t = readFileSync(new URL(f, dir), "utf8");
    for (const s of SECRETS_BACKUP) assert.doesNotMatch(t, new RegExp(`secrets\\.${s}\\b`), `${f} lê ${s}`);
  }
});

// ── dump.sh e restaurar.sh ────────────────────────────────────
test("dump.sh: cifra antes de publicar, prova a decifra, exige senha longa e apaga o texto claro", () => {
  const s = sem(DUMP);
  assert.match(s, /set -euo pipefail/);
  assert.match(s, /--symmetric --cipher-algo AES256 --s2k-mode 3 --s2k-digest-algo SHA512 --s2k-count 65011712/);
  assert.match(s, /--output "\$SAIDA\/publicar\/\$nome\.tar\.gpg"/);
  assert.ok(s.indexOf("--decrypt") > s.indexOf("--symmetric"), "decifra de volta depois de cifrar");
  assert.match(s, /\[ "\$sha_volta" = "\$sha_tar" \] \|\| falhar/);
  assert.match(s, /\$\{#BACKUP_PASSPHRASE\}" -ge 32/);
  assert.match(s, /trap 'rm -rf "\$CLARO"/);
  assert.match(s, /::add-mask::/);
  assert.doesNotMatch(s, /echo[^\n]*\$BACKUP_(DB_URL|PASSPHRASE)/, "nada imprime a URL ou a senha");
  assert.doesNotMatch(s, /--passphrase[ =]"?\$/, "senha nunca na linha de comando");
});

test("restaurar.sh: trava antes de tudo, ACL zerada antes das do dump, Auth com replica, conferência reprova", () => {
  const s = sem(RESTAURAR);
  const ordem = ["fase trava", "fase decifrar", "fase estrutura", "fase acl", "fase auth", "fase pos"].map((f) => s.indexOf(f));
  assert.ok(ordem.every((i, k) => i > 0 && (k === 0 || i > ordem[k - 1])), `ordem das fases: ${ordem}`);
  assert.match(s, /revoke all on all routines in schema %I from public, anon, authenticated, service_role/);
  assert.match(s, /set session_replication_role = replica;/);
  assert.match(s, /--single-transaction/);
  assert.match(s, /\[ "\$ok" = 0 \] \|\| falhar/);
});

// ── workflow do ensaio ───────────────────────────────────────
test("ensaio-restauro.yml: só à mão; o sintético sem secret; o real no environment backup e só na main", () => {
  assert.doesNotMatch(gatilhos(ENSAIO), /schedule|push|pull_request/);
  const sint = job(ENSAIO, "sintetico");
  assert.doesNotMatch(sint, /secrets\.|environment:/);
  assert.match(sint, /bash scripts\/backup\/ensaio\.sh/);
  const real = job(ENSAIO, "real");
  assert.match(real, /environment: backup/);
  assert.match(real, /github\.ref == 'refs\/heads\/main'/);
  assert.deepEqual([...new Set([...real.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]))], ["BACKUP_PASSPHRASE"]);
  for (const j of [sint, real]) {
    const parar = j.slice(j.lastIndexOf("\n      - "));
    assert.match(parar, /if: always\(\)/);
    assert.match(parar, /stack\.sh parar/);
    assert.doesNotMatch(j, /continue-on-error/);
  }
});

// ── índice do dump ────────────────────────────────────────────
const TOC = `;
; Archive created at 2026-09-26
15; 2615 17295 SCHEMA - app postgres
5024; 0 0 ACL - SCHEMA app postgres
24; 2615 16457 SCHEMA - auth supabase_admin
14; 2615 2200 SCHEMA - public pg_database_owner
5026; 0 0 COMMENT - SCHEMA public pg_database_owner
5027; 0 0 ACL - SCHEMA public pg_database_owner
326; 1259 18381 TABLE public alunos postgres
5009; 0 18381 TABLE DATA public alunos postgres
5169; 0 0 ACL public TABLE alunos postgres
4613; 2606 18402 FK CONSTRAINT public alunos alunos_escola_id_fkey postgres
900; 1255 1 FUNCTION app tenant_id() postgres
901; 0 0 ACL app FUNCTION tenant_id() postgres
4000; 0 0 DEFAULT ACL public DEFAULT PRIVILEGES FOR FUNCTIONS postgres
400; 1259 2 TABLE auth users supabase_admin
5010; 0 16500 TABLE DATA auth users supabase_admin
5011; 0 16501 TABLE DATA auth schema_migrations supabase_admin
5012; 0 0 SEQUENCE SET auth refresh_tokens_id_seq supabase_admin
5013; 0 0 ACL auth TABLE users supabase_admin`;

test("toc: lê tipo de várias palavras e entrada de schema", () => {
  assert.deepEqual(lerEntrada("5009; 0 18381 TABLE DATA public alunos postgres"),
    { linha: "5009; 0 18381 TABLE DATA public alunos postgres", tipo: "TABLE DATA", alvo: "TABLE DATA", schema: "public", nome: "alunos" });
  assert.equal(lerEntrada("5024; 0 0 ACL - SCHEMA app postgres").schema, "app");
  assert.equal(lerEntrada("; comentário"), null);
});

test("toc: estrutura sem ACL, ACL à parte, Auth só dado, DEFAULT ACL e o que é da plataforma de fora", () => {
  const f = separarToc(TOC);
  const ids = (l) => l.map((e) => e.linha.split(";")[0]);
  assert.deepEqual(ids(f.estrutura), ["15", "326", "5009", "4613", "900"], "CREATE SCHEMA app, tabela, dado, FK e função");
  assert.deepEqual(ids(f.acl), ["5024", "5027", "5169", "901"], "ACL de schema, de tabela e de função; sem o COMMENT do public");
  assert.deepEqual(ids(f.auth), ["5010", "5012"], "auth: dados e sequência, sem schema_migrations nem ACL");
  assert.ok(ids(f.fora).includes("4000") && ids(f.fora).includes("24") && ids(f.fora).includes("14"));
});

// ── trava de origem ───────────────────────────────────────────
const REF = "zckyhihxjjbnqjqilymn";
const OUTRO = "bdjkgrzfzoamchdpobbl";
test("origem: URL do pooler ou direta do ref esperado passa; de outro projeto, ou sintético hospedado, reprova", () => {
  assert.doesNotThrow(() => conferirOrigem({ url: `postgresql://postgres.${REF}:x@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`, projeto: "prod", refEsperado: REF }));
  assert.doesNotThrow(() => conferirOrigem({ url: `postgresql://postgres:x@db.${REF}.supabase.co:5432/postgres`, projeto: "prod", refEsperado: REF }));
  assert.throws(() => conferirOrigem({ url: `postgresql://postgres.${OUTRO}:x@aws-0-us-east-1.pooler.supabase.com:5432/postgres`, projeto: "prod", refEsperado: REF }), /secret trocado/);
  assert.throws(() => conferirOrigem({ url: `postgresql://postgres.${REF}:x@h:5432/postgres`, projeto: "prod", refEsperado: "" }), /BACKUP_REF_ESPERADO/);
  assert.throws(() => conferirOrigem({ url: `postgresql://postgres.${REF}:x@h/postgres`, projeto: "producao", refEsperado: REF }), /desconhecido/);
  assert.throws(() => conferirOrigem({ url: `postgresql://postgres:x@db.${REF}.supabase.co/postgres`, projeto: "sintetico" }), /só lê banco local/);
  assert.doesNotThrow(() => conferirOrigem({ url: "postgresql://postgres:postgres@127.0.0.1:54322/postgres", projeto: "sintetico" }));
  assert.throws(() => conferirOrigem({ url: "https://x.supabase.co", projeto: "prod", refEsperado: REF }), /postgresql/);
});

test("pg_dump: snapshot da transação de leitura, schemas da aplicação + auth, sem sessões e tokens", () => {
  const a = argsPgDump({ arquivo: "/t/d", snapshot: "00000003-1", schemas: ["public", "app", "supabase_migrations"] });
  assert.ok(a.includes("--format=custom") && a.includes("--snapshot=00000003-1"));
  for (const s of ["public", "app", "supabase_migrations", "auth"]) assert.ok(a.includes(`--schema=${s}`), s);
  for (const t of ["sessions", "refresh_tokens", "one_time_tokens", "flow_state", "mfa_amr_claims"]) {
    assert.ok(AUTH_SEM_DADOS.includes(t) && a.includes(`--exclude-table-data=auth.${t}`), t);
  }
  assert.ok(!a.includes("--exclude-table-data=auth.users") && !a.includes("--exclude-table-data=auth.identities"));
  assert.ok(!a.some((x) => /password|PGPASSWORD|:\/\//.test(x)), "sem credencial nos argumentos");
});

// ── trava de destino ──────────────────────────────────────────
test("destino: local só aceita host local; projeto novo só com o ref declarado; hospedado nunca como local", () => {
  assert.deepEqual(conferirUrlAlvo({ url: "postgresql://postgres:p@127.0.0.1:54322/postgres" }), { modo: "local" });
  assert.throws(() => conferirUrlAlvo({ url: `postgresql://postgres:p@db.${REF}.supabase.co/postgres` }), /hospedado/);
  assert.throws(() => conferirUrlAlvo({ url: `postgresql://postgres:p@db.${REF}.supabase.co/postgres`, internos: [`db.${REF}.supabase.co`] }), /hospedado/);
  assert.throws(() => conferirUrlAlvo({ url: "postgresql://postgres:p@10.0.0.5/postgres" }), /não é local/);
  assert.deepEqual(conferirUrlAlvo({ url: "postgresql://postgres:p@172.18.0.4/postgres", internos: ["172.18.0.4"] }), { modo: "local" });
  assert.deepEqual(conferirUrlAlvo({ url: `postgresql://postgres.${OUTRO}:p@aws-0-us-east-1.pooler.supabase.com:5432/postgres`, alvo: OUTRO }), { modo: "hospedado", ref: OUTRO });
  assert.throws(() => conferirUrlAlvo({ url: `postgresql://postgres.${REF}:p@aws-0-sa-east-1.pooler.supabase.com/postgres`, alvo: OUTRO }), /não é do projeto/);
  assert.throws(() => conferirUrlAlvo({ url: "postgresql://postgres:p@127.0.0.1/postgres", alvo: "producao" }), /20 letras/);
});

// ── pós-restore: event triggers e cron ────────────────────────
const MANIFESTO = {
  event_triggers: [{ nome: "ensure_rls", evento: "ddl_command_end", tags: null, habilitado: "O", funcao_schema: "public", funcao: "rls_auto_enable" }],
  cron: [
    { jobname: "virar-semana-diaria", schedule: "5 3 * * *", command: "select app.virar_semana();", active: true },
    { jobname: "avisar", schedule: "0 * * * *", command: "select net.http_post('https://x.supabase.co/functions/v1/a')", active: true },
  ],
};
test("pós-restore: recria o ensure_rls e os jobs; no ensaio tudo desligado, no retorno só o que chama fora", () => {
  const ens = sqlPosRestauro(MANIFESTO, { cron: "inativo" });
  assert.match(ens.sql, /create event trigger "ensure_rls" on "ddl_command_end" execute function "public"\."rls_auto_enable"\(\);/);
  assert.match(ens.sql, /create extension if not exists pg_cron;/);
  assert.equal((ens.sql.match(/active := false/g) ?? []).length, 2);
  assert.deepEqual(ens.externos, ["avisar"]);
  const ret = sqlPosRestauro(MANIFESTO, { cron: "ativo" });
  assert.equal((ret.sql.match(/active := false/g) ?? []).length, 1, "só o job com chamada externa nasce desligado");
  assert.match(ret.sql, /where jobname = 'avisar'\), active := false/);
  assert.ok(CHAMADA_EXTERNA.test("select net.http_get(1)") && !CHAMADA_EXTERNA.test("select app.virar_semana()"));
  assert.match(sqlPosRestauro({ cron: [{ jobname: "a'b", schedule: "* * * * *", command: "select 'x'", active: true }] }).sql,
    /cron\.schedule\('a''b', '\* \* \* \* \*', 'select ''x'''\)/, "aspas escapadas");
});

// ── comparação origem × destino ───────────────────────────────
const retrato = () => ({
  postgres: { versao: "17.6", versao_num: 170006, major: 17 },
  schemas: ["app", "public"],
  ultima_migration: { version: "20260924204724", name: "0058_escolas_colunas_por_papel" },
  ledger_linhas: 60,
  contagens: { "public.alunos": 60, "auth.users": 88 },
  estrutura: {
    acl_funcoes: { n: 1, hash: "a", itens: ["public.resumo_escola() authenticated:EXECUTE,service_role:EXECUTE"] },
    sequencias: { n: 1, hash: "s", itens: ["public.logs_acesso_id_seq last=4242 called=true"] },
  },
  cron: [{ jobname: "virar-semana-diaria", schedule: "5 3 * * *", command: "select app.virar_semana();", active: true }],
  event_triggers: [{ nome: "ensure_rls", evento: "ddl_command_end", tags: null, habilitado: "O", funcao_schema: "public", funcao: "rls_auto_enable" }],
});
const destinoOk = () => { const d = retrato(); d.cron[0].active = false; return d; };

test("comparar: destino igual passa; o ensaio espera o cron desligado", () => {
  assert.equal(comparar(retrato(), destinoOk()).ok, true);
  assert.equal(comparar(retrato(), retrato()).ok, false, "job ligado no ensaio reprova");
  assert.equal(comparar(retrato(), retrato(), { cron: "ativo" }).ok, true);
});

test("comparar: anon com EXECUTE a mais (o restore ingênuo) reprova e aponta a função", () => {
  const d = destinoOk();
  d.estrutura.acl_funcoes = { n: 1, hash: "b", itens: ["public.resumo_escola() anon:EXECUTE,authenticated:EXECUTE,service_role:EXECUTE"] };
  const r = comparar(retrato(), d);
  assert.equal(r.ok, false);
  const div = r.divergencias.find((x) => x.categoria === "estrutura.acl_funcoes");
  assert.match(div.detalhe.sobram[0], /anon:EXECUTE/);
});

test("comparar: linha a menos, ledger, event trigger ou job ausente reprovam; tabela nova e vazia do Auth não", () => {
  const casos = [
    (d) => { d.contagens["public.alunos"] = 59; },
    (d) => { d.ultima_migration = null; },
    (d) => { d.event_triggers = []; },
    (d) => { d.cron = []; },
    (d) => { delete d.contagens["auth.users"]; },
  ];
  for (const muda of casos) { const d = destinoOk(); muda(d); assert.equal(comparar(retrato(), d).ok, false, muda.toString()); }
  const d = destinoOk(); d.contagens["auth.tabela_nova_do_gotrue"] = 0;
  assert.equal(comparar(retrato(), d).ok, true);
});

test("comparar --redigir: sem contagem e sem valor de sequência no log público", () => {
  const d = destinoOk(); d.contagens["public.alunos"] = 59;
  d.estrutura.sequencias = { n: 1, hash: "t", itens: ["public.logs_acesso_id_seq last=4000 called=true"] };
  const texto = JSON.stringify(redigir(comparar(retrato(), d)));
  assert.doesNotMatch(texto, /59|60|88|4242|4000/);
  assert.match(texto, /public\.alunos/);
});

// ── a matriz no banco restaurado ──────────────────────────────
test("matriz: o banco postgres local só vale com o id do ensaio; hospedado nunca", () => {
  assert.throws(() => conferirAlvoLocal({ host: "127.0.0.1", database: "postgres" }), /só roda em Postgres local/);
  assert.doesNotThrow(() => conferirAlvoLocal({ host: "127.0.0.1", database: "postgres", ensaioRestauro: "ensaio-restauro-x" }));
  assert.throws(() => conferirAlvoLocal({ host: `db.${REF}.supabase.co`, database: "postgres", ensaioRestauro: "x" }), /só roda em Postgres local/);
  assert.throws(() => conferirAlvoLocal({ host: "127.0.0.1", database: "outro", ensaioRestauro: "x" }), /só roda em Postgres local/);
});

test("o relatório lista o que o backup não cobre", () => {
  const itens = NAO_COBERTO.map(([i]) => i).join(" | ");
  for (const i of ["Storage", "Secrets das Edge Functions", "Configuração do Auth", "Vercel"]) assert.match(itens, new RegExp(i));
});

test("conexão do pg: TLS fora da máquina (como o prefer do pg_dump), sslmode da URL removido, local sem TLS", async () => {
  const { configCliente } = await import("../scripts/backup/metadados.mjs");
  const remoto = configCliente(`postgresql://postgres.${REF}:s@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require`);
  assert.deepEqual(remoto.ssl, { rejectUnauthorized: false });
  assert.doesNotMatch(remoto.connectionString, /sslmode/);
  assert.equal(configCliente("postgresql://postgres:postgres@127.0.0.1:54322/postgres").ssl, undefined);
});
