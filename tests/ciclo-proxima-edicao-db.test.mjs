// ============================================================
// PRÓXIMA EDIÇÃO DA TRILHA (0051) — o ciclo que se renova
// ------------------------------------------------------------
// A data da prova já rolava sozinha (Onda 3). O plano de estudo não:
// vencida a última semana, o aluno ficava preso em `estado_ciclo =
// 'encerrado'` sem caminho de saída — embora a tela do responsável já
// prometesse "a coordenação abre o próximo ciclo".
//
// Empurrar as datas da MESMA trilha não resolve: metas é unique por
// (aluno, trilha, semana), então o aluno chegaria na semana 3 já tendo
// a meta 3 fechada do ciclo anterior e travaria — só destravando se
// apagasse o histórico.
//
// O teste central é o último: o aluno muda de edição e NÃO perde nada
// do que estudou. É o requisito que originou este trabalho.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, comoServidor, ESCOLA_A, ALUNO_LUCAS } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const TRILHA_CN = "b1388388-c660-4b4b-811c-b58358689e92";

async function emTransacao(fn) {
  return comoServidor(async (c) => {
    await c.query("begin");
    try { return await fn(c); } finally { await c.query("rollback").catch(() => {}); }
  });
}

async function fimDoCiclo(c, trilha) {
  const r = await c.query("select max(fim)::text as fim from trilha_semanas where trilha_id = $1", [trilha]);
  return r.rows[0].fim;
}

test("cria uma edição nova cujas semanas terminam na semana da âncora", async () => {
  await emTransacao(async (c) => {
    const fimAtual = await fimDoCiclo(c, TRILHA_CN);
    const ancora = new Date(`${fimAtual}T00:00:00`);
    ancora.setDate(ancora.getDate() + 364);          // ~1 ano adiante
    const alvo = ancora.toISOString().slice(0, 10);

    const nova = (await c.query("select app.abrir_proximo_ciclo($1, $2::date) as id", [TRILHA_CN, alvo])).rows[0].id;
    assert.ok(nova && nova !== TRILHA_CN, "precisa devolver uma trilha NOVA");

    // o fim atual é um domingo (semanas seg–dom) e 364 dias são 52
    // semanas: a âncora também é domingo, e a última semana termina nela
    assert.equal(await fimDoCiclo(c, nova), alvo, "a última semana deve terminar no domingo da semana da prova");

    // mesmo número de semanas, todas de segunda a domingo e contíguas (D09, 0053)
    const forma = await c.query(
      `select (select count(*) from trilha_semanas where trilha_id = $1)::int as n_origem,
              (select count(*) from trilha_semanas where trilha_id = $2)::int as n_nova,
              (select count(*) from trilha_semanas where trilha_id = $2
                  and (extract(isodow from inicio) <> 1 or fim - inicio <> 6))::int as tortas,
              (select max(fim) - min(inicio) from trilha_semanas where trilha_id = $2)::int as dur_nova`,
      [TRILHA_CN, nova]);
    const f = forma.rows[0];
    assert.equal(f.n_nova, f.n_origem, "mesmo número de semanas");
    assert.equal(f.tortas, 0, "nenhuma semana fora de segunda a domingo");
    assert.equal(f.dur_nova, 7 * f.n_nova - 1, "semanas contíguas, sem buraco nem sobreposição");
  });
});

test("D09: prova no sábado — a última semana termina no domingo seguinte, e a edição começa numa segunda", async () => {
  await emTransacao(async (c) => {
    const fimAtual = await fimDoCiclo(c, TRILHA_CN);
    // um sábado ~1 ano adiante (fimAtual é domingo: +363 = sábado)
    const sab = new Date(`${fimAtual}T00:00:00Z`);
    sab.setUTCDate(sab.getUTCDate() + 363);
    const ancora = sab.toISOString().slice(0, 10);
    const dom = new Date(sab); dom.setUTCDate(dom.getUTCDate() + 1);

    const nova = (await c.query("select app.abrir_proximo_ciclo($1, $2::date) as id", [TRILHA_CN, ancora])).rows[0].id;
    assert.equal(await fimDoCiclo(c, nova), dom.toISOString().slice(0, 10));
    const r = await c.query(
      `select extract(isodow from min(inicio))::int as dow_inicio,
              (select count(*) from trilha_semanas where trilha_id = $1
                  and (extract(isodow from inicio) <> 1 or fim - inicio <> 6))::int as tortas
         from trilha_semanas where trilha_id = $1`, [nova]);
    assert.equal(r.rows[0].dow_inicio, 1, "a edição começa numa segunda");
    assert.equal(r.rows[0].tortas, 0);
    // a mesma semana com outra âncora (o domingo) devolve a mesma edição
    const outra = (await c.query("select app.abrir_proximo_ciclo($1, $2::date) as id",
      [TRILHA_CN, dom.toISOString().slice(0, 10)])).rows[0].id;
    assert.equal(outra, nova, "idempotente pela semana da prova");
  });
});

