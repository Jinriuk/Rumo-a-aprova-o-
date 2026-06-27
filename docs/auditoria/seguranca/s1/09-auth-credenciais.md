# S1.8 — Auth, senha e credenciais

## Modelo de acesso (revisão)
- **Aluno / responsável**: entram com **código** provisionado pela escola
  (`<codigo>@codigo.acesso.local`). Não há e-mail real nem senha digitada
  por eles — a credencial é o código.
- **Coordenação**: e-mail + senha. Conta criada por Edge Function
  (`backoffice-coordenador`) com **senha aleatória descartável**; a
  pessoa define a própria senha por **link de recuperação**. A senha
  nunca é fixa nem devolvida na resposta.
- **Super_admin (operador)**: identidade em `internal_admins` (não é
  `usuarios`). Promoção inicial por `app.registrar_super_admin(email)`
  (só `service_role`). Revogar acesso = `ativo=false`.

## Achado obrigatório: Leaked Password Protection DESABILITADO
Advisor `auth_leaked_password_protection` (WARN): a checagem de senhas
vazadas (HaveIBeenPwned) está **desligada**. Como a coordenação define a
própria senha, isso deve ser **ligado** antes do piloto.

### Como ligar (toggle de painel — ação do dono)
Supabase → **Authentication → Policies / Password** →
**Enable "Leaked password protection"**. Opcional e recomendado no mesmo
lugar: exigir comprimento/força mínima de senha.

> Não foi possível alternar por código: o ferramental MCP de Supabase
> não expõe configuração de Auth. Documentado como ação de painel.

## Checklist de auth antes de dado real
Detalhado em `docs/operacao/auth-credenciais-checklist.md`. Itens:
- [ ] Leaked password protection **ON** (acima).
- [ ] Política de senha (força mínima) definida.
- [ ] Fluxo de **recuperação de senha** da coordenação testado ponta a
      ponta (SMTP configurado ou provedor de e-mail do Supabase).
- [ ] Rotação documentada da senha do **operador/super_admin**.
- [ ] Confirmar que o super_admin inicial existe e está `ativo`
      (`internal_admins`) e que há um segundo operador de contingência.

## Estado
- Modelo de credenciais: ✅ sólido (sem senha hardcoded, sem
  `service_role` no front, senha de coordenação autodefinida).
- Leaked password protection: ⚠ **P1** — ligar no painel.
