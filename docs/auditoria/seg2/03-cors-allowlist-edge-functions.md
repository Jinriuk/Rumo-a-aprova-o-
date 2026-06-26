# SEG2 / S2-D — CORS allowlist nas Edge Functions

**Fase:** SEG2 · **Data:** 2026-06-26
**Pendência herdada:** E-1 (P2)
**Arquivos alterados:** `supabase/functions/_shared/cors.ts`, `_shared/contexto.ts` e as 6 funções.

---

## 1. O que mudou

**Antes (SEG1):** todas as funções respondiam `Access-Control-Allow-Origin: *` (curinga).
Aceitável com auth por **Bearer** (sem cookies/credenciais), mas superfície maior que o
necessário.

**Depois (SEG2):** as funções respondem o header **só refletindo o Origin quando ele está
na allowlist**. Origem fora da lista **não recebe** `Access-Control-Allow-Origin` → o
navegador bloqueia a leitura da resposta. Sem `Access-Control-Allow-Credentials` (modelo
Bearer).

### Allowlist (configurável por ambiente)
```
https://rumo-a-aprova-o.vercel.app      (produção)
http://localhost:5173                   (dev local Vite)
http://localhost:3000                   (dev local alternativo)
+ previews do PRÓPRIO projeto: ^https://rumo-a-aprova-o-[a-z0-9-]+\.vercel\.app$
```
O secret **`ALLOWED_ORIGINS`** (CSV) nas funções **substitui** a lista padrão. Assim,
quando o **domínio próprio** entrar (julho), basta definir:
```
ALLOWED_ORIGINS="https://seudominio.com.br,https://www.seudominio.com.br,https://rumo-a-aprova-o.vercel.app"
```
**sem mexer no código**. (Não libera `*.vercel.app` genérico — só previews deste projeto.)

---

## 2. Arquitetura aplicada (sem quebrar o bundler)

- **`_shared/cors.ts`** — helper canônico `buildCorsHeaders(req)` + `origemPermitida(origin)`.
- **`_shared/contexto.ts`** — re-exporta como `corsHeaders`; o Supabase CLI empacota
  `cors.ts` junto via import relativo (mecanismo já usado no hotfix d1b/hf3).
- **Funções que importam `_shared/contexto.ts`** (`gerar-meta`, `lgpd-titular`,
  `virar-semana`): usam `corsHeaders(req)` e definem `json` como closure local — **todas as
  chamadas `json(...)` permaneceram idênticas**, mudança mínima.
- **Funções auto-contidas** (`provisionar-aluno`, `backoffice-coordenador`,
  `revogar-responsavel`): mantêm a topologia "sem import de `_shared/`" e recebem uma
  **cópia mínima** do helper (comentada, apontando para a versão canônica).

Cada função: responde `OPTIONS` (200) com CORS; aceita `authorization, x-client-info,
apikey, content-type`; mantém CORS em **todas** as respostas (200/4xx/5xx) via o `json`
local que herda o `cors` por requisição; não quebra o Supabase JS client.

---

## 3. Tabela de status

| Função | Antes | Depois | Origem permitida OK | Origem bloqueada OK | Deploy | Status |
|--------|-------|--------|---------------------|---------------------|--------|--------|
| `provisionar-aluno` | `*` | allowlist | ⏳ curl do dono | ⏳ curl do dono | ⏳ dono | **código pronto** |
| `backoffice-coordenador` | `*` | allowlist | ⏳ | ⏳ | ⏳ | **código pronto** |
| `revogar-responsavel` | `*` | allowlist | ⏳ | ⏳ | ⏳ | **código pronto** |
| `gerar-meta` | `*` | allowlist | ⏳ | ⏳ | ⏳ | **código pronto** |
| `virar-semana` | `*` | allowlist | ⏳ | ⏳ | ⏳ | **código pronto** |
| `lgpd-titular` | `*` | allowlist | ⏳ | ⏳ | ⏳ | **código pronto** |

⏳ = pendente do dono. **Motivo:** esta sessão **não tem acesso Supabase** (sem MCP exposto)
e o **egresso de rede está bloqueado** (`403 CONNECT` para `*.supabase.co`) → não dá para
deployar nem rodar o preflight daqui. O código está pronto, mergeável e **build + 341 testes
verdes** (a suíte node não exercita Deno, mas confirma que nada mais quebrou).

---

## 4. Deploy (dono) — passo a passo

> Risco controlado: a allowlist **inclui a origem de produção**, então o app ao vivo
> continua recebendo o Origin refletido. O risco só existe se a lista for mal configurada.
> Como não há staging ainda, faça o deploy e **rode os curls da seção 5 logo em seguida**.

```bash
# da raiz do repo, autenticado no projeto:
supabase functions deploy provisionar-aluno backoffice-coordenador \
  revogar-responsavel gerar-meta virar-semana lgpd-titular
# (ou via MCP deploy_edge_function, função a função)
```
Opcional (quando houver domínio próprio): definir o secret
```bash
supabase secrets set ALLOWED_ORIGINS="https://seudominio.com.br,https://www.seudominio.com.br,https://rumo-a-aprova-o.vercel.app"
```

---

## 5. Testes obrigatórios (dono, da máquina dele)

### Origem permitida → espera `200` + `access-control-allow-origin` refletido
```bash
for fn in provisionar-aluno backoffice-coordenador revogar-responsavel \
          gerar-meta virar-semana lgpd-titular; do
  echo "== $fn =="
  curl -i -X OPTIONS \
    "https://bdjkgrzfzoamchdpobbl.supabase.co/functions/v1/$fn" \
    -H 'Origin: https://rumo-a-aprova-o.vercel.app' \
    -H 'Access-Control-Request-Method: POST' \
    -H 'Access-Control-Request-Headers: authorization, x-client-info, apikey, content-type' \
    2>/dev/null | grep -i 'access-control-allow-origin'
done
```
**Esperado:** `access-control-allow-origin: https://rumo-a-aprova-o.vercel.app` em todas.

### Origem NÃO permitida → espera **ausência** do header
```bash
for fn in provisionar-aluno backoffice-coordenador revogar-responsavel \
          gerar-meta virar-semana lgpd-titular; do
  echo "== $fn =="
  curl -i -X OPTIONS \
    "https://bdjkgrzfzoamchdpobbl.supabase.co/functions/v1/$fn" \
    -H 'Origin: https://evil.example.com' \
    -H 'Access-Control-Request-Method: POST' \
    -H 'Access-Control-Request-Headers: authorization, x-client-info, apikey, content-type' \
    2>/dev/null | grep -i 'access-control-allow-origin' || echo "  (sem allow-origin — BLOQUEADO OK)"
done
```
**Esperado:** **nenhuma** linha `access-control-allow-origin` (origem bloqueada).

### Smoke funcional (console aberto) após o deploy
- [ ] login coordenação → provisionar aluno → gerar meta → revogar/revincular responsável → LGPD
- [ ] nenhum erro de CORS no console; o app de produção continua funcionando

> Preencher esta tabela/seção com os resultados reais após o deploy (substituir os ⏳).

---

## 6. Critério de aceite (SEG2)

> ✅ **Atendido em código.** CORS curinga `*` **removido** das 6 funções sensíveis e
> substituído por allowlist refletida, configurável por `ALLOWED_ORIGINS`. Build + 341
> testes verdes. **Deploy + verificação por curl** ficam como passo do dono (sem acesso
> Supabase e egresso bloqueado nesta sessão) — comandos turnkey acima. Não bloqueia o
> merge: o front de produção está na allowlist.
