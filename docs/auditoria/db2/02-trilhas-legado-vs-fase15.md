# DB2-C — Trilhas: motor semanal (legado) × Fase 15

> Objetivo: descobrir o que ainda está **ativo de verdade** entre as duas
> famílias, sem remover nada que alimente meta/missão/conclusão/painel.

## 1. As duas famílias

**Motor semanal (origem)**: `trilhas`, `disciplinas`, `trilha_semanas`,
`atividades_modelo`, `metas`, `meta_atividades`.

**Fase 15 (trilha por concurso)**: `trilha_planos`, `missoes`,
`trilha_plano_missoes`, `missoes_escola` (+ catálogos `concursos`,
`provas`, `materias`, `assuntos`).

## 2. Evidências de uso (código, RPC, trigger, seed, teste, dados)

| Sinal | Motor semanal | Fase 15 trilha |
|---|---|---|
| Front (`.from`) | `trilhas`, `trilha_semanas`, `disciplinas`, `atividades_modelo`, `metas`, `meta_atividades` (MetaHero/MetaSemana/Progresso) | `trilha_planos`, `missoes`, `missoes_escola` (useTrilha/TrilhaConcurso) |
| RPC / funções | `app.gerar_meta`, `app.virar_semana`, `app.semana_da_data` escrevem `metas`/`meta_atividades`/leem `trilha_semanas`/`atividades_modelo` | catálogo lido por funções de conteúdo |
| Trigger | `trg_progresso_missao` em `meta_atividades` → alimenta C0 | — |
| Seed | 02/03/08/09 | 05/06/07/09 |
| Teste | motor/missoes/pedagogia/progresso | trilha-concurso/provas/recorrencia |
| Linhas (prod) | trilhas 1 · trilha_semanas 9 · atividades_modelo 50 · disciplinas 8 · **metas 169** · **meta_atividades 851** | trilha_planos 12 · missoes 8 · trilha_plano_missoes 3 · **missoes_escola 0** |

## 3. Classificação por tabela

| Tabela | Classificação | Justificativa |
|---|---|---|
| `metas` | **runtime atual** | escrita ativa pelo motor; base do painel/conclusão |
| `meta_atividades` | **runtime atual** | trigger alimenta o C0; 851 linhas |
| `trilhas` | runtime atual (compat.) | base de `app.semana_da_data` |
| `trilha_semanas` | runtime atual (compat.) | idem |
| `atividades_modelo` | runtime atual (compat.) | FK de `meta_atividades` |
| `disciplinas` | runtime atual (compat.) | exibição de trilha no front |
| `trilha_planos` | runtime atual (Fase 15) | trilha por concurso, populada |
| `missoes` | runtime atual (Fase 15) | catálogo de missões |
| `trilha_plano_missoes` | runtime atual (Fase 15) | ligação plano↔missão |
| `missoes_escola` | **candidata a remoção posterior (DB3)** | 0 linhas; ativação por escola ainda não usada |

## 4. Decisão

- O **motor semanal continua necessário**: ainda alimenta meta, conclusão
  de atividade (→ XP no C0) e o painel. **NÃO remover** (regra DB2-C).
- A **Fase 15 substitui só parte**: ela cobre a "trilha por concurso" e os
  catálogos; **não** substituiu o motor semanal de metas. As duas
  convivem por desenho de produto, não por esquecimento.
- Ação DB2: **documentar o papel de cada uma no próprio banco**
  (`COMMENT ON`, migration 0030) para acabar com a confusão. Unificação
  conceitual das duas "trilhas" é **decisão de produto** → fica para uma
  fase de produto (não DB2/DB3 puramente de banco).
