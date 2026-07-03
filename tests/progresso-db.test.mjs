// ============================================================
// MOTOR DE PROGRESSO (Fase C0) — BANCO, RLS, GATILHOS, IDEMPOTÊNCIA
// ------------------------------------------------------------
// O aluno escreve só o que já podia (registro/objetivo/simulado); o
// GATILHO SECURITY DEFINER deriva o evento de progresso e o XP. O
// aluno NÃO grava XP/conquista/patente direto. Idempotência por
// idempotency_key: duplo clique / reabrir+concluir não dobra XP.
// Isolamento por escola continua valendo (doutrina 0002).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, comoServidor, esperaErro, IDS, ESCOLA_A, ESCOLA_B, ALUNO_LUCAS, ALUNO_BRUNO } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

test("registrar estudo gera evento de progresso (xp 0) — e NÃO grava mais conquista (FIX2 0037)", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query(
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, minutos)
       values ($1,$2, current_date, 'mat', 'Teste C0', 20, 15, 30) returning id`,
      [ESCOLA_A, ALUNO_LUCAS],
    );
    const regId = r.rows[0].id;
    const ev = await c.query(
      "select tipo_evento, xp_delta, status from aluno_eventos_progresso where referencia_id=$1 and tipo_evento='registro_estudo'",
      [regId],
    );
    assert.equal(ev.rows.length, 1, "um evento por registro");
    assert.equal(ev.rows[0].xp_delta, 0, "registro não pontua (anti-grind)");
    // FIX2 (0037): a escrita de conquistas foi deprecada nos dois motores —
    // o registro NÃO desbloqueia mais 'primeiro_registro' (a aba Conquistas
    // do aluno deriva no cliente; duplicação fechada).
    const conq = await c.query(
      "select count(*)::int n from aluno_conquistas ac join conquistas q on q.id=ac.conquista_id where ac.aluno_id=$1 and q.codigo='primeiro_registro'",
      [ALUNO_LUCAS],
    );
    assert.equal(conq.rows[0].n, 0, "escrita de conquista deveria estar desligada (0037)");
  });
});

test("finalizar simulado gera evento com XP fixo (50)", async () => {
  await como(IDS.alunoA, async (c) => {
    const s = await c.query(
      `insert into simulados (escola_id, aluno_id, nome, data, acertos) values ($1,$2,'Simulado C0', current_date, '{"mat": 18}'::jsonb) returning id`,
      [ESCOLA_A, ALUNO_LUCAS],
    );
    const ev = await c.query(
      "select xp_delta, tipo_evento from aluno_eventos_progresso where referencia_id=$1 and tipo_evento='simulado_finalizado'",
      [s.rows[0].id],
    );
    assert.equal(ev.rows.length, 1);
    assert.equal(ev.rows[0].xp_delta, 50);
  });
});

test("concluir objetivo de missão gera evento com XP por prioridade — e NÃO duplica ao reabrir/reconcluir", async () => {
  await como(IDS.alunoA, async (c) => {
    // pega um objetivo pendente do próprio aluno
    const ma = await c.query(
      `select ma.id, am.prioridade from meta_atividades ma
         join metas m on m.id = ma.meta_id
         left join atividades_modelo am on am.id = ma.atividade_modelo_id
        where m.aluno_id=$1 and ma.estado='pendente' limit 1`,
      [ALUNO_LUCAS],
    );
    assert.ok(ma.rows.length === 1, "o aluno tem objetivo pendente no seed");
    const maId = ma.rows[0].id;
    const prio = ma.rows[0].prioridade;
    const xpEsperado = prio === "F" ? 100 : prio === "P" ? 60 : 40;

    // concluir
    await c.query("update meta_atividades set estado='concluida' where id=$1", [maId]);
    let ev = await c.query(
      "select xp_delta from aluno_eventos_progresso where referencia_id=$1 and tipo_evento='missao_concluida'",
      [maId],
    );
    assert.equal(ev.rows.length, 1, "um evento ao concluir");
    assert.equal(ev.rows[0].xp_delta, xpEsperado, "XP pela prioridade");

    // reabrir e reconcluir (simula duplo clique / refresh)
    await c.query("update meta_atividades set estado='pendente'  where id=$1", [maId]);
    await c.query("update meta_atividades set estado='concluida' where id=$1", [maId]);
    ev = await c.query(
      "select count(*)::int n from aluno_eventos_progresso where referencia_id=$1 and tipo_evento='missao_concluida'",
      [maId],
    );
    assert.equal(ev.rows[0].n, 1, "idempotência: reabrir+concluir não dobra o evento/XP");
  });
});

test("o ALUNO não escreve XP/evento direto (RLS barra o insert)", async () => {
  await como(IDS.alunoA, async (c) => {
    await esperaErro(c, /row-level security/i,
      `insert into aluno_eventos_progresso (escola_id, aluno_id, tipo_evento, origem, xp_delta, idempotency_key)
       values ($1,$2,'ajuste_coordenacao','hack',99999,'hack:'||gen_random_uuid())`,
      [ESCOLA_A, ALUNO_LUCAS]);
    // nem fingindo ser registro/missão
    await esperaErro(c, /row-level security/i,
      `insert into aluno_eventos_progresso (escola_id, aluno_id, tipo_evento, origem, xp_delta, idempotency_key)
       values ($1,$2,'missao_concluida','hack',99999,'hack:'||gen_random_uuid())`,
      [ESCOLA_A, ALUNO_LUCAS]);
  });
});

test("a COORDENAÇÃO lança só ajuste_coordenacao; não pode forjar registro/missão", async () => {
  await como(IDS.coordA, async (c) => {
    // ajuste manual legítimo passa
    await c.query(
      `insert into aluno_eventos_progresso (escola_id, aluno_id, exam_tag, tipo_evento, origem, xp_delta, metadata, idempotency_key, criado_por)
       values ($1,$2,'cn','ajuste_coordenacao','coordenacao',25,'{"motivo":"reconhecimento"}'::jsonb,'ajuste:'||gen_random_uuid(),$3)`,
      [ESCOLA_A, ALUNO_LUCAS, IDS.coordA.sub]);
    // forjar um registro_estudo (tipo proibido para insert manual) é recusado
    await esperaErro(c, /row-level security/i,
      `insert into aluno_eventos_progresso (escola_id, aluno_id, tipo_evento, origem, xp_delta, idempotency_key)
       values ($1,$2,'registro_estudo','forja',99999,'forja:'||gen_random_uuid())`,
      [ESCOLA_A, ALUNO_LUCAS]);
  });
});

test("isolamento: escola A não enxerga eventos de progresso da escola B", async () => {
  await como(IDS.coordA, async (c) => {
    const r = await c.query("select count(*)::int n from aluno_eventos_progresso where escola_id=$1", [ESCOLA_B]);
    assert.equal(r.rows[0].n, 0);
    const r2 = await c.query("select count(*)::int n from aluno_eventos_progresso where aluno_id=$1", [ALUNO_BRUNO]);
    assert.equal(r2.rows[0].n, 0);
  });
});

test("a coordenação NÃO consegue inserir evento mirando outra escola (tenant forjado)", async () => {
  await como(IDS.coordA, async (c) => {
    await esperaErro(c, /row-level security/i,
      `insert into aluno_eventos_progresso (escola_id, aluno_id, tipo_evento, origem, xp_delta, idempotency_key)
       values ($1,$2,'ajuste_coordenacao','x',10,'x:'||gen_random_uuid())`,
      [ESCOLA_B, ALUNO_BRUNO]);
  });
});

test("o responsável lê eventos do aluno vinculado; não lê os de não-vinculado", async () => {
  await como(IDS.respA, async (c) => {
    // garante que Lucas tenha ao menos um evento (do seed/backfill via gatilho)
    const ok = await c.query("select count(*)::int n from aluno_eventos_progresso where aluno_id=$1", [ALUNO_LUCAS]);
    assert.ok(ok.rows[0].n >= 1, "responsável vê progresso do vinculado");
    const nao = await c.query("select count(*)::int n from aluno_eventos_progresso where aluno_id=$1", [ALUNO_BRUNO]);
    assert.equal(nao.rows[0].n, 0, "não vê de aluno não-vinculado");
  });
});

test("a view de XP total respeita a RLS (aluno vê o próprio total)", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query(
      "select coalesce(sum(xp_total),0)::int xp from vw_aluno_xp_total where aluno_id=$1",
      [ALUNO_LUCAS],
    );
    assert.ok(r.rows[0].xp >= 0, "total agregado disponível e não-negativo");
    // não vê o total do Bruno (escola B)
    const b = await c.query("select count(*)::int n from vw_aluno_xp_total where aluno_id=$1", [ALUNO_BRUNO]);
    assert.equal(b.rows[0].n, 0);
  });
});

test("backfill (operador) é idempotente: gatilhos já cobriram tudo, então não cria evento novo", async () => {
  // backfill é ferramenta de servidor (service_role). Como os gatilhos
  // já geraram os eventos no seed e a idempotency_key é compartilhada,
  // a passada do backfill não acrescenta nada — prova a deduplicação.
  await comoServidor(async (c) => {
    await c.query("begin");
    const n1 = await c.query("select app.backfill_progresso($1)::int as n", [ESCOLA_A]);
    const n2 = await c.query("select app.backfill_progresso($1)::int as n", [ESCOLA_A]);
    assert.equal(n1.rows[0].n, 0, "nada a recriar: gatilhos já cobriram");
    assert.equal(n2.rows[0].n, 0, "2ª passada também não duplica");
    await c.query("rollback");
  });
});
