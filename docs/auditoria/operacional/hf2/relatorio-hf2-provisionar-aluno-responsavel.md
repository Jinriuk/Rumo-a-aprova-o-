# HF2 — Auditoria: Corrigir provisionar-aluno + Re-vínculo de Responsável

**Data:** 2026-06-24  
**Branch:** `claude/hf2-provisionar-aluno-cors-q4a4dq`  
**Pré-requisito:** HF1 mergeada na main (revogar-responsavel funcional).

---

## 1. Sintoma

Ao tentar criar novo acesso ou provisionar aluno/responsável pelo painel da coordenação, o navegador apresentava erro:

```
provisionar-aluno blocked by CORS policy
Request header field x-client-info is not allowed by
Access-Control-Allow-Headers in preflight response
```

Adicionalmente, após revogar um responsável com HF1, não havia fluxo claro para "revincular" esse responsável ao aluno — a única opção era criar uma conta nova (duplicando usuários).

---

## 2. Causa-raiz

### 2.1 — CORS

A função `provisionar-aluno/index.ts` importava `cors` e outros helpers de `_shared/contexto.ts`:

```typescript
import { admin, chamador, alunoDaEscola, cors, json, registrarLog } from "../_shared/contexto.ts";
```

O bundler do MCP Supabase **não processa imports de diretórios compartilhados** (`_shared/`) corretamente. Isso foi identificado e documentado no HF1, que resolveu o mesmo problema em `revogar-responsavel` tornando-a auto-contida.

Quando a função era deployada com imports de `_shared/`, o runtime falhava em resolver as dependências. O preflight (OPTIONS) resultava em resposta sem os headers CORS corretos — em especial sem `x-client-info` em `Access-Control-Allow-Headers` — bloqueando toda chamada pelo navegador via Supabase JS client (que envia `x-client-info` automaticamente).

### 2.2 — Ausência de fluxo de re-vínculo

A função `provisionar-aluno` só suportava dois tipos:
- `tipo: "aluno"` — cria credencial para aluno
- `tipo: "responsavel"` — cria nova conta Auth + vínculo

Após revogar um responsável (HF1 remove o registro em `vinculos_responsaveis`), o responsável continuava existindo em `usuarios` e `auth.users`, mas não havia forma de recriar apenas o vínculo. O único caminho era provisionar novamente, criando uma conta duplicada.

---

## 3. Funções afetadas

| Arquivo | Problema |
|---|---|
| `supabase/functions/provisionar-aluno/index.ts` | Import de `_shared/` impede deploy correto; sem suporte a re-vínculo |
| `app/src/shared/data/index.js` | Sem função para re-vínculo |
| `app/src/modules/pessoas/VinculosResponsavel.jsx` | Sem UI para re-vincular |

---

## 4. Correções aplicadas

### 4.1 — CORS: função auto-contida

`provisionar-aluno/index.ts` foi reescrita **sem imports de `_shared/`**, seguindo o padrão do HF1 (`revogar-responsavel`).

Headers CORS inline:

```typescript
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
```

O OPTIONS é respondido **antes** de qualquer validação de autenticação:

```typescript
if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
```

Todos os responses (sucesso, 400, 401, 403, 404, 409, 500) incluem os headers CORS via `json()`.

### 4.2 — Novo tipo: `vincular-responsavel`

A função agora aceita `tipo: "vincular-responsavel"` com parâmetro `responsavel_id`:

```typescript
const { tipo, aluno_id, nome, responsavel_id } = await req.json().catch(() => ({}));
```

Fluxo:
1. Valida que `responsavel_id` existe em `usuarios` com `papel = 'responsavel'` na mesma escola;
2. Verifica se já há vínculo em `vinculos_responsaveis` para `(aluno_id, responsavel_id)`;
3. Se já existe: retorna `{ estado: "vinculo_ja_existente" }`;
4. Se não existe: cria novo registro em `vinculos_responsaveis`;
5. Registra em `logs_coordenacao` com ação `revinculou-responsavel`.

**Não cria novo usuário Auth. Não duplica conta.**

### 4.3 — Estados de resposta

A função agora retorna estados explícitos:

| Estado | Situação |
|---|---|
| `aluno_criado` | Credencial de aluno gerada com sucesso |
| `responsavel_criado` | Nova conta e vínculo de responsável criados |
| `vinculo_reativado` | Responsável existente vinculado novamente ao aluno |
| `vinculo_ja_existente` | Vínculo já ativo — nenhuma ação necessária |
| `erro_validacao` | Payload inválido ou entidade não encontrada |
| `erro_interno` | Falha inesperada no servidor |

### 4.4 — Front-end

**`app/src/shared/data/index.js`**:
- `vincularResponsavelExistente(alunoId, responsavelId)` — chama `tipo: "vincular-responsavel"`
- `listarResponsaveisEscola()` — lista `usuarios` com `papel = 'responsavel'` (RLS isola por escola)

**`app/src/modules/pessoas/VinculosResponsavel.jsx`**:
- Botão "Vincular responsável existente" no modal
- Carrega lista de responsáveis da escola não vinculados ao aluno atual
- Permite selecionar e vincular com feedback claro:
  - "Responsável vinculado novamente ao aluno."
  - "Este responsável já estava vinculado a este aluno."

