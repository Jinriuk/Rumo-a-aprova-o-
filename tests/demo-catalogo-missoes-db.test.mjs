// ============================================================
// DEMO · catálogo de missões igual ao da produção (com banco)
// ------------------------------------------------------------
// supabase/demo/correcoes/2026-10-02_catalogo_missoes_* contra o banco
// de teste (que as seeds montam igual à produção: 26 missões com meta),
// com o estado do demo simulado dentro de uma transação desfeita no
// fim: metas nulas, EsPCEx "beta v1" e um Meridiano de mentira com o id
// do de verdade. O que importa: as travas (só demo, só com a 0061), o
// resultado igual ao da produção depois das seeds 19, 20 e 18, o backup
// que não se sobrescreve e o desfazer que não apaga nada.
// Proposta: nada disto foi aplicado no demo.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./identidades.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => readFileSync(resolve(root, p), "utf8");
const DIR = "supabase/demo/correcoes";
const PREPARAR = `${DIR}/2026-10-02_catalogo_missoes_1_preparar.sql`;
const CONFERIR = `${DIR}/2026-10-02_catalogo_missoes_conferir.sql`;
const DESFAZER = `${DIR}/2026-10-02_catalogo_missoes_9_desfazer.sql`;
const MERIDIANO = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const semComentarios = (sql) => sql.replace(/--[^\n]*/g, "");

async function noDemo(fn, { comMeridiano = true } = {}) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    if (comMeridiano) {
      await c.query(`insert into escolas (id, nome, slug, status, plano)
                     values ($1, 'Instituto Meridiano (teste)', 'meridiano-teste-catalogo', 'ativa', 'demo')`, [MERIDIANO]);
    }
    // o schema demo mínimo que os scripts usam (o real vem do Bloco 1)
    await c.query(`create schema if not exists demo;
                   create table if not exists demo.execucoes (id bigserial primary key, acao text not null,
                     hoje date not null, ancora date, detalhe jsonb not null default '{}'::jsonb,
                     executado_em timestamptz not null default now())`);
    // o catálogo como o demo está em 02/10: nenhuma meta, EsPCEx beta
    await c.query("update missoes set meta_questoes = null, meta_acuracia = null");
    await c.query("update concursos set maturidade = 'beta', conteudo_versao = 1 where codigo = 'espcex'");
    return await fn(c);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

const conferir = async (c) => (await c.query(ler(CONFERIR))).rows[0];
const comMeta = async (c) => +(await c.query("select count(*) from missoes where meta_questoes > 0")).rows[0].count;

test("demo catálogo: preparar + seeds 19, 20 e 18 deixam o catálogo igual ao da produção", async () => {
  await noDemo(async (c) => {
    const antes = await conferir(c);
    assert.equal(antes.missoes_com_meta, 0);
    assert.equal(antes.backup_ativo, false);
    await c.query(ler(PREPARAR));
    await c.query(ler("supabase/seed/19_espcex_ped2_r3.sql"));
    await c.query(ler("supabase/seed/20_trilha_espcex.sql"));
    await c.query(ler("supabase/seed/18_maturidade_concursos.sql"));
    const d = await conferir(c);
    assert.deepEqual(
      [d.missoes_com_meta, d.espcex_missoes, d.espcex_com_meta, d.espcex_sem_assunto, d.espcex_assuntos,
        d.espcex_planos, d.espcex_maturidade, d.motor_0061, d.backup_ativo],
      [26, 24, 21, 0, 80, 4, "completa v3", true, true]);
    assert.equal(d.fisica_espcex, "Eletricidade fechada → Termologia sem surpresa → Mecânica sob tempo",
      "a seed 20 já traz a ordem corrigida pela 0061 (avançado por último)");
    const ex = (await c.query("select acao from demo.execucoes order by id")).rows.map((r) => r.acao);
    assert.deepEqual(ex, ["catalogo_missoes_preparar"]);
  });
});

