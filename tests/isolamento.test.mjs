// ============================================================
// BLOCO 0 — PROVA DE ISOLAMENTO ENTRE ESCOLAS
// ------------------------------------------------------------
// Duas escolas semeadas com dados distintos. Um usuário da escola
// A não lê NEM escreve absolutamente nada da escola B, com a
// identidade real nos claims (papel authenticated + JWT), que é
// exatamente o que o Supabase põe à disposição da RLS.
// Se este arquivo falhar, NADA deve ser construído em cima.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, esperaErro, IDS, ESCOLA_A, ESCOLA_B, ALUNO_LUCAS, ALUNO_BRUNO } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const TABELAS_ISOLADAS = [
  "escolas", "usuarios", "turmas", "alunos", "alunos_turmas",
  "vinculos_responsaveis", "metas", "meta_atividades",
  "registros_estudo", "simulados", "consentimentos", "logs_acesso",
  "config_escola", // Fase 15.1: override pedagógico por escola, isolado
  "logs_coordenacao", // Fase A.8: trilha de ações sensíveis da coordenação
];

// ---------- LEITURA: nada da outra escola, em NENHUMA tabela ----------
for (const [nome, id] of [["coordenação", IDS.coordA], ["aluno", IDS.alunoA], ["responsável", IDS.respA]]) {
  test(`${nome} da escola A não lê nenhuma linha da escola B (todas as tabelas isoladas)`, async () => {
    await como(id, async (c) => {
      for (const t of TABELAS_ISOLADAS) {
        const col = t === "escolas" ? "id" : "escola_id";
        const r = await c.query(`select count(*)::int as n from ${t} where ${col} = $1`, [ESCOLA_B]);
        assert.equal(r.rows[0].n, 0, `${nome} A enxergou ${r.rows[0].n} linha(s) de ${t} da escola B`);
      }
    });
  });
}

test("o sentido inverso também: coordenação da escola B não lê nada da escola A", async () => {
  await como(IDS.coordB, async (c) => {
    for (const t of TABELAS_ISOLADAS) {
      const col = t === "escolas" ? "id" : "escola_id";
      const r = await c.query(`select count(*)::int as n from ${t} where ${col} = $1`, [ESCOLA_A]);
      assert.equal(r.rows[0].n, 0, `coordenação B enxergou ${t} da escola A`);
    }
  });
});

test("nem por busca sem filtro: o universo visível da coordenação A só contém a escola A", async () => {
  await como(IDS.coordA, async (c) => {
    for (const t of TABELAS_ISOLADAS.filter((t) => t !== "escolas")) {
      const r = await c.query(`select distinct escola_id from ${t}`);
      for (const row of r.rows) {
        assert.equal(row.escola_id, ESCOLA_A, `${t} vazou escola ${row.escola_id}`);
      }
    }
    const e = await c.query("select id from escolas");
    assert.deepEqual(e.rows.map((r) => r.id), [ESCOLA_A]);
  });
});

test("o dado de contraste da escola B (registro SEGREDO-ESCOLA-B) é invisível para todos da escola A", async () => {
  for (const id of [IDS.coordA, IDS.alunoA, IDS.respA]) {
    await como(id, async (c) => {
      const r = await c.query("select count(*)::int as n from registros_estudo where topico = 'SEGREDO-ESCOLA-B'");
      assert.equal(r.rows[0].n, 0);
    });
  }
});

// ---------- ESCRITA: negada por padrão, atravessando o tenant ----------
test("aluno da escola A não escreve registro para aluno da escola B (nem com escola_id forjado)", async () => {
  await como(IDS.alunoA, async (c) => {
    await esperaErro(c, /row-level security/i, `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, questoes)
         values ($1, $2, current_date, 'mat', 10)`, [ESCOLA_B, ALUNO_BRUNO]);
  });
  // e também não forjando o próprio tenant com aluno alheio
  await como(IDS.alunoA, async (c) => {
    await esperaErro(c, /row-level security|foreign key|violates/i, `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, questoes)
         values ($1, $2, current_date, 'mat', 10)`, [ESCOLA_A, ALUNO_BRUNO]);
  });
});

test("coordenação da escola A não altera, apaga nem cria nada na escola B", async () => {
  await como(IDS.coordA, async (c) => {
    const upd = await c.query("update escolas set nome = 'hackeada' where id = $1", [ESCOLA_B]);
    assert.equal(upd.rowCount, 0);

    const updAluno = await c.query("update alunos set nome = 'hackeado' where escola_id = $1", [ESCOLA_B]);
    assert.equal(updAluno.rowCount, 0);

    const del = await c.query("delete from alunos where escola_id = $1", [ESCOLA_B]);
    assert.equal(del.rowCount, 0);

    await esperaErro(c, /row-level security/i, "insert into turmas (escola_id, nome) values ($1, 'turma intrusa')", [ESCOLA_B]);
    await esperaErro(c, /row-level security/i, "insert into alunos (escola_id, nome, trilha_id) values ($1, 'intruso', (select id from trilhas limit 1))", [ESCOLA_B]);
  });
});

