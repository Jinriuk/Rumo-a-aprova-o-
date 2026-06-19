# Fase 15.6 — Simulados por concurso (13/06/2026)

Sexta subfase da Fase 15. Faz o simulado **respeitar a estrutura real
de cada concurso** (matérias, nº de questões, pesos, dias, redação,
modelo de eliminação) cadastrada na 15.2. Aditiva; a tabela `simulados`
da 14.5 segue válida; a avaliação é lógica pura.

## Estrutura de simulados por concurso

- **DB (mínimo, aditivo):** `simulados` ganhou `exam_tag` (amarra o
  simulado ao concurso) e `redacao_nota`. O resto da avaliação não
  precisa de coluna nova — lê a estrutura da 15.2 (`prova_materias`,
  `prova_dias`) e a config do concurso (`elimination_model`,
  `redacao_role`).
- **Engine (puro)** `app/src/modules/conteudo/simuladoConcurso.js`:
  `validarAcertos`, `notaPorMateria`, `notaPorDia`, `avaliarRedacao`,
  `avaliarEliminacao`, `objetivoSugerido`, `compararComMeta`,
  `alertasDeRisco`, `insumoParaNivel` e o agregador `avaliarSimulado`.
- Cobre **CN, EPCAR, ESA, EEAR, EsPCEx** porque opera sobre a estrutura
  de cada um (não há ramo hardcoded por concurso na tela).

## Regras de validação por prova

`validarAcertos` capa o acerto de cada matéria no `num_questoes` real e
reporta as violações (informou mais que o total). A nota por matéria usa
o **valor por questão** quando o edital dá (CN 2,5/q) ou o **peso**
(EsPCEx); senão, cai no % puro. `notaPorDia` agrega por bloco (CN e
EsPCEx têm 2 dias).

## Como a redação foi tratada

`avaliarRedacao(redacao_role, nota, {minimo})` aplica o papel correto:
**ausente** (EEAR) → apto, não classifica; **eliminatória** (CN, ESA) →
barreira (apto se ≥ mínimo), não soma; **eliminatória+classificatória**
(EPCAR, EsPCEx) → barreira **e** soma `pontosClassificatorios`.

## Como a eliminação foi tratada

`avaliarEliminacao(elimination_model, notas)`:
- **absoluto** (CN 50%, FAB 5,0=50%): lista as matérias abaixo do piso
  com alvo numérico claro — `status: oficial`.
- **mediana** (ESA, EsPCEx): **não inventa corte**. Devolve `tipo:
  relativo`, um aviso de que não há corte absoluto oficial, e um proxy
  conservador (60%) **marcado como `inferência`**, só para sinal de risco
  (doc §6.3). Nenhuma nota de corte exata é fabricada.

## Como o simulado influencia desempenho/nivelamento

`insumoParaNivel` converte cada matéria em `{acertoPct, questoes}` — o
formato que `niveisAluno.classificarPorDesempenho` (15.3) consome — então
o simulado realimenta o nível por matéria. Teste compõe os dois módulos
(30% em 20 questões → Base). `objetivoSugerido` e `alertasDeRisco`
(corte/redação) viram insumo de missão e de painel da coordenação.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/0014_simulado_concurso.sql` | **novo** — `simulados.exam_tag` + `redacao_nota` |
| `supabase/seed/11_simulado_concurso_dev.sql` | **novo** — simulado CN de demo (estrutura real) |
| `app/src/modules/conteudo/simuladoConcurso.js` | **novo** — engine de avaliação por concurso |
| `app/src/shared/data/index.js` | + `carregarConcursoPorTag` (o `adicionarSimulado` já aceita as colunas) |
| `tests/simulado.test.mjs` | **novo** — 12 testes de lógica pura |
| `tests/simulado-db.test.mjs` | **novo** — 6 testes de banco/RLS |

## O que ficou fora (proposital)

Recorrência real e motor adaptativo (15.7). A UI de simulado por concurso
não foi montada: o engine é provado por teste e **não está importado por
tela** — as telas atuais (Progresso/Classificação) seguem com `provas.js`
intactas, e a suíte E2E (42) e o bundle ficam intocados.

## Riscos ou dúvidas

- O proxy de mediana (60%) é heurística de risco, **não** regra oficial —
  marcado `inferência` e centralizado em `PROXY_MEDIANA_PCT`.
- A nota geral é % de objetivas; a fórmula oficial completa (com pesos e
  redação somada) por concurso pode ser refinada quando a tela consumir
  o engine.

## Testes

- **build:** ✅ passou (bundle inalterado).
- **unitários:** ✅ 135/135 (118 anteriores + 12 engine de simulado + 6
  banco/RLS).
- **E2E:** ⏳ não executável localmente (browser do Playwright bloqueado
  pela egress); validado pelo CI. Impacto esperado nenhum (sem wiring).
- **RLS/isolamento:** ✅ a RLS de `simulados` segue valendo nas colunas
  novas; aluno registra o próprio amarrado ao concurso; tenant forjado e
  exam_tag inválido recusados; isolamento entre escolas mantido.

## Status

✅ **Subfase 15.6 encerrada** (pendente da confirmação do E2E verde no
CI). **A 15.7 não foi iniciada** — recorrência/tagueamento intactos.
