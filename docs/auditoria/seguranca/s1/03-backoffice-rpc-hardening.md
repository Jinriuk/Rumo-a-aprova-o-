# S1.3 — Backoffice / RPC hardening

## Auditoria das RPCs `SECURITY DEFINER` expostas
Toda função `SECURITY DEFINER` no schema `public` foi revisada quanto a:
porteiro, `search_path`, e grants (`anon` revogado).

| RPC | Porteiro interno | `search_path` | `anon` | Veredito |
|---|---|---|---|---|
| `sou_super_admin()` | retorna `false` p/ não-admin | `public, app` | revogado (0020) | ✅ seguro por design |
| `backoffice_escolas()` | `eh_super_admin()` ou `raise` | fixo | revogado | ✅ |
| `backoffice_criar_escola(...)` | `eh_super_admin()` ou `raise` | fixo | revogado | ✅ |
| `backoffice_detalhe_escola(uuid)` | `eh_super_admin()` ou `raise` | fixo | revogado | ✅ |
| `backoffice_dashboard()` | `eh_super_admin()` ou `raise` | fixo | revogado | ✅ |
| `backoffice_editar_escola(...)` | `eh_super_admin()` ou `raise` | fixo | revogado | ✅ |
| `backoffice_definir_status(...)` | `eh_super_admin()` ou `raise` + valida status | fixo | revogado | ✅ |
| `resumo_escola()` | matriz por `tenant_id()`/papel + **`tenant_operacional()`** (S1.5) | fixo | só `authenticated` | ✅ |
| `app.registrar_super_admin(...)` | concedida **só** a `service_role` | fixo | n/a | ✅ |

### Sobre o advisor `authenticated_security_definer_function_executable`
O linter do Supabase marca **8** dessas funções como "signed-in users
can execute". **É esperado e seguro**: o front chama cada uma com o JWT
do próprio usuário, e a função decide por dentro:

- as `backoffice_*` levantam `acesso negado: somente super_admin` para
  quem não é super_admin (porteiro `eh_super_admin()`);
- `sou_super_admin()` devolve `false` para quem não é (é justamente a
  pergunta que o front faz para decidir a tela);
- `resumo_escola()` filtra por `tenant_id()` (não-forjável) + papel +
  `tenant_operacional()`.

Revogar `EXECUTE` de `authenticated` **quebraria** o produto (o
super_admin É um usuário autenticado; o painel da coordenação É
autenticado). Logo: **advisor revisado e aceito**, com justificativa.
Não há ação de código pendente.

## Provas ao vivo (rollback)
- super_admin: dashboard/criar/editar/status funcionam e gravam
  `admin_logs`.
- coordenação e anon: **barrados** em todas as `backoffice_*`
  (`acesso negado`).
- `anon` não executa nem `sou_super_admin()` (revogado).

Ver `04-validacao-d0.md` e `11-smoke-producao.md` para os números.

## Conclusão
As RPCs estão endurecidas e consistentes com a doutrina (porteiro +
`search_path` fixo + `anon` revogado + sem `service_role` no front). A
única função com `service_role` é `app.registrar_super_admin`, que é de
operador e nunca é exposta ao navegador.
