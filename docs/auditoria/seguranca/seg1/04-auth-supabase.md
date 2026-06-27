# SEG1-D — Supabase Auth e Proteção de Senha

**Fase:** SEG1 — Segurança Operacional Imediata
**Data:** 2026-06-25
**Projeto:** `bdjkgrzfzoamchdpobbl` (região `us-east-1`)

---

## 1. Modelo de autenticação (recapitulação)

| Papel | Como entra | Senha |
|-------|-----------|-------|
| Coordenação | e-mail + senha | define a própria via link de recuperação (`backoffice-coordenador`) |
| Super admin | e-mail + senha | conta interna (`internal_admins`), provisionada por script de operador |
| Aluno / responsável | **código** `XXXX-XXXX-XXXX` | o código É a credencial (aluno é menor: não cria conta, não administra senha — Doc 6, 1.1) |

O e-mail do aluno/responsável é sintético: `<codigo>@codigo.acesso.local`.

---

## 2. Estado verificado (read-only, projeto ativo)

| Item | Valor | Fonte |
|------|-------|-------|
| Total de contas Auth | 75 | `select count(*) from auth.users` |
| Aluno/responsável (por código) | 69 | filtro `@codigo.acesso.local` |
| Coordenação demo (`.demo`) | 3 | filtro `%.demo` |
| Super admins ativos | 1 | `internal_admins where ativo` |
| Escolas | 4 | `select count(*) from escolas` |
| Escolas suspensas/canceladas | 0 | — |

---

## 3. Leaked Password Protection

**Estado: DESATIVADO** — confirmado pelo Security Advisor do Supabase:

> `auth_leaked_password_protection` — *"Leaked password protection is currently disabled."* (nível WARN)
> Remediação: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

**Impacto neste sistema:** afeta apenas senhas **escolhidas por humano** — ou seja, a
**coordenação** (que define a própria senha pelo link). Aluno/responsável usam código
gerado com CSPRNG (não escolhem senha), então o recurso não muda o risco deles.

**Decisão SEG1:** **não** foi possível alterar a configuração de Auth a partir deste
ambiente (requer painel/Management API; alterar config de Auth às cegas está fora do
escopo seguro da fase). Fica como **ação manual do dono** (baixo esforço, alto retorno).

### Checklist manual — ativar Leaked Password Protection
1. Supabase → Authentication → Policies / Password.
2. Ativar **"Leaked password protection"** (checa o HaveIBeenPwned).
3. Opcional: exigir tamanho mínimo de senha (≥ 8) e complexidade para coordenação.
4. Re-rodar `get_advisors(security)` e confirmar que o WARN sumiu.

---

## 4. URLs de autenticação

| Config | Valor referenciado no código | Verificação |
|--------|------------------------------|-------------|
| Redirect de recuperação (coordenação) | `https://rumo-a-aprova-o.vercel.app/redefinir-senha` | `backoffice-coordenador/index.ts` (`REDIRECT_URL`) |
| Detecção de fluxo recovery | hash `type=recovery&access_token=…` | `app/src/App.jsx` (`detectarRecuperacao`) |
| CORS allowlist default das funções | `https://rumo-a-aprova-o.vercel.app`, `localhost:5173/3000` | `_shared/cors.ts` |

**Checklist manual (painel Auth → URL Configuration):** confirmar que **Site URL** e
**Redirect URLs** contêm exatamente `https://rumo-a-aprova-o.vercel.app` e
`https://rumo-a-aprova-o.vercel.app/redefinir-senha` (e nada de wildcard amplo demais).
Não verificável por MCP nesta fase.

---

## 5. Confirmação de e-mail / SMTP

- O fluxo da coordenação **gera o link de recuperação** e o devolve ao backoffice como
  *fallback manual* quando o SMTP não está configurado (estados `…_email_pendente`).
  Ou seja, **o sistema funciona sem SMTP** — o super admin entrega o link manualmente.
- **SMTP completo está fora do escopo da SEG1** (regra 15) — fica para SEG2, salvo
  decisão explícita do dono.

---

## 6. Achados

| ID | Sev | Achado | Status |
|----|-----|--------|--------|
| D-1 | P2 / Manual | Leaked Password Protection **desativado** | Checklist manual (seção 3) |
| D-2 | Manual | Confirmar Site URL / Redirect URLs no painel | Checklist manual (seção 4) |
| D-3 | P2 | 3 coordenações `.demo` com senha pública (= SEG1-A A-1) | Manual (dono) |
| D-4 | OK | 1 super admin ativo; aluno/resp por código (sem auto-cadastro) | Confirmado |

**Veredito SEG1-D:** modelo de auth coerente e isolado por papel. Pendência principal é
**ativar Leaked Password Protection** (manual, baixo esforço). **Nenhum P0/P1.**
