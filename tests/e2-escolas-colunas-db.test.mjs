// ============================================================
// ETAPA 2, FATIA 7 — escolas: privilégio por coluna (0058, URGENTE)
// ------------------------------------------------------------
// Antes: a coordenação alterava qualquer coluna da própria escola pela
// API (status, plano, limite_alunos, observação interna do operador...)
// e qualquer usuário da escola lia a linha inteira.
// Agora: UPDATE só em nome, logo_url e cor_acento (a tela de marca);
// SELECT só nas colunas que o app lê fora do backoffice.
// O backoffice não muda: opera pelas RPCs SECURITY DEFINER.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pool, IDS, ESCOLA_A, como, esperaErro } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const MARCA = ["cor_acento", "logo_url", "nome"];
const DO_BACKOFFICE = [
  "status", "plano", "limite_alunos", "slug", "observacao",
  "email_institucional", "telefone_contato", "contato_nome", "contato_observacao",
];
const INTERNAS = [
  "limite_alunos", "observacao", "email_institucional",
  "telefone_contato", "contato_nome", "contato_observacao",
];
const VALOR = {
  status: "'cancelada'", plano: "'premium'", limite_alunos: "999999", slug: "'outra-escola'",
  observacao: "'reescrita'", email_institucional: "'x@y.z'", telefone_contato: "'0'",
  contato_nome: "'x'", contato_observacao: "'x'",
};

test("a coordenação ainda grava a marca, pelo mesmo caminho da tela (update + select id)", async () => {
  await como(IDS.coordA, async (c) => {
    const r = await c.query(
      `update escolas set nome = nome, logo_url = 'https://exemplo.test/logo.png', cor_acento = '#0b3d2e'
        where id = $1 returning id`,
      [ESCOLA_A],
    );
    assert.equal(r.rowCount, 1, "a tela de marca parou de funcionar");
  });
});

test("a coordenação não altera nenhuma coluna do backoffice na própria escola", async () => {
  for (const col of DO_BACKOFFICE) {
    await como(IDS.coordA, async (c) => {
      await esperaErro(c, /permission denied/, `update escolas set ${col} = ${VALOR[col]} where id = $1`, [ESCOLA_A]);
    });
  }
});

test("aluno, responsável e coordenação leem a marca (as colunas do embed de meuPerfil)", async () => {
  for (const quem of [IDS.alunoA, IDS.respA, IDS.coordA]) {
    await como(quem, async (c) => {
      const r = await c.query(
        "select id, nome, slug, logo_url, cor_acento, status, plano from escolas where id = $1",
        [ESCOLA_A],
      );
      assert.equal(r.rowCount, 1, `${quem.papel} perdeu a leitura da marca`);
    });
  }
});

test("ninguém com token de usuário lê as colunas internas do backoffice", async () => {
  for (const quem of [IDS.alunoA, IDS.respA, IDS.coordA]) {
    for (const col of INTERNAS) {
      await como(quem, async (c) => {
        await esperaErro(c, /permission denied/, `select ${col} from escolas where id = $1`, [ESCOLA_A]);
      });
    }
  }
});

test("estrutura: authenticated sem privilégio de tabela; UPDATE só nas três colunas da marca", async () => {
  const c = await pool.connect();
  try {
    const t = await c.query(`select has_table_privilege('authenticated', 'escolas', 'UPDATE') as upd,
                                    has_table_privilege('authenticated', 'escolas', 'SELECT') as sel`);
    assert.equal(t.rows[0].upd, false, "UPDATE de tabela devolve todas as colunas à coordenação");
    assert.equal(t.rows[0].sel, false, "SELECT de tabela devolve as colunas internas a todo usuário");
    const cols = await c.query(`
      select column_name from information_schema.column_privileges
       where table_schema = 'public' and table_name = 'escolas'
         and grantee = 'authenticated' and privilege_type = 'UPDATE'
       order by 1`);
    assert.deepEqual(cols.rows.map((x) => x.column_name), MARCA);
  } finally {
    c.release();
  }
});

test("o app só lê colunas concedidas: o embed de escolas em meuPerfil cabe no grant", async () => {
  const src = readFileSync(resolve(root, "app/src/shared/data/index.js"), "utf8");
  const embeds = [...src.matchAll(/escolas\(([^)]*)\)/g)].map((m) => m[1]);
  assert.ok(embeds.length > 0, "não achei o embed de escolas: o teste ficou desatualizado");
  const c = await pool.connect();
  try {
    const r = await c.query(`
      select column_name from information_schema.column_privileges
       where table_schema = 'public' and table_name = 'escolas'
         and grantee = 'authenticated' and privilege_type = 'SELECT'`);
    const concedidas = new Set(r.rows.map((x) => x.column_name));
    for (const lista of embeds) {
      for (const col of lista.split(",").map((s) => s.trim()).filter(Boolean)) {
        assert.ok(concedidas.has(col), `o front lê escolas.${col}, que não tem SELECT concedido`);
      }
    }
  } finally {
    c.release();
  }
  // e nenhum select genérico direto em escolas (daria 42501 com o grant por coluna)
  assert.doesNotMatch(src, /from\("escolas"\)\s*\.select\(\s*(\)|"\*")/);
});
