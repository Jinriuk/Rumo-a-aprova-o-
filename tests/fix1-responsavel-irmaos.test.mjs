// ============================================================
// FIX1 (OBS-RC1-004) — RESPONSÁVEL COM 2+ FILHOS
// ------------------------------------------------------------
// O front trocou o `.limit(1)` de alunoVinculado() por
// alunosVinculados() (todos os vínculos + seletor). Aqui provamos,
// com RLS valendo por inteiro, que o banco sustenta esse contrato:
//   • o responsável enxerga TODOS os alunos vinculados a ele;
//   • e SÓ eles (aluno da mesma escola sem vínculo é invisível);
//   • o log LGPD (logs_acesso) aceita um registro POR aluno lido;
//   • os demais perfis não mudam: aluno segue vendo só a si,
//     coordenação segue vendo a escola inteira, e nada atravessa
//     o tenant (responsável da escola B não vê nada disso).
// Tudo roda numa transação com ROLLBACK — o banco não fica sujo.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, IDS, ESCOLA_A, ESCOLA_B, ALUNO_LUCAS } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const TRILHA_CN = "b1388388-c660-4b4b-811c-b58358689e92"; // trilha do seed
const ALUNA_IRMA = "a0000000-0000-4000-8000-00000000f1f1"; // 2ª filha do respA
const ALUNO_SEM_VINCULO = "a0000000-0000-4000-8000-00000000f2f2";

// Assume a identidade dada DENTRO da transação corrente (mesmo
// mecanismo do helper `como`, mas trocável no meio do cenário).
async function assumir(c, identidade) {
  const claims = JSON.stringify({
    sub: identidade.sub,
    role: "authenticated",
    app_metadata: { escola_id: identidade.escola_id, papel: identidade.papel },
  });
  await c.query("select set_config('request.jwt.claims', $1, true)", [claims]);
  await c.query("set local role authenticated");
}

