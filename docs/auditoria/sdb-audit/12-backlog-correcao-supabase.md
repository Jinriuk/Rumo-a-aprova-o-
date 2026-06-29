# 12 — Backlog de Correcao do Supabase (SDB-AUDIT)

> Data: 2026-06-29. Ordem sugerida de execucao.

## SDB-FIX1 — Seguranca e Consistencia Critica

### SDB-FIX1-001: Aplicar Migrations 0034, 0035, 0036
- Problema: drift de 3 migrations — funcoes inexistentes no banco
- Evidencia: ledger remoto tem 33 migrations, repo tem 36; funcoes ausentes confirmadas
- Impacto: falha em operacao LGPD (lgpd-titular) e virada por escola
- Risco: P1
- Arquivos: supabase/migrations/0034_maturidade_concursos.sql, 0035_virar_semana_por_escola.sql, 0036_lgpd_usuarios_do_aluno.sql
- Correcao: aplicar via SQL Editor em ordem (0034, 0035, 0036); confirmar paridade 36==36
- Teste: verificar que concursos.maturidade existe; motor_virar_semana_escola() existe; lgpd_usuarios_do_aluno() existe
- Criterio de aceite: SELECT proname FROM pg_proc WHERE proname IN ('motor_virar_semana_escola', 'lgpd_usuarios_do_aluno') retorna 2 rows

## SDB-FIX2 — Performance e Latencia

### SDB-FIX2-001: Adicionar Indexes nas FKs Faltantes
- Problema: 13 FKs sem index — JOINs lentos com carga real
- Impacto: latencia em consultas de relatorio e historico
- Risco: P2
- Tabelas: aluno_eventos_progresso.criado_por, alunos.concurso_id, alunos.concurso_secundario_id, etc.
- Correcao: migration aditiva com CREATE INDEX IF NOT EXISTS
- Teste: verificar pg_stat_user_indexes apos carga QA2

### SDB-FIX2-002: Investigar Index em escolas(status, id)
- Problema: 93488 seq_scans em tabela de 4 rows
- Impacto: sera pior com mais escolas
- Risco: P2
- Correcao: CREATE INDEX CONCURRENTLY idx_escolas_status ON escolas(status, id)
- Teste: medir seq_scan antes e depois sob carga

## SDB-FIX3 — Limpeza de Legado

### SDB-FIX3-001: Remover Tabelas Fase 15 Dormentes (apos DB3)
- Problema: 6 tabelas vazias (aluno_xp_eventos, aluno_niveis, aluno_nivel_historico, aluno_missoes, aluno_onboarding, missoes_escola)
- Risco: P3 (nao urgente, mas acumula divida tecnica)
- Pre-requisito: provar ausencia de escrita por 30 dias; documentar decisao de produto
- Correcao: migration DROP TABLE com backup previo

### SDB-FIX3-002: Remover Trigger trg_nivel_historico
- Problema: trigger em tabela vazia — nunca dispara
- Risco: P3
- Correcao: DROP TRIGGER trg_nivel_historico ON aluno_niveis (apos remover tabela)

### SDB-FIX3-003: Revisar Indexes com 0 Scans
- Problema: 16 indexes com 0 scans (potencialmente obsoletos)
- Risco: P3
- Correcao: manter indexes de tabelas ativas; remover indexes de tabelas vazias na DB3

## SDB-FIX4 — Demo vs Real

### SDB-FIX4-001: Criar Projeto Supabase Separado para Demo
- Problema: demo e real na mesma instancia
- Impacto: aluno real em ranking demo; credenciais demo expostas
- Risco: P2
- Correcao: criar projeto Supabase separado; migrar dados demo para ele

### SDB-FIX4-002: Rotacionar Credenciais Demo
- Problema: 73 usuarios com emails .local e senhas padrao
- Impacto: seguranca fraca; confusao com usuarios reais
- Risco: P2
- Correcao: antes do PR1, invalidar ou separar as credenciais demo

## SDB-FIX5 — Observabilidade

### SDB-FIX5-001: Configurar Alertas de Uptime
- Problema: sem monitoramento externo
- Risco: P3
- Correcao: configurar UptimeRobot ou similar no Vercel/Supabase

### SDB-FIX5-002: Definir Retencao de Logs
- Problema: logs_acesso e logs_coordenacao crescem sem limite
- Risco: P3
- Correcao: migration com pg_cron para limpar logs > 90 dias

### SDB-FIX5-003: Restricoes no Bucket de Storage
- Problema: sem size_limit e allowed_mime_types no bucket Logos-escolas
- Risco: P2
- Correcao: UPDATE storage.buckets SET file_size_limit = 2097152, allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'] WHERE id = 'Logos-escolas'

## SDB-FIX6 — Preparacao para QA2

### SDB-FIX6-001: Criar Staging Isolado
- Problema: sem ambiente de staging
- Risco: P1
- Correcao: projeto Supabase Pro separado com seeds proprios

### SDB-FIX6-002: Validar resumo_escola() sob Carga
- Problema: sem teste de carga da funcao mais pesada
- Risco: P2 (nao verificado)
- Correcao: criar escola de teste com 300-500 alunos no staging e medir
