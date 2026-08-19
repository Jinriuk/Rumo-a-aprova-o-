// Calendário semanal, missões e RLS da EsPCEx no PostgreSQL real.
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, esperaErro, IDS } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

test("trilha EsPCEx publicada tem 9 semanas, 109 atividades e datas oficiais", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query(`
      select t.nicho, t.publicada,
             count(distinct s.id)::int semanas,
             count(distinct a.id)::int atividades,
             min(s.inicio)::text inicio,
             max(s.fim)::text fim
        from trilhas t
        join trilha_semanas s on s.trilha_id=t.id
        join atividades_modelo a on a.trilha_id=t.id
       where t.nicho='espcex' and t.versao=1
       group by t.id, t.nicho, t.publicada
    `);
    assert.deepEqual(r.rows[0], {
      nicho: "espcex", publicada: true, semanas: 9, atividades: 109,
      inicio: "2026-07-13", fim: "2026-09-13",
    });
  });
});

test("trilha EsPCEx cobre as 9 disciplinas e nenhuma semana fica vazia", async () => {
  await como(IDS.coordA, async (c) => {
    const disciplinas = await c.query(`
      select d.codigo
        from disciplinas d join trilhas t on t.id=d.trilha_id
       where t.nicho='espcex' and t.versao=1 order by d.ordem
    `);
    assert.deepEqual(disciplinas.rows.map((x) => x.codigo), ["por", "red", "fis", "qui", "mat", "geo", "his", "ing", "prov"]);

    const vazias = await c.query(`
      select count(*)::int n
        from trilha_semanas s join trilhas t on t.id=s.trilha_id
       where t.nicho='espcex'
         and not exists (
           select 1 from atividades_modelo a
            where a.trilha_id=s.trilha_id and a.semana_numero=s.numero
         )
    `);
    assert.equal(vazias.rows[0].n, 0);
  });
});

test("EsPCEx tem 24 missões, três por área, quatro planos e 96 vínculos", async () => {
  await como(IDS.respA, async (c) => {
    const missoes = await c.query(`
      select materia_codigo, count(*)::int n
        from missoes where exam_tag='espcex'
       group by materia_codigo order by materia_codigo
    `);
    assert.deepEqual(Object.fromEntries(missoes.rows.map((x) => [x.materia_codigo, x.n])), {
      fis: 3, geo: 3, his: 3, ing: 3, mat: 3, por: 3, qui: 3, red: 3,
    });

    const estrutura = await c.query(`
      select
        (select count(*)::int from trilha_planos where exam_tag='espcex') planos,
        (select count(*)::int
           from trilha_plano_missoes pm
           join trilha_planos p on p.id=pm.plano_id
          where p.exam_tag='espcex') vinculos,
        (select count(*)::int from missoes where exam_tag='espcex' and assunto_id is null) sem_assunto
    `);
    assert.deepEqual(estrutura.rows[0], { planos: 4, vinculos: 96, sem_assunto: 0 });
  });
});

test("conteúdo semanal EsPCEx é global de leitura e exclusivo do operador para escrita", async () => {
  await como(IDS.coordA, async (c) => {
    const trilha = await c.query("select id from trilhas where nicho='espcex' and versao=1");
    assert.equal(trilha.rowCount, 1);
    await esperaErro(c, /row-level security/i,
      "insert into trilha_semanas (trilha_id, numero, inicio, fim, foco) values ($1, 99, current_date, current_date, 'indevido')",
      [trilha.rows[0].id]);
  });
});
