# Backup e restauração (Etapa 6)

> **Vigente desde 26/09/2026.** Substitui, para o procedimento, o que
> `backup-e-plano-supabase.md`, `backup-retencao-lgpd.md` e
> `monitoramento-backup.md` dizem sobre dump manual. Nenhum valor de
> secret, senha ou URL de banco aparece aqui.

## Em cinco linhas

- **Backup:** workflow **Backup (manual)**, só por clique. Copia produção,
  demo ou os dois, cifra dentro do job e guarda como artefato por 30 dias.
- **Ensaio:** workflow **Ensaio de restauração (manual)**. Restaura numa
  stack Supabase local e descartável e confere tudo, com dump sintético ou
  com o artefato de uma execução do Backup.
- **Retorno:** `scripts/backup/restaurar.sh`, só num projeto **vazio**.
- **O que não volta:** Storage, secrets, configuração do Auth, chaves,
  Vercel. Lista completa na seção 6.
- **Sem o Pro, não existe backup automático.** Se ninguém clicar, não há
  cópia nenhuma.

## 1. Quando clicar

1. **Antes de toda mudança em produção:** migration, SQL à mão, script de
   operador com a chave de serviço, correção de dado em lote. Sem exceção.
   É o passo 2 de `proposta-ordem-publicacao.md`.
2. **Sob demanda:** antes de uma demonstração importante no demo, antes de
   entrar a primeira escola real, depois de um cadastro grande.
3. **Ensaio com o dado real** (seção 5): logo depois do primeiro backup de
   produção, e de novo a cada mudança de versão do Postgres ou da CLI.

O workflow não tem agendamento, de propósito: ele lê a credencial de banco
de produção, e nada roda sem alguém pedir. O custo dessa escolha é o RPO
(seção 4): **a cópia mais nova é a do último clique**, e o artefato expira
em 30 dias. Um mês sem clique é um mês sem backup nenhum.

## 2. Cadastro, uma vez só (dono)

### 2.1 Environment `backup`

GitHub → **Settings → Environments → New environment** → nome `backup`.

1. **Deployment branches and tags:** "Selected branches and tags" → regra
   `main`. **Faça isto antes de cadastrar os secrets.** O workflow
   referencia o environment: se ele não existir, o GitHub o cria na
   primeira execução **sem restrição nenhuma**.
2. **Required reviewers** (recomendado): você mesmo. Cada execução espera o
   seu clique de aprovação. Custa um clique e fecha o caminho de quem tem
   escrita no repositório disparar o job.
3. Os três secrets abaixo, em **Environment secrets** (não em Repository
   secrets):

| Nome | O que é | Onde o dono pega o valor |
| --- | --- | --- |
| `PROD_DB_URL` | string de conexão do banco de **produção** | Painel do Supabase, projeto de produção → botão **Connect** (barra do topo) → **Connection string** → *Type* URI, *Method* **Session pooler** (porta 5432). Troque `[YOUR-PASSWORD]` pela senha do banco. Se não souber a senha: **Project Settings → Database → Reset database password** (ver o aviso abaixo) |
| `DEMO_DB_URL` | string de conexão do banco do **demo** | O mesmo caminho, no projeto do demo |
| `BACKUP_PASSPHRASE` | senha que cifra os backups | Gere na sua máquina, por exemplo `openssl rand -base64 48`, ou com o gerador do seu gerenciador de senhas (32 caracteres ou mais, aleatórios). **Guarde também no gerenciador de senhas.** Sem ela, todo backup vira lixo |

**Por que Session pooler.** A conexão direta (`db.<ref>.supabase.co`) no
plano free só tem IPv6, e o runner do GitHub não tem IPv6. O Transaction
pooler (porta 6543) não serve para `pg_dump`. O Session pooler tem IPv4 e
aceita o dump.

**Aviso sobre resetar a senha do banco.** O site, as Edge Functions e o
keepalive não usam essa senha. Quem usa são os scripts de operador rodados
com `SUPABASE_DB_URL` na sua máquina, que passam a precisar da senha nova.

**O workflow confere a URL.** O job de prod reprova se a URL não for do
projeto `zckyhihxjjbnqjqilymn`, ou se o banco tiver o schema `demo`. O job
do demo reprova se a URL não for do `bdjkgrzfzoamchdpobbl`, ou se faltar o
schema `demo`. Secret trocado não vira "backup de produção" com o conteúdo
da vitrine. Se produção mudar de projeto, o `REF_PROD` do `backup.yml` muda
junto, num PR.

