// ============================================================
// P1.1 (0066) — banca preferida primeiro, depois qualquer banca
// ------------------------------------------------------------
// FGV = SIM (decisão do dono, 16/10/2026), mas FGV sozinha não fecha as
// missões do CFO PMERJ (medição de 04/10). A busca usa a banca preferida
// até esgotar e depois a geral, cada uma com o seu cursor; o estoque
// guardado sai com a banca preferida primeiro. Cada teste roda numa
// transação desfeita, como em p11-quest-db.test.mjs.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, esperaErro } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const NOME = "Quest 0066 banca preferida";

async function emTransacao(fn) {
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
       values ('espcex', 'mat', $1, 'base', $2, 'teste 0066', '3 questões a 60%', 40, -20, 3, 60)
       returning id`, [assunto, NOME])).rows[0].id;
    await c.query(`insert into app.quest_filtros_missao (missao_id, materia, assunto, ativo, banca_preferida, cursor)
                   values ($1, 'Matemática', $2, true, 'FGV', 'geral-7')`, [missao, NOME]);
    return await fn(c, { ...rows[0], missao });
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

const questao = (i, banca) => ({
  id_externo: `fgv-${i}`, banca, orgao: "PMERJ", cargo: "Oficial", ano: 2024,
  materia: "Matemática", assunto: "Funções", tipo: "multipla_escolha", enunciado: `Enunciado ${i}`,
  alternativas: ["A", "B", "C", "D", "E"].map((l) => ({ letra: l, texto: `alt ${l}` })), gabarito: "B",
});

const guardar = (c, missao, itens, cursor, esgotada, fase) =>
  c.query("select public.quest_guardar_questoes($1, $2::jsonb, $3, $4, $5) as r",
    [missao, JSON.stringify(itens), cursor, esgotada, fase]).then((r) => r.rows[0].r);

const filtro = async (c, missao) => (await c.query(
  `select cursor, esgotada_em is not null as geral_esgotada, cursor_preferida,
          preferida_esgotada_em is not null as preferida_esgotada
     from app.quest_filtros_missao where missao_id = $1`, [missao])).rows[0];

const uuid = async (c) => (await c.query("select gen_random_uuid() as u")).rows[0].u;

const preparar = async (c, al, { tamanho = 3, semBusca = false } = {}) =>
  (await c.query("select public.quest_preparar_entrega($1, $2, $3, $4, $5, $6) as r",
    [al.usuario, al.escola, al.missao, await uuid(c), tamanho, semBusca])).rows[0].r;

// a busca anterior marcou ultima_busca_em; o teste não espera os 2 minutos
const liberarBusca = (c, missao) =>
  c.query("update app.quest_filtros_missao set ultima_busca_em = null where missao_id = $1", [missao]);

test("com banca preferida, a busca sai na fase preferida, com a banca e o cursor dela; o cursor geral fica parado", async () => {
  await emTransacao(async (c, al) => {
    const r = await preparar(c, al);
    assert.equal(r.estado, "buscar");
    assert.deepEqual(r.filtro, {
      materia: "Matemática", assunto: NOME, assunto_id: null, fase: "preferida", banca: "FGV", cursor: null,
    });
    const g = await guardar(c, al.missao, [questao(1, "FGV"), questao(2, "FGV")], "pref-2", false, "preferida");
    assert.deepEqual(g, { guardadas: 2, novas: 2, proxima: { fase: "preferida", banca: "FGV", cursor: "pref-2" } });
    assert.deepEqual(await filtro(c, al.missao),
      { cursor: "geral-7", geral_esgotada: false, cursor_preferida: "pref-2", preferida_esgotada: false });
  });
});

test("banca preferida esgotada: marca só ela; a próxima busca é a geral, sem banca, do cursor geral", async () => {
  await emTransacao(async (c, al) => {
    const g = await guardar(c, al.missao, [questao(1, "FGV")], "pref-1", true, "preferida");
    assert.deepEqual(g.proxima, { fase: "geral", banca: null, cursor: "geral-7" },
      "no mesmo pedido, a função já sabe que a segunda busca é a geral");
    assert.deepEqual(await filtro(c, al.missao),
      { cursor: "geral-7", geral_esgotada: false, cursor_preferida: "pref-1", preferida_esgotada: true });

    await liberarBusca(c, al.missao);
    const r = await preparar(c, al);
    assert.equal(r.estado, "buscar");
    assert.equal(r.faltam, 2, "a FGV guardada já conta no lote");
    assert.deepEqual([r.filtro.fase, r.filtro.banca, r.filtro.cursor], ["geral", null, "geral-7"]);
  });
});

test("questão repetida não conta como nova; com as duas buscas esgotadas não há próxima, e a entrega não pede busca", async () => {
  await emTransacao(async (c, al) => {
    await guardar(c, al.missao, [questao(1, "FGV"), questao(2, "FGV")], "pref-2", true, "preferida");
    // a busca geral devolve as mesmas FGV (cobradas pela Quest) e uma nova
    const g = await guardar(c, al.missao, [questao(1, "FGV"), questao(2, "FGV"), questao(3, "CESGRANRIO")],
      "geral-10", false, "geral");
    assert.deepEqual([g.guardadas, g.novas], [3, 1], "o banco não duplica e diz quantas eram novas");
    assert.deepEqual(g.proxima, { fase: "geral", banca: null, cursor: "geral-10" });

    const fim = await guardar(c, al.missao, [], null, true, "geral");
    assert.deepEqual(fim, { guardadas: 0, novas: 0, proxima: null });
    assert.deepEqual(await filtro(c, al.missao),
      { cursor: "geral-10", geral_esgotada: true, cursor_preferida: "pref-2", preferida_esgotada: true });

    await liberarBusca(c, al.missao);
    const r = await preparar(c, al, { tamanho: 5 });
    assert.equal(r.estado, "ok", "tudo esgotado: entrega o que tem, sem pedir busca");
    assert.equal(r.entrega.questoes.length, 3);
  });
});

test("estoque: a banca preferida sai primeiro no lote, sem diferença de maiúscula", async () => {
  await emTransacao(async (c, al) => {
    await guardar(c, al.missao, [
      questao(1, "CESGRANRIO"), questao(2, "CESGRANRIO"), questao(3, "fgv"), questao(4, "FGV"), questao(5, null),
    ], "geral-8", false, "geral");
    const r = await preparar(c, al, { tamanho: 2, semBusca: true });
    assert.equal(r.estado, "ok");
    assert.deepEqual(r.entrega.questoes.map((q) => q.banca.toUpperCase()), ["FGV", "FGV"]);
  });
});

test("estoque sem banca preferida: a ordem é a da 0065 (estável por aluno), sem olhar a banca", async () => {
  await emTransacao(async (c, al) => {
    await c.query("update app.quest_filtros_missao set banca_preferida = null where missao_id = $1", [al.missao]);
    await guardar(c, al.missao, [1, 2, 3, 4, 5, 6].map((i) => questao(i, i <= 3 ? "CESGRANRIO" : "FGV")),
      "geral-8", false, "geral");
    const esperado = (await c.query(
      `select q.id from app.quest_questao_missao qm join app.quest_questoes q on q.id = qm.questao_id
        where qm.missao_id = $1 order by md5($2::text || q.id::text) limit 3`,
      [al.missao, al.aluno])).rows.map((x) => x.id);
    const r = await preparar(c, al, { tamanho: 3, semBusca: true });
    assert.deepEqual(r.entrega.questoes.map((q) => q.id), esperado);
  });
});

test("fase inválida, preferida sem banca e missão sem filtro são recusadas sem gravar", async () => {
  await emTransacao(async (c, al) => {
    const sql = "select public.quest_guardar_questoes($1, $2::jsonb, $3, $4, $5)";
    const itens = JSON.stringify([questao(1, "FGV")]);
    await esperaErro(c, /fase inválida/, sql, [al.missao, itens, "x", false, "outra"]);
    await esperaErro(c, /fase inválida/, sql, [al.missao, itens, "x", false, null]);
    await c.query("update app.quest_filtros_missao set banca_preferida = null where missao_id = $1", [al.missao]);
    await esperaErro(c, /sem banca preferida/, sql, [al.missao, itens, "x", false, "preferida"]);
    await esperaErro(c, /missão sem filtro/, sql, [await uuid(c), itens, "x", false, "geral"]);
    const n = (await c.query("select count(*)::int as n from app.quest_questao_missao where missao_id = $1", [al.missao])).rows[0].n;
    assert.equal(n, 0);
  });
});

test("a versão de 4 argumentos (função publicada antes da 0066) segue na fase geral e não toca na preferida", async () => {
  await emTransacao(async (c, al) => {
    const n = (await c.query("select public.quest_guardar_questoes($1, $2::jsonb, $3, $4) as n",
      [al.missao, JSON.stringify([questao(1, "FGV"), questao(2, "CESGRANRIO")]), "geral-9", true])).rows[0].n;
    assert.equal(n, 2);
    assert.deepEqual(await filtro(c, al.missao),
      { cursor: "geral-9", geral_esgotada: true, cursor_preferida: null, preferida_esgotada: false });
  });
});

test("privilégios: só a chave de serviço chama o guardar com fase; o auxiliar não é de ninguém", async () => {
  const c = await pool.connect();
  try {
    const { rows } = await c.query(`
      select r.papel,
             has_function_privilege(r.papel, 'public.quest_guardar_questoes(uuid, jsonb, text, boolean, text)', 'execute') as guardar,
             has_function_privilege(r.papel, 'app.quest_guardar_itens(uuid, jsonb)', 'execute') as itens
        from unnest(array['anon', 'authenticated', 'service_role']) as r(papel)
       order by 1`);
    assert.deepEqual(rows.map((x) => [x.papel, x.guardar, x.itens]), [
      ["anon", false, false], ["authenticated", false, false], ["service_role", true, false],
    ]);
  } finally {
    c.release();
  }
});
