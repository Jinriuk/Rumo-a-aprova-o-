# SEG2 / S2-L — Secrets em Vercel / GitHub / Supabase

**Fase:** SEG2 · **Data:** 2026-06-26

> **Apenas nomes e status.** Nenhum valor de secret aparece neste relatório.
> Referência: `seg1/02-secrets-variaveis.md`, `docs/operacao/ambientes-e-variaveis.md`.

---

## 1. Front — Vercel Environment Variables + `app/.env.production`

| Nome | Classificação | Status |
|------|---------------|--------|
| `VITE_SUPABASE_URL` | **Publicável** (client-side) | OK — pública por design |
| `VITE_SUPABASE_ANON_KEY` | **Publicável** (client-side, role `anon`) | OK — segurança é a RLS |

> Confirmado na SEG1: **nenhum** `service_role`, SMTP, JWT secret ou `DATABASE_URL` no front.
> Teste de CI **falha** se `service_role` aparecer em `app/src/`.

## 2. Supabase — Edge Function Secrets (server-side)

| Nome | Classificação | Status |
|------|---------------|--------|
| `SUPABASE_URL` | server-side (injetado) | OK |
| `SUPABASE_SERVICE_ROLE_KEY` | **Sensível** (server-side, privilégio elevado) | OK — só nas funções; nunca no front/repo |
| `SUPABASE_ANON_KEY` | publicável (injetado) | OK |
| `ALLOWED_ORIGINS` | **config (não-secreto)** — CSV de origens CORS | **Novo (SEG2)**; opcional; definir com o domínio (julho) |

## 3. GitHub — Actions Secrets

| Nome | Classificação | Status |
|------|---------------|--------|
| `E2E_SUPABASE_URL` | sensível (staging) | **Pendente** — definir ao criar staging (doc 07) |
| `E2E_SUPABASE_ANON_KEY` | publicável (staging) | **Pendente** — idem |

> Gate principal do CI (`build-e-unitarios`) **não usa secret**. `service_role` **nunca** entra no CI.

## 4. Supabase — Auth settings (não são "secrets", mas config sensível)

| Item | Status |
|------|--------|
| Site URL / Redirect URLs | OK (sem wildcard amplo) — doc 09 |
| Política de senha | endurecida (≥8 + letras e dígitos) — doc 01 |
| SMTP | ausente (fallback manual) — doc 09 |

---

## 5. Ações de rotação/remoção

| Item | Ação |
|------|------|
| Senhas de **demo** versionadas | **Rotacionar/parar de versionar** antes do real (doc 08) |
| `service_role` | **Rotacionar** se algum dia vazar em commit/log (e reescrever história) |
| `anon` key | rotacionar só se necessário (pública por design) |

## 6. Critério de aceite (SEG2)

> ✅ **Secrets revisados.** Cada secret classificado (publicável/sensível/config) e
> localizado na camada correta. Nenhum valor exposto. Pendências: `E2E_*` (staging),
> `ALLOWED_ORIGINS` (domínio), rotação das credenciais de demo (antes do real).
