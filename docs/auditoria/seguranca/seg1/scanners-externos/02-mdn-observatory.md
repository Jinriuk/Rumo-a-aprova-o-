# Scanner externo — MDN Observatory (Mozilla)

**Alvo:** https://rumo-a-aprova-o.vercel.app
**Data:** 2026-06-25

## Status nesta fase
**Não executado nesta fase.**
**Motivo:** egresso de rede bloqueado nesta sessão (403 CONNECT ao host). Serviço externo
não acessível daqui.

## Contexto
O MDN Observatory (https://developer.mozilla.org/en-US/observatory) pontua CSP, HSTS,
cookies, `X-Content-Type-Options`, Referrer-Policy, SRI etc. Com os headers aplicados
na SEG1 (incl. CSP e HSTS com `preload`), a nota deve subir de forma relevante frente ao
estado anterior (sem headers).

## Próxima ação (dono, após deploy)
1. Rodar https://developer.mozilla.org/en-US/observatory/analyze?host=rumo-a-aprova-o.vercel.app
2. Registrar a nota e os itens pendentes (provável recomendação: remover `unsafe-inline`
   → SEG2).

> Evidência técnica externa, não certificação.
