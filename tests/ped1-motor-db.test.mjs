// ============================================================
// PED1 — MISSÕES QUE FECHAM, NÍVEL PERSISTIDO E ONBOARDING (banco)
// ------------------------------------------------------------
// Camada que ESTENDE o motor C0 (0024): a missão do catálogo fecha
// sozinha quando o aluno bate VOLUME + ACURÁCIA, e o XP da missão
// entra no MESMO ledger do C0 (aluno_eventos_progresso, origem
// 'motor_missao'), idempotente pela idempotency_key. Também prova:
// nível por matéria persistido (sem rebaixar 'manual'), conquista
// data-driven e onboarding do próprio aluno. Tudo isolado por escola.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, comoCommit, esperaErro, IDS, ESCOLA_A, ESCOLA_B, ALUNO_LUCAS, ALUNO_BRUNO } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

// XP de missão (origem do motor PED1) no ledger do C0, por aluno.
async function xpMissao(c, alunoId) {
  const r = await c.query(
    `select coalesce(sum(xp_delta),0)::int as xp, count(*)::int as n
       from aluno_eventos_progresso
      where aluno_id=$1 and tipo_evento='missao_concluida' and origem='motor_missao'`, [alunoId]);
  return r.rows[0];
}

// ------------------------------------------------------------
// MISSÃO FECHA SOZINHA + XP no ledger único (fonte de verdade C0).
// ------------------------------------------------------------
test("missão fecha ao bater volume+acurácia e credita XP no ledger do C0", async () => {
  await como(IDS.alunoA, async (c) => {
    const antes = await xpMissao(c, ALUNO_LUCAS);

    // Lucas tem mat 30/22 no seed; +40/40 → 70 questões, ~89% (≥60 e ≥70)
    await c.query(
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, minutos)
       values ($1,$2, current_date, 'mat', 'Geometria plana', 40, 40, 60)`, [ESCOLA_A, ALUNO_LUCAS]);

    const mis = await c.query(
      `select am.estado, am.xp_concedido from aluno_missoes am join missoes m on m.id=am.missao_id
       where am.aluno_id=$1 and m.materia_codigo='mat'`, [ALUNO_LUCAS]);
    assert.equal(mis.rows[0].estado, "concluida", "a missão de Matemática fecha");
    assert.ok(mis.rows[0].xp_concedido > 0);

    const depois = await xpMissao(c, ALUNO_LUCAS);
    assert.ok(depois.xp > antes.xp, "XP de missão entrou no ledger");
    // a view de total do C0 reflete o XP (fonte de verdade)
    const tot = await c.query("select coalesce(sum(xp_total),0)::int as xp from vw_aluno_xp_total where aluno_id=$1", [ALUNO_LUCAS]);
    assert.ok(tot.rows[0].xp > 0);
  });
});

// ------------------------------------------------------------
// IDEMPOTÊNCIA: reprocessar não duplica XP de missão nem conquista.
// ------------------------------------------------------------
test("idempotência: reprocessar o aluno N vezes não duplica XP de missão", async () => {
  await como(IDS.alunoA, async (c) => {
    await c.query(
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos)
       values ($1,$2, current_date, 'mat', 'Geo', 40, 40)`, [ESCOLA_A, ALUNO_LUCAS]);
    const um = await xpMissao(c, ALUNO_LUCAS);

    await c.query("select app.motor_avaliar_aluno($1)", [ALUNO_LUCAS]);
    await c.query("select app.motor_avaliar_aluno($1)", [ALUNO_LUCAS]);
    await c.query("select app.motor_avaliar_aluno($1)", [ALUNO_LUCAS]);

    const dois = await xpMissao(c, ALUNO_LUCAS);
    assert.equal(dois.n, um.n, "nº de eventos de missão não muda");
    assert.equal(dois.xp, um.xp, "XP de missão não duplica");

    const conq = await c.query(
      "select conquista_id, count(*)::int n from aluno_conquistas where aluno_id=$1 group by conquista_id having count(*) > 1", [ALUNO_LUCAS]);
    assert.equal(conq.rows.length, 0, "nenhuma conquista duplicada");
  });
});

