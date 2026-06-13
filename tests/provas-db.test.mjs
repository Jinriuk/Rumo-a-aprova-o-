// ============================================================
// ESTRUTURA DE PROVA (Fase 15.2) — banco e RLS
// ------------------------------------------------------------
// Prova que a estrutura cadastrada é fiel ao doc, que CN/EPCAR e
// ESA/EEAR ficam SEPARADOS, que os obrigatórios estão presentes
// (Biologia no CN, Literatura na EsPCEx), que o status do dado é
// preservado, e que tudo é conteúdo GLOBAL (leitura por qualquer
// escola, escrita só do operador — authenticated não escreve).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, esperaErro, IDS } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

test("nº de questões objetivas por concurso bate com o doc", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query(
      "select exam_tag, coalesce(sum(num_questoes),0)::int as q, count(*) filter (where eh_redacao) as redacoes from prova_materias group by exam_tag"
    );
    const m = Object.fromEntries(r.rows.map((x) => [x.exam_tag, x]));
    assert.equal(m.cn.q, 90, "CN tem 90 questões objetivas");
    assert.equal(m.epcar.q, 48, "EPCAR tem 48");
    assert.equal(m.espcex.q, 100, "EsPCEx tem 100");
    assert.equal(m.essa.q, 50, "ESA tem 50");
    assert.equal(m.eear.q, 96, "EEAR tem 96");
    // redação existe em todos menos EEAR
    assert.equal(Number(m.eear.redacoes), 0, "EEAR não tem redação");
    for (const t of ["cn", "epcar", "espcex", "essa"]) assert.equal(Number(m[t].redacoes), 1, `${t} tem redação`);
  });
});

test("Biologia é matéria do CN — e NÃO do EPCAR (concursos separados na mesma turma)", async () => {
  await como(IDS.alunoA, async (c) => {
    const cn = await c.query("select num_questoes from prova_materias where exam_tag='cn' and materia_codigo='bio'");
    assert.equal(cn.rows.length, 1);
    assert.equal(cn.rows[0].num_questoes, 6);
    const epcar = await c.query("select 1 from prova_materias where exam_tag='epcar' and materia_codigo='bio'");
    assert.equal(epcar.rows.length, 0, "EPCAR não cobra Biologia");
  });
});

test("ESA e EEAR têm estruturas distintas (não se misturam na turma ESA/EEAR)", async () => {
  await como(IDS.alunoA, async (c) => {
    const esa = await c.query("select array_agg(materia_codigo order by materia_codigo) as m from prova_materias where exam_tag='essa'");
    const eear = await c.query("select array_agg(materia_codigo order by materia_codigo) as m from prova_materias where exam_tag='eear'");
    assert.deepEqual(esa.rows[0].m, ["geo", "his", "ing", "mat", "por", "red"]);
    assert.deepEqual(eear.rows[0].m, ["fis", "ing", "mat", "por"]);
    assert.notDeepEqual(esa.rows[0].m, eear.rows[0].m);
  });
});

test("EsPCEx isolado: pesos oficiais (Mat/Port 2,0; Física/Inglês 1,5; Química/Hist/Geo 1,0)", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query("select materia_codigo, peso from prova_materias where exam_tag='espcex' and not eh_redacao");
    const peso = Object.fromEntries(r.rows.map((x) => [x.materia_codigo, Number(x.peso)]));
    assert.equal(peso.mat, 2.0);
    assert.equal(peso.por, 2.0);
    assert.equal(peso.fis, 1.5);
    assert.equal(peso.ing, 1.5);
    assert.equal(peso.qui, 1.0);
    assert.equal(peso.his, 1.0);
    assert.equal(peso.geo, 1.0);
  });
});

test("Literatura Brasileira é assunto da EsPCEx, com subassuntos do Quinhentismo às contemporâneas", async () => {
  await como(IDS.alunoA, async (c) => {
    const a = await c.query("select id, status_dado from assuntos where exam_tag='espcex' and materia_codigo='por' and nome='Literatura Brasileira'");
    assert.equal(a.rows.length, 1);
    const subs = await c.query("select count(*)::int as n from subassuntos where assunto_id=$1", [a.rows[0].id]);
    assert.ok(subs.rows[0].n >= 5, "Literatura tem o arco de subassuntos catalogado");
  });
});

test("Biologia do CN traz os 5 assuntos do programa catalogado", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query("select nome from assuntos where exam_tag='cn' and materia_codigo='bio' order by ordem");
    assert.deepEqual(r.rows.map((x) => x.nome), ["Citologia", "Genética e Evolução", "Ecologia", "Fisiologia Humana", "Saúde Pública"]);
  });
});

test("o status do dado é preservado: a dúvida de OCR da Química EsPCEx está como 'validar'", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query("select status_dado, observacao from assuntos where exam_tag='espcex' and materia_codigo='qui' and nome like 'Eletro%'");
    assert.equal(r.rows[0].status_dado, "validar");
    assert.match(r.rows[0].observacao, /OCR/i);
  });
});

test("estrutura é conteúdo GLOBAL: a escola B lê igual à A", async () => {
  for (const id of [IDS.coordA, IDS.coordB]) {
    await como(id, async (c) => {
      const r = await c.query("select count(*)::int as n from prova_materias");
      assert.ok(r.rows[0].n >= 30, "todas as escolas leem a mesma estrutura global");
    });
  }
});

test("escrita na estrutura é negada ao usuário logado (só o operador/service_role escreve)", async () => {
  await como(IDS.coordA, async (c) => {
    await esperaErro(c, /row-level security/i, "insert into materias (codigo, nome, abrev) values ('hack','Hack','Hk')");
    await esperaErro(c, /row-level security/i, "insert into provas (exam_tag, nome) values ('cn','Hack')");
    await esperaErro(c, /row-level security/i, "insert into assuntos (exam_tag, materia_codigo, nome) values ('cn','mat','Hack')");
  });
});
