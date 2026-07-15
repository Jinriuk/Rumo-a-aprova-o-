// ============================================================
// EST1-A1 (0038) — ESTORNO NO DELETE: o ledger de XP não é inflável
// ------------------------------------------------------------
// Achado EST0 BANCO-02: o aluno podia inserir simulado (+50 XP),
// apagar e inserir de novo — cada volta somava 50 ao total, porque a
// idempotency_key é amarrada ao id NOVO e não havia gatilho de DELETE.
// A 0038 marca 'estornado' no evento cuja origem sumiu. Aqui provamos:
//   • apagar simulado estorna o evento e o XP sai do total;
//   • o ciclo inserir/apagar N vezes NÃO infla: só origem viva pontua;
//   • apagar registro de estudo estorna o evento (histórico honesto);
//   • o estorno não toca eventos de outras origens do mesmo aluno.
// Identidade real (authenticated + claims JWT) — RLS vale por inteiro.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, IDS, ESCOLA_A, ALUNO_LUCAS } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

async function xpTotal(c, alunoId) {
  const r = await c.query(
    "select coalesce(sum(xp_total),0)::int xp from vw_aluno_xp_total where aluno_id=$1",
    [alunoId],
  );
  return r.rows[0].xp;
}

test("apagar simulado estorna o evento e o XP sai do total", async () => {
  await como(IDS.alunoA, async (c) => {
    const antes = await xpTotal(c, ALUNO_LUCAS);

    const s = await c.query(
      `insert into simulados (escola_id, aluno_id, nome, data, acertos)
       values ($1,$2,'Simulado estorno', current_date, '{"mat": 10}'::jsonb) returning id`,
      [ESCOLA_A, ALUNO_LUCAS],
    );
    const simId = s.rows[0].id;
    assert.equal(await xpTotal(c, ALUNO_LUCAS), antes + 50, "insert credita +50");

    await c.query("delete from simulados where id=$1", [simId]);

    const ev = await c.query(
      "select status, xp_delta, metadata->>'estorno_motivo' as motivo from aluno_eventos_progresso where referencia_id=$1 and tipo_evento='simulado_finalizado'",
      [simId],
    );
    assert.equal(ev.rows.length, 1, "o evento NÃO é apagado — auditoria preserva");
    assert.equal(ev.rows[0].status, "estornado", "origem sumiu → estornado");
    assert.equal(ev.rows[0].motivo, "origem_apagada:simulados");
    assert.equal(await xpTotal(c, ALUNO_LUCAS), antes, "o XP volta ao total anterior");
  });
});

test("ciclo inserir/apagar N vezes não infla: só a origem viva pontua", async () => {
  await como(IDS.alunoA, async (c) => {
    const antes = await xpTotal(c, ALUNO_LUCAS);

    for (let i = 0; i < 3; i++) {
      const s = await c.query(
        `insert into simulados (escola_id, aluno_id, nome, data, acertos)
         values ($1,$2,'Simulado grind '||$3, current_date, '{"mat": 5}'::jsonb) returning id`,
        [ESCOLA_A, ALUNO_LUCAS, String(i)],
      );
      await c.query("delete from simulados where id=$1", [s.rows[0].id]);
    }
    assert.equal(await xpTotal(c, ALUNO_LUCAS), antes, "3 voltas de grind = 0 XP");

    // um simulado que FICA vale normalmente (o estorno não pune uso honesto)
    await c.query(
      `insert into simulados (escola_id, aluno_id, nome, data, acertos)
       values ($1,$2,'Simulado honesto', current_date, '{"mat": 12}'::jsonb)`,
      [ESCOLA_A, ALUNO_LUCAS],
    );
    assert.equal(await xpTotal(c, ALUNO_LUCAS), antes + 50, "origem viva pontua uma vez");

    const estornados = await c.query(
      `select count(*)::int n from aluno_eventos_progresso
        where aluno_id=$1 and tipo_evento='simulado_finalizado' and status='estornado'
          and metadata->>'estorno_motivo'='origem_apagada:simulados'`,
      [ALUNO_LUCAS],
    );
    assert.ok(estornados.rows[0].n >= 3, "as 3 voltas ficaram carimbadas no histórico");
  });
});

test("apagar registro de estudo estorna o evento (histórico honesto, xp 0)", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query(
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, minutos)
       values ($1,$2, current_date, 'mat', 'Registro estorno', 10, 8, 20) returning id`,
      [ESCOLA_A, ALUNO_LUCAS],
    );
    const regId = r.rows[0].id;
    await c.query("delete from registros_estudo where id=$1", [regId]);

    const ev = await c.query(
      "select status from aluno_eventos_progresso where referencia_id=$1 and tipo_evento='registro_estudo'",
      [regId],
    );
    assert.equal(ev.rows.length, 1, "evento preservado no ledger");
    assert.equal(ev.rows[0].status, "estornado");
  });
});

test("o estorno é cirúrgico: não toca eventos de OUTRAS origens do aluno", async () => {
  await como(IDS.alunoA, async (c) => {
    // dois simulados; apagar o primeiro não pode estornar o segundo
    const a = await c.query(
      `insert into simulados (escola_id, aluno_id, nome, data, acertos)
       values ($1,$2,'Simulado A', current_date, '{"mat": 1}'::jsonb) returning id`,
      [ESCOLA_A, ALUNO_LUCAS],
    );
    const b = await c.query(
      `insert into simulados (escola_id, aluno_id, nome, data, acertos)
       values ($1,$2,'Simulado B', current_date, '{"mat": 2}'::jsonb) returning id`,
      [ESCOLA_A, ALUNO_LUCAS],
    );
    await c.query("delete from simulados where id=$1", [a.rows[0].id]);

    const vivo = await c.query(
      "select status from aluno_eventos_progresso where referencia_id=$1 and tipo_evento='simulado_finalizado'",
      [b.rows[0].id],
    );
    assert.equal(vivo.rows[0].status, "valido", "o simulado B segue pontuando");
  });
});
