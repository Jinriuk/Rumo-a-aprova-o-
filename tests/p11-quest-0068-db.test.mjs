// ============================================================
// P1.1 (0068) — revisão do Codex no #189 e no #192
// ------------------------------------------------------------
//   • a resposta repetida que fechou a missão devolve missao_concluida
//     (achado 2 do #192);
//   • "cheia" é a reposição inteira: página curta por repetidas segura a
//     próxima busca, e a 2ª página que completa libera (achado do #189);
//   • dois alunos na mesma missão: só um recebe 'buscar' (achado do #189;
//     este teste grava de verdade e apaga no fim, porque a corrida precisa
//     de duas transações que se enxerguem).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const NOME = "Quest 0068";

// A corrida grava de verdade (duas transações que se enxergam) e os
// arquivos de teste rodam em paralelo: ela usa Química, que nenhum outro
// teste usa, para não virar a missão da vez de Matemática dos outros.
const ALUNOS_SQL = (materia) => `
  select a.id as aluno, a.escola_id as escola, a.usuario_id as usuario
    from alunos a join concursos c on c.id = a.concurso_id
   where c.codigo = 'espcex' and a.usuario_id is not null
     and not exists (select 1 from registros_estudo r where r.aluno_id = a.id and r.disciplina_codigo = '${materia}')
   order by a.id desc limit $1`;

async function criarMissao(c, meta, materia = "mat") {
  const assunto = (await c.query(
    `select id from assuntos where exam_tag = 'espcex' and materia_codigo = $1 order by ordem, id limit 1`, [materia])).rows[0].id;
  const missao = (await c.query(
    `insert into missoes (exam_tag, materia_codigo, assunto_id, nivel, nome, objetivo, criterio_conclusao,
                          xp_sugerido, ordem, meta_questoes, meta_acuracia)
     values ('espcex', $4, $1, 'base', $2, 'teste 0068', 'meta do teste', 40, -31, $3, 0)
     returning id`, [assunto, NOME, meta, materia])).rows[0].id;
  await c.query(`insert into app.quest_filtros_missao (missao_id, materia, assunto, ativo)
                 values ($1, $2, $3, true)`, [missao, materia === "mat" ? "Matemática" : "Química", NOME]);
  return missao;
}

async function emTransacao(fn, { meta = 20 } = {}) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(`select set_config('request.jwt.claims', '{"role":"service_role"}', true)`);
    const { rows } = await c.query(ALUNOS_SQL("mat"), [1]);
    assert.ok(rows.length, "a seed precisa de um aluno da EsPCEx com conta e sem registro de Matemática");
    const missao = await criarMissao(c, meta);
    return await fn(c, { ...rows[0], missao });
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

const questao = (i) => ({
  id_externo: `q68-${i}`, banca: "FGV", orgao: "PMERJ", cargo: "Oficial", ano: 2024,
  materia: "Matemática", assunto: "Funções", tipo: "multipla_escolha", enunciado: `Enunciado ${i}`,
  alternativas: ["A", "B", "C", "D", "E"].map((l) => ({ letra: l, texto: `alt ${l}` })), gabarito: "B",
});
const varias = (de, n) => Array.from({ length: n }, (_, i) => questao(de + i));

const guardar = (c, missao, itens, { esgotada = false } = {}) =>
  c.query("select public.quest_guardar_questoes($1, $2::jsonb, $3, $4, 'geral') as r",
    [missao, JSON.stringify(itens), "c-1", esgotada]).then((r) => r.rows[0].r);

const preparar = async (c, al, { tamanho = 5, semBusca = false } = {}) =>
  (await c.query("select public.quest_preparar_entrega($1, $2, $3, gen_random_uuid(), $4, $5) as r",
    [al.usuario, al.escola, al.missao, tamanho, semBusca])).rows[0].r;

const responder = async (c, al, entregaId, questaoId) =>
  (await c.query("select public.quest_responder($1, $2, $3, $4, 'B', 30000) as r",
    [al.usuario, al.escola, entregaId, questaoId])).rows[0].r;

const filtro = async (c, missao) => (await c.query(
  "select ultima_busca_cheia as cheia, busca_faltam as faltam from app.quest_filtros_missao where missao_id = $1",
  [missao])).rows[0];

// ── resposta repetida ───────────────────────────────────────────────

test("resposta repetida que fechou a missão devolve missao_concluida", async () => {
  await emTransacao(async (c, al) => {
    await guardar(c, al.missao, varias(1, 5));
    const lote = (await preparar(c, al, { semBusca: true })).entrega;
    const respostas = [];
    for (const q of lote.questoes) respostas.push(await responder(c, al, lote.id, q.id));
    assert.deepEqual(respostas.map((r) => r.missao_concluida), [false, false, false, false, true],
      "a 5ª resposta fecha a missão de meta 5");
    // a resposta HTTP da 5ª se perdeu: o navegador reenvia
    const repetida = await responder(c, al, lote.id, lote.questoes[4].id);
    assert.equal(repetida.repetida, true);
    assert.equal(repetida.missao_concluida, true, "a tela precisa saber que a missão fechou");
    // lote seguinte (revisão) não é do registro que fechou: repetição sem o sinal
    await guardar(c, al.missao, varias(6, 5));
    const rev = (await preparar(c, al, { semBusca: true })).entrega;
    assert.equal(rev.tipo_pratica, "revisao");
    await responder(c, al, rev.id, rev.questoes[0].id);
    const r = await responder(c, al, rev.id, rev.questoes[0].id);
    assert.deepEqual([r.repetida, r.missao_concluida], [true, false]);
  }, { meta: 5 });
});

