# DB2-G — Runbook de migrations

> Este item entrega o runbook operacional para evitar que o operador use
> o comando errado em migrations. O documento completo vive em:
>
> **`docs/operacao/runbook-migrations-supabase.md`**

## Resumo do que o runbook cobre

1. **Regra de ouro:** **não usar `supabase db push` cegamente** — os
   arquivos usam prefixo `000N` (não timestamp); `db push` tentaria
   reaplicar tudo. Deploy é via MCP `apply_migration`/pipeline.
2. **Comparar local × remoto:** `scripts/checar-migrations.mjs`
   (paridade por NOME; exit 1 = falta migration; acusa drift).
3. **Validar o ledger:** `select version, name from
   supabase_migrations.schema_migrations order by version`.
4. **Aplicar migration segura:** próximo número contínuo, DDL idempotente,
   testar em `reset-db.sh` + suíte, aplicar via `apply_migration` com
   `name` == nome do arquivo, rodar `get_advisors`, conferir paridade.
5. **Numeração diferente / aplicada sob outro nome:** procedimento de
   **reconciliação não destrutiva** do ledger (caso real
   `0022_motor_progresso` → `0024_motor_progresso`), só metadado, e
   somente após provar que o schema já está aplicado.
6. **Checklist antes/depois** + **rollback básico** (reverter com nova
   migration inversa; nunca editar migration aplicada).
7. **Quem pode executar:** dono/operador com credencial de serviço;
   nunca `service_role` no front; super admin opera via RPC `backoffice_*`.

## Por que isso importa (contexto)

A guarda de paridade chegou a ficar **vermelha por falso negativo** (o
motor de progresso aplicado sob nome `0022` e versionado como `0024`),
mascarando drift real — exatamente a "armadilha de `db push`". A DB1
reconciliou; este runbook impede a recorrência.
