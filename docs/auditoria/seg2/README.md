# SEG2 — Segurança de Produção e Infraestrutura Real

**Data:** 2026-06-26 · **Base:** `main` pós-SEG1 (`ddd1377`)

Transforma o sistema de "seguro para demo controlada" (SEG1) em "preparado para piloto real
controlado". Itens dependentes de plano Pro/domínio ficam como **checklist para julho**
(decisão do dono); o que é código foi entregue e testado.

## Índice

| Doc | Tema | Veredito curto |
|-----|------|----------------|
| `00-leitura-seg1-e-plano-seg2.md` | Consolidação SEG1 + plano | base lida; plano traçado |
| `01-leaked-password-protection.md` | Leaked Password (S2-B) | bloqueado por plano Free; senha endurecida |
| `02-github-branch-protection-security.md` | GitHub (S2-C) | ✅ Branch protection APLICADA + Dependabot+CodeQL+Secret Protection habilitados |
| `03-cors-allowlist-edge-functions.md` | CORS (S2-D) | ✅ wildcard removido em código; **6 funções deployadas ACTIVE** (MCP 2026-06-26); curls = dono |
| `04-security-headers-mdn.md` | Headers (S2-E) | ✅ 6 headers ok; SecurityHeaders.com nota **A** (2026-06-26) |
| `05-relatorio-scanners-externos.md` + `scanners-externos/` | Scanners (S2-F) | SecurityHeaders **A** executado; SSL Labs falhou (Vercel edge); outros=checklists |
| `06-backup-restore-supabase.md` | Backup/restore (S2-G) | Free: manual; Pro: julho; restore a testar |
| `07-staging-isolado-e2e.md` | Staging (S2-H) | planejado; CI já suporta |
| `08-separacao-demo-usuarios-reais.md` | Demo×real (S2-I) | Opção A + checklist |
| `09-smtp-site-redirect-urls.md` | SMTP/URLs (S2-J) | URLs ok; SMTP=fallback manual |
| `10-dominio-urls-finais.md` | Domínio (S2-K) | Vercel agora; próprio em julho |
| `11-secrets-infraestrutura.md` | Secrets (S2-L) | revisados (só nomes) |
| `12-rollback-incidentes.md` | Rollback (S2-M) | plano + fluxo de incidente |
| `13-lgpd-operacional.md` | LGPD (S2-N) | mecanismos prontos; jurídico pendente |
| `dossie-tecnico-seguranca-producao.md` | Dossiê (S2-O) | apresentável a escola séria |
| `relatorio-seg2-seguranca-producao-infra-real.md` | Relatório final | **aprovada, 0 P0/P1** |

## Ações imediatas do dono (antes do piloto controlado)
1. ✅ **Branch protection** — aplicada em 2026-06-26.
2. ✅ **Deploy das Edge Functions** com CORS allowlist — concluído via MCP em 2026-06-26. **Rodar os curls de preflight** (doc 03 §5) da própria máquina para confirmar.
3. **Redeploy da `main`** + re-scan de headers — `04-…` §4.

## Itens de julho (Pro + domínio)
Pro + backup/restore testado · projeto real **sa-east-1** separado do demo · staging · SMTP ·
domínio próprio · Leaked Password Protection · CSP sem `unsafe-inline`.
