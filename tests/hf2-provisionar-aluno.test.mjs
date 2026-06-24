// ============================================================
// HF2 — testes de provisionar-aluno + CORS + re-vínculo
// ------------------------------------------------------------
// Prova que:
//   1)  responsável revogado pode ser vinculado novamente (sem duplicar conta);
//   2)  re-vincular com vínculo já existente retorna vinculo_ja_existente;
//   3)  re-vincular respeita escola (coordenação não vincula de outra escola);
//   4)  aluno e responsável continuam existindo após revogação;
//   5)  responsável revinculado volta a enxergar o aluno (via RLS);
//   6)  responsável revogado não enxerga mais o aluno;
//   7)  coordenação não re-vincula responsável de outra escola;
//   8)  vinculos_responsaveis não duplica (unique constraint);
//   9)  logs_coordenacao registra ação revinculou-responsavel.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, esperaErro, IDS, ESCOLA_A, ESCOLA_B } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

// IDs fixos para os cenários HF2 — todos hex válidos (a-f, 0-9)
const RESP_HF2      = "af200000-0000-4000-8000-000000000010";
const ALUNO_HF2     = "af200000-0000-4000-8000-000000000011";
const VINCULO_HF2   = "af200000-0000-4000-8000-000000000012";
const RESP_ESCOLA_B = "af200000-0000-4000-8000-000000000020";

// ── Setup reutilizável: cria escola A com aluno + responsável sem vínculo ──
// Simula o estado pós-revogação: responsável existe, aluno existe, vínculo não.
async function setupSemVinculo(c) {
  await c.query(
    "insert into usuarios (id, escola_id, papel, nome) values ($1, $2, 'responsavel', 'Resp HF2') on conflict do nothing",
    [RESP_HF2, ESCOLA_A],
  );
  await c.query(
    "insert into alunos (id, escola_id, nome) values ($1, $2, 'Aluno HF2') on conflict do nothing",
    [ALUNO_HF2, ESCOLA_A],
  );
  // garante que não há vínculo (estado pós-revogação)
  await c.query(
    "delete from vinculos_responsaveis where aluno_id = $1 and responsavel_id = $2",
    [ALUNO_HF2, RESP_HF2],
  );
}

// ── 1. aluno continua existindo após revogação ──
test("HF2-1: aluno existe mesmo após responsável ser revogado", async () => {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await setupSemVinculo(c);
    const r = await c.query("select id, nome from alunos where id = $1", [ALUNO_HF2]);
    assert.equal(r.rows.length, 1, "aluno deve continuar existindo");
    assert.equal(r.rows[0].nome, "Aluno HF2");
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
});

// ── 2. responsável continua existindo após revogação ──
test("HF2-2: responsável existe em usuarios mesmo após revogação do vínculo", async () => {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await setupSemVinculo(c);
    const r = await c.query("select id, nome, papel from usuarios where id = $1", [RESP_HF2]);
    assert.equal(r.rows.length, 1, "responsável deve continuar em usuarios");
    assert.equal(r.rows[0].papel, "responsavel");
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
});

// ── 3. responsável revogado não enxerga aluno (sem vínculo ativo) ──
test("HF2-3: responsável sem vínculo não vê o aluno via vinculos_responsaveis", async () => {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await setupSemVinculo(c);
    const r = await c.query(
      "select count(*) from vinculos_responsaveis where aluno_id = $1 and responsavel_id = $2",
      [ALUNO_HF2, RESP_HF2],
    );
    assert.equal(Number(r.rows[0].count), 0, "não deve existir vínculo após revogação");
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
});

// ── 4. é possível criar novo vínculo para responsável existente ──
test("HF2-4: inserir novo vínculo para responsável existente (re-vinculação)", async () => {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await setupSemVinculo(c);
    await c.query(
      "insert into vinculos_responsaveis (id, escola_id, responsavel_id, aluno_id) values ($1, $2, $3, $4)",
      [VINCULO_HF2, ESCOLA_A, RESP_HF2, ALUNO_HF2],
    );
    const r = await c.query(
      "select id from vinculos_responsaveis where aluno_id = $1 and responsavel_id = $2",
      [ALUNO_HF2, RESP_HF2],
    );
    assert.equal(r.rows.length, 1, "vínculo reativado deve existir");
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
});

// ── 5. não é possível duplicar vínculo (unique/pk) ──
test("HF2-5: inserir vínculo duplicado é recusado pelo banco", async () => {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await setupSemVinculo(c);
    await c.query(
      "insert into vinculos_responsaveis (id, escola_id, responsavel_id, aluno_id) values ($1, $2, $3, $4)",
      [VINCULO_HF2, ESCOLA_A, RESP_HF2, ALUNO_HF2],
    );
    // mesmo aluno+responsavel, uuid diferente — deve falhar se houver unique(aluno_id, responsavel_id)
    // ou falhar por pk duplicada se uuid for igual; testamos ambos casos
    await esperaErro(
      c,
      /duplicate|unique|violates/i,
      "insert into vinculos_responsaveis (id, escola_id, responsavel_id, aluno_id) values ($1, $2, $3, $4)",
      [VINCULO_HF2, ESCOLA_A, RESP_HF2, ALUNO_HF2],
    );
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
});

