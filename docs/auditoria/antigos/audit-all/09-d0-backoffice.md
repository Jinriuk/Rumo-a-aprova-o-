# D0 — Backoffice interno / superoperador

## 7.1 Promessa da fase
Operar escolas **sem entrar no Supabase**: rota `/admin-interno` com gate, `internal_admins`, `admin_logs`, dashboard, listar/detalhar/criar/editar escola, status/plano, suspender/ativar/cancelar, coordenador principal via Edge Function, RPCs com porteiro, logs, RLS intacta, **sem `service_role` no front**, superadmin registrado.

## 7.2 Evidência no código
- `supabase/migrations/0025_backoffice_d0.sql` (aditiva/idempotente, anon revogado).
- `app/src/routes/admin/AreaAdmin.jsx` + `App.jsx` (`ROTA_ADMIN = "/admin-interno"`, gate `souSuperAdmin()` → tela “Acesso restrito”).
- `data/index.js`: `souSuperAdmin`, `backofficeEscolas`, `backofficeEditarEscola`, provisionamento de coordenação via Edge Function (comentários afirmam “sem `service_role` no front”).
- `supabase/functions/backoffice-coordenador/index.ts`.
- `tests/backoffice-db.test.mjs`.

## 7.3 Evidência no ambiente (Supabase remoto)
- **Migration `0025_backoffice_d0`**: aplicada ✅ (em `list_migrations`).
- **Edge Function `backoffice-coordenador`**: **ACTIVE**, `verify_jwt = true` ✅.
- **RPCs** (confirmadas pelo advisor como SECURITY DEFINER existentes): `backoffice_dashboard`, `backoffice_escolas`, `backoffice_detalhe_escola`, `backoffice_criar_escola`, `backoffice_editar_escola`, `backoffice_definir_status`, `sou_super_admin`.
- **`internal_admins`**: 1 linha — `gabrielpecanha103@gmail.com`, **`ativo = true`**, **tem conta no Auth**, **tem senha**, **`last_sign_in_at = 2026-06-20 17:03`**. → **superadmin operacional e já autenticado.**
- **`/admin-interno` gate**: presente em `App.jsx` (não-admin → “Acesso restrito”).
- **Sem `service_role` no front**: confirmado (só comentários em `app/`; a chave vive na Edge Function).
- **RLS**: tabelas tenant-scoped seguem com RLS; advisor sem ERROR.

## 7.4 O que foi realmente entregue
O ciclo operacional D0 está **instalado no ambiente real**: migration aplicada, Edge Function ativa, RPCs presentes, rota com gate, superadmin registrado **com senha e login efetivo**. A operação “sem entrar no Supabase” é possível.

## 7.5 O que não foi entregue / não exercitado
- **`admin_logs` = 0 linhas.** Nenhuma ação de backoffice (criar/editar/suspender) foi registrada em produção — o superadmin logou, mas **o caminho de escrita/auditoria do backoffice não foi exercitado em prod**. Cobertura existe em teste (DB), não em uso real. A validação manual da §12 do briefing D0 segue **pendente**.
- **Suspensão é só status** (campo + bloqueio da tela do backoffice); **não há bloqueio global de login** para escola suspensa — o aluno/coordenação de uma escola “suspensa” ainda conseguiria entrar (campo pronto, efeito não implementado).

## 7.6 Divergências
- **A favor:** o relatório D0 lista “pendência operacional de senha do superadmin”. **Já está resolvida** — o superadmin tem senha e `last_sign_in` real (2026-06-20 17:03).
- As duas escolas (`vitrine`, `beta`) estão com `status = implantacao` e `plano = null` — nenhuma marcada `demo`/`piloto`/`ativa`. Cosmético, mas note-se que o status ampliado da 0025 não está sendo usado para diferenciar a vitrine.

## 7.7 Riscos
- **P2** — `admin_logs` vazio: a trilha de auditoria do backoffice nunca gravou em prod; validação manual pendente.
- **P2** — Suspensão sem bloqueio global de login (efeito incompleto).
- **P2** — RPCs `SECURITY DEFINER` do backoffice executáveis pelo papel `authenticated` (advisor) — autogated por `eh_super_admin`, mas o advisor recomenda revogar `EXECUTE`/endurecer (S1).
- **P3** — E2E do backoffice depende de conta super_admin no ambiente E2E (inexistente).
- **P3** — Lista de escolas sem busca/paginação (ok no volume atual: 2 escolas).

## 7.8 Decisão da fase
**Aprovada com ressalvas.** A D0 está instalada e o superadmin operacional (com senha/login). As ressalvas são de **exercício/endurecimento**: o caminho de escrita+auditoria não foi usado em prod (admin_logs=0), a suspensão é incompleta, e os advisors pedem endurecimento das RPCs — tudo material de validação-manual + S1.
