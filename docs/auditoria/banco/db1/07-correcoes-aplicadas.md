# DB1-H — Correções Aplicadas

> Data: 2026-06-21 · Projeto `bdjkgrzfzoamchdpobbl`. Somente correções
> **seguras, aditivas e não-destrutivas**. Nenhum `drop`, `truncate`,
> `delete`, alteração de enum, remoção de coluna, renome de tabela ou
> reescrita de RLS.

## 1. Arquivos novos

| Arquivo | Tipo | O quê |
|---|---|---|
| `supabase/migrations/0028_db1_indices_multitenant.sql` | migration aditiva | 11 índices `CREATE INDEX IF NOT EXISTS` em FKs multi-tenant / joins de RLS |
| `scripts/reconciliar-ledger-0024-motor-progresso.sql` | script idempotente | reconcilia o nome `0022_motor_progresso` → `0024_motor_progresso` no ledger |
| `docs/auditoria/db1/*.md` | documentação | os 10 relatórios da DB1 |

## 2. Mudanças aplicadas ao banco remoto

| # | Ação | Destrutiva? | Verificação |
|---|---|---|---|
| 1 | `apply_migration 0028_db1_indices_multitenant` (11 índices aditivos) | **Não** | `unindexed_foreign_keys` 38→27; 222/222 testes verdes; idempotente (rodada 2× local) |
| 2 | Reconciliação do ledger (`0022_motor_progresso` → `0024_motor_progresso`) | **Não** (só metadado) | paridade repo↔ledger 28==28; guardado por `IF EXISTS/NOT EXISTS` |

> Ambas registradas no `supabase_migrations.schema_migrations` (a 0028 com
> seu próprio registro; a reconciliação como update de nome). Nenhuma
> linha de dado de aplicação foi tocada.

## 3. O que NÃO foi alterado (intacto)

- RLS de todas as 44 tabelas (nenhuma política removida/enfraquecida).
- `app.tenant_operacional()`, `app.eh_super_admin()`,
  `public.sou_super_admin()` e o bloqueio de escola suspensa (S1).
- `search_path`/grants de funções (já corretos desde S1).
- Dados reais/demo (nenhum insert/update/delete de aplicação).
- Frente sem `service_role` (confirmado).

## 4. Correções identificadas mas DELIBERADAMENTE adiadas (DB2)

| Item | Porquê adiado |
|---|---|
| De-duplicar `multiple_permissive_policies` (7 tabelas) | risco no caso `vinculos_responsaveis` (coordenação só lê pela política `FOR ALL`); exige reescrita cuidadosa + teste por papel — fora do "equivalência provada sem risco" da DB1 |
| Remover `unused_index` (9 pré-existentes) | sem prova de inutilidade permanente num banco de demo; reavaliar sob carga real |
| Índices nas 27 FKs restantes | baixo valor (colunas de auditoria/exam_tag/catálogos pequenos) |
| Consolidar par `lgpd_excluir/exportar` (app × public) | funciona e é seguro; consolidação é cosmética |
| Unificar "trilha semanal" × "trilha por concurso" | decisão de produto, não de banco |
| Confirmar/limpar tabelas Fase 15 vazias | precisa provar caminhos de escrita antes (regra: provar morte) |

## 5. Testes executados nesta fase

Ver `08-riscos-remanescentes.md` §Testes e o relatório final. Resumo:
**`npm run build` verde** e **222/222 testes** (lógicos + DB/RLS +
suspensão + backoffice + exam_tag) verdes, com a 0028 já aplicada e seeds
rodados 2× (idempotência).