// ------------------------------------------------------------
// ANTES/DEPOIS do critério (cruzamento exato do limiar).
// ------------------------------------------------------------
test("missão: antes do critério fica em andamento; ao bater, fecha", async () => {
  await como(IDS.alunoB, async (c) => {
    // Bruno tem 10 questões de mat no seed; +30 → 40 (<60): em andamento
    await c.query(
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos)
       values ($1,$2, current_date, 'mat', 'parcial', 30, 28)`, [ESCOLA_B, ALUNO_BRUNO]);
    let mis = await c.query(
      `select am.estado, am.questoes_acumuladas from aluno_missoes am join missoes m on m.id=am.missao_id
       where am.aluno_id=$1 and m.materia_codigo='mat'`, [ALUNO_BRUNO]);
    assert.equal(mis.rows[0].estado, "em_andamento", "40<60 não fecha");
    assert.equal(mis.rows[0].questoes_acumuladas, 40);
    assert.equal((await xpMissao(c, ALUNO_BRUNO)).n, 0, "sem missão fechada, sem XP de missão");

    // +40 com bom acerto → 80 questões, ≥70%: fecha
    await c.query(
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos)
       values ($1,$2, current_date, 'mat', 'fechou', 40, 38)`, [ESCOLA_B, ALUNO_BRUNO]);
    mis = await c.query(
      `select am.estado from aluno_missoes am join missoes m on m.id=am.missao_id
       where am.aluno_id=$1 and m.materia_codigo='mat'`, [ALUNO_BRUNO]);
    assert.equal(mis.rows[0].estado, "concluida");
    const xp = await xpMissao(c, ALUNO_BRUNO);
    assert.ok(xp.n >= 1 && xp.xp > 0, "fechou → XP de missão no ledger");
  });
});

// ------------------------------------------------------------
// ANTIGAMING: volume alto com acurácia baixa NÃO fecha a missão.
// ------------------------------------------------------------
test("antigaming: volume alto com acurácia baixa não fecha a missão", async () => {
  await como(IDS.alunoB, async (c) => {
    await c.query(
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos)
       values ($1,$2, current_date, 'mat', 'chutometro', 200, 40)`, [ESCOLA_B, ALUNO_BRUNO]); // 20%
    const mis = await c.query(
      `select am.estado from aluno_missoes am join missoes m on m.id=am.missao_id
       where am.aluno_id=$1 and m.materia_codigo='mat'`, [ALUNO_BRUNO]);
    assert.equal(mis.rows[0].estado, "em_andamento", "20% não fecha mesmo com 200 questões");
    assert.equal((await xpMissao(c, ALUNO_BRUNO)).n, 0);
  });
});

// ------------------------------------------------------------
// NÍVEL POR MATÉRIA persistido (calculado) e não rebaixa 'manual'.
// ------------------------------------------------------------
test("nível por matéria é persistido como 'calculado'", async () => {
  await como(IDS.alunoB, async (c) => {
    await c.query(
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos)
       values ($1,$2, current_date, 'por', 'base', 25, 8)`, [ESCOLA_B, ALUNO_BRUNO]); // 32% → base
    const niv = await c.query("select nivel, origem from aluno_niveis where aluno_id=$1 and escopo='por'", [ALUNO_BRUNO]);
    assert.equal(niv.rows[0].nivel, "base");
    assert.equal(niv.rows[0].origem, "calculado");
  });
});

