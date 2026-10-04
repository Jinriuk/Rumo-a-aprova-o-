// ============================================================
// P1.1 (0065) — questões integradas: guardar, entregar sem gabarito,
// corrigir no servidor, gravar uma vez, contar pelo caminho da 0064
// ------------------------------------------------------------
// Seção 9 de docs/conteudo/pmerj-cfo/PMERJ_CFO_Desenho_da_Trilha_e_
// Auditoria_do_Banco.md. Cada teste roda numa transação desfeita.
// A Edge Function chama estas funções com a chave de serviço; aqui elas
// rodam como postgres com a claim de service_role, que é o que o
// PostgREST põe. O teste de RLS no fim roda como o aluno de verdade.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, IDS, ESCOLA_A, esperaErro } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const [M1, M2] = ["Quest P1.1 primeira", "Quest P1.1 segunda"];

// Missões próprias, criadas na transação e à frente da fila de Matemática
// (ordem negativa), com meta curta para caber num lote. Não toca nas
// linhas do catálogo da seed: outro arquivo de teste apaga missão em
// paralelo, e travar a mesma linha dava deadlock. O aluno é o último da
// lista (a P0.4 usa o primeiro).
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
    const m = {};
    for (const [i, nome] of [M1, M2].entries()) {
      m[nome] = (await c.query(
        `insert into missoes (exam_tag, materia_codigo, assunto_id, nivel, nome, objetivo, criterio_conclusao,
                              xp_sugerido, ordem, meta_questoes, meta_acuracia)
         values ('espcex', 'mat', $1, 'base', $2, 'teste P1.1', '3 questões a 60%', 40, $3, 3, 60)
         returning id, assunto_id`, [assunto, nome, -10 + i])).rows[0];
      await c.query(`insert into app.quest_filtros_missao (missao_id, materia, assunto, ativo)
                     values ($1, 'Matemática', $2, true)`, [m[nome].id, nome]);
    }
    return await fn(c, { ...rows[0], m });
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

const questao = (i, gabarito = "B", extra = {}) => ({
  id_externo: `qt-${i}`, banca: i % 2 ? "FGV" : "CESGRANRIO", orgao: "PMERJ", cargo: "Oficial", ano: 2024,
  materia: "Matemática", assunto: "Funções", tipo: "multipla_escolha", enunciado: `Enunciado ${i}`,
  alternativas: ["A", "B", "C", "D", "E"].map((l) => ({ letra: l, texto: `alt ${l}` })), gabarito, ...extra,
});

const guardar = (c, missao, itens, cursor = "cursor-2", esgotada = false) =>
  c.query("select public.quest_guardar_questoes($1, $2::jsonb, $3, $4) as n",
    [missao, JSON.stringify(itens), cursor, esgotada]).then((r) => r.rows[0].n);

const uuid = async (c) => (await c.query("select gen_random_uuid() as u")).rows[0].u;

const preparar = async (c, al, missao, { pedido, tamanho = null, semBusca = false } = {}) =>
  (await c.query("select public.quest_preparar_entrega($1, $2, $3, $4, $5, $6) as r",
    [al.usuario, al.escola, missao, pedido ?? await uuid(c), tamanho, semBusca])).rows[0].r;

const responder = async (c, al, entrega, questao, resposta, ms = 30000) =>
  (await c.query("select public.quest_responder($1, $2, $3, $4, $5, $6) as r",
    [al.usuario, al.escola, entrega, questao, resposta, ms])).rows[0].r;

const missoes = async (c, aluno) => (await c.query(
  `select m.nome, am.estado, am.questoes_acumuladas as q
     from aluno_missoes am join missoes m on m.id = am.missao_id
    where am.aluno_id = $1 and m.materia_codigo = 'mat' order by m.ordem`, [aluno])).rows
  .map((x) => [x.nome, x.estado, x.q]);

// só o XP das missões do teste: o aluno da seed pode ter outras concluídas
const ledger = async (c, al) => (await c.query(
  `select count(*) filter (where status = 'valido')::int as validas,
          coalesce(sum(xp_delta) filter (where status = 'valido'), 0)::int as xp
     from aluno_eventos_progresso
    where aluno_id = $1 and tipo_evento = 'missao_concluida' and referencia_id = any ($2::uuid[])`,
  [al.aluno, [al.m[M1].id, al.m[M2].id]])).rows[0];

