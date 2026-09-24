// ============================================================
// ETAPA 2, FATIA 3 — C-S04: app.tenant_operacional() nega por padrão
// ------------------------------------------------------------
// Antes (0027): escola do token inexistente ou ausente → "operacional".
// Agora (0056): sem escola, só o super admin ativo, por regra explícita;
// com escola, ela precisa existir e não estar suspensa nem cancelada.
// E a coordenação de escola parada não escreve nas nove tabelas que a
// 0027 deixou sem porteiro (C-S04b, achado da matriz).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, IDS, ESCOLA_A, ALUNO_LUCAS } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const ESC_SUSP = "e2560000-0000-4000-8000-00000000000d";
const ESC_CANC = "e2560000-0000-4000-8000-00000000000e";
const ESC_FANTASMA = "e2560000-0000-4000-8000-00000000000f";
const COORD_SUSP = "e2560000-0000-4000-8000-000000000101";
const COORD_CANC = "e2560000-0000-4000-8000-000000000102";
const ALUNO_SUSP = "e2560000-0000-4000-8000-000000000201";
const ALUNO_CANC = "e2560000-0000-4000-8000-000000000202";
const SA = "e2560000-0000-4000-8000-000000000301";
const SA_INATIVO = "e2560000-0000-4000-8000-000000000302";

async function cenario(fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    // grants do hospedado: só a RLS segura (ver matriz-autorizacao.mjs)
    await c.query("grant select, insert, update, delete on all tables in schema public to anon, authenticated");
    await c.query(`insert into escolas (id, nome, slug, status) values
      ($1, 'E2 suspensa', 'e2-56-s', 'suspensa'), ($2, 'E2 cancelada', 'e2-56-x', 'cancelada')`, [ESC_SUSP, ESC_CANC]);
    await c.query(`insert into usuarios (id, escola_id, papel, nome) values
      ($1, $2, 'coordenacao', 'E2 coord S'), ($3, $4, 'coordenacao', 'E2 coord X')`, [COORD_SUSP, ESC_SUSP, COORD_CANC, ESC_CANC]);
    await c.query(`insert into alunos (id, escola_id, nome) values ($1, $2, 'E2 aluno S'), ($3, $4, 'E2 aluno X')`, [ALUNO_SUSP, ESC_SUSP, ALUNO_CANC, ESC_CANC]);
    await c.query(`insert into internal_admins (auth_user_id, email, nome, ativo) values
      ($1, 'e2-56-sa@t.local', 'SA', true), ($2, 'e2-56-sai@t.local', 'SA inativo', false)`, [SA, SA_INATIVO]);
    const como = async (claims, sql, params = []) => {
      await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: claims.sub, role: "authenticated", app_metadata: { escola_id: claims.escola_id ?? null, papel: claims.papel } })]);
      await c.query("set local role authenticated");
      await c.query("savepoint op");
      try { const r = await c.query(sql, params); return { ok: true, linhas: r.rowCount, rows: r.rows }; }
      catch (e) { await c.query("rollback to savepoint op"); return { ok: false, erro: String(e.message) }; }
      finally { await c.query("reset role"); }
    };
    return await fn({ c, como });
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

const operacional = async (como, claims) => (await como(claims, "select app.tenant_operacional() as v")).rows[0].v;

test("C-S04: tenant_operacional por tipo de token", async () => {
  await cenario(async ({ como }) => {
    assert.equal(await operacional(como, IDS.coordA), true, "escola ativa");
    assert.equal(await operacional(como, { sub: COORD_SUSP, escola_id: ESC_SUSP, papel: "coordenacao" }), false, "suspensa");
    assert.equal(await operacional(como, { sub: COORD_CANC, escola_id: ESC_CANC, papel: "coordenacao" }), false, "cancelada");
    assert.equal(await operacional(como, { sub: IDS.coordA.sub, escola_id: ESC_FANTASMA, papel: "coordenacao" }), false, "escola que não existe: era true antes da 0056");
    assert.equal(await operacional(como, { sub: IDS.coordA.sub, escola_id: null, papel: "coordenacao" }), false, "coordenação sem escola no token: era true antes da 0056");
    assert.equal(await operacional(como, { sub: SA, escola_id: null, papel: "super_admin" }), true, "super admin ativo: regra explícita");
    assert.equal(await operacional(como, { sub: SA_INATIVO, escola_id: null, papel: "super_admin" }), false, "super admin inativo");
    assert.equal(await operacional(como, { sub: "e2560000-0000-4000-8000-000000000399", escola_id: null, papel: "super_admin" }), false, "se diz super admin sem linha");
  });
});

