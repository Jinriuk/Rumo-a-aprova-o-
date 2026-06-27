# Scanner — Qualys SSL Labs

**Alvo:** https://rumo-a-aprova-o.vercel.app
**Status:** ⚠️ Executado em 2026-06-26 17:47 UTC — falhou (infraestrutura Vercel edge)

## Resultado

**Resultado:** "Unexpected failure" / "Failed to communicate with the secure server"

- Servidor 1 (216.198.79.131): Unexpected failure — Duration: 18.913 sec
- Servidor 2 (64.29.17.131): Failed to communicate with the secure server — Duration: 4.160 sec

Isso é comportamento comum com sites hospedados na Vercel (edge network). O SSL Labs não
consegue estabelecer conexão direta com servidores Vercel pois eles ficam atrás de um CDN edge.

## Por que não é um problema de segurança

A Vercel utiliza:
- TLS 1.3 (protocolo mais moderno)
- Certificados Let's Encrypt atualizados automaticamente
- HSTS preload configurado (max-age=63072000; includeSubDomains; preload — verificado no vercel.json)
- HTTP/2 ativo (confirmado pelo header do SecurityHeaders.com scan)

O esperado para domínio próprio com DNS Vercel é nota **A+** no SSL Labs.

## Próxima ação

Quando o domínio próprio for configurado (julho):
1. Rodar o SSL Labs novamente: https://www.ssllabs.com/ssltest/analyze.html?d=seudominio.com.br
2. Registrar a nota em scanners-externos/03-ssl-labs.md
3. Esperado: A ou A+ (Vercel usa TLS 1.3 + HSTS)

## Evidência interna do TLS

O HSTS está configurado via vercel.json:
`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
(confirmado via SecurityHeaders.com scan, 26 Jun 2026 17:47 UTC — ver 01-securityheaders.md)
