# Relatório Preliminar — Fase C0.5 (Bloco A): Auditoria da Fase 15 + estado do motor C0

> **Status:** Bloco A (auditoria seca) **concluído** + **fiação da Fase 15 ao runtime concluída**
> (autorizada pelo usuário, não-destrutiva — §8). Bloco B (rebuild da base demo) e integração da
> Fase C0 **NÃO executados** — aguardam autorização/decisão (ver §C0 e §11).
>
> Nenhum dado foi apagado. Nenhuma migration foi aplicada em ambiente remoto. Todo o trabalho de
> runtime foi feito em um Postgres **local efêmero** (`/tmp/rumo_pg`, porta 54322), criado e
> destruído nesta sessão, sem qualquer contato com produção/staging.
>
> Data: 2026-06-19 · Branch: `claude/phase-c0-5-audit-rebuild-2d53a5`

---

## 0. Sumário executivo (responde às perguntas centrais)

| Pergunta | Resposta curta |
|---|---|
| A Fase 15 está **criada no banco**? | **Sim.** Migrations 0007–0015 criam toda a estrutura pedagógica por `exam_tag`. |
| A Fase 15 está **populada por seed**? | **Sim, parcialmente.** `trilha_planos` e `missoes` existem para os 5 concursos (cn/epcar/esa/eear/espcex). `assuntos/subassuntos`, simulados, recorrência e níveis só têm seed para **CN** (e parcial para EsPCEx). |
| A Fase 15 está **conectada na UI**? | **Não.** Nenhuma tela do aluno nem da coordenação chama `carregarMissoes`, `carregarTrilhaPlanos`, `carregarEstruturaProva` ou `carregarConcursoPorTag`. É código **morto em runtime**. |
| Novos alunos recebem **trilha correta por prova**? | **Não.** Todo aluno novo recebe a **trilha fixa CN ("Colégio Naval — CPACN/2026")**, independente do concurso-alvo. **Provado em runtime** (ver §A.5). |
| O sistema reaproveita o **plano fixo do Lucas Demo**? | **Sim.** Existe uma única trilha (a do Lucas/CN) e `trilhaPadrao()` sempre devolve ela. O `concurso_id` é gravado no aluno mas **não influencia o plano/meta**. |
| A **Fase C0** (motor de progresso persistido com ledger `aluno_eventos_progresso`) está presente? | **Existe, mas NÃO mergeada.** Está pronta na branch `claude/demo-base-realista-auditoria-t5ji99` como `0022_motor_progresso.sql`, com **colisão de numeração** (no main, `0022` é `logs_coordenacao`). Não está nesta branch nem no main. Ver §C0 (atualizada). |
| A C0 está **ativa na demo**? | **Não** — a migration C0 não está integrada na linha principal. Decisão pendente (não recriar do zero). |

