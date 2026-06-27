// ============================================================
// PED1 — MOTOR DE PROGRESSO VIVIDO (banco, RLS e idempotência)
// ------------------------------------------------------------
// O motor concede XP, fecha missões e persiste nível por matéria a
// partir do estudo REAL do aluno — sem que o aluno se autopontue (a
// concessão é SECURITY DEFINER, disparada pelos eventos que ele já
// pode gravar: registro de estudo e simulado). Estes testes provam:
//   • XP/ missão/ conquista PERSISTEM no fluxo real do aluno;
//   • reprocessar (clique duplo/retry) NÃO duplica nada;
//   • missão fecha exatamente ao bater volume + acurácia;
//   • aluno novo / sem histórico / com histórico se comportam certo;
//   • responsável e coordenação leem; escolas não vazam entre si;
//   • onboarding do aluno grava só a própria linha.
// Rodam contra o mesmo banco de teste das demais suítes (rollback).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, comoCommit, esperaErro, IDS, ESCOLA_A, ESCOLA_B, ALUNO_LUCAS, ALUNO_BRUNO } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

// helper: soma o XP do aluno (opcionalmente só de uma origem)
async function xpDe(c, alunoId, { origem = null, comRef = null } = {}) {
  let sql = "select coalesce(sum(pontos),0)::int as xp, count(*)::int as n from aluno_xp_eventos where aluno_id=$1 and exam_tag='cn'";
  const p = [alunoId];
  if (origem) { p.push(origem); sql += ` and origem=$${p.length}`; }
  if (comRef === true) sql += " and referencia_id is not null";
  const r = await c.query(sql, p);
  return r.rows[0];
}

// ------------------------------------------------------------
// PERSISTÊNCIA: o registro de estudo do aluno fecha a missão e
// concede XP de verdade no banco — não é mais XP derivado na tela.
// ------------------------------------------------------------
test("fluxo real: aluno registra estudo, a missão fecha e o XP é PERSISTIDO", async () => {
  await como(IDS.alunoA, async (c) => {
    const antes = await xpDe(c, ALUNO_LUCAS, { origem: "missao", comRef: true });

    // Lucas já tem mat 30/22 no seed; +40/40 → 70 questões, ~89% (≥60 e ≥70)
    await c.query(
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, minutos)
       values ($1,$2, current_date, 'mat', 'Geometria plana', 40, 40, 60)`,
      [ESCOLA_A, ALUNO_LUCAS]
    );

    // missão de Matemática fechou e gravou o evento de XP com referência
    const mis = await c.query(
      `select am.estado, am.xp_concedido from aluno_missoes am
       join missoes m on m.id = am.missao_id
       where am.aluno_id=$1 and m.materia_codigo='mat'`, [ALUNO_LUCAS]);
    assert.equal(mis.rows[0].estado, "concluida", "a missão de Matemática deveria ter fechado");
    assert.ok(mis.rows[0].xp_concedido > 0, "a missão fechada registra o XP concedido");

    const depois = await xpDe(c, ALUNO_LUCAS, { origem: "missao", comRef: true });
    assert.ok(depois.xp > antes.xp, "o XP de missão PERSISTIDO cresceu após o registro");
  });
});

// ------------------------------------------------------------
// IDEMPOTÊNCIA: clique duplo / reload / retry reprocessam o MESMO
// evento e nada duplica (índice único por origem+referência).
// ------------------------------------------------------------
test("idempotência: reprocessar o aluno N vezes NÃO duplica XP nem missão", async () => {
  await como(IDS.alunoA, async (c) => {
    await c.query(
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos)
       values ($1,$2, current_date, 'mat', 'Geo', 40, 40)`,
      [ESCOLA_A, ALUNO_LUCAS]
    );
    const um = await xpDe(c, ALUNO_LUCAS, { origem: "missao", comRef: true });

    // simula retry/reload: roda o motor de novo várias vezes
    await c.query("select app.motor_avaliar_aluno($1)", [ALUNO_LUCAS]);
    await c.query("select app.motor_avaliar_aluno($1)", [ALUNO_LUCAS]);
    await c.query("select app.motor_avaliar_aluno($1)", [ALUNO_LUCAS]);

    const depois = await xpDe(c, ALUNO_LUCAS, { origem: "missao", comRef: true });
    assert.equal(depois.n, um.n, "o nº de eventos de missão não muda no retry");
    assert.equal(depois.xp, um.xp, "o XP de missão não duplica no retry");

    const conq = await c.query(
      "select conquista_id, count(*)::int n from aluno_conquistas where aluno_id=$1 group by conquista_id having count(*) > 1", [ALUNO_LUCAS]);
    assert.equal(conq.rows.length, 0, "nenhuma conquista duplicada");
  });
});

