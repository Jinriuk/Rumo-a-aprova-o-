// ============================================================
// ETAPA 2, FATIA 4 — C-S06: toda SECURITY DEFINER tem classe e decisão
// ------------------------------------------------------------
// O dono das funções (postgres) tem BYPASSRLS nos hospedados: dentro de
// uma SECURITY DEFINER a RLS não roda. Então cada uma precisa de uma
// decisão registrada sobre QUEM pode chamá-la. Este teste é o registro:
// uma função SECURITY DEFINER nova sem classe aqui derruba o CI.
//
//   a  operação exposta que confere autorização no corpo (a matriz prova)
//   b  helper de policy: precisa de EXECUTE para authenticated, só lê
//   c  função de gatilho: ninguém precisa de EXECUTE (0057 revogou)
//   d  interna, chamada só por outra SECURITY DEFINER ou pelo operador
//      (0057 revogou; service_role fica)
//   s  de servidor: já não tinha EXECUTE para usuário
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, IDS, ESCOLA_A, ALUNO_LUCAS } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const CLASSE = {
  // a — confere autorização no corpo
  "public.abrir_proximo_ciclo(uuid, date, uuid[])": "a",
  "public.backoffice_criar_escola(text, text, text, text, text, integer, text, text, text, text, text)": "a",
  "public.backoffice_dashboard()": "a",
  "public.backoffice_definir_status(uuid, text)": "a",
  "public.backoffice_detalhe_escola(uuid)": "a",
  "public.backoffice_editar_escola(uuid, text, text, text, text, text, text, integer, text, text, text, text, text)": "a",
  "public.backoffice_escolas()": "a",
  "public.backoffice_registrar_reenvio(uuid, uuid)": "a",
  "public.backoffice_virada_saude(integer)": "a",
  "public.resumo_escola()": "a",
  "public.salvar_onboarding_aluno(text, integer, text, text)": "a",
  "public.sou_super_admin()": "a",
  // b — helper de policy
  "app.eh_super_admin()": "b",
  "app.meu_aluno_id()": "b",
  "app.sou_responsavel_de(uuid)": "b",
  "app.tenant_operacional()": "b",
  // c — gatilho
  "app.estornar_progresso_de_origem()": "c",
  "app.progresso_de_missao()": "c",
  "app.progresso_de_registro()": "c",
  "app.progresso_de_simulado()": "c",
  "app.registrar_nivel_historico()": "c",
  "app.trg_ped1_registro()": "c",
  // d — interna
  "app.backfill_progresso(uuid)": "d",
  "app.desbloquear_conquista_basica(uuid, uuid, text, text)": "d",
  "app.exam_tag_do_aluno(uuid)": "d",
  "app.motor_avaliar_aluno(uuid)": "d",
  "app.motor_conquista_xp(uuid, uuid, text, text)": "d",
  "app.motor_streak_dias(uuid)": "d",
  // s — servidor
  "app.abrir_proximo_ciclo(uuid, date)": "s",
  "app.estado_ciclo(uuid, date)": "s",
  "app.gerar_meta(uuid, date)": "s",
  "app.gerar_meta_protegida(uuid, uuid, date)": "s",
  "app.lgpd_excluir(uuid)": "s",
  "app.lgpd_exportar(uuid)": "s",
  "app.lgpd_usuarios_do_aluno(uuid)": "s",
  "app.registrar_codigo(uuid, uuid, text)": "s",
  "app.registrar_super_admin(text, text)": "s",
  "app.resolver_codigo(text, text, integer, integer)": "s",
  "app.revogar_codigo(uuid)": "s",
  "app.rotacionar_codigo(uuid, text)": "s",
  "app.semana_da_data(uuid, date)": "s",
  "app.virada_saude(integer)": "s",
  "app.virar_semana(date)": "s",
  "app.virar_semana(uuid, date)": "s",
  "public.motor_gerar_meta_segura(uuid)": "s",
  "public.registrar_codigo_acesso(uuid, uuid, text)": "s",
  "public.resolver_codigo_acesso(text, text, integer, integer)": "s",
  "public.revogar_codigo_acesso(uuid)": "s",
  "public.rls_auto_enable()": "s",
  "public.rotacionar_codigo_acesso(uuid, text)": "s",
};

