# Scanner externo — SecurityHeaders.com

**Alvo:** https://rumo-a-aprova-o.vercel.app
**Data:** 2026-06-25

## Status nesta fase
**Não executado nesta fase** (automaticamente).
**Motivo:** a política de egresso do runtime desta sessão bloqueia o host
(`gateway answered 403 to CONNECT`). Não é possível chamar o serviço daqui.

## O que já se sabe
- **Antes da SEG1:** sem nenhum header de segurança no `vercel.json` → nota esperada **F/D**.
- **Depois da SEG1 (este branch):** `vercel.json` passa a enviar
  `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`,
  `Strict-Transport-Security` e `Content-Security-Policy` (ver `../08-security-headers.md`).

## Próxima ação (dono, após deploy)
1. Acessar https://securityheaders.com/?q=https%3A%2F%2Frumo-a-aprova-o.vercel.app&followRedirects=on
2. Registrar a nota nova aqui (esperado **A/A-** com a CSP atual; cair de `unsafe-inline`
   no `script-src` é o que separa A de A+ — item SEG2).
3. Anexar print/permalink.

> Tratar como **evidência técnica externa**, não como certificação.