const registros = async (c, aluno) => (await c.query(
  `select questoes, acertos, minutos, tipo_pratica, missao_id from registros_estudo
    where aluno_id = $1 and disciplina_codigo = 'mat'
    order by tipo_pratica = 'revisao', criado_em, id`, [aluno])).rows;   // mesma transação: criado_em empata

// ── entrega ──────────────────────────────────────────────────────────

test("sem questão guardada, a entrega pede busca com o filtro da missão; depois do guardar, entrega sem gabarito", async () => {
  await emTransacao(async (c, al) => {
    const r1 = await preparar(c, al, al.m[M1].id, { tamanho: 3 });
    assert.equal(r1.estado, "buscar");
    assert.deepEqual(r1.filtro, { materia: "Matemática", assunto: M1, assunto_id: null, cursor: null });
    assert.equal(r1.faltam, 3, "pede à Quest só o que falta para o lote");
    assert.equal(await guardar(c, al.m[M1].id, [1, 2, 3, 4].map((i) => questao(i))), 4);

    const r2 = await preparar(c, al, al.m[M1].id, { tamanho: 3, semBusca: true });
    assert.equal(r2.estado, "ok");
    assert.equal(r2.entrega.tipo_pratica, "missao");
    assert.equal(r2.entrega.questoes.length, 3);
    const texto = JSON.stringify(r2.entrega);
    assert.ok(!/gabarito/.test(texto), "o lote não leva gabarito antes da resposta");
    assert.ok(r2.entrega.questoes.every((q) => q.respondida === false && q.alternativas.length === 5));
  });
});

test("créditos: questão guardada serve outro aluno, de outra escola, sem pedir busca à Quest", async () => {
  await emTransacao(async (c, al) => {
    await guardar(c, al.m[M1].id, [1, 2, 3, 4, 5].map((i) => questao(i)));
    const a = await preparar(c, al, al.m[M1].id, { tamanho: 3 });
    assert.equal(a.estado, "ok", "com estoque, nem o primeiro aluno pede busca");
    // segundo aluno da EsPCEx, de outra escola
    const b = (await c.query(`
      select a.usuario_id as usuario, a.escola_id as escola from alunos a join concursos c on c.id = a.concurso_id
       where c.codigo = 'espcex' and a.usuario_id is not null and a.escola_id <> $1
         and not exists (select 1 from registros_estudo r where r.aluno_id = a.id and r.disciplina_codigo = 'mat')
       order by a.id limit 1`, [al.escola])).rows[0]
      ?? (await c.query(`
      select a.usuario_id as usuario, a.escola_id as escola from alunos a join concursos c on c.id = a.concurso_id
       where c.codigo = 'espcex' and a.usuario_id is not null and a.usuario_id <> $1
         and not exists (select 1 from registros_estudo r where r.aluno_id = a.id and r.disciplina_codigo = 'mat')
       order by a.id limit 1`, [al.usuario])).rows[0];
    assert.ok(b, "a seed precisa de outro aluno da EsPCEx");
    const rb = await preparar(c, b, al.m[M1].id, { tamanho: 5, semBusca: false });
    assert.equal(rb.estado, "ok", "o estoque guardado fecha o lote do segundo aluno: nenhuma chamada nova");
    assert.equal(rb.entrega.questoes.length, 5);
    const n = (await c.query("select count(*)::int as n from app.quest_questoes")).rows[0].n;
    assert.equal(n, 5, "as mesmas 5 linhas servem aos dois");
    // com o estoque esgotado para ele, pede só o que falta
    const rc = await preparar(c, b, al.m[M1].id, { tamanho: 5 });
    assert.equal(rc.retomado, true, "lote aberto é retomado, não gera busca");
  });
});

