// ============================================================
// Tarefa 2 (0046) — ALUNO SEM META VIRA pendente_configuracao
// ------------------------------------------------------------
// Achado: gerar-meta falhava e o erro só ia pro console.error do FRONT
// (CadastroAlunos.jsx) — o aluno ficava com trilha atribuída e nenhuma
// meta, e a coordenação via "cadastrado com sucesso" mesmo assim.
//
// Prova:
//   • status_provisionamento é escrito só pelo service_role — mesmo
//     padrão de privilégio por coluna da 0040 (meta_atividades):
//     coordenação (authenticated) recebe "permission denied" ANTES da
//     RLS, mesmo em aluno da própria escola. O fluxo legítimo (nome/
//     trilha/concurso, patchAluno/atualizarAlvoPedagogico) continua liberado.
//   • motor_gerar_meta_segura é IDEMPOTENTE (reaproveita
//     app.gerar_meta_protegida da 0039): reprocessar um aluno que já tem
//     a meta da semana corrente devolve 'ja_tinha' sem duplicar linha em
//     metas — é o caminho de reprocessamento seguro do item 4.
//   • motor_gerar_meta_segura devolve 'erro' (nunca lança) pra trilha
//     vazia e pra aluno sem trilha atribuída.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, comoServidor, esperaErro, IDS, ESCOLA_A, ALUNO_LUCAS } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

test("coordenação não escreve status_provisionamento (privilégio por coluna); fluxo legítimo continua liberado", async () => {
  await como(IDS.coordA, async (c) => {
    await esperaErro(c, /permission denied/i,
      "update alunos set status_provisionamento='pendente_configuracao' where id=$1",
      [ALUNO_LUCAS]);
    const r = await c.query("update alunos set nome='Lucas Teste 0046' where id=$1 returning nome", [ALUNO_LUCAS]);
    assert.equal(r.rows[0].nome, "Lucas Teste 0046", "patchAluno (nome) continua liberado pra coordenação");
  });
});

test("motor_gerar_meta_segura é idempotente: reprocessar não duplica meta", async () => {
  await comoServidor(async (c) => {
    await c.query("begin");
    try {
      const antes = await c.query("select count(*)::int n from metas where aluno_id=$1", [ALUNO_LUCAS]);
      const r1 = await c.query("select public.motor_gerar_meta_segura($1) as r", [ALUNO_LUCAS]);
      const r2 = await c.query("select public.motor_gerar_meta_segura($1) as r", [ALUNO_LUCAS]);
      assert.equal(r1.rows[0].r.resultado, "ja_tinha");
      assert.equal(r2.rows[0].r.resultado, "ja_tinha");
      const depois = await c.query("select count(*)::int n from metas where aluno_id=$1", [ALUNO_LUCAS]);
      assert.equal(depois.rows[0].n, antes.rows[0].n, "nenhuma meta duplicada pelo reprocessamento");
    } finally {
      await c.query("rollback");
    }
  });
});

test("motor_gerar_meta_segura devolve 'erro' (sem lançar) para trilha sem semanas", async () => {
  await comoServidor(async (c) => {
    await c.query("begin");
    try {
      const t = await c.query(
        "insert into trilhas (nicho, nome, versao, publicada) values ('teste-vazia-0046','Trilha vazia 0046', 998, true) returning id",
      );
      const a = await c.query(
        "insert into alunos (escola_id, nome, trilha_id) values ($1,'Aluno Trilha Vazia 0046',$2) returning id",
        [ESCOLA_A, t.rows[0].id],
      );
      const r = await c.query("select public.motor_gerar_meta_segura($1) as r", [a.rows[0].id]);
      assert.equal(r.rows[0].r.resultado, "erro");
      assert.match(r.rows[0].r.erro, /sem semanas/i);
    } finally {
      await c.query("rollback");
    }
  });
});

test("motor_gerar_meta_segura devolve 'erro' para aluno sem trilha atribuída (sem tocar o motor)", async () => {
  await comoServidor(async (c) => {
    await c.query("begin");
    try {
      const a = await c.query(
        "insert into alunos (escola_id, nome, trilha_id) values ($1,'Aluno Sem Trilha 0046', null) returning id",
        [ESCOLA_A],
      );
      const r = await c.query("select public.motor_gerar_meta_segura($1) as r", [a.rows[0].id]);
      assert.equal(r.rows[0].r.resultado, "erro");
      assert.match(r.rows[0].r.erro, /sem trilha/i);
    } finally {
      await c.query("rollback");
    }
  });
});