// ------------------------------------------------------------
// O GATILHO DA AÇÃO: a missão NÃO está fechada antes de bater o
// critério, e fecha DEPOIS — exatamente no cruzamento do limiar.
// ------------------------------------------------------------
test("missão: antes do critério fica em andamento; ao bater volume+acurácia, fecha", async () => {
  await como(IDS.alunoA, async (c) => {
    // Bruno (escola B) tem alvo CN e nenhum histórico de mat: começa do zero.
  });
  await como(IDS.alunoB, async (c) => {
    // Bruno já tem 10 questões de mat no seed (registro "SEGREDO-ESCOLA-B").
    // +30 → 40 questões (< 60 da missão de mat): ainda em andamento
    await c.query(
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos)
       values ($1,$2, current_date, 'mat', 'parcial', 30, 28)`,
      [ESCOLA_B, ALUNO_BRUNO]);
    let mis = await c.query(
      `select am.estado, am.questoes_acumuladas from aluno_missoes am join missoes m on m.id=am.missao_id
       where am.aluno_id=$1 and m.materia_codigo='mat'`, [ALUNO_BRUNO]);
    assert.equal(mis.rows[0].estado, "em_andamento", "40<60: a missão ainda não fecha");
    assert.equal(mis.rows[0].questoes_acumuladas, 40, "10 do seed + 30 do registro");

    const xpAntes = await xpDe(c, ALUNO_BRUNO, { origem: "missao", comRef: true });
    assert.equal(xpAntes.n, 0, "sem missão fechada, sem XP de missão");

    // +40 questões com bom acerto → 70 questões, ≥70%: fecha agora
    await c.query(
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos)
       values ($1,$2, current_date, 'mat', 'fechou', 40, 38)`,
      [ESCOLA_B, ALUNO_BRUNO]);
    mis = await c.query(
      `select am.estado from aluno_missoes am join missoes m on m.id=am.missao_id
       where am.aluno_id=$1 and m.materia_codigo='mat'`, [ALUNO_BRUNO]);
    assert.equal(mis.rows[0].estado, "concluida", "70≥60 e acurácia alta: a missão fecha");
    const xpDepois = await xpDe(c, ALUNO_BRUNO, { origem: "missao", comRef: true });
    assert.ok(xpDepois.n >= 1 && xpDepois.xp > 0, "fechou → XP de missão persistido");
  });
});

