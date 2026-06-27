# Scanner — SecurityHeaders.com

**Alvo:** https://rumo-a-aprova-o.vercel.app
**Status:** ✅ Executado em 2026-06-26 17:47 UTC

## Resultado

**Nota: A**

- Site: https://rumo-a-aprova-o.vercel.app/
- IP: 216.198.79.195
- Report Time: 26 Jun 2026 17:47:26 UTC
- Grade capped at A (warning: unsafe-inline no script-src)

## Headers presentes

| Header | Status |
|--------|--------|
| Content-Security-Policy | ✅ |
| Permissions-Policy | ✅ |
| Referrer-Policy | ✅ |
| Strict-Transport-Security | ✅ |
| X-Content-Type-Options | ✅ |
| X-Frame-Options | ✅ |

## Warning

- Content-Security-Policy: "This policy contains 'unsafe-inline' which is dangerous in the script-src directive."
- Nota A (não A+) por causa do `unsafe-inline` no `script-src` — documentado como pendência SEG2-tardia/PR1.

## Observação

A nota anterior (SEG1, pré-redeploy) era D (headers não servidos). Após a SEG1 ser mergeada
na main e redeploy na Vercel, a nota subiu para **A**. Os 6 headers obrigatórios estão presentes.
Para A+: remover `unsafe-inline` do `script-src` (exige staging + nonce/hash — tarefa futura).

URL do scan: https://securityheaders.com/?q=https%3A%2F%2Frumo-a-aprova-o.vercel.app&followRedirects=on
