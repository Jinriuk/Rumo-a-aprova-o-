# Scanner externo — Qualys SSL Labs

**Alvo:** https://rumo-a-aprova-o.vercel.app
**Data:** 2026-06-25

## Status nesta fase
**Não executado nesta fase.**
**Motivo:** egresso bloqueado nesta sessão. Além disso, SSL Labs avalia o **certificado e
o TLS do host**, que na Vercel é **gerenciado pela própria Vercel** (TLS 1.2/1.3, cert
automático). Não há configuração de TLS a corrigir no nosso lado nesta fase.

## Expectativa
Domínios servidos pela Vercel costumam pontuar **A** no SSL Labs por padrão (TLS moderno,
HSTS agora habilitado por nós via header). 

## Próxima ação (dono)
1. Rodar https://www.ssllabs.com/ssltest/analyze.html?d=rumo-a-aprova-o.vercel.app
2. Registrar a nota. Reavaliar quando houver **domínio próprio** (SEG2) — aí o TLS passa
   a depender da configuração de DNS/cert do domínio.

> Evidência técnica externa, não certificação.
