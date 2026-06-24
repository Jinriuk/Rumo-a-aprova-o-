# Repositório Público — Riscos e Mitigações

**Data:** 2026-06-24  
**Repositório:** `jinriuk/rumo-a-aprova-o-` (público no GitHub)

---

## Situação

O repositório é **público**. Qualquer pessoa pode ler o código-fonte, histórico de commits, branches e documentação. Isso é intencional para facilitar colaboração e auditorias externas, mas exige disciplina rigorosa com secrets.

---

## O que é seguro estar público

| Item | Por quê é seguro |
|------|-----------------|
| `VITE_SUPABASE_URL` | URL pública por design — identificadora, não autorizadora |
| `VITE_SUPABASE_ANON_KEY` | Chave anon é pública por design; a segurança é a RLS, não o segredo da chave |
| Código-fonte do front-end | Não contém lógica de autorização — é feita no Supabase via RLS |
| Código-fonte das Edge Functions | A lógica é auditável; a autorização exige JWT válido (`verify_jwt: true`) |
| Migrations SQL | São documentação do schema; o banco real é protegido por auth |
| Documentação técnica | Este repositório não contém dados de produção |

---

## O que NUNCA deve ser commitado

| Item | Exemplo | Por quê é grave |
|------|---------|----------------|
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...` | Bypassa RLS completamente — acesso irrestrito ao banco |
| Senhas de usuários | qualquer senha real | LGPD + risco imediato de invasão |
| Tokens de API privados | Vercel, Supabase, GitHub | Podem criar/deletar recursos |
| Chaves SMTP | usuário/senha do servidor de e-mail | Permite envio de spam |
| `.env` com valores reais | `.env.local`, `.env.production` | Concentra múltiplos secrets |

---

## Auditoria de secrets no repositório (2026-06-24)

### `service_role` no front-end

```bash
grep -r "service_role" app/src/
# Resultado: vazio (nenhuma ocorrência)
```

✅ **CONFIRMADO** — `service_role` não está exposta no código do front-end.

### Secrets nas variáveis de ambiente commitadas

O arquivo `app/.env.production` contém apenas:
- `VITE_SUPABASE_URL` — pública por design
- `VITE_SUPABASE_ANON_KEY` — pública por design

✅ **CONFIRMADO** — nenhuma secret privada commitada.

### GitHub Secrets (não-públicos)

Configurados apenas via GitHub Actions secrets (não ficam no código):
- `E2E_SUPABASE_URL` — ambiente E2E isolado (opcional)
- `E2E_SUPABASE_ANON_KEY` — ambiente E2E isolado (opcional)

A `SUPABASE_SERVICE_ROLE_KEY` **não está** em nenhum GitHub Secret de CI — o CI não precisa dela (build e testes unitários não requerem `service_role`).

---

## Procedimentos de segurança contínuos

### Antes de cada commit

1. Verificar que nenhum arquivo `.env` com valores reais está staged: `git diff --staged | grep -i "service_role\|password\|secret"`
2. Nunca usar `git add .` ou `git add -A` quando há arquivos `.env` no diretório

### Se um secret for commitado acidentalmente

1. **Revogar imediatamente** o secret no provedor (Supabase, Vercel, etc.) — não espere o cleanup do git
2. Remover do histórico via `git filter-repo` (ou pedir ao GitHub para invalidar via secret scanning)
3. Verificar logs do Supabase por acessos suspeitos no período de exposição
4. Registrar incidente

### GitHub Secret Scanning

O GitHub escaneia automaticamente commits em busca de padrões de secrets conhecidos (Supabase keys, AWS, etc.) e alerta via email. Manter o alerta ativo na conta do repositório.

---

## Considerações sobre o repositório público

**Vantagem:** Auditores externos, potenciais clientes e colaboradores podem ver o código. Aumenta confiança e permite contribuições.

**Desvantagem principal:** Atacantes também podem analisar o código em busca de vulnerabilidades. Mitigação: RLS robusta, Edge Functions com JWT, sem lógica de autorização no front.

**Recomendação para PR1:** Manter público. A segurança do sistema não depende de ocultar o código — depende de RLS, JWT e `service_role` confinada ao servidor. Se dados sensíveis de clientes forem adicionados ao repositório (ex.: seeds com dados reais), reconsiderar.
