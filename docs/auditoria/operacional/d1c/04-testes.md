# D1C — Plano e Resultados de Testes

**Data**: 2026-06-23

---

## 1. Build

```bash
cd app
npm install
npm run build
```

**Resultado esperado**: Build Vite sem erros TypeScript ou lint.

---

## 2. Testes unitários/lógicos

```bash
cd tests
npm test
```

Cobrem: motor de progresso, gamificação, regras, missões, recorrência, etc.  
**Não são afetados pela D1C** (lógica de e-mail é de integração, não unitária).

---

## 3. Testes D1C

```bash
cd tests
npm test -- --grep d1c
```

**Arquivo**: `tests/d1c-email.test.mjs`

### Casos cobertos:

| # | Caso | Verificação |
|---|------|-------------|
| 1 | Coordenador novo criado | `conta_nova: true` + status `criado_*` |
| 2 | Coordenador existente revinculado | `conta_nova: false` + status `existente_*` |
| 3 | Reenviar acesso | status `existente_reenvio_*` |
| 4 | E-mail inválido | erro 400 |
| 5 | escola_id inexistente | erro 404 |
| 6 | `acao` desconhecida | erro 400 |
| 7 | Sem autenticação | 403 sem informação extra |
| 8 | `recuperarSenha` não revela estado | mensagem genérica |
| 9 | `redefinirSenha` valida senha fraca | recusa < 8 chars |
| 10 | `redefinirSenha` valida senha coincidir | recusa se diferente |
| 11 | service_role não presente no front | grep nos arquivos JS |

---

## 4. Smoke test no navegador

### 4.1 Login de coordenação (existente)
- [ ] Acessar a URL do deploy
- [ ] Selecionar aba "Coordenação"
- [ ] Logar com e-mail e senha válidos
- [ ] Verificar que entra no AreaEscola

### 4.2 "Esqueci minha senha"
- [ ] Selecionar aba "Coordenação" no login
- [ ] Clicar em "Esqueci minha senha"
- [ ] Informar e-mail da coordenação
- [ ] Ver mensagem genérica (não revela se existe ou não)
- [ ] Verificar que e-mail chega (ou ver link no backoffice se SMTP não configurado)

### 4.3 Rota `/redefinir-senha`
- [ ] Abrir o link de recuperação no navegador
- [ ] Ver formulário de redefinição de senha
- [ ] Tentar senha fraca → recusado
- [ ] Tentar senhas que não coincidem → recusado
- [ ] Definir senha válida
- [ ] Ver tela de sucesso
- [ ] Ser redirecionado para login em 2,5s

### 4.4 Login após redefinição
- [ ] Logar com nova senha
- [ ] Entrar no painel de coordenação

### 4.5 Provisionar coordenador (backoffice)
- [ ] Logar como super_admin
- [ ] Abrir detalhe de uma escola
- [ ] Usar "Provisionar coordenador" com nome + e-mail
- [ ] Ver status claro (enviado ou pendente)
- [ ] Se pendente: ver link manual para cópia
- [ ] Checklist atualiza "Coordenador provisionado" ✓

### 4.6 Reenviar acesso (backoffice)
- [ ] Selecionar aba "Reenviar acesso"
- [ ] Informar e-mail
- [ ] Ver resultado claro

### 4.7 Aluno por código — não quebrou
- [ ] Selecionar aba "Aluno / Responsável"
- [ ] Inserir código de aluno válido (ex: LUCASDEMO2026)
- [ ] Entrar no AreaAluno

### 4.8 Responsável por código — não quebrou
- [ ] Inserir código de responsável válido
- [ ] Entrar no AreaResponsavel

### 4.9 Sem service_role no front
```bash
grep -r "service_role" app/src/
# Deve retornar: nenhum resultado
```

### 4.10 Logs administrativos
- [ ] Após provisionar, verificar admin_logs no Supabase
- [ ] Ação `vincular-coordenador` deve estar registrada com status

---

## 5. Verificações de segurança

```bash
# service_role não exposto no frontend
grep -r "service_role" app/src/ && echo "FALHA" || echo "OK"

# Token não logado
grep -r "action_link\|console.log.*link" supabase/functions/ && echo "ATENÇÃO" || echo "OK"

# Senha não hardcoded
grep -r "password.*:" supabase/functions/ | grep -v "senhaAleatoria\|updateUserById\|createUser"
```

---

## 6. Resultados de build

```
vite build
✓  built in Xs
dist/assets/index-[hash].js   ~NkB
dist/assets/index-[hash].css  ~NkB
```
