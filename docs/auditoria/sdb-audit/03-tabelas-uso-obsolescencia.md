# 03 — Tabelas: Uso e Obsolescencia (SDB-AUDIT)

> Data: 2026-06-29. Evidencias: counts reais + seq_scan + pg_stat_user_tables + comentarios DB2.

## Classificacao por Tabela

### ATIVAS — Nucleo Multi-Tenant

| Tabela | Rows | escola_id | RLS | Usado por | Classificacao |
|--------|------|-----------|-----|-----------|---------------|
| escolas | 4 | nao (e a raiz) | sim | front, EF, RPC | ATIVA |
| usuarios | 76 | sim | sim | front, EF | ATIVA |
| turmas | 8 | sim | sim | front, EF | ATIVA |
| alunos | 68 | sim | sim | front, EF, RPC | ATIVA |
| alunos_turmas | 68 | nao (FK) | sim | front | ATIVA |
| vinculos_responsaveis | 4 | sim | sim | front, EF | ATIVA |
| registros_estudo | 456 | via aluno | sim | front (trigger) | ATIVA |
| simulados | 54 | via aluno | sim | front (trigger) | ATIVA |
| consentimentos | 19 | sim | sim | EF lgpd | ATIVA |
| internal_admins | 1 | nao | sim | backoffice | ATIVA |
| admin_logs | 14 | nao | sim | backoffice | ATIVA |

### ATIVAS — Motor Semanal (legado em uso — NAO remover)

| Tabela | Rows | Usado por | Classificacao |
|--------|------|-----------|---------------|
| trilhas | 1 | app.semana_da_data | ATIVA |
| trilha_semanas | 9 | app.semana_da_data | ATIVA |
| atividades_modelo | 50 | app.gerar_meta | ATIVA |
| disciplinas | 8 | app.gerar_meta | ATIVA |
| metas | 295 | app.gerar_meta, front | ATIVA |
| meta_atividades | 1733 | front, trigger progresso | ATIVA |

### ATIVAS — Motor Progresso C0

| Tabela | Rows | Usado por | Classificacao |
|--------|------|-----------|---------------|
| aluno_eventos_progresso | 1002 | trigger trg_ped1_registro | ATIVA — FONTE CANONICA XP |
| aluno_conquistas | 110 | app.desbloquear_conquista_basica | ATIVA |

### ATIVAS — Catalogo Fase 15

| Tabela | Rows | Classificacao |
|--------|------|---------------|
| concursos | 6 | ATIVA |
| config_oficial | 18 | ATIVA |
| config_escola | 1 | ATIVA MAS MELHORAR (poucos dados) |
| materias | 9 | ATIVA |
| assuntos | 11 | ATIVA |
| subassuntos | 22 | ATIVA |
| provas | 5 | ATIVA |
| prova_dias | 7 | ATIVA |
| prova_materias | 31 | ATIVA |
| provas_anteriores | 1 | ATIVA MAS MELHORAR |
| questoes_prova | 3 | ATIVA MAS MELHORAR |
| recorrencia_assunto | 3 | ATIVA MAS MELHORAR |
| trilha_planos | 12 | ATIVA |
| trilha_plano_missoes | 3 | ATIVA MAS MELHORAR |
| turmas_comerciais | 3 | ATIVA |
| turmas_comerciais_concursos | 5 | ATIVA |
| conquistas | 13 | ATIVA |
| patentes | 8 | ATIVA |
| missoes | 8 | ATIVA |

### ATIVAS — Logs

| Tabela | Rows | Periodo | Classificacao |
|--------|------|---------|---------------|
| logs_acesso | 1008 | 2026-06-11 a 2026-06-27 | ATIVA |
| logs_coordenacao | 124 | 2026-06-19 a 2026-06-27 | ATIVA |

### DORMENTES — Fase 15 (vazias, investigar antes de remover)

| Tabela | Rows | Trigger | Classificacao DB2 | Acao sugerida |
|--------|------|---------|-------------------|---------------|
| aluno_xp_eventos | 0 | nao | DORMENTE | Investigar escrita antes de DB3 |
| aluno_niveis | 0 | sim (trg_nivel_historico) | DORMENTE | Trigger existe, dado nao; investigar |
| aluno_nivel_historico | 0 | nao (destino do trigger) | DORMENTE | Vazio pois aluno_niveis vazio |
| aluno_missoes | 0 | nao | DORMENTE | Fase 15 incompleta |
| missoes_escola | 0 | nao | DORMENTE | Ativacao por escola nao implementada |
| aluno_onboarding | 1 | nao | DORMENTE PARCIAL | 1 row, Fase 15 parcial |

## Tabelas Mencionadas em Auditorias Anteriores

| Tabela | Estado DB1/DB2 | Estado Atual (SDB-AUDIT) |
|--------|---------------|--------------------------|
| aluno_xp_eventos | VAZIA — possivelmente legado | DORMENTE — 0 rows confirmado |
| aluno_conquistas | ATIVA | ATIVA — 110 rows |
| aluno_niveis | VAZIA — Fase 15 | DORMENTE — 0 rows, trigger existe |
| aluno_nivel_historico | VAZIA — trigger sem dados | DORMENTE — 0 rows confirmado |
| aluno_onboarding | VAZIA — Fase 15 | DORMENTE PARCIAL — 1 row |
| missoes | Catálogo ativo | ATIVA — 8 missoes |
| missoes_escola | VAZIA — Fase 15 | DORMENTE — 0 rows |
| trilhas | Motor semanal ATIVO | ATIVA — 1 trilha |
| trilha_semanas | Motor semanal ATIVO | ATIVA — 9 semanas |
| metas | Motor semanal ATIVO | ATIVA — 295 metas |
| simulados | Ativo | ATIVA — 54 simulados |

## Performance por Tabela (seq_scan — evidencias reais)

| Tabela | seq_scan | Preocupacao |
|--------|----------|-------------|
| escolas | 93488 | ALTA — candidata a indice por status/slug |
| concursos | 6465 | MEDIA — relativamente alto para 6 rows |
| vinculos_responsaveis | 3270 | MEDIA — mas idx_scan 20122 (indices usados) |
| trilhas | 2204 | MEDIA — mas idx_scan 5997 |
| consentimentos | 1494 | BAIXA |
| meta_atividades | 1480 | BAIXA — idx_scan 41134 (indices OK) |
| simulados | 1463 | BAIXA — idx_scan 3824 |
| metas | 1423 | BAIXA — idx_scan 194026 (muitos indices) |
