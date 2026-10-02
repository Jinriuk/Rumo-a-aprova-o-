// ============================================================
// MISSÕES EM SEQUÊNCIA POR MATÉRIA (0061)
// ------------------------------------------------------------
// O defeito da 0033, medido: um registro de 70 questões de Matemática
// com 86% fechava as 3 missões da EsPCEx (70/60/70 a 82%) e pagava
// 270 XP; apagar o registro não devolvia nada; 69 questões sem acerto +
// 1 certa fechavam as 3 com "100%".
// A regra nova (aprovada em 02/10/2026): fila por matéria na ordem do
// catálogo, uma missão por vez, cada registro conta para uma missão só,
// só registros recebidos depois de a missão começar, só registros com
// acerto, acurácia só sobre os registros dela, apagar refaz e estorna,
// e o ledger tem uma linha por aluno e missão (revalidada no lugar).
//
// Tudo como postgres numa transação desfeita no fim: o motor é
// SECURITY DEFINER, então quem grava não muda o resultado. O horário de
// recebimento (app.registros_recebidos) é o do servidor; "antes de a
// missão começar" é simulado recuando esse horário.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, IDS, ESCOLA_A, ALUNO_LUCAS } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const MAT = ["Funções integradas", "Geometria Analítica", "Geometria Plana fechada"]; // 70/60/70 a 82%