async function secdef() {
  const c = await pool.connect();
  try {
    const { rows } = await c.query(`
      select n.nspname || '.' || p.proname || '(' || oidvectortypes(p.proargtypes) || ')' as nome,
             has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth,
             has_function_privilege('service_role', p.oid, 'EXECUTE') as servico,
             coalesce(array_to_string(p.proconfig, ','), '') as config
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'app') and p.prosecdef
        and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      order by 1`);
    return rows;
  } finally { c.release(); }
}

test("C-S06: toda SECURITY DEFINER de public/app tem classe registrada, e nenhuma classe sobra", async () => {
  const nomes = (await secdef()).map((r) => r.nome);
  const semClasse = nomes.filter((n) => !CLASSE[n]);
  const sobrando = Object.keys(CLASSE).filter((n) => !nomes.includes(n));
  assert.deepEqual(semClasse, [], `SECURITY DEFINER sem decisão de quem chama: classifique em tests/e2-cs06-secdef-db.test.mjs`);
  assert.deepEqual(sobrando, [], "classe registrada para função que não existe mais");
  assert.equal(nomes.length, 50);
});

test("C-S06: toda SECURITY DEFINER fixa o search_path", async () => {
  const sem = (await secdef()).filter((r) => !/search_path=/.test(r.config)).map((r) => r.nome);
  assert.deepEqual(sem, []);
});

test("C-S06: o EXECUTE de cada função é o da classe dela", async () => {
  const erros = [];
  for (const r of await secdef()) {
    const k = CLASSE[r.nome];
    if (k === "a" && !(r.auth && !r.anon)) erros.push(`${r.nome} (a): authenticated ${r.auth}, anon ${r.anon}`);
    if (k === "b" && !r.auth) erros.push(`${r.nome} (b): helper de policy sem EXECUTE para authenticated`);
    if ((k === "c" || k === "d" || k === "s") && (r.auth || r.anon)) erros.push(`${r.nome} (${k}): usuário ainda executa (authenticated ${r.auth}, anon ${r.anon})`);
    if (k === "d" && !r.servico) erros.push(`${r.nome} (d): service_role perdeu o EXECUTE do operador`);
  }
  assert.deepEqual(erros, []);
});

// ── os gatilhos continuam disparando sem o EXECUTE de quem escreve ──
async function comoAluno(fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    const set = async (ident) => {
      await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: ident.sub, role: "authenticated", app_metadata: { escola_id: ident.escola_id, papel: ident.papel } })]);
      await c.query("set local role authenticated");
    };
    return await fn(c, set);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

test("C-S06: registro e exclusão do aluno disparam progresso e estorno (gatilhos c) sem EXECUTE do aluno", async () => {
  await comoAluno(async (c, set) => {
    await set(IDS.alunoA);
    const r = await c.query(`insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, questoes, acertos) values ($1, $2, current_date, 'mat', 7, 5) returning id`, [ESCOLA_A, ALUNO_LUCAS]);
    const id = r.rows[0].id;
    await c.query("reset role");
    const ev = await c.query("select status from aluno_eventos_progresso where idempotency_key = $1", [`registro:${id}`]);
    assert.deepEqual(ev.rows.map((x) => x.status), ["valido"], "progresso_de_registro não disparou");
    await set(IDS.alunoA);
    await c.query("delete from registros_estudo where id = $1", [id]);
    await c.query("reset role");
    const est = await c.query("select status from aluno_eventos_progresso where idempotency_key = $1", [`registro:${id}`]);
    assert.deepEqual(est.rows.map((x) => x.status), ["estornado"], "estornar_progresso_de_origem não disparou");
  });
});

