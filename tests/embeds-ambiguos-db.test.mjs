// ============================================================
// PARES COM MAIS DE UMA FK: O BANCO BATE COM A LISTA VERSIONADA
// ------------------------------------------------------------
// 25/09/2026: a 0055 criou 16 FKs compostas "_mesma_escola_" ao lado das
// FKs simples. O PostgREST passou a ver duas relações em cada par e todo
// embed sem hint nesses pares virou HTTP 300 (PGRST201). Painel da
// coordenação, ficha do aluno, tela do aluno e área do responsável caíram
// em produção. A suíte ficou verde: nenhum teste fala com o PostgREST.
//
// Este arquivo trava as duas pontas que dependem do banco:
//   1. os pares com mais de uma FK no banco das migrations são EXATAMENTE
//      os da lista versionada (embeds-fks-multiplas.mjs). Migração que
//      duplicar FK reprova aqui até alguém registrar o par, e aí o teste
//      estático (embeds-ambiguos.test.mjs) aponta cada embed sem hint;
//   2. todo hint que o código usa nomeia uma FK que existe e liga as duas
//      tabelas do embed. Hint que aponta para FK renomeada ou apagada volta
//      PGRST200 no PostgREST, que é o mesmo tipo de tela quebrada.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool } from "./identidades.mjs";
import { PARES_COM_FKS_MULTIPLAS } from "./embeds-fks-multiplas.mjs";
import { chavePar, embedsDoCodigo } from "./embeds-postgrest.mjs";

test.after(async () => { await pool.end(); });

// Todas as FKs entre tabelas do schema public, com o par sem ordem.
async function fksDoBanco() {
  const { rows } = await pool.query(`
    select c.conname, t.relname as tabela, r.relname as referencia
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace nt on nt.oid = t.relnamespace
      join pg_class r on r.oid = c.confrelid
      join pg_namespace nr on nr.oid = r.relnamespace
     where c.contype = 'f' and nt.nspname = 'public' and nr.nspname = 'public'`);
  return rows;
}

test("os pares com mais de uma FK no banco são os da lista versionada", async () => {
  const porPar = new Map();
  for (const fk of await fksDoBanco()) {
    const chave = chavePar(fk.tabela, fk.referencia);
    if (!porPar.has(chave)) porPar.set(chave, []);
    porPar.get(chave).push(fk.conname);
  }
  const noBanco = [...porPar]
    .filter(([, nomes]) => nomes.length > 1)
    .map(([chave, nomes]) => `${chave} : ${nomes.sort().join(", ")}`)
    .sort();
  const naLista = PARES_COM_FKS_MULTIPLAS
    .map(({ par, fks }) => `${chavePar(...par)} : ${[...fks].sort().join(", ")}`)
    .sort();

  assert.deepEqual(noBanco, naLista,
    "o banco das migrations e tests/embeds-fks-multiplas.mjs divergem. Par novo com FK duplicada: " +
    "registre na lista e dê hint (tabela!nome_da_fk) a todo embed desse par, senão o PostgREST volta 300. " +
    "Par que saiu: tire da lista e confira se algum hint aponta para a FK apagada.");
});

test("todo hint de embed no código nomeia uma FK que existe entre as duas tabelas", async () => {
  const fks = await fksDoBanco();
  const porNome = new Map(fks.map((fk) => [fk.conname, fk]));
  const comHint = embedsDoCodigo().filter((e) => e.hints.length > 0);

  // se isto cair a zero, o extrator parou de enxergar os hints e o teste
  // passaria sem conferir nada
  assert.ok(comHint.length >= 6, `só ${comHint.length} embeds com hint encontrados; o extrator deixou de cobrir o código`);

  const problemas = [];
  for (const e of comHint) {
    for (const hint of e.hints) {
      const fk = porNome.get(hint);
      if (!fk) { problemas.push(`${e.onde}: ${e.origem} -> ${e.alvo}!${hint} (FK não existe)`); continue; }
      if (chavePar(fk.tabela, fk.referencia) !== chavePar(e.origem, e.alvo)) {
        problemas.push(`${e.onde}: ${e.origem} -> ${e.alvo}!${hint} (FK liga ${fk.tabela} -> ${fk.referencia})`);
      }
    }
  }
  assert.deepEqual(problemas, [], "hint de embed que o PostgREST não resolve (PGRST200)");
});