---

## 5. Testes CORS

### 5.1 — OPTIONS preflight (esperado: 200, headers CORS corretos)

```bash
curl -i -X OPTIONS \
  'https://bdjkgrzfzoamchdpobbl.supabase.co/functions/v1/provisionar-aluno' \
  -H 'Origin: https://rumo-a-aprova-o.vercel.app' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: authorization, x-client-info, apikey, content-type'
```

Esperado:
```
HTTP/2 200
access-control-allow-origin: *
access-control-allow-headers: authorization, x-client-info, apikey, content-type
access-control-allow-methods: POST, OPTIONS
```

### 5.2 — POST sem auth (esperado: 401, sem erro CORS)

```bash
curl -i -X POST \
  'https://bdjkgrzfzoamchdpobbl.supabase.co/functions/v1/provisionar-aluno' \
  -H 'Content-Type: application/json' \
  -d '{"tipo":"aluno","aluno_id":"qualquer"}'
```

Esperado: `HTTP 401` com body `{"error":"não autenticado","estado":"erro_validacao"}` e headers CORS presentes.

### 5.3 — POST com aluno/responsável (esperado: 403)

JWT de aluno ou responsável deve retornar `HTTP 403`:
```json
{"error":"só a coordenação provisiona acesso","estado":"erro_validacao"}
```

### 5.4 — POST com coordenação da escola correta (esperado: 200/201)

JWT de coordenação com `escola_id` correto e `aluno_id` válido da escola → provisiona com sucesso.

### 5.5 — POST com coordenação de outra escola (esperado: 404)

`aluno_id` de escola diferente → `HTTP 404` (aluno não encontrado nesta escola).

---

## 6. Testes de re-vínculo

Arquivo: `tests/hf2-provisionar-aluno.test.mjs`

| Teste | Valida |
|---|---|
| HF2-1 | Aluno continua existindo após revogação |
| HF2-2 | Responsável continua em `usuarios` após revogação |
| HF2-3 | Responsável revogado não tem vínculo ativo |
| HF2-4 | É possível criar novo vínculo para responsável existente |
| HF2-5 | Vínculo duplicado é recusado pelo banco |
| HF2-6 | Coordenação da escola A enxerga responsáveis da escola A (RLS) |
| HF2-7 | Responsável de outra escola não é visível para coordenação A (RLS) |
| HF2-8 | Após re-vinculação, responsável tem entry em `vinculos_responsaveis` |
| HF2-9 | Log de re-vínculo inserido em `logs_coordenacao` |
| HF2-10 | Responsável revinculado volta a enxergar o aluno (RLS) |

---

## 7. Logs

A função registra:

| Ação | Tabela | Quando |
|---|---|---|
| `provisionou-aluno` | `logs_acesso` | Nova credencial de aluno gerada |
| `provisionou-responsavel` | `logs_acesso` | Nova credencial de responsável gerada |
| `revinculou-responsavel` | `logs_coordenacao` | Responsável existente vinculado novamente |

Campos em `logs_coordenacao` para re-vínculo:
```json
{
  "responsavel_id": "...",
  "aluno_id": "...",
  "nome_responsavel": "...",
  "nome_aluno": "..."
}
```

---

## 8. Segurança

- `service_role` permanece apenas no servidor (Edge Function), nunca no front.
- Nenhum usuário Auth é apagado.
- Nenhum aluno é apagado.
- Nenhum responsável é apagado.
- RLS e isolamento por escola permanecem intactos.
- Coordenação não pode vincular responsável de outra escola (validado via `eq("escola_id", quem.escola_id)`).
- Aluno e responsável não executam provisionamento (bloqueado em `quem.papel !== "coordenacao"`).

---

## 9. Deploy

```bash
supabase functions deploy provisionar-aluno
```

Confirmado via Supabase MCP: função atualizada com a versão auto-contida.

---

## 10. Pendências

Nenhuma pendência crítica. Itens de melhoria futura (fora do escopo do hotfix):

- Busca de responsável por nome no modal de re-vínculo (atualmente lista todos da escola).
- Notificação ao responsável revinculado via e-mail (infraestrutura de e-mail para responsáveis ainda não implementada).
- Fluxo de revogação dentro do modal de re-vínculo (atualmente só na lista de alunos).

---

## 11. Critérios de aceite

| Critério | Status |
|---|---|
| `provisionar-aluno` não apresenta erro CORS | ✅ Corrigido (função auto-contida) |
| `x-client-info` é aceito no preflight | ✅ Incluído em `Access-Control-Allow-Headers` |
| POST sem auth bloqueado (401) | ✅ Validado antes de qualquer lógica de negócio |
| Coordenação consegue provisionar corretamente | ✅ Fluxo existente mantido |
| Responsável revogado pode ser vinculado novamente | ✅ Novo tipo `vincular-responsavel` |
| Responsável revinculado volta a ver o aluno | ✅ Vínculo em `vinculos_responsaveis` restaurado |
| Nenhuma conta apagada indevidamente | ✅ Sem `deleteUser` no fluxo de re-vínculo |
| Sem duplicidade de vínculo | ✅ Verificação antes de inserir |
| Logs gerados | ✅ `logs_acesso` e `logs_coordenacao` |
| Relatório entregue | ✅ Este documento |
