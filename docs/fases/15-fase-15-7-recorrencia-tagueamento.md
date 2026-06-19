# Fase 15.7 — Recorrência real, tagueamento de provas e refinamento futuro (13/06/2026)

Sétima e última subfase da Fase 15. Prepara a **estrutura** para o
sistema evoluir de inferência pedagógica para inteligência baseada em
prova real (o ativo proprietário da plataforma). Não implementa o banco
de questões completo (fora de escopo); deixa a estrutura pronta.
Conteúdo global; aditiva.

## Estrutura para provas anteriores

`provas_anteriores` — uma edição real do concurso (`exam_tag`, `ano`,
`etapa`, `fonte`, `status_dado`). Não guarda o enunciado completo: é a
referência da prova tagueada.

## Estrutura para tagueamento

`questoes_prova` — cada questão de uma prova real etiquetada por
`materia_codigo` + `assunto_id` (+ `subassunto_id`), com `gabarito` e
referência. É o **tagueamento por matéria e por assunto** que vira o
ativo proprietário. Não é banco de questões: só a tag e a referência.

## Estrutura para recorrência (três graus separados)

`recorrencia_assunto` carrega o número publicado **com o grau de
confiança** — a separação que o doc exige:

- **`estimada`** — preliminar (inferência); NÃO promove prioridade.
- **`validada`** — confirmada por humano/professor.
- **`medida`** — contada questão a questão nas provas tagueadas.

A mesma dupla (exam_tag, assunto) pode ter linhas de tipos diferentes:
a estimada coexiste com a medida até a validação fechar. A view
`vw_recorrencia_medida` conta o tagueamento **ao vivo** (fonte da
recorrência medida e do relatório de incidência).

## Como isso poderá alimentar trilhas no futuro

Lógica pura `app/src/modules/conteudo/recorrencia.js`:
- `consolidarRecorrencia` escolhe o maior grau de confiança disponível,
  sem apagar os outros.
- `podePromoverPrioridade`/`statusDoTipo` aplicam a **regra de ouro**: só
  recorrência validada/medida vira dado de produção; estimada permanece
  inferência (não transformar inferência em oficial).
- `prioridadeSugerida` propõe a prioridade do assunto a partir da
  recorrência + peso, mas só marca `aplicar: true` quando o grau é
  promovível — então a 15.4 (missões/trilhas) pode reordenar prioridade
  com base na recorrência **medida**, não no chute.
- `relatorioIncidencia` cruza edital × prova real e sinaliza o ponto cego
  (assunto no edital sem incidência medida).

Fetchers no seam: `carregarProvasAnteriores`, `carregarRecorrencia`,
`carregarRecorrenciaMedida`.

## O que ainda fica fora

- **Banco de questões nível 2 completo** (enunciados, alternativas,
  resolução) — fora de escopo; aqui só a tag/referência.
- **Tagueamento exaustivo** de todas as provas/anos — é trabalho
  contínuo do operador; semeamos só uma amostra (CPACN 2024) para validar
  a estrutura ponta a ponta.
- **Promoção automática** da prioridade dos assuntos a partir da
  recorrência medida — a lógica está pronta e testada (`prioridadeSugerida`
  com `aplicar`), mas a aplicação efetiva (reescrever `assuntos.prioridade`)
  fica para quando houver volume de tagueamento. Nenhuma UI montada.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/0015_recorrencia_tagueamento.sql` | **novo** — 3 tabelas + view, RLS global |
| `supabase/seed/12_recorrencia.sql` | **novo** — prova CPACN 2024 tagueada + recorrência (3 graus) |
| `app/src/modules/conteudo/recorrencia.js` | **novo** — lógica pura de recorrência |
| `app/src/shared/data/index.js` | + 3 fetchers (provas anteriores, recorrência, view medida) |
| `tests/recorrencia.test.mjs` | **novo** — 7 testes de lógica pura |
| `tests/recorrencia-db.test.mjs` | **novo** — 6 testes de banco/RLS (inclui a view) |

## Riscos ou dúvidas

- A recorrência estimada é o que existe hoje (preliminar); a medida só
  existe onde há tagueamento. O sistema deixa isso explícito por tipo.
- A amostra de tagueamento (1 prova) é demonstrativa; os números reais
  dependem do trabalho contínuo de tagueamento.

## Testes

- **build:** ✅ passou (bundle inalterado).
- **unitários:** ✅ 148/148 (135 anteriores + 7 lógica de recorrência +
  6 banco/RLS, incluindo a view de recorrência medida).
- **E2E:** ⏳ não executável localmente (browser do Playwright bloqueado
  pela egress); validado pelo CI. Impacto esperado nenhum (sem wiring).
- **RLS/isolamento:** ✅ estrutura é conteúdo global (escola A e B leem
  igual; escrita só `service_role`); FKs preservam integridade do
  tagueamento.

## Status

✅ **Subfase 15.7 encerrada.** Com isso, a **Fase 15 está completa**:
o sistema deixou de ser só acompanhamento e passou a ter um motor
pedagógico configurável por `exam_tag` (concursos → provas → matérias →
assuntos → níveis → trilhas → missões → XP/patentes/conquistas →
simulados por concurso → recorrência real).
