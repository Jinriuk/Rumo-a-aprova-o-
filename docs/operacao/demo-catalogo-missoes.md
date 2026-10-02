# Demo: catálogo de missões igual ao da produção (proposta)

**Escrito em:** 02/10/2026. **Não aplicado.** Só roda no projeto de
demonstração, depois da 0061 (`missoes-em-sequencia.md`) aplicada lá, e com
autorização do dono.

## 1. A divergência

Medido no demo em 02/10 com SELECT só de leitura. Na coluna da produção,
**medido** é o que o gestor leu em 01/10; o resto é o que as seeds do
repositório montam (o banco de teste dá exatamente isso), ainda não lido na
produção. O `conferir` abaixo, rodado na produção, fecha essa lacuna sem
alterar nada.

| Item | Demo | Produção |
| --- | --- | --- |
| Missões no catálogo | 8 (cn 3, espcex 2, epcar 1, esa 1, eear 1) | 30 (seeds) |
| Missões com meta (fecham sozinhas) | **0** | **26** (medido) |
| Missões da EsPCEx | 2 (starter) | 24 (seed 20) |
| Assuntos da EsPCEx | 5 (starter da seed 07) | 80 (seed 19) |
| Planos de trilha da EsPCEx | 2 | 4 (seed 20) |
| Trilha e calendário da EsPCEx | não existem (só `colegio-naval`) | existem (seed 20) |
| `concursos.espcex` | beta v1 | completa v3 (seed 18) |
| `missoes_escola` | 0 linhas | qtd_questoes 0 (medido) |
| `aluno_missoes` | 0 | 0 (medido) |
| `registros_estudo` | 541 (539 com acertos) | 0 (medido) |

Causa: o demo ficou no catálogo inicial da seed 09 (§1 e §2). Nunca rodaram
lá a seed 09 §5 (meta numérica para o motor), a 19 (catálogo oficial da
EsPCEx), a 20 (missões, planos e calendário da EsPCEx) nem a parte da 18 que
carimba a EsPCEx.

Efeito hoje: a vitrine não mostra missão nenhuma. O painel só aparece com
missão que tem meta, e no demo não há nenhuma. Por isso o defeito da 0033
(um registro fechando três missões) nunca apareceu lá.

## 2. A proposta, em ordem

Pré-requisitos: PR de banco das missões mesclado (a seed 20 do repositório
já com a Física corrigida), 0059 e 0061 aplicadas no demo, backup do demo.
Cada passo no SQL Editor do projeto **demo**:

0. `supabase/demo/correcoes/2026-10-02_catalogo_missoes_conferir.sql`: anotar o "antes".
1. `supabase/demo/correcoes/2026-10-02_catalogo_missoes_1_preparar.sql`:
   trava (aborta fora do demo e sem a 0061), backup em
   `demo.backup_20261002_*` e a seed 09 §5.
2. `supabase/seed/19_espcex_ped2_r3.sql`: os 80 assuntos oficiais, os
   cadernos de 2024–2025, as 200 questões tagueadas e a recorrência. A seed 20
   liga cada missão ao assunto **pelo nome**: sem este passo ela pula 21 das
   24 missões e a checagem final dela aborta.
3. `supabase/seed/20_trilha_espcex.sql`: 24 missões, 4 planos e o calendário.
4. `supabase/seed/18_maturidade_concursos.sql`: EsPCEx como completa v3.
5. `2026-10-02_catalogo_missoes_conferir.sql` de novo. Esperado: 26 · 24 ·
   21 · 0 · 80 · Eletricidade → Termologia → Mecânica · 4 · completa v3.

São as mesmas seeds que a produção recebeu, sem cópia de dado. Todas são
idempotentes e conferem o próprio resultado.

Desfazer: `supabase/demo/correcoes/2026-10-02_catalogo_missoes_9_desfazer.sql`.
Volta as metas e a maturidade ao backup e não apaga nada. As missões novas
ficam sem meta, e o motor as ignora. Assuntos, questões e calendário da
EsPCEx ficam, como conteúdo global inerte.

**Por que nunca antes da 0061:** com o motor antigo, dar meta às missões faz
a vitrine fechar três missões com um registro e pagar o XP três vezes. A
trava do passo 1 recusa rodar sem a 0061.

## 3. O que a vitrine passa a mostrar (decidir antes de aplicar)

Pela regra da 0061, registro anterior ao início da missão não conta: só conta
o que tem horário de recebimento do servidor, e os 541 registros do demo não
têm. Depois do alinhamento:

- **Todo aluno vê a fila inteira em "a seguir", com 0 concluídas**,
  inclusive quem tem semanas de registros.
- **Meridiano:** o replay semanal (`demo._aplicar_fila`) insere os registros
  com os gatilhos desligados (`session_replication_role = replica`). Nenhum
  registro do replay passa pelo motor. A missão só anda com registro feito
  ao vivo, numa demonstração. A virada de segunda (`demo.virar_semana`)
  apaga `aluno_missoes` do Meridiano, e a missão volta a "a seguir" toda
  semana. O XP de missão concluída ao vivo fica no ledger (mesma regra do XP
  ao vivo de hoje) e não é pago de novo na semana seguinte, porque a chave é
  `missao_motor:<aluno>:<missão>`.
- **Em modo replica as cascatas de FK também não disparam:** as linhas de
  `app.registros_recebidos` e `app.missao_registros` dos registros feitos ao
  vivo ficam órfãs depois da virada. É inofensivo, porque o id de registro
  ao vivo não se repete e nenhuma consulta parte delas, mas acumula.
- **Matriz** (60 alunos, 14 da EsPCEx): os registros vieram da semeadura,
  sem gatilho. Fica tudo em "a seguir" até alguém registrar ao vivo.

Duas saídas:

- **(a) Aceitar.** A vitrine mostra a fila, e a primeira missão anda ao vivo
  quando quem demonstra registra estudo com acertos. Custo: quem navega pela
  vitrine vê "0 de N concluídas" em alunos com semanas de estudo, o que
  parece produto quebrado.
- **(b) O replay passa pelo motor.** No fim de `demo._aplicar_fila`, dar
  recebimento aos registros liberados (horário = `criado_em` gravado) e chamar
  `app.missoes_reavaliar_aluno` para cada aluno do Meridiano. A vitrine
  mostra missões em andamento e concluídas calculadas pelo motor real. É
  mudança no mecanismo do Bloco 1 (`supabase/demo/04_funcoes.sql`). O XP de
  missão do replay precisa entrar no arquivamento da virada, como o de
  registro já entra. Fica para um PR próprio.

Recomendação: **(b) junto com este alinhamento**. Se for (a), alinhar só
depois de testar a demonstração ao vivo (registrar → missão "Atual" → barra
andando).

## 4. Fora do escopo, anotado

Os 14 alunos da EsPCEx da Matriz apontam para a trilha `colegio-naval`
(`alunos.trilha_id`). A seed 20 cria a trilha da EsPCEx, mas não troca a
trilha de ninguém. As missões não dependem disso (seguem o concurso do
aluno), mas o calendário mostrado continua o do Colégio Naval.

## 5. Provas

`tests/demo-catalogo-missoes-db.test.mjs`, contra o banco de teste com o
estado do demo simulado numa transação desfeita:

- preparar e seeds 19, 20 e 18 dão os números da produção, com a Física
  na ordem nova;
- o passo 1 só preenche meta nula, e rodar de novo não sobrescreve o backup;
- desfazer volta metas e maturidade sem apagar missão;
- recusa fora do demo, sem a 0061 e sem backup;
- os scripts não têm `delete`, `drop` nem `truncate`, e o `conferir` só lê.
