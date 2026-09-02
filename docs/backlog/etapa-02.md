# Backlog — Etapa 2 (Inventário e posse profissional da infraestrutura)

**Atualizado em:** 02/09/2026

---

## BKL-001: Ambiguidade dos projetos Supabase restaurados

- **Frente:** engenharia
- **Responsável:** Gabriel
- **Prioridade:** Baixa
- **Estado:** concluído
- **Evidência:** três projetos na organização `ddsfpmyxbitaghvhadov`. `bdjkgrzfzoamchdpobbl` ("Teste e Vitrine", `us-east-1`, ACTIVE_HEALTHY) é o único ligado ao Rumo. `barbearia-saas` (INACTIVE) e `pool-poker` (ACTIVE_HEALTHY) não têm relação com o Rumo. Não existe projeto do GrinderBank aqui.

## BKL-006: Papel da organização Supabase nova (`eerbpzacxolwlwsltynb`)

- **Frente:** engenharia
- **Responsável:** Gabriel
- **Prioridade:** Baixa
- **Estado:** concluído
- **Evidência:** organização sem nenhum projeto criado ainda. Ver ADR-0001: reservada para produção dedicada, só populada após o Gate G2.

## BKL-003: Fonte da "auditoria independente de 25/08"

- **Frente:** engenharia
- **Responsável:** Gabriel
- **Prioridade:** Baixa
- **Estado:** validado
- **Evidência:** documento fornecido por Gabriel (`auditoria-rumo-aprovacao-2026-08-25.md`). Confirma "558 passaram, 0 falharam, 0 pulados, 69 arquivos de teste, ~3,5s", auditado no commit `8c8a808`.
- **Resíduo (baixo esforço):** o arquivo ainda não está commitado em `docs/auditoria/` no repositório.

## BKL-004: Achados de segurança do banco (SECURITY DEFINER e Auth)

- **Frente:** engenharia
- **Responsável:** técnico (Opus, conforme papéis do plano)
- **Prioridade:** Média
- **Prazo:** antes do Gate G3
- **Estado:** concluído (migration mergeada em `main`, PR #85, squash `fe2d053`)
- **Evidência:**
  - Funções `backoffice_*`, `resumo_escola`, `salvar_onboarding_aluno`: guarda interna correta (`eh_super_admin()`), confirmado nas migrations 0019/0021/0025/0032. Aviso do linter é ruído, sem ação necessária.
  - `rls_auto_enable()` + event trigger `ensure_rls`: migration `0045` criada, testada por idempotência, aplicada no projeto de teste. **Verificado de forma independente em 02/09:** `list_migrations` mostra as 45 entradas incluindo a 0045; consulta direta a `supabase_migrations.schema_migrations` confirma 45 linhas, sem resíduo; o event trigger `ensure_rls` está ativo e aponta pra `rls_auto_enable`. PR #85 mergeado em `main` (squash `fe2d053`) — o repositório agora reflete o banco.
  - Proteção contra senha vazada (HaveIBeenPwned) segue desligada no Auth, toggle simples pendente.