test("pedido repetido devolve o mesmo lote; lote aberto da missão é retomado em vez de gastar outro", async () => {
  await emTransacao(async (c, al) => {
    await guardar(c, al.m[M1].id, [1, 2, 3, 4, 5, 6].map((i) => questao(i)));
    const pedido = await uuid(c);
    const a = await preparar(c, al, al.m[M1].id, { pedido, tamanho: 3, semBusca: true });
    const b = await preparar(c, al, al.m[M1].id, { pedido, tamanho: 3, semBusca: true });
    assert.equal(b.repetido, true);
    assert.equal(b.entrega.id, a.entrega.id);
    const d = await preparar(c, al, al.m[M1].id, { tamanho: 3, semBusca: true });
    assert.equal(d.retomado, true);
    assert.equal(d.entrega.id, a.entrega.id);
    assert.equal((await c.query("select count(*)::int as n from app.quest_entregas where aluno_id = $1", [al.aluno])).rows[0].n, 1);
  });
});

test("missão fora da vez, de outro concurso ou sem filtro ativo não entrega", async () => {
  await emTransacao(async (c, al) => {
    await guardar(c, al.m[M2].id, [1, 2, 3].map((i) => questao(i)));
    assert.equal((await preparar(c, al, al.m[M2].id, { semBusca: true })).estado, "fora_da_vez",
      "a M2 só depois de começar a M1");
    const cn = (await c.query(`select id from missoes where exam_tag = 'cn' order by id limit 1`)).rows[0].id;
    assert.equal((await preparar(c, al, cn)).estado, "missao_invalida");
    await c.query("update app.quest_filtros_missao set ativo = false where missao_id = $1", [al.m[M1].id]);
    assert.equal((await preparar(c, al, al.m[M1].id)).estado, "indisponivel");
    await c.query("update app.quest_filtros_missao set ativo = true where missao_id = $1", [al.m[M1].id]);
    await c.query(`insert into missoes_escola (escola_id, missao_id, ativa) values ($1, $2, false)
                   on conflict (escola_id, missao_id) do update set ativa = false`, [al.escola, al.m[M1].id]);
    assert.equal((await preparar(c, al, al.m[M1].id)).estado, "missao_invalida");
  });
});

test("usuário que não é aluno da escola informada não recebe lote", async () => {
  await emTransacao(async (c, al) => {
    await guardar(c, al.m[M1].id, [1, 2, 3].map((i) => questao(i)));
    const outra = (await c.query("select id from escolas where id <> $1 limit 1", [al.escola])).rows[0].id;
    assert.equal((await preparar(c, { ...al, escola: outra }, al.m[M1].id, { semBusca: true })).estado, "sem_aluno");
    assert.equal((await preparar(c, { ...al, usuario: IDS.coordA.sub }, al.m[M1].id, { semBusca: true })).estado, "sem_aluno");
  });
});

