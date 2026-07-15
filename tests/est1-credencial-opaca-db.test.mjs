// ============================================================
// EST1-C1 (0044) — FUNDAÇÃO DA CREDENCIAL OPACA (banco)
// ------------------------------------------------------------
// Base do desacoplamento código↔senha (SEC3b), ADITIVA e DORMENTE (o
// login de produção não muda). Provamos a parte crítica de segurança:
//   • registrar grava só o HASH (nunca o código em claro);
//   • resolver devolve 'ok' + usuario_id no código certo, 'nao_encontrado'
//     no errado — sempre registrando a tentativa (trabalho uniforme);
//   • rotacionar gira o código MANTENDO a identidade (usuario_id);
//   • revogar invalida sem apagar (auditoria) → 'revogado';
//   • rate limit: acima do teto, 'rate_limited' antes do lookup;
//   • tudo é de SERVIDOR: authenticated não executa nem lê as tabelas.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, comoServidor, esperaErro, IDS, ESCOLA_A } from "./identidades.mjs";

test.after(async () => { await pool.end(); });

// usuário de teste (isolado em transação com rollback)
const U = "cafe0000-0000-4000-8000-000000000001";
const CODIGO = "ABCD-EFGH-JKMN";

async function comUsuario(fn) {
  await comoServidor(async (c) => {
    await c.query("begin");
    try {
      await c.query(
        "insert into usuarios (id, escola_id, papel, nome) values ($1,$2,'aluno','Teste Opaca')",
        [U, ESCOLA_A],
      );
      await fn(c);
    } finally { await c.query("rollback"); }
  });
}

async function resolver(c, codigo, chave = "1.2.3.4", limite = 10, janela = 5) {
  const r = await c.query("select * from app.resolver_codigo($1,$2,$3,$4)", [codigo, chave, limite, janela]);
  return r.rows[0];
}

test("registrar grava só o HASH — o código em claro não aparece na tabela", async () => {
  await comUsuario(async (c) => {
    await c.query("select app.registrar_codigo($1,$2,$3)", [U, ESCOLA_A, CODIGO]);
    const r = await c.query("select codigo_hash, encode(codigo_hash,'hex') hex from app.acessos_codigo where usuario_id=$1", [U]);
    assert.equal(r.rows.length, 1);
    // o hash tem 32 bytes (sha256) e não contém o código normalizado
    assert.equal(r.rows[0].hex.length, 64, "sha256 = 32 bytes");
    assert.ok(!r.rows[0].hex.toUpperCase().includes("ABCDEFGHJKMN"), "não guarda o código em claro");
  });
});

test("resolver: código certo → ok + usuario_id; errado → nao_encontrado", async () => {
  await comUsuario(async (c) => {
    await c.query("select app.registrar_codigo($1,$2,$3)", [U, ESCOLA_A, CODIGO]);
    const ok = await resolver(c, "abcdefghjkmn"); // normalização: minúsculo/sem hífen casa
    assert.equal(ok.resultado, "ok");
    assert.equal(ok.usuario_id, U);
    const nao = await resolver(c, "ZZZZ-ZZZZ-ZZZZ");
    assert.equal(nao.resultado, "nao_encontrado");
    assert.equal(nao.usuario_id, null);
  });
});

test("rotacionar gira o código mantendo a identidade (usuario_id)", async () => {
  await comUsuario(async (c) => {
    await c.query("select app.registrar_codigo($1,$2,$3)", [U, ESCOLA_A, CODIGO]);
    await c.query("select app.rotacionar_codigo($1,$2)", [U, "PQRS-TUVW-XYZ2"]);
    // o código antigo não resolve mais; o novo sim, para o MESMO usuário
    assert.equal((await resolver(c, CODIGO)).resultado, "nao_encontrado");
    const novo = await resolver(c, "PQRS-TUVW-XYZ2");
    assert.equal(novo.resultado, "ok");
    assert.equal(novo.usuario_id, U, "mesma identidade após rotação");
  });
});

test("revogar invalida sem apagar (auditoria) → resolver devolve 'revogado'", async () => {
  await comUsuario(async (c) => {
    await c.query("select app.registrar_codigo($1,$2,$3)", [U, ESCOLA_A, CODIGO]);
    await c.query("select app.revogar_codigo($1)", [U]);
    const r = await resolver(c, CODIGO);
    assert.equal(r.resultado, "revogado");
    // a linha continua lá, com carimbo de revogação
    const linha = await c.query("select revogado_em from app.acessos_codigo where usuario_id=$1", [U]);
    assert.ok(linha.rows[0].revogado_em, "revogado_em carimbado, linha preservada");
  });
});

test("rate limit: acima do teto na janela → 'rate_limited' antes do lookup", async () => {
  await comUsuario(async (c) => {
    await c.query("select app.registrar_codigo($1,$2,$3)", [U, ESCOLA_A, CODIGO]);
    const CH = "9.9.9.9";
    // teto baixo p/ o teste: 3 tentativas/janela
    for (let i = 0; i < 3; i++) {
      const r = await resolver(c, "ZZZZ-ZZZZ-ZZZZ", CH, 3, 5);
      assert.equal(r.resultado, "nao_encontrado");
    }
    // a 4ª (mesmo com o código CERTO) é barrada pelo rate limit
    const barrado = await resolver(c, CODIGO, CH, 3, 5);
    assert.equal(barrado.resultado, "rate_limited");
    assert.equal(barrado.usuario_id, null);
    // outra chave (IP) não é afetada
    assert.equal((await resolver(c, CODIGO, "8.8.8.8", 3, 5)).resultado, "ok");
  });
});

test("é tudo de SERVIDOR: authenticated não executa nem lê as tabelas do schema app", async () => {
  await como(IDS.alunoA, async (c) => {
    await esperaErro(c, /permission denied|not exist/i,
      "select * from app.resolver_codigo('X','1.1.1.1',10,5)");
    await esperaErro(c, /permission denied|not exist/i,
      "select count(*) from app.acessos_codigo");
    await esperaErro(c, /permission denied|not exist/i,
      "select app.registrar_codigo($1,$2,'X')", [IDS.alunoA.sub, ESCOLA_A]);
  });
});

test("porta public (a que o Edge usa via RPC): registra e resolve; authenticated é barrado", async () => {
  await comUsuario(async (c) => {
    // como servidor: o provisionar-aluno chama esta porta
    await c.query("select public.registrar_codigo_acesso($1,$2,$3)", [U, ESCOLA_A, CODIGO]);
    const j = await c.query("select public.resolver_codigo_acesso($1,$2) as r", [CODIGO, "1.2.3.4"]);
    assert.equal(j.rows[0].r.resultado, "ok");
    assert.equal(j.rows[0].r.usuario_id, U);
  });
  // o cliente autenticado não alcança a porta public das credenciais
  await como(IDS.alunoA, async (c) => {
    await esperaErro(c, /permission denied/i,
      "select public.resolver_codigo_acesso('X','1.1.1.1')");
    await esperaErro(c, /permission denied/i,
      "select public.registrar_codigo_acesso($1,$2,'X')", [IDS.alunoA.sub, ESCOLA_A]);
  });
});