test("aluno da escola B não lê meta, registro nem simulado do Lucas (escola A)", async () => {
  await como(IDS.alunoB, async (c) => {
    for (const t of ["metas", "registros_estudo", "simulados"]) {
      const r = await c.query(`select count(*)::int as n from ${t} where aluno_id = $1`, [ALUNO_LUCAS]);
      assert.equal(r.rows[0].n, 0, `aluno B leu ${t} do Lucas`);
    }
  });
});

test("responsável da escola B não enxerga o aluno vinculado da escola A", async () => {
  await como(IDS.respB, async (c) => {
    const r = await c.query("select count(*)::int as n from alunos where id = $1", [ALUNO_LUCAS]);
    assert.equal(r.rows[0].n, 0);
  });
});

// ---------- SEM LOGIN: nada ----------
test("sem login (anon) não há acesso a tabela nenhuma", async () => {
  await como(null, async (c) => {
    for (const t of [...TABELAS_ISOLADAS, "trilhas", "atividades_modelo"]) {
      await esperaErro(c, /permission denied/i, `select * from ${t} limit 1`);
    }
  });
});

// ---------- MATRIZ DENTRO DO TENANT (Doc 6, seção 3) ----------
test("dentro da própria escola a matriz vale: aluno só vê a si; responsável só lê; coordenação não escreve progresso", async () => {
  // aluno A vê só o próprio aluno
  await como(IDS.alunoA, async (c) => {
    const r = await c.query("select id from alunos");
    assert.deepEqual(r.rows.map((x) => x.id), [ALUNO_LUCAS]);
    // e não vê turmas nem consentimentos (matriz: nada)
    const t = await c.query("select count(*)::int as n from turmas");
    assert.equal(t.rows[0].n, 0);
    const k = await c.query("select count(*)::int as n from consentimentos");
    assert.equal(k.rows[0].n, 0);
  });

  // responsável A lê o vinculado, mas não escreve registro
  await como(IDS.respA, async (c) => {
    const r = await c.query("select count(*)::int as n from registros_estudo where aluno_id = $1", [ALUNO_LUCAS]);
    assert.ok(r.rows[0].n > 0, "responsável deveria ler o progresso do vinculado");
    await esperaErro(c, /row-level security/i, `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, questoes)
         values ($1, $2, current_date, 'mat', 5)`, [ESCOLA_A, ALUNO_LUCAS]);
  });

  // coordenação A lê progresso mas não cria meta nem registro (motor/aluno fazem)
  await como(IDS.coordA, async (c) => {
    const m = await c.query("select count(*)::int as n from metas");
    assert.ok(m.rows[0].n > 0, "coordenação deveria ler metas dos alunos da escola");
    await esperaErro(c, /row-level security/i, `insert into metas (escola_id, aluno_id, trilha_id, semana_numero, inicio, fim)
         select $1, $2, id, 1, '2026-05-30', '2026-06-07' from trilhas limit 1`, [ESCOLA_A, ALUNO_LUCAS]);
    await esperaErro(c, /row-level security/i, `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, questoes)
         values ($1, $2, current_date, 'mat', 5)`, [ESCOLA_A, ALUNO_LUCAS]);
  });
});

test("aluno escreve o PRÓPRIO registro e atualiza estado de atividade da PRÓPRIA meta", async () => {
  await como(IDS.alunoA, async (c) => {
    const ins = await c.query(
      `insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, questoes, acertos)
       values ($1, $2, current_date, 'mat', 15, 12) returning id`,
      [ESCOLA_A, ALUNO_LUCAS]
    );
    assert.equal(ins.rowCount, 1);

    const upd = await c.query(
      `update meta_atividades set estado = 'concluida'
       where meta_id in (select id from metas where aluno_id = $1 and status = 'ativa')
         and id = (select id from meta_atividades limit 1)`,
      [ALUNO_LUCAS]
    );
    assert.equal(upd.rowCount, 1, "aluno deveria poder concluir atividade da própria meta");
  });

  // mas o aluno B não toca nas atividades do Lucas
  await como(IDS.alunoB, async (c) => {
    const upd = await c.query("update meta_atividades set estado = 'concluida' where escola_id = $1", [ESCOLA_A]);
    assert.equal(upd.rowCount, 0);
  });
});

// ---------- CONTEÚDO GLOBAL: a exceção deliberada ----------
test("conteúdo global (trilha) é legível pelas duas escolas e não é gravável por nenhuma", async () => {
  for (const id of [IDS.alunoA, IDS.alunoB, IDS.coordA, IDS.coordB]) {
    await como(id, async (c) => {
      const r = await c.query("select count(*)::int as n from trilha_semanas");
      assert.equal(r.rows[0].n, 9, "as 9 semanas da trilha CN deveriam ser visíveis");
    });
  }
  await como(IDS.coordA, async (c) => {
    await esperaErro(c, /row-level security/i, "insert into trilhas (nicho, nome, versao) values ('x', 'trilha pirata', 99)");
    const upd = await c.query("update atividades_modelo set texto = 'adulterado'");
    assert.equal(upd.rowCount, 0, "escola não edita a metodologia");
  });
});