test("Quest fora do ar e nada guardado: sem_questoes, e o registro manual segue funcionando", async () => {
  await emTransacao(async (c, al) => {
    const r = await preparar(c, al, al.m[M1].id, { semBusca: true });
    assert.equal(r.estado, "sem_questoes");
    const reg = await c.query(
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, tipo_pratica, missao_id)
       values ($1, $2, current_date, 'mat', 'manual', 2, 2, 'missao', $3) returning id`, [al.escola, al.aluno, al.m[M1].id]);
    assert.ok(reg.rows[0].id);
    assert.deepEqual(await missoes(c, al.aluno), [[M1, "em_andamento", 2]]);
  });
});

test("busca recente não se repete; filtro esgotado entrega o que tem", async () => {
  await emTransacao(async (c, al) => {
    assert.equal((await preparar(c, al, al.m[M1].id, { tamanho: 3 })).estado, "buscar");
    // a segunda chamada logo em seguida não manda buscar de novo
    assert.equal((await preparar(c, al, al.m[M1].id, { tamanho: 3 })).estado, "sem_questoes");
    await guardar(c, al.m[M1].id, [questao(1)], "cursor-2", true);
    await c.query("update app.quest_filtros_missao set ultima_busca_em = null where missao_id = $1", [al.m[M1].id]);
    const r = await preparar(c, al, al.m[M1].id, { tamanho: 3 });
    assert.equal(r.estado, "ok", "esgotado: não pede busca, entrega a única que há");
    assert.equal(r.entrega.questoes.length, 1);
  });
});

test("limite por aluno: questões por dia e lotes por hora", async () => {
  await emTransacao(async (c, al) => {
    const lim = (await c.query("select app.quest_limites() as l")).rows[0].l;
    await guardar(c, al.m[M1].id, Array.from({ length: 30 }, (_, i) => questao(i)));
    // simula o dia já consumido: lotes no começo do dia local (não depende
    // da hora em que o teste roda), poucos para não bater o limite por hora
    await c.query(
      `insert into app.quest_entregas (pedido_id, escola_id, aluno_id, missao_id, tipo_pratica, questoes, criada_em, expira_em)
       select gen_random_uuid(), $1, $2, $3, 'missao',
              array(select gen_random_uuid() from generate_series(1, 40)),
              (app.hoje_local()::timestamp at time zone 'America/Sao_Paulo') + interval '1 second',
              now() - interval '1 second'
         from generate_series(1, ceil($4 / 40.0)::int)`, [al.escola, al.aluno, al.m[M1].id, lim.questoes_dia]);
    assert.deepEqual(await preparar(c, al, al.m[M1].id, { semBusca: true }), { estado: "limite", motivo: "questoes_dia" });
    await c.query("delete from app.quest_entregas where aluno_id = $1", [al.aluno]);
    await c.query(
      `insert into app.quest_entregas (pedido_id, escola_id, aluno_id, missao_id, tipo_pratica, questoes, criada_em, expira_em)
       select gen_random_uuid(), $1, $2, $3, 'missao', array[gen_random_uuid()], now() - interval '10 minutes', now() - interval '1 minute'
         from generate_series(1, $4)`, [al.escola, al.aluno, al.m[M1].id, lim.lotes_hora]);
    assert.deepEqual(await preparar(c, al, al.m[M1].id, { semBusca: true }), { estado: "limite", motivo: "lotes_hora" });
  });
});

// ── resposta ─────────────────────────────────────────────────────────

test("corrige no servidor; retransmitir (mesma ou outra resposta) não grava de novo nem duplica registro", async () => {
  await emTransacao(async (c, al) => {
    await guardar(c, al.m[M1].id, [1, 2, 3, 4].map((i) => questao(i, "C")));
    const { entrega } = await preparar(c, al, al.m[M1].id, { tamanho: 4, semBusca: true });
    const q = entrega.questoes[0].id;
    const r1 = await responder(c, al, entrega.id, q, "c");
    assert.equal(r1.estado, "ok");
    assert.equal(r1.acerto, true);
    assert.equal(r1.gabarito, "C");
    assert.equal(r1.repetida, false);
    const r2 = await responder(c, al, entrega.id, q, "C");
    const r3 = await responder(c, al, entrega.id, q, "A");
    assert.equal(r2.repetida, true);
    assert.equal(r3.repetida, true);
    assert.equal(r3.acerto, true, "a primeira correção vale");
    assert.equal((await c.query("select count(*)::int as n from app.quest_tentativas where aluno_id = $1", [al.aluno])).rows[0].n, 1);
    assert.deepEqual((await registros(c, al.aluno)).map((r) => [r.questoes, r.acertos, r.tipo_pratica]), [[1, 1, "missao"]]);
  });
});

test("resposta inválida, questão fora do lote, lote de outro aluno e lote vencido são recusados sem gravar", async () => {
  await emTransacao(async (c, al) => {
    await guardar(c, al.m[M1].id, [1, 2, 3, 4].map((i) => questao(i)));
    const { entrega } = await preparar(c, al, al.m[M1].id, { tamanho: 2, semBusca: true });
    const q = entrega.questoes[0].id;
    assert.equal((await responder(c, al, entrega.id, q, "Z")).estado, "resposta_invalida");
    assert.equal((await responder(c, al, entrega.id, q, "")).estado, "resposta_invalida");
    const fora = (await c.query("select id from app.quest_questoes where id <> all ($1::uuid[]) limit 1",
      [entrega.questoes.map((x) => x.id)])).rows[0].id;
    assert.equal((await responder(c, al, entrega.id, fora, "B")).estado, "nao_encontrada");
    const outro = (await c.query(
      "select usuario_id from alunos where escola_id = $1 and usuario_id is not null and id <> $2 limit 1",
      [al.escola, al.aluno])).rows[0].usuario_id;
    assert.equal((await responder(c, { ...al, usuario: outro }, entrega.id, q, "B")).estado, "nao_encontrada");
    await c.query("update app.quest_entregas set expira_em = now() - interval '1 second' where id = $1", [entrega.id]);
    assert.equal((await responder(c, al, entrega.id, q, "B")).estado, "expirada");
    assert.equal((await c.query("select count(*)::int as n from app.quest_tentativas")).rows[0].n, 0);
    assert.deepEqual(await registros(c, al.aluno), []);
  });
});

test("as respostas do lote somam num registro só, que conta para a missão pelo caminho da 0064", async () => {
  await emTransacao(async (c, al) => {
    await guardar(c, al.m[M1].id, [1, 2, 3, 4, 5].map((i) => questao(i, "B")));
    const { entrega } = await preparar(c, al, al.m[M1].id, { tamanho: 2, semBusca: true });
    await responder(c, al, entrega.id, entrega.questoes[0].id, "B", 60000);
    const r = await responder(c, al, entrega.id, entrega.questoes[1].id, "A", 60000);
    assert.deepEqual(r.lote, { total: 2, respondidas: 2, acertos: 1 });
    const regs = await registros(c, al.aluno);
    assert.equal(regs.length, 1);
    assert.equal(regs[0].questoes, 2);
    assert.equal(regs[0].acertos, 1);
    assert.equal(regs[0].minutos, 2);
    assert.equal(regs[0].missao_id, al.m[M1].id);
    assert.deepEqual(await missoes(c, al.aluno), [[M1, "em_andamento", 2]]);
  });
});

test("a missão fecha na resposta certa; as seguintes do lote viram revisão e não reabrem nem duplicam XP", async () => {
  await emTransacao(async (c, al) => {
    await guardar(c, al.m[M1].id, [1, 2, 3, 4, 5].map((i) => questao(i, "B")));
    const { entrega } = await preparar(c, al, al.m[M1].id, { tamanho: 5, semBusca: true });
    const ids = entrega.questoes.map((q) => q.id);
    await responder(c, al, entrega.id, ids[0], "B");
    await responder(c, al, entrega.id, ids[1], "B");
    const fecha = await responder(c, al, entrega.id, ids[2], "B");   // 3 de 3: meta 3 a 60%
    assert.equal(fecha.missao_concluida, true);
    assert.deepEqual(await missoes(c, al.aluno), [[M1, "concluida", 3]]);
    const xp = await ledger(c, al);
    assert.deepEqual(xp, { validas: 1, xp: 40 });
    // duas erradas depois: na regra do registro inteiro, 3/5 = 60% ainda; 3/6 reabriria
    await responder(c, al, entrega.id, ids[3], "A");
    await responder(c, al, entrega.id, ids[4], "A");
    assert.deepEqual(await missoes(c, al.aluno), [[M1, "concluida", 3]]);
    assert.deepEqual(await ledger(c, al), xp);
    const regs = await registros(c, al.aluno);
    assert.deepEqual(regs.map((r) => [r.questoes, r.acertos, r.tipo_pratica]), [[3, 3, "missao"], [2, 0, "revisao"]]);
    // a M2 não ganha nada da revisão
    assert.equal((await c.query("select count(*)::int as n from aluno_missoes where aluno_id = $1 and missao_id = $2",
      [al.aluno, al.m[M2].id])).rows[0].n, 0);
    // e a próxima entrega é da M2, a da vez
    await guardar(c, al.m[M2].id, [10, 11].map((i) => questao(i)));
    assert.equal((await preparar(c, al, al.m[M2].id, { semBusca: true })).entrega.tipo_pratica, "missao");
    assert.equal((await preparar(c, al, al.m[M1].id, { semBusca: true })).estado, "sem_questoes",
      "revisão da M1 só com questão que o aluno ainda não respondeu");
  });
});

test("questão já respondida não volta em lote novo (repetição não vira questão inédita)", async () => {
  await emTransacao(async (c, al) => {
    await guardar(c, al.m[M1].id, [1, 2].map((i) => questao(i)));
    const a = (await preparar(c, al, al.m[M1].id, { tamanho: 1, semBusca: true })).entrega;
    await responder(c, al, a.id, a.questoes[0].id, "A");
    const b = (await preparar(c, al, al.m[M1].id, { tamanho: 5, semBusca: true })).entrega;
    assert.deepEqual(b.questoes.map((q) => q.id).includes(a.questoes[0].id), false);
    assert.equal(b.questoes.length, 1);
  });
});

test("gabarito trocado na Quest sobe a versão; anulada sai dos lotes e não é corrigida", async () => {
  await emTransacao(async (c, al) => {
    await guardar(c, al.m[M1].id, [questao(1, "B"), questao(2, "B")]);
    const { entrega } = await preparar(c, al, al.m[M1].id, { tamanho: 2, semBusca: true });
    const id = async (ext) => (await c.query("select id from app.quest_questoes where id_externo = $1", [ext])).rows[0].id;
    await responder(c, al, entrega.id, await id("qt-1"), "B");
    await guardar(c, al.m[M1].id, [questao(1, "D"), questao(2, "B", { anulada: true })]);
    const v = (await c.query("select id_externo, gabarito, gabarito_versao from app.quest_questoes order by id_externo")).rows;
    assert.deepEqual(v.map((x) => [x.id_externo, x.gabarito, x.gabarito_versao]), [["qt-1", "D", 2], ["qt-2", "B", 1]]);
    const t = (await c.query("select gabarito_versao, acerto from app.quest_tentativas")).rows[0];
    assert.deepEqual(t, { gabarito_versao: 1, acerto: true }, "a tentativa guarda a versão com que foi corrigida");
    assert.equal((await responder(c, al, entrega.id, await id("qt-2"), "B")).estado, "anulada");
    assert.equal((await c.query("select count(*)::int as n from app.quest_tentativas")).rows[0].n, 1);
  });
});

test("missão desativada entre o lote e a resposta: a tentativa vale e soma volume como livre no assunto", async () => {
  await emTransacao(async (c, al) => {
    await guardar(c, al.m[M1].id, [1, 2].map((i) => questao(i)));
    const { entrega } = await preparar(c, al, al.m[M1].id, { tamanho: 2, semBusca: true });
    await c.query(`insert into missoes_escola (escola_id, missao_id, ativa) values ($1, $2, false)
                   on conflict (escola_id, missao_id) do update set ativa = false`, [al.escola, al.m[M1].id]);
    const r = await responder(c, al, entrega.id, entrega.questoes[0].id, "B");
    assert.equal(r.estado, "ok");
    const regs = (await c.query("select tipo_pratica, missao_id, assunto_id from registros_estudo where aluno_id = $1 and disciplina_codigo = 'mat'",
      [al.aluno])).rows;
    assert.deepEqual(regs, [{ tipo_pratica: "livre", missao_id: null, assunto_id: al.m[M1].assunto_id }]);
    assert.deepEqual(await missoes(c, al.aluno), []);
  });
});

// ── guarda e privilégios ─────────────────────────────────────────────

test("o aluno não edita nem apaga pelo app o registro corrigido no servidor; o registro manual segue editável", async () => {
  await emTransacao(async (c, al) => {
    await guardar(c, al.m[M1].id, [1, 2].map((i) => questao(i)));
    const { entrega } = await preparar(c, al, al.m[M1].id, { tamanho: 1, semBusca: true });
    await responder(c, al, entrega.id, entrega.questoes[0].id, "A");
    const reg = (await c.query("select registro_id from app.quest_entregas where id = $1", [entrega.id])).rows[0].registro_id;
    const manual = (await c.query(
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos)
       values ($1, $2, current_date, 'mat', 'manual', 5, 3) returning id`, [al.escola, al.aluno])).rows[0].id;
    await c.query(`select set_config('request.jwt.claims', '{"role":"authenticated"}', true)`);
    await esperaErro(c, /questões corrigidas no servidor/, "update registros_estudo set acertos = 1 where id = $1", [reg]);
    await esperaErro(c, /questões corrigidas no servidor/, "delete from registros_estudo where id = $1", [reg]);
    await c.query("update registros_estudo set acertos = 4 where id = $1", [manual]);
    await c.query("delete from registros_estudo where id = $1", [manual]);
    // a exclusão LGPD do aluno (servidor) passa e leva as tentativas
    await c.query(`select set_config('request.jwt.claims', '{"role":"service_role"}', true)`);
    await c.query("select app.lgpd_excluir($1)", [al.aluno]);
    assert.equal((await c.query("select count(*)::int as n from app.quest_tentativas where aluno_id = $1", [al.aluno])).rows[0].n, 0);
  });
});

