# Checklist de Auth e credenciais (S1.8)

> Itens a confirmar **antes da primeira escola real**. A maioria são
> toggles de painel (decisão/execução do dono), não código.

## Senhas
- [ ] **Leaked Password Protection ON** — Authentication → Policies /
      Password → habilitar a checagem HaveIBeenPwned. (Advisor
      `auth_leaked_password_protection` está WARN hoje.)
- [ ] Política de **força mínima** de senha definida (comprimento etc.).

## Coordenação
- [ ] Fluxo de **recuperação de senha** testado ponta a ponta (a conta
      nasce com senha aleatória; a pessoa define a dela pelo link). Exige
      SMTP/provedor de e-mail configurado no Supabase.
- [ ] Confirmar que `backoffice-coordenador` gera o link de recuperação
      (ou que o operador envia o reset manualmente).

## Operador / super_admin
- [ ] Super_admin inicial existe e está `ativo` em `internal_admins`.
- [ ] Existe um **segundo operador** de contingência (não ficar com 1
      ponto único de acesso ao backoffice).
- [ ] Processo de **rotação de senha** do operador documentado.
- [ ] Revogação testada: `ativo=false` tira o acesso (a RPC
      `eh_super_admin()` passa a devolver false).

## Aluno / responsável
- [ ] Códigos de acesso são entregues pela escola por canal seguro (não
      versionados, não em e-mail aberto em massa).
- [ ] Confirmar que o login por código não dispara round-trip de
      super_admin (otimização já no `useSessao`).

## Princípios já garantidos no código (não precisam de ação)
- Sem senha hardcoded; senha da coordenação é autodefinida.
- Sem `service_role` no front.
- Papel/escola vêm do **token** (não forjável), espelhados pela RLS.