**Veredito do Bloco A:** a Fase 15 está *arquiteturalmente completa e testada no banco*, porém
**pedagogicamente desconectada** do runtime. O sintoma relatado ("todo aluno vê o plano do Lucas
Demo") é **real, reproduzível e tem causa única identificada**: o cadastro de aluno atribui a
trilha padrão (CN) a todos, e tanto a tela do aluno quanto a da coordenação leem o plano dessa
trilha — nunca da estrutura por `exam_tag`.

---

## 1. Método e ambiente de prova

- **Análise estática** de migrations, seeds, data seam (`app/src/shared/data/index.js`), módulos
  de conteúdo e telas.
- **Prova de runtime** em Postgres 16 local efêmero: `tests/reset-db.sh` aplicou as **23 migrations
  + seeds 2×** (idempotência exercitada) sem erro.
- **Suíte de testes completa: `184/184 verde`** (`node --test`), incluindo testes de banco e de
  isolamento RLS.
- **Simulação de cadastro real** por concurso, executando o próprio `motor_gerar_meta` do banco.

Nenhuma ação tocou ambiente remoto. O cluster local foi descartado ao fim.

---

## 2. Auditoria da Fase 15 — tabela de status

Legenda: ✅ presente/funciona · ⚠️ parcial · ❌ ausente/morto

| Módulo (Fase) | Existe no banco | Tem seed | Tem fetcher no data seam | Aparece p/ o aluno | Aparece p/ a coordenação | Testado | **Status runtime** |
|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| Concursos / `exam_tag` (15.1) | ✅ (0007) | ✅ 6 concursos | ✅ `listarConcursos`/`carregarConcursoPorTag` | ⚠️ só nome/contagem de dias | ⚠️ só nome | ✅ | Lido só p/ **rótulo e data da prova**; não dirige conteúdo |
| Provas/dias/matérias/assuntos/subassuntos (15.2) | ✅ (0009/0010) | ⚠️ matérias p/ 5; assuntos só CN+EsPCEx | ✅ `carregarEstruturaProva` | ❌ | ❌ | ✅ | **Morto** — fetcher nunca é chamado pela UI |
| Níveis & onboarding (15.3) | ✅ (0011) | ⚠️ só Lucas | ✅ `carregarNivelAluno`/`carregarOnboarding` | ❌ (níveis são **recalculados** de métricas, não lidos do banco) | ❌ | ✅ | **Morto** — `aluno_niveis`/`aluno_onboarding` nunca lidos na UI |
| Trilhas & missões por prova (15.4) | ✅ (0012) | ✅ planos+missões p/ 5 concursos | ✅ `carregarTrilhaPlanos`/`carregarMissoes` | ❌ | ❌ | ✅ | **Morto** — núcleo do problema |
| XP / patentes / conquistas (15.5) | ✅ (0013) | ⚠️ só Lucas | ✅ `carregarGamificacaoAluno`/`concederXp` | ⚠️ Conquistas usa catálogo estático | ❌ | ✅ | XP **manual** pela coordenação; sem gatilho |
| Simulado por concurso (15.6) | ✅ (0014) | ⚠️ só CN | ⚠️ simulados crus | ✅ (modelo antigo) | ✅ | ✅ | Usa modelo antigo de simulado, não `exam_tag` |
| Recorrência & tagueamento (15.7) | ✅ (0015) | ⚠️ só CN | ✅ `carregarRecorrencia*` | ❌ | ❌ | ✅ | **Morto** |
| Trilha antiga (pré-15) → `metas` | ✅ (0001/0003) | ✅ 1 trilha (CN) | ✅ `carregarTrilha`/`listarMetas` | ✅ **é o que o aluno vê** | ✅ **é o que a coord. vê** | ✅ | **É o runtime real** — fixo em CN |

**Cobertura de seed por `exam_tag`** (confirmado em runtime):

| exam_tag | `trilha_planos` | `missoes` | `prova_materias` | `assuntos/subassuntos` | níveis/simulado/recorrência |
|---|:--:|:--:|:--:|:--:|:--:|
| cn | 4 | 3 | ✅ | ✅ | ✅ (Lucas) |
| epcar | 2 | 1 | ✅ | ❌ | ❌ |
| esa | 2 | 1 | ✅ | ❌ | ❌ |
| eear | 2 | 1 | ✅ | ❌ | ❌ |
| espcex | 2 | 2 | ✅ | ⚠️ parcial | ❌ |

---

## 3. Hardcodes encontrados (dependência do plano do Lucas/CN)

1. **Trilha única = plano do Lucas.** Só existe **uma** trilha no modelo antigo:
   `Colégio Naval — CPACN/2026 (9 semanas)` (`b1388388-…`), seedada em `supabase/seed/02_trilha_cn.sql`.
   É a trilha do Lucas Demo.

2. **`trilhaPadrao()` sempre devolve a trilha CN.**
   `app/src/shared/data/index.js:90-95` — `select … from trilhas order by versao desc limit 1`.
   Com uma só trilha, é sempre a CN.

3. **Cadastro atribui a trilha CN a todos.**
   `app/src/modules/pessoas/CadastroAlunos.jsx:77` —
   `db.cadastrarAlunos(lista, turmaId, trilhaPadrao?.id, concursoEscolhido)`.
   O campo "Trilha de estudo" é um `<input disabled>` mostrando sempre o nome da trilha padrão
   (linha 121). O `concurso_id` é gravado, mas **não escolhe trilha**.

4. **Fallback de concurso para CN.**
   `CadastroAlunos.jsx:76,112` — `concursos.find((c) => c.codigo === "cn")?.id` como default.

5. **`motor_gerar_meta` monta a meta a partir de `aluno.trilha_id`** (sempre CN), nunca de
   `trilha_planos`/`missoes` por `exam_tag`. `supabase/functions/gerar-meta/index.ts` exige
   `aluno.trilha_id` e chama `motor_gerar_meta`.

6. **Telas do aluno e da coordenação leem só a trilha antiga.**
   - Aluno: `VisaoEstudo.jsx` → `db.listarMetas` + `useTrilha(aluno.trilha_id)`.
   - Coordenação: `FichaAluno.jsx:21,27` → `db.listarMetas` + `useTrilha(aluno.trilha_id)`.
   Nenhuma chama `carregarMissoes`/`carregarTrilhaPlanos`/`carregarEstruturaProva`.

7. **Módulos de lógica da Fase 15 são "ilhas".**
   `missoes.js`, `estruturaProva.js`, `pedagogia.js`, `gamificacao.js`, `simuladoConcurso.js`,
   `recorrencia.js` exportam funções puras (testadas), mas **não são importados por nenhuma tela**.

8. **Escolas demo poluídas.** Seed cria `Colégio Vitrine Naval` (slug `vitrine`) e
   `Curso Beta Preparatório` (slug `beta`). Lucas pertence à `vitrine`. (Não há "Vitrine Beta"
   nem "Instituto Vitrine Militar" no seed atual — esses nomes do briefing não existem aqui.)

---

## A.5 — Prova de runtime: criação de aluno por concurso

Reproduzido no Postgres local, replicando exatamente o que `CadastroAlunos.jsx` faz (trilha =
`trilhaPadrao` para todos; concurso = o escolhido). Resultado:

```
        nome        | concurso_alvo |            trilha_recebida
--------------------+---------------+----------------------------------------
 Aluno CN Teste     | cn            | Colégio Naval — CPACN/2026 (9 semanas)
 Aluno EPCAR Teste  | epcar         | Colégio Naval — CPACN/2026 (9 semanas)
 Aluno EsPCEx Teste | espcex        | Colégio Naval — CPACN/2026 (9 semanas)
 Aluno ESA Teste    | esa           | Colégio Naval — CPACN/2026 (9 semanas)
 Aluno EEAR Teste   | eear          | Colégio Naval — CPACN/2026 (9 semanas)
```

Rodando o próprio `motor_gerar_meta` para o aluno **EPCAR**, a meta gerada vem **integralmente do
conteúdo de CN** — incluindo literalmente *"Dissecar 1 prova antiga do CN"*:

```
 semana | disc | atividade
--------+------+-----------------------------------------------
   3    | mat  | Geometria: triângulos, semelhança, ângulos
   3    | mat  | Funções 1º/2º grau, domínio, inequações
   3    | ing  | Morfologia: countable/uncountable, pronomes
   3    | por  | Morfologia: verbo + advérbio/preposição/conjunção
   3    | fis  | Cinemática (Vol.1)
   3    | prov | Dissecar 1 prova antiga do CN: anotar cada pegadinha…
```

**Conclusão A.5:** alunos de provas diferentes recebem **exatamente o mesmo plano (CN)**. Sem
justificativa pedagógica documentada para isso — é defeito de fiação, não decisão.

## A.6 — Criação/gestão de aluno pela coordenação

| Capacidade | Existe? | Observação |
|---|:--:|---|
| Criar aluno (1 ou lote) | ✅ | `CadastroAlunos.jsx` + `cadastrarAlunos` |
| Associar a turma | ✅ | `alunos_turmas` |
| Associar a concurso/prova | ⚠️ | grava `concurso_id`, mas **sem efeito no plano** |
| Gerar credencial | ✅ | Edge `provisionar-aluno` (código ditável) |
| Visualizar aluno / ficha | ✅ | `FichaAluno.jsx` — mostra plano **CN** p/ todos |
| Ver trilha/plano coerente com a prova | ❌ | mostra trilha antiga (CN) |
| Ver histórico/progresso | ✅ | metas + registros + simulados (modelo antigo) |

**Falta:** regra de geração de plano por `exam_tag` e a fiação UI→`trilha_planos/missoes`. Banco,
seed e fetcher já existem; falta **ligar**.

---

## C0 — Estado do "motor C0" descrito no briefing (ATUALIZADO após investigação de branches)

O briefing assume que a Fase C0 criou `aluno_eventos_progresso` (ledger), XP persistido com
idempotência, patente derivada do XP persistido e migration `~0016_motor_progresso.sql`.

**Achado inicial:** não está nesta branch (`phase-c0-5-audit-rebuild`) nem no main — migrations vão
de `0001` a `0023`, e `0016` é `0016_painel_agregado.sql`.

**Achado após varrer todas as branches remotas (a pedido):** **a Fase C0 EXISTE e está bem
construída**, porém em uma branch **não mergeada**:
`origin/claude/demo-base-realista-auditoria-t5ji99`. Commits:
`feat(progresso): motor mínimo persistido de progresso (Fase C0)` →
`feat(progresso): renomeia migration 0016→0022 e adiciona E2E do motor` →
`docs(progresso): relatório de validação da migration 0022 e E2E do motor`.

A migration `0022_motor_progresso.sql` dessa branch cria:
- tabela **`aluno_eventos_progresso`** (ledger) com índices e RLS;
- funções `app.xp_por_prioridade`, `app.xp_simulado`, `app.desbloquear_conquista_basica`;
- **gatilhos automáticos** `trg_progresso_registro`, `trg_progresso_missao`, `trg_progresso_simulado`
  (XP nasce do estudo/missão/simulado — sem lançamento manual);
- view de histórico (herda RLS), `app.backfill_progresso(escola)` para dados existentes;
- policies (`evprog_select` por authenticated; `evprog_ajuste_coordenacao` por insert).

### Problema de integração (exatamente o alerta do briefing §5)

A branch C0 **ramificou em 0015** e **não contém as migrations 0016–0021** (painel_agregado,
revokes, backoffice, logs_coordenacao). Ela numerou seu motor como `0022_motor_progresso.sql` — mas
no main **`0022` já é `0022_logs_coordenacao.sql`** e o topo é `0023`. Logo:

| | main / esta branch | branch C0 (`demo-base-realista-…`) |
|---|---|---|
| 0016–0021 | painel/backoffice/logs/índices | **ausentes** |
| 0022 | `logs_coordenacao` | `motor_progresso` ← **colisão** |
| 0023 | `indices_escala_coordenacao` | ausente |

**Conclusão:** a C0 está "ausente" **por branch não mergeada + colisão de numeração**, e **não por
nunca ter sido construída**. Conforme instrução do usuário ("se for ausência por branch/migration
não mergeada, documente e pare para decisão antes de recriar C0 do zero"), **NÃO recriei a C0** e
**NÃO a mergeei**. Recomendação para integração (decisão pendente):
1. **Renomear** `0022_motor_progresso.sql` → **`0024_motor_progresso.sql`** (próximo após 0023);
2. fazer cherry-pick/rebase dos 3 commits da branch C0 sobre o main atual (que já tem 0016–0021);
3. revalidar `reset-db.sh` + testes + o E2E do motor que a branch trouxe;
4. rodar `app.backfill_progresso` por escola para popular o ledger de dados já existentes.

Isso fica para uma fase de integração própria (P0), **com sua autorização** — não foi executado aqui.

### ⚠️ Estado REAL do Supabase remoto (leitura via MCP — projeto `Rumo-a-aprova-o-` / `bdjkgrzfzoamchdpobbl`)

Com o Supabase conectado, li (somente leitura) as migrations e tabelas do projeto remoto. O quadro
muda e **exige decisão antes de qualquer migration**:

- **A Fase C0 JÁ ESTÁ APLICADA no remoto.** A migration `0022_motor_progresso` consta como aplicada
  em **2026-06-19**, e a tabela **`aluno_eventos_progresso` existe com 346 linhas** — o ledger está
  vivo e populado no banco remoto.
- **O remoto DIVERGIU do main do repositório.** O remoto **não tem** `0022_logs_coordenacao` nem
  `0023_indices_escala_coordenacao` (a tabela `logs_coordenacao` **não existe** lá); o main **não
  tem** `0022_motor_progresso`. Ou seja, o número `0022` aponta para migrations **diferentes** em
  cada lado.

| Migration | Repo / main | Supabase remoto |
|---|:--:|:--:|
| 0016–0021 (painel, backoffice, revokes) | ✅ | ✅ |
| `0022_logs_coordenacao` | ✅ | ❌ **ausente** (tabela `logs_coordenacao` não existe) |
| `0023_indices_escala_coordenacao` | ✅ | ❌ **ausente** |
| `0022_motor_progresso` (C0, ledger) | ❌ (só na branch C0) | ✅ **aplicada, 346 eventos** |

**Implicações:**
1. Minha fiação da Fase 15 (§8) é **front-only** e **compatível com o remoto** — lê
   `trilha_planos` (12) e `missoes` (8), que já existem lá. Nada a migrar para ela funcionar.
2. A C0 está ativa no **banco** remoto, mas o **front ainda NÃO usa o ledger**: o XP da UI é
   calculado por `jargao.js` (a partir de metas/simulados), ignorando `aluno_eventos_progresso`.
   É o **"fallback legado mascarando o ledger"** que o briefing alerta — ligar o front ao ledger é
   um próximo passo (depende da reconciliação abaixo).
3. **NÃO aplicar nada** até reconciliar a numeração. Proposta (a decidir, não executada):
   renomear o motor para **`0024_motor_progresso`** no repositório; trazer `logs_coordenacao` e os
   índices `0022/0023` para o remoto; alinhar o histórico para crescente e reproduzível em ambos os
   lados **antes** de qualquer Bloco B. Como há divergência, **paro e proponho** (regra §5/§13).

### ✅ Reconciliação executada NO REPOSITÓRIO + front ligado ao ledger (autorizado pelo usuário)

Após sua decisão ("reconciliar histórico" + "ligar o front ao ledger"), feito em nível de repositório
(**nada aplicado no remoto** — aguarda revisão do diff; runbook em `docs/RECONCILIACAO_MIGRATIONS_C0.md`):

- **`supabase/migrations/0024_motor_progresso.sql`** — motor C0 renumerado 0022 → **0024** (body
  idêntico ao do remoto, idempotente). Repo agora tem histórico crescente: `0001 … 0023, 0024`.
- **Front ligado ao ledger** (acaba o "fallback legado mascarando a C0"):
  `data/index.js` (`carregarEventosProgresso`/`carregarXpPersistido`, com degradação segura se a
  tabela não existir), `jargao.js` (`xpTotal` = soma do ledger; `calcularXP` vira só fallback),
  `VisaoEstudo` e `FichaAluno` (XP do ledger quando há eventos), `HistoricoProgresso.jsx`
  (coordenação vê o histórico real).
- **Testes:** `tests/progresso.test.mjs` + `tests/progresso-db.test.mjs` + `app/e2e/motor-progresso.spec.js`.
  Suíte local: **204/204 verde**; `vite build` verde. Ledger populado pelo seed via gatilhos
  (ex.: Lucas com 6 eventos / 100 XP de simulado).
- **Pendente (remoto):** aplicar `0022_logs_coordenacao` + `0023_indices` no remoto (ausentes lá) —
  passos no runbook, **com sua autorização**. O motor já está no remoto; não reaplicar.

### Investigação objeto-a-objeto (a pedido) — `docs/COMPARACAO_MIGRATIONS_REPO_REMOTO.md`

Comparei migration a migration e verifiquei a existência de cada objeto no remoto. Confirmado:
- **Faltam no remoto:** `0022_logs_coordenacao` (tabela `logs_coordenacao` + índice + 2 policies) e
  `0023_indices_escala_coordenacao` (4 índices) — **todos AUSENTES**.
- **Motor C0 completo no remoto:** `aluno_eventos_progresso`, `vw_aluno_xp_total`, 3 triggers e
  `app.backfill_progresso` — **todos OK** (aplicado como `0022_motor_progresso`).
- **Impacto real:** sem `logs_coordenacao`, a auditoria de coordenação (Fase A.8) está **inativa no
  remoto**; sem os índices (Fase B-min), as consultas da coordenação por escola rodam sem índice
  (gargalo a 300–500 alunos). Não é só cosmético.
- **Sequenciamento (decisão do usuário):** ligar o front ao ledger fica **para depois** de aplicar
  essas 2 migrations no remoto, para não misturar os dois problemas. A ligação já está na branch
  (commit isolado, atrás de fallback seguro, nada no remoto) e pode ser revertida se preferir
  separá-la até a reconciliação do remoto concluir.

### ✅ Reconciliação do REMOTO executada (autorizada) — 2026-06-19

Com sua autorização, apliquei no Supabase remoto as duas migrations ausentes:
- `0022_logs_coordenacao` → `{success:true}` (tabela + índice + 2 policies, RLS ativa).
- `0023_indices_escala_coordenacao` → `{success:true}` (4 índices de escala).

Verificação pós-apply: todos os objetos **OK** no remoto; `get_advisors(security)` **sem regressão**
(warnings restantes são pré-existentes — search_path de 2 helpers do motor e SECURITY DEFINER do
backoffice). Efeitos: a **auditoria de coordenação** volta a registrar no remoto e os **índices de
escala** (Fase B-min) passam a valer. Resíduo cosmético: o rótulo do motor no remoto segue
`0022_motor_progresso` (rename para `0024` bloqueado por política; só estético — schema consistente).
Repo e remoto agora têm o **mesmo conjunto de objetos**. A ligação do front ao ledger permanece na
branch, pronta para ativar (decisão de manter, não reverter).

---

## 8. Correções feitas — fiação da Fase 15 ao runtime (não-destrutivo)

> Autorizado pelo usuário após o Bloco A: *"Ligar a Fase 15 primeiro, sem rebuild da base demo."*
> Tudo em nível de código + validação em Postgres local. **Nenhuma migration aplicada em remoto,
> nenhum dado apagado, RLS intacta.**

**Princípio:** o plano/trilha que o aluno e a coordenação enxergam passa a vir do **`exam_tag` do
próprio aluno** (derivado do concurso-alvo), lido de `trilha_planos`/`missoes` — nunca de uma trilha
fixa. A regra de seleção fica na **lógica pura** (`conteudo/missoes.js`), não duplicada no front.

| Arquivo | Mudança |
|---|---|
| `app/src/shared/data/index.js` | **+** `carregarPlanoConcurso(examTag)` — ponto único que busca `trilha_planos` + `missoes` + ajustes da escola (estes isolados por RLS). |
| `app/src/modules/conteudo/missoes.js` | `montarMissoesDoAluno` agora aceita **`nivel` opcional** — sem nível, devolve todas as missões do alvo (visão "trilha do concurso"); anti-furo (`exam_tag`) e ajustes da escola continuam sempre. |
| `app/src/modules/conteudo/TrilhaConcurso.jsx` | **novo** componente: renderiza horizontes da trilha + missões do concurso, com prioridade, matéria, critério, XP e badge de desvio da escola. Serve aluno e coordenação. |
| `app/src/routes/aluno/VisaoEstudo.jsx` | **+** aba **"Trilha"** (`concurso`) renderizando `TrilhaConcurso` a partir de `concurso.codigo`. |
| `app/src/modules/desempenho/FichaAluno.jsx` | **+** seção `TrilhaConcurso` (compacta): a coordenação vê o concurso-alvo **e** a trilha/missões reais por prova do aluno. |
| `tests/trilha-concurso-db.test.mjs` | **novo** — 4 testes (DB + lógica) provando coerência/distinção por prova e que aluno novo de EPCAR recebe missões de EPCAR. |
| `app/e2e/aluno.spec.js` | **+** navegação/asserção da aba "Trilha". |

**O que NÃO foi tocado (de propósito):** o motor de `metas`/`atividades_modelo` (execução semanal)
segue intacto — não foi refeito nem removido. A meta semanal legada ainda usa a trilha CN porque só
há `atividades_modelo` de CN seedados; gerar metas semanais **por prova** exige seed de
`atividades_modelo` por concurso (conteúdo) e é **pendência P1**, fora do escopo desta fiação. O
sintoma central ("aluno vê o plano do Lucas") está resolvido na camada de **trilha/missões por
concurso**, que é a leitura pedagógica que aluno e coordenação passam a ver.

### Prova do conserto (runtime, Postgres local)

Antes: aluno EPCAR recebia meta de CN. Agora, a aba "Trilha" do mesmo aluno (e a ficha na
coordenação) lê por `exam_tag='epcar'`:

```
aluno NOVO de EPCAR → missões de EPCAR (ex.: "Redação que Pontua") · nenhuma missão de CN
trilhas DISTINTAS por prova: CN e EPCAR não compartilham nenhuma missão
cada um dos 5 concursos (cn/epcar/esa/eear/espcex): trilha + missões próprias e coerentes
```

(Testes `tests/trilha-concurso-db.test.mjs`, todos verdes.)

---

## 9. Testes executados (Bloco A + fiação)

| Comando | Resultado |
|---|---|
| `bash tests/reset-db.sh` (Postgres local) | ✅ 23 migrations + seeds aplicados 2× sem erro |
| `node --test` (tests/) | ✅ **188/188 passam** (unit + banco + isolamento RLS + 4 novos da fiação) |
| SQL de simulação de cadastro por concurso | ✅ executado — evidência em §A.5 |
| Build do front (`vite build`) | ✅ **verde** (922 módulos; só o aviso pré-existente de tamanho de chunk) |
| Playwright/E2E | ⏳ não executado — exige Supabase real + GoTrue (seed 04). Aba "Trilha" adicionada à spec do aluno para quando rodar. |

> Ambiente: container efêmero sem Supabase remoto configurado (sem variáveis de conexão). Por isso
> a prova de runtime foi feita em Postgres local, que reproduz fielmente schema + RLS (os testes de
> isolamento passam).

---

## 10. Pendências (priorizadas)

- ~~**P0 — Fiação Fase 15 → runtime.**~~ ✅ **FEITO** (§8): aluno e coordenação leem
  `trilha_planos`/`missoes` por `exam_tag`; aluno novo não depende mais da trilha fixa do Lucas.
- **P0 — Integrar a Fase C0.** Ela existe na branch `demo-base-realista-auditoria-t5ji99` mas não
  está mergeada e colide na numeração (renomear p/ `0024_motor_progresso`, rebase sobre o main,
  revalidar). **Documentado e parado para decisão** (§C0). Bloqueia "C0 ativa na demo".
- **P1 — Meta semanal por prova.** A execução semanal (`metas`/`atividades_modelo`) ainda é CN-only;
  gerar metas semanais por `exam_tag` exige seed de `atividades_modelo` por concurso (conteúdo).
- **P1 — Seed pedagógico assimétrico.** EPCAR/ESA/EEAR sem `assuntos/subassuntos`/recorrência;
  preencher para a demo ser forte nos 5 concursos.
- **P1 — Base demo poluída.** `Colégio Vitrine Naval` + `Curso Beta`; sem flag `demo` explícita
  para reset seguro por escola.
- **P2 — Níveis recalculados vs. persistidos.** UI ignora `aluno_niveis` e recalcula de métricas.
- **P2 — Conquistas no aluno usam catálogo estático**, não `aluno_conquistas` do banco.
- **P3 — Limpeza de código morto** (módulos de lógica não importados) após a fiação.

---

## 11. Decisão de prontidão e o que falta para o Bloco B

- **Pode seguir para C1?** Falta só **integrar a C0** (P0, decisão pendente) — a fiação da Fase 15
  já está feita e testada.
- **Base demo pronta para deck/reunião?** A **trilha por concurso** já aparece corretamente; falta
  o rebuild da base demo (Bloco B, não autorizado ainda) e a integração da C0 para o "progresso".
- **Ainda existe dependência do plano do Lucas?** Na **trilha/missões por concurso, NÃO** (resolvido,
  §8). Na **meta semanal legada**, ainda sim (P1 — exige seed de `atividades_modelo` por prova).
- **C0 ativa em runtime?** **Ainda não** — existe pronta na branch C0, aguardando integração (§C0).

### Por que paro aqui (conforme regra do briefing)

O Bloco B (limpar escolas demo, recriar vitrine, 60 alunos, progresso) é **destrutivo** e exige:

1. **Autorização explícita** para apagar dados demo (regra §3 do briefing).
2. **Ambiente de destino definido.** Esta sessão **não tem Supabase remoto configurado** (sem
   credenciais/variáveis). Preciso saber em qual projeto (demo/staging) operar e confirmar
   numeração de migrations aplicadas lá vs. local (§5 do briefing).
3. **Decisão sobre a Fase C0** (P0 acima) — o "progresso realista via motor C0" depende dela.

**Recomendação de próximos passos (após autorização):**
1. Implementar a fiação P0 da Fase 15 (geração de plano por `exam_tag` + leitura na UI) — escopo
   controlado, sem refazer a Fase 15.
2. Definir/implantar a Fase C0 como `0024_motor_progresso.sql` (se for o caminho).
3. Só então o Bloco B (rebuild da base demo) com backup lógico, reset por `escola_id` explícito e
   testes de aceite.

> **Aguardando sua autorização e a definição do ambiente/escopo antes de prosseguir para o Bloco B.**
