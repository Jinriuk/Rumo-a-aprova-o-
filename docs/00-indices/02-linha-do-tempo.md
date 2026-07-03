# Linha do Tempo — Rumo à Aprovação

**Atualizado em:** 2026-07-02 (REG1 — reconciliação pós-fechamento)

---

## Visão macro

```
BUILD (fundação)         AUDITORIAS/FASES INICIAIS        LINHA OPERACIONAL MODERNA
14.5 → 15.1..15.7        A · B-min · C0 · C0.5 · R        QA1 → S1 → DB1 → DB2
  → 16 → 17              C1A..C1D · D0                      → D1A → D1B → D1C → HF1 → H1
                         audit-all · QA0 · Fase 18          → (AV2 · I2 · PED-UX1 · HF2)
                         (tudo em auditoria/antigos/)       → HF3 → SEG1 → SEG2

LINHA PÓS-SEG2 (26/06 → 02/07 — ver seção 4)
REG0 → RC1 → PED1 → PED2¹ → ADM2 → PERF1 → SEC3 → FE1 → UX1
  → [auditoria sênior · fechamento-100%]² → SDB-AUDIT → SDB-FIX1 → FIX1 → REG1
```

¹ PED2 rodada 1 = fábrica/maturidade de conteúdo (não é a produção de trilhas).
² Fora do pipeline numerado — por isso os índices ficaram defasados até REG1.

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

## 4. Linha pós-SEG2 — REG0 até REG1 (26/06 → 02/07)

Sequência real reconstruída do histórico de merges da `main` (`git log`), incluindo
as rodadas que **não seguiram o pipeline numerado** (auditoria sênior, fechamento,
SDB-AUDIT/SDB-FIX1) e por isso nunca tinham entrado nestes índices até a REG1.

| Merge | Fase | PR | Branch | Documento |
|---|---|---|---|---|
| 26/06 | Reorganização de docs | #44 | `claude/docs-reorganizacao` | `docs/README.md` |
| 26/06 | **REG0** — registro vivo das camadas | #46 | `claude/reg0-registro-vivo-camadas-faltantes` | `auditoria/reg0/` + `00-indices/05` |
| 27/06 | **RC1** — varredura funcional + matriz de bugs | #47 | `claude/rc1-functional-sweep-foc0wb` | `auditoria/rc1/` |
| 27/06 | **PED1** — motor de progresso vivido (missões/níveis/onboarding sobre o C0; migration 0033) | #48 + #50 | `claude/ped1-motor-progresso-vivido-74brq0` | `auditoria/ped1/` |
| 27/06 | **PED2 (rodada 1)** — maturidade por concurso + fábrica de trilhas (migration 0034; **não** é produção de conteúdo) | #49 | `claude/ped2-conteudo-trilhas-fabrica-cc18j0` | `auditoria/ped2/` |
| 27/06 | **ADM2** — SuperADM profissional (categoria, risco, go-live, logs filtráveis) | #51 | `claude/adm2-superadmin-profissional-nqoknq` | `auditoria/adm2/` |
| 27/06 | **PERF1** — export CSV, comparativo turma/concurso, plano de carga | #52 | `claude/perf1-escala-relatorios-carga-pbexlc` | `auditoria/perf1/` |
| 27/06 | **SEC3** — virada por escola (0035), atomicidade LGPD (0036), timing-safe | #53 | `claude/sec3-security-hardening-wye9a6` | `auditoria/sec3/` |
| 28/06 | **FE1** — duplo envio, contratos/DTOs, cancelamento | #54 | `claude/fe1-frontend-quality-contracts-5y0c0c` | `auditoria/fe1/` |
| 28/06 | **UX1** — acessibilidade, skeletons, modo essencial | #55 | `claude/ux1-interface-accessibility-yc7rbw` | `auditoria/ux1/` |
| 28/06 | **Auditoria sênior** (fora do pipeline; só documento) | #56 | `claude/system-audit-analysis-lm7r43` | `auditoria/auditoria-senior-2026-06-28.md` |
| 28/06 | **Fechamento 100% código** (fora do pipeline) — liga recorrência + simulado-concurso à UI, code-splitting recharts, CSP `script-src 'self'` | #57 | `claude/rumo-aprovacao-100-codigo-yb1tfa` | `auditoria/fechamento-100-codigo-2026-06-28.md` |
| 29/06 | **SDB-AUDIT** — auditoria completa do Supabase remoto (fora do pipeline) | #58 | `claude/sdb-audit-supabase-completo` | `auditoria/sdb-audit/` |
| 29/06 | **SDB-FIX1** — aplica drift 0034/0035/0036; paridade 36==36 | #59 | `claude/sdb-migrations-drift-parity-4fgyvr` | `auditoria/banco/sdb-fix1-migrations-drift.md` |
| 02/07 | **FIX1** — corrige os 5 achados da RC1 (003/004/005/006/008) | #60 | `claude/fix1-rc1-corrections-40rcya` | `auditoria/fix1/` |
| 02/07 | **REG1** — reconciliação de estado (reescreve os índices 02/03/05/07) | #61 | `claude/fix1-rc1-corrections-40rcya` (reutilizada pós-merge) | `auditoria/reg1/` |
| 02/07 | **FIX2** — fecha os achados da REG1: tabela fantasma removida do Login (P1-5), escrita de conquistas deprecada nos 2 motores (migration 0037, P2-8), PR #49 verificado | — | `claude/fix1-rc1-corrections-40rcya` (reutilizada; tag `fix2-fechamento-reg1`) | `auditoria/fix2/` |

> **Nota de processo (REG1):** as quatro rodadas fora do pipeline produziram
> trabalho real, mas nenhuma atualizou os índices — resultado: `03-status-atual`
> ficou 3 rodadas atrás e a SDB-AUDIT citou "341 testes" quando a `main` já tinha
> 459. Regra a partir de REG1: **toda** rodada mergeada (numerada ou não) entra
> nesta linha do tempo e atualiza o `03-status-atual`.

---

## Próxima fase

### PR1 — Prontidão de Piloto Real
Primeira escola real em produção. Pré-requisitos e pendências em
[`07-pendencias-para-piloto-real.md`](./07-pendencias-para-piloto-real.md).
Trabalho de código remanescente (conteúdo PED2 rodada 2, FIX2 da tabela
fantasma) listado no `05-camadas-faltantes.md` reconciliado.

---

## Marcos de infraestrutura

| Data | Marco |
|---|---|
| 2026-06-20 | audit-all: retrospectiva de todas as fases técnicas |
| 2026-06-21 | DB2: runbook de migrations; backup/segurança apurados |
| 2026-06-24 | HF1, H1, AV2, I2, PED-UX1, HF2 |
| 2026-06-25 | HF3, SEG1 |
| 2026-06-26/27 | SEG2: branch protection aplicada; 6 Edge Functions com CORS allowlist deployadas; headers nota A |
| 2026-06-29 | SDB-FIX1: drift de migrations zerado — repo 36 == ledger 36 |
| 2026-07-02 | FIX1 mergeada (PR #60, CI verde); REG1 reconcilia os índices |
