// ============================================================
// P0.4 (0064) — registro de estudo com missão e assunto conferidos
// ------------------------------------------------------------
// Casos da seção 12 de docs/conteudo/pmerj-cfo/PMERJ_CFO_Desenho_da_
// Trilha_e_Auditoria_do_Banco.md:
//   • registro livre (ou de outra missão/assunto) soma volume, mas não
//     conclui a missão temática errada;
//   • registro de revisão fica no assunto de origem e não avança a fila;
//   • editar ou apagar reprocessa o vínculo, sem XP órfão nem duplicado.
// E a conferência no servidor: o navegador não decide sozinho o que
// conta (missão do concurso, matéria, escola, fila, assunto).
// A regra da 0061 para registros 'legado' segue coberta em
// missoes-sequenciais-db.test.mjs.
//
// Como postgres numa transação desfeita no fim (o motor é SECURITY
// DEFINER). A escrita "de cliente" é simulada com a claim do PostgREST,
// que é o que o gatilho lê; o último teste passa pela RLS de verdade.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, IDS, ESCOLA_A, ALUNO_LUCAS, esperaErro } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const [M1, M2, M3] = ["Funções integradas", "Geometria Analítica", "Geometria Plana fechada"]; // 70/60/70 a 82%

async function emTransacao(fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    const { rows } = await c.query(`
      select a.id as aluno, a.escola_id as escola from alunos a join concursos c on c.id = a.concurso_id
       where c.codigo = 'espcex'
         and not exists (select 1 from registros_estudo r where r.aluno_id = a.id and r.disciplina_codigo = 'mat')
       order by a.id limit 1`);
    assert.ok(rows.length, "a seed precisa de um aluno da EsPCEx sem registro de Matemática");
    const ids = Object.fromEntries((await c.query(
      `select nome, id, assunto_id from missoes where exam_tag = 'espcex' and materia_codigo in ('mat', 'red')`)).rows
      .map((r) => [r.nome, r]));
    return await fn(c, { ...rows[0], m: ids });
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

// escrita como cliente (a claim que o PostgREST põe), sem trocar de papel
const comoCliente = (c) => c.query(`select set_config('request.jwt.claims', '{"role":"authenticated"}', true)`);

async function registrar(c, al, { q, a, tipo = "livre", missao = null, assunto = null, materia = "mat" }) {
  const r = await c.query(
    `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, tipo_pratica, missao_id, assunto_id)
     values ($1, $2, current_date, $3, 'p04', $4, $5, $6, $7, $8) returning id, assunto_id`,
    [al.escola, al.aluno, materia, q, a, tipo, missao, assunto]);
  return r.rows[0];
}

const missoes = async (c, aluno) => (await c.query(
  `select m.nome, am.estado, am.questoes_acumuladas as q
     from aluno_missoes am join missoes m on m.id = am.missao_id
    where am.aluno_id = $1 and m.materia_codigo = 'mat' order by m.ordem`, [aluno])).rows
  .map((x) => [x.nome, x.estado, x.q]);

const ledger = async (c, aluno) => (await c.query(
  `select count(*)::int as linhas,
          count(*) filter (where status = 'valido')::int as validas,
          coalesce(sum(xp_delta) filter (where status = 'valido'), 0)::int as xp
     from aluno_eventos_progresso where aluno_id = $1 and tipo_evento = 'missao_concluida' and origem = 'motor_missao'`,
  [aluno])).rows[0];

const volume = async (c, aluno) => Number((await c.query(
  "select coalesce(sum(questoes), 0) as q from registros_estudo where aluno_id = $1 and disciplina_codigo = 'mat'", [aluno])).rows[0].q);

const vinculado = async (c, registro) => (await c.query(
  "select count(*)::int as n from app.missao_registros where registro_id = $1", [registro])).rows[0].n === 1;

// ── seção 12: registro livre ou de outro assunto ─────────────────────

test("registro sem tipo é livre: soma volume e não começa nem avança missão", async () => {
  await emTransacao(async (c, al) => {
    const r = await c.query(
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos)
       values ($1, $2, current_date, 'mat', 'sem tipo', 70, 65) returning tipo_pratica`, [al.escola, al.aluno]);
    assert.equal(r.rows[0].tipo_pratica, "livre");
    assert.deepEqual(await missoes(c, al.aluno), []);
    assert.equal(await volume(c, al.aluno), 70);
  });
});

test("seção 12: registro livre de outro assunto soma volume, mas não conclui a missão em andamento", async () => {
  await emTransacao(async (c, al) => {
    await registrar(c, al, { q: 20, a: 18, tipo: "missao", missao: al.m[M1].id });
    assert.deepEqual(await missoes(c, al.aluno), [[M1, "em_andamento", 20]]);
    // 70 questões a 93%: na regra da 0061 fechariam a M1
    const livre = await registrar(c, al, { q: 70, a: 65 });
    assert.deepEqual(await missoes(c, al.aluno), [[M1, "em_andamento", 20]]);
    assert.equal(await vinculado(c, livre.id), false);
    assert.equal(await volume(c, al.aluno), 90, "o volume geral conta o registro livre");
    assert.equal((await ledger(c, al.aluno)).validas, 0);
  });
});

test("seção 12: prática marcada para outra missão não conta para a da vez, nem adianta a outra", async () => {
  await emTransacao(async (c, al) => {
    await registrar(c, al, { q: 20, a: 18, tipo: "missao", missao: al.m[M1].id });
    const outra = await registrar(c, al, { q: 70, a: 65, tipo: "missao", missao: al.m[M2].id });
    assert.deepEqual(await missoes(c, al.aluno), [[M1, "em_andamento", 20]]);
    assert.equal(await vinculado(c, outra.id), false);
  });
});

test("a prática da missão da vez fecha só ela, e a seguinte começa no próximo registro dela", async () => {
  await emTransacao(async (c, al) => {
    await registrar(c, al, { q: 70, a: 65, tipo: "missao", missao: al.m[M1].id });
    assert.deepEqual(await missoes(c, al.aluno), [[M1, "concluida", 70]]);
    await registrar(c, al, { q: 30, a: 28, tipo: "missao", missao: al.m[M2].id });
    assert.deepEqual(await missoes(c, al.aluno), [[M1, "concluida", 70], [M2, "em_andamento", 30]]);
    assert.deepEqual(await ledger(c, al.aluno), { linhas: 1, validas: 1, xp: 90 });
  });
});

// ── seção 12: revisão ────────────────────────────────────────────────

test("seção 12: revisão fica no assunto da missão de origem e não avança a fila", async () => {
  await emTransacao(async (c, al) => {
    await registrar(c, al, { q: 70, a: 65, tipo: "missao", missao: al.m[M1].id });
    await registrar(c, al, { q: 10, a: 9, tipo: "missao", missao: al.m[M2].id });
    const rev = await registrar(c, al, { q: 60, a: 55, tipo: "revisao", missao: al.m[M1].id });
    assert.equal(rev.assunto_id, al.m[M1].assunto_id, "o servidor liga a revisão ao assunto da missão revisada");
    assert.equal(await vinculado(c, rev.id), false);
    assert.deepEqual(await missoes(c, al.aluno), [[M1, "concluida", 70], [M2, "em_andamento", 10]],
      "a M2 não ganha as 60 questões da revisão, e a M1 continua com as 70 dela");
    assert.deepEqual(await ledger(c, al.aluno), { linhas: 1, validas: 1, xp: 90 });
  });
});

test("revisão só de missão que o aluno já começou", async () => {
  await emTransacao(async (c, al) => {
    await comoCliente(c);
    await esperaErro(c, /só dá para revisar uma missão já iniciada/,
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, tipo_pratica, missao_id)
       values ($1, $2, current_date, 'mat', 'x', 10, 9, 'revisao', $3)`, [al.escola, al.aluno, al.m[M3].id]);
  });
});