## 3. Como clicar e o que conferir

1. GitHub → **Actions → Backup (manual) → Run workflow**. Branch `main`,
   projeto `ambos` (ou só um).
2. Com reviewer configurado: **Review deployments → Approve**.
3. Cada projeto roda num job. Os passos, todos obrigatórios:
   1. confere a URL;
   2. retrato e `pg_dump` na mesma transação **só de leitura**, com o mesmo
      snapshot;
   3. confere o índice do dump;
   4. cifra;
   5. decifra de volta e compara o SHA-256;
   6. publica.

   Qualquer falha reprova o job, e nada é publicado.
4. O resumo da execução traz, por projeto:
   - data e hora de Brasília, com fuso;
   - versão do Postgres;
   - última migration do ledger;
   - nome, tamanho e SHA-256 do arquivo.
5. O artefato `backup-<projeto>-<run>-<tentativa>` tem **só dois arquivos**:
   - `triliva-<projeto>-<carimbo UTC>.tar.gpg`, o backup cifrado;
   - `triliva-<projeto>-<carimbo UTC>.json`, o manifesto público com os
     mesmos dados do resumo.

**Baixou? Confira o SHA-256** do `.tar.gpg` contra o manifesto:

- Linux: `sha256sum arquivo.tar.gpg`
- macOS: `shasum -a 256 arquivo.tar.gpg`
- Windows: `certutil -hashfile arquivo.tar.gpg SHA256`

**Para abrir** (precisa do GnuPG; no Windows, Gpg4win):

```bash
gpg --decrypt triliva-prod-….tar.gpg > triliva-prod-….tar   # pede a senha
tar -xf triliva-prod-….tar
```

Dentro:

- `dump.pgcustom`: formato custom do `pg_dump`;
- `manifesto-interno.json`: retrato da origem, com contagens, estrutura,
  cron e event triggers;
- `SHA256SUMS`.

### O que o dump leva

| Schema | O quê |
| --- | --- |
| `public`, `app` | tudo: tabelas, dados, funções, views, policies, RLS, triggers, grants |
| `demo` | idem, quando existe (só no demo) |
| `supabase_migrations` | o ledger (a "última migration" vem dele) |
| `auth` | **dados**: `users` (com o hash da senha), `identities`, fatores de MFA, provedores, auditoria. Ficam de fora sessões, refresh tokens, tokens de uso único, fluxos em andamento e desafios de MFA |

Correção de um registro antigo: `docs/e1-migrations.md` dizia que o
`pg_dump` sem superusuário não lê o `auth`. Em 26/09 o papel `postgres` do
demo tinha `SELECT` em todas as 27 tabelas do `auth` e nas sequências. O
dump leva as contas, e o ensaio entrou com a senha original depois do
restore.

## 4. RPO e RTO

| | Valor | De onde vem |
| --- | --- | --- |
| **RPO**, mudança em produção feita depois do clique | ~0 para o que a mudança estragar | o backup é tirado imediatamente antes |
| **RPO**, desastre de plataforma (projeto apagado, conta perdida, corrupção) | **o tempo desde o último clique**, sem limite superior. Se o último artefato tiver expirado (30 dias), não há cópia | plano free sem backup gerenciado; workflow sem agendamento |
| **RTO**, só o banco (decifrar + restaurar + recriar cron e event triggers) | **1,1 s** no runner do Actions e 3,0 s na máquina de desenvolvimento, com dump sintético de 0,7 MB. Ordem de minutos para produção | ensaio (seção 9). O banco do demo tinha 21 MB em 26/09 |
| **RTO**, retorno total num projeto novo | **estimado em 1 a 2 horas**, quase tudo configuração manual (seção 5.1, passos 3 e 5 a 8) | **não medido**: o retorno a um projeto hospedado nunca foi ensaiado |

## 5. Passo a passo de retorno

Três caminhos. **Nenhum restaura por cima de um banco com dado.** O
`restaurar.sh` recusa destino com conta em `auth.users` ou com tabela da
aplicação.

### 5.1 Retorno total, num projeto novo

Quando: projeto perdido, dado corrompido em muitas tabelas, migration que
destruiu dado sem volta.

1. **Escolha o backup:** o último **antes** do incidente. Baixe o `.tar.gpg`
   e o `.json` do mesmo artefato e confira o SHA-256.
2. **Ensaie antes** (recomendado, cerca de 5 min): **Ensaio de restauração
   (manual)** com o `backup_run_id` daquela execução. Prova que a senha abre
   e que o dump restaura inteiro, antes de mexer em qualquer coisa.