test("clona disciplinas e atividades, sem tocar nas da edição anterior", async () => {
  await emTransacao(async (c) => {
    const fimAtual = await fimDoCiclo(c, TRILHA_CN);
    const alvo = new Date(`${fimAtual}T00:00:00`);
    alvo.setDate(alvo.getDate() + 364);
    const ancora = alvo.toISOString().slice(0, 10);

    const antes = (await c.query(
      "select count(*)::int as n from atividades_modelo where trilha_id = $1", [TRILHA_CN])).rows[0].n;
    const nova = (await c.query("select app.abrir_proximo_ciclo($1, $2::date) as id", [TRILHA_CN, ancora])).rows[0].id;

    const r = await c.query(
      `select (select count(*) from atividades_modelo where trilha_id = $1)::int as ativ_origem,
              (select count(*) from atividades_modelo where trilha_id = $2)::int as ativ_nova,
              (select count(*) from disciplinas where trilha_id = $1)::int as disc_origem,
              (select count(*) from disciplinas where trilha_id = $2)::int as disc_nova`,
      [TRILHA_CN, nova]);
    assert.equal(r.rows[0].ativ_origem, antes, "a edição anterior não pode perder atividade");
    assert.equal(r.rows[0].ativ_nova, antes, "a edição nova recebe as mesmas atividades");
    assert.equal(r.rows[0].disc_nova, r.rows[0].disc_origem, "e as mesmas disciplinas");
  });
});

test("idempotente: abrir duas vezes com a mesma âncora devolve a mesma edição", async () => {
  await emTransacao(async (c) => {
    const fimAtual = await fimDoCiclo(c, TRILHA_CN);
    const d = new Date(`${fimAtual}T00:00:00`);
    d.setDate(d.getDate() + 364);
    const ancora = d.toISOString().slice(0, 10);

    const a = (await c.query("select app.abrir_proximo_ciclo($1, $2::date) as id", [TRILHA_CN, ancora])).rows[0].id;
    const b = (await c.query("select app.abrir_proximo_ciclo($1, $2::date) as id", [TRILHA_CN, ancora])).rows[0].id;
    assert.equal(b, a, "a segunda chamada não pode criar uma segunda edição");
  });
});

test("recusa âncora que não é posterior ao fim do ciclo atual", async () => {
  await emTransacao(async (c) => {
    const fimAtual = await fimDoCiclo(c, TRILHA_CN);
    await c.query("savepoint sp");
    let err = null;
    try {
      await c.query("select app.abrir_proximo_ciclo($1, $2::date)", [TRILHA_CN, fimAtual]);
    } catch (e) { err = e; }
    await c.query("rollback to savepoint sp");
    assert.ok(err, "âncora igual ao fim atual deve ser recusada");
    assert.match(err.message, /não é posterior/);
  });
});

test("privilégio: aluno logado não abre ciclo", async () => {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: ALUNO_LUCAS, role: "authenticated",
                       app_metadata: { escola_id: ESCOLA_A, papel: "aluno" } })]);
    await c.query("set local role authenticated");
    let err = null;
    try {
      await c.query("select public.abrir_proximo_ciclo($1, current_date + 400)", [TRILHA_CN]);
    } catch (e) { err = e; }
    assert.ok(err, "aluno não pode abrir ciclo");
    assert.match(err.message, /acesso negado|permission denied/i);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
});

