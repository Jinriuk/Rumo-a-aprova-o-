// ============================================================
// EST1-B3 (0043) — SAÚDE DA VIRADA (leitura do heartbeat)
// ------------------------------------------------------------
// app.virada_saude() lê virada_execucoes (heartbeat de A2/0039) e diz
// se a última virada global rodou na janela e sem erros. É a metade de
// código do alerta que faltava (o pg_cron rodava às cegas). Provamos:
//   • heartbeat vazio → ok=false ('nunca executou');
//   • após virar_semana → ok=true, recente, 0 erros;
//   • última virada com aluno em erro → ok=false com motivo;
//   • última virada antiga (fora da janela) → ok=false ('atrasada');
//   • porta do backoffice: super_admin lê; coordenação é recusada.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, comoServidor, esperaErro, IDS, ESCOLA_A, ALUNO_LUCAS } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const DIA = "2026-06-15";

async function saude(c, janela = 26) {
  const r = await c.query("select * from app.virada_saude($1)", [janela]);
  return r.rows[0];
}

test("heartbeat vazio → ok=false ('nunca executou')", async () => {
  await comoServidor(async (c) => {
    await c.query("begin");
    try {
      await c.query("delete from virada_execucoes");
      const s = await saude(c);
      assert.equal(s.ok, false);
      assert.match(s.motivo, /nunca executou/);
    } finally { await c.query("rollback"); }
  });
});

test("após virar_semana → ok=true, execução recente e 0 erros", async () => {
  await comoServidor(async (c) => {
    await c.query("begin");
    try {
      await c.query("delete from virada_execucoes");
      await c.query("select app.virar_semana($1::date)", [DIA]);
      const s = await saude(c);
      assert.equal(s.ok, true, `motivo: ${s.motivo}`);
      assert.equal(s.alunos_com_erro, 0);
      assert.ok(Number(s.horas_desde) >= 0 && Number(s.horas_desde) < 1, "execução recente");
    } finally { await c.query("rollback"); }
  });
});

test("última virada com aluno em erro → ok=false com motivo", async () => {
  await comoServidor(async (c) => {
    await c.query("begin");
    try {
      // cria um aluno com trilha vazia p/ a virada pular e reportar erro
      const t = await c.query(
        "insert into trilhas (nicho, nome, versao, publicada) values ('teste-saude','Vazia B3', 998, true) returning id");
      await c.query("insert into alunos (escola_id, nome, trilha_id) values ($1,'Erro B3',$2)", [ESCOLA_A, t.rows[0].id]);
      await c.query("delete from virada_execucoes");
      await c.query("select app.virar_semana($1::date)", [DIA]);
      const s = await saude(c);
      assert.equal(s.ok, false);
      assert.ok(s.alunos_com_erro >= 1);
      assert.match(s.motivo, /erro na última virada/);
    } finally { await c.query("rollback"); }
  });
});

test("última virada fora da janela → ok=false ('atrasada')", async () => {
  await comoServidor(async (c) => {
    await c.query("begin");
    try {
      await c.query("delete from virada_execucoes");
      // heartbeat de 3 dias atrás, sem erros
      await c.query(
        `insert into virada_execucoes (escola_id, data_referencia, metas_fechadas, metas_geradas, alunos_com_erro, executado_em)
         values (null, current_date - 3, 0, 0, 0, now() - interval '72 hours')`);
      const s = await saude(c, 26);
      assert.equal(s.ok, false);
      assert.match(s.motivo, /atrasada/);
      assert.ok(Number(s.horas_desde) >= 71);
    } finally { await c.query("rollback"); }
  });
});

test("porta do backoffice: super_admin lê a saúde; coordenação é recusada", async () => {
  const ADMIN = "cccccccc-0000-4000-8000-0000000000b3";
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(
      "insert into internal_admins (auth_user_id, email, nome, ativo) values ($1,'b3@interno.local','Op B3', true)",
      [ADMIN]);
    await c.query("select app.virar_semana($1::date)", [DIA]);
    await c.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: ADMIN, role: "authenticated", app_metadata: {} })]);
    await c.query("set local role authenticated");
    const r = await c.query("select public.backoffice_virada_saude() as j");
    assert.ok(r.rows[0].j && typeof r.rows[0].j.ok === "boolean", "super_admin recebe o jsonb de saúde");
  } finally { await c.query("rollback").catch(() => {}); c.release(); }

  await como(IDS.coordA, async (cc) => {
    await esperaErro(cc, /acesso negado/i, "select public.backoffice_virada_saude()");
  });
});
