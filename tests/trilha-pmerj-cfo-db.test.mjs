// ============================================================
// P0.3 — SQL gerado da trilha CFO PMERJ, no Postgres
// ------------------------------------------------------------
//   • rodar duas vezes não duplica nada;
//   • "Nova turma: datas de turma anterior não mudam" (seção 12);
//   • mesma turma com outro início é RECUSADA;
//   • turma com meta já gerada aceita o SQL de novo (nada é apagado);
//   • a fila do motor vê só as missões automáticas, na ordem das semanas;
//   • o SQL não carimba maturidade nem inventa data de prova.
// Tudo dentro de uma transação desfeita no fim: o banco de teste não
// fica com o PMERJ (os outros arquivos de teste rodam em paralelo).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, ESCOLA_A } from "./identidades.mjs";
import { carregarFonte, gerarSql } from "../scripts/gerar-seed-trilha-pmerj-cfo.mjs";

test.after(async () => { await pool.end(); });

const M = carregarFonte();
// o SQL abre e fecha a própria transação; aqui ele roda dentro da do teste
const semTransacao = (sql) => sql.replace(/^begin;$/m, "").replace(/^commit;$/m, "");
const turma = (inicio, n, opcoes = {}, manifesto = M) => semTransacao(gerarSql(manifesto, { inicio, turma: n, ...opcoes }));

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

// aluno próprio, criado dentro da transação: não trava a linha de um
// aluno do seed que outro arquivo de teste usa ao mesmo tempo.
const ALUNO = "ae000000-0000-4000-8000-00000000c0f0";
async function criarAluno(c, campos = {}) {
  await c.query("insert into alunos (id, escola_id, nome, trilha_id, concurso_id) values ($1, $2, 'Aluno PMERJ de teste', $3, $4)",
    [ALUNO, ESCOLA_A, campos.trilha_id ?? null, campos.concurso_id ?? null]);
}

async function contagens(c) {
  const um = async (q) => Number((await c.query(q)).rows[0].n);
  return {
    concursos: await um("select count(*) n from concursos where codigo = 'pmerj_cfo'"),
    materias: await um("select count(*) n from materias where codigo like 'dir\\_%'"),
    assuntos: await um("select count(*) n from assuntos where exam_tag = 'pmerj_cfo'"),
    missoes: await um("select count(*) n from missoes where exam_tag = 'pmerj_cfo'"),
    planos: await um("select count(*) n from trilha_planos where exam_tag = 'pmerj_cfo'"),
    planoMissoes: await um("select count(*) n from trilha_plano_missoes p join missoes m on m.id = p.missao_id where m.exam_tag = 'pmerj_cfo'"),
    trilhas: await um("select count(*) n from trilhas where nicho = 'pmerj-cfo'"),
    disciplinas: await um("select count(*) n from disciplinas d join trilhas t on t.id = d.trilha_id where t.nicho = 'pmerj-cfo'"),
    semanas: await um("select count(*) n from trilha_semanas s join trilhas t on t.id = s.trilha_id where t.nicho = 'pmerj-cfo'"),
    atividades: await um("select count(*) n from atividades_modelo a join trilhas t on t.id = a.trilha_id where t.nicho = 'pmerj-cfo'"),
  };
}

const semanasDa = async (c, versao) => (await c.query(
  `select s.numero, s.inicio::text, s.fim::text from trilha_semanas s join trilhas t on t.id = s.trilha_id
    where t.nicho = 'pmerj-cfo' and t.versao = $1 order by s.numero`, [versao])).rows;

test("rodar duas vezes não duplica nada", async () => {
  await emTransacao(async (c) => {
    await c.query(turma("2026-10-05", 1));
    const primeira = await contagens(c);
    assert.deepEqual(primeira, {
      concursos: 1, materias: 6, assuntos: 219, missoes: 24, planos: 1, planoMissoes: 24,
      trilhas: 1, disciplinas: 8, semanas: 12, atividades: 159,
    });
    await c.query(turma("2026-10-05", 1));
    assert.deepEqual(await contagens(c), primeira);
  });
});

test("o concurso entra sem data de prova e sem maturidade carimbada", async () => {
  await emTransacao(async (c) => {
    await c.query(turma("2026-10-05", 1));
    const r = await c.query("select nome, mes_prova, dia_prova, maturidade, status_dado from concursos where codigo = 'pmerj_cfo'");
    assert.deepEqual(r.rows[0], {
      nome: "CFO PMERJ, preparação pré-edital", mes_prova: null, dia_prova: null,
      maturidade: "indisponivel", status_dado: "inferencia",
    });
    // rodar de novo não apaga uma data que o operador tenha posto depois
    await c.query("update concursos set mes_prova = 11, dia_prova = 15, maturidade = 'pre_edital' where codigo = 'pmerj_cfo'");
    await c.query(turma("2026-10-05", 1));
    const d = await c.query("select mes_prova, dia_prova, maturidade from concursos where codigo = 'pmerj_cfo'");
    assert.deepEqual(d.rows[0], { mes_prova: 11, dia_prova: 15, maturidade: "pre_edital" });
  });
});

test("nova turma: as datas da turma anterior não mudam, e o catálogo não duplica", async () => {
  await emTransacao(async (c) => {
    await c.query(turma("2026-10-05", 1));
    const antes = await semanasDa(c, 1);
    await c.query(turma("2027-01-04", 2));
    assert.deepEqual(await semanasDa(c, 1), antes);
    const t2 = await semanasDa(c, 2);
    assert.equal(t2[0].inicio, "2027-01-04");
    assert.equal(t2[11].fim, "2027-03-28");
    const n = await contagens(c);
    assert.equal(n.trilhas, 2);
    assert.equal(n.assuntos, 219);
    assert.equal(n.missoes, 24);
    assert.equal(n.atividades, 2 * 159);
  });
});