test("o motor NÃO sobrescreve um nível 'manual' da coordenação", async () => {
  await comoCommit(IDS.coordB, async (c) => {
    await c.query(
      `insert into aluno_niveis (escola_id, aluno_id, escopo, nivel, origem, definido_por)
       values ($1,$2,'por','avancado','manual',$3)
       on conflict (aluno_id, escopo) do update set nivel='avancado', origem='manual'`,
      [ESCOLA_B, ALUNO_BRUNO, IDS.coordB.sub]);
  });
  try {
    await como(IDS.alunoB, async (c) => {
      await c.query(
        `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos)
         values ($1,$2, current_date, 'por', 'fraco', 30, 5)`, [ESCOLA_B, ALUNO_BRUNO]);
      const niv = await c.query("select nivel, origem from aluno_niveis where aluno_id=$1 and escopo='por'", [ALUNO_BRUNO]);
      assert.equal(niv.rows[0].origem, "manual", "origem manual preservada");
      assert.equal(niv.rows[0].nivel, "avancado", "nível manual não foi rebaixado");
    });
  } finally {
    await comoCommit(IDS.coordB, async (c) => {
      await c.query("delete from aluno_niveis where aluno_id=$1 and escopo='por' and origem='manual'", [ALUNO_BRUNO]);
    });
  }
});

// ------------------------------------------------------------
// PERFIL aluno sem alvo: o motor não inventa nada.
// ------------------------------------------------------------
test("aluno sem alvo (exam_tag nulo): o motor não inventa missão/nível", async () => {
  const c = await pool.connect();
  try {
    await c.query("begin");
    const r = await c.query(`insert into alunos (escola_id, nome) values ($1,'Sem Alvo') returning id`, [ESCOLA_A]);
    const novo = r.rows[0].id;
    await c.query(
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos)
       values ($1,$2, current_date, 'mat', 'x', 80, 70)`, [ESCOLA_A, novo]);
    const mis = await c.query("select count(*)::int n from aluno_missoes where aluno_id=$1", [novo]);
    assert.equal(mis.rows[0].n, 0, "sem alvo, sem missão");
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
});

// ------------------------------------------------------------
// ISOLAMENTO: estudo da escola A não gera missão na escola B.
// ------------------------------------------------------------
test("isolamento: estudo da escola A não gera nada na escola B", async () => {
  await como(IDS.alunoA, async (c) => {
    await c.query(
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos)
       values ($1,$2, current_date, 'mat', 'iso', 80, 75)`, [ESCOLA_A, ALUNO_LUCAS]);
  });
  await como(IDS.coordB, async (c) => {
    const r = await c.query("select count(*)::int n from aluno_missoes where escola_id=$1 and aluno_id=$2", [ESCOLA_B, ALUNO_LUCAS]);
    assert.equal(r.rows[0].n, 0);
  });
});

// ------------------------------------------------------------
// ONBOARDING do aluno: RPC grava só a própria linha; direto é barrado.
// ------------------------------------------------------------
test("onboarding do aluno: RPC grava só a própria linha; escrita direta barrada", async () => {
  await como(IDS.alunoA, async (c) => {
    await esperaErro(c, /row-level security/i,
      "insert into aluno_onboarding (aluno_id, escola_id, objetivo) values ($1,$2,'hack')", [ALUNO_LUCAS, ESCOLA_A]);

    const r = await c.query("select * from salvar_onboarding_aluno('estuda há 1 ano', 20, 'matemática', 'passar no CN')");
    assert.equal(r.rows[0].aluno_id, ALUNO_LUCAS);
    assert.equal(r.rows[0].disponibilidade_semanal_h, 20);
    assert.ok(r.rows[0].concluido_em);

    const lido = await c.query("select objetivo from aluno_onboarding where aluno_id=$1", [ALUNO_LUCAS]);
    assert.equal(lido.rows[0].objetivo, "passar no CN");
  });
});

test("onboarding: disponibilidade fora do intervalo é recusada", async () => {
  await como(IDS.alunoA, async (c) => {
    await esperaErro(c, /intervalo|0\.\.168/i, "select salvar_onboarding_aluno('x', 999, 'y', 'z')");
  });
});
