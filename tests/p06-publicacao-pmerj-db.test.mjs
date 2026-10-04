// ============================================================
// P0.6 — publicação da trilha CFO PMERJ, no Postgres
// ------------------------------------------------------------
// Roda o que a operação roda, na ordem em que roda: o SQL do gerador
// (turma 1, início 2026-10-05, --publicada) e, depois, o carimbo
// 'pre_edital' do seed 18. Confere:
//   • o resultado (concurso sem data e pre_edital, 219 assuntos, 24
//     missões, 12 semanas de segunda a domingo, trilha publicada);
//   • o diff restrito ao escopo: nada fora do PMERJ muda de conteúdo;
//   • que repetir a publicação e o carimbo não muda nada;
//   • a reversão (docs/operacao/reversao/p06-pmerj-cfo.sql): devolve o
//     estado anterior, e recusa quando o PMERJ do banco já não é só o
//     da P0.6 (aluno, turma posterior, prova, missão a mais).
// Tudo numa transação desfeita no fim.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool, ESCOLA_A } from "./identidades.mjs";
import { carregarFonte, gerarSql } from "../scripts/gerar-seed-trilha-pmerj-cfo.mjs";

test.after(async () => { await pool.end(); });

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const lerArquivo = (rel) => readFileSync(join(RAIZ, rel), "utf8");
const semTransacao = (sql) => sql.replace(/^begin;$/m, "").replace(/^commit;$/m, "");

const PUBLICACAO = semTransacao(gerarSql(carregarFonte(), { inicio: "2026-10-05", turma: 1, publicada: true }));
const CARIMBO = lerArquivo("supabase/seed/18_maturidade_concursos.sql")
  .match(/update concursos set maturidade = 'pre_edital'[^;]*;/)?.[0];
const REVERSAO = semTransacao(lerArquivo("docs/operacao/reversao/p06-pmerj-cfo.sql"));

