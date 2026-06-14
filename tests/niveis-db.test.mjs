// ============================================================
// NÍVEIS E ONBOARDING (Fase 15.3) — banco e RLS
// ------------------------------------------------------------
// Matriz pedida:
//   • coordenação lê e altera nível de aluno da PRÓPRIA escola;
//   • coordenação não acessa aluno de outra escola;
//   • aluno lê o PRÓPRIO nível, mas NÃO altera;
//   • responsável lê o do aluno vinculado; não lê não-vinculado;
//   • histórico é escrito pelo gatilho e só a coordenação lê;
//   • conteúdo global (config) continua seguro.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, esperaErro, IDS, ESCOLA_A, ESCOLA_B, ALUNO_LUCAS, ALUNO_BRUNO } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

test("coordenação A lê os níveis do próprio aluno (geral + por matéria, diferentes)", async () => {
  await como(IDS.coordA, async (c) => {
    const r = await c.query("select escopo, nivel from aluno_niveis where aluno_id = $1 order by escopo", [ALUNO_LUCAS]);
    const m = Object.fromEntries(r.rows.map((x) => [x.escopo, x.nivel]));
    assert.equal(m.geral, "intermediario");
    assert.equal(m.mat, "base");
    assert.equal(m.por, "avancado");
  });
});

test("coordenação A NÃO enxerga nível de aluno da escola B (isolamento)", async () => {
  await como(IDS.coordA, async (c) => {
    const r = await c.query("select count(*)::int as n from aluno_niveis where escola_id = $1", [ESCOLA_B]);
    assert.equal(r.rows[0].n, 0);
    const seg = await c.query("select count(*)::int as n from aluno_niveis where motivo = 'SEGREDO-ESCOLA-B-NIVEL'");
    assert.equal(seg.rows[0].n, 0, "o nível-segredo da escola B é invisível para A");
  });
});

test("coordenação A altera o nível e o gatilho registra o histórico", async () => {
  await como(IDS.coordA, async (c) => {
    await c.query(
      "update aluno_niveis set nivel = 'avancado', origem = 'manual', motivo = 'Reclassificado após simulado', definido_por = $2 where aluno_id = $1 and escopo = 'mat'",
      [ALUNO_LUCAS, IDS.coordA.sub]
    );
    const r = await c.query("select nivel, origem from aluno_niveis where aluno_id = $1 and escopo = 'mat'", [ALUNO_LUCAS]);
    assert.equal(r.rows[0].nivel, "avancado");
    assert.equal(r.rows[0].origem, "manual");
    const h = await c.query(
      "select nivel_anterior, nivel_novo, alterado_por from aluno_nivel_historico where aluno_id = $1 and escopo = 'mat' order by em desc limit 1",
      [ALUNO_LUCAS]
    );
    assert.equal(h.rows[0].nivel_anterior, "base");
    assert.equal(h.rows[0].nivel_novo, "avancado");
    assert.equal(h.rows[0].alterado_por, IDS.coordA.sub, "rastreabilidade: quem alterou");
  });
});

test("o aluno LÊ o próprio nível, mas NÃO o altera (RLS de escrita só da coordenação)", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query("select count(*)::int as n from aluno_niveis where aluno_id = $1", [ALUNO_LUCAS]);
    assert.ok(r.rows[0].n >= 1, "o aluno vê o próprio nível");
    // UPDATE: a RLS filtra as linhas para o aluno → 0 alteradas, sem erro.
    // O dado fica intacto, que é o que importa para a segurança.
    const upd = await c.query("update aluno_niveis set nivel = 'avancado' where aluno_id = $1 and escopo = 'geral' returning id", [ALUNO_LUCAS]);
    assert.equal(upd.rows.length, 0, "o aluno não consegue alterar o próprio nível");
    const ainda = await c.query("select nivel from aluno_niveis where aluno_id = $1 and escopo = 'geral'", [ALUNO_LUCAS]);
    assert.equal(ainda.rows[0].nivel, "intermediario", "o nível permanece o que a coordenação definiu");
    // INSERT de um nível novo é recusado pela RLS (WITH CHECK da coordenação).
    await esperaErro(
      c, /row-level security/i,
      "insert into aluno_niveis (escola_id, aluno_id, escopo, nivel, origem) values ($1, $2, 'ing', 'avancado', 'manual')",
      [ESCOLA_A, ALUNO_LUCAS]
    );
  });
});

