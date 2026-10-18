// ============================================================
// P1.1 (0067) — lote seguido sem espera, busca à frente, limite por hora
// ------------------------------------------------------------
// Defeito em produção, 17/10/2026: lote 1 às 22:34:40 (busca cheia, 5
// FGV); o aluno respondeu em ~45 s e pediu mais às ~22:35. A 0065 segurava
// qualquer busca por rebusca_minutos (2) e ele recebeu "Não há questão
// nova... registre manualmente". Missão "Organização administrativa",
// meta 20. Cada teste roda numa transação desfeita, como em
// p11-quest-db.test.mjs, com uma missão própria de meta 20.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const NOME = "Quest 0067 lote contínuo";

async function emTransacao(fn, { meta = 20 } = {}) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(`select set_config('request.jwt.claims', '{"role":"service_role"}', true)`);
    const { rows } = await c.query(`
      select a.id as aluno, a.escola_id as escola, a.usuario_id as usuario
        from alunos a join concursos c on c.id = a.concurso_id
       where c.codigo = 'espcex' and a.usuario_id is not null
         and not exists (select 1 from registros_estudo r where r.aluno_id = a.id and r.disciplina_codigo = 'mat')
       order by a.id desc limit 1`);
    assert.ok(rows.length, "a seed precisa de um aluno da EsPCEx com conta e sem registro de Matemática");
    const assunto = (await c.query(
      `select id from assuntos where exam_tag = 'espcex' and materia_codigo = 'mat' order by ordem, id limit 1`)).rows[0].id;
    const missao = (await c.query(
      `insert into missoes (exam_tag, materia_codigo, assunto_id, nivel, nome, objetivo, criterio_conclusao,
                            xp_sugerido, ordem, meta_questoes, meta_acuracia)
       values ('espcex', 'mat', $1, 'base', $2, 'teste 0067', 'meta do teste', 40, -30, $3, 0)
       returning id`, [assunto, NOME, meta])).rows[0].id;
    await c.query(`insert into app.quest_filtros_missao (missao_id, materia, assunto, ativo)
                   values ($1, 'Matemática', $2, true)`, [missao, NOME]);
    return await fn(c, { ...rows[0], missao });
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

const questao = (i, banca = "FGV") => ({
  id_externo: `lc-${i}`, banca, orgao: "PMERJ", cargo: "Oficial", ano: 2024,
  materia: "Matemática", assunto: "Funções", tipo: "multipla_escolha", enunciado: `Enunciado ${i}`,
  alternativas: ["A", "B", "C", "D", "E"].map((l) => ({ letra: l, texto: `alt ${l}` })), gabarito: "B",
});
const varias = (de, n, banca) => Array.from({ length: n }, (_, i) => questao(de + i, banca));

const guardar = (c, missao, itens, { cursor = "c-1", esgotada = false, fase = "geral" } = {}) =>
  c.query("select public.quest_guardar_questoes($1, $2::jsonb, $3, $4, $5) as r",
    [missao, JSON.stringify(itens), cursor, esgotada, fase]).then((r) => r.rows[0].r);

const uuid = async (c) => (await c.query("select gen_random_uuid() as u")).rows[0].u;

const preparar = async (c, al, { tamanho = 5, semBusca = false } = {}) =>
  (await c.query("select public.quest_preparar_entrega($1, $2, $3, $4, $5, $6) as r",
    [al.usuario, al.escola, al.missao, await uuid(c), tamanho, semBusca])).rows[0].r;

const responderTudo = async (c, al, entrega) => {
  for (const q of entrega.questoes) {
    const r = (await c.query("select public.quest_responder($1, $2, $3, $4, 'B', 40000) as r",
      [al.usuario, al.escola, entrega.id, q.id])).rows[0].r;
    assert.equal(r.estado, "ok");
  }
};

const feitas = async (c, al) => Number((await c.query(
  `select coalesce(max(questoes_acumuladas), 0) as n from aluno_missoes where aluno_id = $1 and missao_id = $2`,
  [al.aluno, al.missao])).rows[0].n);

const estoque = async (c, al) => Number((await c.query(
  "select count(*) as n from app.quest_questao_missao where missao_id = $1", [al.missao])).rows[0].n);

// ── 1. espera só depois de busca ruim ───────────────────────────────

test("22:35 de 17/10: busca cheia, lote respondido em 45 s, pedido seguinte busca de novo sem esperar 2 minutos", async () => {
  await emTransacao(async (c, al) => {
    const r1 = await preparar(c, al);
    assert.equal(r1.estado, "buscar");
    // a busca de 22:34:40 veio cheia (o que a Quest devolveu = o que foi pedido)
    await guardar(c, al.missao, varias(1, 5));
    const lote1 = await preparar(c, al, { semBusca: true });
    assert.equal(lote1.estado, "ok");
    assert.equal(lote1.entrega.questoes.length, 5);
    await responderTudo(c, al, lote1.entrega);

    // ~22:35: ainda dentro de rebusca_minutos da busca anterior
    const recente = (await c.query(
      `select ultima_busca_em > now() - interval '2 minutes' as recente, ultima_busca_cheia
         from app.quest_filtros_missao where missao_id = $1`, [al.missao])).rows[0];
    assert.deepEqual(recente, { recente: true, ultima_busca_cheia: true });
    const r2 = await preparar(c, al);
    assert.equal(r2.estado, "buscar", "antes da 0067: sem_questoes e o aviso de registrar à mão");
    assert.equal(r2.faltam, 20 - await feitas(c, al), "busca à frente: o que falta para a meta");
  });
});

