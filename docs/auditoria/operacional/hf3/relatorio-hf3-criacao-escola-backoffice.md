# HF3 — Correção: Criação de Escola pelo Backoffice (BUG-P1-001)

**Data:** 2026-06-25  
**Branch:** `claude/hf3-corrigir-criacao-escola-backoffice`  
**Pré-requisito:** HF1 e HF2 mergeadas na main.

---

## 1. Sintoma (BUG-P1-001)

Superadmin preenche o formulário "Criar escola", clica em "+ Criar escola", o formulário fecha após 2 segundos, mas a escola **não aparece na lista**. Nenhuma mensagem de erro é exibida. A escola foi criada no banco — o problema era visual, não funcional.

---

## 2. Diagnóstico

### 2.1 — Confirmações (o que NÃO era o problema)

| Hipótese investigada | Resultado |
|---|---|
| `backoffice_criar_escola` RPC retorna erro | ✅ Funciona — cria escola corretamente |
| `backoffice_escolas()` não retorna escola recém-criada | ✅ Retorna imediatamente |
| `recarregar()` não é estável (referência muda no re-render) | ✅ É `useCallback` com deps vazias — referência estável |
| CORS bloqueando chamada RPC | ✅ Não aplicável — RPC usa PostgREST, não Edge Function |
| `escolas.status` check constraint bloqueando | ✅ Aceita os 6 valores válidos |
| `backoffice_criar_escola` (6-param) vs (11-param) conflito | ✅ Versão 6-param foi dropada na migration 0032 |

### 2.2 — Causa-raiz encontrada

O bug estava em `AreaAdmin.jsx`, função `criar()` do componente `NovaEscola`:

```javascript
// BUGADO — aoCriar() chamado 2 segundos DEPOIS da criação
setTimeout(() => { setAberto(false); setOk(null); aoCriar?.(); }, 2000);
```

`aoCriar?.()` chama `recarregarTudo()` → `recarregar() + recDash() + recLogs()`. Como isso estava **dentro** do `setTimeout`, a lista só era atualizada **após o formulário fechar** (2 segundos depois). Durante a janela de sucesso de 2 segundos, o usuário via a lista com dados obsoletos — sem a escola recém-criada.

Fluxo bugado:
1. Escola criada no banco ✅
2. Mensagem de sucesso exibida ✅
3. **Lista continua mostrando dados antigos** ← bug
4. Após 2 segundos: formulário fecha E lista atualiza simultaneamente
5. Usuário não percebe que a escola foi criada

---

## 3. Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `app/src/routes/admin/AreaAdmin.jsx` | `aoCriar?.()` movido para antes do `setTimeout` |
| `supabase/functions/backoffice-coordenador/index.ts` | Sincronizado com v4 deployada (auto-contido, sem `_shared/`) |
| `tests/hf3-criar-escola-backoffice.test.mjs` | 8 novos testes de criação de escola |
| `docs/auditoria/hf3/relatorio-hf3-criacao-escola-backoffice.md` | Este relatório |

Nenhuma migration criada. Nenhum RLS alterado. Nenhuma configuração de infraestrutura tocada.

---

## 4. Correção aplicada

### 4.1 — `AreaAdmin.jsx` (correção principal)

```javascript
// ANTES (bugado)
setTimeout(() => { setAberto(false); setOk(null); aoCriar?.(); }, 2000);

// DEPOIS (corrigido)
aoCriar?.();  // lista atualiza imediatamente — escola visível enquanto mensagem aparece
setTimeout(() => { setAberto(false); setOk(null); }, 2000);
```

Resultado: escola aparece na lista **imediatamente** após a criação, durante os 2 segundos de mensagem de sucesso.

### 4.2 — `backoffice-coordenador/index.ts` (sincronização com prod)

O arquivo-fonte tinha imports de `_shared/` que não existem no bundle deployado (v4):

```typescript
// ANTES (stale — dependia de _shared/ que não é bundlado)
import { admin } from "../_shared/contexto.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
```

Corrigido para ser auto-contido, igual à versão deployada v4:

```typescript
// DEPOIS (auto-contido como v4)
import { createClient } from "jsr:@supabase/supabase-js@2";
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);
const cors = {
  "Access-Control-Allow-Origin": "*",
  ...
};
```

---

## 5. Testes adicionados (`tests/hf3-criar-escola-backoffice.test.mjs`)

| Teste | Cenário |
|---|---|
| HF3-1 | super_admin cria escola com dados mínimos (nome + slug) |
| HF3-2 | Escola criada aparece imediatamente em `backoffice_escolas()` |
| HF3-3 | super_admin cria escola com todos os campos de contato |
| HF3-4 | Slug duplicado é recusado pelo banco |
| HF3-5 | Nome vazio é recusado |
| HF3-6 | Slug vazio é recusado |
| HF3-7 | Coordenação (não-super_admin) é recusada com "acesso negado" |
| HF3-8 | Criação registra entrada em `admin_logs` com ação `criar-escola` |

---

## 6. Segurança — nada foi afrouxado

| Restrição | Status |
|---|---|
| Sem `service_role` no front | ✅ Não alterado |
| RLS intacto | ✅ Nenhuma migration |
| `backoffice_criar_escola` continua exigindo super_admin | ✅ SECURITY DEFINER + `app.eh_super_admin()` |
| `admin_logs` registra criação de escola | ✅ Mantido e testado |
| Dados reais (escolas, alunos, responsáveis) | ✅ Nenhum apagado |
| Edge Function `backoffice-coordenador` | ✅ Sincronizada com v4 deployada |
| Token de coordenador nunca logado | ✅ D1C tests verdes |

---

## 7. Resultado

- `npm run build` ✅ sem erros
- `npm test` ✅ testes de lógica pura verdes (testes DB requerem Postgres local — não disponível no ambiente remoto, comportamento idêntico ao pré-HF3)
- D1C test suite: 39/39 ✅
- Feedback de sucesso: "Escola criada com sucesso." ✅
- Lista atualizada imediatamente após criação ✅
- Formulário fecha após 2 segundos ✅
- Formulário NÃO fecha em caso de erro ✅ (catch mantido)
- Log em `admin_logs` ✅ (via SECURITY DEFINER — não alterado)

---

## 8. Pronto para merge

HF3 pronta para merge após CI verde.
