// ============================================================
// MOTOR NO SERVIDOR — virada de semana por data local
// ------------------------------------------------------------
// Confere o comportamento do app.virar_semana()/app.gerar_meta()
// contra a regra da versão atual (currentWeek() do App.jsx):
//   - semana ativa = inicio <= hoje <= fim (limites INCLUSIVOS);
//   - antes da 1ª semana vale a 1ª; depois da última, a última;
//   - virada fecha a meta vencida e gera a da semana corrente;
//   - tudo idempotente (rodar de novo não duplica).
// As datas são da trilha CN 2026 importada (verbatim).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, comoServidor, ALUNO_LUCAS } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

// roda cada cenário em transação com rollback pra não sujar o seed
async function cenario(fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("delete from meta_atividades where meta_id in (select id from metas where aluno_id = $1)", [ALUNO_LUCAS]);
    await c.query("delete from metas where aluno_id = $1", [ALUNO_LUCAS]);
    return await fn(c);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

async function metaDe(c, hoje) {
  await c.query("select app.gerar_meta($1, $2::date)", [ALUNO_LUCAS, hoje]);
  const r = await c.query(
    "select semana_numero, inicio::text, fim::text, status from metas where aluno_id = $1 order by semana_numero desc limit 1",
    [ALUNO_LUCAS]
  );
  return r.rows[0];
}

test("limites inclusivos: 1º e último dia da semana 1 caem na semana 1; o dia seguinte cai na 2", async () => {
  await cenario(async (c) => {
    assert.equal((await metaDe(c, "2026-05-30")).semana_numero, 1); // inicio exato
    await c.query("delete from meta_atividades where meta_id in (select id from metas where aluno_id = $1)", [ALUNO_LUCAS]);
    await c.query("delete from metas where aluno_id = $1", [ALUNO_LUCAS]);
    assert.equal((await metaDe(c, "2026-06-07")).semana_numero, 1); // fim exato (inclusivo)
    assert.equal((await metaDe(c, "2026-06-08")).semana_numero, 2); // vira à meia-noite local
  });
});

test("antes da primeira semana vale a primeira; depois da última, a última (clamp do currentWeek)", async () => {
  await cenario(async (c) => {
    assert.equal((await metaDe(c, "2026-01-15")).semana_numero, 1);
  });
  await cenario(async (c) => {
    const m = await metaDe(c, "2026-12-25");
    assert.equal(m.semana_numero, 9);
    assert.equal(m.status, "fechada"); // depois da prova a meta não renasce ativa
  });
});

test("virada: fecha a meta vencida, gera a da semana corrente, e é idempotente", async () => {
  await cenario(async (c) => {
    // aluno está na semana 2
    await c.query("select app.virar_semana('2026-06-10'::date)");
    let r = await c.query("select semana_numero, status from metas where aluno_id = $1 order by semana_numero", [ALUNO_LUCAS]);
    assert.deepEqual(r.rows, [{ semana_numero: 2, status: "ativa" }]);

    // o tempo passa: dia 15/06 é a semana 3 — a virada fecha a 2 e abre a 3,
    // sem o aluno abrir nada
    await c.query("select app.virar_semana('2026-06-15'::date)");
    r = await c.query("select semana_numero, status from metas where aluno_id = $1 order by semana_numero", [ALUNO_LUCAS]);
    assert.deepEqual(r.rows, [
      { semana_numero: 2, status: "fechada" },
      { semana_numero: 3, status: "ativa" },
    ]);

    // rodar a virada de novo no mesmo dia não muda nem duplica nada
    await c.query("select app.virar_semana('2026-06-15'::date)");
    const r2 = await c.query("select count(*)::int as n from metas where aluno_id = $1", [ALUNO_LUCAS]);
    assert.equal(r2.rows[0].n, 2);
  });
});

test("a meta gerada carrega as atividades-modelo daquela semana da trilha, todas pendentes", async () => {
  await cenario(async (c) => {
    await c.query("select app.gerar_meta($1, '2026-05-30'::date)", [ALUNO_LUCAS]);
    const r = await c.query(
      `select am.texto, ma.estado from meta_atividades ma
       join atividades_modelo am on am.id = ma.atividade_modelo_id
       join metas m on m.id = ma.meta_id
       where m.aluno_id = $1 order by am.ordem`,
      [ALUNO_LUCAS]
    );
    // semana 1 da trilha CN tem exatamente 5 tarefas, textos preservados
    assert.equal(r.rows.length, 5);
    assert.equal(r.rows[0].texto, "Aplicar 1 prova antiga COMPLETA cronometrada (diagnóstico)");
    assert.ok(r.rows.every((x) => x.estado === "pendente"));
  });
});

test("gerar_meta duas vezes na mesma semana devolve a MESMA meta (idempotência do seed também)", async () => {
  await cenario(async (c) => {
    const a = await c.query("select app.gerar_meta($1, '2026-06-10'::date) as id", [ALUNO_LUCAS]);
    const b = await c.query("select app.gerar_meta($1, '2026-06-10'::date) as id", [ALUNO_LUCAS]);
    assert.equal(a.rows[0].id, b.rows[0].id);
  });
});

test("hoje_local usa America/Sao_Paulo (a data local do Brasil, não UTC)", async () => {
  await comoServidor(async (c) => {
    const r = await c.query(
      "select app.hoje_local()::text as h, (now() at time zone 'America/Sao_Paulo')::date::text as esperado"
    );
    assert.equal(r.rows[0].h, r.rows[0].esperado);
  });
});

test("usuário logado não consegue chamar o motor nem as funções LGPD (privilégio só do servidor)", async () => {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(
      "select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: "aaaaaaaa-0000-4000-8000-000000000002", role: "authenticated", app_metadata: { escola_id: "11111111-1111-4111-8111-111111111111", papel: "aluno" } })]
    );
    await c.query("set local role authenticated");
    for (const fn of [
      `select app.gerar_meta('${ALUNO_LUCAS}')`,
      "select app.virar_semana()",
      `select app.lgpd_exportar('${ALUNO_LUCAS}')`,
      `select app.lgpd_excluir('${ALUNO_LUCAS}')`,
    ]) {
      await c.query("savepoint sp");
      let err = null;
      try { await c.query(fn); } catch (e) { err = e; }
      await c.query("rollback to savepoint sp");
      assert.ok(err && /permission denied/i.test(err.message), `deveria recusar: ${fn}`);
    }
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
});

test("LGPD: exportar devolve o dossiê completo; excluir apaga tudo do aluno e devolve as contas a remover", async () => {
  await comoServidor(async (c) => {
    await c.query("begin");
    try {
      const exp = await c.query("select app.lgpd_exportar($1) as dossie", [ALUNO_LUCAS]);
      const d = exp.rows[0].dossie;
      assert.equal(d.aluno.nome, "Lucas");
      assert.ok(Array.isArray(d.registros_estudo) && d.registros_estudo.length > 0);
      assert.ok(Array.isArray(d.simulados) && d.simulados.length > 0);
      assert.ok(Array.isArray(d.consentimentos) && d.consentimentos.length > 0);
      assert.equal(d.aluno.usuario_id, undefined, "a exportação não vaza id interno de conta");

      const exc = await c.query("select app.lgpd_excluir($1) as r", [ALUNO_LUCAS]);
      const contas = exc.rows[0].r.usuarios_removidos;
      // a conta do Lucas e a do responsável (único vínculo) caem juntas
      assert.ok(contas.includes("aaaaaaaa-0000-4000-8000-000000000002"));
      assert.ok(contas.includes("aaaaaaaa-0000-4000-8000-000000000003"));

      for (const t of ["alunos", "metas", "registros_estudo", "simulados", "consentimentos", "vinculos_responsaveis"]) {
        const col = t === "alunos" ? "id" : "aluno_id";
        const r = await c.query(`select count(*)::int as n from ${t} where ${col} = $1`, [ALUNO_LUCAS]);
        assert.equal(r.rows[0].n, 0, `${t} ainda tem dado do aluno excluído`);
      }
    } finally {
      await c.query("rollback");
    }
  });
});
