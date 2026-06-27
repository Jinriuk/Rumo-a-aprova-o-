# Reconciliação de migrations — Fase C0 × main (Fase C0.5)

> **Status:** ✅ **CONCLUÍDA** (repo + remoto). Em 2026-06-19, com autorização do usuário, as duas
> migrations ausentes foram aplicadas no Supabase remoto (`0022_logs_coordenacao` e
> `0023_indices_escala_coordenacao`). Todos os objetos verificados presentes; advisor de segurança
> sem regressão. Resíduo cosmético: o registro do motor no remoto mantém o rótulo
> `0022_motor_progresso` (o rename para `0024` foi bloqueado por política e é apenas estético — o
> schema está consistente).
> Data: 2026-06-19.

## 1. O problema (divergência confirmada)

A Fase C0 (motor de progresso persistido) foi construída na branch
`claude/demo-base-realista-auditoria-t5ji99` e **aplicada no Supabase remoto** como
`0022_motor_progresso` — mas naquela branch o número 0022 estava livre. No `main`, `0022`/`0023` já
eram outras migrations. Resultado: o número `0022` aponta para coisas **diferentes** em cada lado.

| Migration (nome) | Repo / `main` | Supabase remoto (`bdjkgrzfzoamchdpobbl`) |
|---|:--:|:--:|
| `0001`–`0021` | ✅ | ✅ |
| `0022_logs_coordenacao` | ✅ (arquivo) | ❌ **não aplicada** (tabela `logs_coordenacao` não existe) |
| `0023_indices_escala_coordenacao` | ✅ (arquivo) | ❌ **não aplicada** |
| `0022_motor_progresso` (C0, ledger) | ❌ | ✅ aplicada 2026-06-19 (`aluno_eventos_progresso` = 346 linhas) |

Fonte: `list_migrations` + `list_tables` do projeto remoto (somente leitura).

## 2. O que já foi feito NO REPOSITÓRIO (não-destrutivo)

1. **`supabase/migrations/0024_motor_progresso.sql`** — o motor C0 renumerado de 0022 → **0024**
   (próximo após 0023). **Body idêntico** ao aplicado no remoto; idempotente
   (`create table if not exists`, `create or replace`), então reaplicar é no-op de schema.
2. **Front ligado ao ledger** (some o "fallback legado mascarando a C0"):
   - `data/index.js`: `carregarEventosProgresso`, `carregarXpPersistido` (degradam para vazio se a
     tabela não existir — seguro em ambiente ainda não migrado).
   - `jargao.js`: `xpTotal(eventos)` — XP da fonte de verdade; `calcularXP` vira só fallback.
   - `VisaoEstudo` (aluno) e `FichaAluno` (coordenação): XP vem do ledger quando há eventos.
   - `HistoricoProgresso.jsx`: a coordenação vê o histórico real de eventos do aluno.
3. **Testes:** `tests/progresso.test.mjs` (lógica) + `tests/progresso-db.test.mjs` (banco/RLS/
   gatilhos/idempotência) + `app/e2e/motor-progresso.spec.js`. Suíte local: **204/204 verde**.

> O `main`/repo agora tem histórico crescente e reproduzível: `0001 … 0023, 0024_motor_progresso`.

## 3. O que falta no REMOTO (a decidir/aprovar — NÃO executado)

O remoto está com o motor, mas **sem** `logs_coordenacao` e os índices de escala. Para alinhar:

1. **Aplicar no remoto** (via Supabase MCP `apply_migration` ou CLI), na ordem:
   - `0022_logs_coordenacao` (cria a tabela `logs_coordenacao` + RLS);
   - `0023_indices_escala_coordenacao` (índices de performance da coordenação).
   Ambas são aditivas e não conflitam com o motor já presente.
2. **Não reaplicar** o motor no remoto — já está lá. Opcional/cosmético: alinhar o **nome** do
   registro de migration no remoto (`0022_motor_progresso` → `0024_motor_progresso`) na tabela
   `supabase_migrations.schema_migrations`. Não afeta runtime; só estética do histórico. Recomendo
   **deixar como está** para não escrever na tabela de controle sem necessidade.
3. **Backfill** (se desejado para bases antigas): `select app.backfill_progresso('<escola_id>');` —
   idempotente; só cria os eventos que os gatilhos ainda não cobriram.

## 4. Riscos e mitigação

- **Idempotência:** todas as migrations envolvidas são `if not exists`/`create or replace`. Reexecução
  não duplica objetos. O ledger usa `idempotency_key` única — backfill/gatilho não dobram XP.
- **RLS:** nenhuma policy enfraquecida. O motor barra escrita direta do aluno (gatilho
  SECURITY DEFINER) e isola por escola (testes de isolamento verdes).
- **Sem perda de dado:** nada é apagado. `aluno_xp_eventos` (XP manual, 0013) é preservado.
- **Ordem no remoto:** aplicar 0022_logs_coordenacao e 0023_indices é seguro mesmo com o motor já
  presente, pois não há dependência entre eles.

## 5. Checklist de aplicação no remoto — EXECUTADO em 2026-06-19

- [x] `apply_migration name=0022_logs_coordenacao` → `{success:true}`.
- [x] `apply_migration name=0023_indices_escala_coordenacao` → `{success:true}`.
- [x] Verificação de objetos: `logs_coordenacao` (RLS ativa) + 4 índices de escala → todos **OK**.
- [x] Migrations registradas em `schema_migrations` (`0022_logs_coordenacao`, `0023_indices…`).
- [x] `get_advisors(security)` → sem regressão (warnings restantes são pré-existentes).
- [ ] (Opcional, não feito) `app.backfill_progresso` por escola — o ledger já tem 346 eventos.
- [ ] (Cosmético, bloqueado por política) rename do rótulo `0022_motor_progresso` → `0024` no remoto.
