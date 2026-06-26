# Leaked Password Protection — Supabase Auth

**Data:** 2026-06-24 (criado) · **Corrigido:** 2026-06-26 (SEG2)
**Fase de verificação:** H1 → SEG2 (correção de estado)

> ⚠️ **CORREÇÃO (SEG2, 2026-06-26):** O documento anterior (H1, 2026-06-24) afirmava
> "✅ ATIVA" incorretamente. A verificação ao vivo do dono em 2026-06-26 confirmou que
> o toggle está **desabilitado** — recurso bloqueado pelo plano Free. Ver SEG2 doc
> `docs/auditoria/seg2/01-leaked-password-protection.md` para detalhes.

---

## O que é

O Supabase Auth oferece proteção contra senhas vazadas ("Leaked Password Protection" ou
"HaveIBeenPwned check"). Quando ativa, ao criar ou redefinir uma senha, o Supabase verifica
se ela aparece em bancos de dados conhecidos de credenciais comprometidas (usando a API do
HaveIBeenPwned de forma segura por k-anonimato). Se a senha estiver comprometida, o
cadastro/reset é bloqueado.

---

## Status atual (corrigido em 2026-06-26)

| Configuração | Status |
|-------------|--------|
| Leaked Password Protection | ❌ **INATIVA** (bloqueada pelo plano Free) |
| Plano atual | Free (não suporta este recurso) |
| Verificado em | 2026-06-24 (H1) + **reconfirmado 2026-06-26 (SEG2)** |
| Projeto Supabase | bdjkgrzfzoamchdpobbl |
| Toggle no painel | Desabilitado (not available on Free plan) |

### Política de senha atual (aplicada em 2026-06-26)
- Comprimento mínimo: **8 caracteres** (antes: 6)
- Requisito: **Letters and digits** (antes: nenhum)
- Aplicado no painel Auth pelo dono em 2026-06-26

---

## Por que isso importa

Alunos e responsáveis frequentemente reutilizam senhas de outros serviços. Se uma dessas senhas
for vazada em outro sistema e aparecer em bancos como o HaveIBeenPwned, sem essa proteção o
usuário poderia cadastrá-la no Rumo à Aprovação, expondo sua conta a ataques de credential stuffing.

**Com a proteção ativa (após Pro):**
- Senhas conhecidamente comprometidas são rejeitadas no cadastro e no reset
- O usuário é instruído a escolher uma senha diferente

---

## Checklist para ativar (quando o Pro entrar — julho)

1. Assinar o plano **Pro** do projeto (ou do projeto de produção sa-east-1).
2. Supabase → Authentication → Sign In / Providers → (Password) → ativar
   **"Leaked password protection"** (HaveIBeenPwned, k-anonimato).
3. Manter comprimento mínimo ≥ 8 + Letters and digits (já configurado).
4. Re-rodar `get_advisors(security)` e confirmar que o WARN `auth_leaked_password_protection` sumiu.
5. Testar criação/reset de senha de coordenação com senha sabidamente vazada (ex.: `password`) e
   confirmar rejeição.
6. Atualizar este documento marcando como ATIVA com a data.

---

## Considerações operacionais

### Impacto no fluxo de provisionamento

A Edge Function `provisionar-aluno` usa `admin.auth.admin.createUser()` com a `service_role`.
O comportamento do Leaked Password Protection para chamadas admin pode diferir do comportamento
para usuários finais. Recomenda-se usar senhas temporárias fortes (geradas aleatoriamente) no
provisionamento, e forçar troca no primeiro acesso.

### Senhas temporárias no provisionamento

O backoffice gera uma senha temporária aleatória ao provisionar alunos. Isso está correto.
A senha temporária deve: ter pelo menos 12 caracteres, misturar letras/números/símbolos, não ser
reutilizada entre alunos.

---

## Histórico de estados

| Data | Estado | Evidência |
|------|--------|-----------|
| 2026-06-24 (H1) | Afirmado como ATIVA (**incorreto**) | Erro de verificação (H1) |
| 2026-06-25 (SEG1) | WARN `auth_leaked_password_protection` no Security Advisor | SEG1 audit |
| 2026-06-26 (SEG2) | **Confirmado INATIVA** — toggle desabilitado no plano Free | Verificação ao vivo do dono |
| Julho/2026 (planejado) | Ativar após upgrade para Pro | — |
