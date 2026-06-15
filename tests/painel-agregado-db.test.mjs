// ============================================================
// PAINEL AGREGADO (migration 0016) — a RPC resumo_escola() soma
// por aluno NO BANCO. Aqui provamos que (a) os números batem com a
// soma direta dos registros, (b) o tenant continua isolado e (c) a
// RLS vale: o aluno só enxerga a si. Substitui o download de todos
// os registros da escola no cliente.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, comoServidor, IDS, ESCOLA_A, ALUNO_LUCAS } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

// Esperado calculado direto no banco (servidor, sem RLS), com a MESMA
// janela de 7 dias da função — robusto a mudanças no seed.
async function esperadoEscolaA() {
  const r = await comoServidor((c) => c.query(`
    with corte as (select (app.hoje_local() - 6) as desde),
    reg as (
      select a.id as aluno_id,
        coalesce(sum(r.questoes), 0)::int                                            as q,
        coalesce(sum(r.questoes) filter (where r.acertos is not null), 0)::int        as caq,
        coalesce(sum(r.acertos)  filter (where r.acertos is not null), 0)::int        as ac,
        coalesce(sum(r.questoes) filter (where r.data >= (select desde from corte)), 0)::int as q7,
        count(distinct r.data)::int                                                  as dias
      from alunos a left join registros_estudo r on r.aluno_id = a.id
      where a.escola_id = $1 group by a.id
    ),
    meta as (
      select m.aluno_id,
        count(*) filter (where ma.estado = 'concluida')::int as feitas,
        count(*) filter (where ma.estado <> 'ignorada')::int as consideradas
      from metas m join meta_atividades ma on ma.meta_id = m.id
      where m.status = 'ativa' group by m.aluno_id
    )
    select reg.*, coalesce(meta.feitas, 0) as feitas, coalesce(meta.consideradas, 0) as consideradas
    from reg left join meta on meta.aluno_id = reg.aluno_id`, [ESCOLA_A]));
  return new Map(r.rows.map((x) => [x.aluno_id, x]));
}

test("resumo_escola: agregados batem com a soma direta e cobre TODOS os alunos da escola", async () => {
  const esperado = await esperadoEscolaA();
  const obtido = await como(IDS.coordA, (c) => c.query("select * from public.resumo_escola()"));

  assert.ok(obtido.rows.length > 0, "a coordenação deveria ver os alunos da própria escola");
  assert.equal(obtido.rows.length, esperado.size, "a RPC deve devolver uma linha por aluno da escola");

  for (const row of obtido.rows) {
    const e = esperado.get(row.aluno_id);
    assert.ok(e, `aluno ${row.aluno_id} não é da escola A — vazou tenant`);
    assert.equal(Number(row.questoes_total), e.q, "questoes_total");
    assert.equal(Number(row.ca_questoes_total), e.caq, "ca_questoes_total");
    assert.equal(Number(row.acertos_total), e.ac, "acertos_total");
    assert.equal(Number(row.questoes_7d), e.q7, "questoes_7d");
    assert.equal(Number(row.dias_total), e.dias, "dias_total");
    assert.equal(Number(row.meta_feitas), e.feitas, "meta_feitas");
    assert.equal(Number(row.meta_consideradas), e.consideradas, "meta_consideradas");
  }
});

test("resumo_escola: isolamento — a coordenação A não recebe nenhum aluno de outra escola", async () => {
  const idsA = new Set((await comoServidor((c) =>
    c.query("select id from alunos where escola_id = $1", [ESCOLA_A]))).rows.map((r) => r.id));
  const obtido = await como(IDS.coordA, (c) => c.query("select aluno_id from public.resumo_escola()"));
  for (const row of obtido.rows) {
    assert.ok(idsA.has(row.aluno_id), `vazou aluno de outra escola: ${row.aluno_id}`);
  }
});

test("resumo_escola: a RLS vale dentro do tenant — o aluno só enxerga a si mesmo", async () => {
  const obtido = await como(IDS.alunoA, (c) => c.query("select aluno_id from public.resumo_escola()"));
  assert.deepEqual(obtido.rows.map((r) => r.aluno_id), [ALUNO_LUCAS]);
});
