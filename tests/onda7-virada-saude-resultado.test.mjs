// ============================================================
// ONDA 7 / A2 (0050) — a saúde da virada olha RESULTADO, não só erro
// ------------------------------------------------------------
// A 0043 decidia ok por dois sinais da última EXECUÇÃO (atraso e
// alunos_com_erro). `metas_geradas` era devolvido e nunca testado, então
// uma virada que rodou no horário sem explodir em ninguém ficava verde
// mesmo não tendo produzido nada. A 0050 acrescenta o sinal de ESTADO:
// aluno com semana vigente e sem meta ativa.
//
// O teste central é o primeiro: heartbeat RECENTE e LIMPO (0 erros,
// dentro da janela) com um aluno sem meta. Sob a 0043 isso devolvia
// ok=true — é exatamente o falso verde do A2.
//
// Os demais travam as exclusões do invariante, que é onde um alerta
// destes vira ruído se errar: ciclo encerrado, aluno ainda em
// provisionamento e escola desligada NÃO podem acender o alerta.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, comoServidor, ESCOLA_A } from "./identidades.mjs";
import { diaNaSemanaCN } from "./calendario-cn.mjs";

test.after(async () => { await pool.end(); });

// Data dentro da trilha CN do seed (o seed 02 ancora a semana 3 na
// semana corrente), igual ao est1-virada-saude-db.test.mjs.
const DIA = await diaNaSemanaCN(3);

async function saude(c, janela = 26) {
  return (await c.query("select * from app.virada_saude($1)", [janela])).rows[0];
}

// aluno com semana vigente hoje e sem meta ativa — o alvo do invariante
async function alunoDescoberto(c) {
  const r = await c.query(
    `select a.id from alunos a
       join escolas e on e.id = a.escola_id
       join trilha_semanas ts on ts.trilha_id = a.trilha_id
                             and app.hoje_local() between ts.inicio and ts.fim
      where a.status_provisionamento = 'ok'
        and e.status not in ('suspensa','cancelada')
      limit 1`);
  return r.rows[0]?.id ?? null;
}

test("A2: heartbeat recente e SEM erros fica VERMELHO quando há aluno sem meta aberta", async () => {
  await comoServidor(async (c) => {
    await c.query("begin");
    try {
      await c.query("delete from virada_execucoes");
      await c.query("select app.virar_semana($1::date)", [DIA]);

      // a virada acabou de rodar: heartbeat limpo e estado bom
      const antes = await saude(c);
      assert.equal(antes.ok, true, `deveria estar verde logo após a virada: ${antes.motivo}`);
      assert.equal(antes.alunos_sem_meta, 0, "ninguém deveria estar sem meta logo após a virada");

      // agora o ESTADO quebra sem que o heartbeat mude: um aluno perde a
      // meta. O heartbeat continua dizendo "rodei, 0 erros".
      const alvo = await alunoDescoberto(c);
      assert.ok(alvo, "o seed precisa ter ao menos um aluno com semana vigente");
      await c.query("delete from meta_atividades where meta_id in (select id from metas where aluno_id = $1)", [alvo]);
      await c.query("delete from metas where aluno_id = $1", [alvo]);

      const depois = await saude(c);
      assert.equal(depois.alunos_com_erro, 0, "o heartbeat continua limpo — é esse o ponto");
      assert.ok(Number(depois.horas_desde) < 1, "e continua recente");
      assert.ok(depois.alunos_sem_meta >= 1, "o novo sinal precisa enxergar o aluno descoberto");
      assert.equal(depois.ok, false, "sob a 0043 isso devolvia ok=true — é o falso verde do A2");
      assert.match(depois.motivo, /sem meta aberta/);
    } finally { await c.query("rollback"); }
  });
});

