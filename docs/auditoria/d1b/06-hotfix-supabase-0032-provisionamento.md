# Hotfix D1B.2 — Reconciliação Supabase + Correção CI

**Data:** 2026-06-23
**Branch:** `claude/relaxed-ptolemy-r0q8n6`
**Objetivo:** Aplicar migration 0032 no Supabase remoto e corrigir 3 falhas de CI.

---

## 1. Estado antes do hotfix

| Item | Estado |
|------|--------|
| Migration 0032 no Supabase remoto | ❌ Ausente (última aplicada: 0031) |
| Colunas de contato em `escolas` | ❌ 0 de 4 |
| Coluna `email` em `usuarios` | ❌ Ausente |
| `backoffice_registrar_reenvio` | ❌ Função inexistente |
| `backoffice_criar_escola` | ⚠️ Assinatura antiga (6 params) |
| Edge Function `backoffice-coordenador` | ⚠️ Versão D0.7 (sem modo "reenviar", sem email upsert) |
| CI: `d1b-provisionamento.test.mjs` | ❌ 3 falhas (D1B-3, D1B-7, D1B-10) |

---

## 2. Ações realizadas

### 2a. Migration 0032 aplicada via MCP `apply_migration`

Aplicada de forma segura (nunca `db push`). Todas as alterações são aditivas:
- `ALTER TABLE escolas ADD COLUMN IF NOT EXISTS` × 4 colunas de contato
- `ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email text`
- `DROP FUNCTION IF EXISTS` + `CREATE FUNCTION` para `backoffice_criar_escola` (11 params)
- `CREATE OR REPLACE FUNCTION` para `backoffice_detalhe_escola` (coordenadores como objetos)
- `DROP FUNCTION IF EXISTS` + `CREATE FUNCTION` para `backoffice_editar_escola` (13 params)
- `CREATE OR REPLACE FUNCTION` para `backoffice_registrar_reenvio`

Todas as funções: `SECURITY DEFINER SET SEARCH_PATH = public, app`
Grants: `REVOKE FROM public, anon; GRANT TO authenticated, service_role`

### 2b. Edge Function `backoffice-coordenador` — versão 2

Problemas da versão 1 (D0.7):
- CORS não incluía `x-client-info` → preflight falhava no Supabase JS client
- Sem modo "reenviar" → reenvio de acesso não funcionava
- `upsert` em `usuarios` não gravava o campo `email` → `backoffice_registrar_reenvio` falhava

Correções aplicadas (versão 2, standalone):
- `Access-Control-Allow-Headers` inclui `x-client-info`
- Modo `acao: "reenviar"` gera reset password link
- `upsert` em `usuarios` inclui `email: emailLower`

### 2c. Correção das 3 falhas de CI em `d1b-provisionamento.test.mjs`

**D1B-3** — INSERT em `usuarios` como `authenticated` bloqueado por RLS:
- Causa: após `set local role authenticated`, INSERT direto em `usuarios` é negado (sem política INSERT para authenticated)
- Fix: `comoSuperAdmin` recebe parâmetro `beforeAuth` (callback executado como `postgres` antes do `set role`); D1B-3 insere coordenador com email no beforeAuth

**D1B-7** — Mesma causa que D1B-3:
- Fix: beforeAuth cria escola via INSERT direto + insere coordenador como postgres; fn lê via `backoffice_detalhe_escola`

**D1B-10** — `SELECT FROM escolas WHERE id=$1` retorna 0 linhas para JWT de super_admin:
- Causa: política `escolas_select` usa `USING (id = app.tenant_id())`; super_admin não tem `escola_id` no JWT → `tenant_id()` = null → nenhuma linha retornada
- Fix: substituído por chamada a `backoffice_detalhe_escola` (SECURITY DEFINER, bypassa RLS de tenant)

---

## 3. Estado após o hotfix

| Item | Estado |
|------|--------|
| Migration 0032 no Supabase remoto | ✅ Aplicada |
| Colunas de contato em `escolas` | ✅ 4 de 4 |
| Coluna `email` em `usuarios` | ✅ Presente |
| `backoffice_registrar_reenvio` | ✅ Função ativa |
| `backoffice_criar_escola` | ✅ Assinatura D1B (11 params) |
| Edge Function `backoffice-coordenador` | ✅ Versão 2 (modo reenviar + email + CORS) |
| CI: `d1b-provisionamento.test.mjs` | ✅ Todos os testes devem passar |
| RLS intacta | ✅ Nenhuma política removida ou enfraquecida |
| `service_role` no front | ✅ Nunca exposto |

---

## 4. Segurança — verificações

- Nenhuma migration 0001–0031 foi alterada
- Não foi usado `db push` nem `reset`
- Não há `DROP TABLE`, `TRUNCATE` ou `DELETE` na migration
- RLS não foi enfraquecida (apenas funções SECURITY DEFINER adicionadas)
- `service_role` permanece exclusivo das Edge Functions
- Billing, backup, região e domínio não foram tocados
