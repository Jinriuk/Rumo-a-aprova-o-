// ============================================================
// GAMIFICAÇÃO (Fase 15.5) — banco e RLS
// ------------------------------------------------------------
// Catálogo (patentes/conquistas) é global; o progresso (XP e
// conquistas do aluno) é isolado por escola e travado no exam_tag.
// O aluno LÊ o próprio XP mas NÃO se autopontua; o responsável lê o
// vinculado; o catálogo não é gravável pelo usuário logado.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, esperaErro, IDS, ESCOLA_A, ESCOLA_B, ALUNO_LUCAS, ALUNO_BRUNO } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

test("catálogo de patentes é global e ordenado por XP (Recruta → Aspirante)", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query("select codigo, xp_necessario from patentes order by ordem");
    assert.ok(r.rows.length >= 8);
    assert.equal(r.rows[0].codigo, "recruta");
    assert.equal(Number(r.rows[0].xp_necessario), 0);
    // XP estritamente crescente
    for (let i = 1; i < r.rows.length; i++) {
      assert.ok(Number(r.rows[i].xp_necessario) > Number(r.rows[i - 1].xp_necessario), "XP cumulativo cresce");
    }
  });
});

test("conquistas cobrem os tipos pedidos (constância, volume, simulado, corte, recuperação...)", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query("select distinct tipo from conquistas");
    const tipos = r.rows.map((x) => x.tipo);
    for (const t of ["constancia", "volume", "desempenho", "simulado", "materia", "evolucao", "reta_final", "corte", "recuperacao"]) {
      assert.ok(tipos.includes(t), `falta conquista do tipo ${t}`);
    }
  });
});

test("conquista de volume só vale COM acurácia (critério antigaming no dado)", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query("select criterio from conquistas where tipo = 'volume' limit 1");
    assert.ok(r.rows[0].criterio.acuracia_min >= 1, "a conquista de volume carrega um piso de acurácia");
  });
});

test("catálogo é GLOBAL: escola B lê patentes e conquistas igual à A", async () => {
  await como(IDS.coordB, async (c) => {
    const p = await c.query("select count(*)::int as n from patentes");
    const q = await c.query("select count(*)::int as n from conquistas");
    assert.ok(p.rows[0].n >= 8 && q.rows[0].n >= 9);
  });
});

test("catálogo não é gravável pelo usuário logado (só o operador escreve)", async () => {
  await como(IDS.coordA, async (c) => {
    await esperaErro(c, /row-level security/i, "insert into patentes (codigo, nome, xp_necessario, ordem) values ('hack','Hack',0,99)");
    await esperaErro(c, /row-level security/i, "insert into conquistas (codigo, nome, tipo, descricao) values ('hack','Hack','volume','x')");
  });
});

test("XP do aluno é travado no exam_tag e a coordenação lê o total da própria escola", async () => {
  await como(IDS.coordA, async (c) => {
    const r = await c.query("select coalesce(sum(pontos),0)::int as xp from aluno_xp_eventos where aluno_id=$1 and exam_tag='cn'", [ALUNO_LUCAS]);
    assert.equal(r.rows[0].xp, 350, "100+60+150+40 do seed");
  });
});

test("isolamento: a escola A não enxerga o XP da escola B (nem o segredo do Bruno)", async () => {
  await como(IDS.coordA, async (c) => {
    const r = await c.query("select count(*)::int as n from aluno_xp_eventos where escola_id=$1", [ESCOLA_B]);
    assert.equal(r.rows[0].n, 0);
    const seg = await c.query("select count(*)::int as n from aluno_xp_eventos where descricao like 'SEGREDO%'");
    assert.equal(seg.rows[0].n, 0);
  });
});

test("o aluno LÊ o próprio XP e conquistas, mas NÃO se autopontua", async () => {
  await como(IDS.alunoA, async (c) => {
    const xp = await c.query("select count(*)::int as n from aluno_xp_eventos where aluno_id=$1", [ALUNO_LUCAS]);
    assert.ok(xp.rows[0].n >= 1);
    const conq = await c.query("select count(*)::int as n from aluno_conquistas where aluno_id=$1", [ALUNO_LUCAS]);
    assert.ok(conq.rows[0].n >= 1, "o aluno vê a medalha desbloqueada");
    await esperaErro(c, /row-level security/i,
      "insert into aluno_xp_eventos (escola_id, aluno_id, exam_tag, origem, pontos) values ($1,$2,'cn','ajuste_manual',9999)",
      [ESCOLA_A, ALUNO_LUCAS]);
  });
});

test("a coordenação concede XP na própria escola; tenant forjado de B é recusado", async () => {
  await como(IDS.coordA, async (c) => {
    await c.query("insert into aluno_xp_eventos (escola_id, aluno_id, exam_tag, origem, pontos, concedido_por) values ($1,$2,'cn','missao',30,$3)",
      [ESCOLA_A, ALUNO_LUCAS, IDS.coordA.sub]);
    await esperaErro(c, /row-level security/i,
      "insert into aluno_xp_eventos (escola_id, aluno_id, exam_tag, origem, pontos) values ($1,$2,'cn','missao',30)",
      [ESCOLA_B, ALUNO_BRUNO]);
  });
});

test("o responsável lê o XP do aluno vinculado; não lê o de não-vinculado", async () => {
  await como(IDS.respA, async (c) => {
    const ok = await c.query("select count(*)::int as n from aluno_xp_eventos where aluno_id=$1", [ALUNO_LUCAS]);
    assert.ok(ok.rows[0].n >= 1);
    const nao = await c.query("select count(*)::int as n from aluno_xp_eventos where aluno_id=$1", [ALUNO_BRUNO]);
    assert.equal(nao.rows[0].n, 0);
  });
});