// ── seção 12: editar e apagar ────────────────────────────────────────

test("seção 12: editar a prática que fechou a missão para livre estorna; apagar e refazer revalida a mesma linha", async () => {
  await emTransacao(async (c, al) => {
    const r = await registrar(c, al, { q: 70, a: 65, tipo: "missao", missao: al.m[M1].id });
    assert.deepEqual(await ledger(c, al.aluno), { linhas: 1, validas: 1, xp: 90 });

    await c.query("update registros_estudo set tipo_pratica = 'livre', missao_id = null where id = $1", [r.id]);
    assert.deepEqual(await missoes(c, al.aluno), [], "sem o registro, a M1 volta a 'a seguir'");
    assert.deepEqual(await ledger(c, al.aluno), { linhas: 1, validas: 0, xp: 0 }, "o XP foi estornado, não apagado");

    await c.query("delete from registros_estudo where id = $1", [r.id]);
    await registrar(c, al, { q: 70, a: 65, tipo: "missao", missao: al.m[M1].id });
    assert.deepEqual(await missoes(c, al.aluno), [[M1, "concluida", 70]]);
    assert.deepEqual(await ledger(c, al.aluno), { linhas: 1, validas: 1, xp: 90 }, "a mesma linha do ledger volta a valer");
  });
});

