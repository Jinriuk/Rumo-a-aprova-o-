// ============================================================
// ONDA 8 — A VITRINE NÃO PODE ENVELHECER SOZINHA
// ------------------------------------------------------------
// O achado que reenquadrou a onda: o seed da vitrine (13) foi escrito
// em junho/2026 com datas ABSOLUTAS, enquanto os seeds de dev (02, 03)
// sempre foram rolantes. E ninguém percebeu por três meses porque o 13
// escrevia em `auth.users`, então o reset-db.sh pulava o arquivo
// INTEIRO — a base da vitrine (60 alunos, registros, metas, simulados)
// ficava fora do CI, sem um único teste.
//
// Em 17/09/2026 o resultado medido no demo era: 455 de 457 registros
// com mais de 90 dias, trilha encerrada em 01/08, zero meta ativa. A
// peça de venda amanhecia morta, e vários "defeitos" das Ondas 5, 6 e 7
// eram sintoma disso.
//
// A parte de Auth saiu para o seed 21; o 13 virou 100% schema público e
// roda aqui. Estes testes são a guarda para o congelamento não voltar
// em silêncio: eles falham se alguém recravar data, se a vitrine ficar
// sem semana vigente, ou se o seed voltar a depender de estado de
// ambiente que ele mesmo não cria.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./identidades.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const ler = (p) => readFileSync(resolve(root, p), "utf8");
const semComentarios = (fonte) => fonte
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:\\])--.*$/gm, "$1");

const VITRINE = "11111111-1111-4111-8111-111111111111";

test.after(async () => { await pool.end(); });

// ── o invariante que importa: a vitrine está viva HOJE ──────────────
test("vitrine: existe semana de trilha vigente hoje", async () => {
  const r = await pool.query(
    `select count(*)::int as n from trilha_semanas
      where app.hoje_local() between inicio and fim`);
  assert.ok(r.rows[0].n >= 1,
    "nenhuma semana cobre hoje — a trilha venceu, que é exatamente como a vitrine morreu em agosto/2026");
});

test("vitrine: há registro de estudo recente (a peça de venda não amanhece parada)", async () => {
  const r = await pool.query(
    `select count(*)::int as n from registros_estudo
      where escola_id = $1 and data >= app.hoje_local() - 7`, [VITRINE]);
  assert.ok(r.rows[0].n >= 1,
    "nenhum registro nos últimos 7 dias na vitrine — foi este o estado que a Onda 8 encontrou (455 de 457 com +90 dias)");
});

test("vitrine: os alunos com semana vigente têm meta aberta", async () => {
  const r = await pool.query(
    `select count(*)::int as n
       from alunos a
       join trilha_semanas ts on ts.trilha_id = a.trilha_id
                             and app.hoje_local() between ts.inicio and ts.fim
      where a.escola_id = $1
        and not exists (select 1 from metas m
                         where m.aluno_id = a.id and m.status = 'ativa'
                           and m.semana_numero = ts.numero)`, [VITRINE]);
  // o seed cria meta só para os perfis com atividade; o que não pode é
  // a vitrine INTEIRA ficar descoberta, que é o sintoma do A3.
  const total = await pool.query(
    "select count(*)::int as n from alunos where escola_id = $1 and trilha_id is not null", [VITRINE]);
  assert.ok(r.rows[0].n < total.rows[0].n,
    "todos os alunos da vitrine estão sem meta aberta — o painel amanhece vazio");
});

// ── A6: tempo por questão precisa ser plausível ────────────────────
test("A6: nenhum registro da vitrine gasta mais de 5 minutos por questão", async () => {
  const r = await pool.query(
    `select count(*)::int as n, coalesce(max(round(minutos::numeric/questoes,1)),0) as pior
       from registros_estudo
      where escola_id = $1 and questoes > 0 and minutos::numeric / questoes > 5`, [VITRINE]);
  assert.equal(r.rows[0].n, 0,
    `registros implausíveis na vitrine (pior caso: ${r.rows[0].pior} min/questão). ` +
    "O gerador usava minutos fixos (45 + i%3*15) independentes do volume de questões.");
});