3. **Crie o projeto novo:** região `sa-east-1` (LGPD), Postgres 17, senha
   forte. Anote o ref.
4. **Restaure**, da sua máquina. Precisa de Node 22, `npm ci` em `tests/`,
   cliente Postgres 17 e GnuPG.

   ```bash
   RESTAURO_ALVO=<ref do projeto NOVO> RESTAURO_CRON=ativo \
   RESTAURO_ARQUIVO=triliva-prod-….tar.gpg RESTAURO_MANIFESTO=triliva-prod-….json \
   RESTAURO_DB_URL='<Session pooler do projeto NOVO>' RESTAURO_PASSPHRASE='…' \
   PG_BIN=/usr/lib/postgresql/17/bin bash scripts/backup/restaurar.sh
   ```

   O script:
   1. confere que a URL é do ref declarado e que o banco está vazio;
   2. restaura;
   3. zera as ACLs que o Supabase dá por padrão e aplica as do dump;
   4. recria o `ensure_rls` e os jobs do cron, ligados;
   5. compara com o manifesto da origem.

   Divergência reprova.
5. **Reconfigure a plataforma** (nada disto está no dump):
   - **Auth:**
     - Site URL e redirects do domínio real;
     - SMTP do Resend;
     - expiração do JWT (3600 s) e chave de assinatura ECC;
     - cadastro público desligado.

     Referência: `matriz-configuracao.md`, seção 5.
   - **Data API:** só `public` exposto (o `app` fora).
   - **Edge Functions:** `supabase functions deploy` das 7, com o
     `supabase/config.toml` do repositório (`verify_jwt = false` em todas).
     Secrets: `ALLOWED_ORIGINS`, `PASSWORD_RESET_REDIRECT_URL`,
     `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `VERCEL_PREVIEW_PREFIX`.
   - **Storage:** recriar o bucket de logos, com as policies, e subir os
     logos de novo (ou as escolas reenviam).
6. **Confira no projeto novo:**

   ```bash
   SUPABASE_DB_URL='…' node scripts/manifesto-rpcs.mjs
   psql '…' -f scripts/fingerprint-schema.sql
   psql '…' -c "select jobname, active from cron.job"
   psql '…' -c "select * from app.virada_saude()"
   ```

   O fingerprint é para comparar com o de um banco saído do repositório. Por
   último, entre com uma coordenação real.
7. **Vercel:** no projeto de produção, troque `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY` pela URL e pela chave publicável do projeto novo.
   Faça o redeploy.
8. **GitHub:**
   - `PROD_SUPABASE_URL` e `PROD_SUPABASE_ANON_KEY` do keepalive;
   - `PROD_DB_URL` do environment `backup`;
   - PR trocando o `REF_PROD` do `backup.yml`;
   - atualizar a `matriz-configuracao.md`.
9. **Avise as escolas.** Todos entram de novo, porque as sessões não voltam.
   Links de redefinição pendentes morrem. Tudo o que foi gravado entre o
   backup e o incidente se perdeu.

### 5.2 Retorno parcial, com o projeto vivo

Quando: uma escola, uma tabela ou algumas linhas estragadas, e o resto do
banco bom.

1. **Backup agora** (seção 3). O estado estragado também é evidência.
2. Restaure o backup **anterior** numa cópia **local**:

   ```bash
   RESTAURO_ARQUIVO=… RESTAURO_PASSPHRASE=… bash scripts/backup/ensaio.sh
   ```

   Com `E2E_MANTER_STACK_FINAL=1`, a stack fica de pé no fim.
3. Tire da cópia local **só** as linhas necessárias e escreva o SQL de
   correção. Revise o SQL em PR, como se fosse migration.
4. Aplique em produção pelo processo normal (`deploy-checklist.md`), com o
   backup do passo 1 feito.

Nunca restaure o dump inteiro por cima de produção. O script não deixa, e o
caminho manual (`pg_restore --clean`) apagaria tudo o que foi gravado
depois do backup.

### 5.3 Ensaio periódico

**Actions → Ensaio de restauração (manual) → Run workflow.**

| Modo | Quando usar | Secret |
| --- | --- | --- |
| `backup_run_id` vazio (sintético) | prova que os scripts funcionam com o schema atual do repositório | nenhum |
| com `backup_run_id` (real) | prova que **aquele** backup abre com a senha cadastrada e restaura inteiro | `BACKUP_PASSPHRASE` do environment `backup` |

O modo real não imprime contagem nem dado no log: o repositório é público.

O que o ensaio confere, nos dois modos:

1. Origem × destino, item a item, em 13 categorias de estrutura:
   - tabelas e RLS, colunas, índices, constraints, policies;
   - funções, com corpo, `search_path` e `security definer`;
   - triggers, views, sequências;
   - ACL de tabela, coluna, função e schema.

   E ainda: contagem de cada tabela, ledger, jobs do cron e event triggers.
2. Login pelo Auth local:
   - no sintético, com a senha original;
   - no real, com senha trocada **só na cópia local**.

   O token tem de trazer as claims de escola e papel.
3. Coordenação, aluno e responsável leem escola, alunos, vínculos e
   progresso pela API. O que a API devolve bate com o banco, e ninguém vê
   outra escola.
4. RPC do painel (`resumo_escola`).
5. O `ensure_rls` funciona: tabela nova no `public` nasce com RLS.
6. Cron:
   - todo job existe e está desligado;
   - nenhum tem chamada externa;
   - não há `pg_net`;
   - o comando de cada um roda numa transação desfeita.
7. Contrato de RPCs do front (`manifesto-rpcs.mjs`).
8. A **matriz de autorização** inteira, sobre o banco restaurado.

## 6. O que o backup NÃO cobre

Fonte única: `NAO_COBERTO` em `scripts/backup/relatorio-ensaio.mjs`. O
relatório de cada ensaio repete a lista.

| Item | O que fica de fora |
| --- | --- |
| **Storage** | os arquivos dos buckets e a configuração deles. O demo tinha o bucket `Logos-escolas` com 2 objetos em 26/09 |
| **Secrets das Edge Functions** | `ALLOWED_ORIGINS`, `PASSWORD_RESET_REDIRECT_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `VERCEL_PREVIEW_PREFIX(ES)`. O código das funções vem do repositório |
| **Configuração do Auth** | Site URL, redirects, SMTP, limites de envio, expiração e chave de assinatura do JWT, cadastro público, provedores |
| **Chaves de API** | publicável, secreta, anon e `service_role` legadas. Projeto novo tem chaves novas |
| **Configuração do projeto** | schemas expostos na Data API, região, plano, pooler, senha do banco, Vault |
| **Sessões e tokens de uso único** | fora de propósito: todos entram de novo depois do retorno |
| **Objetos de banco fora dos schemas copiados** | extensões (o restore recria só o `pg_cron`), roles e grants da plataforma, publicações do Realtime, schemas `storage`, `realtime`, `vault`, `graphql`, `extensions`, `cron`. Os jobs voltam pelo manifesto |
| **Vercel** | projetos, domínios, variáveis `VITE_*`, histórico de deploys |
| **GitHub** | secrets de repositório e do environment, que apontam para o projeto antigo |
| **O que foi gravado depois do clique** | ver RPO |