// as nove tabelas que a 0027 deixou sem porteiro, com a escrita que a
// coordenação faz: cada uma devolve [sql, params] para (escola, aluno, coord)
const ESCRITAS = {
  config_escola: (e) => [`insert into config_escola (escola_id, exam_tag, chave, valor) values ($1, 'cn', 'e2-56', '{}')`, [e]],
  missoes_escola: (e) => [`insert into missoes_escola (escola_id, missao_id, ativa) values ($1, (select m.id from missoes m where not exists (select 1 from missoes_escola me where me.escola_id = $1 and me.missao_id = m.id) order by m.id limit 1), true)`, [e]],
  logs_coordenacao: (e, a, coord) => [`insert into logs_coordenacao (escola_id, usuario_id, papel, acao) values ($1, $2, 'coordenacao', 'e2-56')`, [e, coord]],
  aluno_xp_eventos: (e, a) => [`insert into aluno_xp_eventos (escola_id, aluno_id, exam_tag, origem, pontos) values ($1, $2, 'cn', 'ajuste_manual', 5)`, [e, a]],
  aluno_conquistas: (e, a) => [`insert into aluno_conquistas (escola_id, aluno_id, conquista_id, exam_tag) values ($1, $2, (select c.id from conquistas c where not exists (select 1 from aluno_conquistas x where x.aluno_id = $2 and x.conquista_id = c.id and x.exam_tag = 'cn') order by c.id limit 1), 'cn')`, [e, a]],
  aluno_missoes: (e, a) => [`insert into aluno_missoes (escola_id, aluno_id, missao_id, exam_tag, estado) values ($1, $2, (select m.id from missoes m where not exists (select 1 from aluno_missoes x where x.aluno_id = $2 and x.missao_id = m.id) order by m.id limit 1), 'cn', 'concluida')`, [e, a]],
  aluno_niveis: (e, a) => [`insert into aluno_niveis (escola_id, aluno_id, escopo, nivel, origem) values ($1, $2, 'e2-56', 'base', 'manual')`, [e, a]],
  aluno_onboarding: (e, a) => [`insert into aluno_onboarding (escola_id, aluno_id, objetivo) values ($1, $2, 'x') on conflict (aluno_id) do update set objetivo = 'x'`, [e, a]],
  aluno_eventos_progresso: (e, a) => [`insert into aluno_eventos_progresso (escola_id, aluno_id, exam_tag, tipo_evento, origem, xp_delta, idempotency_key) values ($1, $2, 'cn', 'ajuste_coordenacao', 'e2', 5, 'e2-56-' || md5(random()::text))`, [e, a]],
};

for (const [nome, escola, coord, aluno] of [["suspensa", ESC_SUSP, COORD_SUSP, ALUNO_SUSP], ["cancelada", ESC_CANC, COORD_CANC, ALUNO_CANC]]) {
  test(`C-S04b: coordenação de escola ${nome} não escreve nas nove tabelas que a 0027 deixou sem porteiro`, async () => {
    await cenario(async ({ c, como }) => {
      for (const [t, montar] of Object.entries(ESCRITAS)) {
        const [sql, params] = montar(escola, aluno, coord);
        // sem RLS o mesmo comando passa: a negação é de autorização, não de dado
        await c.query("savepoint ctl");
        const ctl = await c.query(sql, params).then(() => null, (e) => e.message);
        await c.query("rollback to savepoint ctl");
        assert.equal(ctl, null, `${t}: o comando nem sem RLS funciona, o teste seria vazio (${ctl})`);
        const r = await como({ sub: coord, escola_id: escola, papel: "coordenacao" }, sql, params);
        assert.equal(r.ok, false, `escola ${nome}: coordenação gravou em ${t}`);
        assert.match(r.erro, /row-level security/);
      }
    });
  });
}

test("C-S04b: a coordenação de escola ativa continua escrevendo nas mesmas nove tabelas (controle)", async () => {
  await cenario(async ({ como }) => {
    for (const [t, montar] of Object.entries(ESCRITAS)) {
      const [sql, params] = montar(ESCOLA_A, ALUNO_LUCAS, IDS.coordA.sub);
      const r = await como(IDS.coordA, sql, params);
      assert.equal(r.ok, true, `coordenação ativa não conseguiu gravar em ${t}: ${r.erro}`);
      assert.equal(r.linhas, 1);
    }
  });
});

test("C-S04: toda policy de escrita da coordenação passa pelo porteiro de escola operacional", async () => {
  // A regra da 0027 + 0056: escola parada não escreve. Uma policy nova de
  // escrita para a coordenação sem o porteiro reabre o C-S04b.
  const c = await pool.connect();
  try {
    const { rows } = await c.query(`
      select tablename, policyname, cmd, coalesce(qual, '') || ' ' || coalesce(with_check, '') as expr
      from pg_policies
      where schemaname = 'public' and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
        and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'coordenacao'`);
    assert.ok(rows.length >= 30, `só ${rows.length} policies de escrita da coordenação — a consulta mudou?`);
    const sem = rows.filter((r) => !/tenant_operacional\(\)/.test(r.expr)).map((r) => `${r.tablename}.${r.policyname} (${r.cmd})`);
    assert.deepEqual(sem, []);
  } finally { c.release(); }
});