test("o aluno A não vê o nível de outro aluno (nem o do Bruno)", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query("select count(*)::int as n from aluno_niveis where aluno_id = $1", [ALUNO_BRUNO]);
    assert.equal(r.rows[0].n, 0);
  });
});

test("o responsável lê o nível do aluno vinculado", async () => {
  await como(IDS.respA, async (c) => {
    const r = await c.query("select count(*)::int as n from aluno_niveis where aluno_id = $1", [ALUNO_LUCAS]);
    assert.ok(r.rows[0].n >= 1, "responsável do Lucas lê o nível do Lucas");
  });
});

test("o responsável NÃO lê nível de aluno não vinculado", async () => {
  await como(IDS.respA, async (c) => {
    const r = await c.query("select count(*)::int as n from aluno_niveis where aluno_id = $1", [ALUNO_BRUNO]);
    assert.equal(r.rows[0].n, 0);
  });
});

test("histórico: só a coordenação lê (aluno não enxerga a trilha de auditoria)", async () => {
  await como(IDS.coordA, async (c) => {
    const r = await c.query("select count(*)::int as n from aluno_nivel_historico");
    assert.ok(r.rows[0].n >= 1);
  });
  await como(IDS.alunoA, async (c) => {
    const r = await c.query("select count(*)::int as n from aluno_nivel_historico");
    assert.equal(r.rows[0].n, 0, "o aluno não lê o histórico");
  });
});

test("histórico não é gravável via API (escrita exclusiva do gatilho)", async () => {
  await como(IDS.coordA, async (c) => {
    await esperaErro(
      c, /(row-level security|permission denied)/i,
      "insert into aluno_nivel_historico (escola_id, aluno_id, escopo, nivel_novo, origem) values ($1, $2, 'geral', 'avancado', 'manual')",
      [ESCOLA_A, ALUNO_LUCAS]
    );
  });
});

test("onboarding: coordenação lê e escreve o próprio; aluno lê e não escreve", async () => {
  await como(IDS.coordA, async (c) => {
    const r = await c.query("select objetivo from aluno_onboarding where aluno_id = $1", [ALUNO_LUCAS]);
    assert.match(r.rows[0].objetivo, /Naval/i);
    await c.query("update aluno_onboarding set maior_dificuldade = 'Geometria' where aluno_id = $1", [ALUNO_LUCAS]);
  });
  await como(IDS.alunoA, async (c) => {
    const r = await c.query("select count(*)::int as n from aluno_onboarding where aluno_id = $1", [ALUNO_LUCAS]);
    assert.equal(r.rows[0].n, 1, "o aluno lê o próprio onboarding");
    // o aluno não escreve: a RLS filtra a linha → 0 alteradas, sem erro
    const upd = await c.query("update aluno_onboarding set objetivo = 'hack' where aluno_id = $1 returning aluno_id", [ALUNO_LUCAS]);
    assert.equal(upd.rows.length, 0, "o aluno não edita o próprio onboarding");
  });
});

test("alvo pedagógico: coordenação A define alvo secundário; não toca aluno de B", async () => {
  await como(IDS.coordA, async (c) => {
    await c.query("update alunos set concurso_secundario_id = 'c0c00000-0000-4000-8000-000000000002' where id = $1", [ALUNO_LUCAS]);
    const r = await c.query("select concurso_secundario_id from alunos where id = $1", [ALUNO_LUCAS]);
    assert.equal(r.rows[0].concurso_secundario_id, "c0c00000-0000-4000-8000-000000000002");
    // não consegue alterar aluno da escola B
    const upd = await c.query("update alunos set data_prova_alvo = '2026-01-01' where id = $1 returning id", [ALUNO_BRUNO]);
    assert.equal(upd.rows.length, 0, "coordenação A não altera aluno da escola B");
  });
});