## 7. Limitações, sem enfeite

1. **O artefato fica num repositório público.** Por 30 dias, qualquer conta
   do GitHub baixa o `.tar.gpg`. Entre o arquivo e o dado de menor de idade
   só existe a senha. Por isso ela é aleatória, com 32+ caracteres, e o S2K
   do gpg está no máximo.
2. **LGPD.** O dump de produção cifrado fica na infraestrutura do GitHub,
   fora do Brasil. Produção foi para `sa-east-1` justamente para o dado de
   menor ficar no Brasil. Dado cifrado continua sendo dado pessoal para
   quem tem a chave, então isto é transferência internacional (art. 33).
   **Decisão do dono e do encarregado de dados, não do código.**
3. **A senha que cifra mora no GitHub**, junto com a credencial do banco.
   Quem conseguir rodar um workflow alterado na `main` lê as duas. O
   reviewer obrigatório no environment reduz esse risco.

   A alternativa que a `matriz-configuracao.md` (8.2) recomendava não tem
   essa fraqueza:
   - chave **pública** no repositório (`age -r` ou `gpg -r`);
   - chave privada **offline**, com o dono.

   O GitHub cifraria e nunca conseguiria decifrar. O custo: o ensaio real
   pelo Actions deixa de existir, e passa a rodar na máquina do dono.
4. **A credencial é do papel `postgres`**, com todos os privilégios. O dump
   roda numa transação `READ ONLY`, mas o secret em si escreveria. Um papel
   só de leitura exige mudar produção, e isso não foi feito nesta etapa.