test("mesma turma com outro início é recusada, e nada muda", async () => {
  await emTransacao(async (c) => {
    await c.query(turma("2026-10-05", 1));
    const antes = await semanasDa(c, 1);
    await c.query("savepoint s");
    await assert.rejects(c.query(turma("2026-11-02", 1)), /turma 1 do pmerj-cfo já existe com início 2026-10-05/);
    await c.query("rollback to savepoint s");
    assert.deepEqual(await semanasDa(c, 1), antes);
  });
});

test("turma com meta gerada aceita o SQL de novo: nada é apagado", async () => {
  await emTransacao(async (c) => {
    await c.query(turma("2026-10-05", 1));
    const t = (await c.query("select id from trilhas where nicho = 'pmerj-cfo' and versao = 1")).rows[0].id;
    await criarAluno(c, { trilha_id: t });
    await c.query("select app.gerar_meta($1, date '2026-10-07')", [ALUNO]);
    const n = Number((await c.query(
      "select count(*) n from meta_atividades ma join metas m on m.id = ma.meta_id where m.aluno_id = $1 and m.trilha_id = $2",
      [ALUNO, t])).rows[0].n);
    assert.equal(n, 13, "semana 1: 12 tarefas das matérias + escrita");
    await c.query(turma("2026-10-05", 1));
    assert.equal((await contagens(c)).atividades, 159);
  });
});

test("fila do motor: só as missões automáticas, na ordem das semanas", async () => {
  await emTransacao(async (c) => {
    await c.query(turma("2026-10-05", 1));
    const concurso = (await c.query("select id from concursos where codigo = 'pmerj_cfo'")).rows[0].id;
    await criarAluno(c, { concurso_id: concurso });
    const fila = (await c.query(
      `select f.posicao, m.nome, f.meta_questoes from app.missoes_fila($1, 'dir_adm') f join missoes m on m.id = f.missao_id order by f.posicao`,
      [ALUNO])).rows;
    assert.deepEqual(fila.map((x) => [x.posicao, x.meta_questoes]), [[1, 20], [2, 20], [3, 20]]);
    assert.equal(fila[0].nome, "Organização administrativa: direta, indireta e delegação");
    const dh = (await c.query("select count(*) n from app.missoes_fila($1, 'dir_hum')", [ALUNO])).rows[0].n;
    assert.equal(Number(dh), 3, "a missão manual da semana 4 fica fora da fila");
  });
});

test("orçamento no banco: 160 por semana normal, 112 nas de simulado; metas somam 106", async () => {
  await emTransacao(async (c) => {
    await c.query(turma("2026-10-05", 1));
    const metas = (await c.query(
      `select s.meta_questoes from trilha_semanas s join trilhas t on t.id = s.trilha_id
        where t.nicho = 'pmerj-cfo' and t.versao = 1 order by s.numero`)).rows.map((r) => r.meta_questoes);
    assert.deepEqual(metas, [160, 160, 160, 112, 160, 160, 160, 112, 160, 160, 160, 112]);
    const soma = (await c.query(
      `select p.semana_sugerida s, sum(m.meta_questoes)::int soma from trilha_plano_missoes p join missoes m on m.id = p.missao_id
        where m.exam_tag = 'pmerj_cfo' group by 1 order by 1`)).rows;
    assert.deepEqual(soma, [{ s: 1, soma: 106 }, { s: 2, soma: 106 }, { s: 3, soma: 106 }, { s: 4, soma: null }]);
  });
});

test("rodar de novo sem --publicada não despublica a turma", async () => {
  await emTransacao(async (c) => {
    await c.query(turma("2026-10-05", 1, { publicada: true }));
    await c.query(turma("2026-10-05", 1));
    const r = await c.query("select publicada from trilhas where nicho = 'pmerj-cfo' and versao = 1");
    assert.equal(r.rows[0].publicada, true);
  });
});

test("versão nova do conteúdo atualiza as missões no lugar, sem duplicar", async () => {
  await emTransacao(async (c) => {
    await c.query(turma("2026-10-05", 1));
    const v2 = structuredClone(M);
    v2.conteudoVersao = "v2-teste";
    v2.missoes[0].objetivo = `${v2.missoes[0].objetivo} (revisado)`;
    await c.query(turma("2026-10-05", 1, {}, v2));
    assert.equal((await contagens(c)).missoes, 24);
    const r = await c.query("select objetivo from missoes where exam_tag = 'pmerj_cfo' and objetivo like '%(revisado)'");
    assert.equal(r.rows.length, 1);
  });
});

test("missão no banco que o manifesto não tem mais faz o SQL recusar", async () => {
  await emTransacao(async (c) => {
    await c.query(turma("2026-10-05", 1));
    // uma missão que uma versão anterior teria deixado e esta não tem
    await c.query(`insert into missoes (exam_tag, materia_codigo, nivel, nome, objetivo, criterio_conclusao)
                   values ('pmerj_cfo', 'dir_hum', 'base', 'Missão órfã', 'x', 'x')`);
    await c.query("savepoint s");
    await assert.rejects(c.query(turma("2026-10-05", 1)), /1 missão\(ões\) no banco fora do manifesto/);
    await c.query("rollback to savepoint s");
  });
});
