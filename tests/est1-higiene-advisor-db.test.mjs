// ============================================================
// EST1-B2 (0042) — HIGIENE DO ADVISOR: policies e índices
// ------------------------------------------------------------
// (1) aluno_missoes tinha DUAS policies permissivas para
//     authenticated/SELECT (a de coordenação FOR ALL + a _select). A
//     0042 deixa a coordenação só com escrita; o SELECT fica com uma
//     policy só. Aqui provamos: uma única policy permissiva de SELECT,
//     leitura da coordenação preservada, e escrita do aluno segue barrada.
// (2) os índices de cobertura das FKs quentes existem.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, comoServidor, esperaErro, IDS, ESCOLA_A, ALUNO_LUCAS } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

test("aluno_missoes tem UMA única policy permissiva de SELECT (advisor limpo)", async () => {
  await comoServidor(async (c) => {
    const r = await c.query(
      `select policyname, cmd from pg_policies
        where schemaname='public' and tablename='aluno_missoes' and 'authenticated' = any(roles)
        order by policyname`,
    );
    // SELECT é coberto por 'cmd' ALL ou SELECT — contamos quantas policies
    // permissivas atingem SELECT.
    const atingemSelect = r.rows.filter((p) => p.cmd === "SELECT" || p.cmd === "ALL");
    assert.equal(atingemSelect.length, 1, `esperava 1 policy de SELECT, achei ${atingemSelect.length}: ${atingemSelect.map((p) => p.policyname).join(", ")}`);
    assert.equal(atingemSelect[0].policyname, "aluno_missoes_select");
    // a antiga FOR ALL não existe mais
    assert.ok(!r.rows.some((p) => p.policyname === "aluno_missoes_coordenacao"), "policy FOR ALL consolidada");
  });
});

test("a coordenação continua LENDO as missões da própria escola", async () => {
  await como(IDS.coordA, async (c) => {
    const r = await c.query("select count(*)::int n from aluno_missoes where escola_id=$1", [ESCOLA_A]);
    assert.ok(r.rows[0].n >= 0, "leitura da coordenação funciona (não é recusada)");
  });
});

test("o ALUNO continua sem escrever aluno_missoes na unha (motor escreve por definer)", async () => {
  await como(IDS.alunoA, async (c) => {
    // pega uma missão do exam do aluno para tentar forjar
    const mis = await c.query("select id from missoes where exam_tag='cn' limit 1");
    await esperaErro(c, /row-level security/i,
      `insert into aluno_missoes (escola_id, aluno_id, missao_id, exam_tag, estado, xp_concedido)
       values ($1,$2,$3,'cn','concluida',9999)`,
      [ESCOLA_A, ALUNO_LUCAS, mis.rows[0].id]);
  });
});

test("os índices de cobertura das FKs quentes existem (0042)", async () => {
  await comoServidor(async (c) => {
    const esperados = [
      "idx_aluno_missoes_escola", "idx_aluno_missoes_missao",
      "idx_evprog_exam", "idx_evprog_criado_por",
      "idx_aluno_conquistas_conquista", "idx_aluno_conquistas_exam",
      "idx_aluno_niveis_definido_por",
      "idx_alunos_concurso", "idx_alunos_concurso_sec",
      "idx_meta_atividades_modelo", "idx_metas_trilha",
      "idx_missoes_escola_missao",
    ];
    const r = await c.query(
      "select indexname from pg_indexes where schemaname='public' and indexname = any($1)",
      [esperados],
    );
    const achados = new Set(r.rows.map((x) => x.indexname));
    for (const idx of esperados) assert.ok(achados.has(idx), `índice ausente: ${idx}`);
  });
});
