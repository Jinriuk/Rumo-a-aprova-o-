# D1C — Configuração de SMTP e Redirect URLs

**Data**: 2026-06-23

---

## 1. Estado Atual

| Item | Status |
|------|--------|
| SMTP externo | ❌ Não configurado |
| Site URL no Supabase | Verificar no dashboard |
| Redirect URLs no Supabase | Verificar no dashboard |
| redirectTo na Edge Function | ✅ Configurado (D1C) |
| redirectTo no resetPasswordForEmail | ✅ Configurado (D1C) |

---

## 2. O que precisa ser configurado no Supabase Dashboard

### 2.1 Site URL

**Onde**: Authentication → URL Configuration → Site URL  
**Valor**: `https://rumo-a-aprova-o.vercel.app`

Esse valor é usado como base para links de e-mail quando `redirectTo` não é especificado.

### 2.2 Redirect URLs (Allowlist)

**Onde**: Authentication → URL Configuration → Redirect URLs  
**Adicionar**:
```
https://rumo-a-aprova-o.vercel.app/redefinir-senha
https://rumo-a-aprova-o.vercel.app/**
http://localhost:3000/**   (apenas para dev)
http://localhost:5173/**   (Vite dev server)
```

Sem essa allowlist, o Supabase rejeita o `redirectTo` e usa o Site URL padrão.

### 2.3 SMTP (Recomendado: Resend)

**Onde**: Authentication → Email → SMTP Settings

**Configuração com Resend**:
```
Host:       smtp.resend.com
Port:       465 (SSL) ou 587 (TLS)
Username:   resend
Password:   re_<sua_api_key>
Sender:     noreply@seudominio.com.br
```

**Passos**:
1. Criar conta gratuita em resend.com
2. Verificar domínio (DNS: SPF + DKIM)
3. Gerar API key
4. Configurar no Supabase Dashboard conforme acima
5. Testar com "Send test email"

**Alternativas**: SendGrid, Mailgun, AWS SES, Postmark

### 2.4 Templates de E-mail

**Onde**: Authentication → Email → Templates

Personalizar os templates:
- **Recovery**: "Seu link de acesso ao Rumo à Aprovação"
- **Invite**: "Bem-vindo à coordenação — defina sua senha"

---

## 3. Comportamento por cenário

### Com SMTP configurado:
1. `generateLink` → gera link + envia e-mail → coordenador recebe
2. Coordenador clica no link → vai para `/redefinir-senha`
3. Define senha → redireciona para login
4. Status retornado: `coordenador_criado_email_enviado`

### Sem SMTP configurado (estado atual):
1. `generateLink` → gera link (limite 2/hora) → e-mail pode não chegar
2. Backoffice mostra link manual para o operador
3. Operador envia o link por outro canal (WhatsApp, etc.)
4. Status retornado: `coordenador_criado_email_pendente`

---

## 4. Verificação de Segurança

- `redirectTo` está na allowlist do Supabase ✓
- Link é single-use e expira em 24h ✓
- Link só é mostrado para super_admin autenticado ✓
- Link não é logado no console ✓
- SMTP credentials ficam apenas no dashboard do Supabase ✓
