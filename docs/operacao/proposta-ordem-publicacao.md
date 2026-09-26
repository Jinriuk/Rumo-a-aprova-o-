# Ordem de publicação: o site não vai à frente do banco

> **Regra vigente desde a Etapa 5**, com duas guardas no CI. O workflow
> `publicar` (promoção do front só com o banco conferido) fica para a
> **E8**. Nada foi mudado na Vercel, no demo nem na produção.

## O problema

A Vercel publica em produção todo merge na `main`, e as migrations são
aplicadas à mão, depois. Entre o merge e a aplicação, o front novo
conversa com o banco velho. Já custou caro duas vezes: produção 9
migrations atrás com o painel quebrado em `resumo_escola()`, e a
`abrir_proximo_ciclo` chamada pelo front sem existir no banco (21/09).
O `release-gate` não resolve isso: ele prova que o repositório é
coerente consigo mesmo, não que o banco remoto está em dia.

## A regra

1. **Banco e front em PRs separados.** O PR que adiciona arquivo em
   `supabase/migrations/` não altera nada em `app/`.
2. **Migration nova não destrói na primeira fase.** Nada de
   `DROP COLUMN` (nem `ALTER TABLE t DROP c`, sem a palavra COLUMN),
   `DROP FUNCTION`, `DROP TABLE` ou `RENAME`. O banco passa a ir antes
   do site, então o site que está no ar tem de continuar funcionando
   com o banco novo. Tirar ou renomear algo é uma **segunda fase**: um
   PR próprio, depois que nenhum deploy no ar usa o que sai, com o
   marcador numa linha da migration:

   ```sql
   -- segunda-fase: <motivo, com pelo menos 10 caracteres>
   ```

   Trocar a assinatura de uma RPC (`drop function` + `create`) também é
   segunda fase. O caminho de primeira fase é criar a assinatura nova ao
   lado da velha.

As duas regras são o passo `Guardas de migration` do
`build-e-unitarios` (`scripts/ci/guarda-migrations.mjs`, testes em
`tests/ci-guarda-migrations.test.mjs`). O diff é contra o ponto em que
o branch saiu da `main`. Comentário não conta (os blocos de ROLLBACK
citam `drop` o tempo todo); SQL dinâmico em string conta. Linha nova
numa migration antiga também é analisada.

## A ordem

1. **PR de banco:** migrations, testes em `tests/`, docs. Sem `app/`.
   O merge republica o front de antes, sem efeito.
2. **Backup** do demo e da produção antes de aplicar
   (`docs/operacao/backup-e-plano-supabase.md`).
3. **Aplicar nos dois ambientes**, demo e produção, e conferir em cada
   um: `scripts/manifesto-rpcs.mjs` (toda RPC que o front vai chamar
   existe) e `scripts/fingerprint-schema.sql` (o ledger sozinho não
   serve: em 13/09 produção tinha 3 linhas e o schema completo).
4. **PR do front.** O merge publica. Só agora.
5. Se algo saiu ou mudou de nome: **PR de segunda fase**, com o
   marcador, depois que o deploy no ar não usa mais.

## O que as guardas não garantem

- **A ordem entre os passos 3 e 4.** A guarda sabe que o front não foi
  junto com a migration, mas não sabe se a migration já está nos dois
  bancos quando o PR do front é mesclado. Isso continua manual até a
  E8.
- **Dependência entre PRs.** Um PR só de front que depende de migration
  de um PR anterior ainda não aplicado passa pelas duas guardas.
- **Padrões fora da lista.** `DROP VIEW`, `ALTER COLUMN ... TYPE`,
  `SET SCHEMA` e `REVOKE` também podem quebrar o site no ar e não são
  barrados. SQL montado por concatenação (`'dr' || 'op table'`) escapa
  da leitura textual.
- **Edge Functions** (`supabase/functions/`) não entram na regra: o
  deploy delas também é manual e separado.

## Adiado para a E8: workflow `publicar`

Fecha o primeiro buraco acima (a ordem entre aplicar e publicar):

1. **Vercel:** desligar a atribuição automática do domínio de produção.
   Cada merge gera o build de produção, mas o site no ar continua no
   deploy anterior até alguém promover.
2. **Workflow `publicar`** (manual, `workflow_dispatch` com o SHA),
   num Environment `producao` com aprovação do dono:
   1. exige o `release-gate` verde naquele SHA;
   2. contra o banco de produção, com uma **role só de leitura**,
      roda o manifesto de RPCs e compara o fingerprint de produção com
      o da stack local do `e2e-local` naquele SHA;
   3. só com os dois batendo, `vercel promote` do deploy daquele SHA.
   Banco atrás: reprova, o site fica onde estava.

Custos e riscos, para decidir na E8:
- dois secrets novos (role de leitura e token da Vercel), fora do CI
  de PR;
- lista versionada de exceções do fingerprint, senão reprova sempre;
- os *checks* de projeto da Vercel são a alternativa sem token da
  Vercel no GitHub, com menos controle sobre qual SHA sobe;
- Ignored Build Step foi descartado: poria credencial do banco no build
  da Vercel e pularia o deploy em silêncio.
