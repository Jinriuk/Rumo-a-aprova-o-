# Antigos — arquivo histórico de auditorias e fases superadas

> **Natureza:** registro permanente. Nada aqui é apagado — são as **decisões e
> auditorias que levaram ao estado atual**, mas que **não refletem mais** o
> sistema como ele está hoje. Para o estado vigente, use
> [`docs/00-indices/03-status-atual.md`](../../00-indices/03-status-atual.md) e os
> buckets ativos em [`docs/auditoria/`](../README.md).

Por que estão aqui e não na raiz da auditoria: são auditorias retrospectivas
(fotografias de um momento) ou relatórios de fases iniciais já **integradas à
`main`**. O conteúdo técnico que essas fases entregaram continua vivo no produto;
o que ficou velho é o **documento**, não a funcionalidade.

## Conteúdo

| Pasta / arquivo | O que é | Quando |
|---|---|---|
| `audit-all/` | Auditoria retrospectiva, somente-leitura, de todas as fases técnicas (14.5 → D0) | 2026-06-20 |
| `qa0-pos-d0/` | Auditoria global QA0 pós-D0 (multivisão: QA, arquitetura, segurança, UX, pedagógico) | pós-D0 |
| `fase18-multivisao/` | Auditoria de maturidade sob 12 perspectivas (nota ~74/100) + consolidado | — |
| `relatorios-fase-iniciais/` | Relatórios das fases A (segurança), B-min (performance), R (branches) + reconciliações de migrations (C0) | jun/2026 |
| `relatorio-qa1-demo-pedagogia.md` | QA1 — validação da vitrine e do motor pedagógico | jun/2026 |
| `c0-5-auditoria-fase15.md` | C0.5 — auditoria da Fase 15 + ligação ao runtime por `exam_tag` | jun/2026 |
| `bloco-b-rebuild-base-demo.md` | Bloco B — rebuild da base demo/vitrine | jun/2026 |
| `relatorio-c1a..c1d-*.md` | C1A/B/C/D — credibilidade da demo, UX crítica, polimento, fechamento dos 30 pontos | jun/2026 |
| `relatorio-d0-backoffice-superoperador.md` | D0 — backoffice interno / superoperador | jun/2026 |
| `relatorio-final-fase-r.md` | R — higienização de branches / `main` / Vercel | jun/2026 |

## Onde foi parar o que importa

- **Estado atual do banco, funções e CI** → `docs/00-indices/03-status-atual.md`
- **Segurança hoje** → `docs/auditoria/seguranca/` (S1, SEG1, SEG2)
- **Banco hoje** → `docs/auditoria/banco/` (DB1, DB2) e `docs/operacao/runbook-migrations-supabase.md`
- **Operação viva** (backup, rollback, go-live, deploy) → `docs/operacao/`
