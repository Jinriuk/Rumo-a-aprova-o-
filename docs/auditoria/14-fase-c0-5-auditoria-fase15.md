# Relatório Preliminar — Fase C0.5 (Bloco A): Auditoria da Fase 15 + estado do motor C0

> **Status:** Bloco A (auditoria seca) **concluído**. Bloco B (rebuild destrutivo da base demo)
> **NÃO executado** — aguarda autorização explícita e definição de ambiente (ver §11).
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
| A **Fase C0** (motor de progresso persistido com ledger `aluno_eventos_progresso`) está presente? | **Não.** Não existe migration `motor_progresso` nem tabela `aluno_eventos_progresso` em nenhuma das branches. O que existe é a **Fase 15.5** (`aluno_xp_eventos`), com XP concedido **manualmente pela coordenação**, sem gatilho automático. Ver §C0. |
| A C0 está **ativa na demo**? | **Não se aplica ainda** — a C0, como descrita no briefing, não está implantada neste repositório. |

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

## C0 — Estado do "motor C0" descrito no briefing

O briefing assume que a Fase C0 criou `aluno_eventos_progresso` (ledger), XP persistido com
idempotência, patente derivada do XP persistido e migration `~0016_motor_progresso.sql`.

**Achado:** **nada disso existe neste repositório** (nem em `claude/naval-system-build-g9h0t5`):

- Migrations vão de `0001` a `0023`; `0016` é `0016_painel_agregado.sql`. Não há `motor_progresso`.
- Não há tabela `aluno_eventos_progresso`. `grep` por `aluno_eventos_progresso`/`motor_progresso`/
  `ledger` não encontra a estrutura — a única menção a "ledger" é um **comentário** em
  `gamificacao.js` referindo-se a `aluno_xp_eventos` (Fase 15.5).
- A Fase 15.5 concede XP **manualmente** (`concederXp` exige papel `coordenacao`; "aluno não se
  autopontua"), sem gatilho automático a partir de estudo/missão/simulado.

**Implicação para o alerta de migração do briefing (§5):** não há migration C0 a renumerar — ela
não está aqui. **Antes de qualquer Bloco B**, é preciso decidir: (a) a Fase C0 será (re)implementada
nesta linha como `0024_motor_progresso.sql`, ou (b) o briefing aponta para um repositório/branch
diferente do que está nesta sessão. **Não presumir** que C0 existe.

---

## 9. Testes executados (Bloco A)

| Comando | Resultado |
|---|---|
| `bash tests/reset-db.sh` (Postgres local) | ✅ 23 migrations + seeds aplicados 2× sem erro |
| `node --test` (tests/) | ✅ **184/184 passam** (unit + banco + isolamento RLS) |
| SQL de simulação de cadastro por concurso | ✅ executado — evidência em §A.5 |
| Build do front (`vite build`) | ⏳ não executado neste bloco (sem mudança de código ainda) |
| Playwright/E2E | ⏳ não executado — exige Supabase real + GoTrue (seed 04); fora do escopo do Bloco A |

> Ambiente: container efêmero sem Supabase remoto configurado (sem variáveis de conexão). Por isso
> a prova de runtime foi feita em Postgres local, que reproduz fielmente schema + RLS (os testes de
> isolamento passam).

---

## 10. Pendências (priorizadas)

- **P0 — Fiação Fase 15 → runtime.** Geração de plano por `exam_tag`; aluno e coordenação lendo
  `trilha_planos`/`missoes` corretos. Sem isso, a venda "trilha por concurso" é falsa.
- **P0 — Decidir sobre a Fase C0.** Ela não existe aqui. Definir se entra como `0024_motor_progresso`
  ou se o briefing aponta para outro repo. Bloqueia "C0 ativa na demo".
- **P1 — Seed pedagógico assimétrico.** EPCAR/ESA/EEAR sem `assuntos/subassuntos`/recorrência;
  preencher para a demo ser forte nos 5 concursos.
- **P1 — Base demo poluída.** `Colégio Vitrine Naval` + `Curso Beta`; sem flag `demo` explícita
  para reset seguro por escola.
- **P2 — Níveis recalculados vs. persistidos.** UI ignora `aluno_niveis` e recalcula de métricas.
- **P2 — Conquistas no aluno usam catálogo estático**, não `aluno_conquistas` do banco.
- **P3 — Limpeza de código morto** (módulos de lógica não importados) após a fiação.

---

## 11. Decisão de prontidão e o que falta para o Bloco B

- **Pode seguir para C1?** Não antes de resolver os dois P0.
- **Base demo pronta para deck/reunião?** **Não ainda** — todo aluno mostra o plano do Lucas/CN.
- **Ainda existe dependência do plano do Lucas?** **Sim** (causa única, §3).
- **C0 ativa em runtime?** **Não** — C0 não está implantada neste repo.

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
