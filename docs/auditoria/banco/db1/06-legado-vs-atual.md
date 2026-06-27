# DB1-G — Legado × Atual

> Data: 2026-06-21. Objetivo: evitar que o banco carregue duas
> arquiteturas confundindo a manutenção. **Regra DB1: provar uso; na
> dúvida, marcar deprecated em docs — não deletar.**

## 1. As três gerações que coexistem

1. **Motor semanal (origem)** — `trilhas`, `trilha_semanas`,
   `atividades_modelo`, `disciplinas`, `metas`, `meta_atividades`.
   Gera meta semanal via `app.gerar_meta`/`app.virar_semana`; a conclusão
   de atividade alimenta progresso. **ATIVO** (populado e escrito).
2. **Fase 15 — trilha por concurso** — `trilha_planos`,
   `trilha_plano_missoes`, `missoes`, `missoes_escola`. Trilha amarrada a
   `exam_tag`/concurso. **PARCIALMENTE ATIVO** (`trilha_planos`=12,
   `missoes`=8, `trilha_plano_missoes`=3, `missoes_escola`=0).
3. **C0 — motor de progresso/XP** — `aluno_eventos_progresso` (+ view
   `vw_aluno_xp_total`). **ATIVO e canônico** para XP/progresso (991
   eventos).

A "Fase 15 — gamificação/níveis" (`aluno_xp_eventos`, `aluno_niveis`,
`aluno_nivel_historico`, `aluno_onboarding`) está **vazia ao vivo**: o XP
efetivo migrou para o C0.

## 2. Tabela de classificação

| Objeto | Status | Evidência | Recomendação |
|---|---|---|---|
| `trilhas` | legado **ainda usado** | `app.semana_da_data`, front `useTrilha`; 1 linha | MANTER (deprecar plano DB2) |
| `trilha_semanas` | legado **ainda usado** | `app.semana_da_data`; 9 linhas | MANTER |
| `atividades_modelo` | legado **ainda usado** | FK de `meta_atividades`; `gerar_meta`; 50 linhas | MANTER |
| `disciplinas` | legado **ainda usado** | front (display trilha); 8 linhas | MANTER |
| `metas` | **ativo** (motor) | escrito por `gerar_meta`/`virar_semana`; front MetaHero/MetaSemana; 169 linhas | MANTER |
| `meta_atividades` | **ativo** (motor) | trigger `trg_progresso_missao`; 851 linhas | MANTER |
| `trilha_planos` | Fase 15 ativo | front `useTrilha`/`TrilhaConcurso`; 12 linhas | MANTER |
| `missoes` | Fase 15 ativo | catálogo de missões; 8 linhas | MANTER |
| `trilha_plano_missoes` | Fase 15 ativo | 3 linhas | MANTER |
| `missoes_escola` | Fase 15 **vazio** | 0 linhas; front referencia leitura | MANTER + INVESTIGAR (DB2) |
| `aluno_xp_eventos` | Fase 15 **superado por C0** | 0 linhas; XP real em `aluno_eventos_progresso` | MANTER + INVESTIGAR (DB2) |
| `aluno_niveis` | Fase 15 **vazio** | 0 linhas; trigger de histórico existe | MANTER + INVESTIGAR (DB2) |
| `aluno_nivel_historico` | Fase 15 **vazio** | 0 linhas | MANTER + INVESTIGAR (DB2) |
| `aluno_onboarding` | Fase 15 **vazio** | 0 linhas | MANTER + INVESTIGAR (DB2) |
| `aluno_conquistas` | Fase 15 **ativo** | 108 linhas (XP de conquista) | MANTER |
| `aluno_eventos_progresso` | C0 **canônico** | 991 linhas | MANTER |

## 3. Pontos de confusão arquitetural (para DB2)

1. **Duas noções de "trilha"** (semanal vs por-concurso) coexistem. Não
   são duplicatas exatas — atendem fluxos diferentes — mas o vocabulário
   sobreposto dificulta manutenção. **Decisão de unificar/segregar fica
   para DB2** (precisa de produto, não só de banco).
2. **XP em dois lugares estruturalmente** (`aluno_xp_eventos` Fase 15 vs
   `aluno_eventos_progresso` C0). O C0 venceu na prática (a view de XP lê
   o C0). `aluno_xp_eventos` está vazia. **Antes de remover** (DB2): provar
   que nenhum caminho de escrita do front/edge ainda grava nela.
3. **Níveis/onboarding Fase 15 vazios**: confirmar se o produto ainda
   pretende usá-los ou se foram abandonados em favor do C0/patentes.

## 4. Recomendação da DB1

- **Não remover nada** (nenhuma das tabelas tem prova de morte — várias
  estão apenas vazias, não desligadas).
- **Marcar como `MANTER + INVESTIGAR (DB2)`** as 5 tabelas Fase 15 vazias
  (`aluno_xp_eventos`, `aluno_niveis`, `aluno_nivel_historico`,
  `aluno_onboarding`, `missoes_escola`).
- **Entregar à DB2** um plano de: (a) confirmar caminhos de escrita das
  vazias; (b) decidir unificação das "trilhas"; (c) só então propor
  `deprecated`/remoção, com seed de reconstrução quando houver dado de
  vitrine envolvido.
