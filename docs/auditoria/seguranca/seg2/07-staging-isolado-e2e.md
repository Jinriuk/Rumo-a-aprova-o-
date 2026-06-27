# SEG2 / S2-H — Ambiente staging isolado + E2E

**Fase:** SEG2 · **Data:** 2026-06-26
**Referências:** `docs/operacao/e2e-ambiente.md`, `.github/workflows/ci.yml` (job `e2e-guard`).

---

## 1. Estado atual

| Item | Estado |
|------|--------|
| Projeto Supabase de staging | **Não existe** (só o `bdjkgrzfzoamchdpobbl` demo) |
| Vercel preview | Previews por branch existem (deploy automático), mas **apontam para o mesmo Supabase** |
| Secrets E2E (`E2E_SUPABASE_URL/ANON_KEY`) | **Ausentes** → CI **pula E2E explicitamente** (não finge verde) |
| E2E (Playwright) | Presente no repo; só roda contra projeto isolado |

> O CI **já está desenhado** para staging: o job `e2e-guard` lê `E2E_SUPABASE_URL` e, se
> ausente, **pula a E2E com aviso** (nunca roda contra o banco de demo). Falta o ambiente.

---

## 2. Plano de criação (quando houver Pro/2º projeto — julho)

1. [ ] Criar **projeto Supabase staging** separado (idealmente já em **sa-east-1**, alinhando
       com `docs/operacao/plano-migracao-sa-east-1.md`).
2. [ ] Aplicar migrations com runbook seguro (`supabase db push` + `scripts/checar-migrations.mjs`
       antes/depois; ver `docs/operacao/runbook-migrations-supabase.md`).
3. [ ] Aplicar **apenas seeds de catálogo global** (sem seeds de demo/dev) +
       **dados sintéticos** (sem dado real).
4. [ ] Deployar as **6 Edge Functions** no staging (com `ALLOWED_ORIGINS` do domínio de staging).
5. [ ] Configurar **Vercel staging/preview** apontando para o Supabase de staging
       (variáveis próprias `VITE_SUPABASE_URL/ANON_KEY`).
6. [ ] Configurar **GitHub Secrets** `E2E_SUPABASE_URL` / `E2E_SUPABASE_ANON_KEY` → a E2E passa a rodar.
7. [ ] Rodar **Playwright/E2E** e registrar resultado.
8. [ ] (Opcional) rodar **OWASP ZAP baseline** contra staging (nunca produção).

---

## 3. Regra

**Nunca** usar dados reais em staging. Dados sintéticos sempre.

---

## 4. Critério de aceite (SEG2)

> ✅ **Planejado com checklist claro.** Staging não existe ainda (depende de 2º projeto/Pro,
> julho), mas o **plano e o runbook estão prontos** e o CI **já suporta** o ambiente isolado
> (job `e2e-guard`). Criar staging é pré-requisito para QA2 (carga) e para ZAP.
