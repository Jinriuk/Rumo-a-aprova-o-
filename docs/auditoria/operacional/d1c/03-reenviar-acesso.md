# D1C — Reenviar Acesso no Backoffice

**Data**: 2026-06-23

---

## 1. Implementação

### Componente: `ProvisionarCoordenador` (em `AreaAdmin.jsx`)

Localizado em `DetalheEscola` — aparece ao abrir uma escola no backoffice.

**Dois modos (toggle)**:
1. **Provisionar coordenador** — cria ou revincula + envia link
2. **Reenviar acesso** — só gera e reenvia o link

### Fluxo "Provisionar":

```
Operador preenche nome + e-mail → clica "Provisionar e enviar acesso"
    ↓
db.backofficeProvisionarCoordenador({ escola_id, nome, email })
    ↓
Edge Function backoffice-coordenador (acao: "criar")
    ↓
1. Valida super_admin
2. Verifica se usuário existe no Auth
   - Existe: atualiza metadata
   - Não existe: cria com senha aleatória descartável
3. Upsert em `usuarios`
4. generateLink(type: "recovery", redirectTo: "/redefinir-senha")
5. Registra admin_logs
6. Retorna { ok, status, email, nome, conta_nova, link }
    ↓
Frontend exibe resultado com status e mensagem clara
```

### Fluxo "Reenviar acesso":

```
Operador informa e-mail do coordenador → clica "Reenviar acesso"
    ↓
db.backofficeReenviarAcesso(email)
    ↓
Edge Function backoffice-coordenador (acao: "reenviar")
    ↓
1. Valida super_admin
2. generateLink(type: "recovery", redirectTo: "/redefinir-senha")
3. Registra admin_logs
4. Retorna { ok, status, email, link }
    ↓
Frontend exibe resultado
```

---

## 2. Estados e mensagens

| Status | Mensagem ao operador |
|--------|----------------------|
| `coordenador_criado_email_enviado` | "Coordenador criado e link de acesso enviado para o e-mail." |
| `coordenador_criado_email_pendente` | "Coordenador criado, mas o envio de e-mail ainda precisa ser configurado no Supabase/Auth." |
| `coordenador_existente_reenvio_enviado` | "Acesso reenviado para o e-mail cadastrado." |
| `coordenador_existente_reenvio_pendente` | "Coordenador encontrado, mas o envio de e-mail ainda precisa ser configurado no Supabase/Auth." |
| `erro_auth` | "Erro de autenticação ao provisionar. Verifique os dados e tente novamente." |
| `erro_smtp` | "Erro de configuração de e-mail (SMTP). Contato com suporte necessário." |
| `erro_redirect` | "Erro na URL de redirecionamento. Verifique a configuração do Supabase." |

---

## 3. Fallback quando SMTP não configurado

Quando o status contém "pendente" e há um link disponível:

```
┌─────────────────────────────────────────────────────┐
│ LINK DE ACESSO MANUAL (uso único · expira em 24h)   │
│                                                      │
│ Envie este link para o coordenador por outro canal   │
│ (WhatsApp, e-mail direto, etc.)                      │
│                                                      │
│ [textarea com o link — selecionável]                 │
│ [Copiar link]                                        │
└─────────────────────────────────────────────────────┘
```

Quando status "pendente" mas sem link (erro total):
```
Para enviar e-mails automaticamente, configure o SMTP no painel do 
Supabase em: Authentication → Email → SMTP Settings
```

---

## 4. Segurança

- Link retornado apenas para super_admin autenticado (Bearer token validado na Edge Function)
- Link **não é logado** em console (regra D1C #8)
- Link é single-use no Supabase
- `service_role` permanece apenas na Edge Function ✓
- admin_logs registra toda ação de provisionamento ✓

---

## 5. Logs administrativos

Toda ação registra em `admin_logs`:
- `acao`: `"vincular-coordenador"` ou `"reenviar-acesso-coordenador"`
- `escola_id`: ID da escola (quando aplicável)
- `detalhe`: `{ nome, email, conta_nova, status }`