test("seção 12: cinco ciclos de editar e refazer nunca passam do XP de uma missão", async () => {
  await emTransacao(async (c, al) => {
    for (let i = 0; i < 5; i += 1) {
      const r = await registrar(c, al, { q: 70, a: 65, tipo: "missao", missao: al.m[M1].id });
      await c.query("update registros_estudo set questoes = 71 where id = $1", [r.id]);
      await c.query("update registros_estudo set tipo_pratica = 'revisao' where id = $1", [r.id]);
      await c.query("delete from registros_estudo where id = $1", [r.id]);
    }
    const l = await ledger(c, al.aluno);
    assert.equal(l.linhas, 1);
    assert.ok(l.validas <= 1 && l.xp <= 90, JSON.stringify(l));
    assert.equal((await c.query("select count(*)::int as n from app.missao_registros mr join aluno_missoes am on am.id = mr.aluno_missao_id where am.aluno_id = $1", [al.aluno])).rows[0].n, 0,
      "nenhum vínculo órfão sobra depois de apagar tudo");
  });
});

test("trocar a missão de um registro vinculado tira o vínculo e refaz a fila", async () => {
  await emTransacao(async (c, al) => {
    const r = await registrar(c, al, { q: 30, a: 28, tipo: "missao", missao: al.m[M1].id });
    assert.equal(await vinculado(c, r.id), true);
    await c.query("update registros_estudo set missao_id = $2 where id = $1", [r.id, al.m[M2].id]);
    assert.equal(await vinculado(c, r.id), false);
    assert.deepEqual(await missoes(c, al.aluno), []);
    const linha = (await c.query("select assunto_id from registros_estudo where id = $1", [r.id])).rows[0];
    assert.equal(linha.assunto_id, al.m[M2].assunto_id, "o assunto acompanha a missão nova");
    // e virar livre sem mandar assunto limpa o assunto herdado da missão
    await c.query("update registros_estudo set tipo_pratica = 'livre', missao_id = null where id = $1", [r.id]);
    assert.equal((await c.query("select assunto_id from registros_estudo where id = $1", [r.id])).rows[0].assunto_id, null);
  });
});

test("missão apagada do catálogo deixa o registro órfão (volume fica), sem travar a exclusão", async () => {
  await emTransacao(async (c, al) => {
    const r = await registrar(c, al, { q: 20, a: 18, tipo: "missao", missao: al.m[M1].id });
    await c.query("delete from missoes where id = $1", [al.m[M1].id]);
    const linha = (await c.query("select tipo_pratica, missao_id, questoes from registros_estudo where id = $1", [r.id])).rows[0];
    assert.deepEqual(linha, { tipo_pratica: "missao", missao_id: null, questoes: 20 });
  });
});

// ── conferência no servidor ──────────────────────────────────────────

