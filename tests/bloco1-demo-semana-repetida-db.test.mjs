// ============================================================
// BLOCO 1 (23/09/2026) — A DEMONSTRAÇÃO NÃO ENVELHECE, E O XP NÃO CRESCE
// ------------------------------------------------------------
// O Instituto Meridiano (tenant de demonstração) tinha 90 registros de
// 22/08 a 18/09 e ninguém registrando nada: a partir de 25/09 o painel
// mostraria 0 ativos e 0 questões. O mecanismo de supabase/demo/ faz a
// semana 4 se repetir toda semana (docs/demo/HISTORIA.md).
//
// O mecanismo mora FORA de supabase/migrations e só é aplicado à mão no
// projeto de demonstração. Estes testes carregam os PRÓPRIOS arquivos
// supabase/demo/01_schema.sql e 04_funcoes.sql num Meridiano de
// mentira, dentro de uma transação que sempre faz rollback, e provam:
//   • no sábado o estado é o da gravação, e o XP é o gravado;
//   • o XP não cresce de uma semana para a outra;
//   • segunda + liberação diária chega ao MESMO estado da virada direta;
//   • rodar duas vezes dá o mesmo resultado (estes dois são os que
//     quebram se alguém trocar a reprodução com gatilhos desligados por
//     "recálculo" com gatilhos ligados: ids e carimbos viram aleatórios);
//   • os outros tenants, logs_acesso e consentimentos não mudam;
//   • os gatilhos voltam ligados depois;
//   • a guarda aborta fora do tenant de demonstração.
// E, sem banco: nenhuma migration carrega nada disto para produção.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pool, ESCOLA_A } from "./identidades.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => readFileSync(resolve(root, p), "utf8");
const semComentarios = (fonte) => fonte
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:\\])--.*$/gm, "$1");

const MERIDIANO = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const TRILHA = "dddddddd-0000-4000-8000-000000000001";
const HELENA = "dddddddd-a000-4000-8000-0000000000f1";
const ENZO = "dddddddd-a000-4000-8000-0000000000f8";
const ANCORA = "2026-09-14";   // segunda-feira da semana 4 na gravação
const DEMO_DIR = "supabase/demo";

test.after(async () => { await pool.end(); });

// ── sem banco: nada disto vai para produção ────────────────────────
test("nenhuma migration cria schema, cron, função ou dado de demonstração", () => {
  const dir = resolve(root, "supabase/migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql"))) {
    const sql = semComentarios(readFileSync(resolve(dir, f), "utf8"));
    assert.doesNotMatch(sql, /create\s+schema\s+(if\s+not\s+exists\s+)?demo\b/i, `${f} cria o schema demo`);
    assert.doesNotMatch(sql, /\bdemo\.(virar_semana|liberar|gravar|pausar|fila|estado|gravacao_|checar_tenant)/i,
      `${f} referencia o mecanismo de demonstração`);
    assert.doesNotMatch(sql, /cron\.schedule\s*\(\s*'demo-/i, `${f} agenda job de demonstração`);
    assert.ok(!sql.includes(MERIDIANO), `${f} cita o tenant de demonstração`);
  }
});

test("o CI (reset-db.sh) não aplica supabase/demo", () => {
  assert.doesNotMatch(ler("tests/reset-db.sh"), /supabase\/demo/);
});

test("nenhum script de supabase/demo escreve em logs_acesso ou consentimentos", () => {
  for (const f of readdirSync(resolve(root, DEMO_DIR)).filter((x) => x.endsWith(".sql"))) {
    const sql = semComentarios(ler(`${DEMO_DIR}/${f}`));
    assert.doesNotMatch(sql,
      /(insert\s+into|update|delete\s+from|truncate)\s+(public\.)?(logs_acesso|consentimentos)\b/i,
      `${f} escreve em trilha de auditoria`);
  }
});

