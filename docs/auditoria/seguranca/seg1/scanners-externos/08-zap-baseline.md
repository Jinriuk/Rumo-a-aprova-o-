# Scanner externo — OWASP ZAP Baseline

**Alvo:** preferencialmente **staging** (não produção)
**Data:** 2026-06-25

## Status nesta fase
**Não executado nesta fase.**
**Motivo:** (1) egresso bloqueado nesta sessão; (2) por política da fase, **não** rodar ZAP
agressivo em produção (regra SEG1-I.3) e **não** há ambiente de **staging isolado** ainda
(staging definitivo é item de SEG2). O ZAP **baseline** é passivo, mas mesmo assim deve
rodar contra staging para não poluir a vitrine/demo.

## Próxima ação (dono, em SEG2)
1. Subir o staging isolado (projeto Supabase separado — já recomendado em SEG1-A/B).
2. Rodar o **baseline passivo**:
   ```
   docker run --rm -t ghcr.io/zaproxy/zaproxy zap-baseline.py \
     -t https://STAGING.vercel.app -I
   ```
3. Registrar alertas (esperado: passivos de header — já endereçados; nada de injeção,
   pois a SPA não tem backend próprio além do Supabase).

> Evidência técnica externa, não certificação. **Nunca** ZAP agressivo em produção.
