# D1B — Diagnóstico: Provisionamento de Coordenador e Login

**Data:** 2026-06-22  
**Branch:** claude/d1b-provisionamento-login  
**Base:** main (D1A mergeada em 6ea977d)

---

## 1. Estado pré-D1B encontrado

### 1.1 Como a escola era criada

- **Backoffice** (`AreaAdmin.jsx`) → formulário `NovaEscola` com campos: nome, slug, cidade, UF, plano, limite de alunos.
- Chamada: RPC `backoffice_criar_escola` com porteiro `eh_super_admin` no banco. ✅
- Sem campos de contato administrativo (email_institucional, telefone, nome do responsável).

### 1.2 Campos em `escolas` antes da D1B

| Campo | Existia |
|-------|---------|
| id, nome, slug, logo_url, cor_acento, criada_em | ✅ |
| status, plano, cidade, uf, limite_alunos | ✅ (0021) |
| observacao, atualizada_em | ✅ (0025) |
| email_institucional | ❌ |
| telefone_contato | ❌ |
| contato_nome | ❌ |
| contato_observacao | ❌ |

### 1.3 Como `usuarios` representa coordenação

- `usuarios.id` = `auth.users.id` (PK = UUID do Auth)
- `usuarios.papel = 'coordenacao'`
- `usuarios.escola_id` = FK para `escolas.id`
- `usuarios.nome` = nome de exibição
- **Sem campo `email`** — o e-mail ficava só em `auth.users` (inacessível sem service_role no front)

### 1.4 Vínculo `auth.users` ↔ `usuarios`

- Criado pelo script `scripts/criar-coordenacao.mjs` ou pela Edge Function `backoffice-coordenador`
- `app_metadata.escola_id` e `app_metadata.papel` ficam no JWT → lidos pela RLS via `app.tenant_id()` e `app.papel()`

### 1.5 Como D0 criava coordenador via script

`scripts/criar-coordenacao.mjs` recebe variáveis de ambiente:
- `ESCOLA_SLUG`, `COORD_EMAIL`, `COORD_SENHA`, `COORD_NOME`
- Cria usuário Auth com `service_role` + upsert em `usuarios`
- **Problema:** exige senha em variável de ambiente; sem link de reset automático

### 1.6 RPCs/Edge Functions existentes

| Nome | Tipo | Estado |
|------|------|--------|
| `backoffice_escolas()` | RPC | ✅ funcional |
| `backoffice_criar_escola()` | RPC | ✅ mas sem campos de contato |
| `backoffice_detalhe_escola()` | RPC | ⚠️ retorna coordenadores como `string[]` (só nomes) |
| `backoffice_dashboard()` | RPC | ✅ funcional |
| `backoffice_editar_escola()` | RPC | ⚠️ sem campos de contato |
| `backoffice_definir_status()` | RPC | ✅ funcional |
| `backoffice-coordenador` | Edge Function | ✅ existia mas front NÃO chamava |

### 1.7 O que o superadmin conseguia editar (pré-D1B)

- Nome, plano, cidade, UF, cor de acento, logo URL, limite de alunos, observação interna
- Status (implantação/ativa/suspensa/cancelada/demo/piloto)
- **NÃO:** campos de contato, coordenador

### 1.8 Logs gerados

`admin_logs` com ações:
- `criar-escola` ✅
- `editar-escola` ✅ (com antes/depois)
- `suspender-escola`, `ativar-escola`, `alterar-status-escola` ✅
- `vincular-coordenador` ✅ (pela Edge Function, mas front não chamava)
- `reenviar-acesso` ❌ não existia

### 1.9 Scripts manuais ainda existentes (pré-D1B)

| Script | Função | Status |
|--------|--------|--------|
| `scripts/criar-coordenacao.mjs` | Criar coordenador Auth | Substituído pelo backoffice na D1B (script mantido como fallback) |
| `scripts/criar-super-admin.mjs` | Promover super_admin | Mantido (operação de bootstrap, não frequente) |
| `scripts/checar-migrations.mjs` | Auditoria de migrations | Mantido (ferramenta de operação) |

