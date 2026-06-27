# SEG1-B — Secrets e Variáveis de Ambiente

**Fase:** SEG1 — Segurança Operacional Imediata
**Data:** 2026-06-25

---

## 1. Princípio

| Camada | Pode conter | Nunca pode conter |
|--------|-------------|-------------------|
| Front (Vite / `app/`) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (públicas) | `service_role`, SMTP, JWT secret, `DATABASE_URL` com senha |
| Edge Functions (`supabase/functions/`) | lê do ambiente (`Deno.env.get`) | valores hardcoded |
| Scripts de operador (`scripts/`) | lê do ambiente (`process.env`) | valores hardcoded |
| CI (`.github/workflows/`) | nada sensível (gate não precisa de secret) | `service_role` |

---

## 2. Inventário por local

| Local | Variáveis encontradas | Classificação |
|-------|----------------------|---------------|
| `app/.env.production` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | **OK** — públicas por design |
| `app/src/lib/supabase.js` | lê `import.meta.env.VITE_SUPABASE_URL` / `_ANON_KEY` | **OK** — só públicas; lança erro se faltarem |
| `app/src/` (resto) | nenhuma var sensível | **OK** |
| `.env.example` | modelo com placeholders (`so-na-sua-maquina-e-no-servidor`) | **OK** — sem valor real |
| `supabase/functions/_shared/contexto.ts` | `Deno.env.get("SUPABASE_URL")`, `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` | **OK** — server-side, do ambiente |
| `supabase/functions/*/index.ts` | idem (cada função lê do `Deno.env`) | **OK** |
| `scripts/*.mjs` | `process.env.SUPABASE_SERVICE_ROLE_KEY`, `process.env.COORD_SENHA`, etc. | **OK** — operador, do ambiente; aborta se faltar |
| `scripts/seed-auth-usuarios.mjs` | **senhas de DEMO em texto claro** | **Risco** — ver SEG1-A A-1 (P2) |
| `.github/workflows/ci.yml` | `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY` (GitHub Secrets, opcionais) | **OK** — não embutidos; `service_role` ausente |
| `docs/` , `README.md` | menções de `SERVICE_ROLE` como **instrução** (placeholder) | **OK** |
| `vercel.json` | só `headers` / `rewrites` / `buildCommand` | **OK** |

---

## 3. Confirmações-chave

### 3.1 Front só tem chaves públicas — **OK**
```
git grep -n -i "RESEND_API_KEY|SMTP_PASS|JWT_SECRET|DATABASE_URL|private_key" -- app/
# → nenhuma ocorrência
```

### 3.2 `service_role` nunca no front — **OK**
```
git grep -n service_role -- app/src/
# → vazio
```
(Há teste automatizado que falha o CI se isso mudar — ver `tests/d1c-email.test.mjs`
e `tests/i2-onboarding-alunos.test.mjs`: *"nenhum arquivo em app/src/ contém service_role"*.)

### 3.3 Edge Functions / scripts leem do ambiente — **OK**
Nenhum valor de `service_role` está hardcoded; todas as referências são
`Deno.env.get(...)` (funções) ou `process.env...` (scripts), com checagem de ausência.

---

## 4. Achados

| ID | Sev | Achado | Status |
|----|-----|--------|--------|
| B-1 | P2 | Senhas de **demo** em texto claro em `scripts/seed-auth-usuarios.mjs` num repo público (= SEG1-A A-1) | **Pendente manual** (dono) |
| B-2 | OK | GitHub Secrets `E2E_*` são opcionais e não contêm `service_role` | Confirmado |
| B-3 | OK | `SUPABASE_SERVICE_ROLE_KEY` **não** está em nenhum Secret do CI nem no código | Confirmado |

---

## 5. Classificação final

| Item | OK | Risco | Pendente manual | Corrigido |
|------|----|-------|-----------------|-----------|
| Front só com chaves públicas | ✅ | | | |
| `service_role` fora do front | ✅ | | | |
| Edge Functions via env | ✅ | | | |
| Scripts via env | ✅ | | | |
| CI sem `service_role` | ✅ | | | |
| Senhas de demo públicas | | ⚠️ | ✅ (rotação/projeto separado) | |

**Veredito:** nenhum secret privado exposto. Único ponto: credenciais de **demo**
públicas (P2, ação do dono). **Nenhum P0/P1.**
