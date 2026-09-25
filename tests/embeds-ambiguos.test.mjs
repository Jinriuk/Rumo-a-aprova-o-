// ============================================================
// EMBED EM PAR COM MAIS DE UMA FK PRECISA DE HINT
// ------------------------------------------------------------
// Estático, sem banco. Varre app/src e supabase/functions, acha todo
// `.from("t").select("... embed(...) ...")` e reprova o embed que cai num
// par da lista versionada (embeds-fks-multiplas.mjs) sem dizer QUAL FK
// usar, com `tabela!nome_da_fk(...)`.
//
// Origem: 25/09/2026. A 0055 duplicou 16 FKs e quatro leituras do seam
// (listarAlunos, listarVinculos, listarMetas, metaAtual) passaram a voltar
// HTTP 300 (PGRST201). Painel, ficha, tela do aluno e área do responsável
// caíram em produção com o CI verde.
//
// A outra metade da guarda, a que compara a lista com o banco das
// migrations e confere que cada hint existe, está em
// embeds-ambiguos-db.test.mjs.
// ============================================================
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PARES_COM_FKS_MULTIPLAS } from "./embeds-fks-multiplas.mjs";
import {
  chavePar, consultasDoCodigo, embedsDoCodigo, extrairConsultas, extrairEmbeds,
} from "./embeds-postgrest.mjs";

const FKS_POR_PAR = new Map(PARES_COM_FKS_MULTIPLAS.map(({ par, fks }) => [chavePar(...par), fks]));

describe("extrator de embeds (lógica pura)", () => {
  it("acha embed simples, aninhado, com alias, hint e !inner", () => {
    const e = extrairEmbeds(
      "*, alunos_turmas!alunos_turmas_aluno_id_fkey(turma_id, turmas(nome)), dono:usuarios!fk_x!inner(nome), missoes!inner(exam_tag)",
      "alunos",
    );
    assert.deepEqual(
      e.map(({ origem, alvo, hints, juncao, alias }) => ({ origem, alvo, hints, juncao, alias })),
      [
        { origem: "alunos", alvo: "alunos_turmas", hints: ["alunos_turmas_aluno_id_fkey"], juncao: null, alias: null },
        { origem: "alunos_turmas", alvo: "turmas", hints: [], juncao: null, alias: null },
        { origem: "alunos", alvo: "usuarios", hints: ["fk_x"], juncao: "inner", alias: "dono" },
        { origem: "alunos", alvo: "missoes", hints: [], juncao: "inner", alias: null },
      ],
    );
  });

  it("não confunde cast, agregação e operador JSON com embed", () => {
    assert.deepEqual(extrairEmbeds("id, criado_em::text, count(), dados->>x", "t"), []);
  });

  it("liga cada select ao .from da mesma cadeia, mesmo em várias linhas", () => {
    const fonte = `
      const a = await supabase
        .from("metas")
        .select("*, meta_atividades(id)")
        .eq("x", 1);
      const b = Array.from({ length: 3 });
      await supabase.from("turmas").update({ nome }).eq("id", 1).select("id");
      await supabase.from("logs").insert(x);
      await supabase.rpc("f").select("id");
    `;
    assert.deepEqual(
      extrairConsultas(fonte).map(({ tabela, select }) => ({ tabela, select })),
      [
        { tabela: "metas", select: "*, meta_atividades(id)" },
        { tabela: "turmas", select: "id" },
        { tabela: "logs", select: null },
      ],
    );
  });

  it("marca select com argumento não literal", () => {
    const [c] = extrairConsultas('supabase.from("alunos").select(COLUNAS)');
    assert.equal(c.literal, false);
  });
});

describe("guarda de embed ambíguo no código", () => {
  it("o extrator enxerga o código (não passa em branco)", () => {
    const consultas = consultasDoCodigo();
    const embeds = embedsDoCodigo();
    assert.ok(consultas.length >= 40, `só ${consultas.length} consultas achadas; o extrator deixou de cobrir o código`);
    assert.ok(embeds.length >= 10, `só ${embeds.length} embeds achados; o extrator deixou de cobrir o código`);
  });

  it("todo select é uma string fixa (senão não dá para auditar o embed)", () => {
    const dinamicos = consultasDoCodigo().filter((c) => !c.literal).map((c) => `${c.onde} (${c.tabela})`);
    assert.deepEqual(dinamicos, [],
      "select montado em variável ou template com ${...}: esta guarda não consegue ler. Use string fixa.");
  });

  it("embed em par com mais de uma FK nomeia uma das FKs do par", () => {
    const problemas = [];
    for (const e of embedsDoCodigo()) {
      const fks = FKS_POR_PAR.get(chavePar(e.origem, e.alvo));
      if (!fks) continue;
      const nomeadas = e.hints.filter((h) => fks.includes(h));
      if (nomeadas.length !== 1 || e.hints.length !== 1) {
        problemas.push(`${e.onde}: ${e.origem} -> ${e.texto.split("(")[0]} precisa de exatamente um hint entre: ${fks.join(" | ")}`);
      }
    }
    assert.deepEqual(problemas, [],
      "embed sem hint em par com mais de uma FK: o PostgREST volta HTTP 300 (PGRST201) e a tela cai");
  });

  it("regressão 25/09: as quatro leituras que caíram nomeiam a FK", () => {
    const porOnde = embedsDoCodigo().filter((e) => e.onde.startsWith("app/src/shared/data/index.js"));
    const achar = (origem, alvo) => {
      const r = porOnde.filter((e) => e.origem === origem && e.alvo === alvo);
      assert.ok(r.length > 0, `embed ${origem} -> ${alvo} sumiu do seam; revise este teste`);
      return r;
    };
    // listarAlunos
    assert.ok(achar("alunos", "alunos_turmas").every((e) => e.hints[0] === "alunos_turmas_aluno_id_fkey"));
    assert.ok(achar("alunos_turmas", "turmas").every((e) => e.hints[0] === "alunos_turmas_turma_id_fkey"));
    assert.ok(achar("alunos", "usuarios").every((e) => e.hints[0] === "alunos_usuario_id_fkey"));
    // listarVinculos
    assert.ok(achar("vinculos_responsaveis", "usuarios").every((e) => e.hints[0] === "vinculos_responsaveis_responsavel_id_fkey"));
    // listarMetas e metaAtual
    const metas = achar("metas", "meta_atividades");
    assert.equal(metas.length, 2, "listarMetas e metaAtual deveriam embutir meta_atividades");
    assert.ok(metas.every((e) => e.hints[0] === "meta_atividades_meta_id_fkey"));
  });
});
