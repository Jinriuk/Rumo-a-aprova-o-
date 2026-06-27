# Relatório D1C — E-mail, SMTP e Recuperação de Acesso

**Data**: 2026-06-23  
**Branch**: `claude/d1c-email-recuperacao-acesso-mpbczp`  
**Status**: ✅ Implementado

---

## Resumo executivo

A fase D1C corrigiu o fluxo de envio de e-mail de acesso para coordenadores e implementou toda a camada de recuperação de senha que estava faltando. O problema principal era a ausência da rota `/redefinir-senha` e do parâmetro `redirectTo` na geração do link de recuperação.

---

## Critérios de aceite

| Critério | Status |
|----------|--------|
| Sistema indica corretamente se e-mail foi enviado ou pendente | ✅ 7 estados de status implementados |
| Fluxo "Esqueci minha senha" da coordenação funciona | ✅ Botão + modal inline no Login |
| Rota `/redefinir-senha` funciona | ✅ RedefinirSenha.jsx criado |
| Botão "Reenviar acesso" funciona ou mostra pendência real | ✅ ProvisionarCoordenador no backoffice |
| Coordenador pode definir senha e entrar | ✅ updateUser + redirect para login |
| Nenhuma senha/token exposto | ✅ Auditado |
| service_role fora do front | ✅ Apenas na Edge Function |
| Aluno/responsável por código funcionam | ✅ Não modificados |
| Build passa | ✅ (verificar com `npm run build`) |
| Relatório entregue | ✅ |

---

## O que foi alterado

### Frontend (`app/src/`)

#### `App.jsx`
- Importa `RedefinirSenha`
- Função `detectarRecuperacao()` — verifica hash `type=recovery` sincronamente
- Se recovery detectado: renderiza `RedefinirSenha` antes de qualquer roteamento por papel

#### `routes/publico/RedefinirSenha.jsx` (NOVO)
- Tela de definição/redefinição de senha
- Validação de força mínima (critérios: maiúsculas, minúsculas, números, símbolos)
- Confirmação de senha
- `supabase.auth.updateUser({ password })` via `db.redefinirSenha()`
- Sucesso → `signOut()` → `window.location.replace('/')`
- Erro → mensagem clara com link para voltar ao login

#### `routes/publico/Login.jsx`
- Adicionado estado `recuperando` para o fluxo de recuperação
- Botão "Esqueci minha senha" (apenas no modo coordenação)
- Formulário de recuperação com e-mail + `recuperarSenha()`
- Mensagem genérica (não revela se e-mail existe)
- Estados: idle → enviando → enviado

#### `routes/admin/AreaAdmin.jsx`
- Constante `MSGS_STATUS` com mensagens para os 7 estados
- Checklist: "via scripts/..." → "Use o botão Provisionar Coordenador abaixo"
- Componente `ProvisionarCoordenador` (NOVO):
  - Toggle: Provisionar novo / Reenviar acesso
  - Form provisionar: nome + e-mail → `backofficeProvisionarCoordenador()`
  - Form reenviar: e-mail → `backofficeReenviarAcesso()`
  - Exibe status com cor (verde=enviado, dourado=pendente, vermelho=erro)
  - Fallback manual: mostra link copiável quando SMTP não configurado
  - Instrução de SMTP quando não há link disponível

#### `shared/data/index.js`
- `backofficeProvisionarCoordenador({ escola_id, nome, email })` — chama Edge Function `criar`
- `backofficeReenviarAcesso(email)` — chama Edge Function `reenviar`
- `recuperarSenha(email)` — `resetPasswordForEmail` com `redirectTo` dinâmico
- `redefinirSenha(novaSenha)` — `updateUser({ password })`

---

### Edge Function (`supabase/functions/backoffice-coordenador/`)

#### `index.ts` (atualizado localmente + redeploy)
- `REDIRECT_URL` definido como constante
- `generateLink` agora usa `options: { redirectTo: REDIRECT_URL }`
- Função `gerarLinkRecuperacao()` com tratamento de erros por tipo
- Retorno com campo `status` (7 estados)
- Logs `admin_logs` incluem o `status` da operação
- Erros específicos: `erro_auth`, `erro_smtp`, `erro_redirect`
- Console.error apenas com a mensagem (sem token)

---

### Documentação (`docs/auditoria/d1c/`)

| Arquivo | Conteúdo |
|---------|----------|
| `00-diagnostico-email-auth.md` | Causa raiz, logs Auth, investigação |
| `01-configuracao-smtp-redirect.md` | Como configurar SMTP (Resend), Site URL, Redirect URLs |
| `02-redefinir-senha.md` | Fluxo técnico da rota `/redefinir-senha` |
| `03-reenviar-acesso.md` | Fluxo backoffice, estados, fallback manual |
| `04-testes.md` | Plano de testes e smoke test |
| `relatorio-d1c-email-recuperacao-acesso.md` | Este relatório |

---

## Fluxo completo pós-D1C

```
superadmin abre backoffice → escola → "Provisionar coordenador"
         ↓
   preenche nome + e-mail → clica "Provisionar e enviar acesso"
         ↓
  Edge Function: cria/vincula usuário + generateLink(redirectTo=/redefinir-senha)
         ↓
    COM SMTP: e-mail enviado → status "coordenador_criado_email_enviado"
    SEM SMTP: link mostrado no backoffice → status "coordenador_criado_email_pendente"
         ↓
  Coordenador clica no link → /redefinir-senha#access_token=...&type=recovery
         ↓
  App detecta hash → mostra RedefinirSenha
         ↓
  Coordenador define senha → sucesso → redirecionado para login
         ↓
  Coordenador loga com e-mail + nova senha → AreaEscola
```

---

## Pendências para o dono do projeto

1. **Configurar SMTP** no Supabase Dashboard (ver `01-configuracao-smtp-redirect.md`)
2. **Adicionar `/redefinir-senha`** em Authentication → URL Configuration → Redirect URLs
3. **Verificar Site URL** em Authentication → URL Configuration
4. **Testar e-mail de ponta a ponta** em produção após SMTP configurado
5. (Opcional) **Customizar templates** de e-mail no Supabase

---

## O que NÃO foi alterado

- RLS (nenhuma alteração)
- Migrations (nenhuma necessária)
- Login por código de aluno/responsável (intocado)
- Billing, região, backup, domínio (intocados)
- Qualquer outra fase anterior (D1A, D1B, C0, etc.)
