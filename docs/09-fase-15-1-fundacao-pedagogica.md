# Fase 15.1 — Fundação pedagógica configurável (13/06/2026)

Primeira subfase da Fase 15. Cria a **camada de config** sobre a qual as
subfases seguintes (provas, níveis, trilhas, missões, XP, simulados,
recorrência) vão rodar — sem tocar no motor já testado da Fase 14.5.
Mudança puramente **aditiva**: só novas tabelas, colunas e políticas.

## O que foi implementado

- **`exam_tag` como unidade pedagógica.** Coluna gerada em `concursos`
  (`exam_tag = codigo`), deixando o vocabulário do doc explícito sem
  duplicar dado. Toda a config nova é etiquetada por `exam_tag`.
- **Config oficial 1:1 por concurso** (colunas em `concursos`):
  `elimination_model`, `redacao_role`, `usa_especialidade`, `usa_ciclo`,
  `status_dado`. Valores fiéis ao doc (ver tabela abaixo).
- **Turmas comerciais** (`turmas_comerciais` + `turmas_comerciais_concursos`):
  catálogo global que agrupa concursos para venda/UI. **Não comanda o
  motor.** Iniciais: CN/EPCAR → {cn, epcar}; ESA/EEAR → {essa, eear};
  EsPCEx → {espcex}.
- **Alvo pedagógico ativo do aluno.** `alunos.concurso_id` (já existia
  na 0007) é o alvo único (decisão D2). Acrescentados a `alunos`:
  `turma_comercial_codigo`, `especialidade`, `ciclo`, `data_prova_alvo`.
- **Duas camadas de config** (decisão D4):
  - `config_oficial` (chave-valor `jsonb` por `exam_tag`) — referência do
    edital, conteúdo global, com `status_dado` e `fonte`.
  - `config_escola` — override por tenant, isolado por escola, com
    `desvio_do_edital` e `ajustado_por`. A referência oficial nunca some.
- **Status do dado** preservado em todas as camadas:
  `oficial` | `inferencia` | `validar` (check constraint).
- **Módulo de lógica pura** `app/src/modules/conteudo/pedagogia.js`:
  tabelas de eliminação/redação, resolução de `exam_tag` ativo, validação
  de alvo contra a turma comercial, e a combinação oficial × escola com
  detecção de `desvioDoEdital` — tudo testável sem banco e sem browser.
- **Seam de dados** `app/src/shared/data/index.js`: `listarTurmasComerciais`,
  `configOficial`, `configEscola` (leitura; a RLS restringe).

### Config oficial 1:1 (fiel ao doc)

| Concurso | exam_tag | Eliminação | Redação | Especialidade/Ciclo |
|---|---|---|---|---|
| Colégio Naval | `cn` | `absoluto_50` | `eliminatoria` | — |
| EPCAR | `epcar` | `absoluto_5` | `eliminatoria_classificatoria` | — |
| EsPCEx | `espcex` | `mediana` | `eliminatoria_classificatoria` | — |
| ESA (EsSA) | `essa` | `mediana` | `eliminatoria` | — |
| EEAR | `eear` | `absoluto_5` | `ausente` | ✅ ambos |

> O doc chama a EsSA de "ESA"; no sistema o código é `essa`. Colégio
> Militar (`cm`) fica fora do escopo pedagógico desta fase.

## Como cada exigência foi atendida

- **exam_tag, não turma:** o motor lê `exam_tag`; a turma comercial só
  sugere os alvos possíveis (`alvoPermitido` impede misturar concurso).
- **config oficial × escola separadas:** duas tabelas distintas; o
  override carrega `desvio_do_edital` e a função `resolverConfig` devolve
  o valor efetivo **e** o oficial lado a lado (transparência D4).
- **status oficial/inferência/validar:** `status_dado` em `concursos` e
  `config_oficial`. A recorrência por assunto (ainda não medida) está
  semeada como `validar`; leituras estratégicas como `inferencia`.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/0008_fundacao_pedagogica.sql` | **novo** — tabelas, colunas, RLS, grants |
| `supabase/seed/06_pedagogia.sql` | **novo** — config oficial, turmas comerciais, demo |
| `tests/reset-db.sh` | glob de seed `0[1235]` → `0[12356]` (inclui o 06) |
| `app/src/modules/conteudo/pedagogia.js` | **novo** — lógica pura da config |
| `app/src/shared/data/index.js` | + `listarTurmasComerciais`, `configOficial`, `configEscola` |
| `tests/pedagogia.test.mjs` | **novo** — 8 testes de lógica pura |
| `tests/pedagogia-db.test.mjs` | **novo** — 9 testes de estrutura + RLS |
| `tests/isolamento.test.mjs` | `config_escola` somado à varredura canônica de isolamento |

## O que ficou fora (proposital)

Missões, XP, patentes, conquistas, banco de questões nível 2, motor
adaptativo e recorrência real — todos das subfases 15.2–15.7. A UI das
novas estruturas também não foi montada: os módulos novos são provados
por teste unitário e **não estão importados por nenhuma tela**, então a
suíte E2E e o bundle de produção ficam intocados (footprint zero sobre
a Fase 14.5).

## Riscos ou dúvidas

- `config_oficial` foi semeada com o que o doc dá como 🟢 (eliminação,
  redação, pisos). Prioridades/pesos/volumes finos entram na 15.2 —
  evitei "precisão falsa" agora.
- A demo semeia **um** override com `desvio_do_edital = true` (Vitrine,
  volume de Matemática do CN) só para material de tela/teste.
- Colégio Militar segue sem config de eliminação/redação (fora do escopo).

## Testes

- **build:** ✅ passou (`vite build`, 907 módulos; bundle inalterado).
- **unitários:** ✅ 43/43 (`node --test`): 26 da base + 8 de lógica
  pedagógica pura + 9 de estrutura/RLS pedagógica.
- **E2E:** ⏳ não executável neste ambiente (download do browser do
  Playwright bloqueado pela política de egress; sem Chromium de sistema).
  Será validado pelo CI no push. Impacto esperado: **nenhum** — os
  módulos novos não estão importados por tela, e a migration é aditiva.
- **RLS/isolamento:** ✅ `config_escola` provado isolado por escola
  (leitura e escrita); `config_oficial`/`turmas_comerciais` globais
  (leitura por todas). Aluno lê, não escreve config_escola.
- **observações:** migrations + seed rodados 2× (idempotência exercitada,
  como manda o `reset-db.sh`).

## Status

✅ **Subfase 15.1 encerrada.** Pode avançar para a 15.2 após o CI
confirmar o E2E verde no push.
