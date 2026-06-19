# Fase 15.4 — Trilhas e missões (13/06/2026)

Quarta subfase da Fase 15. Cria o motor de **trilhas** (planos por
`exam_tag` × tipo) e **missões** (unidade de estudo), com camada de
ajuste da escola. Aditiva; conteúdo oficial global; ajuste isolado por
escola. XP ainda é preliminar; patentes/conquistas ficam para a 15.5.

## O que foi implementado

- **`trilha_planos`** — um plano por `(exam_tag, tipo)`; tipos: `anual`,
  `semestral`, `intensiva` (3 meses), `reta_final`. Define o horizonte.
- **`missoes`** (template global) — `exam_tag`, `materia_codigo`,
  `assunto_id`/`subassunto_id` (opcionais), `nivel`, `nome`, `objetivo`,
  `prioridade`, `qtd_questoes_sugerida`, `tempo_estimado_min`,
  `criterio_conclusao`, `criterio_excelencia`, `xp_sugerido` (preliminar),
  `origem`, `status_dado`.
- **`trilha_plano_missoes`** — liga missões a um plano, com `fase`,
  `semana_sugerida`, `ordem`.
- **`missoes_escola`** — ajuste por escola (liga/desliga, sobrescreve
  qtd/xp/critério/objetivo), com `desvio_do_edital` e `ajustado_por`.
- **Lógica pura** `app/src/modules/conteudo/missoes.js`:
  `tipoTrilhaPorPrazo`, `missaoCabeNoAlvo`/`missoesDoAlvo` (anti-furo),
  `missoesParaNivel`, `aplicarAjusteEscola`, `montarMissoesDoAluno`,
  `desviosDeMissao`.
- **Seam de dados**: `carregarTrilhaPlanos`, `carregarMissoes`,
  `carregarMissoesEscola`, `salvarAjusteMissaoEscola`.

## Como a missão se conecta ao `exam_tag`

Cada missão **carrega** `exam_tag`. A regra anti-furo (missão de matéria
que não cai no concurso-alvo não entra) sai de graça: `missoesDoAlvo`
filtra pelo `exam_tag` ativo do aluno. Ex.: a missão "Blindar Física" é
da EEAR e jamais aparece para um aluno com alvo CN.

## Como a missão se conecta ao nível do aluno

Cada missão tem `nivel`. `missoesParaNivel` traz o nível atual e os já
alcançados (revisão), nunca o que está acima; na **Reta Final**, só
missões de reta final. `montarMissoesDoAluno` junta alvo + nível +
ajustes da escola, ordenado.

## Como a escola pode ajustar missões

`missoes_escola` (isolado por RLS): a coordenação liga/desliga e
sobrescreve qtd/xp/critério/objetivo. `salvarAjusteMissaoEscola` grava o
override com `ajustado_por`. Toda divergência fica em `desvio_do_edital`.

## Como o sistema preserva a config oficial

O override vive em tabela separada: a missão **global nunca é alterada**
(teste confirma que a missão oficial segue com a qtd original).
`aplicarAjusteEscola` devolve o valor efetivo **e** o recorte `oficial`
lado a lado, com `desvioDoEdital` sinalizado — transparência (D4).

## Missões cadastradas (starter)

Geometria Plana (CN/Mat/avançado), Domando a Crase (CN/Port/inter),
Citologia sem susto (CN/Bio/base), Literatura que cai (EsPCEx/Port/inter),
Geometria Analítica (EsPCEx/Mat/avançado), Blindar Física (EEAR/Fís/inter,
piso), Inglês de Alto Retorno (ESA/Inglês/inter, ROI), Redação que Pontua
(EPCAR/Redação/base). Critério de conclusão = volume mínimo **E** acurácia
em janela móvel. `xp_sugerido` preliminar; planos/missões `status_dado =
inferência` (desenho pedagógico, não regra de edital).

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/0012_trilhas_missoes.sql` | **novo** — 4 tabelas, RLS, grants |
| `supabase/seed/09_trilhas_missoes.sql` | **novo** — planos, missões, ligações, demo |
| `tests/reset-db.sh` | glob de seed inclui o 09 (`0[12356789]`) |
| `app/src/modules/conteudo/missoes.js` | **novo** — lógica pura de trilha/missão |
| `app/src/shared/data/index.js` | + 4 fetchers de trilha/missão |
| `tests/missoes.test.mjs` | **novo** — 9 testes de lógica pura |
| `tests/missoes-db.test.mjs` | **novo** — 9 testes de banco/RLS |

## O que ficou fora (proposital)

XP definitivo, patentes, conquistas (15.5); simulados por concurso (15.6);
recorrência real e motor adaptativo (15.7). Nenhuma UI montada (footprint
zero no E2E). Planos têm os 4 tipos só no CN; os demais concursos têm
anual + reta final (os intermediários entram quando necessário).

## Riscos ou dúvidas

- `xp_sugerido` é placeholder; a 15.5 define o XP real ancorado no peso.
- O critério de conclusão é texto; a trava de acurácia executável entra
  no motor de progresso (fora desta subfase).
- O desenho das missões é inferência; calibrar com professor/coordenação.

## Testes

- **build:** ✅ passou (bundle inalterado).
- **unitários:** ✅ 97/97 (79 anteriores + 9 lógica de missão + 9
  banco/RLS de missão).
- **E2E:** ⏳ não executável localmente (browser do Playwright bloqueado
  pela egress); validado pelo CI. Impacto esperado nenhum (sem wiring).
- **RLS/isolamento:** ✅ planos/missões globais (escola A e B leem igual,
  escrita só service_role); `missoes_escola` isolado por escola; aluno lê
  o ajuste da própria escola e não escreve; a missão oficial é preservada.

## Status

✅ **Subfase 15.4 encerrada** (pendente da confirmação do E2E verde no
CI). **A 15.5 não foi iniciada** — sem XP definitivo, patentes ou
conquistas.
