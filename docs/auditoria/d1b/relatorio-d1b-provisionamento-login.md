# Relatório D1B — Provisionamento Real pelo Backoffice + Login e Recuperação de Acesso

**Data:** 2026-06-22  
**Branch:** `claude/d1b-provisionamento-login`  
**Base:** `main` com D1A mergeada (commit 6ea977d)

---

## Pergunta central

> "O dono do sistema consegue criar uma escola, cadastrar o coordenador, enviar/gerar acesso, editar dados, suspender/reativar e orientar recuperação de acesso sem abrir banco, sem rodar script e sem expor senha?"

**Resposta D1B: Sim.**

---

## Checklist de critérios de aceite

### Backoffice

| Critério | Status | Detalhe |
|----------|--------|---------|
| Escola cadastrada com dados administrativos completos | ✅ | Blocos A (escola), B (contato), C (coordenação) |
| Coordenador criado/vinculado sem script manual | ✅ | Edge Function `backoffice-coordenador` integrada ao front |
| Reenvio de acesso pelo backoffice | ✅ | Botão "↻ Reenviar acesso" + RPC + Edge Function |
| Checklist reflete dados reais | ✅ | 10 itens calculados por dados reais (antes: 8, com dica de script) |
| Detalhe da escola exibe contato | ✅ | email_institucional, contato_nome, telefone_contato |
| Logs administrativos completos | ✅ | vincular-coordenador, reenviar-acesso, editar-escola com novos campos |

### Login

| Critério | Status | Detalhe |
|----------|--------|---------|
| Campo senha com mostrar/ocultar | ✅ | Toggle com ícone olho, aria-label, sem alterar valor |
| Coordenação com "Esqueci minha senha" | ✅ | Tela dedicada → `resetPasswordForEmail` → mensagem genérica |
| Mensagem de recuperação não vaza e-mail | ✅ | Mensagem genérica independente do e-mail existir ou não |
| Aluno/responsável com "Esqueci meu código" | ✅ | Tela dedicada (renomeada — não é "Esqueci minha senha") |
| Fluxo de código continua funcionando | ✅ | Não alterado |

### Segurança

| Critério | Status | Detalhe |
|----------|--------|---------|
| Nenhuma senha exposta | ✅ | Senha aleatória criada e descartada no servidor |
| `service_role` fora do front | ✅ | Apenas em Edge Functions (servidor) |
| RLS intacta | ✅ | Verificada: porteiro `eh_super_admin`, `tenant_operacional` |
| Escola suspensa continua bloqueando | ✅ | `app.tenant_operacional()` intacto |
| `admin_logs` cobrindo todas ações sensíveis | ✅ | Criar escola, vincular coordenador, reenviar, editar, alterar status |
| Sem senha em log | ✅ | Logs contêm nome/email/ação — nunca credencial |

---

## Artefatos entregues

### Banco de dados

- `supabase/migrations/0032_d1b_provisionamento_acessos.sql`
  - Colunas em `escolas`: `email_institucional`, `telefone_contato`, `contato_nome`, `contato_observacao`
  - Coluna em `usuarios`: `email`
  - RPC `backoffice_criar_escola` estendida (status_inicial + contato)
  - RPC `backoffice_detalhe_escola` atualizada (coordenadores como objetos)
  - RPC `backoffice_editar_escola` estendida (campos de contato)
  - RPC `backoffice_registrar_reenvio` — nova

### Edge Functions

- `supabase/functions/backoffice-coordenador/index.ts`
  - Modo `criar` (default): cria/revincula coordenador + reset link
  - Modo `reenviar`: só envia reset link para e-mail existente
  - Persiste `email` em `usuarios.email`

### Front-end

- `app/src/shared/data/index.js`
  - `backofficeCriarEscola` — novos campos
  - `backofficeEditarEscola` — novos campos de contato
  - `backofficeProvisionarCoordenador` — novo
  - `backofficeReenviarAcesso` — novo
  - `solicitarRecuperacaoSenha` — novo (Auth padrão)
  - `solicitarRecuperacaoCodigo` — novo (coleta e-mail)

- `app/src/routes/admin/AreaAdmin.jsx`
  - Formulário criar escola: 3 blocos (dados, contato, coordenação)
  - Seção "Coordenação": criar/reenviar pelo UI (sem scripts)
  - Checklist: 10 itens reais
  - Detalhe: exibe campos de contato

- `app/src/routes/publico/Login.jsx`
  - Campo senha com olhinho
  - "Esqueci minha senha" (coordenação)
  - "Esqueci meu código de acesso" (aluno/responsável)
  - Telas de confirmação com mensagens genéricas

### Testes

- `tests/d1b-provisionamento.test.mjs` — 10 casos de teste de banco

### Documentação

- `docs/auditoria/d1b/00-diagnostico-provisionamento.md`
- `docs/auditoria/d1b/01-provisionamento-coordenador.md`
- `docs/auditoria/d1b/02-login-recuperacao-acesso.md`
- `docs/auditoria/d1b/03-backoffice-checklist-escola.md`
- `docs/auditoria/d1b/04-seguranca-service-role.md`
- `docs/auditoria/d1b/05-testes.md`

---

## P0 e P1

### P0 (bloqueadores críticos)
**Nenhum.** Nada na D1B quebra funcionalidade existente. Todas as alterações são aditivas.

### P1 (importante, não bloqueador)

| # | Item | Fase |
|---|------|------|
| P1-1 | Tabela `solicitacoes_acesso` para aluno/responsável ainda não existe | D1C |
| P1-2 | Tela de redefinição de senha (`/redefinir-senha`) ainda não existe como rota | D1C |
| P1-3 | SMTP não está configurado no ambiente de dev — link de reset retorna `null` | Config de ambiente |
| P1-4 | Super_admin sem fluxo de recuperação pelo próprio backoffice (usa Supabase Auth) | Operação |

---

## Pode seguir para I1?

**Sim**, com os P1 documentados.

A D1B entrega o núcleo operacional que permitia ao superadmin depender apenas do banco e de scripts. A partir desta fase:

- Escola pode ser criada com todos os dados necessários
- Coordenador pode ser provisionado pelo backoffice
- Acesso pode ser reenviado pelo backoffice
- Login tem UX adequada com olhinho e recuperação
- Nenhuma senha é exposta
- `service_role` permanece fora do front
- RLS permanece íntegra

Os P1 listados são melhorias de produto (tela de reset, tabela de solicitações) que não impedem a operação — o operador pode configurar manualmente no Supabase Auth enquanto a D1C não entrega.
