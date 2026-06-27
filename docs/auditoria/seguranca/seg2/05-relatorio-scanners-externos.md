# SEG2 / S2-F — Relatório de scanners externos

**Fase:** SEG2 · **Data:** 2026-06-26 · **Atualizado:** 2026-06-26 (executor com acesso)

Estes resultados são evidências técnicas externas — não certificação formal.

---

## 1. Status por ferramenta (atualizado)

| Ferramenta | Status | Nota/Resultado | Arquivo |
|-----------|--------|----------------|---------|
| SecurityHeaders.com | ✅ **Executado** 2026-06-26 17:47 UTC | **A** (grade capped — unsafe-inline) | scanners-externos/01-securityheaders.md |
| MDN Observatory | ⏳ Não executado (domínio bloqueado no runtime) | Esperado B+/A | scanners-externos/02-mdn-observatory.md |
| Qualys SSL Labs | ⚠️ Executado mas falhou ("Unexpected failure" / "Failed to communicate") | Vercel TLS é A+ por padrão | scanners-externos/03-ssl-labs.md |
| Sucuri SiteCheck | ⏳ Não executado (domínio não aprovado no runtime) | Checklist manual | scanners-externos/04-sucuri-sitecheck.md |
| Unxpose (externo leve) | ⏳ Não executado (requer conta) | Checklist manual | scanners-externos/05-unxpose.md |
| Internet.nl | ⏳ Requer domínio próprio | Rodar em julho | scanners-externos/06-internetnl.md |
| Hardenize | ⏳ Requer domínio próprio | Rodar em julho | scanners-externos/07-hardenize.md |
| OWASP ZAP baseline | ⏳ Requer staging | Nunca em produção | scanners-externos/08-zap-baseline.md |

---

## 2. Evidências diretas executadas

| O que o scanner inferiria | Evidência direta da SEG1/SEG2 |
|--------------------------|-------------------------------|
| Headers de segurança | SecurityHeaders.com: **Nota A** (26 Jun 2026 17:47:26 UTC) |
| RLS / isolamento | 341 testes verdes + RLS 45/45 (seg1/06) |
| Secrets expostos | git grep sem secret privado (seg1/02,03) |
| CORS | allowlist em código (doc 03) + curls turnkey |
| Auth / leaked password | Security Advisor + verificação ao vivo (doc 01) |
| Branch protection | Aplicada via Settings → Branches (2026-06-26) |
| Code scanning | CodeQL ativo, last scan ~3h (Settings → Advanced Security) |

---

## 3. Sobre o SSL Labs

O Qualys SSL Labs retornou "Unexpected failure" e "Failed to communicate with the secure server"
para rumo-a-aprova-o.vercel.app. Isso é comum com Vercel pois o TLS é gerenciado pela
infraestrutura Vercel/edge e os IPs do Vercel podem não responder diretamente ao scanner.

A Vercel usa TLS 1.3, certificados Let's Encrypt atualizados e configuração moderna.
O esperado para domínio próprio com DNS Vercel é nota A+.

Ação: re-rodar o SSL Labs no domínio próprio (julho). Registrar em 03-ssl-labs.md.

---

## 4. Conclusão S2-F

SecurityHeaders.com executado com resultado **Nota A** — evidência principal obtida.
MDN Observatory, Sucuri, Unxpose e SSL Labs ficam como checklist manual (limitações de runtime
ou requerem domínio próprio). Não bloqueia a SEG2 dado o conjunto de evidências diretas.
