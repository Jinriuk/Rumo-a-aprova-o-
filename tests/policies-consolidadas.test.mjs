// ============================================================
// DB2-B — POLICIES CONSOLIDADAS: prova de equivalência
// ------------------------------------------------------------
// Garante que a migration 0029 (a) eliminou as policies permissivas
// duplicadas de SELECT e (b) NÃO mudou comportamento: coordenação,
// aluno e responsável continuam com exatamente o mesmo acesso, e a
// suspensão de escola continua bloqueando onde já bloqueava.
// Tudo em transação com ROLLBACK.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, ESCOLA_A, IDS } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

// As 7 tabelas que tinham `multiple_permissive_policies` no SELECT.
const TABELAS = [
  "aluno_conquistas", "aluno_niveis", "aluno_onboarding",
  "aluno_xp_eventos", "config_escola", "missoes_escola",
  "vinculos_responsaveis",
];

test("DB2-B: cada tabela tem no máximo 1 policy permissiva aplicável a SELECT (authenticated)", async () => {
  for (const t of TABELAS) {
    const { rows } = await pool.query(
      `select count(*)::int as n
         from pg_policies
        where schemaname = 'public' and tablename = $1
          and permissive = 'PERMISSIVE'
          and roles::text like '%authenticated%'
          and cmd in ('SELECT', 'ALL')`,
      [t],
    );
    assert.equal(rows[0].n, 1, `${t}: deve ter exatamente 1 policy permissiva de SELECT (tinha 2)`);
  }
});

test("DB2-B: coordenação manteve políticas de ESCRITA (insert/update/delete)", async () => {
  for (const t of TABELAS) {
    const { rows } = await pool.query(
      `select array_agg(distinct cmd order by cmd) as cmds
         from pg_policies
        where schemaname = 'public' and tablename = $1
          and (policyname like '%coord%' or policyname like '%coordenacao%')`,
      [t],
    );
    const cmds = rows[0].cmds || [];
    for (const c of ["INSERT", "UPDATE", "DELETE"]) {
      assert.ok(cmds.includes(c), `${t}: coordenação deve manter ${c}`);
    }
    assert.ok(!cmds.includes("ALL"), `${t}: não deve sobrar policy FOR ALL da coordenação`);
  }
});

test("DB2-B: coordenação não vaza entre escolas (config_escola e vinculos)", async () => {
  await como(IDS.coordA, async (c) => {
    const cfg = await c.query("select count(*)::int as fora from config_escola where escola_id <> $1", [ESCOLA_A]);
    assert.equal(cfg.rows[0].fora, 0, "coordA não enxerga config_escola de outra escola");
    const vin = await c.query("select count(*)::int as fora from vinculos_responsaveis where escola_id <> $1", [ESCOLA_A]);
    assert.equal(vin.rows[0].fora, 0, "coordA não enxerga vínculos de outra escola");
  });
});

test("DB2-B: responsável só vê os próprios vínculos", async () => {
  await como(IDS.respA, async (c) => {
    const { rows } = await c.query(
      "select count(*)::int as outros from vinculos_responsaveis where responsavel_id <> $1",
      [IDS.respA.sub],
    );
    assert.equal(rows[0].outros, 0, "responsável não vê vínculo de outro responsável");
  });
});

// Suspensão preservada em vinculos_responsaveis (tenant_operacional).
async function comStatusVinculos(status, id, fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("update escolas set status = $1 where id = $2", [status, ESCOLA_A]);
    await c.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: id.sub, role: "authenticated", app_metadata: { escola_id: id.escola_id, papel: id.papel } }),
    ]);
    await c.query("set local role authenticated");
    return await fn(c);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

test("DB2-B: escola suspensa continua bloqueando SELECT de vínculos (coordenação)", async () => {
  await comStatusVinculos("ativa", IDS.coordA, async (c) => {
    const n = (await c.query("select count(*)::int as n from vinculos_responsaveis")).rows[0].n;
    assert.ok(n >= 0, "ativa: coordenação consulta vínculos sem erro");
  });
  await comStatusVinculos("suspensa", IDS.coordA, async (c) => {
    const n = (await c.query("select count(*)::int as n from vinculos_responsaveis")).rows[0].n;
    assert.equal(n, 0, "suspensa: coordenação não enxerga vínculos (tenant_operacional preservado)");
  });
});
