# 05 — Camadas Faltantes · Resumo Executivo (REG0)

**Data:** 2026-06-27 · Detalhe completo em [`05-camadas-faltantes.md`](./05-camadas-faltantes.md).

## Veredito

A fundação técnica está **forte e verificada** (RLS provada, isolamento multi-tenant,
banco, ~341 testes, CI, segurança operacional SEG1/SEG2, headers A, branch protection,
CodeQL/Dependabot). Várias camadas de "acabamento" da auditoria multivisão (~74/100) **já
foram fechadas** por C0/B-min/Fase A/I2/HF3/SEG1/SEG2 — a leitura antiga superestima as
lacunas. O que falta se concentra em **quatro lajes**.

## As 4 lajes que realmente faltam

1. **Ligar o motor pedagógico à UI (PED1)** — XP/missões/níveis/onboarding persistidos estão
   *dormentes*; o aluno vê gamificação derivada. É a maior lacuna de **valor**.
2. **Conteúdo além do Colégio Naval (PED2)** — só o CN tem trilha completa. Lacuna de **abrangência**.
3. **Operação para dado real de menor (OPS1)** — observabilidade, alertas, backup/restore testado
   e `sa-east-1`. Lacuna de **confiabilidade/LGPD** (vários ⛔ julho/Pro).
4. **Papel professor/tutor (ROLE1)** — hoje o tutor entra como coordenação. Lacuna de **plataforma**.

O restante (FE1, UX1, QA3, SEC3 residual, ARCH1) é acabamento e endurecimento.

## Já fechado (verificado no código) — não retrabalhar

Agregação `resumo_escola` (0016) · paginação (`ListaAlunos.jsx`) · índices de escala (0023) ·
Error Boundary (`ErroFronteira.jsx`) · trava de duplo envio (`Registrar.jsx:49`) · CORS allowlist
+ headers A + branch protection (SEG2) · backoffice/criar-escola (HF3) · onboarding sem SQL (I2).

## Ordem das fases

`REG0 → RC1 → PED1 → PED2 → ADM2 → ROLE1 → PERF1 → OPS1 → SEC3 → FE1 → UX1 → QA3 → ARCH1`

## Quadro de decisão (curto)

| Marco | Libera quando |
|---|---|
| **Demo controlada** | já liberado (itens de julho/Pro **não** bloqueiam) |
| **Aluno real** | backup+restore, `sa-east-1`, observabilidade/alertas, credencial+rate limit, consentimento |
| **Escola média (Matriz)** | + exportação, carga em staging, ADM2, valor real (PED1+PED2.2) |
| **B2C / novas modalidades** | + ARCH1 (contrato/white-label/self-service) — não antes de PED1+OPS1 |

> **Importante:** itens ⛔ (Pro/`sa-east-1`/staging/SMTP/domínio) são bloqueio de **dado real**,
> nunca de demo controlada. Não tratar como falha de código.