test("cascata da exclusão do aluno feita por cliente não é barrada pela guarda", async () => {
  await emTransacao(async (c, al) => {
    await guardar(c, al.m[M1].id, [1].map((i) => questao(i)));
    const { entrega } = await preparar(c, al, al.m[M1].id, { tamanho: 1, semBusca: true });
    await responder(c, al, entrega.id, entrega.questoes[0].id, "A");
    await c.query(`select set_config('request.jwt.claims', '{"role":"authenticated"}', true)`);
    await c.query("delete from alunos where id = $1", [al.aluno]);
    assert.equal((await c.query("select count(*)::int as n from registros_estudo where aluno_id = $1", [al.aluno])).rows[0].n, 0);
  });
});

test("LGPD: o dossiê leva as tentativas, sem enunciado", async () => {
  await emTransacao(async (c, al) => {
    await guardar(c, al.m[M1].id, [1].map((i) => questao(i)));
    const { entrega } = await preparar(c, al, al.m[M1].id, { tamanho: 1, semBusca: true });
    await responder(c, al, entrega.id, entrega.questoes[0].id, "A", 1234);
    const d = (await c.query("select app.lgpd_exportar($1) as d", [al.aluno])).rows[0].d;
    assert.equal(d.questoes_integradas.length, 1);
    assert.equal(d.questoes_integradas[0].questao, "qt-1");
    assert.equal(d.questoes_integradas[0].duracao_ms, 1234);
    assert.ok(!JSON.stringify(d.questoes_integradas).includes("Enunciado"));
  });
});

