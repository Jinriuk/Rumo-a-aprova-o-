# Pendências para o Piloto Real (PR1)

**Atualizado em:** 2026-06-27 (pós-SEG2)
**Próxima fase:** PR1

O que falta antes de colocar a primeira escola real em produção, priorizado por
criticidade. **Nenhum P0/P1 de segurança** está aberto — os P0 abaixo são de
**operação do go-live**.

---

## P0 — Bloqueadores do go-live (antes da primeira escola real)

| # | Item | Responsável |
|---|------|------------|
| P0-1 | SMTP validado com domínio real do piloto (não o de demo) | Operação |
| P0-2 | Escola real criada (`escolas` + coordenação + `auth.users`) | Operação |
| P0-3 | Primeira turma e alunos reais provisionados via backoffice | Coordenação |
| P0-4 | Login do primeiro aluno real testado end-to-end | QA |
| P0-5 | Recuperação de senha testada com e-mail real | QA |
| P0-6 | Revisão do `docs/operacao/checklist-go-live-piloto.md` | Todos |

---

## P1 — Alta prioridade (antes ou logo após o go-live)

| # | Item | Destino |
|---|------|---------|
| P1-1 | Backups automáticos no Supabase (plano Pro) + **restore testado** | Julho / Infra |
| P1-2 | Região `sa-east-1` (LGPD — dado de menor no Brasil) | Julho / Infra |
| P1-3 | Alertas de uptime (Supabase / Vercel) | Infra |
| P1-4 | Validar RLS e responsável+revogação com dados reais (não seed) | QA |

---

## P2 — Importantes (roadmap próximo)

| # | Item | Estado |
|---|------|--------|
| P2-1 | Curls de verificação do CORS preflight (deploy já feito na SEG2) | ⏳ dono — `auditoria/seguranca/seg2/03-cors-allowlist-edge-functions.md` §5 |
| P2-2 | Separação demo × real (projeto Supabase dedicado) | 🔲 antes do aluno real |
| P2-3 | Staging isolado (CI já suporta `e2e-guard`) | 🔲 Julho |
| P2-4 | Leaked Password Protection (recurso Pro) | 🔲 Julho |

---

## P3 — Melhoria futura (não bloqueia piloto)

| # | Item |
|---|------|
| P3-1 | Retenção/rotação de logs (`admin_logs`, `logs_*`) |
| P3-2 | Endurecer CSP (remover `unsafe-inline` do `script-src`) |
| P3-3 | Tabela `admin_logs` separada para ações de superadmin |

---

## Já resolvido (não é mais pendência)

| Item | Fase |
|------|------|
| CORS `*` → allowlist nas 6 Edge Functions (código **e deploy**) | SEG1/SEG2 |
| Branch protection na `main` | SEG2 |
| CodeQL + Dependabot + Secret Protection | SEG1/SEG2 |
| Headers de segurança nota A | SEG1/SEG2 |
| `revogar-responsavel` deployada + bugs corrigidos | HF1 |
| `provisionar-aluno` CORS + re-vínculo de responsável | HF2 |
| Criação de escola pelo backoffice (BUG-P1-001) | HF3 |
| Onboarding de alunos sem SQL (códigos, CSV, trilhas) | I2 |
| SMTP de recuperação de senha (fluxo) | D1C |
| RLS multi-escola auditada · 32 migrations sincronizadas | S1 / DB1 / DB2 |
| Suíte de testes (341) + gate de CI verde | S1 → SEG2 |
