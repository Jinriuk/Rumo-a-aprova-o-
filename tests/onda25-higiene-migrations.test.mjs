// ============================================================
// ONDA 2.5 — higiene de migrations e paridade por SCHEMA
// ------------------------------------------------------------
// Contexto medido em 13/09/2026:
//
//   repo:      49 arquivos de migration (numerados até 0048)
//   demo:      48 linhas no ledger
//   produção:   3 linhas no ledger
//
// E, apesar disso, o SCHEMA de produção é idêntico ao que as 49
// migrations produzem — conferido nas 5 seções (tabelas, colunas,
// policies, funções de negócio, índices), hash a hash. Produção foi
// criada em 03/09 a partir do demo: veio o schema, não veio a tabela
// de ledger.
//
// Ou seja: `checar-migrations.mjs` acusaria 47 migrations "faltando"
// em produção e mandaria não publicar o front — todas falsas. Ledger
// responde "foi registrado?"; schema responde "o banco tem?". São
// perguntas diferentes e o backlog (BKL-017) já pedia a segunda.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dirMigr = resolve(root, "supabase/migrations");
const arquivos = readdirSync(dirMigr).filter((f) => f.endsWith(".sql")).sort();

const PREFIXOS_DUPLICADOS_CONHECIDOS = new Set(["0047"]);

test("migrations: nenhum prefixo NNNN duplicado NOVO", () => {
  // O `0047` já é usado por duas migrations, e as duas já estão
  // aplicadas e registradas pelo nome completo nos dois ambientes.
  // Renomear arquivo aplicado quebraria o casamento com o ledger e
  // criaria drift novo — por isso a duplicata existente é tolerada e
  // fica registrada aqui. O que este teste impede é a ambiguidade
  // CRESCER: qualquer prefixo duplicado novo falha.
  const porPrefixo = new Map();
  for (const f of arquivos) {
    const prefixo = f.slice(0, 4);
    if (!/^\d{4}$/.test(prefixo)) continue;
    (porPrefixo.get(prefixo) ?? porPrefixo.set(prefixo, []).get(prefixo)).push(f);
  }
  const duplicados = [...porPrefixo.entries()].filter(([, fs]) => fs.length > 1);
  const novos = duplicados.filter(([p]) => !PREFIXOS_DUPLICADOS_CONHECIDOS.has(p));
  assert.deepEqual(
    novos, [],
    `prefixo de migration duplicado: ${novos.map(([p, fs]) => `${p} → ${fs.join(", ")}`).join(" | ")}`,
  );
});

test("migrations: a numeração é contígua a partir de 0001", () => {
  const numeros = [...new Set(arquivos.map((f) => f.slice(0, 4)).filter((p) => /^\d{4}$/.test(p)))]
    .map(Number).sort((a, b) => a - b);
  assert.equal(numeros[0], 1, "a série começa em 0001");
  const buracos = [];
  for (let i = 1; i < numeros.length; i++) {
    if (numeros[i] !== numeros[i - 1] + 1) buracos.push(`${numeros[i - 1]} → ${numeros[i]}`);
  }
  assert.deepEqual(buracos, [], `buraco na numeração de migrations: ${buracos.join(", ")}`);
});

test("migrations: todo arquivo segue NNNN_nome_em_snake_case.sql", () => {
  const fora = arquivos.filter((f) => !/^\d{4}_[a-z0-9_]+\.sql$/.test(f));
  assert.deepEqual(fora, [], `nome de migration fora do padrão: ${fora.join(", ")}`);
});

// ── as duas ferramentas de operador precisam ser EXECUTÁVEIS ────────────────
test("checar-migrations resolve `pg` de qualquer diretório", () => {
  // Achado da Onda 2.5: `checar-migrations.mjs` mandava rodar
  // "cd tests && node ../scripts/checar-migrations.mjs" e isso NUNCA
  // funcionou — em ESM o import nu resolve pelo diretório do módulo
  // (scripts/), não pelo cwd (tests/), e `pg` só existe em
  // tests/node_modules. A ferramenta de paridade em que o backlog se
  // apoia não era executável pela instrução dela mesma, o que ajuda a
  // explicar o ledger de produção ter ficado em 3 de 49 sem ninguém
  // tropeçar.
  const src = readFileSync(resolve(root, "scripts/checar-migrations.mjs"), "utf8");
  assert.match(src, /carregarPg\(\)/, "precisa usar o carregador de _pg.mjs");
  assert.doesNotMatch(
    src, /\(\{ Client \} = await import\("pg"\)\)/,
    'o import nu de "pg" volta a falhar fora de um diretório com node_modules/pg',
  );
  const pgHelper = readFileSync(resolve(root, "scripts/_pg.mjs"), "utf8");
  assert.match(pgHelper, /tests/, "o fallback resolve a partir de tests/node_modules");
});

test("checar-migrations avisa que responde pelo LEDGER, não pelo schema", () => {
  // Sem esse aviso, um operador lê "FALTAM aplicar 47" e conclui que o
  // banco está atrasado, quando o schema está completo.
  const src = readFileSync(resolve(root, "scripts/checar-migrations.mjs"), "utf8");
  assert.match(src, /impressao-schema\.mjs/, "precisa apontar a ferramenta que responde pelo schema");
  assert.match(src, /LEDGER/, "precisa dizer qual pergunta ele responde");
});

test("fingerprint-schema ordena com collate \"C\" (armadilha de collation)", () => {
  // `order by item` usa o collation do BANCO. Medido em 13/09/2026:
  // produção e demo em en_US.UTF-8, o banco local do reset-db.sh em
  // C.UTF-8. Ordens diferentes, hash diferente, schema IDÊNTICO — o
  // script mediria o observador, não o objeto. Sem `collate "C"` a
  // comparação mais valiosa (o que o REPO produz × o que produção TEM)
  // é a que quebra.
  const src = readFileSync(resolve(root, "scripts/fingerprint-schema.sql"), "utf8");
  // Só o SQL interessa: "order by" aparece de propósito no comentário
  // que explica a armadilha. E um order by de hash atravessa linhas,
  // então o espaço é normalizado antes de olhar.
  const soSql = src
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join(" ")
    .replace(/\s+/g, " ");
  const ordenacoesDeHash = [...soSql.matchAll(/order by .{0,80}/gi)].map((m) => m[0]);
  assert.ok(ordenacoesDeHash.length >= 2, "esperava as ordenações do string_agg");
  for (const o of ordenacoesDeHash) {
    assert.match(o, /collate "C"/, `ordenação sem collate "C": ${o.slice(0, 70)}`);
  }
  assert.match(src, /COLLATION/i, "a armadilha fica documentada no cabeçalho");
});

test("fingerprint-schema exclui funções de EXTENSÃO", () => {
  // Num Postgres vanilla `create extension` põe as funções em `public`
  // (pgcrypto, uuid-ossp...); no Supabase elas vivem em `extensions`.
  // Sem excluir, eram 98 funções no local contra 62 em produção —
  // nenhuma delas do produto.
  const src = readFileSync(resolve(root, "scripts/fingerprint-schema.sql"), "utf8");
  const ocorrencias = [...src.matchAll(/deptype = 'e'/g)];
  assert.ok(
    ocorrencias.length >= 2,
    "as categorias funcoes e acl_funcoes precisam excluir o que pertence a extensão",
  );
});

