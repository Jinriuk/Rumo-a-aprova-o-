# Linha do Tempo — Rumo à Aprovação

**Atualizado em:** 2026-06-24 (H1)

---

## Histórico de fases (cronológico)

```
QA1 ──► S1 ──► DB1 ──► DB2 ──► D1A ──► D1B ──► D1C ──► HF1 ──► H1 ──► PR1 ...
```

---

## Detalhamento

### QA1 — Demo-pedagogia
- **Objetivo:** Validar vitrine pública e motor pedagógico (provas, assuntos, missões, XP)
- **Entregável:** Relatório `docs/auditoria/relatorio-qa1-demo-pedagogia.md`
- **Branch:** integrado na main

### S1 — Segurança
- **Objetivo:** CI verde com gate determinístico, RLS auditada, Edge Functions com `verify_jwt: true`, proteção de secrets, plano de backup/LGPD
- **Entregáveis:** `docs/auditoria/s1/00-relatorio-s1.md` e arquivos em `docs/auditoria/s1/`
- **Branch:** integrado na main

### DB1 — Consolidação Supabase
- **Objetivo:** Inventariar e documentar tabelas, RLS, RPCs, views e Edge Functions remotas
- **Entregável:** `docs/auditoria/db1/relatorio-db1-consolidacao-supabase.md`
- **Branch:** integrado na main

### DB2 — Migrations consolidadas
- **Objetivo:** Garantir idempotência das migrations, reconciliação repo vs. remoto
- **Entregável:** `docs/relatorios/COMPARACAO_MIGRATIONS_REPO_REMOTO.md`
- **Branch:** integrado na main

### D1A — Acesso coordenação
- **Objetivo:** Corrigir acesso da coordenação ao backoffice; resolver conflitos de PR
- **Entregável:** `docs/auditoria/d1a/relatorio-d1a-coordenacao-backoffice.md`
- **Branch:** integrado na main

### D1B — Provisionamento
- **Objetivo:** Provisionar alunos (criar `usuarios` + `auth.users` + `vinculos_responsaveis`), CORS na Edge Function `backoffice-coordenador`, login
- **Entregável:** `docs/auditoria/d1b/relatorio-d1b-provisionamento-login.md`
- **Branch:** integrado na main

### D1C — Email e recuperação de acesso
- **Objetivo:** Configurar SMTP, fluxo de convite/redefinição de senha, reenvio de acesso
- **Entregável:** `docs/auditoria/d1c/relatorio-d1c-email-recuperacao-acesso.md`
- **Branch:** integrado na main

### HF1 — Hotfix revogar-responsavel
- **Objetivo:** Deployar `revogar-responsavel` (não existia remotamente), corrigir bug de deleção de usuário e ausência de suporte a superadmin
- **Branch:** `claude/hf1-deploy-revogar-responsavel-cpey7k` → PR #30 → merged 2026-06-24
- **Entregável:** `docs/auditoria/hf1/relatorio-hf1-revogar-responsavel.md`

### H1 — Higiene de repositório
- **Objetivo:** Documentação consolidada, índices, relatório de branches, riscos operacionais documentados, plano I1
- **Branch:** `claude/h1-higiene-repo-docs-operacao`
- **Entregável:** `docs/auditoria/h1/relatorio-h1-higiene-repo-docs-operacao.md`

---

## Próxima fase

### PR1 — Prontidão de Piloto Real
- **Objetivo:** Preparar o ambiente para receber a primeira escola real em produção
- **Pré-requisito:** H1 mergeado
- **Escopo esperado:** checklist de go-live, validação de escola I1, credenciais de alunos reais, SMTP validado com domínio real, monitoramento mínimo

---

## Marcos de infraestrutura

| Data (aprox.) | Marco |
|---------------|-------|
| — | Repositório criado, stack inicial |
| — | Motor pedagógico (provas, XP, patentes) |
| — | Multi-escola com RLS |
| — | Fases 14.5 → 17 (histórico de build) |
| 2026-06 | QA1: vitrine validada |
| 2026-06 | S1: segurança baseline |
| 2026-06 | DB1/DB2: banco consolidado |
| 2026-06 | D1A/D1B/D1C: coordenação operacional |
| 2026-06-24 | HF1: `revogar-responsavel` deployada |
| 2026-06-24 | H1: higiene e docs |
