// ============================================================
// ETAPA 2, FATIA 2 — MATRIZ DE AUTORIZAÇÃO (camada banco), no CI
// ------------------------------------------------------------
// Roda a matriz inteira (tests/matriz-autorizacao.mjs) sobre a fixture de
// cinco escolas, numa transação que termina sempre em rollback, e exige:
//   1. todo caso bate com o esperado, SALVO os achados abertos
//      registrados em matriz-autorizacao-achados.mjs, que têm que
//      continuar divergindo até a migration que os corrige existir;
//   2. toda negação vem com o hash das tabelas igual antes e depois, e
//      com a prova de que o mesmo comando, sem RLS, afetaria linha
//      (senão a negação é vazia e não prova autorização);
//   3. todo controle positivo de escrita mudou dado de fato.
// A evidência gerada fica em docs/evidencias/e2-matriz-autorizacao.json
// (`node tests/matriz-autorizacao.mjs --gerar`).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./identidades.mjs";
import { executarMatriz, montarCasos, conferirAlvoLocal, PERSONAS } from "./matriz-autorizacao.mjs";
import { ACHADOS_ABERTOS } from "./matriz-autorizacao-achados.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const corrigido = (a) => !!a.corrigidoPor && existsSync(resolve(root, "supabase/migrations", `${a.corrigidoPor}.sql`));

let resultados;
test.before(async () => { ({ resultados } = await executarMatriz(pool)); });
test.after(async () => { await pool.end(); });

test("matriz: a trava de destino recusa qualquer banco que não seja o local de teste", () => {
  assert.throws(() => conferirAlvoLocal({ host: "db.zckyhihxjjbnqjqilymn.supabase.co", database: "postgres" }), /só roda em Postgres local/);
  assert.throws(() => conferirAlvoLocal({ host: "127.0.0.1", database: "postgres" }), /só roda em Postgres local/);
  assert.doesNotThrow(() => conferirAlvoLocal({ host: "127.0.0.1", database: "rumo_teste" }));
});

test("matriz: cobre as superfícies e as personas pedidas, com mais de 280 casos", () => {
  assert.ok(resultados.length >= 280, `só ${resultados.length} casos`);
  const superficies = new Set(resultados.map((r) => r.superficie));
  for (const s of ["tabela com tenant", "catálogo compartilhado", "aluno", "responsável", "coordenação", "super admin",
    "RPC com ID de outro tenant", "função app com EXECUTE amplo", "cenário entre escolas", "claims antigas", "escola não operacional", "anônimo"]) {
    assert.ok(superficies.has(s), `superfície sem caso: ${s}`);
  }
  const personas = new Set(resultados.map((r) => r.persona));
  for (const p of Object.keys(PERSONAS)) assert.ok(personas.has(p), `persona sem caso: ${p}`);
  // as nove tabelas do catálogo, com INSERT, UPDATE e DELETE cada
  const cat = resultados.filter((r) => r.superficie === "catálogo compartilhado" && r.persona === "coordA");
  assert.equal(cat.length, 27);
});

test("matriz: todo caso bate com o esperado, salvo achado aberto e registrado", () => {
  const erros = [];
  for (const r of resultados) {
    const a = ACHADOS_ABERTOS[r.id];
    const deveBater = !a || corrigido(a);
    if (deveBater && r.observado !== r.esperado) {
      erros.push(`${r.id} [${r.persona}] esperado ${r.esperado}, observado ${r.observado}${a ? ` (o ${a.corrigidoPor} está no repo e devia ter corrigido)` : " — achado NOVO: registre em matriz-autorizacao-achados.mjs ou corrija"}${r.prova.erro ? ` · ${r.prova.erro.slice(0, 80)}` : ""}`);
    }
    if (!deveBater && r.observado === r.esperado) {
      erros.push(`${r.id}: registrado como aberto (${a.achado}) mas parou de divergir — tire do registro junto com a correção`);
    }
  }
  assert.deepEqual(erros, []);
});

test("matriz: o registro de achados não aponta para caso que não existe", () => {
  const ids = new Set(montarCasos().map((c) => c.id));
  const orfaos = Object.keys(ACHADOS_ABERTOS).filter((id) => !ids.has(id));
  assert.deepEqual(orfaos, []);
});

test("matriz: negação só conta com integridade — hash igual e comando que, sem RLS, faria algo", () => {
  const ruins = resultados.filter((r) => r.prova.integridade !== "ok").map((r) => `${r.id}: ${r.prova.integridade}`);
  assert.deepEqual(ruins, []);
  // Cenário tem passo legítimo do servidor (ex.: a exclusão LGPD do próprio
  // aluno) que muda tabela de propósito: lá a prova é a consulta de dano.
  for (const r of resultados.filter((x) => x.observado === "negado" && !x.prova.passos)) {
    assert.equal(r.prova.tabelas_inalteradas, true, `${r.id}: negado, mas as tabelas mudaram`);
  }
  for (const r of resultados.filter((x) => x.prova.passos)) {
    assert.equal(typeof r.prova.dano_confirmado, "boolean", `${r.id}: cenário sem medida de dano`);
  }
});

test("matriz: controle positivo de escrita mudou dado (a matriz não é só de 'não')", () => {
  const controles = resultados.filter((r) => r.esperado === "permitido" && r.observado === "permitido" && r.prova.tabelas_inalteradas === false);
  assert.ok(controles.length >= 10, `só ${controles.length} controles com efeito`);
  for (const id of ["T.turmas.controle_positivo", "T.alunos.controle_positivo", "T.meta_atividades.controle_positivo", "T.registros.controle_positivo", "P.abrir_proximo_ciclo.controle", "X.controle_exclusao_lgpd_propria"]) {
    const r = resultados.find((x) => x.id === id);
    assert.equal(r?.observado, "permitido", `${id} devia passar`);
    assert.equal(r?.prova.tabelas_inalteradas, false, `${id} passou sem mudar dado`);
  }
});

test("matriz: as leituras que são controle (vinculado, super admin) enxergam, e as negações não", () => {
  const le = (id) => resultados.find((r) => r.id === id)?.observado;
  for (const t of ["alunos", "registros_estudo", "metas", "simulados"]) {
    assert.equal(le(`R.${t}.ler_vinculado`), "permitido");
    assert.equal(le(`R.${t}.vinculo_revogado`), "negado");
  }
  assert.equal(le("B.internal_admins.superAdmin_le"), "permitido");
  assert.equal(le("B.internal_admins.falso_le"), "negado");
});
