// ============================================================
// CALENDÁRIO ROLANTE DA TRILHA DO CN (seed 02)
// ------------------------------------------------------------
// O seed de demonstração vencia sozinho: as 9 semanas tinham datas
// fixas (30/05 a 01/08/2026) e, passada a última, o aluno da vitrine
// ficava sem meta ativa — painel vazio e prova de isolamento caindo
// por motivo que não era isolamento.
//
// Agora o seed ancora a semana 3 da trilha na semana corrente de
// America/Sao_Paulo, sem tocar no conteúdo: 9 semanas, as mesmas
// atividades, os mesmos ids. Este arquivo prova isso SEM data escrita
// à mão — se alguém congelar o calendário de novo, ele cai.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, comoServidor, IDS, ALUNO_LUCAS } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const CN = `(select id from trilhas where nicho = 'colegio-naval' and versao = 1)`;

test("existe exatamente UMA semana da trilha cobrindo hoje (data local do Brasil)", async () => {
  await como(IDS.alunoA, async (c) => {
    const r = await c.query(
      `select numero from trilha_semanas
        where trilha_id = ${CN} and app.hoje_local() between inicio and fim`,
    );
    assert.equal(r.rows.length, 1, "a trilha do CN precisa cobrir o dia de hoje");
    assert.equal(r.rows[0].numero, 3, "a âncora do seed é a semana 3");
  });
});

test("a semana corrente é a semana ISO de hoje em America/Sao_Paulo (segunda a domingo)", async () => {
  await comoServidor(async (c) => {
    // a aritmética de datas fica no BANCO: dia de JS depende do fuso do
    // runner, e é justamente fuso que este teste está guardando.
    const r = await c.query(
      `select s.inicio = date_trunc('week', app.hoje_local())::date as comeca_na_segunda,
              (s.fim - s.inicio) as dias
         from trilha_semanas s
        where s.trilha_id = ${CN} and app.hoje_local() between s.inicio and s.fim`,
    );
    assert.equal(r.rows[0].comeca_na_segunda, true, "a semana ativa começa na segunda corrente");
    assert.equal(r.rows[0].dias, 6, "a semana ativa vai de segunda a domingo");
  });
});

test("o conteúdo continua o mesmo: 9 semanas contíguas, 50 atividades, ids estáveis", async () => {
  await comoServidor(async (c) => {
    const s = await c.query(
      `select numero,
              extract(isodow from inicio)::int as dow_inicio,
              extract(isodow from fim)::int    as dow_fim,
              (fim - inicio)                   as dias,
              (inicio - lag(fim) over (order by numero)) as depois_da_anterior
         from trilha_semanas where trilha_id = ${CN} order by numero`,
    );
    assert.deepEqual(s.rows.map((x) => x.numero), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    // sem buraco e sem sobreposição: cada semana começa no dia seguinte
    // ao fim da anterior (é o que a regra de virada assume)
    for (const linha of s.rows.slice(1)) {
      assert.equal(linha.depois_da_anterior, 1, `semana ${linha.numero} não encosta na anterior`);
    }
    // a forma autoral, preservada: a 1 abre no sábado (diagnóstico) e é
    // mais longa; a 9 fecha no sábado da prova; as do meio são segunda a
    // domingo (isodow: 1 = segunda, 6 = sábado, 7 = domingo)
    assert.equal(s.rows[0].dow_inicio, 6, "a semana 1 abre no sábado");
    assert.equal(s.rows[0].dias, 8, "a semana 1 é a longa do diagnóstico");
    assert.equal(s.rows[8].dow_fim, 6, "a semana 9 fecha no sábado da prova");
    for (const linha of s.rows.slice(1, 8)) {
      assert.equal(linha.dow_inicio, 1, `semana ${linha.numero} começa na segunda`);
      assert.equal(linha.dias, 6, `semana ${linha.numero} vai de segunda a domingo`);
    }

    const a = await c.query(
      `select count(*)::int as n from atividades_modelo where trilha_id = ${CN}`,
    );
    assert.equal(a.rows[0].n, 50, "as 50 atividades-modelo da trilha continuam lá");

    // id determinístico: quem gerar o seed de novo tem que cair no mesmo id
    const id3 = await c.query(
      `select id from trilha_semanas where trilha_id = ${CN} and numero = 3`,
    );
    assert.equal(id3.rows[0].id, "2f576da4-a778-45f4-8456-874c6cf9d01d");
  });
});

test("o seed entrega o aluno da vitrine com meta ATIVA hoje — sem virada manual", async () => {
  await comoServidor(async (c) => {
    const r = await c.query(
      `select semana_numero, inicio, fim from metas
        where aluno_id = $1 and status = 'ativa'`,
      [ALUNO_LUCAS],
    );
    assert.equal(r.rows.length, 1, "o aluno de demonstração tem meta ativa");
    const hoje = await c.query("select app.hoje_local() as h");
    assert.ok(
      r.rows[0].inicio <= hoje.rows[0].h && hoje.rows[0].h <= r.rows[0].fim,
      "a meta ativa cobre hoje",
    );
  });
});

test("aplicar o seed de novo não duplica semana nem cria trilha nova (idempotência)", async () => {
  await comoServidor(async (c) => {
    const t = await c.query("select count(*)::int as n from trilhas where nicho = 'colegio-naval'");
    assert.equal(t.rows[0].n, 1, "uma trilha de CN, não uma por execução do seed");
    const s = await c.query(`select count(*)::int as n from trilha_semanas where trilha_id = ${CN}`);
    assert.equal(s.rows[0].n, 9, "o reset roda o seed duas vezes: continuam 9 semanas");
  });
});
