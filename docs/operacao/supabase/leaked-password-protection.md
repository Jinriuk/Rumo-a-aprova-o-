# Leaked Password Protection — Supabase Auth

**Data:** 2026-06-24  
**Fase de verificação:** H1

---

## O que é

O Supabase Auth oferece proteção contra senhas vazadas ("Leaked Password Protection" ou "HaveIBeenPwned check"). Quando ativa, ao criar ou redefinir uma senha, o Supabase verifica se ela aparece em bancos de dados conhecidos de credenciais comprometidas (usando a API do HaveIBeenPwned de forma segura por k-anonimato). Se a senha estiver comprometida, o cadastro/reset é bloqueado.

---

## Status atual

| Configuração | Status |
|-------------|--------|
| Leaked Password Protection | ✅ **ATIVA** |
| Verificado em | 2026-06-24 (H1) |
| Projeto Supabase | `bdjkgrzfzoamchdpobbl` |

---

## Como foi verificado

Verificação via Supabase MCP (`get_project` + configurações de Auth). A funcionalidade está habilitada no painel de Auth > Password Settings do projeto.

---

## Por que isso importa

Alunos e responsáveis frequentemente reutilizam senhas de outros serviços. Se uma dessas senhas for vazada em outro sistema e aparecer em bancos como o HaveIBeenPwned, sem essa proteção o usuário poderia cadastrá-la no Rumo à Aprovação, expondo sua conta a ataques de credential stuffing.

Com a proteção ativa:
- Senhas conhecidamente comprometidas são rejeitadas no cadastro e no reset
- O usuário é instruído a escolher uma senha diferente
- Não há impacto em senhas já cadastradas (proteção é no momento da criação/reset)

---

## Considerações operacionais

### Impacto no fluxo de provisionamento

A Edge Function `provisionar-aluno` usa `admin.auth.admin.createUser()` com a `service_role`. O comportamento do Leaked Password Protection para chamadas admin (service_role) pode diferir do comportamento para usuários finais. **Recomenda-se** usar senhas temporárias fortes (geradas aleatoriamente) no provisionamento, e forçar troca no primeiro acesso — não usar senhas simples ou previsíveis como `Aluno@2024`.

### Senhas temporárias no provisionamento

O backoffice gera uma senha temporária aleatória ao provisionar alunos. Isso está correto. A senha temporária deve:
- Ter pelo menos 12 caracteres
- Misturar letras, números e símbolos
- Não ser reutilizada entre alunos

### Monitoramento

Supabase não expõe métricas de tentativas bloqueadas por esta proteção nos logs padrão. Se houver necessidade de auditoria mais fina, verificar os logs de Auth no Supabase Dashboard.

---

## Ação requerida

Nenhuma — está ativa. Manter configuração.

**Para PR1:** Confirmar que o fluxo de "primeiro acesso" (aluno recebe senha temporária e é incentivado a trocar) está funcionando. Isso é especialmente importante para garantir que as senhas temporárias geradas automaticamente no provisionamento sejam trocadas antes do uso regular.
