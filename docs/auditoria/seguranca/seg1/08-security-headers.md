# SEG1-H — Headers de Segurança no Vercel

**Fase:** SEG1 — Segurança Operacional Imediata
**Data:** 2026-06-25
**Arquivo alterado:** `vercel.json` (raiz)

---

## 1. Contexto

O projeto é **React + Vite** servido pela **Vercel** (SPA estática, `app/dist`). Não há
`next.config.js` nem servidor próprio — o lugar correto para headers é o **`vercel.json`**
(bloco `headers`). Antes desta fase, `vercel.json` tinha apenas `buildCommand`,
`outputDirectory` e `rewrites` (SPA fallback), **sem nenhum header de segurança** — daí
a nota baixa esperada no SecurityHeaders.com.

---

## 2. Headers aplicados (nesta fase)

Adicionados em `vercel.json` para `source: "/(.*)"` (todas as rotas):

| Header | Valor | Função |
|--------|-------|--------|
| `X-Content-Type-Options` | `nosniff` | impede MIME sniffing |
| `X-Frame-Options` | `DENY` | anti-clickjacking (legado; reforçado por CSP `frame-ancestors`) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | não vaza path/query para terceiros |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` | desliga APIs sensíveis do navegador |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | força HTTPS (2 anos) |
| `Content-Security-Policy` | ver seção 3 | mitiga XSS / injeção / framing |

---

## 3. CSP aplicada (ajustada ao app)

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' data: blob: https:;
font-src 'self' data: https://fonts.gstatic.com;
connect-src 'self' https://*.supabase.co wss://*.supabase.co;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none'
```

### Justificativa de cada ajuste em relação ao exemplo da fase
- **`style-src … https://fonts.googleapis.com`** e **`font-src … https://fonts.gstatic.com`**:
  o app importa as fontes Fraunces/Archivo via
  `@import url('https://fonts.googleapis.com/css2?…')` em `app/src/shared/ui/tema.js`
  (CSS vem do `googleapis`, os `.woff2` do `gstatic`). **Sem esses domínios as fontes
  quebrariam.** Esse é o ajuste "conforme o app" pedido pela fase.
- **`'unsafe-inline'` em `style-src`**: o app injeta `<style>` inline e usa muitos
  `style={{…}}` (estilos inline do React) — necessário para não quebrar a UI.
- **`'unsafe-inline'` em `script-src`**: mantido conservador (build Vite pode inlinar
  pequenos trechos). Endurecer para nonce/hash sem `unsafe-inline` é item de **SEG2**
  (exige testar no deploy real).
- **`connect-src … *.supabase.co / wss://*.supabase.co`**: REST, Realtime, Auth e Edge
  Functions do Supabase. (Não há analytics/CDN de terceiros no front — varredura
  confirmou só `fonts.googleapis.com` como host externo.)
- **`img-src … https:`**: o `logo_url` da escola (white-label) pode apontar para
  qualquer HTTPS.
- **`frame-ancestors 'none'` + `object-src 'none'` + `base-uri 'self'` + `form-action 'self'`**:
  endurecimentos sem custo para uma SPA.

> A CSP **não** é excessivamente rígida (não quebra o app) nem permissiva demais. Não foi
> aplicada CSP "impossível" só para nota (regra da fase).

---

## 4. Nota antes / depois

| Momento | Nota SecurityHeaders.com | Observação |
|---------|--------------------------|------------|
| **Antes** | baixa (esperado **F**/D) | nenhum header de segurança no `vercel.json` |
| **Depois** | **a confirmar pelo dono** após o deploy | egresso bloqueado nesta sessão — ver seção 5 |

---

## 5. Testes pós-deploy — NÃO executáveis nesta sessão

A verificação ao vivo (SecurityHeaders.com, e mesmo `curl -I` na URL) **não pôde ser
feita daqui**: a política de egresso do runtime **bloqueia** `rumo-a-aprova-o.vercel.app`
(`gateway answered 403 to CONNECT`). Não é falha do app — é a rede deste ambiente.

### Checklist manual (dono), após o merge/deploy
1. Confirmar o deploy do `vercel.json` novo na Vercel.
2. `curl -I https://rumo-a-aprova-o.vercel.app/` → conferir os 6 headers.
3. Rodar SecurityHeaders.com e registrar a nota nova em `scanners-externos/01-securityheaders.md`.
4. Smoke test funcional **com o console aberto** (procurar erros de CSP):
   - [ ] login aluno (código) · [ ] login responsável · [ ] login coordenação · [ ] login super admin
   - [ ] chamada de Edge Function (ex.: provisionar/gerar-meta) funciona
   - [ ] logos/imagens da escola carregam · [ ] fontes Fraunces/Archivo carregam
   - [ ] Supabase Auth (login/refresh) funciona · [ ] sem `Refused to … because it violates CSP` crítico
5. Se algo quebrar por CSP: ajustar o diretivo específico (provavelmente `connect-src`
   ou `font-src`) e re-deployar — **documentar o ajuste aqui**. Em último caso, usar
   `Content-Security-Policy-Report-Only` temporariamente para observar antes de impor.

---

## 6. Achados

| ID | Sev | Achado | Status |
|----|-----|--------|--------|
| H-1 | Corrigido | Faltavam todos os headers de segurança | **Aplicado** em `vercel.json` |
| H-2 | Manual | Confirmar nota nova + smoke test de CSP pós-deploy | Checklist seção 5 |

**Veredito SEG1-H:** 6 headers de segurança (incl. CSP ajustada ao app) **aplicados** no
`vercel.json`. **Critério "headers básicos aplicados" — ATENDIDO** (validação de nota
ao vivo fica como checklist manual por limitação de rede desta sessão).
