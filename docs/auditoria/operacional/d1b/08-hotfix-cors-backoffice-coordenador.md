# D1B.1 — Hotfix: CORS da Edge Function backoffice-coordenador

**Data:** 2026-06-22  
**Branch:** `claude/d1b1-hotfix-cors-backoffice-coordenador`  
**Base:** `main` com D1B mergeada (commit 8b6a393)

---

## Sintoma

Ao tentar criar coordenador pelo backoffice em produção (Vercel → Supabase), o navegador bloqueava a chamada:

```
Access to fetch at
https://bdjkgrzfzoamchdpobbl.supabase.co/functions/v1/backoffice-coordenador
from origin https://rumo-a-aprova-o.vercel.app
has been blocked by CORS policy.

Request header field x-client-info is not allowed by
Access-Control-Allow-Headers in preflight response.
```

O usuário via no front: **"Não foi possível concluir a ação. Tente novamente."**

---

## Causa

O objeto `cors` em `supabase/functions/_shared/contexto.ts` declarava:

```ts
"Access-Control-Allow-Headers": "authorization, apikey, content-type",
```

O Supabase JS client (`supabase.functions.invoke`) envia automaticamente o header `x-client-info` em toda chamada. Como esse header não estava listado no preflight, o navegador bloqueava **antes** da lógica de negócio executar.

---

## Arquivos alterados

### 1. `supabase/functions/_shared/cors.ts` — **NOVO**

Criado helper dedicado com `buildCorsHeaders(req)`:
- Lista de origens permitidas (Vercel + localhost)
- Suporte a `ALLOWED_ORIGINS` via variável de ambiente
- Inclui `x-client-info` em `Access-Control-Allow-Headers`
- `Vary: Origin` para caches intermediários

```ts
"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
```

### 2. `supabase/functions/_shared/contexto.ts` — **CORRIGIDO**

Adicionado `x-client-info` ao objeto `cors` estático. Corrige **todas** as Edge Functions do projeto que usam o helper `cors` ou `json` de `contexto.ts`:
- `provisionar-aluno`
- `gerar-meta`
- `lgpd-titular`
- `virar-semana`

### 3. `supabase/functions/backoffice-coordenador/index.ts` — **ATUALIZADO**

- Importa `buildCorsHeaders` de `_shared/cors.ts` para matching por origem
- `OPTIONS` responde antes de qualquer validação (linha 1 do handler)
- **Todas** as respostas incluem `corsHeaders` (successo, validação, 403, 404, 500, catch)
- Campo `email_enviado` adicionado à resposta para o front distinguir SMTP disponível ou não

### 4. `app/src/shared/lib/erros.js` — **ATUALIZADO**

- Adicionadas entradas específicas para contextos `"provisionar"` e `"reenviar"`
- Padrões `EDGE_SEGURAS` para propagar mensagens funcionais seguras vindas da Edge Function (e-mail inválido, sem permissão, escola não encontrada, campos faltando) ao invés de mensagem genérica

---

## Headers adicionados

| Header | Valor |
|--------|-------|
| `Access-Control-Allow-Origin` | origem da requisição (se permitida) |
| `Access-Control-Allow-Headers` | `authorization, x-client-info, apikey, content-type` |
| `Access-Control-Allow-Methods` | `POST, OPTIONS` |
| `Access-Control-Max-Age` | `86400` |
| `Vary` | `Origin` |

---

## Fluxo de segurança após o hotfix

```
Navegador (Vercel)
  → OPTIONS → Edge Function → 200 com CORS (sem auth exigida)
  → POST    → Edge Function → valida JWT → valida internal_admins.ativo
                            → executa ação → resposta com CORS
```

`OPTIONS` **nunca** executa ação sensível.  
`POST` **sempre** exige token válido + super_admin ativo.

---

## Testes

### Preflight (OPTIONS)

```bash
curl -i -X OPTIONS \
  'https://bdjkgrzfzoamchdpobbl.supabase.co/functions/v1/backoffice-coordenador' \
  -H 'Origin: https://rumo-a-aprova-o.vercel.app' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: authorization, x-client-info, apikey, content-type'
```

Resultado esperado:
```
HTTP/2 200
access-control-allow-origin: https://rumo-a-aprova-o.vercel.app
access-control-allow-headers: authorization, x-client-info, apikey, content-type
access-control-allow-methods: POST, OPTIONS
vary: Origin
```

### POST sem autenticação

```bash
curl -i -X POST \
  'https://bdjkgrzfzoamchdpobbl.supabase.co/functions/v1/backoffice-coordenador' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://rumo-a-aprova-o.vercel.app' \
  -d '{"acao":"criar","escola_id":"...","nome":"Teste","email":"t@t.com"}'
```

Resultado esperado: `HTTP 403` com CORS headers (não erro de CORS).

### POST como coordenação (papel errado)

Token JWT de coordenação → `HTTP 403 acesso restrito ao super_admin` com CORS.

### POST como superadmin

Token JWT de internal_admin → coordenador criado, `admin_logs` registrado, resposta com `{ ok: true, ... }`.

---

## Status do deploy da Edge Function

A função deve ser deployada após o merge:

```bash
supabase functions deploy backoffice-coordenador
```

O arquivo `_shared/cors.ts` é copiado pelo CLI junto com a função pois Deno resolve imports relativos no bundle.

---

## Resultado no navegador

Após deploy:
1. Erro CORS desaparece do console
2. Formulário "Criar coordenador" envia com sucesso
3. Coordenador aparece na seção Coordenação
4. Checklist atualiza (item "Coordenador provisionado" ✅)
5. `admin_logs` registra `vincular-coordenador`

---

## Pendências

| # | Item | Fase |
|---|------|------|
| P1 | SMTP não configurado → `link` retorna `null` → front exibe aviso de configuração | Config de ambiente |
| P2 | Rota `/redefinir-senha` ainda não existe | D1C |
| P3 | `solicitacoes_acesso` para aluno/responsável não existe | D1C |
| P4 | `ALLOWED_ORIGINS` deve ser configurada no painel Supabase para preview deploys da Vercel | Config de ambiente |
