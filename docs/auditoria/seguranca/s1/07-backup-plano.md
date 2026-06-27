# S1.6 — Backup e plano Supabase

## Fatos apurados (live)
- Organização `Rumo a aprovação` — **plano `free`**.
- Projeto `bdjkgrzfzoamchdpobbl` — `ACTIVE_HEALTHY`, Postgres 17,
  região `us-east-1`.

## O que o plano free implica para backup
No **free tier o Supabase não oferece backup automático utilizável**
(snapshots diários geridos e PITR são recursos de Pro+). Ou seja: hoje,
se o banco for perdido/corrompido, **não há restauração gerenciada**.
Para uma demo isso é aceitável; **para escola real, não**.

## Decisão recomendada (do dono — não executada por código)
Antes da 1ª escola real, escolher **um** caminho:

1. **Upgrade para Pro** (recomendado): liga backup diário gerenciado
   (retenção 7 dias) e habilita PITR como add-on. Menor esforço
   operacional, restauração testável pelo painel.
2. **Manter free + `pg_dump` periódico** fora do Supabase (ex.: diário
   para storage próprio/privado), com **teste de restauração** ao menos
   uma vez. Mais barato, mais trabalho manual e mais risco operacional.

Em ambos: manter a regra já documentada de **backup antes de toda
migration sensível** (`docs/operacao/deploy-checklist.md`).

## Por que não decidi sozinho
Regra S1: **não fazer upgrade de plano automaticamente**. Upgrade tem
custo recorrente — é decisão de negócio do dono. Este relatório deixa a
escolha pronta e justificada.

## Onde está o detalhamento operacional
- `docs/operacao/backup-e-plano-supabase.md` (novo, S1) — passo a passo.
- `docs/operacao/backup-retencao-lgpd.md` — política de retenção/LGPD.
- `docs/operacao/monitoramento-backup.md` — o que monitorar.

## Status
⚠ **Pendência P1 (não-P0)**: confirmar plano/backup antes de dado real.
Documentado, não resolvido à força (decisão de custo).