test("C-S06: simulado e atividade concluída disparam os gatilhos de progresso (c)", async () => {
  await comoAluno(async (c, set) => {
    await set(IDS.alunoA);
    const s = await c.query(`insert into simulados (escola_id, aluno_id, nome, data) values ($1, $2, 'e2 c-s06', current_date) returning id`, [ESCOLA_A, ALUNO_LUCAS]);
    const ma = await c.query(`select ma.id from meta_atividades ma join metas m on m.id = ma.meta_id where m.aluno_id = $1 and ma.estado <> 'concluida' limit 1`, [ALUNO_LUCAS]);
    assert.ok(ma.rows.length, "o seed precisa de uma atividade pendente do Lucas");
    await c.query("update meta_atividades set estado = 'concluida' where id = $1", [ma.rows[0].id]);
    await c.query("reset role");
    const ev = await c.query("select idempotency_key from aluno_eventos_progresso where idempotency_key = any($1)", [[`simulado:${s.rows[0].id}`, `meta_atividade:${ma.rows[0].id}`]]);
    assert.equal(ev.rows.length, 2, "progresso_de_simulado ou progresso_de_missao não disparou");
  });
});

test("C-S06: nível definido pela coordenação grava o histórico (gatilho c)", async () => {
  await comoAluno(async (c, set) => {
    await set(IDS.coordA);
    await c.query(`insert into aluno_niveis (escola_id, aluno_id, escopo, nivel, origem) values ($1, $2, 'e2-c-s06', 'base', 'manual')`, [ESCOLA_A, ALUNO_LUCAS]);
    await c.query("reset role");
    const h = await c.query("select count(*)::int as n from aluno_nivel_historico where aluno_id = $1 and escopo = 'e2-c-s06'", [ALUNO_LUCAS]);
    assert.equal(h.rows[0].n, 1, "registrar_nivel_historico não disparou");
  });
});

test("C-S06: as internas (d) recusam o usuário e seguem para o servidor", async () => {
  await comoAluno(async (c, set) => {
    await set(IDS.coordA);
    for (const sql of [
      `select app.backfill_progresso('${ESCOLA_A}')`,
      `select app.motor_avaliar_aluno('${ALUNO_LUCAS}')`,
      `select app.motor_conquista_xp('${ESCOLA_A}', '${ALUNO_LUCAS}', 'cn', 'primeiro_registro')`,
      `select app.desbloquear_conquista_basica('${ESCOLA_A}', '${ALUNO_LUCAS}', 'cn', 'primeiro_registro')`,
      `select app.exam_tag_do_aluno('${ALUNO_LUCAS}')`,
      `select app.motor_streak_dias('${ALUNO_LUCAS}')`,
    ]) {
      await c.query("savepoint s");
      await assert.rejects(c.query(sql), /permission denied for function/, sql);
      await c.query("rollback to savepoint s");
    }
    await c.query("reset role");
    await c.query("set local role service_role").catch(() => {});
    const r = await c.query(`select app.motor_streak_dias('${ALUNO_LUCAS}') as n`);
    assert.equal(typeof r.rows[0].n, "number");
  });
});

test("C-S06: as três views rodam com a permissão de quem consulta (security_invoker)", async () => {
  const c = await pool.connect();
  try {
    const { rows } = await c.query(`
      select c.relname, coalesce(array_to_string(c.reloptions, ','), '') as opts
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('public', 'app') and c.relkind in ('v', 'm') order by 1`);
    assert.ok(rows.length >= 3);
    const sem = rows.filter((r) => !/security_invoker=(true|on)/.test(r.opts)).map((r) => r.relname);
    assert.deepEqual(sem, [], "view sem security_invoker passa por cima da RLS como uma SECURITY DEFINER");
  } finally { c.release(); }
});
