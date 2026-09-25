// ============================================================
// ETAPA 2 — 0055: linha ligada a aluno/turma/meta/usuário é da MESMA escola
// ------------------------------------------------------------
// A matriz de autorização (Etapa 2, fatia 2) achou que as policies
// conferiam `escola_id = tenant` na linha, mas as FKs apontavam só para
// o id — e FK não passa por RLS. A coordenação da escola A conseguia:
//   1. apagar a conta da coordenação da escola B pela exclusão LGPD
//      (usuario_id do próprio aluno, ou vínculo, apontando para a B);
//   2. ler as respostas de onboarding de um aluno da B;
//   3. ler o nome de uma turma da B pela exportação LGPD.
// Cada teste abaixo refaz o ataque e exige a recusa, e um teste de
// estrutura impede que uma tabela nova com aluno_id + escola_id nasça
// sem a FK composta.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, IDS, ESCOLA_A, ESCOLA_B, ALUNO_LUCAS, ALUNO_BRUNO } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const ALUNA_A2 = "a0000000-0000-4000-8000-000000000020"; // Alice, escola A (seed)
const TURMA_A = "aa000000-0000-4000-8000-000000000001";
const TURMA_B = "e2550000-0000-4000-8000-0000000000b1"; // criada no teste
const FK_ESCOLA = /mesma_escola_fkey/;

// Transação que SEMPRE termina em rollback. `como(persona, sql)` roda um
// comando com a identidade real (authenticated + claims) e devolve
// { ok, erro, linhas }; `servidor(sql)` roda como postgres (motor, Edge
// Function com service_role, operador).
async function cenario(fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    // grants do hospedado (medidos em 24/09): lá anon/authenticated têm DML de
    // tabela em quase todo public e só a RLS segura. Sem isto o Postgres do
    // CI negaria por falta de grant, que não é a barreira de produção.
    await c.query("grant select, insert, update, delete on all tables in schema public to anon, authenticated");
    await c.query("insert into turmas (id, escola_id, nome) values ($1, $2, 'E2 Turma B')", [TURMA_B, ESCOLA_B]);
    const como = async (ident, sql, params = []) => {
      await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({
        sub: ident.sub, role: "authenticated", app_metadata: { escola_id: ident.escola_id, papel: ident.papel },
      })]);
      await c.query("set local role authenticated");
      await c.query("savepoint op");
      try {
        const r = await c.query(sql, params);
        return { ok: true, linhas: r.rowCount, rows: r.rows };
      } catch (e) {
        await c.query("rollback to savepoint op");
        return { ok: false, erro: String(e.message) };
      } finally {
        await c.query("reset role");
      }
    };
    const servidor = async (sql, params = []) => {
      await c.query("savepoint srv");
      try { const r = await c.query(sql, params); return { ok: true, linhas: r.rowCount, rows: r.rows }; }
      catch (e) { await c.query("rollback to savepoint srv"); return { ok: false, erro: String(e.message) }; }
    };
    return await fn({ como, servidor });
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

// ── 1. exclusão de conta entre escolas ────────────────────────
test("0055: coordenação A não aponta o usuario_id do próprio aluno para a conta da coordenação B", async () => {
  await cenario(async ({ como, servidor }) => {
    const r = await como(IDS.coordA, "update alunos set usuario_id = $1 where id = $2", [IDS.coordB.sub, ALUNA_A2]);
    assert.equal(r.ok, false, "a FK composta tinha que recusar");
    assert.match(r.erro, FK_ESCOLA);
    const lista = await servidor("select app.lgpd_usuarios_do_aluno($1) as u", [ALUNA_A2]);
    assert.ok(!lista.rows[0].u.includes(IDS.coordB.sub), "a exclusão LGPD de A2 não pode alcançar conta da B");
  });
});

test("0055: coordenação A não cria vínculo com a conta da coordenação B como responsável", async () => {
  await cenario(async ({ como, servidor }) => {
    const r = await como(IDS.coordA, "insert into vinculos_responsaveis (escola_id, responsavel_id, aluno_id) values ($1, $2, $3)", [ESCOLA_A, IDS.coordB.sub, ALUNA_A2]);
    assert.equal(r.ok, false);
    assert.match(r.erro, FK_ESCOLA);
    const lista = await servidor("select app.lgpd_usuarios_do_aluno($1) as u", [ALUNA_A2]);
    assert.ok(!lista.rows[0].u.includes(IDS.coordB.sub));
  });
});

