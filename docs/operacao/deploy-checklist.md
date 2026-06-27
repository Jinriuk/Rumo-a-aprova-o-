# Checklist de deploy (Fase 17.1)

> Regra de ouro: **migration primeiro, front depois** sempre que o front
> novo depender de algo novo no banco (tabela, coluna, RPC). Foi a
> inversão disso que deixou produção 9 migrations atrás e quebrou o
> painel da coordenação quando o front passou a chamar `resumo_escola()`.

## Antes de publicar

1. **Conferir paridade banco × repo:**
   ```bash
   SUPABASE_DB_URL="postgresql://postgres:SENHA@HOST:5432/postgres" \
     node scripts/checar-migrations.mjs
   ```
   (ou `cd tests && node ../scripts/checar-migrations.mjs`). A string de
   conexão sai do painel do Supabase (Project → Database) e **nunca**
   entra no repositório. Se o script sair com erro (faltam migrations),
   **pare**: aplique as migrations antes de seguir.

2. **Aplicar migrations pendentes** (em ordem, `0001` → `NNNN`):
   - via Supabase CLI: `supabase db push`;
   - ou aplicando cada `supabase/migrations/NNNN_*.sql` no projeto.
   Rode `checar-migrations.mjs` de novo: tem de dizer "banco em dia".

3. **Conferir os advisors** (Supabase → Advisors, ou MCP `get_advisors`):
   sem ERROR de segurança; WARNs conhecidos documentados.

4. **CI verde** no PR: `build-e-unitarios` e `e2e` (ou e2e flaky
   documentado e isolado — ver Fase 17.2).

5. **Publicar o front** (merge → deploy Vercel). Só agora.

## Ordem de deploy (quando o front depende do banco)

```
migration (banco)  ─►  checar-migrations (em dia)  ─►  merge/front (Vercel)
```

Nunca publicar o front antes da migration que ele exige.

## Variáveis e segredos

- Front (Vercel / `app/.env.production`): só `VITE_SUPABASE_URL` e
  `VITE_SUPABASE_ANON_KEY` (públicas por design — a segurança é a RLS).
- `SUPABASE_SERVICE_ROLE_KEY` / string de conexão do banco: só na máquina
  do operador e no servidor (Edge Functions). **Nunca** no repositório
  nem no front.

## Política de rollback

- **Migrations são aditivas e idempotentes** (`create ... if not exists`,
  `add column if not exists`, blocos `do $$` guardados). Reaplicar é
  seguro.
- **Reverter schema** é a exceção, não a regra: escreva uma migration
  nova que desfaz (ex.: `drop ... if exists`) em vez de editar/apagar uma
  migration já aplicada — o histórico é append-only.
- Antes de uma migration sensível (que apaga/transforma dado), **faça um
  export/backup** do banco (ver Fase 17.6).
- O front pode voltar a um deploy anterior na Vercel a qualquer momento;
  isso **não** desfaz migrations — por isso migrations só aditivas.

## Estado atual (referência)

- Projeto Supabase do front: `bdjkgrzfzoamchdpobbl` (rotulado "demo",
  região us-east-1 — ver Fase 17.3, pendente de mover para sa-east-1).
- Migrations no repo e aplicadas em produção: `0001`…`0018`.
- A função `resumo_escola()` é `SECURITY DEFINER` com a matriz tenant+papel
  explícita e EXECUTE só para `authenticated`/`service_role` (anon revogado).
