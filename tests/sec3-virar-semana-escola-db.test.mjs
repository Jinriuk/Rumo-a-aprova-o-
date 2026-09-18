// ============================================================
// SEC3 / T74 — virada de semana ESCOPADA POR ESCOLA
// ------------------------------------------------------------
// Critério de aceite: "a virada não afeta a escola errada".
// Verifica, contra Postgres real (migrations 0001..0036):
//   - app.virar_semana(escola, hoje) gera/fecha metas SÓ da escola
//     passada e NUNCA toca a outra escola (isolamento por escola_id);
//   - é idempotente (rodar de novo não duplica);
//   - exige escola_id (NULL é recusado) e valida que a escola existe;
//   - o privilégio é só do servidor: usuário logado (authenticated)
//     não executa nem a função app nem a porta public.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, ESCOLA_A, ESCOLA_B, ALUNO_LUCAS, ALUNO_BRUNO } from "./identidades.mjs";
import { semanaCN, diaNaSemanaCN } from "./calendario-cn.mjs";

// Datas da trilha lidas do banco: o seed 02 ancora a semana 3 na
// semana corrente (America/Sao_Paulo).
const NA_SEMANA_2 = await diaNaSemanaCN(2);
const NA_SEMANA_3 = await diaNaSemanaCN(3);
const SEMANA_1 = await semanaCN(1);

test.after(async () => { await pool.end(); });

// Cada cenário roda em transação com rollback. A limpeza é ESCOPADA aos
// dois alunos do teste (Lucas/Bruno) e na MESMA ordem de tabelas que os
// outros arquivos de teste usam (meta_atividades → metas): evita o
// deadlock que um `delete from metas` de tabela inteira causaria contra
// os testes que rodam em paralelo. lock_timeout curto falha rápido em
// vez de pendurar a suíte.
const ALUNOS = [ALUNO_LUCAS, ALUNO_BRUNO];

// Os arquivos de teste rodam em paralelo contra o MESMO banco e vários
// mutam as linhas do Lucas (este, o motor, a LGPD) com ordens de lock
// diferentes (delete explícito vs cascade do lgpd_excluir). Isso pode
// gerar deadlock transitório (40P01) — que o Postgres resolve abortando
// uma das transações. A resposta padrão é REEXECUTAR: cada cenário roda
// numa transação com rollback e tenta de novo se levar deadlock.
async function cenario(fn, tentativas = 5) {
  for (let i = 1; ; i++) {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("set local lock_timeout = '5s'");
      await c.query("delete from meta_atividades where meta_id in (select id from metas where aluno_id = any($1))", [ALUNOS]);
      await c.query("delete from metas where aluno_id = any($1)", [ALUNOS]);
      const r = await fn(c);
      await c.query("rollback").catch(() => {});
      return r;
    } catch (e) {
      await c.query("rollback").catch(() => {});
      if (e.code === "40P01" && i < tentativas) { await new Promise((res) => setTimeout(res, 40 * i)); continue; }
      throw e;
    } finally {
      c.release();
    }
  }
}

// O retry acima só via metade dos deadlocks, e a outra metade derrubou o
// CI da PR #111 com "deveria gerar 1 meta na escola A / 0 !== 1".
//
// Quando o deadlock acontece DENTRO de app.gerar_meta_protegida, o
// `exception when others` dela (migration 0039/0049) o converte em
// resultado='erro'. app.virar_semana conta isso em alunos_com_erro,
// emite um WARNING e SEGUE — do lado do cliente não chega exceção
// nenhuma, só um metas_geradas menor. O `catch (e.code === '40P01')`
// nunca dispara e a asserção quebra como se fosse regressão do motor.
//
// `virar` fecha essa lacuna ouvindo o WARNING que a própria função
// emite por aluno pulado ("virada escola %: aluno % pulado (%)") e, SÓ
// se a causa for deadlock, re-ergue como 40P01 para o retry tratar.
// Qualquer outro erro continua quebrando o teste — a asserção não é
// afrouxada, só deixa de confundir falha de serialização com defeito.
//
// O WARNING é lido do canal de notices da conexão, não da tabela
// virada_execucoes: `now()` é constante dentro da transação (as duas
// viradas do teste de idempotência gravam o MESMO executado_em) e as
// linhas de outros arquivos rodando em paralelo já estão commitadas ali
// — ou seja, a tabela não distingue de quem é o erro. O notice, sim:
// chega só desta chamada.
async function virar(c, escola, data) {
  const avisos = [];
  const ouvir = (msg) => avisos.push(msg.message ?? "");
  c.on("notice", ouvir);
  let linha;
  try {
    linha = (await c.query("select * from app.virar_semana($1, $2::date)", [escola, data])).rows[0];
  } finally {
    c.removeListener("notice", ouvir);
  }
  if (linha.alunos_com_erro > 0) {
    const detalhe = avisos.join(" | ") || "(nenhum warning capturado)";
    if (!/deadlock/i.test(detalhe)) {
      throw new Error(`virada reportou ${linha.alunos_com_erro} aluno(s) com erro que NÃO é deadlock: ${detalhe}`);
    }
    const err = new Error(`deadlock dentro da virada: ${detalhe}`);
    err.code = "40P01";
    throw err;
  }
  return linha;
}

