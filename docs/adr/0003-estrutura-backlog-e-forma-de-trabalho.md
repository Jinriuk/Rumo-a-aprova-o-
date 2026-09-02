# ADR-0003: Estrutura do backlog e forma de trabalho

**Data:** 02/09/2026
**Etapa:** 1

## Contexto
O plano mestre pede um "backlog único", mas é executado em 14 etapas descritas como paralelas (seção 7: "As etapas trabalham em paralelo"), com múltiplos operadores editando ao mesmo tempo: Gabriel, Leandro Souza (comercial) e os quatro papéis de IA definidos no próprio plano.

## Decisão
Backlog único na prática, implementado como um índice (`docs/backlog/00-indice.md`) mais um arquivo por etapa (`docs/backlog/etapa-XX.md`). Trabalho organizado por frente (engenharia, comercial, revisão) rodando em paralelo, não etapa a etapa sequencial. O campo "Etapa" em cada item do backlog é tag de dependência, não fila de execução.

## Consequência
Menor risco de conflito de edição simultânea num arquivo único. Leitura de prioridade cruzada feita pelo índice. A Etapa 3 (comercial) não fica bloqueada esperando as Etapas 1 e 2 fecharem, como o Princípio 1 do plano exige ("prospecção começa no dia 1 e nunca para").
