# SEG1-E — Edge Functions, CORS e Autenticação

**Fase:** SEG1 — Segurança Operacional Imediata
**Data:** 2026-06-25
**Projeto:** `bdjkgrzfzoamchdpobbl`

---

## 1. Funções no repositório vs. deploy

Deploy confirmado via `list_edge_functions` (todas **ACTIVE**):

| Função | Repo | Deploy | Versão | `verify_jwt` (plataforma) |
|--------|------|--------|--------|---------------------------|
| `provisionar-aluno` | ✅ | ✅ ACTIVE | 2 | **true** |
| `backoffice-coordenador` | ✅ | ✅ ACTIVE | 4 | **true** |
| `revogar-responsavel` | ✅ | ✅ ACTIVE | 1 | **true** |
| `gerar-meta` | ✅ | ✅ ACTIVE | 1 | **true** |
| `virar-semana` | ✅ | ✅ ACTIVE | 1 | **false** (intencional — ver 3.1) |
| `lgpd-titular` | ✅ | ✅ ACTIVE | 1 | **true** |

---

## 2. Tabela de conformidade (análise de código + metadados de deploy)

| Função | Repo | Deploy | OPTIONS | CORS | Auth | Papel | escola_id | Log | Status |
|--------|------|--------|---------|------|------|-------|-----------|-----|--------|
| `provisionar-aluno` | ✅ | ✅ | 200+CORS | `*` | token real | coordenação | `alunoDaEscola` | logs_acesso/coordenacao | **OK** |
| `backoffice-coordenador` | ✅ | ✅ | 200+CORS | `*` | token real | super_admin (`internal_admins`) | valida `escola_id` na escola | admin_logs | **OK** |
| `revogar-responsavel` | ✅ | ✅ | 200+CORS | `*` | token real | coordenação **ou** super_admin | filtra por `escola_id` (coord) | logs_coordenacao | **OK** |
| `gerar-meta` | ✅ | ✅ | 200+CORS | `*` | token real | coordenação | `alunoDaEscola` | — (não sensível: gera meta) | **OK** |
| `virar-semana` | ✅ | ✅ | 200+CORS | `*` | **service_role** | só operador | global (job) | — (operacional) | **OK** |
| `lgpd-titular` | ✅ | ✅ | 200+CORS | `*` | token real | coordenação | `alunoDaEscola` | logs_acesso | **OK** |

Legenda CORS `*`: `Access-Control-Allow-Origin: *` com
`Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type` e
`Access-Control-Allow-Methods: POST, OPTIONS`. Todas as funções respondem `OPTIONS`
com `200` + headers de CORS **antes** de qualquer lógica.

---

## 3. Detalhes de autenticação por função

### 3.1 Quem valida o quê
- **`provisionar-aluno`, `gerar-meta`, `lgpd-titular`:** exigem token; rejeitam quem não
  é `coordenacao` (403); confirmam que o aluno pertence à escola do chamador
  (`alunoDaEscola(aluno_id, quem.escola_id)`), bloqueando cross-tenant.
- **`backoffice-coordenador`:** só passa quem está em `internal_admins` com `ativo=true`
  (super_admin). Senão, `403`. Registra `admin_logs`.
- **`revogar-responsavel`:** coordenação revoga **só** vínculo da própria escola
  (`escolaFiltro = quem.escola_id`); super_admin pode em qualquer escola; demais papéis
  recebem `403`.
- **`virar-semana`:** `verify_jwt=false` **de propósito** — é chamada pelo `pg_cron` /
  operador com a **service_role**. O código compara `Authorization` com
  `SUPABASE_SERVICE_ROLE_KEY`; qualquer outro token → `403`. Nenhum papel de escola
  dispara virada global. (verify_jwt=true bloquearia o chamador legítimo, que não usa
  JWT de usuário.)

### 3.2 service_role só server-side
Todas usam `service_role` apenas no runtime Deno (`Deno.env.get`), nunca exposta na
resposta. Erros retornam mensagem genérica + CORS, sem vazar stack/segredo.

---

## 4. CORS — avaliação de risco