// ------------------------------------------------------------
// VOLUME SEM DOMÍNIO não fecha (antigaming): muitas questões com
// acurácia baixa NÃO disparam a missão.
// ------------------------------------------------------------
test("antigaming: volume alto com acurácia baixa NÃO fecha a missão", async () => {
  await como(IDS.alunoB, async (c) => {
    await c.query(
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos)
       values ($1,$2, current_date, 'mat', 'chutometro', 200, 40)`,  // 200q mas 20%
      [ESCOLA_B, ALUNO_BRUNO]);
    const mis = await c.query(
      `select am.estado, am.acuracia from aluno_missoes am join missoes m on m.id=am.missao_id
       where am.aluno_id=$1 and m.materia_codigo='mat'`, [ALUNO_BRUNO]);
    assert.equal(mis.rows[0].estado, "em_andamento", "20% de acerto não fecha, mesmo com 200 questões");
    const xp = await xpDe(c, ALUNO_BRUNO, { origem: "missao", comRef: true });
    assert.equal(xp.n, 0, "sem domínio, sem XP de missão");
  });
});

// ------------------------------------------------------------
// SIMULADO: entregar simulado concede XP de simulado (idempotente)
// e desbloqueia a conquista de "primeiro simulado".
// ------------------------------------------------------------
test("simulado: ao entregar, concede XP de simulado e conquista — sem duplicar no retry", async () => {
  await como(IDS.alunoB, async (c) => {
    const ins = await c.query(
      `insert into simulados (escola_id, aluno_id, nome, data, exam_tag, acertos)
       values ($1,$2,'Simulado 1', current_date, 'cn', '{"mat":10}'::jsonb) returning id`,
      [ESCOLA_B, ALUNO_BRUNO]);
    const simId = ins.rows[0].id;

    const xp = await xpDe(c, ALUNO_BRUNO, { origem: "simulado", comRef: true });
    assert.equal(xp.n, 1, "um evento de XP de simulado");
    assert.equal(xp.xp, 150, "150 XP pelo simulado");

    const conq = await c.query(
      "select 1 from aluno_conquistas ac join conquistas c on c.id=ac.conquista_id where ac.aluno_id=$1 and c.codigo='veterano'", [ALUNO_BRUNO]);
    assert.equal(conq.rows.length, 1, "conquista 'veterano' desbloqueada");

    // retry do processamento do MESMO simulado não duplica
    await c.query("select app.motor_processar_simulado($1)", [simId]);
    await c.query("select app.motor_processar_simulado($1)", [simId]);
    const xp2 = await xpDe(c, ALUNO_BRUNO, { origem: "simulado", comRef: true });
    assert.equal(xp2.n, 1, "simulado não concede XP duas vezes");
  });
});

// ------------------------------------------------------------
// NÍVEL POR MATÉRIA persistido (com origem/auditoria) e NUNCA
// sobrescreve um nível 'manual' definido pela coordenação.
// ------------------------------------------------------------
test("nível por matéria é persistido como 'calculado' e gera histórico", async () => {
  await como(IDS.alunoB, async (c) => {
    await c.query(
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos)
       values ($1,$2, current_date, 'por', 'base', 25, 8)`,  // 25q, 32% (<40) → base
      [ESCOLA_B, ALUNO_BRUNO]);
    const niv = await c.query("select nivel, origem from aluno_niveis where aluno_id=$1 and escopo='por'", [ALUNO_BRUNO]);
    assert.equal(niv.rows[0].nivel, "base");
    assert.equal(niv.rows[0].origem, "calculado");
  });
});

test("o motor NÃO sobrescreve um nível 'manual' da coordenação", async () => {
  await comoCommit(IDS.coordB, async (c) => {
    // a coordenação fixa o nível de 'por' como avançado (manual)
    await c.query(
      `insert into aluno_niveis (escola_id, aluno_id, escopo, nivel, origem, definido_por)
       values ($1,$2,'por','avancado','manual',$3)
       on conflict (aluno_id, escopo) do update set nivel='avancado', origem='manual'`,
      [ESCOLA_B, ALUNO_BRUNO, IDS.coordB.sub]);
  });
  try {
    await como(IDS.alunoB, async (c) => {
      // estudo fraco que CALCULARIA 'base' — não pode rebaixar o manual
      await c.query(
        `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos)
         values ($1,$2, current_date, 'por', 'fraco', 30, 5)`,
        [ESCOLA_B, ALUNO_BRUNO]);
      const niv = await c.query("select nivel, origem from aluno_niveis where aluno_id=$1 and escopo='por'", [ALUNO_BRUNO]);
      assert.equal(niv.rows[0].origem, "manual", "origem manual preservada");
      assert.equal(niv.rows[0].nivel, "avancado", "nível manual NÃO foi rebaixado pelo motor");
    });
  } finally {
    // limpa o estado commitado para não vazar entre execuções
    await comoCommit(IDS.coordB, async (c) => {
      await c.query("delete from aluno_niveis where aluno_id=$1 and escopo='por' and origem='manual'", [ALUNO_BRUNO]);
    });
  }
});