test("A2: o invariante vale mesmo com o heartbeat vazio (é estado, não execução)", async () => {
  await comoServidor(async (c) => {
    await c.query("begin");
    try {
      await c.query("delete from virada_execucoes");
      await c.query("delete from meta_atividades");
      await c.query("delete from metas");

      const s = await saude(c);
      assert.equal(s.ok, false);
      assert.ok(s.alunos_sem_meta >= 1, "sem nenhuma meta no banco, os alunos com semana vigente contam");
      assert.match(s.motivo, /nunca executou/);
      assert.match(s.motivo, /sem meta aberta/, "o motivo precisa somar as duas causas, não esconder uma");
    } finally { await c.query("rollback"); }
  });
});

test("A2: ciclo encerrado NÃO acende o alerta (sem semana vigente, sem cobrança)", async () => {
  await comoServidor(async (c) => {
    await c.query("begin");
    try {
      await c.query("delete from virada_execucoes");
      await c.query("select app.virar_semana($1::date)", [DIA]);

      // trilha cujas semanas terminaram no ano passado + aluno nela,
      // sem meta nenhuma: é o demo depois de 01/08.
      const t = await c.query(
        "insert into trilhas (nicho, nome, versao, publicada) values ('teste-a2','Encerrada A2', 997, true) returning id");
      await c.query(
        `insert into trilha_semanas (trilha_id, numero, inicio, fim, foco)
         values ($1, 1, current_date - 400, current_date - 394, 'passado')`, [t.rows[0].id]);
      await c.query(
        "insert into alunos (escola_id, nome, trilha_id) values ($1,'Ciclo Encerrado A2',$2)",
        [ESCOLA_A, t.rows[0].id]);

      const s = await saude(c);
      assert.equal(s.alunos_sem_meta, 0, "aluno de ciclo encerrado não deve entrar na conta");
      assert.equal(s.ok, true, `não pode acender por ciclo encerrado: ${s.motivo}`);
    } finally { await c.query("rollback"); }
  });
});

test("A2: aluno pendente_configuracao e escola desligada NÃO acendem o alerta", async () => {
  await comoServidor(async (c) => {
    await c.query("begin");
    try {
      await c.query("delete from virada_execucoes");
      await c.query("select app.virar_semana($1::date)", [DIA]);

      const alvo = await alunoDescoberto(c);
      assert.ok(alvo, "o seed precisa ter ao menos um aluno com semana vigente");
      await c.query("delete from meta_atividades where meta_id in (select id from metas where aluno_id = $1)", [alvo]);
      await c.query("delete from metas where aluno_id = $1", [alvo]);
      assert.ok((await saude(c)).alunos_sem_meta >= 1, "pré-condição: o aluno está descoberto");

      // 1) ainda em provisionamento (0046) → sai da conta
      await c.query("update alunos set status_provisionamento = 'pendente_configuracao' where id = $1", [alvo]);
      assert.equal((await saude(c)).alunos_sem_meta, 0, "aluno pendente_configuracao não deve contar");

      // 2) de volta a 'ok', mas com a escola suspensa (0025) → sai da conta
      await c.query("update alunos set status_provisionamento = 'ok' where id = $1", [alvo]);
      assert.ok((await saude(c)).alunos_sem_meta >= 1, "pré-condição: voltou a contar");
      await c.query("update escolas set status = 'suspensa' where id = (select escola_id from alunos where id = $1)", [alvo]);
      assert.equal((await saude(c)).alunos_sem_meta, 0, "escola suspensa não deve contar");
    } finally { await c.query("rollback"); }
  });
});

test("A2: a porta do backoffice devolve o campo novo", async () => {
  const ADMIN = "cccccccc-0000-4000-8000-0000000000a2";
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(
      "insert into internal_admins (auth_user_id, email, nome, ativo) values ($1,'a2@interno.local','Op A2', true)",
      [ADMIN]);
    await c.query("select app.virar_semana($1::date)", [DIA]);
    await c.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: ADMIN, role: "authenticated", app_metadata: {} })]);
    await c.query("set local role authenticated");
    const r = await c.query("select public.backoffice_virada_saude() as s");
    assert.ok(
      Object.hasOwn(r.rows[0].s, "alunos_sem_meta"),
      "o to_jsonb da porta precisa carregar o campo novo sem alteração na porta",
    );
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
});
