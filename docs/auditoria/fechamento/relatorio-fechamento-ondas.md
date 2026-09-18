# Fechamento do programa das 8 Ondas — resposta à auditoria externa

**Base inicial:** `7d13f6d448ff0a3b693284f61041d1e270a5a471`
**Data:** 18/09/2026
**Executor:** clone íntegro do repositório, Postgres 16 local dedicado.

Este documento existe porque a auditoria externa foi honesta sobre o que
não conseguiu fazer, e o que ela não conseguiu fazer era justamente a
parte que decide. Ela declarou **0 itens em categoria A** — "fechado com
teste existente causalmente demonstrado" — não porque os testes fossem
ruins, mas porque o executor dela não tinha clone, nem Postgres, nem
navegador. Tudo virou "evidência histórica não reexecutada".

Este executor tem clone e Postgres. Então a primeira coisa foi parar de
discutir e rodar.

---

## 1. O que foi efetivamente executado (e não herdado de relatório)

| Verificação | Auditoria externa | Aqui |
|---|---|---|
| `reset-db.sh` | não executado | **executado** (Postgres 16 local, banco `rumo_teste` dedicado) |
| Suíte de testes | não executado | **executado** — 918/918 na base auditada; **956/956** no fechamento |
| Lint | não executado | **executado** — 0 errors / 256 warnings |
| Build | não executado | **executado** — verde |
| Contrafactual do A9 | não executado | **executado** — ver §3 |
| Supabase remoto | inalcançável | **inalcançável também aqui** |
| Navegador / E2E | não executado | **não executado** |

As duas últimas linhas importam tanto quanto as primeiras. O que depende
do remoto (S2, bans de Auth, paridade de ledger, RLS em ambiente
equivalente) e o que depende de olho humano (a revisão visual de
contraste, menus e modais) continua **sem comprovação**, e nada neste
documento deve ser lido como se tivesse sido fechado.

O número 918 merece nota: a auditoria o tratou como alegação do merge da
Onda 7. Ele está certo. Reproduzi exatamente, assim como os "0 errors /
256 warnings". A auditoria estava certa em não promover esses números a
prova sem reexecutar; e eles sobreviveram à reexecução.

---

## 2. Onde a auditoria está errada

### 2.1 A13 — seguir a instrução da auditoria reintroduziria o defeito

A matriz manda, para o A13: *"Seed limpo local: assert `data_prova_alvo`
NOT NULL/futura para toda vitrine"*. **Não faça isso.** A PR #114 já
havia revertido esse preenchimento, e ela está certa. Conferi em
`app/src/modules/conteudo/concursos.js`:

`diasParaProva` tem duas vias, nesta precedência:

1. `aluno.data_prova_alvo` — uma **ocorrência específica**. Quando a data
   passa, devolve `realizada: true, dias: null` e **para ali**. Não rola.
2. `mes_prova`/`dia_prova` do concurso, via `proximaProva` — data
   **recorrente**, que rola sozinha para o ano seguinte e nunca diz
   "realizada", porque para uma data anual o que existe é sempre a
   próxima.

Preencher a via 1 em massa tira o aluno do automático e o prende a uma
data que vence. É a mesma classe de defeito que a Onda 8 existe para
matar em todo o resto do seed, e é literalmente o T27 que a Onda 3
corrigiu. A própria PR #104 já havia conferido que "nenhuma tela lia a
coluna" e empurrado o assunto para a Onda 8; a Onda 8 olhou e reverteu.
Duas ondas independentes convergiram, e a auditoria passou por cima das
duas.

Pior: a instrução é incoerente com a própria auditoria. "NOT NULL/futura"
hoje vira "NOT NULL/vencida" em alguns meses — exatamente o A14, que a
mesma matriz classifica como defeito determinístico com o tempo.

Estado verificado no banco semeado: 60 alunos da vitrine, **1** com
`data_prova_alvo`. A coluna continua existindo para a escola que sabe a
data publicada do ano. É exceção, não preenchimento em massa.

### 2.2 A discrepância 86 × 87 tem origem localizável

A auditoria reconstruiu 87 rótulos, registrou que o programa se diz de
86, e se recusou a apagar um para fechar a conta. A recusa foi correta.
Mas a conta dá para fechar melhor do que ela fechou, e sem o catálogo.