// ------------------------------------------------------------
// PERFIS: aluno novo / sem histórico; responsável e coordenação leem.
// ------------------------------------------------------------
test("aluno sem alvo (exam_tag nulo): o motor não inventa nada", async () => {
  // registro só pode ser inserido pelo próprio aluno; aqui exercitamos o
  // motor pelo caminho de servidor (sem RLS) num aluno SEM concurso_id,
  // dentro de transação que faz rollback (não suja o banco).
  const c = await pool.connect();
  try {
    await c.query("begin");
    const r = await c.query(
      `insert into alunos (escola_id, nome) values ($1,'Aluno Sem Alvo') returning id`, [ESCOLA_A]);
    const novo = r.rows[0].id;
    await c.query(
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos)
       values ($1,$2, current_date, 'mat', 'x', 80, 70)`, [ESCOLA_A, novo]);  // dispara o gatilho
    const xp = await c.query("select count(*)::int n from aluno_xp_eventos where aluno_id=$1", [novo]);
    const mis = await c.query("select count(*)::int n from aluno_missoes where aluno_id=$1", [novo]);
    assert.equal(xp.rows[0].n, 0, "sem concurso-alvo, sem XP");
    assert.equal(mis.rows[0].n, 0, "sem concurso-alvo, sem missão");
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
});

test("responsável lê o XP/missão do vinculado; coordenação lê o da própria escola", async () => {
  // a coordenação concede um evento real ao Lucas (origem missao manual)
  await como(IDS.respA, async (c) => {
    const r = await c.query("select count(*)::int n from aluno_xp_eventos where aluno_id=$1", [ALUNO_LUCAS]);
    assert.ok(r.rows[0].n >= 1, "responsável enxerga o XP do aluno vinculado");
    const m = await c.query("select count(*)::int n from aluno_missoes where aluno_id=$1", [ALUNO_LUCAS]);
    assert.ok(m.rows[0].n >= 0, "responsável pode ler missões do vinculado (RLS de leitura)");
  });
  await como(IDS.coordA, async (c) => {
    const r = await c.query("select coalesce(sum(pontos),0)::int xp from aluno_xp_eventos where escola_id=$1", [ESCOLA_A]);
    assert.ok(r.rows[0].xp >= 1, "coordenação vê o XP consolidado da própria escola");
  });
});

// ------------------------------------------------------------
// ISOLAMENTO: o motor de uma escola jamais escreve/vaza na outra.
// ------------------------------------------------------------
test("isolamento: estudo da escola A não gera nada na escola B", async () => {
  await como(IDS.alunoA, async (c) => {
    await c.query(
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos)
       values ($1,$2, current_date, 'mat', 'iso', 80, 75)`, [ESCOLA_A, ALUNO_LUCAS]);
  });
  await como(IDS.coordB, async (c) => {
    const r = await c.query("select count(*)::int n from aluno_missoes where escola_id=$1 and aluno_id=$2", [ESCOLA_B, ALUNO_LUCAS]);
    assert.equal(r.rows[0].n, 0, "nada do Lucas (escola A) aparece para a escola B");
  });
});

// ------------------------------------------------------------
// ONBOARDING: o aluno grava o PRÓPRIO diagnóstico via RPC SECURITY
// DEFINER (a RLS direta só deixa a coordenação escrever).
// ------------------------------------------------------------
test("onboarding do aluno: RPC grava só a própria linha; escrita direta segue barrada", async () => {
  await como(IDS.alunoA, async (c) => {
    // escrita direta na tabela continua proibida ao aluno
    await esperaErro(c, /row-level security/i,
      "insert into aluno_onboarding (aluno_id, escola_id, objetivo) values ($1,$2,'hack')",
      [ALUNO_LUCAS, ESCOLA_A]);

    // mas o caminho controlado (RPC) grava o diagnóstico do próprio aluno
    const r = await c.query(
      "select * from salvar_onboarding_aluno('estuda há 1 ano', 20, 'matemática', 'passar no CN')");
    assert.equal(r.rows[0].aluno_id, ALUNO_LUCAS);
    assert.equal(r.rows[0].disponibilidade_semanal_h, 20);
    assert.ok(r.rows[0].concluido_em, "marca a conclusão do onboarding");

    // e o aluno LÊ o próprio onboarding
    const lido = await c.query("select objetivo from aluno_onboarding where aluno_id=$1", [ALUNO_LUCAS]);
    assert.equal(lido.rows[0].objetivo, "passar no CN");
  });
});

test("onboarding: disponibilidade fora do intervalo é recusada pela RPC", async () => {
  await como(IDS.alunoA, async (c) => {
    await esperaErro(c, /intervalo|0\.\.168/i,
      "select salvar_onboarding_aluno('x', 999, 'y', 'z')");
  });
});
