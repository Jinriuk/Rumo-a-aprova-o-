// ============================================================
// TRILHAS E MISSÕES (Fase 15.4) — banco e RLS
// ------------------------------------------------------------
// Prova que: planos e missões existem por exam_tag; toda missão
// carrega exam_tag (anti-furo); missão liga ao nível; planos/missões
// são GLOBAIS (leitura por todos, escrita só do operador); o ajuste
// da escola é ISOLADO e sinaliza desvio; config oficial preservada.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, esperaErro, IDS, ESCOLA_A, ESCOLA_B } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const MISSAO_CRASE = "a1000000-0000-4000-8000-000000000002"; // cn/por (tem override na Vitrine)

test("planos de trilha existem por concurso e tipo (anual + reta final no mínimo)", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query("select exam_tag, array_agg(tipo order by tipo) as tipos from trilha_planos group by exam_tag");
    const m = Object.fromEntries(r.rows.map((x) => [x.exam_tag, x.tipos]));
    assert.ok(m.cn.includes("anual") && m.cn.includes("reta_final"));
    for (const t of ["epcar", "espcex", "esa", "eear"]) {
      assert.ok(m[t]?.includes("anual"), `${t} tem trilha anual`);
      assert.ok(m[t]?.includes("reta_final"), `${t} tem reta final`);
    }
  });
});

test("toda missão carrega exam_tag e nível (anti-furo e nivelamento na própria linha)", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query("select count(*)::int as n from missoes where exam_tag is null or nivel is null");
    assert.equal(r.rows[0].n, 0);
    // a missão de Física é da EEAR — e não aparece para CN
    const fis = await c.query("select exam_tag from missoes where materia_codigo='fis'");
    assert.ok(fis.rows.every((x) => x.exam_tag === "eear"), "missão de Física é só da EEAR");
  });
});

test("missão liga a assunto quando aplicável (Geometria Plana do CN)", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query(
      "select m.nome, a.nome as assunto from missoes m join assuntos a on a.id = m.assunto_id where m.exam_tag='cn' and m.materia_codigo='mat'"
    );
    assert.ok(r.rows.some((x) => /Geometria Plana/.test(x.assunto)));
  });
});

test("planos e missões são GLOBAIS: a escola B lê igual à A", async () => {
  for (const id of [IDS.coordA, IDS.coordB]) {
    await como(id, async (c) => {
      const planos = await c.query("select count(*)::int as n from trilha_planos");
      const missoes = await c.query("select count(*)::int as n from missoes");
      assert.ok(planos.rows[0].n >= 12 && missoes.rows[0].n >= 8, "conteúdo global visível para todas as escolas");
    });
  }
});

test("escrita em missão/plano é negada ao usuário logado (só o operador escreve)", async () => {
  await como(IDS.coordA, async (c) => {
    await esperaErro(c, /row-level security/i, "insert into trilha_planos (exam_tag, tipo, nome) values ('cn','anual','Hack')");
    await esperaErro(c, /row-level security/i,
      "insert into missoes (exam_tag, materia_codigo, nivel, nome, objetivo, criterio_conclusao) values ('cn','mat','base','Hack','x','y')");
  });
});

test("ajuste de missão da escola: A lê o próprio override (com desvio sinalizado), e não o de B", async () => {
  await como(IDS.coordA, async (c) => {
    const r = await c.query("select qtd_questoes, desvio_do_edital from missoes_escola where missao_id=$1 and escola_id=$2", [MISSAO_CRASE, ESCOLA_A]);
    assert.equal(r.rows.length, 1);
    assert.equal(r.rows[0].qtd_questoes, 60);
    assert.equal(r.rows[0].desvio_do_edital, true);
  });
  await como(IDS.coordB, async (c) => {
    const r = await c.query("select count(*)::int as n from missoes_escola");
    assert.equal(r.rows[0].n, 0, "a escola B não enxerga o override da A");
  });
});

test("config OFICIAL preservada: o override NÃO altera a missão global", async () => {
  await como(IDS.coordA, async (c) => {
    const r = await c.query("select qtd_questoes_sugerida from missoes where id=$1", [MISSAO_CRASE]);
    assert.equal(r.rows[0].qtd_questoes_sugerida, 40, "a missão oficial continua com 40 (o desvio é só da escola)");
  });
});

test("ajuste de missão: coordenação A escreve o próprio; tenant forjado de B é recusado", async () => {
  await como(IDS.coordA, async (c) => {
    await c.query(
      "insert into missoes_escola (escola_id, missao_id, ativa, qtd_questoes, desvio_do_edital, ajustado_por) values ($1,$2,true,80,true,$3) on conflict (escola_id, missao_id) do update set qtd_questoes=excluded.qtd_questoes",
      [ESCOLA_A, "a1000000-0000-4000-8000-000000000001", IDS.coordA.sub]
    );
    await esperaErro(c, /row-level security/i,
      "insert into missoes_escola (escola_id, missao_id, ativa) values ($1, $2, true)",
      [ESCOLA_B, "a1000000-0000-4000-8000-000000000001"]);
  });
});

test("aluno lê os ajustes de missão da própria escola, mas não escreve", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query("select count(*)::int as n from missoes_escola where escola_id=$1", [ESCOLA_A]);
    assert.ok(r.rows[0].n >= 1, "o aluno vê o ajuste que vale para ele");
    await esperaErro(c, /row-level security/i,
      "insert into missoes_escola (escola_id, missao_id, ativa) values ($1, $2, false)",
      [ESCOLA_A, MISSAO_CRASE]);
  });
});