Confirmei primeiro que o catálogo realmente não está no repositório:
varri **todas** as refs (locais e remotas) procurando qualquer documento
com mais de 30 IDs do formato do catálogo. Nenhum. A auditoria está certa
nesse ponto.

O que dá para fazer é somar o que **as próprias PRs declaram**:

| Onda | PR | Declarado pela própria PR |
|---|---|---:|
| 1 | #100 | "Fecha B1, B2 e, de carona, T44. **3 dos 86**" | 3 |
| 2 | #101 | "Fecha **8 dos 86**" | 8 |
| 3 | #104 | título: A1, T27, T28, C9 | 4 |
| 4 | #105 + #106 | #106 "21 itens", declarando #105 (I12) como **já mergeado à parte** | 22 |
| 5 | #110 | título "17 itens" | 17 |
| 6 | #111 | título "21 itens" | 21 |
| 7 | #112 | título: A2, A3, S1, S2, S3 | 5 |
| 8 | #114 | A4, A6, A7, A10, A12, A13, A14 | 7 |
| | | **Soma** | **87** |

Ou seja: **a soma das declarações das próprias ondas dá 87, não 86.** A
discrepância é interna à contabilidade do programa — não é artefato da
reconstrução da auditoria. Isso muda a ação recomendada: não há rótulo
"a mais" inventado pela auditoria para descartar; há uma conta do
programa que nunca fechou.

