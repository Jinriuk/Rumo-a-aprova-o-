# Proposta: o site não vai à frente do banco (Etapa 5)

> **Só proposta. Nada foi mudado na Vercel, no demo nem na produção.**

## O problema

Hoje a Vercel publica em produção todo merge na `main`, e as migrations
são aplicadas à mão, depois. Entre o merge e a aplicação, o front novo
conversa com o banco velho. Já custou caro duas vezes: produção 9
migrations atrás com o painel quebrado em `resumo_escola()`, e a
`abrir_proximo_ciclo` chamada pelo front sem existir no banco (21/09).
O `release-gate` não resolve isso: ele prova que o repositório é
coerente consigo mesmo, não que o banco remoto está em dia.

## Proposta: build em espera, promoção só com o banco conferido

1. **Vercel: o merge gera o build de produção, mas não o põe no ar.**
   Desligar a atribuição automática do domínio de produção (build de
   produção "em espera", promovido depois com `vercel promote`). O site
   continua no deploy anterior até alguém promover.
2. **Workflow `publicar` no GitHub (manual, `workflow_dispatch`, com o
   SHA)**, num Environment `producao` com aprovação do dono:
   1. exige o `release-gate` verde naquele SHA;
   2. contra o banco de produção, com uma **role só de leitura** (secret
      do Environment, não da Vercel): roda `scripts/manifesto-rpcs.mjs`
      (toda RPC que o front chama existe, com a assinatura e o EXECUTE
      certos) e compara `scripts/fingerprint-schema.sql` com o
      fingerprint da stack local do `e2e-local` naquele SHA (Supabase
      17 com as mesmas migrations; o Postgres vanilla do job unitário
      não serve de referência, falta o que é da plataforma);
   3. só com os dois batendo, promove o deploy daquele SHA
      (`vercel promote`, com token da Vercel no Environment).
   Banco atrás: o workflow reprova, o site fica onde estava, o operador
   aplica a migration e roda de novo.
3. **Migrations só "expand/contract".** O banco passa a ir **antes** do
   site, então o site velho tem de funcionar com o banco novo: coluna ou
   função que sai só sai num segundo release, depois que nenhum deploy
   no ar a usa. Isso já é a regra do `deploy-checklist.md` (aditivas e
   idempotentes); passa a ser pré-condição da promoção.

## Pontos fracos (o que decidir antes)

- **O ledger não serve de sinal sozinho.** Em 13/09 produção tinha 3
  linhas em `schema_migrations` e o schema completo. Por isso a
  conferência é por catálogo (manifesto + fingerprint), não por
  `checar-migrations.mjs`. Enquanto o fingerprint de produção tiver
  divergências conhecidas (ex.: RLS a mais em `app.acessos_codigo`), a
  comparação precisa de uma lista de exceções versionada, senão
  reprova sempre.
- **O manifesto cobre só RPC.** Embed ambíguo (o HTTP 300 da 0055) e
  coluna renomeada só aparecem no fingerprint. Sem ele, a proposta pega
  metade dos casos.
- **Dois secrets novos** (role de leitura do banco e token da Vercel),
  ambos num Environment com aprovação, fora do CI de PR. A alternativa
  sem token da Vercel no GitHub são os *checks* de projeto da Vercel
  que bloqueiam a atribuição do domínio de produção; exigem integração
  ou webhook e dão menos controle sobre qual SHA sobe.
- **Ignored Build Step foi descartado:** poria credencial do banco no
  build da Vercel e pularia o deploy em silêncio.
- **Rollback continua sendo só do front.** Promover um deploy antigo não
  desfaz migration; por isso o item 3.

## Custo

Um workflow, uma role de leitura, dois secrets de Environment e uma
chave desligada na Vercel. O operador troca "merge e reza" por "merge,
aplica, roda `publicar`".
