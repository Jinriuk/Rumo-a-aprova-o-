# DB2-A — Candidatos a limpeza

> Fase **DB2** (Limpeza Controlada de Legado e Policies). Branch
> `claude/db2-limpeza-legado-policies` (a partir da `main` com DB1
> mergeada — PR #20). Data: 2026-06-21 · Projeto `bdjkgrzfzoamchdpobbl`.
> Classificação herdando o inventário da DB1 (44 tabelas, todas com RLS).

## Legenda
- **A. Manter** — atual, usado, seguro.
- **B. Otimizar** — usado, mas com policy/índice/função melhorável.
- **C. Deprecated (doc)** — provavelmente antigo, sem prova p/ remover.
- **D. Remover na DB2** — sem uso em código/RPC/seed/teste, sem linhas, sem dependências.
- **E. Remover só na DB3** — risco médio, dependência indireta, uso histórico.

## Classificação

| Objeto | Classe | Evidência | Ação DB2 |
|---|---|---|---|
| Núcleo (escolas, usuarios, turmas, alunos, alunos_turmas, vinculos_responsaveis, registros_estudo, simulados, consentimentos) | **A** | runtime + 222 testes | manter |
| `aluno_eventos_progresso` (C0) + `vw_aluno_xp_total` | **A** | 991 eventos; fonte de XP | manter (comentado no banco) |
| Backoffice/logs (internal_admins, admin_logs, logs_acesso, logs_coordenacao) | **A** | D0/S1; testes | manter |
| Catálogos Fase 15 (concursos, provas, materias, assuntos, subassuntos, prova_*, patentes, conquistas, turmas_comerciais*) | **A** | catálogo de conteúdo ativo | manter |
| `aluno_conquistas` | **A** | 108 linhas, ativo | manter |
| trilha por concurso (trilha_planos, missoes, trilha_plano_missoes) | **A** | front useTrilha; populado | manter |
| **7 tabelas com policies duplicadas** (aluno_conquistas, aluno_niveis, aluno_onboarding, aluno_xp_eventos, config_escola, missoes_escola, vinculos_responsaveis) | **B** | advisor `multiple_permissive_policies` | **consolidado na DB2 (0029)** |
| 27 FKs sem índice + 9 índices não usados | **B** | advisor performance | **classificado (05); sem ação destrutiva** |
| Par `lgpd_excluir/exportar` (app × public) | **B/C** | duplicado entre schemas; ambos seguros | documentar (sem mudança) |
| Motor semanal (trilhas, trilha_semanas, atividades_modelo, disciplinas, metas, meta_atividades) | **A (legado em uso)** | escrito por gerar_meta/virar_semana; trigger; front | **manter** — comentado no banco (0030) |
| Fase 15 vazia (aluno_xp_eventos, aluno_niveis, aluno_nivel_historico, aluno_onboarding, missoes_escola) | **E** | 0 linhas; referência de leitura no front; sem prova de escrita | **marcar p/ DB3** (comentado no banco, 0030) |

## Conclusão DB2-A

- **Nada se enquadrou em "D. Remover na DB2"**: não há tabela com prova
  completa de morte (sem uso em código/RPC/seed/teste **e** sem linhas
  **e** sem dependências). As candidatas vazias (Fase 15) ainda têm
  referência de leitura no front e FKs — vão para **E (DB3)**.
- Ação concreta da DB2: **consolidar policies (B)** + **documentar
  legado/deprecated no banco e em docs (C/E)** + **runbook** +
  **classificar índices (B)**. Nenhum `drop`.
