# Linha do Tempo — Rumo à Aprovação

**Atualizado em:** 2026-06-27 (pós-SEG2)

---

## Visão macro

```
BUILD (fundação)         AUDITORIAS/FASES INICIAIS        LINHA OPERACIONAL MODERNA
14.5 → 15.1..15.7        A · B-min · C0 · C0.5 · R        QA1 → S1 → DB1 → DB2
  → 16 → 17              C1A..C1D · D0                      → D1A → D1B → D1C → HF1 → H1
                         audit-all · QA0 · Fase 18          → (AV2 · I2 · PED-UX1 · HF2)
                         (tudo em auditoria/antigos/)       → HF3 → SEG1 → SEG2 → [PR1]
```

---

## 1. Build / fundação — `docs/fases/`

Construção do produto: núcleo pedagógico (provas, matérias, assuntos, níveis,
trilhas/missões, XP/patentes/conquistas, simulados) e camada visual.

`14.5` (encerramento) → `15.1`…`15.7` (fundação pedagógica) → `16` (camada visual) → `17` (operação/go-live).

## 2. Fases iniciais e auditorias retrospectivas — `docs/auditoria/antigos/`

Integradas à `main`; o documento é histórico, a funcionalidade está viva.

- **A** segurança/logs/observabilidade · **B-min** performance · **C0** motor de XP/ledger
- **C0.5** auditoria da Fase 15 + ligação por `exam_tag` · **R** higiene de branches
- **C1A–D** credibilidade da demo, UX, polimento, 30 pontos · **D0** backoffice/superoperador
- **audit-all** (retrospectiva 2026-06-20) · **QA0** (global pós-D0) · **Fase 18** (multivisão 12 personas, ~74/100)

## 3. Linha operacional moderna — `docs/auditoria/`

```
QA1 ─► S1 ─► DB1 ─► DB2 ─► D1A ─► D1B ─► D1C ─► HF1 ─► H1 ─┬─► HF3 ─► SEG1 ─► SEG2 ─► [PR1]
                                                            ├─ AV2  (auditoria funcional)
                                                            ├─ I2   (onboarding)
                                                            ├─ PED-UX1 (plano×trilha/UX)
                                                            └─ HF2  (provisionar-aluno CORS)
```

| Fase | Objetivo | Local |
|---|---|---|
| **QA1** | Validar vitrine pública e motor pedagógico | `antigos/relatorio-qa1-demo-pedagogia.md` |
| **S1** | Segurança baseline: CI verde, RLS, `verify_jwt`, secrets, backup/LGPD | `auditoria/seguranca/s1/` |
| **DB1** | Inventário do Supabase (tabelas, RLS, RPCs, views, Edge Functions) | `auditoria/banco/db1/` |
| **DB2** | Limpeza controlada, idempotência de migrations, runbook | `auditoria/banco/db2/` |
| **D1A** | Acesso da coordenação ao backoffice | `auditoria/operacional/d1a/` |
| **D1B** | Provisionamento de alunos + CORS `backoffice-coordenador` | `auditoria/operacional/d1b/` |
| **D1C** | SMTP, convite/redefinição de senha, reenvio de acesso | `auditoria/operacional/d1c/` |
| **HF1** | Deploy `revogar-responsavel` + correção de bugs | `auditoria/operacional/hf1/` |
| **H1** | Higiene de repositório, documentação, pendências operacionais | `auditoria/operacional/h1/` |
| **AV2** | Auditoria funcional total e coerência do produto | `auditoria/produto/av2/` |
| **I1** | Plano de implantação de escola nova | `auditoria/operacional/i1/` |
| **I2** | Onboarding de alunos/responsáveis, códigos e trilhas (sem SQL) | `auditoria/operacional/i2/` |
| **PED-UX1** | Correção Plano × Trilha + refinamento de UX | `auditoria/produto/ped-ux1/` |
| **HF2** | Hotfix `provisionar-aluno` CORS + re-vínculo de responsável | `auditoria/operacional/hf2/` |
| **HF3** | Hotfix criação de escola pelo backoffice (BUG-P1-001) | `auditoria/operacional/hf3/` |
| **SEG1** | Segurança operacional imediata (exposição, secrets, CORS, headers, scanners) | `auditoria/seguranca/seg1/` |
| **SEG2** | Produção/infra real: branch protection, CORS allowlist (deployado), headers A | `auditoria/seguranca/seg2/` |

---

## Próxima fase

### PR1 — Prontidão de Piloto Real
Primeira escola real em produção. Pré-requisitos e pendências em
[`07-pendencias-para-piloto-real.md`](./07-pendencias-para-piloto-real.md).

---

## Marcos de infraestrutura

| Data | Marco |
|---|---|
| 2026-06-20 | audit-all: retrospectiva de todas as fases técnicas |
| 2026-06-21 | DB2: runbook de migrations; backup/segurança apurados |
| 2026-06-24 | HF1, H1, AV2, I2, PED-UX1, HF2 |
| 2026-06-25 | HF3, SEG1 |
| 2026-06-26/27 | SEG2: branch protection aplicada; 6 Edge Functions com CORS allowlist deployadas; headers nota A |
