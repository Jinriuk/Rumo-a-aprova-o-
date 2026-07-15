// ============================================================
// EST1-A2 (0039) — VIRADA RESILIENTE + FK DE TRILHA + HEARTBEAT
// ------------------------------------------------------------
// Achado EST0 BANCO-01: a virada global era uma transação única sem
// isolamento de falha — um aluno com trilha ruim abortava as metas de
// TODAS as escolas, em silêncio. Aqui provamos:
//   • um aluno com trilha VAZIA (sem semanas) é pulado e reportado,
//     e os demais alunos seguem ganhando meta na mesma execução;
//   • alunos.trilha_id agora tem FK — uuid pendurado morre na raiz;
//   • toda execução (global e por escola) grava heartbeat em
//     virada_execucoes, com contagem de erros por aluno;
//   • RLS do heartbeat: coordenação não lê; super_admin lê.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, comoServidor, esperaErro, IDS, ESCOLA_A, ALUNO_LUCAS } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

// Data dentro da trilha CN do seed (mesma referência do motor.test.mjs)
const DIA = "2026-06-15";

test("virada global: aluno com trilha vazia é pulado e reportado; os demais ganham meta", async () => {
  await comoServidor(async (c) => {
    await c.query("begin");
    try {
      // cenário: uma trilha SEM semanas (o vetor que sobrevive à FK)
      const t = await c.query(
        "insert into trilhas (nicho, nome, versao, publicada) values ('teste-vazia','Trilha vazia EST1', 999, true) returning id",
      );
      const a = await c.query(
        "insert into alunos (escola_id, nome, trilha_id) values ($1,'Aluno Trilha Vazia',$2) returning id",
        [ESCOLA_A, t.rows[0].id],
      );
      const alunoRuim = a.rows[0].id;

      // remove a meta corrente do Lucas para provar que a virada TRABALHA
      // depois de encontrar o aluno problemático
      await c.query(
        `delete from metas where aluno_id=$1
          and semana_numero=(select (app.semana_da_data(trilha_id, $2::date)).numero from alunos where id=$1)`,
        [ALUNO_LUCAS, DIA],
      );

      const r = await c.query("select * from app.virar_semana($1::date)", [DIA]);
      assert.equal(r.rows.length, 1);
      assert.ok(r.rows[0].metas_geradas >= 1, "os alunos saudáveis ganharam meta");
      assert.equal(r.rows[0].alunos_com_erro, 1, "exatamente o aluno ruim falhou");

      const lucas = await c.query(
        `select count(*)::int n from metas where aluno_id=$1
          and semana_numero=(select (app.semana_da_data(trilha_id, $2::date)).numero from alunos where id=$1)`,
        [ALUNO_LUCAS, DIA],
      );
      assert.equal(lucas.rows[0].n, 1, "o Lucas recebeu a meta apesar do aluno ruim");

      const hb = await c.query(
        "select alunos_com_erro, erros from virada_execucoes where escola_id is null and data_referencia=$1::date order by executado_em desc limit 1",
        [DIA],
      );
      assert.equal(hb.rows.length, 1, "heartbeat gravado");
      assert.equal(hb.rows[0].alunos_com_erro, 1);
      assert.equal(hb.rows[0].erros[0].aluno_id, alunoRuim, "o erro aponta o aluno certo");
      assert.match(hb.rows[0].erros[0].erro, /sem semanas/, "com o motivo real");
    } finally {
      await c.query("rollback");
    }
  });
});

test("virada por escola tem a mesma resiliência e o heartbeat leva escola_id", async () => {
  await comoServidor(async (c) => {
    await c.query("begin");
    try {
      const r = await c.query("select * from app.virar_semana($1::uuid, $2::date)", [ESCOLA_A, DIA]);
      assert.equal(r.rows[0].alunos_com_erro, 0, "base do seed é saudável");

      const hb = await c.query(
        "select escola_id from virada_execucoes where escola_id=$1 and data_referencia=$2::date",
        [ESCOLA_A, DIA],
      );
      assert.equal(hb.rows.length, 1, "heartbeat da escola gravado");
    } finally {
      await c.query("rollback");
    }
  });
});

test("FK: trilha_id pendurado é recusado pelo banco (uuid inexistente)", async () => {
  await como(IDS.coordA, async (c) => {
    await esperaErro(c, /foreign key|viola/i,
      "update alunos set trilha_id = gen_random_uuid() where id=$1",
      [ALUNO_LUCAS]);
  });
});

test("heartbeat: coordenação NÃO lê; super_admin lê (RLS)", async () => {
  const ADMIN = "cccccccc-0000-4000-8000-0000000000e1";
  const c = await pool.connect();
  try {
    await c.query("begin");
    // como servidor: gera execuções e credencia um super_admin
    await c.query(
      "insert into internal_admins (auth_user_id, email, nome, ativo) values ($1,'est1@interno.local','Operador EST1', true)",
      [ADMIN],
    );
    await c.query("select app.virar_semana($1::date)", [DIA]);

    // coordenação: RLS devolve zero linhas (não é erro — é invisível)
    await c.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: IDS.coordA.sub, role: "authenticated", app_metadata: { escola_id: ESCOLA_A, papel: "coordenacao" } }),
    ]);
    await c.query("set local role authenticated");
    const coord = await c.query("select count(*)::int n from virada_execucoes");
    assert.equal(coord.rows[0].n, 0, "coordenação não enxerga o heartbeat");

    // super_admin: enxerga
    await c.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: ADMIN, role: "authenticated", app_metadata: {} }),
    ]);
    const adm = await c.query("select count(*)::int n from virada_execucoes");
    assert.ok(adm.rows[0].n >= 1, "super_admin lê o heartbeat");
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
});