test("0055: nem o servidor grava a ligação cruzada (vale para service_role e SECURITY DEFINER)", async () => {
  await cenario(async ({ servidor }) => {
    const cruzados = [
      ["alunos.usuario_id", "update alunos set usuario_id = $1 where id = $2", [IDS.coordB.sub, ALUNA_A2]],
      ["vinculos", "insert into vinculos_responsaveis (escola_id, responsavel_id, aluno_id) values ($1, $2, $3)", [ESCOLA_A, IDS.respB.sub, ALUNA_A2]],
      ["alunos_turmas.turma", "insert into alunos_turmas (escola_id, aluno_id, turma_id) values ($1, $2, $3)", [ESCOLA_A, ALUNA_A2, TURMA_B]],
      ["alunos_turmas.aluno", "insert into alunos_turmas (escola_id, aluno_id, turma_id) values ($1, $2, $3)", [ESCOLA_A, ALUNO_BRUNO, TURMA_A]],
      ["consentimentos", "insert into consentimentos (escola_id, aluno_id, responsavel_nome, registrado_por) values ($1, $2, 'x', $3)", [ESCOLA_A, ALUNO_BRUNO, IDS.coordA.sub]],
      ["registros_estudo", "insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, questoes) values ($1, $2, '2026-01-07', 'mat', 5)", [ESCOLA_A, ALUNO_BRUNO]],
      ["simulados", "insert into simulados (escola_id, aluno_id, nome, data) values ($1, $2, 'x', '2026-01-07')", [ESCOLA_A, ALUNO_BRUNO]],
      ["aluno_onboarding", "insert into aluno_onboarding (aluno_id, escola_id) values ($1, $2)", [ALUNO_BRUNO, ESCOLA_A]],
      ["aluno_xp_eventos", "insert into aluno_xp_eventos (escola_id, aluno_id, exam_tag, origem, pontos) values ($1, $2, 'cn', 'ajuste_manual', 10)", [ESCOLA_A, ALUNO_BRUNO]],
      ["aluno_eventos_progresso", "insert into aluno_eventos_progresso (escola_id, aluno_id, tipo_evento, origem, idempotency_key) values ($1, $2, 'ajuste_coordenacao', 'e2', 'e2-0055')", [ESCOLA_A, ALUNO_BRUNO]],
      ["aluno_niveis", "insert into aluno_niveis (escola_id, aluno_id, escopo, nivel, origem) values ($1, $2, 'e2', 'base', 'manual')", [ESCOLA_A, ALUNO_BRUNO]],
    ];
    for (const [nome, sql, params] of cruzados) {
      const r = await servidor(sql, params);
      assert.equal(r.ok, false, `${nome}: o banco aceitou ligação entre escolas`);
      assert.match(r.erro, FK_ESCOLA, `${nome}: recusou por outro motivo (${r.erro})`);
    }
  });
});

// ── 2. onboarding de aluno da outra escola ────────────────────
test("0055: coordenação A não planta onboarding para aluno da B, e o que o aluno da B salva fica na B", async () => {
  await cenario(async ({ como }) => {
    const plantar = await como(IDS.coordA, "insert into aluno_onboarding (aluno_id, escola_id, objetivo) values ($1, $2, null)", [ALUNO_BRUNO, ESCOLA_A]);
    assert.equal(plantar.ok, false);
    assert.match(plantar.erro, FK_ESCOLA);
    const salvar = await como(IDS.alunoB, "select public.salvar_onboarding_aluno('nunca estudei', 12, 'geometria', 'passar')");
    assert.equal(salvar.ok, true, salvar.erro);
    const leA = await como(IDS.coordA, "select objetivo from aluno_onboarding where aluno_id = $1", [ALUNO_BRUNO]);
    assert.equal(leA.rows.length, 0, "a coordenação A leu o onboarding do aluno da B");
    const leB = await como(IDS.coordB, "select objetivo from aluno_onboarding where aluno_id = $1", [ALUNO_BRUNO]);
    assert.deepEqual(leB.rows.map((r) => r.objetivo), ["passar"]);
  });
});

// ── 3. exportação LGPD ────────────────────────────────────────
test("0055: coordenação A não matricula aluno seu numa turma da B, e a exportação LGPD não traz turma nem log da B", async () => {
  await cenario(async ({ como, servidor }) => {
    const r = await como(IDS.coordA, "insert into alunos_turmas (escola_id, aluno_id, turma_id) values ($1, $2, $3)", [ESCOLA_A, ALUNA_A2, TURMA_B]);
    assert.equal(r.ok, false);
    assert.match(r.erro, FK_ESCOLA);
    // logs_acesso não tem FK (sobrevive à exclusão): o filtro da exportação é a barreira
    await servidor("insert into logs_acesso (escola_id, aluno_id, usuario_id, papel, acao) values ($1, $2, $3, 'coordenacao', 'e2-log-plantado-pela-B')", [ESCOLA_B, ALUNA_A2, IDS.coordB.sub]);
    const exp = await servidor("select app.lgpd_exportar($1) as d", [ALUNA_A2]);
    const d = exp.rows[0].d;
    assert.ok(!d.turmas.includes("E2 Turma B"));
    assert.ok(!d.logs_acesso.some((l) => l.acao === "e2-log-plantado-pela-B"), "log de outra escola entrou na exportação");
  });
});