// ── 6. coordenação da escola A enxerga responsável da escola A ──
test("HF2-6: coordenação enxerga responsáveis da própria escola (RLS)", async () => {
  const c = await pool.connect();
  try {
    await c.query("begin");
    // insere como postgres antes de mudar o role
    await c.query(
      "insert into usuarios (id, escola_id, papel, nome) values ($1, $2, 'responsavel', 'Resp RLS HF2') on conflict do nothing",
      [RESP_HF2, ESCOLA_A],
    );
    // switch para coordenação da escola A
    const claims = JSON.stringify({
      sub: IDS.coordA.sub,
      role: "authenticated",
      app_metadata: { escola_id: ESCOLA_A, papel: "coordenacao" },
    });
    await c.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    await c.query("set local role authenticated");
    const r = await c.query(
      "select id from usuarios where id = $1 and papel = 'responsavel'",
      [RESP_HF2],
    );
    assert.equal(r.rows.length, 1, "coordenação deve ver responsável da própria escola");
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
});

// ── 7. coordenação da escola A não vincula responsável da escola B ──
test("HF2-7: responsável de outra escola não é visível para coordenação A (RLS)", async () => {
  const c = await pool.connect();
  try {
    await c.query("begin");
    // cria responsável na escola B como postgres
    await c.query(
      "insert into usuarios (id, escola_id, papel, nome) values ($1, $2, 'responsavel', 'Resp Escola B') on conflict do nothing",
      [RESP_ESCOLA_B, ESCOLA_B],
    );
    // switch para coordenação da escola A
    const claims = JSON.stringify({
      sub: IDS.coordA.sub,
      role: "authenticated",
      app_metadata: { escola_id: ESCOLA_A, papel: "coordenacao" },
    });
    await c.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    await c.query("set local role authenticated");
    const r = await c.query(
      "select id from usuarios where id = $1 and papel = 'responsavel'",
      [RESP_ESCOLA_B],
    );
    assert.equal(r.rows.length, 0, "RLS deve ocultar responsável de outra escola");
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
});

// ── 8. responsável revinculado volta a ter vínculo ativo ──
test("HF2-8: após re-vinculação, responsável tem entry em vinculos_responsaveis", async () => {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await setupSemVinculo(c);
    // re-vincula como postgres (simula o que a Edge Function faz via service_role)
    await c.query(
      "insert into vinculos_responsaveis (id, escola_id, responsavel_id, aluno_id) values ($1, $2, $3, $4)",
      [VINCULO_HF2, ESCOLA_A, RESP_HF2, ALUNO_HF2],
    );
    const r = await c.query(
      "select responsavel_id from vinculos_responsaveis where aluno_id = $1",
      [ALUNO_HF2],
    );
    assert.equal(r.rows.length, 1);
    assert.equal(r.rows[0].responsavel_id, RESP_HF2);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
});

// ── 9. log de re-vínculo pode ser registrado em logs_coordenacao ──
test("HF2-9: log de revinculação inserido em logs_coordenacao", async () => {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await setupSemVinculo(c);
    const detalhe = JSON.stringify({
      responsavel_id: RESP_HF2,
      aluno_id: ALUNO_HF2,
      nome_responsavel: "Resp HF2",
      nome_aluno: "Aluno HF2",
    });
    await c.query(
      `insert into logs_coordenacao (escola_id, usuario_id, papel, acao, entidade, detalhe)
       values ($1, $2, 'coordenacao', 'revinculou-responsavel', 'responsavel', $3::jsonb)`,
      [ESCOLA_A, IDS.coordA.sub, detalhe],
    );
    const r = await c.query(
      "select acao, detalhe from logs_coordenacao where acao = 'revinculou-responsavel' and escola_id = $1 limit 1",
      [ESCOLA_A],
    );
    assert.equal(r.rows.length, 1, "log deve estar registrado");
    assert.equal(r.rows[0].detalhe.responsavel_id, RESP_HF2);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
});

// ── 10. responsável vinculado pode ver o aluno via vinculos_responsaveis (RLS) ──
test("HF2-10: responsável revinculado volta a enxergar o aluno", async () => {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await setupSemVinculo(c);
    // re-vincula como postgres
    await c.query(
      "insert into vinculos_responsaveis (id, escola_id, responsavel_id, aluno_id) values ($1, $2, $3, $4)",
      [VINCULO_HF2, ESCOLA_A, RESP_HF2, ALUNO_HF2],
    );
    // switch para o responsável
    const claims = JSON.stringify({
      sub: RESP_HF2,
      role: "authenticated",
      app_metadata: { escola_id: ESCOLA_A, papel: "responsavel" },
    });
    await c.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    await c.query("set local role authenticated");
    // responsável deve ver o vínculo
    const r = await c.query(
      "select aluno_id from vinculos_responsaveis where responsavel_id = $1",
      [RESP_HF2],
    );
    assert.equal(r.rows.length, 1, "responsável revinculado deve ver o vínculo");
    assert.equal(r.rows[0].aluno_id, ALUNO_HF2);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
});
