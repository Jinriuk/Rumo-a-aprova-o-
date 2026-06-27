# S1.7 — Região do banco e LGPD

## Fato apurado (live)
O projeto está em **`us-east-1`** (Norte da Virgínia, EUA).

## Implicação LGPD
O produto trata **dado pessoal de menores** (alunos). A LGPD não proíbe
transferência internacional, mas exige base legal e cuidados extras, e o
**princípio prático** para um preparatório brasileiro é manter o dado
**no Brasil** (`sa-east-1`, São Paulo) — menor superfície jurídica,
melhor latência, e história mais simples de contar a uma escola.

## Decisão
- **Não migrar automaticamente** (regra S1). A mudança de região no
  Supabase **não é in-place**: exige **novo projeto** em `sa-east-1` +
  migração de schema/dados + troca das chaves no front/Vercel.
- O plano de migração está documentado (passo a passo, janela, rollback)
  em `docs/operacao/plano-migracao-sa-east-1.md`.

## Recomendação para o piloto
Como hoje **não há dado real de aluno** (só vitrine/demo), a janela ideal
para migrar é **antes de onboardear a primeira escola real** — migra-se
um banco sem PII, sem risco de vazamento histórico. Idealmente o mesmo
movimento que liga backup (S1.6): **criar o projeto de produção já em
`sa-east-1`, no plano Pro, com backup**.

## Status
⚠ **Pendência P1 (não-P0)**: projeto de produção em `sa-east-1` antes de
dado real. Gate de região já está descrito em
`docs/operacao/lgpd-e-infra.md`; o plano operacional novo está em
`docs/operacao/plano-migracao-sa-east-1.md`.
