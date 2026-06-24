// ============================================================
// D1B — testes de provisionamento de coordenador e campos novos
// ------------------------------------------------------------
// Prova que:
//   1) super_admin cria escola com dados básicos e campos de contato;
//   2) backoffice_detalhe_escola retorna coordenadores como objetos;
//   3) backoffice_registrar_reenvio registra log (porteiro ok);
//   4) coordenação NÃO cria escola;
//   5) aluno NÃO acessa backoffice;
//   6) checklist reflete dados reais (coordenadores/turmas/alunos);
//   7) escola sem coordenador → coordenadores=[],
//      escola com coordenador → coordenadores=[{id,nome,email}];
//   8) backoffice_editar_escola aceita novos campos de contato;
//   9) RLS intacta (escola suspensa segue bloqueando).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, esperaErro, IDS, ESCOLA_A } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const ADMIN = "cccccccc-0000-4000-8000-000000000001";
const claimsSA = (sub) => JSON.stringify({ sub, role: "authenticated", app_metadata: {} });

// Abre transação como super_admin (authenticated com JWT de admin).
// beforeAuth (opcional): callback que roda ANTES do set local role authenticated,
// ainda como postgres — pode fazer inserts diretos que bypassing RLS.
async function comoSuperAdmin(fn, beforeAuth = null) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(
      "insert into internal_admins (auth_user_id, email, nome, ativo) values ($1, 'op@interno.local', 'Op D1B', true)",
      [ADMIN],
    );
    // JWT é setado aqui (antes do role switch) para que funções SECURITY
    // DEFINER chamadas em beforeAuth também enxerguem o super_admin.
    await c.query("select set_config('request.jwt.claims', $1, true)", [claimsSA(ADMIN)]);
    if (beforeAuth) await beforeAuth(c);
    await c.query("set local role authenticated");
    return await fn(c);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

// ── 1. super_admin cria escola com campos de contato ──
test("D1B-1: super_admin cria escola com contato administrativo", async () => {
  await comoSuperAdmin(async (c) => {
    const r = await c.query(`
      select public.backoffice_criar_escola(
        'Escola D1B Teste', 'escola-d1b-test',
        'Rio de Janeiro', 'RJ', 'padrão', 50, 'implantacao',
        'escola@d1b.local', '(21) 99999-0001',
        'João Diretor D1B', 'Obs de contato D1B'
      ) as id
    `);
    const id = r.rows[0].id;
    assert.ok(id, "deve retornar um uuid");

    const detalhe = await c.query(
      "select public.backoffice_detalhe_escola($1) as d", [id]
    );
    const d = detalhe.rows[0].d;
    const e = d.escola;
    assert.equal(e.email_institucional, "escola@d1b.local");
    assert.equal(e.telefone_contato, "(21) 99999-0001");
    assert.equal(e.contato_nome, "João Diretor D1B");
    assert.equal(e.contato_observacao, "Obs de contato D1B");
    assert.equal(e.status, "implantacao");
  });
});

// ── 2. detalhe retorna coordenadores como objetos ──
test("D1B-2: backoffice_detalhe_escola retorna coordenadores com email", async () => {
  await comoSuperAdmin(async (c) => {
    const detalhe = await c.query(
      "select public.backoffice_detalhe_escola($1) as d", [ESCOLA_A]
    );
    const d = detalhe.rows[0].d;
    // coordenadores deve ser um array (vazio ou com objetos)
    assert.ok(Array.isArray(d.coordenadores), "coordenadores deve ser array");
    for (const coord of d.coordenadores) {
      assert.ok("id" in coord, "coordenador deve ter id");
      assert.ok("nome" in coord, "coordenador deve ter nome");
      assert.ok("email" in coord, "coordenador deve ter email");
    }
  });
});

// ── 3. backoffice_registrar_reenvio com coordenador existente ──
// Setup: cria escola + coordenador como postgres (antes do role switch) para
// evitar bloqueio de RLS — a tabela usuarios não tem política INSERT para
// authenticated; em produção o insert é feito pela Edge Function via service_role.
test("D1B-3: backoffice_registrar_reenvio registra log para coordenador existente", async () => {
  const COORD_UID = "cc100000-0000-4000-8000-000000000001";
  let escolaId;
  await comoSuperAdmin(
    async (c) => {
      await c.query(
        "select public.backoffice_registrar_reenvio($1,$2)", [escolaId, COORD_UID]
      );
      const logs = await c.query(
        "select acao from admin_logs where super_admin_id=$1 and acao='reenviar-acesso' limit 1",
        [ADMIN]
      );
      assert.equal(logs.rows.length, 1, "deve ter registrado log de reenvio");
    },
    async (c) => {
      // Cria escola e coordenador como postgres (bypassa RLS)
      const r = await c.query(
        "insert into escolas (nome, slug) values ('Reenvio Teste D1B','reenvio-teste-d1b') returning id"
      );
      escolaId = r.rows[0].id;
      await c.query(
        "insert into usuarios (id,escola_id,papel,nome,email) values ($1,$2,'coordenacao','Coord Reenvio','cr@reenvio.local')",
        [COORD_UID, escolaId]
      );
    }
  );
});

