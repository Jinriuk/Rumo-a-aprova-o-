# 01 — Inventário do Banco (SDB-AUDIT)

> **Data:** 2026-06-29 · Projeto: bdjkgrzfzoamchdpobbl · Read-only.

---

## 1. Schemas

| Schema | Função |
|--------|--------|
| public | Dados de aplicação (46 tabelas) |
| auth | Auth/GoTrue do Supabase (11 tabelas internas) |
| app | Funções de negócio/segurança (sem tabelas próprias) |
| storage | Storage do Supabase (buckets e objects) |
| cron | pg_cron (1 job) |
| supabase_migrations | Ledger de migrations |

---

## 2. Tabelas — Schema Public (46 tabelas)

### 2.1 Núcleo Multi-Tenant

| Tabela | Rows | Tamanho | RLS | Comentário |
|--------|------|---------|-----|-----------|
| escolas | 4 | — | ✅ | 2 demo, 1 piloto-teste, 1 candidata real |
| usuarios | 76 | — | ✅ | Perfis internos; sem coluna user_id → FK via email |
| turmas | 8 | — | ✅ | Turmas de cada escola |
| alunos | 68 | 112 kB | ✅ | 60 vitrine, 3 beta, 5 piloto, 0 real |
| alunos_turmas | 68 | 56 kB | ✅ | Vínculo aluno-turma |
| vinculos_responsaveis | 4 | — | ✅ | Responsável-aluno |
| registros_estudo | 456 | 256 kB | ✅ | Ativo — escrito pelo front |
| simulados | 54 | 112 kB | ✅ | Ativo |
| consentimentos | 19 | — | ✅ | LGPD |
| internal_admins | 1 | — | ✅ | Superadmin único |
| admin_logs | 14 | 48 kB | ✅ | Log de ações do superadmin |

### 2.2 Motor Semanal (ATIVO — legado em uso)

| Tabela | Rows | RLS | Status | Comentário |
|--------|------|-----|--------|-----------|
| trilhas | 1 | ✅ | ATIVO | Base da lógica semanal |
| trilha_semanas | 9 | ✅ | ATIVO | Semanas da trilha |
| atividades_modelo | 50 | ✅ | ATIVO | Modelos de atividade semanal |
| disciplinas | 8 | ✅ | ATIVO | Disciplinas do motor semanal |
| metas | 295 | ✅ | ATIVO | Metas semanais dos alunos (escrito por gerar_meta) |
| meta_atividades | 1733 | ✅ | ATIVO | Atividades das metas (escrito pelo front) |

### 2.3 Fase 15 — Catálogos (populados, usados)

| Tabela | Rows | RLS | Status |
|--------|------|-----|--------|
| concursos | 6 | ✅ | ATIVO |
| config_oficial | 18 | ✅ | ATIVO |
| config_escola | 1 | ✅ | ATIVO |
| materias | 9 | ✅ | ATIVO |
| assuntos | 11 | ✅ | ATIVO |
| subassuntos | 22 | ✅ | ATIVO |
| provas | 5 | ✅ | ATIVO |
| prova_dias | 7 | ✅ | ATIVO |
| prova_materias | 31 | ✅ | ATIVO |
| provas_anteriores | 1 | ✅ | ATIVO |
| questoes_prova | 3 | ✅ | ATIVO |
| recorrencia_assunto | 3 | ✅ | ATIVO |
| trilha_planos | 12 | ✅ | ATIVO |
| trilha_plano_missoes | 3 | ✅ | ATIVO |
| turmas_comerciais | 3 | ✅ | ATIVO |
| turmas_comerciais_concursos | 5 | ✅ | ATIVO |
| conquistas | 13 | ✅ | ATIVO |
| patentes | 8 | ✅ | ATIVO |
| missoes | 8 | ✅ | ATIVO |

### 2.4 Fase 15 — Gamificação (VAZIA / dormente)