test("repetição de resposta que não fecha missão segue com missao_concluida false", async () => {
  await emTransacao(async (c, al) => {
    await guardar(c, al.missao, varias(1, 5));
    const lote = (await preparar(c, al, { semBusca: true })).entrega;
    await responder(c, al, lote.id, lote.questoes[0].id);
    const r = await responder(c, al, lote.id, lote.questoes[0].id);
    assert.deepEqual([r.estado, r.repetida, r.missao_concluida], ["ok", true, false]);
  });
});

// ── "cheia" é a reposição inteira ───────────────────────────────────

test("página curta por repetidas não conta como cheia; a 2ª página que completa, sim", async () => {
  await emTransacao(async (c, al) => {
    const r = await preparar(c, al);
    assert.equal(r.faltam, 20);
    assert.deepEqual(await filtro(c, al.missao), { cheia: null, faltam: 20 });
    // 1ª página: 20 recebidas, só 12 novas (8 já estavam guardadas)
    await guardar(c, al.missao, varias(100, 8));
    await c.query("update app.quest_filtros_missao set busca_faltam = 20, ultima_busca_cheia = null where missao_id = $1", [al.missao]);
    await guardar(c, al.missao, [...varias(100, 8), ...varias(1, 12)]);
    assert.deepEqual(await filtro(c, al.missao), { cheia: false, faltam: 8 },
      "se a 2ª chamada falhar agora, a espera vale");
    // 2ª página traz as 8 que faltavam
    await guardar(c, al.missao, varias(13, 8));
    assert.deepEqual(await filtro(c, al.missao), { cheia: true, faltam: 0 });
  });
});

test("2ª chamada que falha depois de página curta: o pedido seguinte espera rebusca_minutos", async () => {
  await emTransacao(async (c, al) => {
    assert.equal((await preparar(c, al)).estado, "buscar");
    await guardar(c, al.missao, varias(1, 3));      // 3 de 20, página não esgotada
    // (a 2ª chamada à Quest falhou: nada mais é guardado)
    const lote = await preparar(c, al, { semBusca: true });
    for (const q of lote.entrega.questoes) await responder(c, al, lote.entrega.id, q.id);
    assert.equal((await preparar(c, al)).estado, "sem_questoes", "não chama de novo a Quest que acabou de falhar");
    await c.query("update app.quest_filtros_missao set ultima_busca_em = now() - interval '3 minutes' where missao_id = $1", [al.missao]);
    assert.equal((await preparar(c, al)).estado, "buscar", "passada a espera, busca");
  });
});

// ── busca reivindicada uma vez ──────────────────────────────────────

test("dois alunos na mesma missão ao mesmo tempo: só um recebe 'buscar'", async () => {
  const adm = await pool.connect();
  const c1 = await pool.connect();
  const c2 = await pool.connect();
  let missao = null;
  try {
    const { rows: alunos } = await adm.query(ALUNOS_SQL("qui"), [2]);
    assert.equal(alunos.length, 2, "a seed precisa de dois alunos da EsPCEx sem registro de Química");
    await adm.query("begin");
    missao = await criarMissao(adm, 20, "qui");
    // estado da corrida: a última busca veio cheia e o estoque acabou
    await adm.query("update app.quest_filtros_missao set ultima_busca_em = now(), ultima_busca_cheia = true where missao_id = $1", [missao]);
    await adm.query("commit");

    for (const c of [c1, c2]) {
      await c.query("begin");
      await c.query(`select set_config('request.jwt.claims', '{"role":"service_role"}', true)`);
    }
    const [a1, a2] = alunos.map((a) => ({ ...a, missao }));
    const r1 = await preparar(c1, a1);
    assert.equal(r1.estado, "buscar");
    // o 2º lê a linha antes de o 1º confirmar e espera a trava da linha
    const p2 = preparar(c2, a2);
    await new Promise((ok) => setTimeout(ok, 300));
    await c1.query("commit");
    const r2 = await p2;
    await c2.query("commit");
    assert.notEqual(r2.estado, "buscar", "a mesma página não é paga duas vezes");
  } finally {
    for (const c of [c1, c2]) await c.query("rollback").catch(() => {});
    if (missao) {
      await adm.query("delete from app.quest_entregas where missao_id = $1", [missao]).catch(() => {});
      await adm.query("delete from app.quest_filtros_missao where missao_id = $1", [missao]);
      await adm.query("delete from missoes where id = $1", [missao]);
    }
    for (const c of [adm, c1, c2]) c.release();
  }
});
