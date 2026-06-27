# SEG1-C — Service Role e Chaves Sensíveis

**Fase:** SEG1 — Segurança Operacional Imediata
**Data:** 2026-06-25

---

## 1. Mapa de uso de `service_role`

```
git grep -n -i "service_role|SERVICE_ROLE" -- . ':(exclude)docs/*'
```

| Local | Uso | Avaliação |
|-------|-----|-----------|
| `supabase/functions/_shared/contexto.ts:8` | `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` no client admin | server-side ✅ |
| `supabase/functions/provisionar-aluno/index.ts:18` | idem (função auto-contida) | server-side ✅ |
| `supabase/functions/backoffice-coordenador/index.ts:28` | idem | server-side ✅ |
| `supabase/functions/revogar-responsavel/index.ts:16` | idem | server-side ✅ |
| `supabase/functions/virar-semana/index.ts:18` | compara token recebido com a chave (gate de operador) | server-side ✅ |
| `scripts/criar-coordenacao.mjs` / `criar-super-admin.mjs` / `seed-auth-usuarios.mjs` | `process.env.SUPABASE_SERVICE_ROLE_KEY` | operador, server-side ✅ |
| `supabase/migrations/*.sql` | `grant … to service_role` (papel do Postgres) | DDL ✅ |
| `.env.example` | placeholder | ✅ |
| `app/src/**` | **nenhuma ocorrência** | ✅ |

---

## 2. Respostas obrigatórias

| Pergunta | Resposta | Evidência |
|----------|----------|-----------|
| `service_role` aparece no front? | **NÃO** | `git grep service_role -- app/src/` → vazio; teste de CI guarda isso |
| `service_role` aparece em docs? | **Sim, como instrução** (placeholder), nunca valor real | menções em `docs/`, `README.md` |
| `service_role` está hardcoded? | **NÃO** | sempre `Deno.env.get` / `process.env` |
| `service_role` é usado apenas server-side? | **SIM** | só edge functions + scripts de operador |
| Há risco de vazamento? | **NÃO no código.** Risco residual = quem tiver acesso aos Secrets do Supabase / ambiente do operador | — |

---

## 3. Como o front chama as funções de forma segura

- O front (`app/src/shared/data/index.js`) chama RPCs e Edge Functions com a **anon
  key** + o **JWT do usuário logado** (Authorization Bearer). Nunca toca em `service_role`.
- As Edge Functions identificam o chamador pelo **token real** (`admin.auth.getUser`),
  não por campo de formulário, e só então usam `service_role` para escrever com
  privilégio. O privilégio elevado nunca sai do servidor.

```
front (anon + JWT do usuário)  ──►  Edge Function  ──►  admin client (service_role, só no Deno)
                                         │
                                         └─ valida token, papel e escola_id ANTES de agir
```

---

## 4. Achados

Nenhum achado de exposição de `service_role`. Há um teste de regressão no CI que
**falha** se `service_role` aparecer em `app/src/` — guarda automática mantida.

**Veredito SEG1-C:** `service_role` **confinada ao servidor**, sem hardcode, sem
exposição no front. **Critério de aceite "não há service_role no front" — ATENDIDO.**
