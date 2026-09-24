// ============================================================
// BLOCO 5 — TELA 24: preparo e restauração da Helena (com banco)
// ------------------------------------------------------------
// supabase/demo/captura/tela24_{preparar,restaurar,conferir}.sql contra
// um Meridiano de mentira com os MESMOS ids do de verdade, tudo dentro
// de uma transação desfeita no fim. O que importa: a restauração devolve
// a linha de aluno_onboarding e o must_change_password exatamente como
// estavam, rodar duas vezes não estraga o backup, e o preparo recusa
// qualquer tenant que não seja o de demonstração.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./identidades.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => readFileSync(resolve(root, p), "utf8");
const DIR = "supabase/demo/captura";
const MERIDIANO = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const HELENA = "dddddddd-a000-4000-8000-000000000001";
const USUARIO = "dddddddd-b000-4000-8000-000000000001";
const semComentarios = (sql) => sql.replace(/--[^\n]*/g, "");

async function comHelena(fn, { mustChange = true, comOnboarding = true } = {}) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(`insert into escolas (id, nome, slug, status, plano)
                   values ($1, 'Instituto Meridiano (teste)', 'meridiano-teste-tela24', 'ativa', 'demo')`, [MERIDIANO]);
    await c.query(`insert into usuarios (id, escola_id, papel, nome, must_change_password)
                   values ($1, $2, 'aluno', 'Helena Vasconcelos', $3)`, [USUARIO, MERIDIANO, mustChange]);
    await c.query(`insert into alunos (id, escola_id, nome, usuario_id) values ($1, $2, 'Helena Vasconcelos', $3)`,
      [HELENA, MERIDIANO, USUARIO]);
    if (comOnboarding) {
      await c.query(`insert into aluno_onboarding (aluno_id, escola_id, experiencia_previa, disponibilidade_semanal_h,
                       maior_dificuldade, concluido_em, atualizado_em)
                     values ($1, $2, 'estuda há 1 ano ou mais', 20, 'fis',
                             timestamptz '2026-09-19 15:58:53.341765+00', timestamptz '2026-09-19 15:58:53.341765+00')`,
        [HELENA, MERIDIANO]);
    }
    // o schema demo mínimo que os scripts usam (o real vem do Bloco 1)
    await c.query(`create schema if not exists demo;
                   create table if not exists demo.execucoes (id bigserial primary key, acao text not null, hoje date,
                     detalhe jsonb, executado_em timestamptz not null default now())`);
    return await fn(c);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

const estado = async (c) => (await c.query(`
  select (select to_jsonb(o) from aluno_onboarding o where o.aluno_id = $1) as onboarding,
         (select must_change_password from usuarios where id = $2) as troca_senha`, [HELENA, USUARIO])).rows[0];
const conferir = async (c) => (await c.query(ler(`${DIR}/tela24_conferir.sql`))).rows[0];

test("tela 24: o preparo deixa o onboarding pendente e a troca de senha desligada, com backup do original", async () => {
  await comHelena(async (c) => {
    const antes = await estado(c);
    assert.equal((await conferir(c)).backup_ativo, false);
    await c.query(ler(`${DIR}/tela24_preparar.sql`));
    const depois = await conferir(c);
    assert.equal(depois.onboarding_pendente, true);
    assert.equal(depois.troca_senha, false);
    assert.equal(depois.backup_ativo, true);
    const b = (await c.query("select onboarding, must_change_password from demo.backup_20260926_tela24 where aluno_id = $1", [HELENA])).rows[0];
    assert.deepEqual(b.onboarding, antes.onboarding, "backup = linha original inteira");
    assert.equal(b.must_change_password, true);
    // as respostas ficam; só o concluido_em some
    const o = (await estado(c)).onboarding;
    assert.equal(o.disponibilidade_semanal_h, 20);
  });
});

test("tela 24: preparar duas vezes não sobrescreve o backup; restaurar devolve tudo exatamente", async () => {
  await comHelena(async (c) => {
    const antes = await estado(c);
    await c.query(ler(`${DIR}/tela24_preparar.sql`));
    await c.query(ler(`${DIR}/tela24_preparar.sql`));
    await c.query(ler(`${DIR}/tela24_restaurar.sql`));
    assert.deepEqual(await estado(c), antes, "linha de aluno_onboarding e must_change_password iguais ao original");
    assert.equal((await conferir(c)).backup_ativo, false);
    // restaurar de novo não faz nada (backup já consumido)
    await c.query(ler(`${DIR}/tela24_restaurar.sql`));
    assert.deepEqual(await estado(c), antes);
    const log = (await c.query("select acao from demo.execucoes order by id")).rows.map((r) => r.acao);
    assert.deepEqual(log, ["tela24_preparar", "tela24_preparar", "tela24_restaurar"]);
  });
});

test("tela 24: Helena sem linha de onboarding volta a não ter linha", async () => {
  await comHelena(async (c) => {
    await c.query(ler(`${DIR}/tela24_preparar.sql`));
    await c.query(ler(`${DIR}/tela24_restaurar.sql`));
    assert.equal((await estado(c)).onboarding, null);
  }, { comOnboarding: false, mustChange: false });
});

test("tela 24: fora do plano demo o preparo aborta sem escrever nada", async () => {
  await comHelena(async (c) => {
    await c.query("update escolas set plano = 'basico' where id = $1", [MERIDIANO]);
    const antes = await estado(c);
    await c.query("savepoint s");
    await assert.rejects(c.query(ler(`${DIR}/tela24_preparar.sql`)), /plano demo ausente/);
    await c.query("rollback to savepoint s");
    assert.deepEqual(await estado(c), antes);
  });
});

test("tela 24: os scripts que escrevem começam pela guarda do Meridiano e não tocam auditoria", () => {
  for (const f of ["tela24_preparar.sql", "tela24_restaurar.sql"]) {
    const sql = semComentarios(ler(`${DIR}/${f}`));
    const guarda = sql.search(/id = v_escola and plano = 'demo'/);
    const escrita = sql.search(/\b(create\s+table|insert\s+into|update\s+public|delete\s+from)/i);
    assert.ok(guarda >= 0 && guarda < escrita, `${f} escreve antes de verificar o tenant`);
    assert.doesNotMatch(sql, /(insert\s+into|update|delete\s+from)\s+(public\.)?(logs_acesso|consentimentos)\b/i, f);
  }
  assert.doesNotMatch(semComentarios(ler(`${DIR}/tela24_conferir.sql`)), /\b(insert|update|delete|create|alter|drop)\b/i,
    "a conferência é só leitura");
});