// Onda 8: escopado aos DOIS alunos do teste (Lucas/Bruno). Antes lia a
// escola inteira, o que só funcionava enquanto a escola de vitrine
// tinha um aluno só. Agora o seed 13 roda no CI e ela tem 60 — a
// virada passa a gerar dezenas de metas legítimas e as contagens
// absolutas deixam de dizer qualquer coisa. O que este arquivo testa é
// ISOLAMENTO ENTRE ESCOLAS, e isso se prova melhor com os dois alunos
// conhecidos do que com um total que depende do tamanho do seed.
async function metasDe(c, escolaId) {
  const r = await c.query(
    `select aluno_id, semana_numero, status from metas
      where escola_id = $1 and aluno_id = any($2)
      order by aluno_id, semana_numero`,
    [escolaId, ALUNOS],
  );
  return r.rows;
}

// metas do Lucas especificamente — o sujeito das asserções de geração
async function metasGeradasDoLucas(c) {
  const r = await c.query(
    "select count(*)::int as n from metas where aluno_id = $1 and status = 'ativa'",
    [ALUNO_LUCAS],
  );
  return r.rows[0].n;
}

test("virar_semana(escola A) gera a meta corrente do Lucas e NÃO toca a escola B", async () => {
  await cenario(async (c) => {
    const r = await virar(c, ESCOLA_A, NA_SEMANA_2);
    assert.ok(r.metas_geradas >= 1, "a virada da escola A precisa gerar meta");
    assert.equal(await metasGeradasDoLucas(c), 1, "o Lucas precisa ficar com exatamente 1 meta ativa");

    const a = await metasDe(c, ESCOLA_A);
    const b = await metasDe(c, ESCOLA_B);
    assert.equal(a.length, 1, "escola A deve ter 1 meta");
    assert.equal(a[0].aluno_id, ALUNO_LUCAS);
    assert.equal(a[0].semana_numero, 2);
    assert.equal(a[0].status, "ativa");
    assert.equal(b.length, 0, "escola B NÃO pode ter meta criada pela virada da A");
  });
});

test("virar a escola A não fecha a meta vencida da escola B (escopo do UPDATE)", async () => {
  await cenario(async (c) => {
    // Bruno (escola B) tem uma meta ANTIGA e ainda 'ativa' (vencida).
    await c.query(
      `insert into metas (escola_id, aluno_id, trilha_id, semana_numero, inicio, fim, status)
       select escola_id, id, trilha_id, 1, $2::date, $3::date, 'ativa'
       from alunos where id = $1`,
      [ALUNO_BRUNO, SEMANA_1.inicio, SEMANA_1.fim],
    );

    // virar a escola A numa data em que a meta da B já venceu
    await virar(c, ESCOLA_A, NA_SEMANA_3);

    const b = await metasDe(c, ESCOLA_B);
    assert.equal(b.length, 1);
    assert.equal(b[0].status, "ativa", "a meta vencida da escola B NÃO pode ser fechada pela virada da A");
  });
});

test("virar a escola B fecha a meta vencida da B — e só a dela", async () => {
  await cenario(async (c) => {
    await c.query(
      `insert into metas (escola_id, aluno_id, trilha_id, semana_numero, inicio, fim, status)
       select escola_id, id, trilha_id, 1, $2::date, $3::date, 'ativa'
       from alunos where id = $1`,
      [ALUNO_BRUNO, SEMANA_1.inicio, SEMANA_1.fim],
    );
    const r = await virar(c, ESCOLA_B, NA_SEMANA_3);
    assert.equal(r.metas_fechadas, 1, "a meta vencida da B deve fechar");

    const b = await metasDe(c, ESCOLA_B);
    // fecha a vencida (semana 1) e gera a corrente (semana 3) — só da B
    assert.deepEqual(b.map((x) => [x.semana_numero, x.status]).sort(), [
      [1, "fechada"],
      [3, "ativa"],
    ].sort());

    const a = await metasDe(c, ESCOLA_A);
    assert.equal(a.length, 0, "o Lucas (escola A) não pode ganhar meta na virada da B");
  });
});

test("idempotência: virar a mesma escola duas vezes no mesmo dia não duplica nem reabre", async () => {
  await cenario(async (c) => {
    await virar(c, ESCOLA_A, NA_SEMANA_3);
    await virar(c, ESCOLA_A, NA_SEMANA_3);
    const a = await metasDe(c, ESCOLA_A);
    assert.equal(a.length, 1, "rodar de novo no mesmo dia não cria meta nova para o Lucas");
  });
});

test("escopo: exige escola_id (NULL é recusado) e valida escola existente", async () => {
  const c = await pool.connect();
  try {
    await c.query("begin");
    for (const [sql, params, motivo] of [
      ["select app.virar_semana(NULL, '2026-06-10'::date)", [], "NULL não pode virar 'todas'"],
      ["select app.virar_semana($1, '2026-06-10'::date)", ["00000000-0000-0000-0000-000000000000"], "escola inexistente"],
    ]) {
      await c.query("savepoint sp");
      let err = null;
      try { await c.query(sql, params); } catch (e) { err = e; }
      await c.query("rollback to savepoint sp");
      assert.ok(err, `deveria recusar: ${motivo}`);
    }
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
});

test("privilégio: usuário logado (authenticated) NÃO executa a virada por escola", async () => {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(
      "select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: "aaaaaaaa-0000-4000-8000-000000000001", role: "authenticated", app_metadata: { escola_id: ESCOLA_A, papel: "coordenacao" } })],
    );
    await c.query("set local role authenticated");
    for (const fn of [
      `select app.virar_semana('${ESCOLA_A}', '2026-06-10'::date)`,
      `select public.motor_virar_semana_escola('${ESCOLA_A}')`,
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
