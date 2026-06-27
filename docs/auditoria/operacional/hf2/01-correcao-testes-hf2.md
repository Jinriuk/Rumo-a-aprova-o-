# HF2.1 — Correção dos Testes: hf2-provisionar-aluno.test.mjs

**Data:** 2026-06-24  
**Branch:** `claude/hf2-provisionar-aluno-cors-q4a4dq`  
**Pré-requisito:** HF2 commitada (corrige CORS + re-vínculo de responsável).

---

## 1. Sintoma

CI reportou `tests 333, pass 323, fail 10, exit code 1` após o commit da HF2.  
Os 10 testes que falharam são exatamente os criados em `tests/hf2-provisionar-aluno.test.mjs` (HF2-1 a HF2-10).

---

## 2. Causa-raiz

### 2.1 — UUIDs com caractere inválido (`h` não é hex)

Os IDs fixos definidos no arquivo de teste usavam o prefixo `hf` para serem mnemonicamente ligados a "HF2", mas `h` **não é um dígito hexadecimal válido**. O PostgreSQL rejeita qualquer valor com `invalid input syntax for type uuid` ao tentar inserir esses IDs em colunas do tipo `uuid`.

```javascript
// BUGADO — h não é hex
const RESP_HF2      = "hf200000-0000-4000-8000-000000000010";
const ALUNO_HF2     = "hf200000-0000-4000-8000-000000000011";
const VINCULO_HF2   = "hf200000-0000-4000-8000-000000000012";
const RESP_ESCOLA_B = "hf200000-0000-4000-8000-000000000020";
```

Todo `INSERT` com esses IDs abortava a transação antes de qualquer asserção, fazendo todos os 10 testes falharem com erro de banco.

### 2.2 — HF2-6: role switching impossível dentro de `como()`

O teste HF2-6 chamava `como(IDS.coordA, async (c) => {...})`, que já executa `set local role authenticated`. Dentro do callback, tentava `set local role postgres` — o que é impossível: o role `authenticated` não tem permissão para elevar para `postgres`.

```javascript
// BUGADO — já é authenticated, não pode virar postgres
await como(IDS.coordA, async (c) => {
  await c.query("set local role postgres"); // erro de permissão
  await c.query("insert into usuarios ...");
  await c.query("set local role authenticated");
  // ...
});
```

---

## 3. Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `tests/hf2-provisionar-aluno.test.mjs` | Corrigidos IDs inválidos e padrão de role-switching no HF2-6 |

Nenhuma outra alteração. Código de produção, migrations, RLS e Edge Functions permanecem intactos.

---

## 4. Correções aplicadas

### 4.1 — UUIDs corrigidos

Substituição do prefixo inválido `hf` por `af` (hex válido) mantendo a semântica de identificação do cenário HF2:

```javascript
// CORRIGIDO — af é hex válido
const RESP_HF2      = "af200000-0000-4000-8000-000000000010";
const ALUNO_HF2     = "af200000-0000-4000-8000-000000000011";
const VINCULO_HF2   = "af200000-0000-4000-8000-000000000012";
const RESP_ESCOLA_B = "af200000-0000-4000-8000-000000000020";
```

### 4.2 — HF2-6: padrão corrigido para pool.connect() direto

O teste agora segue o mesmo padrão do HF2-7 (que estava correto): obtém conexão direta do pool (role `postgres`), insere os dados, e só então executa `set local role authenticated` com as claims JWT da coordenação.

```javascript
// CORRIGIDO — pool.connect() como os demais testes que não usam como()
test("HF2-6: coordenação enxerga responsáveis da própria escola (RLS)", async () => {
  const c = await pool.connect();
  try {
    await c.query("begin");
    // insere como postgres antes de mudar o role
    await c.query(
      "insert into usuarios (id, escola_id, papel, nome) values ($1, $2, 'responsavel', 'Resp RLS HF2') on conflict do nothing",
      [RESP_HF2, ESCOLA_A],
    );
    const claims = JSON.stringify({
      sub: IDS.coordA.sub,
      role: "authenticated",
      app_metadata: { escola_id: ESCOLA_A, papel: "coordenacao" },
    });
    await c.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    await c.query("set local role authenticated");
    const r = await c.query(
      "select id from usuarios where id = $1 and papel = 'responsavel'",
      [RESP_HF2],
    );
    assert.equal(r.rows.length, 1, "coordenação deve ver responsável da própria escola");
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
});
```

---

## 5. Segurança — nada foi afrouxado

| Restrição | Status |
|---|---|
| Sem `service_role` no front | ✅ Não alterado |
| Sem deleção de usuário Auth | ✅ Não alterado |
| Sem deleção de aluno | ✅ Não alterado |
| Sem deleção de responsável | ✅ Não alterado |
| RLS intacto | ✅ Nenhuma migration alterada |
| Isolamento entre escolas | ✅ HF2-7 continua testando cross-escola |
| Comportamento da HF1 | ✅ Não alterado |
| Migrations antigas | ✅ Não alteradas |
| Testes apagados | ✅ Nenhum — todos os 10 foram corrigidos |
| Falha transformada em skip | ✅ Não — causas reais corrigidas |

---

## 6. Resultado esperado

- `npm run build` ✅ (build sem erros)
- `npm test` ✅ 0 falhas — 333 testes passando
- GitHub Actions `build-e-unitarios` ✅ verde

---

## 7. Pronto para merge

HF2 pronta para merge após CI verde.
