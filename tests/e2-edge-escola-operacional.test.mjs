// ============================================================
// ETAPA 2, FATIA 7 — Edge Functions respeitam a suspensão da escola
// ------------------------------------------------------------
// Suspender ou cancelar só muda escolas.status; quem barra é a RLS. As
// Edge Functions usam a chave de serviço, que ignora a RLS, então a
// coordenação de escola parada seguia criando contas, trocando
// credenciais, gerando meta e exportando dossiê LGPD. O porteiro fica em
// supabase/functions/_shared/escola.ts, com a regra da 0056.
//
// Sem runner de Deno no repo: o porteiro é executado de verdade no Node
// (type stripping do Node 22, mesma técnica do teste de CORS), com um
// cliente falso; a posição dele em cada função é travada pela fonte.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ler = (rel) => readFileSync(resolve(root, rel), "utf8");
const semComentario = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");

const { escolaOperacional, STATUS_PARADOS, RESPOSTA_ESCOLA_PARADA } =
  await import("../supabase/functions/_shared/escola.ts");

// cliente falso: devolve o status cadastrado para o id, e conta consultas
function clienteFalso(statusPorId, { erro = null } = {}) {
  const consultas = [];
  return {
    consultas,
    from(tabela) {
      const q = { tabela, filtros: [] };
      consultas.push(q);
      return {
        select(cols) { q.cols = cols; return this; },
        eq(col, val) { q.filtros.push([col, val]); return this; },
        async maybeSingle() {
          if (erro) return { data: null, error: erro };
          const id = q.filtros.find(([c]) => c === "id")?.[1];
          return { data: id in statusPorId ? { status: statusPorId[id] } : null, error: null };
        },
      };
    },
  };
}

test("porteiro: escola ausente no token não opera, e nem consulta o banco", async () => {
  const c = clienteFalso({});
  assert.equal(await escolaOperacional(c, null), false);
  assert.equal(await escolaOperacional(c, undefined), false);
  assert.equal(await escolaOperacional(c, ""), false);
  assert.equal(c.consultas.length, 0);
});

test("porteiro: escola inexistente não opera", async () => {
  assert.equal(await escolaOperacional(clienteFalso({}), "e-fantasma"), false);
});

test("porteiro: suspensa e cancelada não operam; os outros status operam (regra da 0056)", async () => {
  assert.deepEqual(STATUS_PARADOS, ["suspensa", "cancelada"]);
  const c = clienteFalso({
    s: "suspensa", x: "cancelada", a: "ativa", i: "implantacao", p: "piloto", d: "demo",
  });
  assert.equal(await escolaOperacional(c, "s"), false);
  assert.equal(await escolaOperacional(c, "x"), false);
  for (const id of ["a", "i", "p", "d"]) assert.equal(await escolaOperacional(c, id), true, id);
  // consulta a linha certa, na tabela certa
  assert.deepEqual(c.consultas.at(-1), { tabela: "escolas", cols: "status", filtros: [["id", "d"]] });
});

test("porteiro: erro do banco sobe, não vira 'opera' nem 'não opera' em silêncio", async () => {
  const erro = new Error("banco fora");
  await assert.rejects(escolaOperacional(clienteFalso({}, { erro }), "a"), /banco fora/);
});

test("resposta de escola parada é 403 com estado próprio (a tela distingue de 'não autorizado')", () => {
  assert.equal(RESPOSTA_ESCOLA_PARADA.estado, "escola_nao_operacional");
});

// Cada função da coordenação chama o porteiro DEPOIS de saber quem chama
// e ANTES da primeira leitura de dado de aluno ou escrita.
const FUNCOES = {
  "gerar-meta": ['admin.rpc("motor_gerar_meta_segura"', 'admin.from("alunos")'],
  "lgpd-titular": ['admin.rpc("lgpd_exportar"', '.rpc("lgpd_usuarios_do_aluno"', "alunoDaEscola(aluno_id"],
  "provisionar-aluno": ["lidarComCredencial(tipo", "admin.auth.admin.createUser(", "alunoDaEscola(aluno_id"],
  "revogar-responsavel": ['.from("vinculos_responsaveis")', ".delete()"],
};

for (const [fn, depois] of Object.entries(FUNCOES)) {
  test(`${fn}: chama o porteiro antes de qualquer dado ou escrita`, () => {
    const src = semComentario(ler(`supabase/functions/${fn}/index.ts`));
    assert.match(src, /from "\.\.\/_shared\/escola\.ts"/, "não importa o porteiro");
    const handler = src.slice(src.indexOf("Deno.serve("));
    const gate = handler.indexOf("escolaOperacional(admin, quem.escola_id)");
    assert.ok(gate > 0, "o porteiro não está no handler");
    assert.ok(handler.indexOf("chamador(req)") < gate, "o porteiro tem de vir depois de identificar quem chama");
    for (const marco of depois) {
      const i = handler.indexOf(marco);
      assert.ok(i > gate, `"${marco}" acontece antes do porteiro`);
    }
    assert.match(handler, /return json\(RESPOSTA_ESCOLA_PARADA, 403\)/);
  });
}

test("toda função que atende a coordenação passa pelo porteiro (função nova sem ele derruba o CI)", () => {
  const dir = resolve(root, "supabase/functions");
  const semPorteiro = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "_shared")
    .map((d) => d.name)
    .filter((fn) => {
      const src = semComentario(ler(`supabase/functions/${fn}/index.ts`));
      const atendeCoordenacao = /papel\s*!==\s*"coordenacao"/.test(src);
      return atendeCoordenacao && !/escolaOperacional\(/.test(src);
    });
  assert.deepEqual(semPorteiro, []);
});

test("revogar-responsavel: o super_admin segue revogando em escola parada (porteiro só no ramo da coordenação)", () => {
  const src = semComentario(ler("supabase/functions/revogar-responsavel/index.ts"));
  const ramoAdmin = src.indexOf("resolverSuperAdmin(req)");
  const gate = src.indexOf("escolaOperacional(admin, quem.escola_id)");
  assert.ok(ramoAdmin > 0 && gate > ramoAdmin, "o porteiro não pode barrar o ramo do super_admin");
  assert.match(src, /else if \(!\(await escolaOperacional\(admin, quem\.escola_id\)\)\)/);
});