test("A6: o gerador deriva os minutos do número de questões, não de uma constante", () => {
  const seed = semComentarios(ler("supabase/seed/13_vitrine_militar_demo.sql"));
  assert.doesNotMatch(seed, /45 \+ \(i % 3\) \* 15/,
    "voltou a constante de minutos independente de questoes");
  assert.match(seed, /v_min := round\(v_qtd \* /,
    "os minutos precisam ser função de v_qtd");
});

// ── calendário rolante: a causa raiz ───────────────────────────────
test("o seed da vitrine não tem data absoluta em código executável", () => {
  const seed = semComentarios(ler("supabase/seed/13_vitrine_militar_demo.sql"));
  const literais = seed.match(/'20\d\d-\d\d-\d\d'/g) ?? [];
  assert.deepEqual(literais, [],
    `datas cravadas encontradas: ${literais.join(", ")} — foi assim que a vitrine congelou em junho`);
  assert.match(seed, /app\.hoje_local\(\)/, "as datas precisam ser ancoradas no dia corrente");
});

test("as metas da vitrine saem da trilha_semanas, não de datas próprias", () => {
  const seed = semComentarios(ler("supabase/seed/13_vitrine_militar_demo.sql"));
  assert.match(seed, /from trilha_semanas where trilha_id = v_trilha and numero = 1/,
    "as semanas devem vir da trilha (fonte única, reancorada pelo seed 02)");
});

// ── o seed precisa ser auto-contido (não depender do demo) ─────────
test("o seed da vitrine cria as turmas e os alunos base que ele usa", () => {
  const seed = semComentarios(ler("supabase/seed/13_vitrine_militar_demo.sql"));
  assert.match(seed, /insert into turmas[\s\S]{0,400}aa000000-0000-4000-8000-000000000001/,
    "as turmas aa000000-… eram pressupostas; nenhum seed as criava");
  assert.match(seed, /create temp table _vit_base/,
    "os alunos 002–022 eram tratados como existentes, mas nenhum seed os criava");
});

test("o seed resolve concurso por código, nunca por id de ambiente", () => {
  const seed = semComentarios(ler("supabase/seed/13_vitrine_militar_demo.sql"));
  assert.match(seed, /update _vit_novos n\s*\n\s*set concurso_id = c\.id\s*\n\s*from concursos c\s*\n\s*where c\.codigo = n\.examtag/,
    "o id do EsSA estava cravado como '822b1ccf-…', que só existia no banco do demo");
});

// ── S1: código não é senha, nem depois de um reseed ────────────────
test("S1: nenhum seed grava a senha igual ao código de acesso", () => {
  // Não basta olhar o NOME da variável: o seed 04 sempre chamou a coluna
  // de `senha`, mas o VALOR era o código. O teste precisa casar o valor.
  const s04 = semComentarios(ler("supabase/seed/04_usuarios_auth_dev.sql"));
  for (const codigo of ["LUCASDEMO2026", "RESPDEMO2026X", "BRUNODEMO2026", "RESPBETA2026XX"]) {
    assert.ok(
      !new RegExp(`'${codigo}'\\s*,`).test(s04),
      `04: '${codigo}' aparece como valor de senha — é o S1 renascendo a cada reseed`,
    );
    assert.match(s04, new RegExp(`'${codigo.toLowerCase()}@codigo\\.acesso\\.local'`),
      `04: o e-mail derivado do código ${codigo} deve continuar existindo (o código identifica)`);
  }
  assert.match(s04, /crypt\(u\.senha, gen_salt\('bf'\)\)/, "04: a senha continua sendo gravada com bcrypt");

  const s21 = semComentarios(ler("supabase/seed/21_vitrine_contas_auth.sql"));
  assert.doesNotMatch(s21, /crypt\(\s*v_codigo\s*,/,
    "21: a senha dos alunos da vitrine não pode ser derivada do código");
  assert.match(s21, /crypt\('triliva-cenario-2026'/, "21: senha de cenário, distinta do código");
});

test("S1: as contas de login de demonstração exigem troca no primeiro acesso", () => {
  const seed = semComentarios(ler("supabase/seed/01_escolas_dev.sql"));
  assert.match(seed, /insert into usuarios \(id, escola_id, papel, nome, must_change_password\)/,
    "as contas por código precisam nascer com must_change_password");
  const linhasAluno = seed.split("\n").filter((l) => /'(aluno|responsavel)'/.test(l));
  assert.ok(linhasAluno.length >= 4, "esperava as 4 contas por código");
  for (const l of linhasAluno) {
    assert.match(l, /true\)?,?\s*$/, `conta por código sem troca obrigatória: ${l.trim()}`);
  }
});

// ── A10 / A12: sujeira que só existe no demo não pode voltar pelo seed
test("A10: o seed não deixa aluno da vitrine sem conta de usuário", async () => {
  const r = await pool.query(
    "select count(*)::int as n from alunos where escola_id = $1 and usuario_id is null", [VITRINE]);
  assert.equal(r.rows[0].n, 0, "aluno sem usuario_id não renderiza direito na lista da coordenação");
});

test("A12: nenhum seed cria usuário com nome de teste", () => {
  for (const arquivo of ["supabase/seed/01_escolas_dev.sql",
                         "supabase/seed/13_vitrine_militar_demo.sql",
                         "supabase/seed/17_qa1_demo_pedagogia.sql"]) {
    const seed = semComentarios(ler(arquivo));
    assert.doesNotMatch(seed, /'porg'|'teste'|'asdf'|'xxx'/i,
      `${arquivo} tem nome de teste — na vitrine isso aparece para o prospecto`);
  }
});
