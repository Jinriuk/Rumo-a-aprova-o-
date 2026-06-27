# D1C — Diagnóstico: E-mail e Auth (Recuperação de Acesso)

**Data**: 2026-06-23  
**Fase**: D1C — E-mail, SMTP e Recuperação de Acesso  
**Projeto**: Rumo à Aprovação (`bdjkgrzfzoamchdpobbl`)

---

## 1. Sintoma Relatado

> "O coordenador é criado/vinculado, mas o e-mail de acesso/redefinição de senha não está sendo enviado."

---

## 2. Investigação

### 2.1 Edge Function `backoffice-coordenador`

**Status**: ATIVA, versão 2  
**Último POST**: 200 OK (logs de 2026-06-23T13:45:54Z)

A função usa `admin.auth.admin.generateLink({ type: "recovery", email })`. Os logs de Auth confirmam que a chamada `/admin/generate_link` retornou **200** — o link foi gerado com sucesso.

**Problema identificado**: `generateLink` gera o link e *tenta* enviar o e-mail via provedor configurado, mas:
1. O campo `options.redirectTo` **não estava configurado** — o link gerado apontava para a URL padrão do Supabase, não para `/redefinir-senha`.
2. O provedor de e-mail **padrão do Supabase** (built-in) tem limite de **2 e-mails por hora** no plano free/standard.
3. A função retornava o estado `{ ok: true, link }` sem distinguir "enviado" de "pendente".

### 2.2 Logs de Auth (últimas 24h)

| Ação | Resultado |
|------|-----------|
| `user_signedup` (service_role) | ✅ 200 — usuário criado |
| `user_recovery_requested` (`/admin/generate_link`) | ✅ 200 — link gerado |
| Login coordenador (`/token`) | ✅ 200 — funciona |
| Login aluno por código (`/token`) | ✅ 200 — funciona |

→ O Auth em si está funcional. O problema é **entrega do e-mail**, não geração do token.

### 2.3 Configuração Auth / Site URL / Redirect URLs

- **Site URL**: não verificado via API (configurado via dashboard Supabase)
- **redirectTo na função**: ❌ ausente antes da D1C
- **redirectTo esperado**: `https://rumo-a-aprova-o.vercel.app/redefinir-senha`

### 2.4 SMTP

- **SMTP externo**: ❌ não configurado
- **Provedor atual**: Supabase built-in (InBucket / Mailpit em dev, provedor limitado em prod)
- **Limite**: ~2 e-mails/hora por projeto no plano padrão
- **Verificar**: Supabase Dashboard → Authentication → Email → SMTP Settings

### 2.5 Rota `/redefinir-senha`

- ❌ **Não existia** no front antes desta fase
- O `vercel.json` já tem `"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]` — a rota será servida corretamente após criar o componente

### 2.6 Templates de E-mail

- Templates não customizados no Supabase — usa o padrão (funcional, mas sem branding)
- O link no template aponta para a URL padrão do Supabase sem `redirectTo` configurado

### 2.7 Verificação de Spam

- E-mails do Supabase built-in podem cair em spam por não ter SPF/DKIM próprio
- Com SMTP externo (Resend, SendGrid), a entregabilidade melhora significativamente

---

## 3. Causa Raiz

**Primária**: `generateLink` não tinha `options.redirectTo` configurado → o link gerado redirecionava para a URL padrão do Supabase, não para `/redefinir-senha`.

**Secundária**: A rota `/redefinir-senha` não existia no frontend → mesmo se o coordenador recebesse o e-mail, a tela para definir a senha não existia.

**Terciária**: SMTP externo não configurado → dependência do provedor built-in com limite de 2/hora.

---

## 4. Correções Aplicadas na D1C

1. ✅ `generateLink` agora usa `options.redirectTo: "https://rumo-a-aprova-o.vercel.app/redefinir-senha"`
2. ✅ Rota `/redefinir-senha` criada (`RedefinirSenha.jsx`)
3. ✅ App.jsx detecta hash `type=recovery` e mostra a tela de redefinição
4. ✅ Edge Function retorna `status` detalhado (7 estados definidos)
5. ✅ Backoffice exibe link manual quando SMTP não está configurado
6. ✅ "Esqueci minha senha" adicionado ao login de coordenação
7. ✅ `resetPasswordForEmail` usa `redirectTo` dinâmico (origin do app)

---

## 5. Pendências Pós-D1C

- [ ] Configurar SMTP externo (Resend recomendado — free tier generoso, SPF/DKIM incluídos)
- [ ] Configurar Site URL e Redirect URLs no Supabase Dashboard
- [ ] Customizar templates de e-mail com branding do projeto
- [ ] Testar entrega em produção após configurar SMTP

---

## 6. Referências

- Supabase Auth Admin API: `/admin/generate_link`
- Supabase Auth: `resetPasswordForEmail`
- `supabase/functions/backoffice-coordenador/index.ts`
- `app/src/routes/publico/RedefinirSenha.jsx`
- `app/src/routes/publico/Login.jsx`
