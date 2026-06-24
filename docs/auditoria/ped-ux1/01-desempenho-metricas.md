# 01 — Desempenho: Inventário e Reorganização
**Fase:** PED-UX1 | **Data:** 2026-06-24

---

## 1. Cards e componentes atuais da aba Desempenho

Renderizados em `VisaoEstudo.jsx` (tab === "desempenho"), na ordem:

| # | Componente | Arquivo | Cards/dados exibidos | Classificação |
|---|---|---|---|---|
| 1 | `InsightsDesempenho` | Insights.jsx | Melhor matéria, Precisa de atenção, Maior volume, Evolução semanal | **Análise** (leitura interpretada) |
| 2 | `InsightsDesempenho` (stats) | Insights.jsx | Acerto geral %, Questões no total, Tempo total, Dias de estudo | **Métrica** |
| 3 | `NiveisPorMateria` | Niveis.jsx | Nível por matéria (base/intermediário/avançado), diagnóstico geral, matérias fortes/fracas | **Análise pedagógica** |
| 4 | `RadarDesempenho` | RadarDesempenho.jsx | Eficiência por setor (acerto por matéria), trajetória de precisão por semana (linha) | **Comparativo / histórico** |
| 5 | `Acumulado` | Acumulado.jsx | Tabela por matéria (acertos, questões, %, tempo), treemap de tempo/questões, linha por meta | **Histórico + métrica** |
| 6 | `Progresso` | Progresso.jsx | Questões por dia (barra), desempenho por semana (composto), acerto/total por matéria | **Histórico gráfico** |

---

## 2. Classificação de cada card

### InsightsDesempenho — leitura rápida
| Card | Tipo | Ação |
|---|---|---|
| Melhor matéria | Análise | manter — primeiro card, importantíssimo |
| Precisa de atenção (matéria/queda/frequência) | Análise (risco) | manter |
| Maior volume | Análise | manter |
| Evolução semanal (seta ▲▼) | Análise + Comparativo | manter |

### InsightsDesempenho — stats
| Card | Tipo | Ação |
|---|---|---|
| Acerto geral % | **Métrica principal** | manter |
| Questões no total | **Métrica principal** | manter |
| Tempo total | **Métrica principal** | manter |
| Dias de estudo + média/dia | **Métrica de constância** | manter |

### NiveisPorMateria
| Card | Tipo | Ação |
|---|---|---|
| Nível por matéria (base/intermediário/avançado) | **Diagnóstico pedagógico** | manter |
| Nível geral (calculado) | **Diagnóstico** | manter |
| Matérias fortes / fracas | **Análise** | manter |

### RadarDesempenho
| Card | Tipo | Ação |
|---|---|---|
| Eficiência por setor (acerto por matéria) | **Análise por matéria** | manter, mas mover após NiveisPorMateria |
| Trajetória de precisão (linha temporal) | **Histórico** | manter |

### Acumulado
| Card | Tipo | Ação |
|---|---|---|
| Tabela por matéria | **Histórico + métrica** | manter |
| Treemap de tempo/questões | **Histórico visual** | manter |
| Linha de desempenho por meta | **Histórico** | manter |

### Progresso (Simulados internamente)
| Card | Tipo | Ação |
|---|---|---|
| Questões por dia (barra) | **Histórico** | manter |
| Desempenho por semana | **Histórico** | manter |
| Acerto e total por matéria | **Comparativo** | manter, considerar mover antes do Acumulado |

---

## 3. Reorganização proposta

A ordem atual já é razoável. O problema é que não há **separação visual por bloco** — tudo aparece como uma lista contínua de cards sem hierarquia clara.

### Ordem mantida (sem mover componentes — risco baixo):
1. `InsightsDesempenho` → **Bloco 1: Leitura rápida**
2. `NiveisPorMateria` → **Bloco 2: Diagnóstico pedagógico**
3. `RadarDesempenho` → **Bloco 3: Análise por matéria**
4. `Acumulado` → **Bloco 4: Histórico acumulado**
5. `Progresso` → **Bloco 4 (cont.): Histórico gráfico**

### Separadores visuais a adicionar:
Em `VisaoEstudo.jsx` (tab desempenho), adicionar cabeçalhos de seção leves entre os componentes:
- "◈ Leitura rápida" (já existe dentro de InsightsDesempenho)
- "◉ Diagnóstico por matéria" (antes de NiveisPorMateria)
- "▣ Histórico" (antes de Acumulado)

---

## 4. Cards redundantes

**Nenhum card é redundante.** Cada componente cobre um ângulo diferente:
- Insights = interpretação pronta
- Niveis = diagnóstico pedagógico com regra formal
- Radar = visualização comparativa por matéria
- Acumulado = dados brutos para autoauditoria
- Progresso = histórico temporal

**Risco de redundância percebida:** Acumulado e Progresso têm sobreposição visual (ambos mostram desempenho por matéria). A distinção é: Acumulado = tabela/treemap (granular), Progresso = barras temporais (evolução).

Recomendação: adicionar subtítulo explicativo em `Acumulado` ("dados brutos por disciplina") e em `Progresso` ("como seu desempenho evoluiu no tempo").

---

## 5. Status da reorganização

| Item | Status |
|---|---|
| Inventário completo | ✅ |
| Classificação por tipo | ✅ |
| Adição de separadores visuais por bloco | ✅ implementado em VisaoEstudo.jsx |
| Reordenação de componentes | Não necessária — ordem atual adequada |
| Cards redundantes removidos | Nenhum a remover |