test("todo script de supabase/demo que escreve direto começa pela guarda do Meridiano", () => {
  // 00 é só leitura; 05, 06 e 91 só chamam funções que têm a guarda.
  for (const f of ["01_schema.sql", "02_backup_20260923.sql", "03_d07_d09.sql",
                   "07_agendamento.sql", "90_restaurar_backup_20260923.sql"]) {
    const sql = semComentarios(ler(`${DEMO_DIR}/${f}`));
    const guarda = sql.search(/id = ('dddddddd-dddd-4ddd-8ddd-dddddddddddd'|v_escola) and plano = 'demo'/);
    const escrita = sql.search(/\b(create\s+(schema|table)|insert\s+into|update\s+public|delete\s+from|cron\.(un)?schedule)/i);
    assert.ok(guarda >= 0, `${f} não verifica o tenant de demonstração`);
    assert.ok(guarda < escrita, `${f} escreve antes de verificar o tenant`);
  }
  const fn = semComentarios(ler(`${DEMO_DIR}/04_funcoes.sql`));
  for (const nome of ["gravar", "virar_semana", "liberar"]) {
    const corpo = fn.split(new RegExp(`function demo\\.${nome}\\(`))[1].split(/\$\$\s*;/)[0];
    const inicio = corpo.split(/\bbegin\b/i)[1].trim();
    assert.match(inicio, /^perform demo\.checar_tenant\(\);/, `demo.${nome} não começa pela guarda`);
  }
});

// ── com banco: um Meridiano de mentira, tudo em rollback ───────────
const semana = (n) => `date '${ANCORA}' + ${(n - 4) * 7}`;

async function montarMeridiano(c) {
  await c.query(`insert into escolas (id, nome, slug, status, plano)
                 values ($1, 'Instituto Meridiano (teste)', 'meridiano-teste-bloco1', 'ativa', 'demo')`, [MERIDIANO]);
  await c.query(`insert into trilhas (id, nicho, nome, versao, publicada)
                 values ($1, 'teste-bloco1-demo', 'Bloco intensivo (teste)', 1, true)`, [TRILHA]);
  for (let n = 1; n <= 9; n++) {
    await c.query(`insert into trilha_semanas (trilha_id, numero, inicio, fim, foco)
                   values ($1, $2::int, ${semana(n)}, ${semana(n)} + 6, 'Semana ' || $2::text)`, [TRILHA, n]);
    for (const [ordem, disc, prio] of [[1, "mat", "F"], [2, "por", "F"], [3, "ing", "P"]]) {
      await c.query(`insert into atividades_modelo (trilha_id, semana_numero, disciplina_codigo, prioridade, texto, ordem)
                     values ($1, $2::int, $3::text, $4, 'Atividade ' || $3::text, $5)`, [TRILHA, n, disc, prio, ordem]);
    }
  }
  await c.query(`insert into alunos (id, escola_id, nome, trilha_id) values
                 ($1, $3, 'Helena Teste', $4), ($2, $3, 'Enzo Teste', $4)`, [HELENA, ENZO, MERIDIANO, TRILHA]);

  // metas das semanas 1–4 pelo motor do produto; 1–3 já fechadas
  for (let n = 1; n <= 4; n++) {
    for (const a of [HELENA, ENZO]) await c.query(`select app.gerar_meta($1, ${semana(n)})`, [a]);
  }
  await c.query("update metas set status = 'fechada' where escola_id = $1 and semana_numero < 4", [MERIDIANO]);

  // Helena estuda seg (mat), qua (por) e sex (ing) toda semana; gatilhos LIGADOS
  for (let n = 1; n <= 4; n++) {
    for (const [dia, disc, q, a] of [[0, "mat", 20, 15], [2, "por", 18, 14], [4, "ing", 12, 9]]) {
      await c.query(`insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, questoes, acertos, minutos)
                     values ($1, $2, ${semana(n)} + ${dia}, $3, $4::int, $5, $4::int * 3)`, [MERIDIANO, HELENA, disc, q, a]);
    }
  }
  // simulados: sábado da semana 3 e quinta da semana 4 (+50 XP cada)
  await c.query(`insert into simulados (escola_id, aluno_id, nome, data, acertos) values
                 ($1, $2, 'Simulado 1', ${semana(3)} + 5, '{"mat": 10}'), ($1, $2, 'Simulado 2', ${semana(4)} + 3, '{"mat": 12}')`,
                [MERIDIANO, HELENA]);
  // conclui mat (F, 100 XP) e por (F, 100 XP) em todas as semanas
  await c.query(`update meta_atividades ma set estado = 'concluida'
                   from metas m, atividades_modelo am
                  where ma.meta_id = m.id and am.id = ma.atividade_modelo_id
                    and m.aluno_id = $1 and am.disciplina_codigo in ('mat', 'por')`, [HELENA]);
  // trilha de auditoria: não pode ser tocada pelo mecanismo
  await c.query(`insert into consentimentos (escola_id, aluno_id, responsavel_nome, registrado_por)
                 select $1, $2, 'Responsável Teste', id from usuarios limit 1`, [MERIDIANO, HELENA]);
}

