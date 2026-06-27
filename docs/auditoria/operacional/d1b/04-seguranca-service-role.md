# D1B — Segurança: service_role e Proteção de Credenciais

## Auditoria de service_role

### Localização do service_role

| Arquivo | Tem service_role? | Tipo |
|---------|-------------------|------|
| `supabase/functions/_shared/contexto.ts` | ✅ | Servidor (Edge Function) — correto |
| `supabase/functions/backoffice-coordenador/index.ts` | Derivado de `contexto.ts` | Servidor — correto |
| `supabase/functions/provisionar-aluno/index.ts` | Derivado de `contexto.ts` | Servidor — correto |
| `app/src/**` | ❌ NUNCA | Front-end — correto |
| `app/src/lib/supabase.js` | ❌ | Usa apenas `anon` key |

### Verificação no código front

```bash
grep -r "SERVICE_ROLE\|service_role" app/src/
# Resultado: sem matches — correto
```

---

## Camada de autenticação de operadores

### Fluxo de validação na Edge Function

```typescript
async function superAdmin(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await admin.auth.getUser(token); // verifica o JWT real
  const { data: ia } = await admin
    .from("internal_admins")
    .select("auth_user_id, ativo")
    .eq("auth_user_id", data.user.id)
    .eq("ativo", true)
    .maybeSingle();
  if (!ia) return null; // não é admin ativo
  return { id: data.user.id, email: data.user.email };
}
```

**Duas camadas de validação:**
1. JWT válido (verificado pelo Supabase Auth)
2. `internal_admins.ativo = true` (verificado no banco)

### RPCs com porteiro

Toda RPC no banco que lida com dados cross-tenant usa:
```sql
if not app.eh_super_admin() then
  raise exception 'acesso negado: somente super_admin' using errcode = '42501';
end if;
```

---

## Proteção de senhas

### O que nunca acontece

- ❌ Senha hardcoded no código
- ❌ Senha em variável de ambiente do front
- ❌ Senha retornada pela API
- ❌ Senha logada em console
- ❌ Senha enviada por texto puro

### O que acontece

- ✅ Senha aleatória gerada no servidor (Edge Function)
- ✅ Senha descartada imediatamente após criação do usuário
- ✅ Link de reset enviado para o e-mail do coordenador
- ✅ Coordenador define a própria senha pelo link

### Geração de senha aleatória (servidor)

```typescript
function senhaAleatoria(): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("") + "Aa1!";
}
```

---

## RLS intacta

### Políticas críticas verificadas

- `app.tenant_operacional()` — bloqueio de escola suspensa/cancelada: **intacta**
- `internal_admins` — só super_admin lê: **intacta**
- `admin_logs` — só super_admin lê e insere: **intacta**
- Isolamento multi-tenant (`app.tenant_id()`): **intacto**

### Nova coluna `usuarios.email`

- Campo opcional (nullable)
- Não exposto por RLS diferente — políticas existentes continuam cobrindo
- Acessível pela coordenação da mesma escola (como os outros campos de `usuarios`)
- Preenchido pelo servidor (Edge Function) — não pelo usuário direto

---

## Logs de auditoria cobrindo D1B

| Ação | Registrada em | Inclui |
|------|--------------|--------|
| Criar escola | `admin_logs` via RPC | nome, slug, status_inicial |
| Editar escola | `admin_logs` via RPC | antes/depois completo |
| Vincular coordenador | `admin_logs` via Edge Function | nome, email, conta_nova |
| Reenviar acesso | `admin_logs` via RPC `backoffice_registrar_reenvio` | usuario_id, nome, email |
| Alterar status | `admin_logs` via RPC | de, para |

**O que NUNCA entra no log:** senha, token, hash de senha.