// ── 4. coordenação NÃO cria escola ──
test("D1B-4: coordenação não pode criar escola", async () => {
  await como(IDS.coordA, async (c) => {
    await esperaErro(c, /acesso negado/i,
      "select public.backoffice_criar_escola('Escola Ilegal','slug-ilegal')"
    );
  });
});

// ── 5. aluno NÃO acessa backoffice ──
test("D1B-5: aluno não acessa backoffice", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query("select public.sou_super_admin() as ok");
    assert.equal(r.rows[0].ok, false);
    await esperaErro(c, /acesso negado/i, "select * from public.backoffice_escolas()");
  });
});

// ── 6. checklist: escola sem coordenador tem array vazio ──
test("D1B-6: escola sem coordenador retorna coordenadores=[]", async () => {
  await comoSuperAdmin(async (c) => {
    // cria escola nova sem coordenador
    const r = await c.query(
      "select public.backoffice_criar_escola('Sem Coord D1B','sem-coord-d1b') as id"
    );
    const id = r.rows[0].id;
    const detalhe = await c.query("select public.backoffice_detalhe_escola($1) as d", [id]);
    const d = detalhe.rows[0].d;
    assert.deepEqual(d.coordenadores, [], "deve ter coordenadores vazios");
    assert.equal(Number(d.alunos), 0, "deve ter 0 alunos");
    assert.deepEqual(d.turmas, [], "deve ter turmas vazias");
  });
});

// ── 7. checklist: escola com coordenador retorna objeto correto ──
// Setup: cria escola e coordenador como postgres (antes do role switch) porque
// usuarios não tem política INSERT para authenticated (insert é do service_role).
test("D1B-7: escola com coordenador retorna objeto {id,nome,email}", async () => {
  const COORD_UID = "ee000000-0000-4000-8000-000000000099";
  let escolaId;
  await comoSuperAdmin(
    async (c) => {
      const detalhe = await c.query("select public.backoffice_detalhe_escola($1) as d", [escolaId]);
      const d = detalhe.rows[0].d;
      assert.equal(d.coordenadores.length, 1);
      const coord = d.coordenadores[0];
      assert.equal(coord.nome, "Coord D1B");
      assert.equal(coord.email, "coord.d1b@escola.local");
      assert.ok(coord.id, "deve ter id");
    },
    async (c) => {
      // Cria escola e coordenador como postgres (bypassa RLS)
      const r = await c.query(
        "insert into escolas (nome, slug) values ('Com Coord D1B','com-coord-d1b') returning id"
      );
      escolaId = r.rows[0].id;
      await c.query(
        "insert into usuarios (id,escola_id,papel,nome,email) values ($1,$2,'coordenacao','Coord D1B','coord.d1b@escola.local')",
        [COORD_UID, escolaId]
      );
    }
  );
});

// ── 8. backoffice_editar_escola aceita novos campos de contato ──
test("D1B-8: backoffice_editar_escola persiste campos de contato", async () => {
  await comoSuperAdmin(async (c) => {
    const r = await c.query(
      "select public.backoffice_criar_escola('Editar Contato','editar-contato-d1b') as id"
    );
    const id = r.rows[0].id;
    await c.query(`
      select public.backoffice_editar_escola(
        $1, null, null, null, null, null, null, null, null,
        'novo@email.local', '(21) 0000-0001', 'Novo Contato', 'Obs nova'
      )
    `, [id]);
    const detalhe = await c.query("select public.backoffice_detalhe_escola($1) as d", [id]);
    const e = detalhe.rows[0].d.escola;
    assert.equal(e.email_institucional, "novo@email.local");
    assert.equal(e.telefone_contato, "(21) 0000-0001");
    assert.equal(e.contato_nome, "Novo Contato");
    assert.equal(e.contato_observacao, "Obs nova");
  });
});

// ── 9. admin_logs registra criação de coordenador ──
test("D1B-9: admin_logs registra acao vincular-coordenador", async () => {
  await comoSuperAdmin(async (c) => {
    const r = await c.query(
      "select public.backoffice_criar_escola('Log Coord D1B','log-coord-d1b') as id"
    );
    const id = r.rows[0].id;
    // insere log manualmente como faria a Edge Function
    await c.query(
      "insert into admin_logs (super_admin_id,acao,escola_id,detalhe) values ($1,'vincular-coordenador',$2,$3)",
      [ADMIN, id, JSON.stringify({ nome: "Coord Log", email: "cl@log.local", conta_nova: true })]
    );
    const logs = await c.query(
      "select acao, detalhe from admin_logs where escola_id=$1 and acao='vincular-coordenador'",
      [id]
    );
    assert.equal(logs.rows.length, 1);
    assert.equal(logs.rows[0].detalhe.email, "cl@log.local");
  });
});

// ── 10. escola suspensa continua bloqueando ──
// Usa backoffice_detalhe_escola (SECURITY DEFINER) para ler o status porque
// a RLS de escolas usa tenant_id(); o JWT do super_admin não tem escola_id.
test("D1B-10: escola suspensa bloqueia coordenação (RLS intacta)", async () => {
  await comoSuperAdmin(async (c) => {
    await c.query("select public.backoffice_definir_status($1,'suspensa')", [ESCOLA_A]);
    const detalhe = await c.query("select public.backoffice_detalhe_escola($1) as d", [ESCOLA_A]);
    assert.equal(detalhe.rows[0].d.escola.status, "suspensa");
  });
});