test("0055: log de acesso só aponta para aluno que o usuário enxerga, da mesma escola", async () => {
  await cenario(async ({ como }) => {
    const cruzado = await como(IDS.coordA, "insert into logs_acesso (escola_id, aluno_id, usuario_id, papel, acao) values ($1, $2, $3, 'coordenacao', 'e2')", [ESCOLA_A, ALUNO_BRUNO, IDS.coordA.sub]);
    assert.equal(cruzado.ok, false, "a coordenação A registrou acesso a aluno da B");
    const proprio = await como(IDS.coordA, "insert into logs_acesso (escola_id, aluno_id, usuario_id, papel, acao) values ($1, $2, $3, 'coordenacao', 'e2')", [ESCOLA_A, ALUNO_LUCAS, IDS.coordA.sub]);
    assert.equal(proprio.ok, true, proprio.erro);
    const resp = await como(IDS.respA, "insert into logs_acesso (escola_id, aluno_id, usuario_id, papel, acao) values ($1, $2, $3, 'responsavel', 'e2')", [ESCOLA_A, ALUNO_LUCAS, IDS.respA.sub]);
    assert.equal(resp.ok, true, `responsável vinculado registra o próprio acesso: ${resp.erro}`);
    const respOutro = await como(IDS.respA, "insert into logs_acesso (escola_id, aluno_id, usuario_id, papel, acao) values ($1, $2, $3, 'responsavel', 'e2')", [ESCOLA_A, ALUNA_A2, IDS.respA.sub]);
    assert.equal(respOutro.ok, false, "responsável registrou acesso a aluno que não é dele");
  });
});

// ── 4. a exclusão LGPD continua fazendo o que devia ───────────
test("0055: a exclusão LGPD ainda leva a conta do aluno e a do responsável exclusivo, e só da mesma escola e papel", async () => {
  await cenario(async ({ servidor }) => {
    // Lucas (A) tem conta de aluno e o respA como responsável exclusivo (seed)
    const lista = (await servidor("select app.lgpd_usuarios_do_aluno($1) as u", [ALUNO_LUCAS])).rows[0].u;
    assert.ok(lista.includes(IDS.alunoA.sub), "a conta do próprio aluno tem que cair");
    assert.ok(lista.includes(IDS.respA.sub), "o responsável cujo único vínculo é o Lucas tem que cair");
    // uma conta da MESMA escola mas de papel coordenação, ligada como responsável, não cai
    await servidor("insert into vinculos_responsaveis (escola_id, responsavel_id, aluno_id) values ($1, $2, $3)", [ESCOLA_A, IDS.coordA.sub, ALUNA_A2]);
    const lista2 = (await servidor("select app.lgpd_usuarios_do_aluno($1) as u", [ALUNA_A2])).rows[0].u;
    assert.ok(!lista2.includes(IDS.coordA.sub), "a exclusão de um aluno não pode levar a conta da coordenação");
    const ex = await servidor("select app.lgpd_excluir($1) as r", [ALUNO_LUCAS]);
    assert.equal(ex.ok, true, ex.erro);
    const sobra = await servidor("select count(*)::int as n from usuarios where id = any($1::uuid[])", [[IDS.alunoA.sub, IDS.respA.sub]]);
    assert.equal(sobra.rows[0].n, 0);
    const coordB = await servidor("select count(*)::int as n from usuarios where id = $1", [IDS.coordB.sub]);
    assert.equal(coordB.rows[0].n, 1);
  });
});

// ── 5. estrutura: tabela nova não nasce sem a FK composta ─────
test("0055: toda tabela com aluno_id e escola_id tem FK composta para alunos (id, escola_id)", async () => {
  // Estas duas guardam registro que sobrevive à exclusão do aluno (sem FK
  // nenhuma para aluno, de propósito — 0001, linha 220). A exportação e a
  // policy de insert tratam logs_acesso; aluno_nivel_historico só é
  // escrito pelo gatilho de aluno_niveis.
  const SEM_FK_DE_PROPOSITO = new Set(["logs_acesso", "aluno_nivel_historico"]);
  const c = await pool.connect();
  try {
    const { rows } = await c.query(`
      select t.table_name,
             exists (
               select 1 from pg_constraint k
               where k.conrelid = format('public.%I', t.table_name)::regclass and k.contype = 'f'
                 and k.confrelid = 'public.alunos'::regclass
                 and (select array_agg(a.attname::text order by a.attname) from pg_attribute a
                      where a.attrelid = k.conrelid and a.attnum = any (k.conkey)) = array['aluno_id', 'escola_id']
             ) as tem_fk_composta
      from information_schema.tables t
      where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
        and exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = t.table_name and c.column_name = 'aluno_id')
        and exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = t.table_name and c.column_name = 'escola_id')
      order by 1`);
    assert.ok(rows.length >= 12, `esperava pelo menos 12 tabelas com aluno_id + escola_id, achei ${rows.length}`);
    const faltando = rows.filter((r) => !r.tem_fk_composta && !SEM_FK_DE_PROPOSITO.has(r.table_name)).map((r) => r.table_name);
    assert.deepEqual(faltando, [], `tabelas sem FK composta (linha de uma escola apontando para aluno de outra): ${faltando.join(", ")}`);
  } finally { c.release(); }
});