5. **O retorno a um projeto hospedado nunca foi ensaiado.** O que só o
   hospedado decide não passou por ensaio:
   - `set session_replication_role`;
   - `create event trigger`;
   - `create extension pg_cron`.

   Tudo isso roda como `postgres`: é o que a documentação da Supabase manda
   para restore de dados, e a 0045 criou o `ensure_rls` assim nos dois
   ambientes. Ainda assim, "deve funcionar" não é prova.
6. **A versão do Auth local pode ser mais velha que a do hospedado.** A stack
   da CLI 2.118.0 traz o GoTrue v2.197.0. Se o hospedado tiver coluna ou
   tabela nova no `auth` com dado, o ensaio **real** reprova no passo do
   Auth. O defeito é da stack local, não do backup: suba a CLI fixada. Um
   projeto novo sempre tem GoTrue igual ou mais novo, e o retorno 5.1 não
   tem esse problema.
7. **Sem agendamento, sem aviso.** Nada avisa que o último backup tem 29
   dias.
8. **O dump é consistente só para o banco.** Storage e configuração não
   têm o mesmo instante.

## 8. O que muda quando entrar o Pro

| | Free (hoje) | Pro |
| --- | --- | --- |
| Backup gerenciado | nenhum | diário, 7 dias de retenção, restauração pelo painel |
| RPO de desastre | último clique | até 24 h com o diário. Minutos com o PITR, que é add-on pago à parte |
| Pausa por inatividade | sim (keepalive necessário) | não pausa. O `manter-banco-acordado.yml` pode sair |
| Conexão direta por IPv4 | não (Session pooler) | add-on pago. O pooler continua servindo |

**O que o Pro não resolve**, e por isso este workflow continua:

- o backup gerenciado **não leva os arquivos do Storage** nem a
  configuração do projeto;
- o backup gerenciado vive **na mesma conta**. Conta perdida é backup
  perdido;
- a restauração pelo painel volta o **projeto inteiro**, com parada.
  Retorno parcial (5.2) continua sendo por dump.

Com o Pro, faz sentido:

1. manter o clique antes de cada mudança;
2. rodar este workflow toda semana como cópia **fora** da Supabase (aí, sim,
   com agendamento);
3. repetir o ensaio real depois de cada mudança de plano.

## 9. Evidência do ensaio

### 9.1 No Actions (runner padrão)

