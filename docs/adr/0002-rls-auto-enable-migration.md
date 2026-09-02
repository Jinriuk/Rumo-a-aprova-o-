# ADR-0002: `rls_auto_enable` vira migration formal

**Data:** 02/09/2026
**Etapa:** 2

## Contexto
A função `rls_auto_enable()` e o event trigger `ensure_rls` (auto-ativa RLS em toda tabela nova criada em `public`) existem ativos no banco `bdjkgrzfzoamchdpobbl`, mas não existem em nenhuma migration do repositório. Confirmado via consulta direta ao Postgres em 02/09.

## Decisão
Commitar `rls_auto_enable()` + `ensure_rls` como migration `0045`, antes de criar qualquer produção nova a partir das migrations.

## Consequência
A rede de segurança que auto-ativa RLS em tabelas novas passa a ser reproduzível a partir do repositório. Sem essa migration, uma produção nova criada do zero perderia essa proteção silenciosamente.
