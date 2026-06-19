# Rollback (Fase A.1)

> A política de migrations já está definida em `docs/operacao/deploy-checklist.md`
> ("Política de rollback"). Este documento é o **runbook**: o que fazer,
> na prática, quando algo dá errado em produção/piloto.

## Princípio

- **Front**: sempre reversível, instantâneo (Vercel guarda os deploys
  anteriores).
- **Banco**: nunca se edita/apaga uma migration já aplicada. Reverter é
  escrever uma **migration nova** que desfaz a anterior. O histórico é
  append-only — é o que torna o estado do banco previsível e auditável.
- **Dado de uma escola** (engano de cadastro, marca errada, etc.):
  raramente é caso de rollback de schema — é uma correção de **linha**,
  pela própria tela da coordenação ou, se preciso, por uma query pontual.

## Cenário 1 — front quebrou depois do deploy

1. Vercel → Deployments → escolher o deploy anterior estável → "Promote
   to Production" (ou `vercel rollback` via CLI, se configurado).
2. Front volta ao ar em segundos. **Isso não desfaz nenhuma migration** —
   por isso elas são sempre aditivas (o banco novo continua compatível
   com o front antigo).
3. Investigar a causa antes de tentar publicar de novo (ver
   `docs/operacao/operacao.md`, seção de erros).

## Cenário 2 — uma migration quebrou algo no banco

1. **Não editar nem apagar** o arquivo da migration já aplicada.
2. Escrever uma migration nova (`NNNN_desfaz_X.sql`) que reverte o efeito
   (ex.: `drop column if exists`, `drop policy if exists` + recriar a
   anterior, `drop function if exists`).
3. Aplicar a migration de reversão (mesmo processo de
   `deploy-checklist.md`: `checar-migrations.mjs` antes e depois).
4. Se a migration quebrada já tiver apagado/transformado dado: restaurar
   do backup mais recente (ver `docs/operacao/backup-retencao-lgpd.md`) antes de
   reaplicar a correção.

## Cenário 3 — uma Edge Function quebrou

1. As quatro funções (`provisionar-aluno`, `gerar-meta`, `lgpd-titular`,
   `virar-semana`) são pequenas e sem estado entre si — reverter é
   reaplicar a versão anterior do arquivo (`git revert` do commit +
   `supabase functions deploy <nome>`, ou via MCP `deploy_edge_function`).
2. Cada função já loga o erro técnico completo no servidor
   (`console.error` antes de responder) — checar **Dashboard → Edge
   Functions → Logs** (ou `get_logs`) para diagnosticar antes de revertê-la
   às pressas.

## Cenário 4 — uma escola/conta precisa ser "desligada" sem apagar nada

Não é rollback de schema — é mudança de estado, reversível:

- **Suspender o acesso de uma escola**: `status = 'suspensa'` na tabela
  `escolas` (via backoffice ou SQL direto) — os dados continuam intactos,
  só o acesso é cortado.
- **Revogar uma credencial específica**: regerar (não há "desativar" sem
  regerar hoje) via "Regerar credencial" na lista de alunos — o código
  antigo para de funcionar imediatamente.

## O que NUNCA fazer

- Editar uma migration já aplicada em produção (mesmo que "seja só um
  typo") — quebra o histórico append-only e a paridade entre ambientes.
- `DROP TABLE`/`DELETE` direto no banco de produção sem backup recente e
  sem ser via migration documentada.
- Reverter o front para uma versão que dependa de uma migration **anterior**
  à que já está no banco (isso quebra a regra "migration primeiro, front
  depois" de `deploy-checklist.md`, ao contrário).