test("demo catálogo: o passo 1 sozinho só preenche meta nula, e rodar de novo não sobrescreve o backup", async () => {
  await noDemo(async (c) => {
    await c.query("update missoes set meta_questoes = 99 where id = 'a1000000-0000-4000-8000-000000000001'");
    await c.query(ler(PREPARAR));
    const geo = (await c.query("select meta_questoes, meta_acuracia from missoes where id = 'a1000000-0000-4000-8000-000000000001'")).rows[0];
    assert.deepEqual([geo.meta_questoes, geo.meta_acuracia], [99, null],
      "linha com meta já posta fica intacta (mesmo texto da seed 09 §5)");
    const outra = (await c.query("select meta_questoes, meta_acuracia from missoes where id = 'a1000000-0000-4000-8000-000000000002'")).rows[0];
    assert.deepEqual([outra.meta_questoes, outra.meta_acuracia], [40, 70], "meta nula vira a quantidade sugerida, com 70% de acurácia");
    const red = (await c.query("select count(*) from missoes where qtd_questoes_sugerida is null and meta_questoes is not null")).rows[0];
    assert.equal(+red.count, 0, "sem quantidade sugerida (redação) continua manual");
    const backup1 = (await c.query("select count(*) filter (where meta_questoes is not null) as n, count(*) as total from demo.backup_20261002_missoes")).rows[0];
    await c.query(ler(PREPARAR));
    const backup2 = (await c.query("select count(*) filter (where meta_questoes is not null) as n, count(*) as total from demo.backup_20261002_missoes")).rows[0];
    assert.deepEqual(backup2, backup1, "a segunda execução não troca o backup pelo estado já alterado");
    assert.equal(+backup1.n, 1, "o backup guarda o estado de antes (só a meta 99 posta à mão)");
  });
});

test("demo catálogo: desfazer volta as metas e a maturidade sem apagar missão nenhuma", async () => {
  await noDemo(async (c) => {
    const total = +(await c.query("select count(*) from missoes")).rows[0].count;
    await c.query(ler(PREPARAR));
    await c.query(ler("supabase/seed/20_trilha_espcex.sql"));
    await c.query(ler("supabase/seed/18_maturidade_concursos.sql"));
    assert.equal(await comMeta(c), 26);
    await c.query(ler(DESFAZER));
    assert.equal(await comMeta(c), 0, "nenhuma missão fecha sozinha de novo");
    assert.equal(+(await c.query("select count(*) from missoes")).rows[0].count, total, "nada apagado");
    assert.equal((await conferir(c)).espcex_maturidade, "beta v1");
    await c.query(ler(DESFAZER));
    assert.equal(await comMeta(c), 0, "idempotente");
  });
});

test("demo catálogo: recusa fora do demo, sem a 0061 e desfazer sem backup", async () => {
  await noDemo(async (c) => {
    await assert.rejects(c.query(ler(PREPARAR)), /Meridiano\/plano demo ausente/);
  }, { comMeridiano: false });
  await noDemo(async (c) => {
    await c.query("alter table app.missao_registros rename to missao_registros_fora");
    await assert.rejects(c.query(ler(PREPARAR)), /a 0061 .* não está aplicada/);
  });
  await noDemo(async (c) => {
    await assert.rejects(c.query(ler(DESFAZER)), /nada a desfazer/);
  });
});

test("demo catálogo: os scripts não apagam nem derrubam nada; o conferir só lê", () => {
  for (const f of [PREPARAR, DESFAZER]) {
    const sql = semComentarios(ler(f)).toLowerCase();
    assert.doesNotMatch(sql, /\b(delete|drop|truncate)\b/, f);
  }
  const conf = semComentarios(ler(CONFERIR)).toLowerCase();
  assert.doesNotMatch(conf, /\b(insert|update|delete|drop|truncate|create|alter)\b/);
  const doc = ler("docs/operacao/demo-catalogo-missoes.md");
  for (const f of [PREPARAR, CONFERIR, DESFAZER, "supabase/seed/19_espcex_ped2_r3.sql",
    "supabase/seed/20_trilha_espcex.sql", "supabase/seed/18_maturidade_concursos.sql"]) {
    assert.ok(doc.includes(f.split("/").pop()), `o documento cita ${f}`);
  }
  assert.match(doc, /Não aplicado/);
});
