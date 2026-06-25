// ============================================================
// HF3 — Criação de escola pelo backoffice (BUG-P1-001)
// ------------------------------------------------------------
// Prova que:
//   1)  super_admin cria escola com dados mínimos (nome + slug);
//   2)  escola criada aparece imediatamente em backoffice_escolas();
//   3)  super_admin cria escola com dados completos (todos os campos);
//   4)  slug duplicado é recusado (constraint unique);
//   5)  nome vazio é recusado;
//   6)  slug vazio é recusado;
//   7)  não-super_admin não cria escola (acesso negado);
//   8)  criação registra entrada em admin_logs.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, esperaErro, IDS } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const ADMIN_HF3 = "af300000-0000-4000-8000-000000000001";
const claimsDe = (sub) => JSON.stringify({ sub, role: "authenticated", app_metadata: {} });

async function comoSuperAdmin(fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(
      "insert into internal_admins (auth_user_id, email, nome, ativo) values ($1, 'hf3@interno.local', 'Admin HF3', true)",
      [ADMIN_HF3],
    );
    await c.query("select set_config('request.jwt.claims', $1, true)", [claimsDe(ADMIN_HF3)]);
    await c.query("set local role authenticated");
    return await fn(c);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

// ── 1. criação com dados mínimos ──
test("HF3-1: super_admin cria escola com nome e slug (dados mínimos)", async () => {
  await comoSuperAdmin(async (c) => {
    const r = await c.query(
      "select public.backoffice_criar_escola($1, $2) as id",
      ["Escola Mínima HF3", "escola-minima-hf3"],
    );
    const id = r.rows[0].id;
    assert.ok(id, "deve retornar o uuid da escola criada");
    const d = await c.query("select public.backoffice_detalhe_escola($1) as j", [id]);
    const escola = d.rows[0].j.escola;
    assert.ok(escola, "escola deve existir na tabela");
    assert.equal(escola.nome, "Escola Mínima HF3");
    assert.equal(escola.slug, "escola-minima-hf3");
    assert.equal(escola.status, "implantacao", "status padrão deve ser implantacao");
  });
});

// ── 2. escola aparece imediatamente em backoffice_escolas() ──
test("HF3-2: escola criada aparece imediatamente em backoffice_escolas()", async () => {
  await comoSuperAdmin(async (c) => {
    const { rows: [{ id }] } = await c.query(
      "select public.backoffice_criar_escola($1, $2) as id",
      ["Escola Visível HF3", "escola-visivel-hf3"],
    );
    const lista = await c.query("select escola_id from public.backoffice_escolas()");
    const ids = lista.rows.map((r) => r.escola_id);
    assert.ok(ids.includes(id), "escola recém-criada deve aparecer na listagem imediatamente");
  });
});

// ── 3. criação com dados completos ──
test("HF3-3: super_admin cria escola com todos os campos de contato", async () => {
  await comoSuperAdmin(async (c) => {
    const r = await c.query(
      `select public.backoffice_criar_escola(
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
       ) as id`,
      [
        "Escola Completa HF3",
        "escola-completa-hf3",
        "São Paulo",
        "SP",
        "premium",
        500,
        "piloto",
        "contato@escola-hf3.edu.br",
        "(11) 99999-0000",
        "Diretor HF3",
        "Observação de teste",
      ],
    );
    const id = r.rows[0].id;
    assert.ok(id, "deve retornar uuid");
    const d = await c.query("select public.backoffice_detalhe_escola($1) as j", [id]);
    const row = d.rows[0].j.escola;
    assert.equal(row.nome, "Escola Completa HF3");
    assert.equal(row.cidade, "São Paulo");
    assert.equal(row.uf, "SP");
    assert.equal(row.plano, "premium");
    assert.equal(Number(row.limite_alunos), 500);
    assert.equal(row.status, "piloto");
    assert.equal(row.email_institucional, "contato@escola-hf3.edu.br");
    assert.equal(row.telefone_contato, "(11) 99999-0000");
    assert.equal(row.contato_nome, "Diretor HF3");
    assert.equal(row.contato_observacao, "Observação de teste");
  });
});

// ── 4. slug duplicado recusado ──
test("HF3-4: slug duplicado é recusado pelo banco", async () => {
  await comoSuperAdmin(async (c) => {
    await c.query(
      "select public.backoffice_criar_escola($1, $2)",
      ["Escola Slug Orig HF3", "slug-duplicado-hf3"],
    );
    await esperaErro(
      c,
      /duplicate|unique|violates|duplicado/i,
      "select public.backoffice_criar_escola($1, $2)",
      ["Escola Slug Dupl HF3", "slug-duplicado-hf3"],
    );
  });
});

// ── 5. nome vazio recusado ──
test("HF3-5: nome vazio é recusado (not null constraint)", async () => {
  await comoSuperAdmin(async (c) => {
    await esperaErro(
      c,
      /null|not.null|violates|vazio|obrigat/i,
      "select public.backoffice_criar_escola($1, $2)",
      [null, "slug-sem-nome-hf3"],
    );
  });
});

// ── 6. slug vazio recusado ──
test("HF3-6: slug vazio é recusado (not null constraint)", async () => {
  await comoSuperAdmin(async (c) => {
    await esperaErro(
      c,
      /null|not.null|violates|vazio|obrigat/i,
      "select public.backoffice_criar_escola($1, $2)",
      ["Escola Sem Slug HF3", null],
    );
  });
});

// ── 7. não-super_admin recusado ──
test("HF3-7: coordenação não consegue criar escola (acesso negado)", async () => {
  await como(IDS.coordA, async (c) => {
    await esperaErro(
      c,
      /acesso negado/i,
      "select public.backoffice_criar_escola($1, $2)",
      ["Intrusão HF3", "intrusao-hf3"],
    );
  });
});

// ── 8. log registrado em admin_logs ──
test("HF3-8: criação de escola registra entrada em admin_logs", async () => {
  await comoSuperAdmin(async (c) => {
    const { rows: [{ id }] } = await c.query(
      "select public.backoffice_criar_escola($1, $2) as id",
      ["Escola Log HF3", "escola-log-hf3"],
    );
    const log = await c.query(
      "select acao, escola_id, detalhe from admin_logs where acao = 'criar-escola' and escola_id = $1",
      [id],
    );
    assert.equal(log.rows.length, 1, "deve haver exatamente 1 log de criar-escola");
    assert.equal(log.rows[0].escola_id, id);
    assert.equal(log.rows[0].detalhe.nome, "Escola Log HF3");
    assert.equal(log.rows[0].detalhe.slug, "escola-log-hf3");
  });
});