async function emTransacao(fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    return await fn(c);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

// aluno próprio, criado dentro da transação
const ALUNO = "ae000000-0000-4000-8000-00000000c060";

// O que existia antes e não é do PMERJ: hash do conteúdo de cada tabela
// do escopo, sem as linhas do PMERJ.
const FORA_DO_ESCOPO = {
  concursos: "select * from concursos where codigo <> 'pmerj_cfo'",
  materias: "select * from materias where codigo not like 'dir\\_%'",
  assuntos: "select * from assuntos where exam_tag <> 'pmerj_cfo'",
  missoes: "select * from missoes where exam_tag <> 'pmerj_cfo'",
  trilha_planos: "select * from trilha_planos where exam_tag <> 'pmerj_cfo'",
  trilha_plano_missoes: "select p.* from trilha_plano_missoes p join missoes m on m.id = p.missao_id where m.exam_tag <> 'pmerj_cfo'",
  trilhas: "select * from trilhas where nicho <> 'pmerj-cfo'",
  disciplinas: "select d.* from disciplinas d join trilhas t on t.id = d.trilha_id where t.nicho <> 'pmerj-cfo'",
  trilha_semanas: "select s.* from trilha_semanas s join trilhas t on t.id = s.trilha_id where t.nicho <> 'pmerj-cfo'",
  atividades_modelo: "select a.* from atividades_modelo a join trilhas t on t.id = a.trilha_id where t.nicho <> 'pmerj-cfo'",
  alunos: "select * from alunos",
};
async function foraDoEscopo(c) {
  const out = {};
  for (const [tabela, q] of Object.entries(FORA_DO_ESCOPO)) {
    out[tabela] = (await c.query(`select count(*)::int n, coalesce(md5(string_agg(x::text, '|' order by x::text)), '') h from (${q}) x`)).rows[0];
  }
  return out;
}

const publicar = async (c) => {
  await c.query(PUBLICACAO);
  const r = await c.query(CARIMBO);
  assert.equal(r.rowCount, 1, "o carimbo precisa atingir exatamente o concurso PMERJ");
};

test("o carimbo e a reversão existem e são de um comando só", () => {
  assert.ok(CARIMBO, "o seed 18 não tem o carimbo do PMERJ");
  assert.equal((CARIMBO.match(/;/g) ?? []).length, 1);
  assert.match(REVERSAO, /delete from trilhas where nicho = 'pmerj-cfo'/);
});

test("publicar: concurso pre_edital sem data, 219 assuntos, 24 missões, 12 semanas, trilha publicada", async () => {
  await emTransacao(async (c) => {
    await publicar(c);

    const conc = (await c.query(
      "select nome, mes_prova, dia_prova, maturidade, conteudo_versao, status_dado from concursos where codigo = 'pmerj_cfo'")).rows;
    assert.deepEqual(conc, [{
      nome: "CFO PMERJ, preparação pré-edital", mes_prova: null, dia_prova: null,
      maturidade: "pre_edital", conteudo_versao: 1, status_dado: "inferencia",
    }]);

    const n = async (q) => Number((await c.query(q)).rows[0].n);
    assert.equal(await n("select count(*) n from concursos"), 7);
    assert.equal(await n("select count(*) n from assuntos where exam_tag = 'pmerj_cfo'"), 219);
    assert.equal(await n("select count(*) n from missoes where exam_tag = 'pmerj_cfo'"), 24);
    assert.equal(await n("select count(*) n from materias where codigo like 'dir\\_%'"), 6);
    assert.equal(await n("select count(*) n from trilha_planos where exam_tag = 'pmerj_cfo'"), 1);
    assert.equal(await n("select count(*) n from trilha_plano_missoes p join missoes m on m.id = p.missao_id where m.exam_tag = 'pmerj_cfo'"), 24);
    assert.equal(await n("select count(*) n from disciplinas d join trilhas t on t.id = d.trilha_id where t.nicho = 'pmerj-cfo'"), 8);
    assert.equal(await n("select count(*) n from atividades_modelo a join trilhas t on t.id = a.trilha_id where t.nicho = 'pmerj-cfo'"), 159);

    const trilhas = (await c.query("select nome, versao, publicada from trilhas where nicho = 'pmerj-cfo'")).rows;
    assert.deepEqual(trilhas, [{ nome: "CFO PMERJ, preparação pré-edital", versao: 1, publicada: true }]);

    const semanas = (await c.query(
      `select s.numero, s.inicio::text, s.fim::text, extract(isodow from s.inicio)::int dow
         from trilha_semanas s join trilhas t on t.id = s.trilha_id where t.nicho = 'pmerj-cfo' order by s.numero`)).rows;
    assert.equal(semanas.length, 12);
    assert.deepEqual([semanas[0].inicio, semanas[0].fim], ["2026-10-05", "2026-10-11"]);
    assert.deepEqual([semanas[11].inicio, semanas[11].fim], ["2026-12-21", "2026-12-27"]);
    assert.ok(semanas.every((s) => s.dow === 1), "toda semana começa numa segunda-feira");
    semanas.slice(1).forEach((s, i) => assert.equal(
      (new Date(`${s.inicio}T00:00:00Z`) - new Date(`${semanas[i].fim}T00:00:00Z`)) / 86_400_000, 1, `sem lacuna antes da semana ${s.numero}`));

    // as missões saem só das semanas 1 a 4
    const porSemana = (await c.query(
      `select p.semana_sugerida s, count(*)::int n from trilha_plano_missoes p join missoes m on m.id = p.missao_id
        where m.exam_tag = 'pmerj_cfo' group by 1 order by 1`)).rows;
    assert.deepEqual(porSemana, [{ s: 1, n: 6 }, { s: 2, n: 6 }, { s: 3, n: 6 }, { s: 4, n: 6 }]);

    // a view de qualidade (0034/0062) não flagra o concurso
    const q = (await c.query(
      "select maturidade, n_assuntos, n_missoes, n_planos, suspeita_incoerencia from vw_concurso_qualidade where codigo = 'pmerj_cfo'")).rows[0];
    assert.deepEqual(q, { maturidade: "pre_edital", n_assuntos: 219, n_missoes: 24, n_planos: 1, suspeita_incoerencia: false });
  });
});

test("diff restrito ao escopo: nada fora do PMERJ muda; repetir não muda nada", async () => {
  await emTransacao(async (c) => {
    const antes = await foraDoEscopo(c);
    await publicar(c);
    assert.deepEqual(await foraDoEscopo(c), antes);

    const aposPrimeira = (await c.query(
      "select (select count(*) from assuntos where exam_tag = 'pmerj_cfo') a, (select count(*) from missoes where exam_tag = 'pmerj_cfo') m, (select count(*) from trilha_semanas) s, (select count(*) from atividades_modelo) at, (select count(*) from trilhas) t")).rows[0];
    await publicar(c);
    const aposSegunda = (await c.query(
      "select (select count(*) from assuntos where exam_tag = 'pmerj_cfo') a, (select count(*) from missoes where exam_tag = 'pmerj_cfo') m, (select count(*) from trilha_semanas) s, (select count(*) from atividades_modelo) at, (select count(*) from trilhas) t")).rows[0];
    assert.deepEqual(aposSegunda, aposPrimeira);
    assert.deepEqual(await foraDoEscopo(c), antes);
  });
});

test("reversão: recusa o que não é da P0.6 (aluno, turma posterior, prova, missão a mais); sem isso, devolve o estado anterior", async () => {
  await emTransacao(async (c) => {
    const antes = await foraDoEscopo(c);
    await publicar(c);
    const trilha = (await c.query("select id from trilhas where nicho = 'pmerj-cfo'")).rows[0].id;
    const intactoAposRecusa = async () => {
      const n = Number((await c.query(
        `select (select count(*) from trilhas where nicho = 'pmerj-cfo') + (select count(*) from concursos where codigo = 'pmerj_cfo')
              + (select count(*) from assuntos where exam_tag = 'pmerj_cfo') + (select count(*) from missoes where exam_tag = 'pmerj_cfo') n`)).rows[0].n);
      return n;
    };
    const base = await intactoAposRecusa();
    const recusa = async (preparar, esperado) => {
      await c.query("savepoint s");
      await preparar();
      await assert.rejects(c.query(REVERSAO), esperado);
      await c.query("rollback to savepoint s");
      assert.equal(await intactoAposRecusa(), base, "a recusa não apaga nada");
    };

    // aluno na trilha
    await recusa(
      () => c.query("insert into alunos (id, escola_id, nome, trilha_id) values ($1, $2, 'Aluno P0.6 de teste', $3)", [ALUNO, ESCOLA_A, trilha]),
      /reversão recusada: 1 linha\(s\) de alunos apontam para trilhas\.trilha_id do PMERJ/);
    // aluno só no concurso (a lista de tabelas não é fixa: a busca vem do catálogo)
    await recusa(
      async () => {
        const conc = (await c.query("select id from concursos where codigo = 'pmerj_cfo'")).rows[0].id;
        await c.query("insert into alunos (id, escola_id, nome, concurso_id) values ($1, $2, 'Aluno P0.6 de teste', $3)", [ALUNO, ESCOLA_A, conc]);
      },
      /reversão recusada: 1 linha\(s\) de alunos apontam para concursos\.concurso_id do PMERJ/);
    // turma posterior
    await recusa(
      () => c.query(semTransacao(gerarSql(carregarFonte(), { inicio: "2027-01-04", turma: 2 }))),
      /reversão recusada: 1 turma\(s\) do PMERJ além da turma 1/);
    // prova cadastrada depois: nenhuma regra específica da reversão a conhece
    await recusa(
      () => c.query("insert into provas (exam_tag, nome) values ('pmerj_cfo', 'Prova cadastrada depois')"),
      /reversão recusada: 1 linha\(s\) de provas apontam para concursos\.exam_tag do PMERJ/);
    // missão escrita depois (por exemplo, das semanas 5 a 12)
    await recusa(
      () => c.query(`insert into missoes (exam_tag, materia_codigo, nivel, nome, objetivo, criterio_conclusao)
                     values ('pmerj_cfo', 'dir_hum', 'base', 'Missão da semana 5', 'x', 'x')`),
      /reversão recusada: 25 missões do PMERJ, a P0.6 criou 24/);

    // estado exatamente o da publicação: reverte e devolve o anterior
    await c.query(REVERSAO);
    const resto = (await c.query(
      `select (select count(*) from concursos where codigo = 'pmerj_cfo') c, (select count(*) from assuntos where exam_tag = 'pmerj_cfo') a,
              (select count(*) from missoes where exam_tag = 'pmerj_cfo') m, (select count(*) from trilhas where nicho = 'pmerj-cfo') t,
              (select count(*) from materias where codigo like 'dir\\_%') d`)).rows[0];
    assert.deepEqual(resto, { c: "0", a: "0", m: "0", t: "0", d: "0" });
    assert.deepEqual(await foraDoEscopo(c), antes);
  });
});
