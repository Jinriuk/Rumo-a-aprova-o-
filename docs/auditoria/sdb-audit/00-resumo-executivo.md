# SDB-AUDIT — Resumo Executivo

> **Fase:** SDB-AUDIT — Auditoria Completa do Supabase
> **Data:** 2026-06-29
> **Projeto:** bdjkgrzfzoamchdpobbl (us-east-1, Free — PostgreSQL 17.6 GA)
> **Repositorio:** Jinriuk/Rumo-a-aprova-o- · Branch base: main (a520dd5)
> **Branch de entrega:** claude/sdb-audit-supabase-completo
> **Auditoria:** read-only — nenhum dado alterado, nenhuma migration criada, nenhum RLS modificado.

---

## Visao Geral

| Dimensao | Resultado |
|----------|-----------|
| Supabase saudavel? | SIM — ACTIVE_HEALTHY, PostgreSQL 17.6 GA |
| Ha P0 de seguranca? | NAO — nenhum novo identificado |
| Ha drift de migrations? | SIM — 3 migrations no repo nao aplicadas remotamente (0034, 0035, 0036) |
| RLS cobre todas as tabelas? | SIM — 46/46 tabelas publicas com RLS enabled |
| Multi-tenant seguro? | SIM — escola_id + tenant_id() em todas as tabelas criticas |
| Edge Functions ativas? | SIM — 6/6 ACTIVE (CORS allowlist, verify_jwt correto) |
| pg_stat_statements habilitado? | SIM — 1838 registros disponíveis |
| Backup gerenciado? | NAO — plano Free, sem backup automatico |
| Staging isolado? | NAO — instancia unica para demo e candidatos reais |
| Regiao LGPD? | NAO — us-east-1 (LGPD exige sa-east-1 para dado de menor) |

---

## Numeros do Inventario

| Item | Quantidade |
|------|-----------|
| Tabelas no schema public | 46 |
| Tabelas com dados (> 0 rows) | 26 |
| Tabelas vazias (potencial legado) | 20 |
| Policies de RLS | 82 |
| Funcoes/RPCs (schemas app + public) | 43 |
| Triggers | 9 |
| Indices no schema public | 126 |
| Indices com 0 scans | 16 |
| Views | 2 |
| Edge Functions deployadas | 6 |
| Extensions instaladas | 6 |
| Cron jobs ativos | 1 |
| Usuarios Auth totais | 76 |
| Escolas cadastradas | 4 |
| Alunos totais | 68 |
| Migrations no remoto | 33 |
| Migrations no repositorio | 36 |
| Drift de migrations | 3 nao aplicadas (0034, 0035, 0036) |
| Storage buckets | 1 (Logos-escolas, publico) |

---

## Estado das Escolas

| Escola | Slug | Status | Plano | Tipo | Alunos |
|--------|------|--------|-------|------|--------|
| Matriz Educacao RM | vitrine | ativa | null | Demo/Seed | 60 |
| Curso Beta Preparatorio | beta | ativa | null | Demo/Seed | 3 |
| Escola Piloto I1 | piloto-i1 | ativa | piloto | Teste | 5 |
| Colegio e Curso Icone | iconemilitar | ativa | padrao | Piloto candidata real | 0 |

Nenhum aluno real em producao. A escola candidata real (Icone) tem 0 alunos cadastrados.

---

## Principais Achados

### Pontos Fortes
- RLS 100% (46/46 tabelas) com isolamento por escola_id consistente
- Funcoes SECURITY DEFINER com search_path fixo em 100% das funcoes criticas
- 0 multiplas policies permissivas (resolvido na DB2 com migration 0029)
- Edge Functions todas ACTIVE com CORS allowlist e verify_jwt correto
- pg_cron configurado (virada de semana diaria as 03:05 UTC)
- pg_stat_statements habilitado — observabilidade de queries disponivel
- Gates internos (eh_super_admin, tenant_operacional, sou_super_admin) integros
- Banco PostgreSQL 17.6 atualizado no canal GA

### Riscos P1 (bloqueadores ou quase-bloqueadores)
- 3 migrations nao aplicadas remotamente (0034, 0035, 0036) — drift ativo com codigo de producao
- Sem backup gerenciado (Free plan) — risco de perda irreversivel de dados
- Sem staging isolado — QA2 inviavel, risco de contaminacao demo x real
- Regiao us-east-1 — LGPD exige sa-east-1 para dado de menor no Brasil
- lgpd_usuarios_do_aluno (0036) nao aplicada — atomicidade LGPD comprometida no banco

### Tabelas Dormentes / Legado
- aluno_xp_eventos, aluno_niveis, aluno_nivel_historico, aluno_missoes, missoes_escola (0 rows)
- aluno_onboarding (1 row apenas)
- motor semanal (trilhas, trilha_semanas, atividades_modelo, disciplinas) — ATIVO mas legado

---

## Classificacao de Riscos (resumo)

| Nivel | N | Itens Principais |
|-------|---|-----------------|
| P0 | 0 | Nenhum |
| P1 | 5 | Drift 0034/0035/0036, backup, staging, regiao, lgpd atomicidade |
| P2 | 6 | Storage sem policies, escolas seq_scan alto, indices ociosos, demo x real |
| P3 | 8 | Tabelas Fase 15 vazias, limpeza de legado, performance futura |
| Manual | 3 | Backup restore testado, SMTP, credenciais demo rotacionadas |
| Julho/Pro | 4 | Backup automatico, leaked password, sa-east-1, staging |

---

## Bloqueios para Aluno Real

1. Drift de migrations — 0034/0035/0036 no repo mas nao no banco remoto
2. Sem backup/restore testado — risco operacional critico
3. SMTP nao validado com dominio real — recuperacao de senha quebrada
4. Sem staging — QA2 de carga impossivel em producao
5. Projeto Supabase unico — demo e real misturados
6. lgpd_usuarios_do_aluno nao aplicada — atomicidade LGPD NAO garantida

---

## Proxima Fase Sugerida

**SDB-FIX1** — Aplicar migrations 0034, 0035 e 0036 ao Supabase remoto (resolver drift).
Depois: **PR1** — Backup/restore, SMTP, escola real, aluno real end-to-end.
