// ============================================================
// RECORRÊNCIA E TAGUEAMENTO (Fase 15.7) — banco e RLS
// ------------------------------------------------------------
// Estrutura de provas anteriores + tagueamento + recorrência nos
// três graus; a view de recorrência MEDIDA conta o tagueamento real;
// tudo é conteúdo GLOBAL (leitura por todos, escrita só do operador).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, esperaErro, IDS } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const GEOMETRIA = "90000000-0000-4000-8000-000000000006";

test("prova anterior do CN existe e está tagueada por assunto", async () => {
  await como(IDS.alunoA, async (c) => {
    const p = await c.query("select ano, etapa from provas_anteriores where exam_tag='cn'");
    assert.ok(p.rows.some((x) => x.ano === 2024));
    const q = await c.query("select count(*)::int as n from questoes_prova where assunto_id=$1", [GEOMETRIA]);
    assert.equal(q.rows[0].n, 2, "2 questões tagueadas em Geometria Plana");
  });
});

test("os TRÊS graus de confiança coexistem e a estimada fica separada da medida", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query("select tipo, pct_materia, num_questoes from recorrencia_assunto where assunto_id=$1 order by tipo", [GEOMETRIA]);
    const tipos = r.rows.map((x) => x.tipo);
    assert.ok(tipos.includes("estimada") && tipos.includes("medida"));
    const est = r.rows.find((x) => x.tipo === "estimada");
    const med = r.rows.find((x) => x.tipo === "medida");
    assert.equal(Number(est.pct_materia), 25, "estimada: 25% (preliminar)");
    assert.equal(med.num_questoes, 2, "medida: 2 questões reais");
  });
});

test("a view de recorrência MEDIDA conta o tagueamento ao vivo", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query("select num_questoes_medidas, provas_cobertas from vw_recorrencia_medida where assunto_id=$1", [GEOMETRIA]);
    assert.equal(r.rows[0].num_questoes_medidas, 2);
    assert.equal(r.rows[0].provas_cobertas, 1);
  });
});

test("estrutura de recorrência é GLOBAL: a escola B lê igual à A", async () => {
  await como(IDS.coordB, async (c) => {
    const pa = await c.query("select count(*)::int as n from provas_anteriores");
    const rec = await c.query("select count(*)::int as n from recorrencia_assunto");
    assert.ok(pa.rows[0].n >= 1 && rec.rows[0].n >= 2);
  });
});

test("escrita no tagueamento/recorrência é negada ao usuário logado (só o operador)", async () => {
  await como(IDS.coordA, async (c) => {
    await esperaErro(c, /row-level security/i, "insert into provas_anteriores (exam_tag, ano) values ('cn', 2025)");
    await esperaErro(c, /row-level security/i,
      "insert into recorrencia_assunto (exam_tag, materia_codigo, tipo) values ('cn','mat','estimada')");
    await esperaErro(c, /row-level security/i,
      "insert into questoes_prova (prova_anterior_id, materia_codigo) values ('d1000000-0000-4000-8000-000000000001','mat')");
  });
});

test("a recorrência referencia assuntos reais (FK preserva integridade)", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query(
      "select count(*)::int as n from recorrencia_assunto ra join assuntos a on a.id = ra.assunto_id where ra.exam_tag='cn'"
    );
    assert.ok(r.rows[0].n >= 2, "as linhas de recorrência apontam para assuntos existentes");
  });
});