test("busca em andamento ou que falhou segura a próxima por rebusca_minutos (não paga a mesma página duas vezes)", async () => {
  await emTransacao(async (c, al) => {
    assert.equal((await preparar(c, al)).estado, "buscar");
    // a Edge Function ainda não guardou (ou a Quest caiu): ultima_busca_cheia null
    assert.equal((await preparar(c, al)).estado, "sem_questoes");
    await c.query("update app.quest_filtros_missao set ultima_busca_em = now() - interval '3 minutes' where missao_id = $1", [al.missao]);
    assert.equal((await preparar(c, al)).estado, "buscar", "passou a espera: busca de novo");
  });
});

test("busca curta segura a próxima; passada a espera, segue a busca seguinte", async () => {
  await emTransacao(async (c, al) => {
    await c.query("update app.quest_filtros_missao set banca_preferida = 'FGV' where missao_id = $1", [al.missao]);
    assert.equal((await preparar(c, al)).filtro?.fase, "preferida");
    // FGV voltou curta: 2 de 20
    const g = await guardar(c, al.missao, varias(1, 2), { esgotada: true, fase: "preferida" });
    assert.equal(g.proxima.fase, "geral");
    const lote = await preparar(c, al, { semBusca: true });
    await responderTudo(c, al, lote.entrega);
    assert.equal((await preparar(c, al)).estado, "sem_questoes", "curta: espera rebusca_minutos");
    await c.query("update app.quest_filtros_missao set ultima_busca_em = now() - interval '3 minutes' where missao_id = $1", [al.missao]);
    const r = await preparar(c, al);
    assert.deepEqual([r.estado, r.filtro.fase], ["buscar", "geral"]);
  });
});

// ── 2. busca à frente ───────────────────────────────────────────────

test("busca à frente: sem estoque, pede a meta da missão (20); o lote sai com 5 e 15 ficam guardados", async () => {
  await emTransacao(async (c, al) => {
    const r = await preparar(c, al, { tamanho: 5 });
    assert.equal(r.faltam, 20);
    await guardar(c, al.missao, varias(1, 20));
    const lote = await preparar(c, al, { tamanho: 5, semBusca: true });
    assert.equal(lote.entrega.questoes.length, 5, "o lote é do tamanho pedido");
    await responderTudo(c, al, lote.entrega);
    // o próximo lote sai do estoque, sem pedir busca
    const lote2 = await preparar(c, al, { tamanho: 5 });
    assert.equal(lote2.estado, "ok");
    assert.equal(lote2.entrega.questoes.length, 5);
    assert.equal(await estoque(c, al), 20, "nenhuma questão nova: veio da base");
  });
});

test("busca à frente desconta o que o aluno já fez, não passa de 20 e nunca pede menos que o lote", async () => {
  await emTransacao(async (c, al) => {
    await guardar(c, al.missao, varias(1, 5));
    await responderTudo(c, al, (await preparar(c, al, { semBusca: true })).entrega);
    const ja = await feitas(c, al);
    assert.ok(ja >= 5);
    await c.query("update app.quest_filtros_missao set ultima_busca_em = null where missao_id = $1", [al.missao]);
    assert.equal((await preparar(c, al, { tamanho: 5 })).faltam, 20 - ja, "meta 20 menos o que ele já fez");
  });
  await emTransacao(async (c, al) => {
    assert.equal((await preparar(c, al, { tamanho: 5 })).faltam, 20, "meta 80: teto de 20 por busca");
  }, { meta: 80 });
  await emTransacao(async (c, al) => {
    assert.equal((await preparar(c, al, { tamanho: 10 })).faltam, 10, "meta 3: pede o lote inteiro");
  }, { meta: 3 });
});

test("estoque parcial: pede o que falta para a meta, descontando o que já está guardado para ele", async () => {
  await emTransacao(async (c, al) => {
    await guardar(c, al.missao, varias(1, 3));
    const r = await preparar(c, al, { tamanho: 5 });
    assert.equal(r.estado, "buscar");
    assert.equal(r.disponiveis, 3);
    assert.equal(r.faltam, 17, "20 da meta − 3 guardadas");
  });
});

// ── 3. limite por hora em questões ──────────────────────────────────

test("limite por hora: 60 questões; perto do teto o lote é cortado para caber", async () => {
  await emTransacao(async (c, al) => {
    const lim = (await c.query("select app.quest_limites() as l")).rows[0].l;
    assert.deepEqual([lim.questoes_hora, lim.questoes_dia, lim.busca_max, lim.lotes_hora], [60, 120, 20, undefined]);
    await guardar(c, al.missao, varias(1, 20));
    await c.query(
      `insert into app.quest_entregas (pedido_id, escola_id, aluno_id, missao_id, tipo_pratica, questoes, criada_em, expira_em)
       select gen_random_uuid(), $1, $2, $3, 'missao', array(select gen_random_uuid() from generate_series(1, 19)),
              now() - interval '20 minutes', now() - interval '1 minute'
         from generate_series(1, 3)`, [al.escola, al.aluno, al.missao]);
    const r = await preparar(c, al, { tamanho: 10, semBusca: true });
    assert.equal(r.estado, "ok");
    assert.equal(r.entrega.questoes.length, 3, "57 na hora: cabem 3");
    await responderTudo(c, al, r.entrega);   // lote aberto seria retomado
    assert.deepEqual(await preparar(c, al, { tamanho: 5, semBusca: true }), { estado: "limite", motivo: "questoes_hora" });
  });
});
