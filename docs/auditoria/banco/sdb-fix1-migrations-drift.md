# SDB-FIX1 — Drift de Migrations 0034/0035/0036 Corrigido

> Data: 2026-06-29 · Projeto `bdjkgrzfzoamchdpobbl` · Branch: `claude/sdb-migrations-drift-parity-4fgyvr`

## 1. Problema

A auditoria SDB-AUDIT (branch `claude/sdb-audit-supabase-completo`) identificou drift de 3 migrations:
o repositório tinha 36 arquivos, mas o ledger remoto registrava apenas 33.

| Migration | Objeto criado | Risco |
|---|---|---|
| `0034_maturidade_concursos` | coluna `concursos.maturidade`, view `vw_concurso_qualidade` | MÉDIO |
| `0035_virar_semana_por_escola` | `app.virar_semana(uuid,date)`, `public.motor_virar_semana_escola(uuid)` | MÉDIO |
| `0036_lgpd_usuarios_do_aluno` | `app.lgpd_usuarios_do_aluno(uuid)`, `public.lgpd_usuarios_do_aluno(uuid)` | ALTO |

## 2. Ação Executada

Migrations aplicadas em ordem via `apply_migration` (MCP Supabase), respeitando o runbook
(nunca `supabase db push`). Todas aditivas e reversíveis.

| # | Migration | Resultado | Timestamp ledger |
|---|---|---|---|
| 1 | `0034_maturidade_concursos` | `success: true` | `20260629122447` |
| 2 | `0035_virar_semana_por_escola` | `success: true` | `20260629122517` |
| 3 | `0036_lgpd_usuarios_do_aluno` | `success: true` | `20260629122541` |

## 3. Paridade Confirmada

| Métrica | Antes | Depois |
|---|---|---|
| Migrations no repositório | 36 | 36 |
| Migrations no ledger remoto | 33 | **36** |
| Drift | 3 | **0** |

**Paridade: 36 == 36. Drift zerado.**

## 4. Verificação dos Objetos (pós-aplicação)

Todos os 6 objetos confirmados existentes no banco:

| Objeto | Existe |
|---|---|
| `concursos.maturidade` (coluna) | ✓ |
| `vw_concurso_qualidade` (view) | ✓ |
| `app.virar_semana(uuid, date)` | ✓ |
| `public.motor_virar_semana_escola(uuid)` | ✓ |
| `app.lgpd_usuarios_do_aluno(uuid)` | ✓ |
| `public.lgpd_usuarios_do_aluno(uuid)` | ✓ |

## 5. Rollback (se necessário)

```sql
-- 0036
drop function if exists public.lgpd_usuarios_do_aluno(uuid);
drop function if exists app.lgpd_usuarios_do_aluno(uuid);

-- 0035
drop function if exists public.motor_virar_semana_escola(uuid);
drop function if exists app.virar_semana(uuid, date);

-- 0034
drop view if exists public.vw_concurso_qualidade;
alter table concursos drop column if exists conteudo_versao;
alter table concursos drop column if exists maturidade;
```

Todas as funções/views removidas manualmente via SQL Editor do dashboard. Nenhuma tabela, dado
de aluno/escola ou RLS existente é tocado pelo rollback.
