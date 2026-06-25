# SEG1-F — RLS e Isolamento Básico

**Fase:** SEG1 — Segurança Operacional Imediata
**Data:** 2026-06-25

> **Regra respeitada:** nenhuma política RLS foi afrouxada nesta fase. Nenhuma
> migration foi criada. Os testes foram executados contra a base **sem** alterar
> políticas para "passar".

---

## 1. Postura de RLS no projeto ativo

Verificação read-only (`pg_class` no projeto `bdjkgrzfzoamchdpobbl`): **as 45 tabelas
do schema `public` têm `row level security` ATIVADA**. Amostra das críticas:

`alunos`, `usuarios`, `vinculos_responsaveis`, `metas`, `registros_estudo`,
`simulados`, `consentimentos`, `escolas`, `config_escola`, `logs_acesso`,
`logs_coordenacao`, `admin_logs`, `internal_admins`, `turmas`, `alunos_turmas` — **todas com RLS = true**.

Nenhuma tabela de `public` ficou sem RLS.

---

## 2. Testes executados (Postgres real, identidade `authenticated` + claims JWT)

Suíte completa rodada localmente contra Postgres 16 com as migrations `0001–0032` +
seeds aplicados 2× (idempotência):

```
# tests 341
# pass  341
# fail  0
# suites 16
```

A suíte assume a **identidade real** (papel `authenticated` + claims `escola_id`/`papel`
no JWT — o mesmo que o Supabase entrega à RLS), não o `service_role`.

### 2.1 Casos de isolamento (`tests/isolamento.test.mjs`) — todos OK
| # | Caso | Resultado |
|---|------|-----------|
| 1 | Cada papel da escola A não lê nenhuma linha da escola B (todas as tabelas) | ✅ |
| 2 | Sentido inverso: coordenação B não lê nada da escola A | ✅ |
| 3 | Busca sem filtro: universo visível da coord. A só contém a escola A | ✅ |
| 4 | Registro `SEGREDO-ESCOLA-B` é invisível para todos da escola A | ✅ |
| 5 | Aluno A não escreve para aluno B (nem com `escola_id` forjado) | ✅ |
| 6 | Coordenação A não altera/apaga/cria nada na escola B | ✅ |
| 7 | Aluno B não lê meta/registro/simulado do Lucas (escola A) | ✅ |
| 8 | **Responsável B não enxerga aluno vinculado da escola A** | ✅ |
| 9 | Sem login (anon) não há acesso a tabela nenhuma | ✅ |
| 10 | Dentro da própria escola a matriz vale (aluno só vê a si; resp. só lê; coord. não escreve progresso) | ✅ |
| 11 | Aluno escreve o PRÓPRIO registro e atualiza a PRÓPRIA meta | ✅ |
| 12 | Conteúdo global (trilha) é legível pelas duas escolas e não gravável por nenhuma | ✅ |

### 2.2 Mapeamento aos testes mínimos exigidos pela SEG1-F
| Exigência SEG1-F | Coberto por | Resultado |
|------------------|-------------|-----------|
| Aluno só vê seus dados | isolamento #10/#11; `progresso-db`, `niveis-db` | ✅ |
| Responsável só vê aluno vinculado | isolamento #8/#10; `d1b-provisionamento` | ✅ |
| Responsável revogado não vê aluno | `hf2-provisionar-aluno.test.mjs` (revogação) + RLS de `vinculos_responsaveis` | ✅ |
| Responsável revinculado volta a ver | `hf2-provisionar-aluno.test.mjs` (re-vínculo `vincular-responsavel`) | ✅ |
| Coordenação só vê a escola dela | isolamento #1–#3; `coordenacao-acesso-db.test.mjs` | ✅ |
| Coordenação não vê outra escola | isolamento #2/#6 | ✅ |
| Superadmin usa backoffice próprio | `backoffice-db.test.mjs`; gate `eh_super_admin` | ✅ |
| Escola suspensa bloqueia acesso | `suspensao-db.test.mjs` (migration 0027) | ✅ |

---

## 3. Funções SECURITY DEFINER expostas a `authenticated` (advisor)

O Security Advisor lista 9 funções `SECURITY DEFINER` chamáveis por `authenticated`
(WARN, `0029_authenticated_security_definer_function_executable`):

`backoffice_criar_escola`, `backoffice_dashboard`, `backoffice_definir_status`,
`backoffice_detalhe_escola`, `backoffice_editar_escola`, `backoffice_escolas`,
`backoffice_registrar_reenvio`, `sou_super_admin`, `resumo_escola`.

**Avaliação: esperado e aceito por design — não é vulnerabilidade.**
- As funções `backoffice_*` **precisam** ser chamáveis por `authenticated` (o super
  admin é um usuário autenticado), e **cada uma** tem o porteiro interno
  `if not app.eh_super_admin() then raise exception 'acesso negado' using errcode='42501'`.
  Verificado nas migrations `0021`, `0025`, `0032` — gate presente em **todas**.
- `sou_super_admin()` é projetada para qualquer logado perguntar (retorna `false` para
  não-admin) — é como o front decide mostrar o backoffice.
- `resumo_escola()` é o agregado da própria escola, confinado por tenant.

**Não alteradas na SEG1:** trocar para `SECURITY INVOKER` quebraria o backoffice
cross-tenant por design; mexer exigiria relatório de risco (regra 9). Documentado como
**aceito com justificativa**; reavaliar em SEG2/PR1 se quiser revogar `EXECUTE` de
`public` mais granularmente (já há `revoke … from public` nas principais).

---

## 4. Lacunas / riscos pendentes

| ID | Sev | Item | Status |
|----|-----|------|--------|
| F-1 | OK | RLS ativa em 100% das tabelas `public`; 341 testes verdes | Confirmado |
| F-2 | Aceito | 9 SECURITY DEFINER com gate interno (advisor WARN) | Aceito c/ justificativa |
| F-3 | SEG2 | Teste de "escola suspensa bloqueia" coberto em DB; faltam massas E2E ao vivo | SEG2/QA2 |

**Veredito SEG1-F:** isolamento multi-tenant **íntegro e provado** (RLS + 341 testes).
**Nenhuma política foi enfraquecida. Critério "RLS não enfraquecida" — ATENDIDO. Nenhum P0/P1.**
