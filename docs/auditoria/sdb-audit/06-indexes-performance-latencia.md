# 06 — Indexes, Performance e Latencia (SDB-AUDIT)

> Data: 2026-06-29. Evidencias: pg_stat_user_indexes, pg_stat_user_tables, pg_stat_statements.

## 1. Estado Geral de Indexes

| Item | Valor |
|------|-------|
| Total de indexes no schema public | 126 |
| Indexes com 0 scans (potencial ocioso) | 16 |
| FKs sem index correspondente | 13 |
| pg_stat_statements habilitado | SIM (1838 registros) |

## 2. Indexes com 0 Scans (Potencialmente Ociosos)

| Index | Tabela | Tipo | Observacao |
|-------|--------|------|-----------|
| aluno_missoes_aluno_id_missao_id_key | aluno_missoes | unique | Tabela vazia (0 rows) |
| aluno_missoes_pkey | aluno_missoes | pkey | Tabela vazia (0 rows) |
| aluno_niveis_aluno_id_escopo_key | aluno_niveis | unique | Tabela vazia (0 rows) |
| idx_aluno_nivel_hist_aluno | aluno_nivel_historico | btree | Tabela vazia (0 rows) |
| idx_alunos_turma_comercial | alunos | btree | turma_comercial_codigo — uso baixo |
| idx_alunos_turmas_turma | alunos_turmas | btree | Baixo uso |
| idx_consentimentos_aluno | consentimentos | btree | 19 rows, sem carga real |
| logs_coordenacao_pkey | logs_coordenacao | pkey | 124 rows — pk sem uso via index? |
| meta_atividades_meta_id_atividade_modelo_id_key | meta_atividades | unique | Pode ser util, 0 scans ainda |
| missoes_escola_pkey | missoes_escola | pkey | Tabela vazia |
| missoes_escola_escola_id_missao_id_key | missoes_escola | unique | Tabela vazia |
| idx_questoes_prova_prova | questoes_prova | btree | 3 rows, sem carga |
| idx_simulados_exam | simulados | btree | 54 rows, baixo uso |
| idx_tpm_plano | trilha_plano_missoes | btree | 3 rows, sem carga |
| idx_vinculos_aluno | vinculos_responsaveis | btree | 4 rows — carga real ativara |
| idx_vinculos_escola | vinculos_responsaveis | btree | 4 rows — carga real ativara |

CLASSIFICACAO: A maioria esta ociosa por ser tabelas com poucos dados de demo.
Com carga real, a maioria se tornara util. As de tabelas VAZIAS (aluno_missoes,
aluno_niveis, missoes_escola) podem ser removidas com as tabelas na DB3.

## 3. FKs Sem Index (Potencial de Latencia em JOINs)

| Tabela | Coluna | FK para |
|--------|--------|---------|
| aluno_eventos_progresso | criado_por | usuarios |
| aluno_missoes | escola_id | escolas |
| aluno_niveis | definido_por | usuarios |
| aluno_xp_eventos | concedido_por | usuarios |
| alunos | concurso_secundario_id | concursos |
| alunos | concurso_id | concursos |
| config_escola | ajustado_por | usuarios |
| missoes | materia_codigo | materias |
| missoes | assunto_id | assuntos |
| missoes | subassunto_id | subassuntos |
| missoes_escola | ajustado_por | usuarios |
| questoes_prova | materia_codigo | materias |
| questoes_prova | assunto_id | assuntos |

Impacto: baixo com dados de demo. Pode causar latencia com carga real (QA2).
Classificacao: P2 — otimizar antes de QA2.

## 4. Tabelas com Alto seq_scan (Gargalos Potenciais)

| Tabela | seq_scan | Rows | Problema |
|--------|----------|------|---------|
| escolas | 93488 | 4 | ALTO — toda query de isolamento faz seq scan na tabela de 4 rows |
| concursos | 6465 | 6 | MEDIO — alta frequencia relativa |
| vinculos_responsaveis | 3270 | 4 | MEDIO — mas idx_scan 20122 (bom) |
| trilhas | 2204 | 1 | MEDIO — 1 row, seq scan barato |
| consentimentos | 1494 | 19 | BAIXO |

ESCOLAS: 93488 seq_scans em 4 rows e MUITO alto. Com 50 escolas, pode causar latencia.
Investigar se um index parcial em escolas(status, id) ajudaria.

## 5. Queries Mais Lentas (pg_stat_statements — top por mean_exec_time)

| Role | Calls | Mean ms | Query (resumida) |
|------|-------|---------|------------------|
| postgres | 14 | 598ms | Introspection de schema (pg_class) — dashboard |
| authenticator | 71 | 430ms | SELECT from pg_timezone_names — interna Supabase |
| postgres | 109 | 291ms | Introspection de extensions — dashboard |
| supabase_admin | 20 | 181ms | pg_is_in_recovery — Supabase interno |
| postgres | 19 | 118ms | app.virar_semana() — cron diario |
| authenticated | 1457 | 53ms | WITH pgrst_source AS ... (PostgREST RPC) |

OBSERVACAO: As queries mais lentas sao de introspection do dashboard (postgres role)
ou de Supabase interno (authenticator). A query de virar_semana (118ms para demo)
pode crescer com carga real. A query authenticated de 53ms (1457 calls) e a mais
frequente de usuario — PostgREST chamando RPCs.

## 6. Indice Especial: escolas

escolas tem 93488 seq_scans para apenas 4 rows. Isso ocorre porque cada query RLS
de qualquer tabela com escola_id faz um lookup em escolas para validar o tenant.
Com mais escolas, o seq_scan vai aumentar mas o custo por scan cai (ainda 4 rows).
Com 50+ escolas, considerar index em escolas(status) ou escolas(id, status).

Classificacao: P2 — acompanhar com carga real.

## 7. Resumo de Performance

| Item | Status |
|------|--------|
| Indexes principais (escola_id, aluno_id) | OK — adicionados em DB1 (0028) |
| Policies consolidadas | OK — DB2 (0029) |
| pg_stat_statements | OK — habilitado |
| EXPLAIN ANALYZE disponivel | Sim — nao rodado (producao) |
| Vacuum/Analyze status | Postgres 17 com autovacuum |
| Carga real testada | NAO — apenas dados de demo |
