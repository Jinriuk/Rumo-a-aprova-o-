# S1.10 — Supabase advisors, policies e Edge Functions

## Advisors de SEGURANÇA

### Corrigido nesta fase
- `function_search_path_mutable` em `app.xp_por_prioridade` e
  `app.xp_simulado` → **fechado** (migration 0026, `set search_path=''`).
  Eram as 2 únicas funções sem `search_path` fixo. Agora: **0**.

### Revisado e aceito (por design)
- `authenticated_security_definer_function_executable` (**8** funções):
  `backoffice_*`, `resumo_escola`, `sou_super_admin`. Todas têm porteiro
  interno (`eh_super_admin()` ou `tenant_id()`+papel+`tenant_operacional`).
  Precisam de `EXECUTE` por `authenticated` para o produto funcionar.
  **Sem ação** — detalhado em `03-backoffice-rpc-hardening.md`.

### Pendência de painel (não-código)
- `auth_leaked_password_protection` **desabilitado** → ligar no painel
  (S1.8, `09-auth-credenciais.md`). Não há ferramenta de API no nosso
  ferramental para alternar; é toggle do dono.

## Advisors de PERFORMANCE (todos INFO/WARN, nenhum bloqueador)
- `unindexed_foreign_keys` (INFO, ~36): FKs sem índice de cobertura.
  Maioria em tabelas de catálogo (baixo volume) e colunas `*_por`
  (auditoria, raramente filtradas). As colunas quentes de multitenancy
  (`escola_id`, `aluno_id`, `data`) **já têm** índices dedicados
  (migrations 0016/0023). **Aceito** para a escala de piloto; revisitar
  em DB1 se algum plano de consulta acusar.
- `unused_index` (INFO, ~9): índices ainda não exercitados (banco de
  demo, pouco tráfego). **Aceito** — remover seria prematuro.
- `multiple_permissive_policies` (WARN, 7): tabelas com a política da
  coordenação + a política do próprio dono no mesmo `SELECT`. É **o
  desenho da matriz do Doc 6** (dois caminhos de acesso distintos); o
  custo é marginal na escala de piloto. **Aceito e documentado**; uma
  unificação é candidata a DB1.

## Edge Functions
Inventário (`supabase/functions/`):

| Função | Papel | Segurança |
|---|---|---|
| `_shared` | contexto/cors/admin client | usa `service_role` **só no servidor** |
| `gerar-meta` | motor (gera meta) | server-side |
| `virar-semana` | motor (cron semanal) | server-side |
| `provisionar-aluno` | cria credencial de aluno | server-side, valida quem chama |
| `lgpd-titular` | exportar/excluir (LGPD) | server-side, confirmação no front |
| `backoffice-coordenador` | provisiona coordenação (D0.7) | valida **token real** + `internal_admins.ativo`; senha **aleatória/descartável**; link de recuperação; grava `admin_logs` |

Revisão de `backoffice-coordenador` (a mais sensível): identifica o
super_admin pelo **token** (não por campo de formulário), confirma
`ativo=true`, nunca devolve senha, é idempotente (e-mail existente é
revinculado) e registra a ação. ✅ Coerente com a doutrina.

Nenhuma Edge Function expõe `service_role` ao cliente — ele vive só no
runtime da função.

## Conclusão
Advisors de segurança: **só restam os aceitos-por-design + 1 toggle de
painel**. Nenhum P0. Performance: tudo INFO/WARN aceitável para piloto,
com candidatos anotados para DB1.
