// ============================================================
// ONDA 3 (0049) — ESTADO DO CICLO DE ESTUDO (A1 / A3)
// ------------------------------------------------------------
// O defeito, medido no demo em 13/09/2026: a trilha acabou em 01/08 e,
// 43 dias depois, 63 alunos continuavam vendo "MISSÃO 9, ATRASADA".
// 547 metas no banco, TODAS fechada, zero ativa; e toda virada desde
// então registrando 0 fechadas, 0 geradas, 0 erros — verde sobre um
// motor morto.
//
// A causa: app.semana_da_data devolve a ÚLTIMA semana para sempre
// depois do fim da trilha (0003, linha 40). gerar_meta_protegida achava
// a meta daquela semana já criada e respondia 'ja_tinha' — verdade que
// comunica a coisa errada, e que o heartbeat (0043) não tem como
// distinguir de "gerou tudo certo, nada a fazer hoje".
//
// Estes testes travam as duas pontas: que estado_ciclo SABE dizer que
// acabou, e que gerar_meta_protegida passou a DIZER que acabou.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, comoServidor } from "./identidades.mjs";
import { semanaCN, diaNaSemanaCN } from "./calendario-cn.mjs";

test.after(async () => { await pool.end(); });

const DIA_MS = 86400000;
const iso = (d) => new Date(d).toISOString().slice(0, 10);

const trilhaCN = (async () => {
  const r = await pool.query("select id from trilhas where nicho = 'colegio-naval' limit 1");
  if (!r.rows[0]) throw new Error("trilha do CN não encontrada no seed");
  return r.rows[0].id;
})();

const ultimaSemana = (async () => {
  const t = await trilhaCN;
  const r = await pool.query(
    "select numero, inicio::text as inicio, fim::text as fim from trilha_semanas where trilha_id = $1 order by numero desc limit 1",
    [t],
  );
  return r.rows[0];
})();

async function estado(c, data) {
  const r = await c.query("select * from app.estado_ciclo($1, $2::date)", [await trilhaCN, data]);
  return r.rows[0];
}

// ── app.estado_ciclo ─────────────────────────────────────────────────

test("estado_ciclo: data dentro da trilha → em_curso, na semana certa", async () => {
  const dia = await diaNaSemanaCN(3);
  await comoServidor(async (c) => {
    const e = await estado(c, dia);
    assert.equal(e.estado, "em_curso");
    assert.equal(e.semana_numero, 3);
  });
});

test("estado_ciclo: data antes do início → antes, apontando a 1ª semana", async () => {
  const s1 = await semanaCN(1);
  const antes = iso(new Date(s1.inicio).getTime() - 10 * DIA_MS);
  await comoServidor(async (c) => {
    const e = await estado(c, antes);
    assert.equal(e.estado, "antes");
    assert.equal(e.semana_numero, 1);
  });
});

// O TESTE DESTA ONDA. Antes da 0049 não havia como fazer esta pergunta.
test("estado_ciclo: data depois do fim → encerrado, sem semana", async () => {
  const u = await ultimaSemana;
  const depois = iso(new Date(u.fim).getTime() + 43 * DIA_MS); // os 43 dias reais do demo
  await comoServidor(async (c) => {
    const e = await estado(c, depois);
    assert.equal(e.estado, "encerrado", "passado o fim da trilha o ciclo está encerrado");
    assert.equal(e.semana_numero, null, "ciclo encerrado não tem semana corrente");
  });
});

test("estado_ciclo: o dia EXATO do fim ainda é em_curso (limite inclusivo)", async () => {
  const u = await ultimaSemana;
  await comoServidor(async (c) => {
    const e = await estado(c, u.fim);
    assert.equal(e.estado, "em_curso", "o último dia da trilha ainda conta como trilha");
    assert.equal(e.semana_numero, u.numero);
  });
});

test("estado_ciclo: trilha sem semanas → sem_semanas, não 'encerrado'", async () => {
  await comoServidor(async (c) => {
    await c.query("begin");
    try {
      const nova = await c.query(
        `insert into trilhas (nome, nicho, versao) values ('trilha vazia de teste', 'teste-onda3', 1) returning id`,
      );
      const r = await c.query("select * from app.estado_ciclo($1, current_date)", [nova.rows[0].id]);
      assert.equal(r.rows[0].estado, "sem_semanas",
        "trilha vazia é dado quebrado, não fim de ciclo — confundir os dois esconde erro de configuração");
      assert.equal(r.rows[0].semana_numero, null);
    } finally { await c.query("rollback"); }
  });
});

// Premissa do diagnóstico: o clamp de semana_da_data CONTINUA lá, de
// propósito. Se alguém "consertar" essa função direto, este teste cai e
// obriga a reler o cabeçalho da 0049 antes de mudar o comportamento de
// um caminho com outros chamadores.
test("semana_da_data segue grudando na última semana (clamp preservado de propósito)", async () => {
  const u = await ultimaSemana;
  const depois = iso(new Date(u.fim).getTime() + 43 * DIA_MS);
  await comoServidor(async (c) => {
    const r = await c.query("select (app.semana_da_data($1, $2::date)).numero as numero", [await trilhaCN, depois]);
    assert.equal(r.rows[0].numero, u.numero,
      "semana_da_data não mudou; quem sabe do fim do ciclo é estado_ciclo");
  });
});