async function emTransacao(fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    // aluno da EsPCEx sem nenhum registro de Matemática na seed
    const { rows } = await c.query(`
      select a.id as aluno, a.escola_id as escola from alunos a join concursos c on c.id = a.concurso_id
       where c.codigo = 'espcex'
         and not exists (select 1 from registros_estudo r where r.aluno_id = a.id and r.disciplina_codigo = 'mat')
       order by a.id limit 1`);
    assert.ok(rows.length, "a seed precisa de um aluno da EsPCEx sem registro de Matemática");
    return await fn(c, rows[0]);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

async function registrar(c, { aluno, escola }, questoes, acertos, materia = "mat", topico = "teste") {
  const r = await c.query(
    `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos)
     values ($1, $2, current_date, $3, $4, $5, $6) returning id`, [escola, aluno, materia, topico, questoes, acertos]);
  return r.rows[0].id;
}

const missoes = async (c, aluno, materia = "mat") => (await c.query(
  `select m.nome, am.estado, am.questoes_acumuladas as q, am.acuracia as acc, am.regra
     from aluno_missoes am join missoes m on m.id = am.missao_id
    where am.aluno_id = $1 and m.materia_codigo = $2 order by m.ordem`, [aluno, materia])).rows;

const ledger = async (c, aluno) => (await c.query(
  `select count(*)::int as linhas,
          count(*) filter (where status = 'valido')::int as validas,
          coalesce(sum(xp_delta) filter (where status = 'valido'), 0)::int as xp
     from aluno_eventos_progresso where aluno_id = $1 and tipo_evento = 'missao_concluida' and origem = 'motor_missao'`,
  [aluno])).rows[0];

test("item 2: 70 questões a 86% fecham no máximo uma missão, a primeira da fila", async () => {
  await emTransacao(async (c, al) => {
    await registrar(c, al, 70, 60);
    const ms = await missoes(c, al.aluno);
    assert.deepEqual(ms.map((m) => [m.nome, m.estado, m.q, m.acc]), [[MAT[0], "concluida", 70, 86]]);
    assert.deepEqual(await ledger(c, al.aluno), { linhas: 1, validas: 1, xp: 90 });
  });
});

test("três registros fecham as três missões em sequência, na ordem do catálogo", async () => {
  await emTransacao(async (c, al) => {
    await registrar(c, al, 70, 60);
    await registrar(c, al, 60, 55);
    await registrar(c, al, 70, 60);
    const ms = await missoes(c, al.aluno);
    assert.deepEqual(ms.map((m) => [m.nome, m.estado, m.q]), [
      [MAT[0], "concluida", 70], [MAT[1], "concluida", 60], [MAT[2], "concluida", 70]]);
    assert.deepEqual(await ledger(c, al.aluno), { linhas: 3, validas: 3, xp: 270 });
  });
});

test("o registro que fecha não transborda: 140 questões fecham só a primeira", async () => {
  await emTransacao(async (c, al) => {
    await registrar(c, al, 140, 120);
    const ms = await missoes(c, al.aluno);
    assert.deepEqual(ms.map((m) => [m.nome, m.estado, m.q]), [[MAT[0], "concluida", 140]]);
    // a próxima começa no registro seguinte, e só ele conta
    await registrar(c, al, 30, 28);
    const depois = await missoes(c, al.aluno);
    assert.deepEqual(depois.map((m) => [m.nome, m.estado, m.q]), [[MAT[0], "concluida", 140], [MAT[1], "em_andamento", 30]]);
  });
});

test("acurácia só sobre os registros da missão", async () => {
  await emTransacao(async (c, al) => {
    await registrar(c, al, 70, 64);            // 91%: fecha a primeira
    await registrar(c, al, 40, 20);            // 50% vai só para a segunda
    const ms = await missoes(c, al.aluno);
    assert.equal(ms[1].nome, MAT[1]);
    assert.equal(ms[1].acc, 50, "a acurácia da segunda não mistura com os 91% da primeira");
    assert.equal(ms[1].estado, "em_andamento");
  });
});

test("registro sem acerto informado não conta (furo dos 69 + 1)", async () => {
  await emTransacao(async (c, al) => {
    await registrar(c, al, 69, null);
    await registrar(c, al, 1, 1);
    const ms = await missoes(c, al.aluno);
    assert.deepEqual(ms.map((m) => [m.nome, m.estado, m.q, m.acc]), [[MAT[0], "em_andamento", 1, 100]]);
    assert.equal((await ledger(c, al.aluno)).validas, 0);
  });
});

test("registro recebido antes de a missão começar não conta, nem se ganhar acertos depois", async () => {
  await emTransacao(async (c, al) => {
    const antigo = await registrar(c, al, 70, null);           // sem acerto: não começa missão
    await c.query("update app.registros_recebidos set recebido_em = recebido_em - interval '2 days' where registro_id = $1", [antigo]);
    await registrar(c, al, 10, 9);                             // começa a primeira agora
    await c.query("update registros_estudo set acertos = 65 where id = $1", [antigo]);
    const ms = await missoes(c, al.aluno);
    assert.deepEqual(ms.map((m) => [m.nome, m.estado, m.q]), [[MAT[0], "em_andamento", 10]]);
    const v = await c.query("select count(*)::int n from app.missao_registros where registro_id = $1", [antigo]);
    assert.equal(v.rows[0].n, 0);
  });
});

test("registros anteriores à regra (sem horário de recebimento) não contam para a missão nova", async () => {
  const c = await pool.connect();
  try {
    await c.query("begin");
    const { rows } = await c.query(`
      select a.id as aluno, a.escola_id as escola from alunos a join concursos c on c.id = a.concurso_id
       where c.codigo = 'espcex'
         and (select count(*) from registros_estudo r where r.aluno_id = a.id and r.disciplina_codigo = 'mat') >= 3
       order by a.id limit 1`);
    assert.ok(rows.length);
    // estado de quem já estudava antes da 0061: registros sem horário de
    // recebimento e nenhuma missão da regra nova (a seed roda depois das
    // migrations e passa pelo motor; aqui isso é desfeito)
    await c.query("delete from aluno_missoes where aluno_id = $1", [rows[0].aluno]);
    await c.query("delete from app.registros_recebidos rr using registros_estudo r where r.id = rr.registro_id and r.aluno_id = $1", [rows[0].aluno]);
    await registrar(c, rows[0], 50, 45);
    const ms = await missoes(c, rows[0].aluno);
    assert.deepEqual(ms.map((m) => [m.nome, m.q]), [[MAT[0], 50]], "só o registro novo conta");
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
});

test("item 2: XP de missão nunca é pago duas vezes pelo mesmo registro", async () => {
  await emTransacao(async (c, al) => {
    const r1 = await registrar(c, al, 70, 60);
    for (let i = 0; i < 3; i++) await c.query("select app.motor_avaliar_aluno($1)", [al.aluno]);
    await c.query("update registros_estudo set topico = 'editado' where id = $1", [r1]);
    await c.query("update registros_estudo set acertos = 61 where id = $1", [r1]);
    assert.deepEqual(await ledger(c, al.aluno), { linhas: 1, validas: 1, xp: 90 });
    const v = await c.query("select count(*)::int n from app.missao_registros where registro_id = $1", [r1]);
    assert.equal(v.rows[0].n, 1, "o registro está em exatamente uma missão");
    // o banco recusa um segundo evento válido da mesma missão, por qualquer chave
    const missao = (await c.query("select referencia_id from aluno_eventos_progresso where aluno_id = $1 and origem = 'motor_missao'", [al.aluno])).rows[0].referencia_id;
    await c.query("savepoint s");
    await assert.rejects(c.query(
      `insert into aluno_eventos_progresso (escola_id, aluno_id, exam_tag, tipo_evento, origem, referencia_tabela, referencia_id, xp_delta, idempotency_key)
       values ($1, $2, 'espcex', 'missao_concluida', 'motor_missao', 'missoes', $3, 90, 'outra-chave')`, [al.escola, al.aluno, missao]),
      /uq_evprog_missao_motor_valida/);
    await c.query("rollback to savepoint s");
  });
});

test("item 2: apagar o registro que fechou estorna e reabre; reinserir revalida a mesma linha", async () => {
  await emTransacao(async (c, al) => {
    const r1 = await registrar(c, al, 70, 60);
    await registrar(c, al, 60, 55);
    await registrar(c, al, 70, 60);
    await c.query("delete from registros_estudo where id = $1", [r1]);
    // a fila é refeita a partir da primeira: 60 + 70 = 130 fecham Funções; as outras duas voltam a "a seguir"
    assert.deepEqual((await missoes(c, al.aluno)).map((m) => [m.nome, m.estado, m.q]), [[MAT[0], "concluida", 130]]);
    assert.deepEqual(await ledger(c, al.aluno), { linhas: 3, validas: 1, xp: 90 }, "estorno marca, não apaga nem duplica");
    await registrar(c, al, 70, 60);
    assert.deepEqual(await ledger(c, al.aluno), { linhas: 3, validas: 2, xp: 180 }, "reconcluir revalida a linha que já existia");
    const hist = await c.query(
      `select metadata->'historico' h from aluno_eventos_progresso ev join missoes m on m.id = ev.referencia_id
        where ev.aluno_id = $1 and m.nome = $2`, [al.aluno, MAT[1]]);
    const h = hist.rows[0].h;
    assert.ok(h.some((x) => x.estornado_em) && h.some((x) => x.revalidado_em), "o histórico guarda o estorno e a revalidação");
  });
});

test("item 2: cinco ciclos de inserir e apagar não passam do XP de uma missão", async () => {
  await emTransacao(async (c, al) => {
    for (let i = 0; i < 5; i++) {
      const r = await registrar(c, al, 70, 60);
      await c.query("delete from registros_estudo where id = $1", [r]);
    }
    assert.deepEqual(await ledger(c, al.aluno), { linhas: 1, validas: 0, xp: 0 });
    await registrar(c, al, 70, 60);
    assert.deepEqual(await ledger(c, al.aluno), { linhas: 1, validas: 1, xp: 90 });
  });
});

test("trocar a matéria do registro tira o registro da missão (e estorna se ela dependia dele)", async () => {
  await emTransacao(async (c, al) => {
    const r1 = await registrar(c, al, 70, 60);
    await c.query("update app.registros_recebidos set recebido_em = recebido_em - interval '1 day' where registro_id = $1", [r1]);
    await c.query("update registros_estudo set disciplina_codigo = 'fis' where id = $1", [r1]);
    assert.deepEqual(await missoes(c, al.aluno), [], "a missão de Matemática perdeu o único registro");
    assert.deepEqual(await missoes(c, al.aluno, "fis"), [], "registro antigo não começa missão em Física");
    assert.deepEqual(await ledger(c, al.aluno), { linhas: 1, validas: 0, xp: 0 });
  });
});

test("missão concluída pela regra antiga (legado) não é recalculada, e a fila segue para a próxima", async () => {
  await emTransacao(async (c, al) => {
    const m1 = (await c.query("select id from missoes where exam_tag = 'espcex' and nome = $1", [MAT[0]])).rows[0].id;
    await c.query(
      `insert into aluno_missoes (escola_id, aluno_id, missao_id, exam_tag, estado, questoes_acumuladas, acuracia, xp_concedido, concluida_em, materia_codigo, regra)
       values ($1, $2, $3, 'espcex', 'concluida', 70, 86, 90, now(), 'mat', 'legado')`, [al.escola, al.aluno, m1]);
    await c.query(
      `insert into aluno_eventos_progresso (escola_id, aluno_id, exam_tag, tipo_evento, origem, referencia_tabela, referencia_id, xp_delta, idempotency_key)
       values ($1, $2::uuid, 'espcex', 'missao_concluida', 'motor_missao', 'missoes', $3::uuid, 90, 'missao_motor:' || $2::text || ':' || $3::text)`, [al.escola, al.aluno, m1]);
    const r = await registrar(c, al, 60, 55);
    assert.deepEqual((await missoes(c, al.aluno)).map((m) => [m.nome, m.estado, m.regra]),
      [[MAT[0], "concluida", "legado"], [MAT[1], "concluida", "sequencial"]]);
    await c.query("delete from registros_estudo where id = $1", [r]);
    assert.deepEqual((await missoes(c, al.aluno)).map((m) => [m.nome, m.estado, m.regra]), [[MAT[0], "concluida", "legado"]]);
    assert.equal((await ledger(c, al.aluno)).xp, 90, "o XP do legado fica");
  });
});

test("meta da escola (missoes_escola.qtd_questoes) é a que fecha, e entra no retrato da missão", async () => {
  await emTransacao(async (c, al) => {
    await c.query(
      `insert into missoes_escola (escola_id, missao_id, ativa, qtd_questoes)
       select $1, id, true, 30 from missoes where exam_tag = 'espcex' and nome = $2`, [al.escola, MAT[0]]);
    await registrar(c, al, 30, 27);
    const r = await c.query(
      `select am.estado, am.meta_questoes, am.meta_acuracia from aluno_missoes am join missoes m on m.id = am.missao_id
        where am.aluno_id = $1 and m.nome = $2`, [al.aluno, MAT[0]]);
    assert.deepEqual(r.rows[0], { estado: "concluida", meta_questoes: 30, meta_acuracia: 82 });
  });
});

test("missão desativada pela escola sai da fila; a concluída fica", async () => {
  await emTransacao(async (c, al) => {
    await registrar(c, al, 70, 60);                                     // fecha Funções
    await c.query(
      `insert into missoes_escola (escola_id, missao_id, ativa)
       select $1, id, false from missoes where exam_tag = 'espcex' and nome in ($2, $3)`, [al.escola, MAT[0], MAT[1]]);
    await registrar(c, al, 70, 60);                                     // pula Geometria Analítica
    assert.deepEqual((await missoes(c, al.aluno)).map((m) => [m.nome, m.estado]),
      [[MAT[0], "concluida"], [MAT[2], "concluida"]]);
    assert.equal((await ledger(c, al.aluno)).validas, 2);
  });
});

test("concorrência: no máximo uma missão em andamento por aluno e matéria (índice no banco)", async () => {
  await emTransacao(async (c, al) => {
    await registrar(c, al, 10, 9);
    await c.query("savepoint s");
    await assert.rejects(c.query(
      `insert into aluno_missoes (escola_id, aluno_id, missao_id, exam_tag, estado, materia_codigo, iniciada_em)
       select $1, $2, id, 'espcex', 'em_andamento', 'mat', now() from missoes where exam_tag = 'espcex' and nome = $3`,
      [al.escola, al.aluno, MAT[1]]), /uq_aluno_missoes_uma_em_andamento/);
    await c.query("rollback to savepoint s");
  });
});

test("Física da EsPCEx: o avançado vem por último; em nenhuma matéria um nível vem antes de um mais fácil", async () => {
  const c = await pool.connect();
  try {
    const fis = await c.query("select nome, nivel, ordem from missoes where exam_tag = 'espcex' and materia_codigo = 'fis' order by ordem");
    assert.deepEqual(fis.rows.map((r) => [r.nome, r.nivel, r.ordem]), [
      ["Eletricidade fechada", "intermediario", 6], ["Termologia sem surpresa", "intermediario", 7], ["Mecânica sob tempo", "avancado", 8]]);
    const fora = await c.query(`
      with n as (
        select exam_tag, materia_codigo, nome, ordem,
               array_position(array['base','intermediario','avancado','reta_final'], nivel) as grau
          from missoes)
      select a.exam_tag, a.materia_codigo, a.nome as antes, b.nome as depois
        from n a join n b on a.exam_tag = b.exam_tag and a.materia_codigo = b.materia_codigo
       where a.ordem < b.ordem and a.grau > b.grau`);
    assert.deepEqual(fora.rows, []);
    const plano = await c.query(`
      select distinct tpm.ordem, tpm.semana_sugerida from trilha_plano_missoes tpm join trilha_planos tp on tp.id = tpm.plano_id
       where tp.exam_tag = 'espcex' and tp.tipo <> 'reta_final' and tpm.missao_id = 'e79d814f-897a-498f-8fe4-a1ac8442307c'`);
    assert.deepEqual(plano.rows, [{ ordem: 8, semana_sugerida: 9 }], "a trilha do plano acompanha o catálogo");
  } finally { c.release(); }
});

// ── falha do motor vai ao coletor da Etapa 4 ─────────────────────
test("falha do motor: o registro é gravado, a falha vira ocorrência sem dado de aluno e pede o despacho do e-mail", async () => {
  await emTransacao(async (c, al) => {
    // pg_net e Vault falsos (o Postgres do CI não tem nenhum dos dois)
    await c.query("create schema vault");
    await c.query("create table vault.decrypted_secrets (name text, decrypted_secret text, created_at timestamptz default now())");
    await c.query("insert into vault.decrypted_secrets (name, decrypted_secret) values ('project_url', 'https://ref-de-teste.supabase.co/')");
    await c.query("create schema net");
    await c.query("create table net.chamadas (url text, body jsonb)");
    await c.query(`create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}',
                     timeout_milliseconds int default 5000) returns bigint language sql as $f$ insert into net.chamadas values (url, body) returning 1::bigint $f$`);
    // falha injetada: o vínculo não pode ser gravado
    await c.query("alter table app.missao_registros add constraint falha_injetada check (false) not valid");

    const r = await registrar(c, al, 70, 60);
    assert.equal((await c.query("select count(*)::int n from registros_estudo where id = $1", [r])).rows[0].n, 1, "o registro não pode cair com o motor");
    assert.deepEqual(await missoes(c, al.aluno), []);

    const oc = (await c.query("select origem, mensagem, papel, pilha from app.erros_ocorrencias where origem = 'banco:motor_missoes'")).rows;
    assert.equal(oc.length, 1);
    assert.match(oc[0].mensagem, /SQLSTATE 23514/);
    assert.equal(oc[0].papel, "servidor");
    assert.equal(oc[0].pilha, null);
    assert.doesNotMatch(JSON.stringify(oc), /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/, "id de aluno ou registro na ocorrência");

    const em = (await c.query("select situacao, fila from app.erros_emails e join app.erros_grupos g on g.fingerprint = e.fingerprint where g.origem = 'banco:motor_missoes'")).rows;
    assert.deepEqual(em, [{ situacao: "reservado", fila: true }]);
    assert.deepEqual((await c.query("select url from net.chamadas")).rows.map((x) => x.url),
      ["https://ref-de-teste.supabase.co/functions/v1/registrar-erro?despachar=1"]);

    // a função despacha: o pendente sai da fila uma vez só, com o que o e-mail precisa
    const d1 = (await c.query("select public.coletor_despachar_pendentes(10) as d")).rows[0].d;
    assert.equal(d1.length, 1);
    assert.equal(d1[0].evento.origem, "banco:motor_missoes");
    assert.ok(d1[0].email_id && d1[0].fingerprint);
    assert.deepEqual((await c.query("select public.coletor_despachar_pendentes(10) as d")).rows[0].d, []);
  });
});

test("falha do motor sem project_url no Vault: fica na fila para o próximo despacho, sem quebrar nada", async () => {
  await emTransacao(async (c, al) => {
    await c.query("alter table app.missao_registros add constraint falha_injetada check (false) not valid");
    await registrar(c, al, 70, 60);
    const em = (await c.query("select e.fila from app.erros_emails e join app.erros_grupos g on g.fingerprint = e.fingerprint where g.origem = 'banco:motor_missoes'")).rows;
    assert.deepEqual(em, [{ fila: true }]);
  });
});

test("o aluno não lê nem escreve o vínculo e o horário de recebimento, nem dispara o despacho", async () => {
  await como(IDS.alunoA, async (c) => {
    for (const t of ["app.missao_registros", "app.registros_recebidos"]) {
      await c.query("savepoint s");
      await assert.rejects(c.query(`select * from ${t}`), /permission denied/);
      await c.query("rollback to savepoint s");
    }
    await c.query("savepoint s");
    await assert.rejects(c.query("select public.coletor_despachar_pendentes(10)"), /permission denied/);
    await c.query("rollback to savepoint s");
    // o registro do próprio aluno continua funcionando (e o motor roda por baixo)
    await c.query(`insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos)
                   values ($1, $2, current_date, 'mat', 'ok', 10, 9)`, [ESCOLA_A, ALUNO_LUCAS]);
  });
});
