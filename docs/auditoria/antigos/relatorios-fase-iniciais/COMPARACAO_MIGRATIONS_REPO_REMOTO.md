# Comparação migration-a-migration — repo × Supabase remoto (Fase C0.5)

> Investigação somente-leitura do projeto `Rumo-a-aprova-o-` (`bdjkgrzfzoamchdpobbl`).
> **Nada aplicado.** Data: 2026-06-19.
> Método: `supabase_migrations.schema_migrations` + verificação de existência de cada objeto
> (`to_regclass`, `pg_indexes`, `pg_trigger`, `pg_proc`).

## 1. Lado a lado (por NOME de migration)

| # | Repo (`supabase/migrations/`) | Remoto (`schema_migrations`) | Situação |
|---|---|---|---|
| 0001–0007 | ✅ | ✅ | iguais |
| 0008–0015 | ✅ | ✅ | iguais (no remoto aplicadas após 0016 — timestamp, ok) |
| 0016_painel_agregado | ✅ | ✅ | iguais |
| 0017–0021 | ✅ | ✅ | iguais |
| **0022** | `0022_logs_coordenacao` | `0022_motor_progresso` | ⚠️ **mesmo número, migrations diferentes** |
| **0023** | `0023_indices_escala_coordenacao` | — | ❌ **falta no remoto** |
| **0024** | `0024_motor_progresso` | — (está no remoto como `0022`) | ⚠️ **mesmo body, número diferente** |

Remoto = 22 migrations aplicadas. Repo = 24 arquivos.

## 2. Verificação objeto-a-objeto no remoto

| Objeto (migration de origem) | Esperado | Remoto |
|---|---|---|
| `logs_coordenacao` (tabela) — 0022_logs_coordenacao | existir | ❌ AUSENTE |
| `idx_logs_coordenacao_escola` — 0022_logs_coordenacao | existir | ❌ AUSENTE |
| `idx_registros_escola` — 0023 | existir | ❌ AUSENTE |
| `idx_metas_escola_status` — 0023 | existir | ❌ AUSENTE |
| `idx_simulados_escola` — 0023 | existir | ❌ AUSENTE |
| `idx_consentimentos_escola` — 0023 | existir | ❌ AUSENTE |
| `aluno_eventos_progresso` (tabela) — motor | existir | ✅ OK (346 linhas) |
| `vw_aluno_xp_total` (view) — motor | existir | ✅ OK |
| `trg_progresso_registro` (trigger) — motor | existir | ✅ OK |
| `trg_progresso_missao` (trigger) — motor | existir | ✅ OK |
| `trg_progresso_simulado` (trigger) — motor | existir | ✅ OK |
| `app.backfill_progresso` (função) — motor | existir | ✅ OK |

## 3. Conclusão precisa

- **Falta no remoto (2 migrations):**
  - `0022_logs_coordenacao` — tabela de auditoria de ações da coordenação + RLS.
  - `0023_indices_escala_coordenacao` — 4 índices de performance (Fase B-min).
- **Existe no remoto, número divergente do repo (1 migration):**
  - motor C0 — aplicado como `0022_motor_progresso`; no repo agora é `0024_motor_progresso`
    (mesmo body, idempotente). O schema do motor está **completo** no remoto.

### Impacto operacional (não é só cosmético)

1. **Auditoria de coordenação inativa no remoto.** Sem `logs_coordenacao`, o
   `registrarLogCoordenacao` do front cai no catch e não grava nada (best-effort por design). Ações
   sensíveis (criar/renomear/excluir turma, importar alunos, trocar marca) ficam **sem rastro** no
   ambiente remoto. Exigência da Fase A.8.
2. **Índices de escala ausentes.** Consultas da coordenação por `escola_id`
   (registros/metas/simulados/consentimentos) rodam sem índice. A 300–500 alunos (alvo do piloto,
   Fase B-min) isso degrada a coordenação. Hoje, com 26 alunos, não é perceptível.
3. **Colisão de numeração.** `0022` resolve para migrations diferentes em cada lado — confuso para
   qualquer automação que sincronize por nome/número.

## 4. Correção proposta (a executar só com autorização)

**No repositório (já feito nesta fase):** motor renumerado para `0024_motor_progresso` → histórico
crescente `0001…0024`.

**No remoto (pendente de OK):** aplicar, nesta ordem, as duas migrations ausentes:
1. `0022_logs_coordenacao`
2. `0023_indices_escala_coordenacao`

Ambas são aditivas e idempotentes (`create table/index if not exists`), não tocam o motor já
presente, e não há dependência entre elas. O motor **não** deve ser reaplicado. Alinhar o **nome**
do registro do motor no remoto (`0022`→`0024`) é opcional e cosmético — recomendo não escrever na
tabela de controle sem necessidade. Detalhe e checklist: `docs/relatorios/RECONCILIACAO_MIGRATIONS_C0.md`.
