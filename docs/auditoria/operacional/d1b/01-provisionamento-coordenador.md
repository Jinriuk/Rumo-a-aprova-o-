# D1B — Provisionamento de Coordenador pelo Backoffice

## Fluxo implementado

### Criar coordenador (novo)

1. Superadmin abre detalhe da escola no backoffice
2. Clica em "+ Criar coordenador" (seção "Coordenação")
3. Preenche nome e e-mail
4. Clica em "Criar acesso"
5. Front chama `backofficeProvisionarCoordenador()` → `supabase.functions.invoke("backoffice-coordenador", { body: { acao: "criar", ... } })`
6. Edge Function valida JWT como super_admin
7. Verifica se e-mail já existe em `auth.users`
8. Se não existir: cria usuário Auth com senha aleatória descartável
9. Atualiza/cria linha em `usuarios` com `email` incluído
10. Gera link de recuperação (reset password) via Auth admin API
11. Registra `admin_logs` com ação `vincular-coordenador`
12. Retorna `{ ok, email, nome, conta_nova, link }`
13. Front exibe mensagem confirmando (com ou sem SMTP disponível)
14. Checklist atualiza automaticamente ao recarregar

### Reenviar acesso

1. Superadmin vê coordenador na seção "Coordenação"
2. Clica em "↻ Reenviar acesso"
3. Front chama `backofficeReenviarAcesso()`:
   a. RPC `backoffice_registrar_reenvio` → admin_logs (trilha de auditoria)
   b. Edge Function com `acao: "reenviar"` → gera reset link
4. Front exibe confirmação

## Segurança

| Regra | Implementação |
|-------|---------------|
| `service_role` nunca no front | Edge Function detém a chave; front só tem o JWT do super_admin |
| Senha nunca exposta | Senha aleatória criada e descartada; coordenador define a própria |
| JWT validado pelo servidor | `superAdmin()` na Edge Function verifica o token real |
| Porteiro eh_super_admin | Toda RPC confirma o papel no banco |
| Log de auditoria | Toda ação sensível → `admin_logs` |
| Idempotência | E-mail existente é revinculado; não duplica |

## Diagrama

```
Front (navegador)
  │
  ├─ backofficeCriarEscola() → RPC backoffice_criar_escola [SECURITY DEFINER]
  │
  └─ backofficeProvisionarCoordenador()
       │
       └─ supabase.functions.invoke("backoffice-coordenador")
            │  [JWT do super_admin no header Authorization]
            │
            └─ Edge Function (Deno, server-side)
                 ├─ Valida JWT → confirma super_admin ATIVO
                 ├─ admin.auth.admin.createUser() [service_role]
                 ├─ admin.from("usuarios").upsert()
                 ├─ admin.auth.admin.generateLink({ type: "recovery" })
                 └─ admin.from("admin_logs").insert()
```

## Mensagens ao usuário

- **SMTP configurado:** "Coordenador criado. Um link de acesso/redefinição de senha foi enviado para o e-mail cadastrado."
- **SMTP não configurado:** "Coordenador criado. Configure o envio de e-mail no Supabase Auth para envio automático."
- **Reenvio:** "Link de redefinição de senha enviado (ou agendado). Verifique o SMTP no Supabase Auth."

## O que NÃO é feito (intencional)

- Não exibe a senha em nenhum momento
- Não envia senha por nenhum canal
- Não permite coordenação criar outro coordenador
- Não expõe `service_role` no navegador
- Não cria Auth user sem vínculo em `usuarios`
