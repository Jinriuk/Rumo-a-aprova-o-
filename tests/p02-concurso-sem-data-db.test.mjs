// ============================================================
// P0.2 (0062) — concurso sem data de prova e maturidade 'pre_edital'
// ------------------------------------------------------------
// Seção 12 de docs/conteudo/pmerj-cfo/PMERJ_CFO_Desenho_da_Trilha_e_
// Auditoria_do_Banco.md, lado banco:
//   • "Concurso sem data confirmada": o catálogo aceita o concurso sem
//     mês/dia, mas nunca com só metade da data.
//   • "Fonte histórica / prontidão operacional": 'pre_edital' é um
//     valor aceito, e a view de auditoria cobra assunto catalogado dele.
// E a garantia de "os outros concursos não mudam": as datas e a
// maturidade dos seis concursos do seed ficam como estavam.
// Tudo dentro de transação desfeita no fim: nada fica no banco.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, comoServidor, esperaErro } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

async function emTransacao(fn) {
  return comoServidor(async (c) => {
    await c.query("begin");
    try { return await fn(c); } finally { await c.query("rollback"); }
  });
}

const inserir = (codigo, mes, dia, maturidade = "indisponivel") => [
  `insert into concursos (codigo, nome, organizacao, nivel, mes_prova, dia_prova, maturidade)
     values ($1, 'Teste P0.2', 'Teste', 'superior', $2, $3, $4)`,
  [codigo, mes, dia, maturidade],
];

test("concurso sem data: mês e dia vazios juntos são aceitos", async () => {
  await emTransacao(async (c) => {
    await c.query(...inserir("p02_sem_data", null, null));
    const r = await c.query("select mes_prova, dia_prova from concursos where codigo = 'p02_sem_data'");
    assert.deepEqual(r.rows[0], { mes_prova: null, dia_prova: null });
  });
});

test("concurso sem data: só o mês ou só o dia é recusado", async () => {
  await emTransacao(async (c) => {
    const [sql] = inserir("x", null, null);
    await esperaErro(c, /concursos_data_prova_par/, sql, ["p02_so_mes", 10, null, "indisponivel"]);
    await esperaErro(c, /concursos_data_prova_par/, sql, ["p02_so_dia", null, 5, "indisponivel"]);
  });
});

test("concurso sem data: apagar metade da data de um concurso existente é recusado", async () => {
  await emTransacao(async (c) => {
    await esperaErro(c, /concursos_data_prova_par/, "update concursos set dia_prova = null where codigo = 'cn'");
  });
});

test("concurso com data: as faixas da 0007 continuam valendo", async () => {
  await emTransacao(async (c) => {
    const [sql] = inserir("x", null, null);
    await esperaErro(c, /mes_prova_check/, sql, ["p02_mes13", 13, 1, "indisponivel"]);
    await esperaErro(c, /dia_prova_check/, sql, ["p02_dia0", 1, 0, "indisponivel"]);
  });
});

test("maturidade 'pre_edital' é aceita; valor fora da lista continua recusado", async () => {
  await emTransacao(async (c) => {
    await c.query(...inserir("p02_pre", null, null, "pre_edital"));
    const [sql] = inserir("x", null, null);
    await esperaErro(c, /concursos_maturidade_check/, sql, ["p02_inventado", null, null, "provisorio"]);
  });
});

test("vw_concurso_qualidade: 'pre_edital' sem assunto é suspeita de incoerência", async () => {
  await emTransacao(async (c) => {
    await c.query(...inserir("p02_pre_vazio", null, null, "pre_edital"));
    const r = await c.query("select suspeita_incoerencia from vw_concurso_qualidade where codigo = 'p02_pre_vazio'");
    assert.equal(r.rows[0].suspeita_incoerencia, true);
  });
});

test("os seis concursos do seed mantêm data e maturidade", async () => {
  const r = await pool.query(
    "select codigo, mes_prova, dia_prova, maturidade from concursos where codigo = any($1) order by codigo",
    [["cm", "cn", "eear", "epcar", "esa", "espcex"]],
  );
  assert.deepEqual(r.rows, [
    { codigo: "cm", mes_prova: 10, dia_prova: 25, maturidade: "indisponivel" },
    { codigo: "cn", mes_prova: 8, dia_prova: 1, maturidade: "completa" },
    { codigo: "eear", mes_prova: 11, dia_prova: 16, maturidade: "esqueleto" },
    { codigo: "epcar", mes_prova: 6, dia_prova: 28, maturidade: "esqueleto" },
    { codigo: "esa", mes_prova: 10, dia_prova: 1, maturidade: "esqueleto" },
    { codigo: "espcex", mes_prova: 9, dia_prova: 28, maturidade: "completa" },
  ]);
});