Verifiquei também a evidência que a auditoria usa como prova disso, e ela
está exata: o corpo do PR #110 enumera **18 IDs distintos** (`I9, T31,
T33, T32, T34, T35, I11, T29, I10, T42, T37, T38, T39, T40, T10, T43,
T46, T30`) sob um título que diz 17. A explicação é benigna: `T29` já
tinha sido entregue na Onda 4 (#106, blocos 3 e 5) e a Onda 5 o revisita
sem recontá-lo. Contado uma vez, Onda 5 contribui 17.

### 2.3 "0 em categoria A" era verdade sobre a auditoria, não sobre o repositório

A frase é honesta e foi bem qualificada pela própria auditoria ("mede
proteção causal demonstrada **nesta auditoria**"). Registro só para que
não seja citada fora de contexto: ela mede o ambiente do auditor. Pelo
menos três PRs (#100, #104, #106) descrevem contrafactuais executados com
contagem de quais testes caem, e a Onda 4 usou Chromium real nos blocos 7
e 9. Isso não é o mesmo que reexecução independente — mas também não é
"sem evidência causal".

---

## 3. Onde a auditoria está certa, e o que foi feito

### 3.1 A9 — confirmado, e era pior do que "resíduo" (FECHADO)

A auditoria classificou A9 como **C** (declarado fechado, persiste).
Confirmado em `SimuladoConcurso.jsx:50`:

```js
(simulados ?? []).filter((s) => !s.exam_tag || s.exam_tag === concurso?.codigo)
```

Dois agravantes que a auditoria não registrou:

1. **Não era hipótese.** O banco semeado tem 1 simulado em 35 com
   `exam_tag` nulo. O caminho é exercitável hoje.
2. **O resíduo tinha dono.** O PR #101 não só documentou a pendência —
   ele a endereçou a uma onda específica: *"Resíduo consciente para a
   Onda 5: `SimuladoConcurso.jsx:50` ainda dobra simulado com `exam_tag`
   nulo no concurso atual (…) a saída certa é marcar como 'formato não
   registrado'"*. A Onda 5 veio e não fez. Não foi esquecimento difuso:
   foi uma tarefa atribuída que caiu.

O estrago passava do filtro: `ultimo` alimenta o diagnóstico inteiro
(objetivo, nota por dia, alerta de eliminação) contra as `materias`,
`elimination_model` e `redacao_role` do concurso **atual**, e o histórico
reavaliava cada linha do mesmo jeito. Um simulado de formato desconhecido
recebia veredito de eliminação de uma prova que talvez nunca tenha
prestado.

**Correção.** A regra saiu para `segregarPorFormato`, em
`modules/conteudo/simuladoConcurso.js`. Nulo passa a significar o que
significa — formato não registrado, não "o atual". O histórico continua
visível (o registro é do aluno), em seção própria, com acertos brutos,
rótulo "formato não registrado" e **sem** veredito de eliminação: dizer
"sem risco" ali seria inventar uma prova para o passado.

A extração para módulo puro é resposta direta ao §9.4 da auditoria
("muitos testes de UI são inspeção de fonte"). O teste é de
comportamento, não de texto.

**Contrafactual executado.** Revertendo a condição para `!s?.exam_tag ||
…` e rodando `tests/onda8-a9-historico-sem-formato.test.mjs`: **3 dos 5
testes caem**, nas asserções — *"só o simulado gravado como 'cn' pode ser
avaliado no formato do CN"*, um `deepEqual` de segregação, e *"um
simulado apareceu nas duas listas"*. Nenhuma falha por erro de import.
Arquivo restaurado em seguida; suíte verde.

### 3.2 S1 no reseed — confirmado (FECHADO pela integração da Onda 8)

Confirmado na base auditada: `supabase/seed/13_vitrine_militar_demo.sql`
linha 173 fazia `crypt(v_codigo, gen_salt('bf'))`, e o `reset-db.sh`
pulava os seeds 04, 13 e 14. O repositório continha um caminho
determinístico que recriava a classe do defeito, e o CI não o via.

A PR #114 resolve pela raiz certa: o corte deixa de ser por arquivo e
passa a ser **por schema**. O seed 13 virou 100% público e as contas de
Auth saíram para o seed 21 (o único, com o 04, que o reset pula). Efeito
colateral bom: o 13 e o 14 — 60 alunos, registros, metas e simulados —
entraram no CI pela primeira vez. Era a ausência deles que deixou as
datas de junho congelarem três meses em silêncio.

Verificado após integração: seed 13 sem nenhuma escrita em `auth.*`; seed
21 nasce com senha fixa de cenário não derivável do código; o banco local
não tem schema `auth`, então o 21 é corretamente pulado.

**O que continua aberto:** o lado remoto. Se as contas já criadas no
Supabase foram efetivamente rotacionadas/banidas, isto não prova. A
correção da #113 é relevante e foi integrada: `credencial_status =
'revogada'` na tabela da aplicação **não** bloqueia login no GoTrue por
si só.

### 3.3 Ciclo seguinte sem porta — confirmado (FECHADO)

A auditoria registra que a PR #115 admite não ter UI. Confirmado: o diff
dela é migration `0051` + `abrirProximoCiclo` no seam + teste de banco.
Nenhum componente a chama.

Isso deixava a tela do responsável prometendo, desde a Onda 3, uma ação
inexistente: *"a coordenação abre o próximo ciclo quando ele estiver
pronto"* (`ResumoResponsavel.jsx`). Promessa a pai de aluno apontando
para o vazio.

**Entregue:** aba "Ciclo" na Área da Escola, com selo de quantos alunos
estão parados no fim do plano. Por trilha com alunos encerrados: quem
terminou, a data da próxima prova já preenchida com a mais próxima do
grupo (editável — quem sabe a data publicada do ano é a escola), e a
marcação de quem entra.

Duas decisões que valem revisão:

- **Ninguém vem pré-marcado.** No fim de um ciclo a turma se divide:
  quem passou sai, quem não passou repete, quem desistiu some. Vir tudo
  marcado transforma "seguinte, seguinte" em turma inteira renovada — e
  aluno renovado em silêncio vira aluno **ativo** nos painéis,
  corrompendo o alerta de "sem atividade" que as Ondas 5 e 7 acabaram de
  consertar.
- **A âncora sugerida é a prova mais próxima do grupo.** Quando a turma
  mistura concursos, um plano só não serve aos dois calendários; a tela
  avisa. Terminar na prova mais próxima faz quem tem prova distante ter
  folga; o contrário faria alguém chegar despreparado. Folga é
  recuperável, atraso não.

A regra (quem aparece, para qual data, o que é recusado) vive em
`modules/escola/proximoCiclo.js`, pura e testada. `validarAncora`
espelha a checagem do `0051` para a tela explicar o problema em vez de
deixar vazar erro do Postgres.

### 3.4 Índice de status materialmente vencido — confirmado (FECHADO)

`docs/00-indices/03-status-atual.md` estava de 02/07 e errava para os
dois lados. Superestimava: "liberado para piloto controlado pequeno" e
"nenhum P0/P1 de segurança aberto", com 475 testes / 37 migrations / 6
Edge Functions, enquanto o repo tinha 91 arquivos de teste, 52 migrations
e 7 funções. E se contradizia na mesma página, listando "credencial do
aluno = código" como item aberto.

**Subestimava também**, e isso a auditoria não pegou: apontava
`provisionar-aluno/index.ts:205 (password: codigo)` como fio solto, e
esse caminho já estava corrigido — a função gera `novaSenhaTemporaria()`
independente do código, com `must_change_password: true`. Índice que
subestima progresso gasta o tempo de quem for reconsertar o que já está
pronto.

Reescrito com marcação de procedência em cada número (`medido` ou **`não
verificado`**), com os números remotos **removidos** em vez de
recopiados. E travado por teste (`tests/indice-status-nao-vence.test.mjs`)
nas três contagens que rotam sozinhas, mais a contradição interna. O
teste já se provou: falhou ao contar a si mesmo, e quem estava atrasado
era o documento.

---

## 4. Itens D que dava para verificar aqui

| ID | Veredito | Evidência executada |
|---|---|---|
| A14 | **fechado** | Registro mais recente da vitrine = **hoje**, 277 registros. O seed rola com a data corrente. |
| A6 | **fechado** | Minutos por sessão entre 16 e 75 — sem as combinações implausíveis do catálogo. |
| A13 | **inválido como descrito** | §2.1. |
| A8 | **parcial, honestamente** | O lado do código tem cobertura (`avaliarRedacao` em todos os papéis, teste da Onda 2). O lado do dado ficou magro: **1** dos 35 simulados semeados tem `redacao_nota`. O caminho deixou de ser nunca exercido, mas 1 em 35 não é distribuição. |
| T15 | **premissa confirmada, sem defeito de código** | O renderer usa `PRIORIDADE` corretamente. Distribuição atual: F=83, P=69, X=7. Em **4 de 18** semanas todas as atividades ainda têm a mesma prioridade — nessas, os chips *parecem* iguais porque *são* iguais. É decisão de conteúdo, não bug. Não mexer no renderer, como a auditoria já dizia. |
| S2 | **aberto** | Configuração do Supabase Auth. Não verificável daqui. |

Idempotência: `reset-db.sh` roda o seed duas vezes de propósito.
Conferido em SQL depois do reseed — **0** duplicatas de aluno por
(escola, nome).

---

## 5. O que continua aberto, e o que isso significa

Fechar as Ondas **não aprova o G3** do Plano Mestre. Continuam sem
comprovação, e nenhuma delas se prova a partir deste repositório:

1. **S2 e a verificação remota do S1.** Provar que revogação bloqueia
   login de fato, e que a proteção contra senhas vazadas está ligada em
   demo e produção.
2. **Revisão visual.** O roteiro da auditoria
   (`evidencias/revisao-visual.csv`) continua válido e continua não
   executado. O token vermelho é calculado em runtime
   (`clarearAteRazao("#D9695E", …, 4.5)`) e também é fundo e borda — o
   raio da mudança é maior que "texto vermelho". Precisa de olho humano
   em 1366×768 e 390×844.
3. **E2E em navegador real** para os quatro perfis. Os testes deste repo
   são lógica pura e inspeção de fonte; travam estrutura, não resultado
   visual.
4. **Paridade do ledger de migrations**, RLS em ambiente equivalente,
   backup/restore exercitado, monitoramento observável no remoto.
5. **A UI do próximo ciclo nunca foi exercida contra o Supabase real.**
   A regra da tela é testada e o RPC tem teste de banco, mas o caminho
   coordenação → RPC → aluno migrado só fecha quando alguém abrir.
6. **PR #109 (Dependabot, inclui ESLint 10)** continua por avaliar, e por
   último: mudança de major do linter transforma "warning novo" em "regra
   nova", o que invalidaria a linha de base de 256 como termo de
   comparação.

---

## 6. Como reproduzir

```bash
# Postgres 16 local dedicado (NÃO usar banco remoto)
pg_ctlcluster 16 main start
cd tests && npm install
PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres bash reset-db.sh
PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres PGDATABASE=rumo_teste npm test

cd ../app && npm install && npm run lint && npm run build
```

Contrafactual do A9 — em `modules/conteudo/simuladoConcurso.js`, trocar
em `segregarPorFormato`:

```js
doConcurso: todos.filter((s) => !!s?.exam_tag && s.exam_tag === codigoConcurso),
// por:
doConcurso: todos.filter((s) => !s?.exam_tag || s.exam_tag === codigoConcurso),
```

e rodar `node --test tests/onda8-a9-historico-sem-formato.test.mjs`. A
falha válida é nas asserções de segregação; erro de import não vale.
Restaurar em seguida.
