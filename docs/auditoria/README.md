# Auditoria — índice por assunto

**Atualizado em:** 2026-06-27 (pós-SEG2)

Auditorias e fases de evolução do **Rumo à Aprovação**, organizadas por **assunto**.
Cada pasta de fase guarda o relatório principal (`relatorio-*.md`) e os documentos de
apoio numerados.

> Material **histórico / superado** (auditorias retrospectivas e fases iniciais já
> integradas) fica em [`antigos/`](./antigos/README.md). O **estado vigente** do
> sistema está em [`docs/00-indices/03-status-atual.md`](../00-indices/03-status-atual.md).

---

## 🔒 seguranca/ — segurança e operação técnica

| Fase | Foco | Entrada |
|---|---|---|
| **S1** | Baseline: CI verde, RLS auditada, `verify_jwt`, secrets, plano backup/LGPD | [`seguranca/s1/00-relatorio-s1.md`](./seguranca/s1/00-relatorio-s1.md) |
| **SEG1** | Segurança operacional imediata: exposição, secrets, CORS, headers, scanners | [`seguranca/seg1/relatorio-seg1-seguranca-operacional-imediata.md`](./seguranca/seg1/relatorio-seg1-seguranca-operacional-imediata.md) |
| **SEG2** | Produção/infra real: branch protection, CORS allowlist (deployado), headers A | [`seguranca/seg2/relatorio-seg2-seguranca-producao-infra-real.md`](./seguranca/seg2/relatorio-seg2-seguranca-producao-infra-real.md) |

## 🗄 banco/ — banco de dados (Supabase / Postgres)

| Fase | Foco | Entrada |
|---|---|---|
| **DB1** | Inventário: tabelas, RLS, RPCs, views, Edge Functions remotas | [`banco/db1/relatorio-db1-consolidacao-supabase.md`](./banco/db1/relatorio-db1-consolidacao-supabase.md) |
| **DB2** | Limpeza controlada: idempotência, policies duplicadas, runbook de migrations | [`banco/db2/relatorio-db2-limpeza-controlada.md`](./banco/db2/relatorio-db2-limpeza-controlada.md) |

## ⚙️ operacional/ — coordenação, provisionamento, acesso, implantação

| Fase | Foco | Entrada |
|---|---|---|
| **D1A** | Acesso da coordenação ao backoffice | [`operacional/d1a/relatorio-d1a-coordenacao-backoffice.md`](./operacional/d1a/relatorio-d1a-coordenacao-backoffice.md) |
| **D1B** | Provisionamento de alunos + CORS `backoffice-coordenador` | [`operacional/d1b/relatorio-d1b-provisionamento-login.md`](./operacional/d1b/relatorio-d1b-provisionamento-login.md) |
| **D1C** | E-mail, SMTP e recuperação de acesso | [`operacional/d1c/relatorio-d1c-email-recuperacao-acesso.md`](./operacional/d1c/relatorio-d1c-email-recuperacao-acesso.md) |
| **HF1** | Hotfix: deploy `revogar-responsavel` + correção de bugs | [`operacional/hf1/relatorio-hf1-revogar-responsavel.md`](./operacional/hf1/relatorio-hf1-revogar-responsavel.md) |
| **HF2** | Hotfix: `provisionar-aluno` CORS + re-vínculo de responsável | [`operacional/hf2/relatorio-hf2-provisionar-aluno-responsavel.md`](./operacional/hf2/relatorio-hf2-provisionar-aluno-responsavel.md) |
| **HF3** | Hotfix: criação de escola pelo backoffice (BUG-P1-001) | [`operacional/hf3/relatorio-hf3-criacao-escola-backoffice.md`](./operacional/hf3/relatorio-hf3-criacao-escola-backoffice.md) |
| **H1** | Higiene de repositório, documentação e pendências operacionais | [`operacional/h1/relatorio-h1-higiene-repo-docs-operacao.md`](./operacional/h1/relatorio-h1-higiene-repo-docs-operacao.md) |
| **I1** | Plano de implantação de escola nova | [`operacional/i1/00-plano-implantacao-escola-nova.md`](./operacional/i1/00-plano-implantacao-escola-nova.md) |
| **I2** | Onboarding de alunos/responsáveis, códigos e trilhas (sem SQL pelo operador) | [`operacional/i2/relatorio-i2.md`](./operacional/i2/relatorio-i2.md) |

## 🎯 produto/ — auditoria funcional, pedagógica e UX

| Fase | Foco | Entrada |
|---|---|---|
| **AV2** | Auditoria funcional total e coerência do produto (todos os papéis) | [`produto/av2/relatorio-av2-auditoria-funcional-total.md`](./produto/av2/relatorio-av2-auditoria-funcional-total.md) |
| **PED-UX1** | Correção Plano × Trilha + refinamento de UX (aluno/coordenação) | [`produto/ped-ux1/relatorio-ped-ux1-plano-trilha.md`](./produto/ped-ux1/relatorio-ped-ux1-plano-trilha.md) |

---

## 🧭 reg0/ — registro vivo das lacunas (governança)

| Fase | Foco | Entrada |
|---|---|---|
| **REG0** | Fonte única de verdade das 10 camadas faltantes (status verificado no código) | [`reg0/relatorio-reg0-inventario-camadas.md`](./reg0/relatorio-reg0-inventario-camadas.md) |

> Inventário e quadro de decisão completos em [`docs/00-indices/05-camadas-faltantes.md`](../00-indices/05-camadas-faltantes.md).

## 🗃 antigos/ — histórico (não reflete o estado atual)

Auditorias retrospectivas e fases iniciais já integradas. Ver
[`antigos/README.md`](./antigos/README.md). Inclui: `audit-all/`, `qa0-pos-d0/`,
`fase18-multivisao/`, `relatorios-fase-iniciais/` e os relatórios soltos de QA1,
C0.5, Bloco B, C1A–D, D0 e Fase R.
