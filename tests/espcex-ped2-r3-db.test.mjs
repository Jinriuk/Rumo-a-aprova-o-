// PED2-R3 — catálogo, tagueamento real, recorrência medida e RLS da EsPCEx.
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, esperaErro, IDS } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const SUPER_ADMIN = {
  sub: "dddddddd-0000-4000-8000-000000000001",
  escola_id: null,
  papel: "super_admin",
};

test("PED2-R3: catálogo EsPCEx cobre 80 assuntos nas 8 matérias e zera 'validar'", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query(`
      select materia_codigo, count(*)::int n
        from assuntos where exam_tag='espcex'
       group by materia_codigo order by materia_codigo
    `);
    assert.deepEqual(Object.fromEntries(r.rows.map((x) => [x.materia_codigo, x.n])), {
      fis: 5, geo: 8, his: 17, ing: 2, mat: 17, por: 9, qui: 18, red: 4,
    });
    const statusAssuntos = await c.query(`
      select count(*) filter (where status_dado='oficial')::int oficiais,
             count(*) filter (where status_dado<>'oficial')::int outros
        from assuntos where exam_tag='espcex'
    `);
    assert.deepEqual(statusAssuntos.rows[0], { oficiais: 80, outros: 0 });
    const sub = await c.query(`
      select count(*)::int n,
             count(*) filter (where s.status_dado='oficial')::int oficiais,
             count(*) filter (where s.status_dado='inferencia')::int inferencias
        from subassuntos s join assuntos a on a.id=s.assunto_id
       where a.exam_tag='espcex'
    `);
    assert.deepEqual(sub.rows[0], { n: 339, oficiais: 7, inferencias: 332 });
  });
});

test("PED2-R3: quatro cadernos oficiais de 2024–2025 têm 200 questões", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query(`
      select pa.ano, pa.etapa, pa.status_dado, length(pa.fonte) > 0 fonte_ok, count(q.id)::int n
        from provas_anteriores pa
        left join questoes_prova q on q.prova_anterior_id=pa.id
       where pa.exam_tag='espcex' and pa.ano in (2024, 2025)
       group by pa.id, pa.ano, pa.etapa, pa.status_dado, pa.fonte
       order by pa.ano, pa.etapa
    `);
    assert.deepEqual(r.rows.map((x) => x.n).sort((a, b) => a - b), [44, 44, 56, 56]);
    assert.ok(r.rows.every((x) => x.status_dado === "oficial" && x.fonte_ok));
    assert.equal(r.rows.reduce((n, x) => n + x.n, 0), 200);
    assert.deepEqual(
      Object.fromEntries([2024, 2025].map((ano) => [ano, r.rows.filter((x) => x.ano === ano).reduce((n, x) => n + x.n, 0)])),
      { 2024: 100, 2025: 100 },
    );

    const anuladas = await c.query(`
      select q.numero, q.materia_codigo
        from questoes_prova q join provas_anteriores pa on pa.id=q.prova_anterior_id
       where pa.exam_tag='espcex' and q.gabarito='ANULADA'
    `);
    assert.deepEqual(anuladas.rows, [{ numero: 2, materia_codigo: "por" }]);
  });
});

test("PED2-R3: toda questão aponta para assunto/subassunto da mesma EsPCEx e matéria", async () => {
  await como(IDS.respA, async (c) => {
    const r = await c.query(`
      select count(*)::int n
        from questoes_prova q
        join provas_anteriores pa on pa.id=q.prova_anterior_id
        left join assuntos a on a.id=q.assunto_id
        left join subassuntos s on s.id=q.subassunto_id and s.assunto_id=a.id
       where pa.exam_tag='espcex'
         and (a.id is null or s.id is null or a.exam_tag<>pa.exam_tag or a.materia_codigo<>q.materia_codigo)
    `);
    assert.equal(r.rows[0].n, 0);
  });
});

test("PED2-R3: 69 recorrências medidas batem com o tagueamento de dois anos", async () => {
  await como(IDS.coordA, async (c) => {
    const r = await c.query(`
      with tags as (
        select q.assunto_id, count(*)::int n
          from questoes_prova q join provas_anteriores pa on pa.id=q.prova_anterior_id
         where pa.exam_tag='espcex'
         group by q.assunto_id
      )
      select count(*)::int total,
             count(*) filter (where t.assunto_id is null or ra.num_questoes<>t.n)::int divergentes
        from recorrencia_assunto ra
        left join tags t on t.assunto_id=ra.assunto_id
       where ra.exam_tag='espcex' and ra.tipo='medida'
    `);
    assert.deepEqual(r.rows[0], { total: 69, divergentes: 0 });

    const anos = await c.query(`
      select min(anos)::int minimo, max(anos)::int maximo,
             count(*) filter (where pct_materia < 0 or pct_materia > 100)::int pct_invalidos
        from recorrencia_assunto
       where exam_tag='espcex' and tipo='medida'
    `);
    assert.deepEqual(anos.rows[0], { minimo: 1, maximo: 2, pct_invalidos: 0 });

    const status = await c.query(`
      select valor, status_dado from config_oficial
       where exam_tag='espcex' and chave='recorrencia_status'
    `);
    assert.deepEqual(status.rows[0], {
      valor: { anos: [2024, 2025], medida: true, questoes: 200 },
      status_dado: "oficial",
    });

    const semBase = await c.query(`
      select count(*)::int n
        from recorrencia_assunto ra
       where ra.exam_tag='espcex' and ra.tipo in ('medida','validada')
         and not exists (
           select 1 from questoes_prova q
           join provas_anteriores pa on pa.id=q.prova_anterior_id
           where pa.exam_tag=ra.exam_tag and q.assunto_id=ra.assunto_id
         )
    `);
    assert.equal(semBase.rows[0].n, 0);
  });
});

test("PED2-R3: painel global lê os mesmos 200/69 dados nos quatro perfis", async () => {
  for (const perfil of [IDS.alunoA, IDS.respA, IDS.coordA, SUPER_ADMIN]) {
    await como(perfil, async (c) => {
      const r = await c.query(`
        select
          (select count(*)::int from questoes_prova q join provas_anteriores pa on pa.id=q.prova_anterior_id where pa.exam_tag='espcex') questoes,
          (select count(*)::int from recorrencia_assunto where exam_tag='espcex' and tipo='medida') medidas
      `);
      assert.deepEqual(r.rows[0], { questoes: 200, medidas: 69 }, `perfil ${perfil.papel}`);
    });
  }
});

test("PED2-R3: catálogo aponta para o edital vigente de 2026", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query(`
      select count(*)::int n
        from assuntos
       where exam_tag='espcex'
         and observacao like '%Edital nº 2 S Conc Adms, de 22 de abril de 2026%'
         and observacao like '%in.gov.br%'
    `);
    assert.equal(r.rows[0].n, 80);
  });
});

test("PED2-R3: referências são curtas e escrita segue exclusiva do operador", async () => {
  await como(IDS.coordA, async (c) => {
    const tamanho = await c.query(`
      select max(length(q.observacao))::int maximo
        from questoes_prova q join provas_anteriores pa on pa.id=q.prova_anterior_id
       where pa.exam_tag='espcex'
    `);
    assert.ok(tamanho.rows[0].maximo <= 180, "não há enunciado completo no tagueamento");

    const pa = await c.query("select id from provas_anteriores where exam_tag='espcex' limit 1");
    await esperaErro(c, /row-level security/i,
      "insert into questoes_prova (prova_anterior_id, numero, materia_codigo) values ($1, 999, 'mat')",
      [pa.rows[0].id]);
  });
});