async function comDemo(fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await montarMeridiano(c);
    await c.query(ler(`${DEMO_DIR}/01_schema.sql`));
    await c.query(ler(`${DEMO_DIR}/04_funcoes.sql`));
    await c.query("select demo.gravar($1::date)", [ANCORA]);
    return await fn(c);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

const um = async (c, sql, params = []) => (await c.query(sql, params)).rows[0];
const xp = async (c, aluno) =>
  (await um(c, `select coalesce(sum(xp_delta), 0)::int as xp from aluno_eventos_progresso
                 where aluno_id = $1 and status = 'valido'`, [aluno])).xp;
const virar = (c, dia) => um(c, "select demo.virar_semana($1::date) as r", [dia]);
const liberar = (c, dia) => um(c, "select demo.liberar($1::date) as r", [dia]);

// fotografia do Meridiano: tudo o que o mecanismo escreve, com datas
async function estadoMeridiano(c) {
  const r = await um(c, `select md5(concat_ws('#',
      (select string_agg(concat_ws(',', id, data, questoes, acertos, minutos, criado_em), '|' order by id) from registros_estudo where escola_id = $1),
      (select string_agg(concat_ws(',', id, data, nome, criado_em), '|' order by id) from simulados where escola_id = $1),
      (select string_agg(concat_ws(',', id, semana_numero, inicio, fim, status, gerada_em), '|' order by id) from metas where escola_id = $1),
      (select string_agg(concat_ws(',', id, estado, atualizado_em), '|' order by id) from meta_atividades where escola_id = $1),
      (select string_agg(concat_ws(',', id, status, xp_delta, criado_em), '|' order by id) from aluno_eventos_progresso where escola_id = $1),
      (select string_agg(concat_ws(',', id, nivel), '|' order by id) from aluno_niveis where escola_id = $1),
      (select string_agg(concat_ws(',', inicio, fim), '|' order by numero) from trilha_semanas where trilha_id = $2))) as h`,
    [MERIDIANO, TRILHA]);
  return r.h;
}

// fotografia dos OUTROS tenants e das trilhas deles (V9b)
async function estadoOutros(c) {
  const r = await um(c, `select md5(concat_ws('#',
      (select string_agg(x::text, '|' order by x.id) from registros_estudo x where escola_id <> $1),
      (select string_agg(x::text, '|' order by x.id) from simulados x where escola_id <> $1),
      (select string_agg(x::text, '|' order by x.id) from metas x where escola_id <> $1),
      (select string_agg(x::text, '|' order by x.id) from meta_atividades x where escola_id <> $1),
      (select string_agg(x::text, '|' order by x.id) from aluno_eventos_progresso x where escola_id <> $1),
      (select string_agg(x::text, '|' order by x.id) from aluno_niveis x where escola_id <> $1),
      (select string_agg(x::text, '|' order by x.id) from trilha_semanas x where trilha_id <> $2))) as h`,
    [MERIDIANO, TRILHA]);
  return r.h;
}

test("a gravação guarda o XP de cada aluno e as semanas relativas à segunda da semana 4", async () => {
  await comDemo(async (c) => {
    const g = (await um(c, "select detalhe from demo.execucoes where acao = 'gravar'")).detalhe;
    // 2 simulados × 50 + 8 atividades F concluídas × 100
    assert.equal(g.xp_por_aluno["Helena Teste"], 900);
    assert.equal(g.xp_por_aluno["Enzo Teste"], 0);
    assert.equal(g.registros, 12);
    const s4 = await um(c, "select dia_inicio, dia_fim from demo.gravacao_semanas where numero = 4");
    assert.deepEqual(s4, { dia_inicio: 0, dia_fim: 6 });
  });
});

test("no sábado, a semana 4 reaparece inteira na semana corrente, com o XP gravado", async () => {
  await comDemo(async (c) => {
    // sábado duas semanas depois da gravação: tudo deslocado em +14 dias
    await virar(c, "2026-10-03");
    const s = await um(c, `select inicio::text from trilha_semanas where trilha_id = $1 and numero = 4`, [TRILHA]);
    assert.equal(s.inicio, "2026-09-28", "a semana 4 começa na segunda corrente");
    const r = await um(c, `select count(*)::int n, max(data)::text ult from registros_estudo where escola_id = $1`, [MERIDIANO]);
    assert.equal(r.n, 12);
    assert.equal(r.ult, "2026-10-02", "último registro é a sexta (o registro de um dia aparece no seguinte)");
    assert.equal(await xp(c, HELENA), 900);
    assert.equal(await xp(c, ENZO), 0);
    const ativa = await um(c, `select count(*) filter (where ma.estado = 'concluida')::int feitas, count(*)::int total
                                 from metas m join meta_atividades ma on ma.meta_id = m.id
                                where m.aluno_id = $1 and m.status = 'ativa'`, [HELENA]);
    assert.deepEqual(ativa, { feitas: 2, total: 3 });
    assert.equal((await um(c, "select count(*)::int n from demo.fila")).n, 0, "no sábado a fila está vazia");
  });
});

test("o XP não cresce de uma semana para a outra (V6 igual em sábados seguidos)", async () => {
  await comDemo(async (c) => {
    await virar(c, "2026-09-26");
    const antes = { helena: await xp(c, HELENA), eventos: (await um(c, "select count(*)::int n from aluno_eventos_progresso where escola_id = $1", [MERIDIANO])).n };
    await liberar(c, "2026-09-28");          // segunda: autocorreção refaz a semana
    for (const d of ["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"]) await liberar(c, d);
    assert.equal(await xp(c, HELENA), antes.helena);
    const depois = await um(c, `select count(*)::int n, count(*) filter (where status = 'estornado')::int estornados
                                  from aluno_eventos_progresso where escola_id = $1`, [MERIDIANO]);
    assert.equal(depois.n, antes.eventos, "o ledger não acumula linhas de uma semana para outra");
    assert.equal(depois.estornados, 0, "nenhum evento estornado se acumula de uma semana para outra");
  });
});

test("segunda + liberação diária chega ao mesmo estado da virada direta, dia a dia", async () => {
  await comDemo(async (c) => {
    const dias = ["2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"];
    await virar(c, "2026-09-21");
    const sequencial = [];
    for (const d of dias) { await liberar(c, d); sequencial.push(await estadoMeridiano(c)); }
    for (const [i, d] of dias.entries()) {
      await virar(c, d);
      assert.equal(await estadoMeridiano(c), sequencial[i], `estado de ${d} diverge entre as duas vias`);
    }
  });
});

test("no meio da semana só aparece o que a gravação data até a véspera", async () => {
  await comDemo(async (c) => {
    await virar(c, "2026-09-23");   // quarta
    const r = await um(c, `select max(data)::text ult from registros_estudo where escola_id = $1`, [MERIDIANO]);
    assert.equal(r.ult, "2026-09-21", "segunda aparece; o registro de quarta só amanhã");
    // mat (segunda) já concluída; por (quarta) ainda não
    const ativa = await um(c, `select count(*) filter (where ma.estado = 'concluida')::int feitas
                                 from metas m join meta_atividades ma on ma.meta_id = m.id
                                where m.aluno_id = $1 and m.status = 'ativa'`, [HELENA]);
    assert.equal(ativa.feitas, 1);
    // semanas 1–3 + mat da semana 4 = 3×200 + 50 (Simulado 1) + 100
    assert.equal(await xp(c, HELENA), 750);
  });
});

test("rodar duas vezes dá o mesmo resultado (idempotente)", async () => {
  await comDemo(async (c) => {
    await virar(c, "2026-09-24");
    const uma = await estadoMeridiano(c);
    await virar(c, "2026-09-24");
    assert.equal(await estadoMeridiano(c), uma, "virar_semana 2×");
    await liberar(c, "2026-09-24");
    assert.equal(await estadoMeridiano(c), uma, "liberar no mesmo dia não muda nada");
  });
});

test("os outros tenants, logs_acesso e consentimentos não mudam (V9b)", async () => {
  await comDemo(async (c) => {
    const outros = await estadoOutros(c);
    const auditoria = await um(c, `select md5(concat_ws('#',
        (select string_agg(x::text, '|' order by x.id) from consentimentos x),
        (select string_agg(x::text, '|' order by x.id) from logs_acesso x))) as h`);
    await virar(c, "2026-09-21");
    await liberar(c, "2026-09-25");
    await virar(c, "2026-10-03");
    assert.equal(await estadoOutros(c), outros);
    const depois = await um(c, `select md5(concat_ws('#',
        (select string_agg(x::text, '|' order by x.id) from consentimentos x),
        (select string_agg(x::text, '|' order by x.id) from logs_acesso x))) as h`);
    assert.equal(depois.h, auditoria.h);
  });
});

test("os gatilhos voltam ligados depois da virada (a sessão não fica em replica)", async () => {
  await comDemo(async (c) => {
    await virar(c, "2026-09-23");
    assert.equal((await um(c, "select current_setting('session_replication_role') as s")).s, "origin");
    const r = await um(c, `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, questoes, acertos)
                           values ($1, $2, date '2026-09-23', 'mat', 5, 4) returning id`, [MERIDIANO, HELENA]);
    const ev = await um(c, "select count(*)::int n from aluno_eventos_progresso where referencia_id = $1", [r.id]);
    assert.equal(ev.n, 1, "trg_progresso_registro disparou: os gatilhos estão ligados");
  });
});

test("a guarda aborta fora do tenant de demonstração e com trilha compartilhada", async () => {
  await comDemo(async (c) => {
    await c.query("savepoint s1");
    await c.query("update escolas set plano = 'padrão' where id = $1", [MERIDIANO]);
    await assert.rejects(virar(c, "2026-09-23"), /plano demo/);
    await c.query("rollback to savepoint s1");

    await c.query("savepoint s2");
    await c.query("update alunos set trilha_id = $1 where id = (select id from alunos where escola_id = $2 limit 1)",
      [TRILHA, ESCOLA_A]);
    await assert.rejects(liberar(c, "2026-09-23"), /outro tenant/);
    await c.query("rollback to savepoint s2");

    await c.query("savepoint s3");
    await assert.rejects(um(c, "select demo.gravar(date '2026-09-15')"), /segunda-feira/);
    await c.query("rollback to savepoint s3");
  });
});

test("pausado, o mecanismo não escreve nada", async () => {
  await comDemo(async (c) => {
    await virar(c, "2026-09-22");
    const antes = await estadoMeridiano(c);
    await c.query("select demo.pausar(true)");
    assert.deepEqual((await virar(c, "2026-09-26")).r, { pausado: true });
    assert.deepEqual((await liberar(c, "2026-09-26")).r, { pausado: true });
    assert.equal(await estadoMeridiano(c), antes);
  });
});
