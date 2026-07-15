# Aplicação das migrations 0038–0044 no Supabase remoto

**Data:** 2026-07-15 · **Projeto:** `bdjkgrzfzoamchdpobbl` ("Rumo a Aprovação", us-east-1)
**Aplicadas por:** operação (via MCP `apply_migration`) · **Resultado:** ✅ paridade 44 == 44

## O que foi aplicado

As sete migrations do EST1 (A/B/C), na ordem, sobre o remoto que estava em `0037`:

| Migration | Bloco | Efeito |
|-----------|-------|--------|
| `0038_est1_estorno_progresso` | A1 | trigger de estorno no delete de simulados/registros |
| `0039_est1_virada_resiliente` | A2 | virada resiliente por aluno + FK `alunos.trilha_id` + heartbeat `virada_execucoes` |
| `0040_est1_meta_atividades_colunas` | A3 | UPDATE do aluno restrito a `estado`/`atualizado_em` (privilégio por coluna) |
| `0041_est1_indice_usuarios_email` | B1 | índice `usuarios.email` (backoffice sem varrer o Auth) |
| `0042_est1_higiene_advisor` | B2 | consolida policy duplicada de `aluno_missoes` + 12 índices de FK |
| `0043_est1_virada_saude` | B3 | `app.virada_saude()` + `public.backoffice_virada_saude()` |
| `0044_est1_credencial_opaca_fundacao` | C1/C2 | fundação da credencial opaca (hash, rotação, revogação, rate limit) — dormente |

## Ajuste necessário durante a aplicação (0044)

A `app.hash_codigo` usava `digest()` (pgcrypto) com `search_path = public, app`. No
**Supabase o pgcrypto vive no schema `extensions`** (no Postgres vanilla local ele
fica em `public`), então o `digest` não era encontrado e a 0044 **reverteu inteira**
(transacional — nada ficou pela metade). Correção: `search_path = public, app,
extensions` (schema inexistente é ignorado, funciona nos dois ambientes). A suíte
local seguiu 518/518 e a 0044 corrigida aplicou com sucesso. O arquivo do repo foi
atualizado para bater com o remoto.

## Verificação pós-aplicação (smoke test, sem tocar dado real)

- **Credencial opaca viva:** `public.resolver_codigo_acesso('...','...')` → `nao_encontrado`
  (tabela vazia; o `digest` resolve de ponta a ponta).
- **FK de trilha:** `alunos_trilha_id_fkey` presente (0 órfãos no remoto antes de aplicar).
- **Estorno:** 2 triggers (`trg_estorno_simulado`, `trg_estorno_registro`).
- **Heartbeat/saúde:** `app.virada_saude(26)` → "a virada nunca executou" (heartbeat vazio, correto).
- **Policy consolidada:** `aluno_missoes` com 1 policy de SELECT.
- **Índice de email:** `idx_usuarios_email` criado.
- **Dado real preservado:** 68 alunos, 54 simulados, 1002 eventos, 76 usuários — intactos.

## Estado dos advisors (pós-aplicação)

- **Segurança:** as 11 funções `SECURITY DEFINER` já conhecidas (backoffice/resumo,
  com porteiro `eh_super_admin`) + a nova `backoffice_virada_saude` (mesmo padrão
  gateado). As funções de credencial `*_codigo_acesso` **não** aparecem — concedidas
  só a `service_role`. Nenhuma classe nova de risco.
- **Performance:** o WARN de **policy permissiva duplicada em `aluno_missoes` foi
  eliminado** (B2). Os 12 índices novos aparecem como "unused" por serem recém-criados
  (resolve com o tráfego). Dois FKs novos sem índice (`acessos_codigo.escola_id`,
  `virada_execucoes.escola_id`) são INFO em tabelas minúsculas — deixados sem índice
  de propósito. `alunos.trilha_id` também segue sem índice (só usado por `is not null`
  na virada; lookup por valor é raro).

## Observações de operação

- Este é o projeto de **demo/piloto** (`us-east-1`). A recomendação do EST0 de um
  **projeto de produção dedicado em `sa-east-1`/Pro** (dado de menor no Brasil) segue
  válida — quando ele existir, aplicar a mesma série `0001…0044` do zero (o reset local
  prova que aplicam limpas e idempotentes).
- A credencial opaca está **dormente**: o login de produção segue por `password=codigo`.
  O corte é uma janela dedicada (spec em `docs/auditoria/est1/relatorio-est1-c-credencial-opaca.md`).