test("pela RLS: aluno e coordenação não leem gabarito, tentativa nem lote, nem chamam as funções de serviço", async () => {
  for (const quem of [IDS.alunoA, IDS.coordA, null]) {
    await como(quem, async (c) => {
      for (const t of ["quest_questoes", "quest_tentativas", "quest_entregas", "quest_filtros_missao", "quest_questao_missao"]) {
        await esperaErro(c, /permission denied/, `select * from app.${t} limit 1`);
      }
      await esperaErro(c, /permission denied/,
        "select public.quest_responder(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'A', 1)");
      await esperaErro(c, /permission denied/,
        "select public.quest_preparar_entrega(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 1, true)");
      await esperaErro(c, /permission denied/, "select public.quest_guardar_questoes(gen_random_uuid(), '[]', 'c1', false)");
    });
  }
});

test("quest_missoes_disponiveis: só missões ativas do concurso do próprio aluno, e nada para anon", async () => {
  const c0 = await pool.connect();
  try {
    await c0.query("begin");
    const { rows } = await c0.query(
      `select m.id, c.codigo from alunos a join concursos c on c.id = a.concurso_id
         join missoes m on m.exam_tag = c.codigo where a.usuario_id = $1 limit 1`, [IDS.alunoA.sub]);
    const outra = (await c0.query(`select id from missoes where exam_tag <> $1 limit 1`, [rows[0].codigo])).rows[0].id;
    await c0.query(`insert into app.quest_filtros_missao (missao_id, materia, ativo) values ($1, 'x', true), ($2, 'y', true)`,
      [rows[0].id, outra]);
    const claims = JSON.stringify({ sub: IDS.alunoA.sub, role: "authenticated",
      app_metadata: { escola_id: ESCOLA_A, papel: "aluno" } });
    await c0.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    await c0.query("set local role authenticated");
    const ids = (await c0.query("select public.quest_missoes_disponiveis() as id")).rows.map((r) => r.id);
    assert.deepEqual(ids, [rows[0].id]);
    await c0.query("reset role");
    await c0.query("set local role anon");
    await esperaErro(c0, /permission denied/, "select public.quest_missoes_disponiveis()");
  } finally {
    await c0.query("rollback").catch(() => {});
    c0.release();
  }
});
