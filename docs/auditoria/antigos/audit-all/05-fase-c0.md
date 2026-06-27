# Fase C0 — Motor real de progresso/XP/ledger

## 7.1 Promessa da fase
Substituir o XP calculado no front (volátil, não auditável) por um **motor persistido**: cada ação do aluno (registrar estudo, concluir objetivo de missão, lançar simulado) vira **evento persistido**, derivado por **gatilho `SECURITY DEFINER`** da linha real, idempotente (`idempotency_key`), com XP total = soma do ledger e patente derivada — **XP não confiado pelo front**, RLS barrando escrita direta, backfill disponível, Lucas Demo preservado, compatível com a Fase 15.

## 7.2 Evidência no código
- `supabase/migrations/0024_motor_progresso.sql` — ledger `aluno_eventos_progresso`, view `vw_aluno_xp_total`, gatilhos, `app.backfill_progresso`, idempotência por chave única.
- `app/src/modules/motor/jargao.js` (`xpTotal(eventos)` da fonte de verdade; `calcularXP` vira fallback), `data/index.js` (`carregarEventosProgresso`, `carregarXpPersistido`), `VisaoEstudo.jsx`, `FichaAluno.jsx`, `HistoricoProgresso.jsx`.
- Testes: `progresso.test.mjs` (lógica), `progresso-db.test.mjs` (RLS/gatilhos/idempotência), `app/e2e/motor-progresso.spec.js`.

## 7.3 Evidência no ambiente (Supabase remoto)
- `aluno_eventos_progresso` (ledger): **964 linhas** (vivo; cresceu de 346→859→964 ao longo das fases). `aluno_com_evento` = vários alunos.
- `vw_aluno_xp_total`: **existe**.
- **Triggers presentes e ativos:**
  - `trg_progresso_registro` em `registros_estudo` (AFTER INSERT) ✓
  - `trg_progresso_simulado` em `simulados` (AFTER INSERT) ✓
  - `trg_progresso_missao` em `meta_atividades` (AFTER INSERT/UPDATE) ✓
  - `trg_nivel_historico` em `aluno_niveis` (AFTER INSERT/UPDATE) — da 15.3.
- **Lucas Demo:** `vw_aluno_xp_total` → **1400 XP, topo do ranking** da vitrine. Preservado ✓.
- **XP não confiado pelo front:** a escrita do aluno é só em `registros_estudo`/`meta_atividades`/`simulados`; o evento de XP vem do gatilho `SECURITY DEFINER` (RLS barra escrita direta no ledger). Coberto por `progresso-db.test.mjs`.

## 7.4 O que foi realmente entregue
O motor C0 está **vivo e correto** no remoto: ledger povoado por gatilhos reais, view de total, idempotência, Lucas preservado, XP derivado no banco. Compatível com a Fase 15 (consumido por aluno e coordenação).

## 7.5 O que não foi entregue
- Nada material em falta no comportamento. O único “débito” é de **rótulo de migration** (ver 7.6).

## 7.6 Divergências
- **Divergência de numeração de migration (documentada e aceita):** no remoto o motor está registrado como **`0022_motor_progresso`**; no repo o arquivo é **`0024_motor_progresso.sql`** (body idêntico, idempotente). Não há linha `0024` no remoto. Origem: o motor foi construído na branch `demo-base-realista` quando `0022` estava livre; na `main`, `0022`/`0023` já eram outras migrations. Consequência: `supabase_migrations.schema_migrations` tem **dois `0022`** (`_motor_progresso` e `_logs_coordenacao`) e **nenhum `0024`** — qualquer `supabase db push` veria o `0024` local como “não aplicado”. Mitigado pela idempotência do body, mas é uma **armadilha operacional** (ver `10-supabase.md`).

## 7.7 Riscos
- **P2** — Divergência de ledger de migration (`0022_motor_progresso` remoto × `0024` repo): risco de reaplicação/confusão em `db push` ou em automação que sincroniza por nome/número.

## 7.8 Decisão da fase
**Aprovada.** O motor é real, persistido, idempotente, com XP derivado no banco e Lucas preservado — exatamente a promessa. A única ressalva é o rótulo de migration divergente no remoto, que é débito de DB1, não de funcionalidade.