**Estado:** todas as funções usam `Access-Control-Allow-Origin: *`.

Há um helper com **allowlist de origem** pronto em `supabase/functions/_shared/cors.ts`
(`buildCorsHeaders`), porém **nenhuma função o utiliza** hoje — as funções inline
(`provisionar-aluno`, `backoffice-coordenador`, `revogar-responsavel`) são
**auto-contidas** ("sem imports de `_shared/`, compat. com o bundler MCP") e as demais
importam o `cors` curinga de `_shared/contexto.ts`.

**Por que `*` não é uma falha crítica aqui:** a autenticação é por **Bearer token**
(não por cookie de sessão). Sem cookies/credenciais automáticas, uma origem maliciosa
não consegue agir em nome do usuário só por causa do CORS curinga — ela ainda
precisaria do JWT da vítima. CORS curinga é perigoso sobretudo quando combinado com
`Allow-Credentials: true` + cookies, o que **não é o caso** (não há
`Access-Control-Allow-Credentials`).

**Recomendação (SEG2, não-bloqueante):** estreitar o `Allow-Origin` para a allowlist
(`buildCorsHeaders`) e padronizar as funções nesse helper, **sem** quebrar o bundler.
Não alterado na SEG1 para evitar risco de quebra de deploy sem ambiente de staging
(regra: não fazer merge com CORS quebrado).

---

## 5. Teste CORS ao vivo (OPTIONS) — NÃO executável nesta sessão

Os comandos `curl -i -X OPTIONS …` contra
`https://bdjkgrzfzoamchdpobbl.supabase.co/functions/v1/<fn>` **não puderam ser
executados deste ambiente**: a política de egresso da rede deste runtime **bloqueia**
o host (`gateway answered 403 to CONNECT … host: bdjkgrzfzoamchdpobbl.supabase.co`).
É uma limitação de rede do ambiente de execução, **não** uma resposta do Supabase.

> Evidência: `curl "$HTTPS_PROXY/__agentproxy/status"` registra
> `kind: connect_rejected` para o host. Per política, não se contorna — reporta-se.

**Verificação equivalente feita por código + deploy:** o handler `OPTIONS` de cada
função retorna `new Response("ok", { headers: cors })` (200) com os 4 headers exigidos
(`authorization, x-client-info, apikey, content-type`) e métodos `POST, OPTIONS`. O
front em produção consome essas funções normalmente (HF1/HF2/HF3), o que confirma o
preflight na prática.

### Checklist manual (dono, da máquina dele) — preflight ao vivo
```bash
for fn in provisionar-aluno backoffice-coordenador revogar-responsavel \
          gerar-meta virar-semana lgpd-titular; do
  echo "== $fn =="
  curl -i -X OPTIONS \
    "https://bdjkgrzfzoamchdpobbl.supabase.co/functions/v1/$fn" \
    -H 'Origin: https://rumo-a-aprova-o.vercel.app' \
    -H 'Access-Control-Request-Method: POST' \
    -H 'Access-Control-Request-Headers: authorization, x-client-info, apikey, content-type' \
    | grep -i 'access-control'
done
```
Esperado: `HTTP/2 200` + `access-control-allow-*` em todas.

---

## 6. Achados

| ID | Sev | Achado | Status |
|----|-----|--------|--------|
| E-1 | P2 / SEG2 | CORS curinga (`*`) — aceitável com auth por Bearer; estreitar para allowlist em SEG2 | Documentado |
| E-2 | OK | 6 funções deployadas e ACTIVE; auth + papel + escola_id corretos | Confirmado |
| E-3 | Manual | Preflight ao vivo não executável daqui (egresso bloqueado) — checklist seção 5 | Pendente manual |

**Veredito SEG1-E:** Edge Functions sensíveis têm **OPTIONS + CORS + Auth + checagem de
papel + isolamento por escola_id**. CORS curinga é risco **baixo** dado o modelo Bearer;
estreitamento fica para SEG2. **Critério "CORS mínimo correto" — ATENDIDO. Nenhum P0/P1.**