| Tabela | Rows | RLS | Status | Comentário DB2 |
|--------|------|-----|--------|----------------|
| aluno_xp_eventos | 0 | ✅ | DORMENTE | XP efetivo no C0 (aluno_eventos_progresso) |
| aluno_niveis | 0 | ✅ | DORMENTE | Trigger existe mas não dispara |
| aluno_nivel_historico | 0 | ✅ | DORMENTE | Trigger trg_nivel_historico sem dados |
| aluno_onboarding | 1 | ✅ | DORMENTE | 1 row apenas |
| aluno_missoes | 0 | ✅ | DORMENTE | Fase 15 incompleta |
| missoes_escola | 0 | ✅ | DORMENTE | Ativação por escola não implementada |

### 2.5 Motor de Progresso C0 (ATIVO)

| Tabela | Rows | RLS | Status |
|--------|------|-----|--------|
| aluno_eventos_progresso | 1002 | ✅ | ATIVO — fonte canônica de XP |
| aluno_conquistas | 110 | ✅ | ATIVO |

### 2.6 Logs e Auditoria

| Tabela | Rows | RLS | Período |
|--------|------|-----|---------|
| logs_acesso | 1008 | ✅ | 2026-06-11 a 2026-06-27 |
| logs_coordenacao | 124 | ✅ | 2026-06-19 a 2026-06-27 |
| admin_logs | 14 | ✅ | — |

### 2.7 Backoffice/D0

| Tabela | Rows | RLS | Status |
|--------|------|-----|--------|
| internal_admins | 1 | ✅ | ATIVO — 1 superadmin real |
| admin_logs | 14 | ✅ | ATIVO |

---

## 3. Views (2)

| View | Schema | Segurança | Descrição |
|------|--------|-----------|-----------|
| vw_aluno_xp_total | public | security_invoker | Soma XP de aluno_eventos_progresso |
| vw_recorrencia_medida | public | security_invoker | Análise de recorrência de assuntos |

**Nota:** vw_concurso_qualidade (migration 0034) NÃO existe no banco remoto — drift pendente.

---

## 4. Extensions Instaladas (6)

| Extension | Versão | Propósito |
|-----------|--------|-----------|
| pg_cron | 1.6.4 | Cron jobs no banco (virada de semana) |
| pg_stat_statements | 1.11 | Monitoramento de queries |
| pgcrypto | 1.3 | Funções criptográficas |
| plpgsql | 1.0 | Linguagem procedural |
| supabase_vault | 0.3.1 | Secrets no Vault |
| uuid-ossp | 1.1 | Geração de UUIDs |

---

## 5. Cron Jobs (1)

| Job | Schedule | Command | Status |
|-----|----------|---------|--------|
| virar-semana-diaria | 5 3 * * * (03:05 UTC) | select app.virar_semana() | active |

---

## 6. Storage

| Bucket | Público | Objetos | Tamanho |
|--------|---------|---------|---------|
| Logos-escolas | true | 2 | — |

**Risco:** Bucket público sem size_limit e allowed_mime_types definidos. Sem policies de storage explícitas encontradas via pg_policies (políticas podem ser via Supabase UI).

---

## 7. Resumo de Classificação das Tabelas

| Classificação | Tabelas |
|--------------|---------|
| ATIVA | escolas, usuarios, turmas, alunos, alunos_turmas, vinculos_responsaveis, registros_estudo, simulados, consentimentos, aluno_eventos_progresso, aluno_conquistas, metas, meta_atividades, trilhas, trilha_semanas, atividades_modelo, disciplinas, concursos, materias, assuntos, subassuntos, provas, prova_dias, prova_materias, provas_anteriores, questoes_prova, recorrencia_assunto, trilha_planos, trilha_plano_missoes, turmas_comerciais, turmas_comerciais_concursos, conquistas, patentes, missoes, config_oficial, config_escola, logs_acesso, logs_coordenacao, internal_admins, admin_logs |
| DORMENTE (DB3) | aluno_xp_eventos, aluno_niveis, aluno_nivel_historico, aluno_missoes, missoes_escola |
| DORMENTE PARCIAL | aluno_onboarding (1 row) |
