# SEG2 / S2-E — Security Headers e nota SecurityHeaders/MDN

**Fase:** SEG2 · **Data:** 2026-06-26
**Pendência herdada:** H-2 (Manual)
**Arquivo:** `vercel.json` (raiz) — **não alterado nesta fase** (a SEG1 já o configurou).

---

## 1. Diagnóstico da nota "D"

O scan público da SEG1 mostrou nota **D** porque os headers **não apareciam no deploy
público** — embora estivessem no `vercel.json` do branch. Causa provável: o scan rodou
**antes** de a `main` (com o `vercel.json` novo) ser mergeada/redeployada na Vercel.

**Mudança de estado desde então:** a SEG1 **foi mergeada na `main`** (`ddd1377`, PR #36).
Logo, o redeploy da `main` na Vercel deve passar a **servir os 6 headers**. Falta o dono
**confirmar o redeploy** e **re-rodar o scan** (egresso bloqueado nesta sessão — não dá
para `curl -I` nem chamar o SecurityHeaders daqui).

---

## 2. Headers configurados (conferidos no `vercel.json`)

| Header | Valor | OK |
|--------|-------|----|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | ✅ |
| `X-Frame-Options` | `DENY` | ✅ |
| `X-Content-Type-Options` | `nosniff` | ✅ |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | ✅ |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` | ✅ |
| `Content-Security-Policy` | ver seção 3 | ✅ |

Aplicados em `source: "/(.*)"` (todas as rotas). O conjunto cobre os headers que o
SecurityHeaders.com pontua; com isso a nota esperada é **A / A-**.

---

## 3. CSP atual (ajustada ao app)

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' data: blob: https:;
font-src 'self' data: https://fonts.gstatic.com;
connect-src 'self' https://*.supabase.co wss://*.supabase.co;
frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'
```
- `fonts.googleapis.com` / `fonts.gstatic.com`: o app importa Fraunces/Archivo via `@import`.
- `*.supabase.co` / `wss://*.supabase.co`: REST, Realtime, Auth e Edge Functions.
- `img-src https:`: `logo_url` white-label pode ser qualquer HTTPS.
- `'unsafe-inline'` em `style-src`/`script-src`: necessário hoje (estilos inline do React;
  Vite pode inlinar trechos). **Endurecer para nonce/hash (remover `unsafe-inline` do
  `script-src`) é o que separa A de A+** — fica para SEG2-tardia/PR1, exige testar no deploy.

> CSP **não foi enrijecida nesta fase** para não arriscar quebrar o app sem staging
> (regra: não quebrar o sistema só para melhorar nota).

---

## 4. Checklist do dono — validar pós-deploy

1. [ ] Confirmar na Vercel que a `main` foi **redeployada** com o `vercel.json` atual.
2. [ ] `curl -I https://rumo-a-aprova-o.vercel.app/` → conferir os **6 headers** na resposta.
3. [ ] SecurityHeaders.com → registrar nota nova em
   `scanners-externos/01-securityheaders.md` (esperado **A/A-**).
4. [ ] MDN Observatory → registrar nota em `scanners-externos/02-mdn-observatory.md`.
5. [ ] **Smoke test com console aberto** (procurar `Refused to … because it violates CSP`):
   - [ ] login aluno · [ ] login responsável · [ ] login coordenação · [ ] login super admin
   - [ ] criar escola · [ ] provisionar aluno · [ ] revogar/revincular responsável · [ ] LGPD
   - [ ] imagens/logos da escola · [ ] Google Fonts · [ ] Edge Functions · [ ] Supabase Auth (login/refresh)
6. [ ] Se algo quebrar por CSP: ajustar a diretiva específica (provavelmente `connect-src`
   ou `font-src`), re-deployar e **documentar o ajuste aqui**. Em último caso, usar
   `Content-Security-Policy-Report-Only` temporariamente para observar antes de impor.

---

## 5. Nota antes/depois

| Momento | SecurityHeaders | Observação |
|---------|-----------------|------------|
| SEG1 (scan público) | **D** | headers no branch, mas não servidos (main não redeployada) |
| SEG2 (esperado pós-redeploy da main) | **A / A-** (a confirmar) | 6 headers servidos; A+ exige remover `unsafe-inline` |

---

## 6. Critério de aceite (SEG2)

> ✅ **Atendido (config) + checklist de reexecução.** Os 6 headers estão corretos e
> versionados; a SEG1 já está na `main`. A reexecução do SecurityHeaders/MDN após o
> redeploy é **passo do dono** (egresso bloqueado nesta sessão), com checklist e nota
> esperada registrados. Tratar como **evidência técnica externa**, não certificação.