// ── app.gerar_meta_protegida ─────────────────────────────────────────

test("gerar_meta_protegida: ciclo encerrado → 'ciclo_encerrado', e NÃO gera meta", async () => {
  const u = await ultimaSemana;
  const depois = iso(new Date(u.fim).getTime() + 43 * DIA_MS);
  const t = await trilhaCN;
  await comoServidor(async (c) => {
    await c.query("begin");
    try {
      const aluno = await c.query(
        "select id from alunos where trilha_id = $1 limit 1", [t],
      );
      const alunoId = aluno.rows[0].id;
      const antes = await c.query("select count(*)::int n from metas where aluno_id = $1", [alunoId]);

      const r = await c.query(
        "select * from app.gerar_meta_protegida($1, $2, $3::date)", [alunoId, t, depois],
      );
      assert.equal(r.rows[0].resultado, "ciclo_encerrado",
        "antes da 0049 isto devolvia 'ja_tinha' — indistinguível de sucesso, e foi o que deixou o heartbeat verde sobre um motor parado");
      assert.equal(r.rows[0].erro, null, "fim de ciclo não é erro");

      const dps = await c.query("select count(*)::int n from metas where aluno_id = $1", [alunoId]);
      assert.equal(dps.rows[0].n, antes.rows[0].n, "ciclo encerrado não cria meta nenhuma");
    } finally { await c.query("rollback"); }
  });
});

test("gerar_meta_protegida: dentro da trilha segue gerando e segue idempotente", async () => {
  const dia = await diaNaSemanaCN(3);
  const t = await trilhaCN;
  await comoServidor(async (c) => {
    await c.query("begin");
    try {
      const aluno = await c.query("select id from alunos where trilha_id = $1 limit 1", [t]);
      const alunoId = aluno.rows[0].id;
      await c.query("delete from metas where aluno_id = $1", [alunoId]);

      const um = await c.query("select * from app.gerar_meta_protegida($1, $2, $3::date)", [alunoId, t, dia]);
      assert.equal(um.rows[0].resultado, "gerada");

      const dois = await c.query("select * from app.gerar_meta_protegida($1, $2, $3::date)", [alunoId, t, dia]);
      assert.equal(dois.rows[0].resultado, "ja_tinha", "rodar duas vezes não duplica — comportamento da 0039 preservado");
    } finally { await c.query("rollback"); }
  });
});

// A virada global compara com 'gerada' e 'erro'. Os valores novos não
// são nem um nem outro e precisam cair no ramo neutro — senão um ciclo
// encerrado passaria a contar como aluno_com_erro e o alerta gritaria
// todo dia para 63 alunos cujo curso simplesmente acabou.
test("virar_semana: trilha encerrada não conta como erro nem como geração", async () => {
  const u = await ultimaSemana;
  const depois = iso(new Date(u.fim).getTime() + 43 * DIA_MS);
  await comoServidor(async (c) => {
    await c.query("begin");
    try {
      const r = await c.query("select * from app.virar_semana($1::date)", [depois]);
      const linha = r.rows[0];
      assert.equal(linha.alunos_com_erro, 0, "fim de ciclo não é erro de aluno");
      assert.equal(linha.metas_geradas, 0, "nada a gerar depois do fim da trilha");
    } finally { await c.query("rollback"); }
  });
});

// REGRESSÃO DA PRÓPRIA ONDA 3. A primeira versão da 0049 devolvia
// 'sem_semanas' aqui, em vez de 'erro'. Parecia melhor — nomear o caso
// em vez de tratá-lo como falha genérica — e desligava um alarme que
// funcionava: `virar_semana` deixaria de contar o aluno em
// alunos_com_erro e o heartbeat (0043) ficaria verde sobre uma trilha
// quebrada. Três testes pré-existentes pegaram. Este trava a lição no
// lugar certo, junto do código que a causou.
//
// A regra: ciclo encerrado e trilha vazia são OPOSTOS. Um é o curso
// tendo cumprido seu ciclo; o outro é configuração quebrada. Só o
// primeiro pode ser silencioso.
test("trilha sem semanas continua sendo ERRO, não um estado benigno", async () => {
  await comoServidor(async (c) => {
    await c.query("begin");
    try {
      const t = await c.query(
        "insert into trilhas (nome, nicho, versao) values ('trilha vazia onda3', 'teste-onda3-alarme', 1) returning id",
      );
      const a = await c.query(
        "insert into alunos (escola_id, nome, trilha_id) select escola_id, 'Aluno trilha vazia onda3', $1 from alunos limit 1 returning id",
        [t.rows[0].id],
      );
      const r = await c.query(
        "select * from app.gerar_meta_protegida($1, $2, current_date)", [a.rows[0].id, t.rows[0].id],
      );
      assert.equal(r.rows[0].resultado, "erro",
        "rebaixar isto para um estado nomeado apaga o aluno do alerta da virada");
      assert.match(r.rows[0].erro, /sem semanas/i, "com o motivo real, que é o que o heartbeat mostra");

      // e o estado_ciclo PODE distinguir o caso — a distinção é
      // legítima naquela camada, desde que não rebaixe a severidade aqui.
      const e = await c.query("select * from app.estado_ciclo($1, current_date)", [t.rows[0].id]);
      assert.equal(e.rows[0].estado, "sem_semanas");
    } finally { await c.query("rollback"); }
  });
});
