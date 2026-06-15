// ============================================================
// BACKOFFICE INTERNO (migration 0019) — super_admin
// ------------------------------------------------------------
// Prova que: (a) quem NÃO é super_admin não enxerga nada do
// backoffice; (b) o super_admin vê todas as escolas (cross-tenant);
// (c) `ativo=false` revoga o acesso; (d) anon não chama as RPCs.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, esperaErro, IDS, ESCOLA_A } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const ADMIN = "cccccccc-0000-4000-8000-000000000001";
const claimsDe = (sub) => JSON.stringify({ sub, role: "authenticated", app_metadata: {} });

// roda fn como o super_admin ADMIN (inserido na própria transação,
// que sempre faz rollback — não suja o banco). `ativo` controla a flag.
async function comoSuperAdmin(ativo, fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(
      "insert into internal_admins (auth_user_id, email, nome, ativo) values ($1, 'op@interno.local', 'Operador', $2)",
      [ADMIN, ativo],
    );
    await c.query("select set_config('request.jwt.claims', $1, true)", [claimsDe(ADMIN)]);
    await c.query("set local role authenticated");
    return await fn(c);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

test("coordenação NÃO é super_admin e não enxerga o backoffice", async () => {
  await como(IDS.coordA, async (c) => {
    const r = await c.query("select public.sou_super_admin() as ok");
    assert.equal(r.rows[0].ok, false);
    // a RPC de escolas recusa quem não é super_admin
    await esperaErro(c, /acesso negado/i, "select * from public.backoffice_escolas()");
    // e as tabelas internas ficam vazias para a coordenação
    const ia = await c.query("select count(*)::int as n from internal_admins");
    assert.equal(ia.rows[0].n, 0);
    const al = await c.query("select count(*)::int as n from admin_logs");
    assert.equal(al.rows[0].n, 0);
  });
});

test("super_admin ativo vê TODAS as escolas (cross-tenant) e registra log", async () => {
  await comoSuperAdmin(true, async (c) => {
    const sa = await c.query("select public.sou_super_admin() as ok");
    assert.equal(sa.rows[0].ok, true);

    const esc = await c.query("select escola_id, nome, alunos, turmas, coordenadores from public.backoffice_escolas()");
    assert.ok(esc.rows.length >= 2, "deveria ver as escolas A e B (cross-tenant)");
    const ids = esc.rows.map((r) => r.escola_id);
    assert.ok(ids.includes(ESCOLA_A), "a escola A precisa aparecer");
    // os contadores vêm como número (bigint) e são coerentes
    const a = esc.rows.find((r) => r.escola_id === ESCOLA_A);
    assert.ok(Number(a.alunos) >= 1 && Number(a.coordenadores) >= 1);

    // pode gravar a própria trilha de auditoria
    const ins = await c.query(
      "insert into admin_logs (super_admin_id, acao, detalhe) values ($1, 'abriu-painel', '{}'::jsonb) returning id",
      [ADMIN],
    );
    assert.equal(ins.rowCount, 1);
    // e pode lê-la
    const r = await c.query("select count(*)::int as n from admin_logs");
    assert.ok(r.rows[0].n >= 1);
  });
});

test("super_admin cria escola pelo backoffice e lê o detalhe (implantação)", async () => {
  await comoSuperAdmin(true, async (c) => {
    const r = await c.query(
      "select public.backoffice_criar_escola('Escola Teste', 'escola-teste-x', 'Rio', 'RJ', 'padrao', 100) as id",
    );
    const id = r.rows[0].id;
    assert.ok(id, "deveria devolver o id da nova escola");

    const d = await c.query("select public.backoffice_detalhe_escola($1) as j", [id]);
    const j = d.rows[0].j;
    assert.equal(j.escola.nome, "Escola Teste");
    assert.equal(j.escola.status, "implantacao", "nasce em implantação");
    assert.equal(Number(j.alunos), 0);
    assert.equal((j.coordenadores ?? []).length, 0, "ainda sem coordenador");

    // a criação ficou registrada no admin_logs
    const log = await c.query("select count(*)::int as n from admin_logs where acao = 'criar-escola' and escola_id = $1", [id]);
    assert.equal(log.rows[0].n, 1);
  });
});

test("coordenação NÃO cria escola pelo backoffice", async () => {
  await como(IDS.coordA, async (c) => {
    await esperaErro(c, /acesso negado/i, "select public.backoffice_criar_escola('X', 'x-intruso')");
  });
});

test("super_admin INATIVO (ativo=false) é tratado como não-admin", async () => {
  await comoSuperAdmin(false, async (c) => {
    const sa = await c.query("select public.sou_super_admin() as ok");
    assert.equal(sa.rows[0].ok, false);
    await esperaErro(c, /acesso negado/i, "select * from public.backoffice_escolas()");
  });
});

test("super_admin não pode forjar log de OUTRO operador", async () => {
  await comoSuperAdmin(true, async (c) => {
    await esperaErro(c, /row-level security/i,
      "insert into admin_logs (super_admin_id, acao) values ('dddddddd-0000-4000-8000-000000000009', 'forjado')");
  });
});

test("sem login (anon) não chama as RPCs do backoffice", async () => {
  await como(null, async (c) => {
    await esperaErro(c, /permission denied/i, "select public.sou_super_admin()");
    await esperaErro(c, /permission denied/i, "select * from public.backoffice_escolas()");
  });
});