// Prepara o cenário (como servidor, sem RLS): a 2ª filha vinculada ao
// respA e um colega SEM vínculo, ambos na escola A. Roda fn e desfaz.
async function cenarioIrmaos(fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(
      `insert into alunos (id, escola_id, nome, trilha_id) values
         ($1, $3, 'Alice (irmã do Lucas)', $4),
         ($2, $3, 'Colega sem vínculo', $4)`,
      [ALUNA_IRMA, ALUNO_SEM_VINCULO, ESCOLA_A, TRILHA_CN],
    );
    await c.query(
      `insert into vinculos_responsaveis (escola_id, responsavel_id, aluno_id)
         values ($1, $2, $3)`,
      [ESCOLA_A, IDS.respA.sub, ALUNA_IRMA],
    );
    await fn(c);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

test("responsável com 2 filhos enxerga os DOIS vínculos e os DOIS alunos (fim do aluno sorteado)", async () => {
  await cenarioIrmaos(async (c) => {
    await assumir(c, IDS.respA);
    const v = await c.query("select aluno_id from vinculos_responsaveis");
    assert.equal(v.rows.length, 2, `responsável viu ${v.rows.length} vínculo(s), esperava 2`);
    const ids = v.rows.map((r) => r.aluno_id).sort();
    assert.deepEqual(ids, [ALUNO_LUCAS, ALUNA_IRMA].sort());

    // a MESMA leitura que alunosVinculados() faz: in(ids) + order by nome
    const a = await c.query(
      "select id, nome from alunos where id = any($1) order by nome", [ids],
    );
    assert.equal(a.rows.length, 2, "RLS deveria entregar os dois filhos");
    assert.deepEqual(a.rows.map((r) => r.nome), ["Alice (irmã do Lucas)", "Lucas"]);
  });
});

test("responsável NÃO enxerga aluno da própria escola sem vínculo (o seletor não vaza colega)", async () => {
  await cenarioIrmaos(async (c) => {
    await assumir(c, IDS.respA);
    const r = await c.query("select count(*)::int as n from alunos where id = $1", [ALUNO_SEM_VINCULO]);
    assert.equal(r.rows[0].n, 0, "aluno sem vínculo apareceu para o responsável");
    // e o universo visível é EXATAMENTE o dos vinculados
    const todos = await c.query("select id from alunos order by nome");
    assert.deepEqual(todos.rows.map((r) => r.id).sort(), [ALUNO_LUCAS, ALUNA_IRMA].sort());
  });
});

test("log LGPD por aluno consultado: o responsável grava um logs_acesso para CADA filho", async () => {
  await cenarioIrmaos(async (c) => {
    await assumir(c, IDS.respA);
    // Sem RETURNING, como o app (registrarAcesso): o responsável pode
    // ESCREVER o log, mas não pode LER logs_acesso (só a coordenação).
    for (const alunoId of [ALUNO_LUCAS, ALUNA_IRMA]) {
      const r = await c.query(
        `insert into logs_acesso (escola_id, aluno_id, usuario_id, papel, acao)
           values ($1, $2, $3, 'responsavel', 'leitura-desempenho')`,
        [ESCOLA_A, alunoId, IDS.respA.sub],
      );
      assert.equal(r.rowCount, 1, `log do aluno ${alunoId} não gravou`);
    }
    // e a coordenação vê os DOIS registros na trilha LGPD
    await assumir(c, IDS.coordA);
    const n = await c.query(
      "select count(*)::int as n from logs_acesso where usuario_id = $1 and aluno_id in ($2, $3) and acao = 'leitura-desempenho'",
      [IDS.respA.sub, ALUNO_LUCAS, ALUNA_IRMA],
    );
    assert.ok(n.rows[0].n >= 2, "trilha LGPD não mostra os dois acessos");
  });
});

test("regressão aluno: com a irmã cadastrada, o aluno segue vendo SÓ a si mesmo", async () => {
  await cenarioIrmaos(async (c) => {
    await assumir(c, IDS.alunoA);
    const r = await c.query("select id from alunos");
    assert.deepEqual(r.rows.map((x) => x.id), [ALUNO_LUCAS], "aluno viu além de si mesmo");
  });
});

test("regressão coordenação: segue vendo TODOS os alunos da escola (inclusive os novos)", async () => {
  await cenarioIrmaos(async (c) => {
    await assumir(c, IDS.coordA);
    const r = await c.query("select count(*)::int as n from alunos where id in ($1, $2, $3)",
      [ALUNO_LUCAS, ALUNA_IRMA, ALUNO_SEM_VINCULO]);
    assert.equal(r.rows[0].n, 3, "coordenação deixou de ver aluno da própria escola");
  });
});

test("regressão multi-tenant: responsável da escola B não vê NENHUM vínculo/aluno da escola A", async () => {
  await cenarioIrmaos(async (c) => {
    await assumir(c, IDS.respB);
    const v = await c.query("select count(*)::int as n from vinculos_responsaveis where escola_id = $1", [ESCOLA_A]);
    assert.equal(v.rows[0].n, 0);
    const a = await c.query("select count(*)::int as n from alunos where escola_id = $1", [ESCOLA_A]);
    assert.equal(a.rows[0].n, 0);
  });
});

test("regressão escrita: responsável continua SEM poder criar/apagar vínculo (só coordenação)", async () => {
  await cenarioIrmaos(async (c) => {
    await assumir(c, IDS.respA);
    await c.query("savepoint sp");
    let err = null;
    try {
      await c.query(
        `insert into vinculos_responsaveis (escola_id, responsavel_id, aluno_id) values ($1, $2, $3)`,
        [ESCOLA_A, IDS.respA.sub, ALUNO_SEM_VINCULO],
      );
    } catch (e) { err = e; }
    await c.query("rollback to savepoint sp");
    assert.ok(err && /row-level security/i.test(err.message), "responsável conseguiu criar vínculo sozinho");

    const d = await c.query("delete from vinculos_responsaveis where aluno_id = $1 returning id", [ALUNA_IRMA]);
    assert.equal(d.rows.length, 0, "responsável conseguiu apagar o próprio vínculo");
  });
});