### 1.10 Partes do front que referenciavam script manual (pré-D1B)

1. `AreaAdmin.jsx:521` — checklist: `dica: "via scripts/criar-coordenacao.mjs"`
2. `AreaAdmin.jsx:560` — `SectionCard` sub: `"A conta do coordenador (Auth) é provisionada pela camada de operador — nunca pelo front."`
3. `AreaAdmin.jsx:570` — `EmptyState` dica: instrução de rodar o script manualmente
4. `AreaAdmin.jsx:572` — bloco com instrução de script mesmo quando havia coordenador

---

## 2. Problemas encontrados

| # | Problema | Impacto | Solução D1B |
|---|----------|---------|-------------|
| P1 | Front não chamava a Edge Function `backoffice-coordenador` | Operador precisava de script manual | Wired o front à Edge Function |
| P2 | `backoffice_detalhe_escola` retornava `string[]` de nomes sem email | Impossível reenviar acesso sem saber o email | Atualizado para retornar `{id,nome,email}` |
| P3 | Sem campos de contato em `escolas` | Dados administrativos do cliente perdidos | Migration 0032 adiciona 4 campos |
| P4 | Sem cache de email em `usuarios` | Exibiria email sem chamar admin API | Migration 0032 adiciona `usuarios.email` |
| P5 | Login sem "olhinho" no campo senha | UX ruim, WCAG inadequado | Campo senha com toggle implementado |
| P6 | Login sem recuperação de senha | Coordenação ficava travada se esquecia senha | `solicitarRecuperacaoSenha()` + tela |
| P7 | Login sem recuperação de código | Aluno/responsável sem saída se perdia código | Tela "Esqueci meu código" implementada |
| P8 | `backoffice_criar_escola` sem status inicial configurável | Escola sempre nascia em implantação | Parâmetro `p_status_inicial` adicionado |

---

## 3. Alterações realizadas na D1B

### 3.1 Migration `0032_d1b_provisionamento_acessos.sql`
- 4 colunas em `escolas` (contato)
- 1 coluna em `usuarios` (email)
- `backoffice_criar_escola` estendida (novos params)
- `backoffice_detalhe_escola` atualizada (coordenadores como objetos)
- `backoffice_editar_escola` estendida (novos params de contato)
- `backoffice_registrar_reenvio` — nova RPC para log de reenvio

### 3.2 Edge Function `backoffice-coordenador/index.ts`
- Modo `acao: "criar"` (default) — já existia, mantido
- Modo `acao: "reenviar"` — novo, envia só o reset link
- Persiste `email` em `usuarios.email`

### 3.3 `app/src/shared/data/index.js`
- `backofficeCriarEscola` — aceita novos campos
- `backofficeEditarEscola` — aceita novos campos de contato
- `backofficeProvisionarCoordenador` — novo, chama Edge Function
- `backofficeReenviarAcesso` — novo, registra RPC + chama Edge Function
- `solicitarRecuperacaoSenha` — novo, fluxo Auth padrão
- `solicitarRecuperacaoCodigo` — novo, coleta e-mail para orientação

### 3.4 `app/src/routes/admin/AreaAdmin.jsx`
- Formulário de criar escola: Blocos A + B + C
- `EditarEscola`: campos de contato adicionados
- `Coordenadores`: UI completa de criar/reenviar (sem referência a scripts manuais)
- `ChecklistImplantacao`: dados reais + mais itens + sem dica de script
- `DetalheEscola`: exibe contato_nome, email_institucional, telefone_contato
- `ResumoDetalhe`: logs de coordenador/reenvio legíveis

### 3.5 `app/src/routes/publico/Login.jsx`
- Campo senha com "olhinho" (toggle show/hide)
- "Esqueci minha senha" para coordenação → fluxo Auth padrão
- "Esqueci meu código de acesso" para aluno/responsável → tela com coleta de e-mail
- Mensagens genéricas para não vazar existência de cadastro
