// ============================================================
// FIX2 (0037) — DUPLICAÇÃO DE CONQUISTAS FECHADA
// ------------------------------------------------------------
// A REG1 (item 1.8) encontrou DOIS motores de servidor escrevendo
// em aluno_conquistas (C0/0024 'primeira vez' e PED1/0033 premiada)
// com ZERO leitores na UI. A 0037 transformou os dois escritores em
// no-op, preservando tudo que a tela consome. Aqui provamos:
//   • ação do aluno (registro) NÃO cria conquista nem evento
//     'conquista_desbloqueada' — nos DOIS caminhos;
//   • o que a UI usa segue vivo: evento de registro no ledger,
//     missão fechando com XP (PED1) e nível persistido;
//   • o histórico existente não foi apagado (seed preservado);
//   • RLS: aluno continua sem poder gravar conquista direto.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, esperaErro, IDS, ESCOLA_A, ALUNO_LUCAS } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

test("FIX2: registro de estudo não gera conquista nem evento de conquista (motores no-op)", async () => {
  await como(IDS.alunoA, async (c) => {
    const antes = await c.query(
      "select (select count(*)::int from aluno_conquistas where aluno_id=$1) as conq, (select count(*)::int from aluno_eventos_progresso where aluno_id=$1 and tipo_evento='conquista_desbloqueada') as ev",
      [ALUNO_LUCAS]);

    // dispara os DOIS gatilhos de registros_estudo (C0 + PED1) com volume
    // que fecharia missão e conquista de volume na regra antiga
    await c.query(
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, minutos)
       values ($1,$2, current_date, 'mat', 'FIX2 prova', 60, 55, 90)`,
      [ESCOLA_A, ALUNO_LUCAS]);
    // e reprocessa o motor PED1 explicitamente (caminho premiado)
    await c.query("select app.motor_avaliar_aluno($1)", [ALUNO_LUCAS]);

    const depois = await c.query(
      "select (select count(*)::int from aluno_conquistas where aluno_id=$1) as conq, (select count(*)::int from aluno_eventos_progresso where aluno_id=$1 and tipo_evento='conquista_desbloqueada') as ev",
      [ALUNO_LUCAS]);

    assert.equal(depois.rows[0].conq, antes.rows[0].conq, "aluno_conquistas não deve crescer (0037)");
    assert.equal(depois.rows[0].ev, antes.rows[0].ev, "nenhum evento conquista_desbloqueada novo (0037)");
  });
});

test("FIX2: o que a UI consome segue vivo — evento de registro, missão fecha e nível persiste", async () => {
  await como(IDS.alunoA, async (c) => {
    await c.query(
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, minutos)
       values ($1,$2, current_date, 'mat', 'FIX2 vivo', 70, 65, 90)`,
      [ESCOLA_A, ALUNO_LUCAS]);

    const ev = await c.query(
      "select count(*)::int n from aluno_eventos_progresso where aluno_id=$1 and tipo_evento='registro_estudo' and metadata->>'topico' is distinct from 'nunca'",
      [ALUNO_LUCAS]);
    assert.ok(ev.rows[0].n >= 1, "evento de registro segue sendo gravado");

    const mis = await c.query(
      `select count(*)::int n from aluno_missoes am join missoes m on m.id=am.missao_id
        where am.aluno_id=$1 and am.estado='concluida' and m.materia_codigo='mat'`, [ALUNO_LUCAS]);
    assert.ok(mis.rows[0].n >= 1, "missão de matéria segue fechando (PED1 intacta)");

    const niv = await c.query(
      "select count(*)::int n from aluno_niveis where aluno_id=$1 and escopo='mat'", [ALUNO_LUCAS]);
    assert.ok(niv.rows[0].n >= 1, "nível por matéria segue persistido (PED1 intacta)");
  });
});

test("FIX2: histórico de conquistas do seed é preservado (nada apagado)", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query(
      "select count(*)::int n from aluno_conquistas ac join conquistas q on q.id=ac.conquista_id where ac.aluno_id=$1 and q.codigo='veterano'",
      [ALUNO_LUCAS]);
    assert.equal(r.rows[0].n, 1, "conquista histórica do seed sumiu — 0037 não podia apagar dado");
  });
});

test("FIX2: RLS inalterada — aluno segue sem poder gravar conquista direto", async () => {
  await como(IDS.alunoA, async (c) => {
    await esperaErro(c, /row-level security/i,
      `insert into aluno_conquistas (escola_id, aluno_id, conquista_id, exam_tag)
       values ($1, $2, (select id from conquistas limit 1), 'cn')`,
      [ESCOLA_A, ALUNO_LUCAS]);
  });
});