Execução [`36263340832`](https://github.com/Jinriuk/Rumo-a-aprova-o-/actions/runs/36263340832)
do **Ensaio de restauração (manual)**, modo sintético, na `main` em
`8c58c36`, em 26/09/2026 às 18:40 UTC.

- Job: 2 min 2 s. O passo do ensaio levou 95 s.
- Relatório no artefato `ensaio-restauro-sintetico-36263340832-1`, retido
  30 dias.

| Fase | Tempo |
| --- | --- |
| Origem sintética | 59,0 s |
| Backup (`dump.sh`) | 0,8 s |
| Stack nova e vazia | 23,9 s |
| **Restore** | **1,1 s** |
| Conferência origem × destino | 0,2 s |
| Conferências funcionais | 1,1 s |
| Contrato de RPCs | 0,1 s |
| Matriz de autorização | 1,9 s |

O restore, por fase:

| Trava | Decifra | Estrutura e dados | ACLs | Auth | Cron e event triggers |
| --- | --- | --- | --- | --- | --- |
| 0,1 s | 0,2 s | 0,4 s | 0,1 s | 0,0 s | 0,2 s |

O arquivo: `triliva-sintetico-20260926T184122Z.tar.gpg`, 737.391 bytes,
SHA-256
`59bf9f3c7607535985c957c8cba70ebadd238fff05ded2213e32c415cd55f5ac`.

**Resultado:** igual ao da seção 9.2, item por item. Os 16 checks, a matriz
(7/7) e o contrato de RPCs (11) passaram. O mesmo run provou, no runner, o
cliente Postgres 17 via PGDG e o `dump.sh` que o workflow Backup usa.

### 9.2 Na máquina de desenvolvimento

Ensaio sintético de 26/09/2026, na stack local da E3: CLI 2.118.0, Postgres
17.6, GoTrue v2.197.0.

| Fase | Tempo |
| --- | --- |
| Origem sintética: stack, 59 migrations, seeds, 8 contas, 2 jobs, schema `demo` mínimo | 32,4 s |
| Backup (`dump.sh`: dump, cifra, prova de decifra) | 1,8 s |
| Stack nova e vazia | 25,6 s |
| **Restore** | **3,0 s** |
| Conferência origem × destino | 0,2 s |
| Conferências funcionais | 1,0 s |
| Contrato de RPCs | 0,1 s |
| Matriz de autorização | 2,5 s |

O restore, por fase:

| Trava | Decifra | Estrutura e dados | ACLs | Auth | Cron e event triggers |
| --- | --- | --- | --- | --- | --- |
| 0,1 s | 0,5 s | 0,7 s | 0,4 s | 0,3 s | 0,7 s |

O arquivo: `triliva-sintetico-20260926T181900Z.tar.gpg`, 737.391 bytes,
SHA-256
`eef414360406c430a67ba7df2ebf3d04a15560bf875ff1dc26099dacfde2cc4f`. A senha
foi aleatória e descartada, e o arquivo morreu com a stack.

**Resultado:**

- origem × destino iguais nas 13 categorias:
  - 60 relações, 429 colunas, 151 índices, 246 constraints;
  - 85 policies, 67 funções, 8 triggers, 3 views, 6 sequências;
  - ACL de 60 relações, 21 colunas, 67 funções e 4 schemas.
- 67 de 67 tabelas com a mesma contagem;
- ledger, cron e event triggers iguais;
- 16 conferências funcionais, contrato de RPCs (11) e matriz (7 testes,
  0 falha) aprovados.

**Três armadilhas achadas no ensaio**, e que o `restaurar.sh` trata:

1. **Privilégio a mais.** Restaurar num projeto Supabase soma os privilégios
   padrão do destino às ACLs do dump. O dump só registra diferenças contra
   o default do Postgres. Resultado: `anon` com `EXECUTE` em **66 funções**
   dos schemas da aplicação, contra 12 na origem (as do `app`, que `anon`
   não alcança).

   Sobre o banco adulterado:
   - a matriz reprova só **2 casos** (`N.resumo_escola` e
     `N.sou_super_admin` para `anon`);
   - a comparação de ACL pega todas as funções.

   A matriz sozinha não bastaria.
2. **O `ensure_rls` some.** Event trigger é objeto do banco, não do schema,
   e o dump por schema não o leva. Sem ele, tabela criada no `public` depois
   do retorno nasceria sem RLS.
3. **Os jobs do cron somem**, pelo mesmo motivo.

Também na máquina: o **modo real**, com um backup de senha conhecida,
aprovado com as contagens redigidas. As provas negativas também reprovaram
como deviam:

- senha errada;
- arquivo adulterado, pego pelo SHA do manifesto e, sem manifesto, pelo MDC
  do gpg;
- destino hospedado declarado como local;
- restore por cima de banco com dado.

## 10. Arquivos

| Arquivo | Papel |
| --- | --- |
| `.github/workflows/backup.yml` | o backup, só manual, environment `backup` |
| `.github/workflows/ensaio-restauro.yml` | o ensaio, sintético (sem secret) ou real (environment `backup`) |
| `scripts/backup/dump.sh` | orquestra o backup: dump, índice, pacote, cifra, prova de decifra, manifesto |
| `scripts/backup/despejar.mjs` | trava de origem, snapshot, retrato e `pg_dump` |
| `scripts/backup/metadados.mjs` | retrato de um banco (origem e destino) |
| `scripts/backup/toc.mjs` | divide o índice do dump nas fases do restore |
| `scripts/backup/restaurar.sh` | restore em fases, cronometrado |
| `scripts/backup/alvo.mjs` | trava de destino: local, ou o ref do projeto novo; sempre vazio |
| `scripts/backup/pos-restauro.mjs` | event triggers e jobs do cron |
| `scripts/backup/comparar.mjs` | origem × destino |
| `scripts/backup/ensaio.sh` | o ensaio inteiro na stack da E3 |
| `scripts/backup/semear-sintetico.mjs` | origem sintética |
| `scripts/backup/conferir-restauro.mjs` | conferências funcionais |
| `scripts/backup/relatorio-ensaio.mjs` | relatório e a lista do que não é coberto |
| `tests/ci-backup.test.mjs` | guardas estáticas dos workflows e testes da lógica pura (roda no `build-e-unitarios`) |

Rodar o ensaio na máquina: mesmos requisitos do `e2e-ambiente.md` (Docker,
CLI 2.118.0, Node 22, `npm ci` em `app/` e `tests/`), mais o cliente
Postgres 17 (`PG_BIN`) e o GnuPG:

```bash
PG_BIN=/usr/lib/postgresql/17/bin bash scripts/backup/ensaio.sh
```
