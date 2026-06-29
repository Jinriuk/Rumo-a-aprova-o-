# 05 — RPCs, Functions, Triggers e Cron (SDB-AUDIT)

> Data: 2026-06-29. Evidencias: pg_proc, information_schema.triggers, cron.job.

## 1. Funcoes no Schema APP (29 funcoes)

Todas com search_path fixo. Todas com SECURITY DEFINER quando necessario.

| Funcao | Seguranca | search_path | Finalidade |
|--------|-----------|-------------|-----------|
| app.backfill_progresso | DEFINER | sim | Backfill de progresso historico |
| app.desbloquear_conquista_basica | DEFINER | sim | Desbloquear conquista |
| app.eh_super_admin | DEFINER | sim | Gate de superadmin |
| app.exam_tag_do_aluno | DEFINER | sim | Retorna exam_tag do aluno |
| app.gerar_meta | DEFINER | sim | Gerar meta semanal |
| app.hoje_local | INVOKER | sim | Data local (fuso) |
| app.jwt | INVOKER | sim | Ler claims do JWT |
| app.lgpd_excluir | DEFINER | sim | Excluir dados LGPD |
| app.lgpd_exportar | DEFINER | sim | Exportar dados LGPD |
| app.meu_aluno_id | DEFINER | sim | ID do aluno logado |
| app.motor_avaliar_aluno | DEFINER | sim | Avaliar progresso |
| app.motor_conquista_xp | DEFINER | sim | XP e conquistas |
| app.motor_semeando | INVOKER | sim | Auxiliar motor |
| app.motor_streak_dias | DEFINER | sim | Calcular streak |
| app.papel | INVOKER | sim (vazio) | Papel do JWT |
| app.progresso_de_missao | DEFINER | sim | Progresso de missao |
| app.progresso_de_registro | DEFINER | sim | Progresso de registro |
| app.progresso_de_simulado | DEFINER | sim | Progresso de simulado |
| app.registrar_nivel_historico | DEFINER | sim | Historico de nivel |
| app.registrar_super_admin | DEFINER | sim | Registrar superadmin |
| app.semana_da_data | DEFINER | sim | Numero da semana |
| app.sou_responsavel_de | DEFINER | sim | Verificar vinculo responsavel |
| app.tenant_id | INVOKER | sim (vazio) | Escola_id do JWT |
| app.tenant_operacional | DEFINER | sim | Gate escola ativa |
| app.trg_ped1_registro | DEFINER | sim | Trigger de registro de estudo |
| app.usuario_id | INVOKER | sim (vazio) | Usuario_id do JWT |
| app.virar_semana | DEFINER | sim | Virar semana global |
| app.xp_por_prioridade | INVOKER | sim | XP por prioridade |
| app.xp_simulado | INVOKER | sim | XP de simulado |

### Funcoes AUSENTES por drift (0035/0036 nao aplicadas):
- app.virar_semana(p_escola uuid) — variante por escola
- app.lgpd_usuarios_do_aluno(p_aluno uuid)

## 2. Funcoes no Schema PUBLIC (14 funcoes = RPCs)

| RPC | Seguranca | Acesso | Finalidade |
|-----|-----------|--------|-----------|
| public.backoffice_criar_escola | DEFINER | service_role/superadmin | Criar escola |
| public.backoffice_dashboard | DEFINER | service_role/superadmin | Dashboard backoffice |
| public.backoffice_definir_status | DEFINER | service_role/superadmin | Status de escola |
| public.backoffice_detalhe_escola | DEFINER | service_role/superadmin | Detalhe de escola |
| public.backoffice_editar_escola | DEFINER | service_role/superadmin | Editar escola |
| public.backoffice_escolas | DEFINER | service_role/superadmin | Lista de escolas |
| public.backoffice_registrar_reenvio | DEFINER | service_role/superadmin | Reenvio de email |
| public.lgpd_excluir | DEFINER | service_role | Exclusao LGPD publica |
| public.lgpd_exportar | DEFINER | service_role | Exportar LGPD publica |
| public.motor_gerar_meta | DEFINER | service_role | Gerar meta (porta EF) |
| public.motor_virar_semana | DEFINER | service_role | Virar semana (porta EF) |
| public.resumo_escola | DEFINER | authenticated | Dashboard coordenacao |
| public.salvar_onboarding_aluno | DEFINER | authenticated | Salvar onboarding |
| public.sou_super_admin | DEFINER | authenticated | Gate wrapper publico |

### RPC ausente por drift:
- public.motor_virar_semana_escola(uuid) — 0035 nao aplicada
- public.lgpd_usuarios_do_aluno(uuid) — 0036 nao aplicada

## 3. Triggers (9 eventos = 5 triggers em 3 tabelas)

| Trigger | Tabela | Evento | Timing | Funcao chamada |
|---------|--------|--------|--------|----------------|
| trg_nivel_historico | aluno_niveis | INSERT | AFTER | app.registrar_nivel_historico |
| trg_nivel_historico | aluno_niveis | UPDATE | AFTER | app.registrar_nivel_historico |
| trg_progresso_missao | meta_atividades | INSERT | AFTER | app.progresso_de_missao |
| trg_progresso_missao | meta_atividades | UPDATE | AFTER | app.progresso_de_missao |
| trg_ped1_registro | registros_estudo | INSERT | AFTER | app.trg_ped1_registro |
| trg_ped1_registro | registros_estudo | UPDATE | AFTER | app.trg_ped1_registro |
| trg_ped1_registro | registros_estudo | DELETE | AFTER | app.trg_ped1_registro |
| trg_progresso_registro | registros_estudo | INSERT | AFTER | app.progresso_de_registro |
| trg_progresso_simulado | simulados | INSERT | AFTER | app.progresso_de_simulado |

Observacao: trg_nivel_historico dispara em aluno_niveis que esta VAZIA (0 rows).
O trigger e inofensivo mas nunca dispara. Sera removido quando tabela for removida (DB3).

## 4. Cron Jobs

| Job | Schedule | Command | Status |
|-----|----------|---------|--------|
| virar-semana-diaria | 5 3 * * * | select app.virar_semana() | active |

Horario: 03:05 UTC diariamente.
Chama app.virar_semana() — a variante GLOBAL (sem escola_id).
A variante por escola (0035) NAO esta deployada ainda.

## 5. Funcoes Especiais — Analise de Seguranca

### resumo_escola() — RPC de performance
- Retorna dados de todos os alunos da escola do usuario logado
- Filtro por tenant_id() — isolamento correto
- Acesso: authenticated (coordenacao)
- Chama tabelas: registros_estudo, simulados, metas, aluno_eventos_progresso
- Sem limite de rows explícito — pode ser pesado com muitos alunos
- Observado em pg_stat_statements: 19 chamadas, media 118ms — aceitavel para demo

### lgpd_excluir() — critico para LGPD
- Atomicidade COMPROMETIDA: funcao no banco apaga dados, mas Auth (GoTrue) e apagado separadamente pela Edge Function
- Funcao lgpd_usuarios_do_aluno (0036) NAO aplicada — a Edge Function nao pode usar o helper de atomicidade
- Risco: P1 — exclusao LGPD pode deixar conta Auth orfã se banco apaga e Auth falha
