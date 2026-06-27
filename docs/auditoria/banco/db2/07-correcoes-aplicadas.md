# DB2-H — Correções aplicadas

> Somente correções **seguras, comprovadas e não-destrutivas**. Nenhum
> `drop table`/`truncate`/`delete`/remover coluna/renomear/remover motor/
> remover Fase 15/mudar pedagogia/billing/região/backup.

## 1. Arquivos novos

| Arquivo | Tipo | O quê |
|---|---|---|
| `supabase/migrations/0029_db2_policies_consolidadas.sql` | migration | consolida 7 `multiple_permissive_policies` (sem mudar comportamento) |
| `supabase/migrations/0030_db2_comments_inventario.sql` | migration | `COMMENT ON` documentando motor ativo / C0 / Fase 15 vazia (metadado) |
| `tests/policies-consolidadas.test.mjs` | teste | 5 testes provando equivalência das policies + suspensão |
| `docs/operacao/runbook-migrations-supabase.md` | doc | runbook de migrations |
| `docs/auditoria/db2/*.md` | doc | relatórios DB2 (00–08 + final) |
| `docs/auditoria/db1/09-fechamento-db1-main.md` | doc | fechamento da DB1 na main (Parte 1) |

## 2. Mudanças aplicadas ao banco remoto

| # | Ação | Destrutiva? | Verificação |
|---|---|---|---|
| 1 | `apply_migration 0029_db2_policies_consolidadas` | **Não** (consolida policies equivalentes) | `multiple_permissive_policies` 7 → **0**; segurança inalterada; 227/227 testes |
| 2 | `apply_migration 0030_db2_comments_inventario` | **Não** (só `COMMENT ON`) | comentários aplicados; nenhum schema/dado tocado |

Ambas idempotentes (testadas em `rumo_teste`) e registradas no ledger com
`name` == nome do arquivo (paridade preservada).

## 3. O que NÃO foi alterado (intacto)

- RLS continua em 44/44; **nenhum acesso novo aberto, nenhum bloqueado**.
- `app.tenant_operacional()`, `app.eh_super_admin()`,
  `public.sou_super_admin()` e o bloqueio de escola suspensa — intactos.
- Motor semanal e tabelas da Fase 15 — **nada removido**.
- Funções — nenhuma alterada (já endurecidas na S1/DB1).
- Dados reais/demo — nenhum insert/update/delete de aplicação.
- Front sem `service_role`.

## 4. Correções permitidas pela DB2 e seu status

| Permissão DB2-H | Status |
|---|---|
| consolidar policies equivalentes | ✅ feito (0029) |
| adicionar índices justificados | — nenhum justificado agora (ver 05) |
| fixar `search_path` | — já estava (S1/0026) |
| revogar grants indevidos | — nenhum indevido |
| marcar deprecated em docs/banco | ✅ feito (0030 + docs) |
| criar runbook | ✅ feito |
| criar testes de RLS/policies | ✅ feito (`policies-consolidadas`) |
| ajustar comments no banco | ✅ feito (0030) |