test("servidor: cliente não cria nem converte registro para 'legado'", async () => {
  await emTransacao(async (c, al) => {
    const r = await registrar(c, al, { q: 10, a: 9 });
    await comoCliente(c);
    await esperaErro(c, /"legado" é reservado/,
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, tipo_pratica)
       values ($1, $2, current_date, 'mat', 'x', 10, 9, 'legado')`, [al.escola, al.aluno]);
    await esperaErro(c, /"legado" é reservado/, "update registros_estudo set tipo_pratica = 'legado' where id = $1", [r.id]);
  });
});

test("servidor: registro legado continua editável e segue a regra da 0061", async () => {
  await emTransacao(async (c, al) => {
    // o servidor (restauração, seed) ainda grava legado
    const r = await registrar(c, al, { q: 40, a: 36, tipo: "legado" });
    assert.deepEqual(await missoes(c, al.aluno), [[M1, "em_andamento", 40]], "legado conta pela matéria, como na 0061");
    await comoCliente(c);
    await c.query("update registros_estudo set questoes = 70, acertos = 65 where id = $1", [r.id]);
    assert.deepEqual(await missoes(c, al.aluno), [[M1, "concluida", 70]]);
  });
});

test("servidor: missão de outro concurso, de outra matéria ou desativada é recusada", async () => {
  await emTransacao(async (c, al) => {
    const cn = (await c.query("select id from missoes where exam_tag = 'cn' and materia_codigo = 'mat' limit 1")).rows[0].id;
    await comoCliente(c);
    const sql = `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, tipo_pratica, missao_id)
                 values ($1, $2, current_date, $3, 'x', 10, 9, 'missao', $4)`;
    await esperaErro(c, /não pertence ao concurso do aluno/, sql, [al.escola, al.aluno, "mat", cn]);
    await esperaErro(c, /matéria do registro \(fis\) não é a da missão \(mat\)/, sql, [al.escola, al.aluno, "fis", al.m[M1].id]);
    await c.query(`insert into missoes_escola (escola_id, missao_id, ativa) values ($1, $2, false)
                   on conflict (escola_id, missao_id) do update set ativa = false`, [al.escola, al.m[M1].id]);
    await esperaErro(c, /desativada na escola/, sql, [al.escola, al.aluno, "mat", al.m[M1].id]);
  });
});

test("servidor: missão sem meta automática não aceita prática marcada", async () => {
  await emTransacao(async (c, al) => {
    await comoCliente(c);
    await esperaErro(c, /não tem acompanhamento automático/,
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, tipo_pratica, missao_id)
       values ($1, $2, current_date, 'red', 'x', 1, 1, 'missao', $3)`, [al.escola, al.aluno, al.m["Tese e progressão"].id]);
  });
});

test("servidor: o assunto vem da missão; outro assunto enviado é recusado", async () => {
  await emTransacao(async (c, al) => {
    const r = await registrar(c, al, { q: 10, a: 9, tipo: "missao", missao: al.m[M1].id });
    assert.equal(r.assunto_id, al.m[M1].assunto_id);
    await comoCliente(c);
    await esperaErro(c, /assunto enviado não é o da missão/,
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, tipo_pratica, missao_id, assunto_id)
       values ($1, $2, current_date, 'mat', 'x', 10, 9, 'missao', $3, $4)`, [al.escola, al.aluno, al.m[M1].id, al.m[M2].assunto_id]);
  });
});

test("servidor: registro livre não leva missão; o assunto dele é conferido", async () => {
  await emTransacao(async (c, al) => {
    await comoCliente(c);
    await esperaErro(c, /registro livre não leva missão/,
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, tipo_pratica, missao_id)
       values ($1, $2, current_date, 'mat', 'x', 10, 9, 'livre', $3)`, [al.escola, al.aluno, al.m[M1].id]);
    const cn = (await c.query("select id from assuntos where exam_tag = 'cn' limit 1")).rows[0].id;
    await esperaErro(c, /assunto não é do concurso e da matéria do aluno/,
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, assunto_id)
       values ($1, $2, current_date, 'mat', 'x', 10, 9, $3)`, [al.escola, al.aluno, cn]);
    const ok = await registrar(c, al, { q: 10, a: 9, assunto: al.m[M2].assunto_id });
    assert.equal(ok.assunto_id, al.m[M2].assunto_id);
    assert.deepEqual(await missoes(c, al.aluno), [], "livre com assunto continua não contando para missão");
  });
});

test("pela RLS de verdade: o aluno pratica a missão dele e ela fecha; legado é recusado", async () => {
  await como(IDS.alunoA, async (c) => {
    const missao = (await c.query(
      "select id from missoes where exam_tag = 'cn' and materia_codigo = 'mat' and meta_questoes > 0 order by ordem, id limit 1")).rows[0].id;
    await c.query(
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, tipo_pratica, missao_id)
       values ($1, $2, current_date, 'mat', 'Geometria plana', 60, 58, 'missao', $3)`, [ESCOLA_A, ALUNO_LUCAS, missao]);
    const m = await c.query("select estado from aluno_missoes where aluno_id = $1 and missao_id = $2", [ALUNO_LUCAS, missao]);
    assert.equal(m.rows[0].estado, "concluida");
    await esperaErro(c, /"legado" é reservado/,
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, tipo_pratica)
       values ($1, $2, current_date, 'mat', 'x', 10, 9, 'legado')`, [ESCOLA_A, ALUNO_LUCAS]);
  });
});
