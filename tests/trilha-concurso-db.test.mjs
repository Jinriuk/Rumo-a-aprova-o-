// ============================================================
// TRILHA DO CONCURSO LIGADA AO RUNTIME (Fase C0.5)
// ------------------------------------------------------------
// Prova o conserto do sintoma "todo aluno vê o plano do Lucas/CN":
// a trilha/missões que o aluno e a coordenação leem vêm do exam_tag
// do PRÓPRIO aluno (derivado do concurso-alvo), e são COERENTES e
// DISTINTAS por prova. Espelha o que o seam `carregarPlanoConcurso`
// busca e o que `montarMissoesDoAluno` monta.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, IDS, ESCOLA_A } from "./identidades.mjs";
import { montarMissoesDoAluno } from "../app/src/modules/conteudo/missoes.js";

test.after(async () => { await pool.end(); });

const EXAMS = ["cn", "epcar", "esa", "eear", "espcex"];

// helper: o mesmo trio que carregarPlanoConcurso(examTag) lê
async function planoConcurso(c, examTag) {
  const [planos, missoes, ajustes] = await Promise.all([
    c.query("select * from trilha_planos where exam_tag=$1 order by ordem", [examTag]),
    c.query("select * from missoes where exam_tag=$1 order by ordem", [examTag]),
    c.query("select me.* from missoes_escola me join missoes m on m.id=me.missao_id where m.exam_tag=$1", [examTag]),
  ]);
  return { planos: planos.rows, missoes: missoes.rows, ajustesEscola: ajustes.rows };
}

test("cada concurso tem trilha e missões próprias, coerentes (todas do exam_tag certo)", async () => {
  await como(IDS.alunoA, async (c) => {
    for (const tag of EXAMS) {
      const { planos, missoes } = await planoConcurso(c, tag);
      assert.ok(planos.length > 0, `${tag}: tem ao menos um plano de trilha`);
      assert.ok(missoes.length > 0, `${tag}: tem ao menos uma missão`);
      assert.ok(planos.every((p) => p.exam_tag === tag), `${tag}: todo plano é do próprio concurso`);
      assert.ok(missoes.every((m) => m.exam_tag === tag), `${tag}: toda missão é do próprio concurso`);
    }
  });
});

test("as trilhas são DISTINTAS por prova: CN e EPCAR não compartilham missões", async () => {
  await como(IDS.alunoA, async (c) => {
    const cn = await planoConcurso(c, "cn");
    const epcar = await planoConcurso(c, "epcar");
    const idsCN = new Set(cn.missoes.map((m) => m.id));
    const vazamento = epcar.missoes.filter((m) => idsCN.has(m.id));
    assert.equal(vazamento.length, 0, "nenhuma missão de CN aparece em EPCAR");
    // e o conteúdo é mesmo diferente (nomes não coincidem)
    const nomesCN = new Set(cn.missoes.map((m) => m.nome));
    assert.ok(epcar.missoes.some((m) => !nomesCN.has(m.nome)), "EPCAR tem missão própria");
  });
});

test("aluno NOVO de EPCAR recebe missões de EPCAR — não o plano fixo do Lucas/CN", async () => {
  await como(IDS.coordA, async (c) => {
    // a coordenação cria o aluno exatamente como a UI faz: trilha = a
    // trilha padrão (hoje CN), concurso = EPCAR. O plano por concurso
    // NÃO pode depender da trilha fixa.
    const padrao = await c.query("select id from trilhas order by versao desc limit 1");
    const conc = await c.query("select id, codigo from concursos where codigo='epcar'");
    const ins = await c.query(
      "insert into alunos (escola_id, nome, trilha_id, concurso_id) values ($1,$2,$3,$4) returning id",
      [ESCOLA_A, "Aluno EPCAR Novo (teste)", padrao.rows[0].id, conc.rows[0].id],
    );
    const alunoId = ins.rows[0].id;

    // resolve o exam_tag pelo concurso-alvo (igual ao front: concurso.codigo)
    const tag = await c.query(
      "select c.codigo from alunos a join concursos c on c.id=a.concurso_id where a.id=$1",
      [alunoId],
    );
    assert.equal(tag.rows[0].codigo, "epcar");

    const { missoes, ajustesEscola } = await planoConcurso(c, tag.rows[0].codigo);
    const montadas = montarMissoesDoAluno({ missoes, examTagAtivo: "epcar", ajustesEscola });
    assert.ok(montadas.length > 0, "o aluno novo de EPCAR tem missões");
    assert.ok(montadas.every((m) => m.exam_tag === "epcar"), "todas as missões são de EPCAR");
    assert.ok(!montadas.some((m) => m.exam_tag === "cn"), "nenhuma missão de CN (sem plano do Lucas)");
    assert.ok(montadas.some((m) => /Reda/i.test(m.nome)), "traz a missão de redação do EPCAR");
  });
});

test("montarMissoesDoAluno sem nível devolve TODAS as missões do alvo (visão trilha do concurso)", async () => {
  await como(IDS.alunoA, async (c) => {
    const { missoes, ajustesEscola } = await planoConcurso(c, "cn");
    const todas = montarMissoesDoAluno({ missoes, examTagAtivo: "cn", ajustesEscola }); // sem nivel
    assert.equal(todas.length, missoes.length, "sem corte por nível, vêm todas as missões do CN");
    assert.ok(todas.every((m) => m.exam_tag === "cn"), "anti-furo continua valendo");
  });
});
