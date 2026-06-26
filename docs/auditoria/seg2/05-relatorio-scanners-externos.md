# SEG2 / S2-F — Relatório de scanners externos

**Fase:** SEG2 · **Data:** 2026-06-26

> Estes resultados são **evidências técnicas externas** — **não** certificação formal.

---

## 1. Por que não rodaram automaticamente nesta sessão

O egresso de rede deste runtime **bloqueia** `rumo-a-aprova-o.vercel.app` e
`bdjkgrzfzoamchdpobbl.supabase.co` (`gateway answered 403 to CONNECT`, confirmado no
`__agentproxy/status`). Conforme a regra do ambiente, **não se contorna a política —
reporta-se**. Cada scanner virou **checklist com URL pronta e resultado esperado** em
`scanners-externos/`. Não rodar scanner agressivo em produção (regra da fase) também
pesa: ZAP só em staging.

## 2. Status por ferramenta

| Ferramenta | Aplicável agora? | Próxima ação | Arquivo |
|------------|------------------|--------------|---------|
| SecurityHeaders.com | ✅ (após redeploy da main) | rodar e registrar nota | `scanners-externos/01-securityheaders.md` |
| MDN Observatory | ✅ | rodar e registrar nota | `scanners-externos/02-mdn-observatory.md` |
| Qualys SSL Labs | ✅ (TLS é da Vercel) | rodar; esperado A/A+ | `scanners-externos/03-ssl-labs.md` |
| Sucuri SiteCheck | ✅ | rodar (malware/blacklist) | `scanners-externos/04-sucuri-sitecheck.md` |
| Unxpose (externo leve) | ✅ **sem** integração ampla | superfície externa | `scanners-externos/05-unxpose.md` |
| Internet.nl | ⏳ requer **domínio próprio** | rodar em julho | `scanners-externos/06-internetnl.md` |
| Hardenize | ⏳ requer **domínio próprio** | rodar em julho | `scanners-externos/07-hardenize.md` |
| OWASP ZAP baseline | ⏳ requer **staging** | rodar contra staging (nunca prod) | `scanners-externos/08-zap-baseline.md` |

## 3. Evidência interna direta (mais forte que scanner remoto, onde aplicável)

| O que o scanner inferiria | Evidência direta da SEG1/SEG2 |
|---------------------------|-------------------------------|
| Headers de segurança | `vercel.json` versionado + doc 04 |
| RLS / isolamento | 341 testes verdes + RLS 45/45 (`seg1/06`) |
| Secrets expostos | `git grep` sem secret privado (`seg1/02`,`03`) |
| CORS | allowlist em código (doc 03) + curls turnkey |
| Auth / leaked password | Security Advisor + verificação ao vivo (doc 01) |

## 4. Conclusão S2-F

Scanners externos **não executáveis deste runtime** (egresso bloqueado) — registrados com
**Não executado / Motivo / Próxima ação** por ferramenta. Pendência **Manual** (dono); não
bloqueia a SEG2 dado o conjunto de evidências internas diretas. Atualizar cada arquivo com
print/permalink após rodar.
