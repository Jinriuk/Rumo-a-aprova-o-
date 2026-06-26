# Scanner — OWASP ZAP (baseline)

**Alvo:** **staging** (ainda não existe — ver doc 07). **NUNCA** rodar agressivo em produção.
**Status nesta sessão:** **Não executado** (sem staging; egresso bloqueado).

## Regras (da fase)
- Só **baseline** (passivo/leve), e **só contra staging** isolado com dados sintéticos.
- Não rodar DAST agressivo/fuzzing em produção com dado real.

## Próxima ação (dono, quando houver staging)
```bash
docker run --rm -t ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t https://STAGING_URL -m 5 -I
```
Registrar os alertas (a maioria informativos) e tratar os relevantes.

> Evidência técnica externa, não certificação.