// ── O TESTE QUE IMPORTA ────────────────────────────────────────────
test("o aluno muda de edição e NÃO perde nada do que estudou", async () => {
  await emTransacao(async (c) => {
    // retrato do histórico ANTES
    const antes = (await c.query(
      `select (select count(*) from registros_estudo where aluno_id = $1)::int as registros,
              (select coalesce(sum(questoes),0) from registros_estudo where aluno_id = $1)::int as questoes,
              (select count(*) from simulados where aluno_id = $1)::int as simulados,
              (select count(*) from metas where aluno_id = $1)::int as metas,
              (select coalesce(sum(xp_delta),0) from aluno_eventos_progresso where aluno_id = $1)::int as xp`,
      [ALUNO_LUCAS])).rows[0];
    assert.ok(antes.registros > 0, "pré-condição: o Lucas precisa ter histórico");

    const fimAtual = await fimDoCiclo(c, TRILHA_CN);
    const d = new Date(`${fimAtual}T00:00:00`);
    d.setDate(d.getDate() + 364);
    const ancora = d.toISOString().slice(0, 10);

    const nova = (await c.query("select app.abrir_proximo_ciclo($1, $2::date) as id", [TRILHA_CN, ancora])).rows[0].id;
    await c.query("update alunos set trilha_id = $1 where id = $2", [nova, ALUNO_LUCAS]);

    const depois = (await c.query(
      `select (select count(*) from registros_estudo where aluno_id = $1)::int as registros,
              (select coalesce(sum(questoes),0) from registros_estudo where aluno_id = $1)::int as questoes,
              (select count(*) from simulados where aluno_id = $1)::int as simulados,
              (select count(*) from metas where aluno_id = $1)::int as metas,
              (select coalesce(sum(xp_delta),0) from aluno_eventos_progresso where aluno_id = $1)::int as xp`,
      [ALUNO_LUCAS])).rows[0];

    assert.deepEqual(depois, antes,
      "trocar de edição não pode alterar registro, questão, simulado, meta antiga nem XP");

    // e as metas antigas continuam apontando para a edição ANTERIOR
    const presas = (await c.query(
      "select count(*)::int as n from metas where aluno_id = $1 and trilha_id = $2", [ALUNO_LUCAS, TRILHA_CN])).rows[0].n;
    assert.equal(presas, antes.metas, "o histórico de metas fica preso à edição em que aconteceu");
  });
});

test("na edição nova o aluno volta a ter ciclo em curso e ganha meta", async () => {
  await emTransacao(async (c) => {
    // leva a trilha atual para o passado, simulando ciclo encerrado
    await c.query("update trilha_semanas set inicio = inicio - 400, fim = fim - 400 where trilha_id = $1", [TRILHA_CN]);
    const encerrado = (await c.query("select estado from app.estado_ciclo($1)", [TRILHA_CN])).rows[0].estado;
    assert.equal(encerrado, "encerrado", "pré-condição: o ciclo atual precisa estar encerrado");

    // âncora ~1 mês à frente: a última semana da edição nova cai no futuro
    const nova = (await c.query(
      "select app.abrir_proximo_ciclo($1, (app.hoje_local() + 30)::date) as id", [TRILHA_CN])).rows[0].id;
    await c.query("update alunos set trilha_id = $1 where id = $2", [nova, ALUNO_LUCAS]);

    const estado = (await c.query("select estado from app.estado_ciclo($1)", [nova])).rows[0].estado;
    assert.notEqual(estado, "encerrado", "a edição nova não pode nascer encerrada");

    await c.query("delete from meta_atividades where meta_id in (select id from metas where aluno_id = $1)", [ALUNO_LUCAS]);
    await c.query("delete from metas where aluno_id = $1", [ALUNO_LUCAS]);
    await c.query("select app.gerar_meta($1)", [ALUNO_LUCAS]);

    const m = (await c.query(
      "select count(*)::int as n from metas where aluno_id = $1 and trilha_id = $2 and status = 'ativa'",
      [ALUNO_LUCAS, nova])).rows[0].n;
    assert.equal(m, 1, "o motor precisa abrir meta na edição nova");
  });
});

// ── a costura de dados existe (senão o RPC fica inalcançável) ───────
test("o app tem como chamar o RPC — a promessa da tela do responsável deixa de ser vazia", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const seam = readFileSync(resolve(raiz, "app/src/shared/data/index.js"), "utf8");
  assert.match(seam, /export async function abrirProximoCiclo/,
    "sem função no seam de dados, o RPC não é alcançável pelo app");
  assert.match(seam, /supabase\.rpc\("abrir_proximo_ciclo"/, "precisa chamar o RPC de verdade");
});
