# D1B — Login: Campo de Senha com Olhinho e Recuperação de Acesso

## 1. Campo de senha com olhinho

### Implementação

Arquivo: `app/src/routes/publico/Login.jsx`

```jsx
const [mostrarSenha, setMostrarSenha] = useState(false);

<div style={{ position: "relative" }}>
  <input
    type={mostrarSenha ? "text" : "password"}
    value={senha}
    ...
    style={{ ...inputS, paddingRight: 46 }}
  />
  <button
    type="button"
    onClick={() => setMostrarSenha((v) => !v)}
    aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
    style={{ position: "absolute", right: 12, top: "50%", ... }}
  >
    {mostrarSenha ? "🙈" : "👁"}
  </button>
</div>
```

### Propriedades de segurança e acessibilidade

- `type` alterna entre `password` e `text` — valor nunca é alterado
- `aria-label` descritivo para leitores de tela
- `tabIndex={-1}` no botão — não interfere no fluxo de tab do formulário
- Não há log do valor da senha

### Onde se aplica

- Login de coordenação (modo `coordenacao`)
- Extensível para tela de redefinição de senha (quando implementada)

---

## 2. "Esqueci minha senha" — coordenação

### Fluxo

1. Usuário no modo "Coordenação" clica em "Esqueci minha senha"
2. Tela troca para `esqueciSenha`
3. Usuário informa o e-mail
4. Front chama `solicitarRecuperacaoSenha(email)`:
   - `supabase.auth.resetPasswordForEmail(email, { redirectTo: .../redefinir-senha })`
5. Independentemente de o e-mail existir: tela `confirmacao` com mensagem genérica
6. Supabase Auth envia o e-mail (se SMTP configurado)

### Mensagem genérica (evita vazamento)

> "Se este e-mail estiver cadastrado, enviaremos instruções de recuperação."

### Segurança

- Não revela se o e-mail existe no sistema
- Não expõe senha
- Usa infraestrutura padrão do Supabase Auth (link temporário, sem hash de senha)
- `redirectTo` aponta para a própria aplicação

---

## 3. "Esqueci meu código de acesso" — aluno/responsável

### Contexto

Aluno e responsável usam **código de acesso** (não senha). O código vira um e-mail temporário `{CODIGO}@codigo.acesso.local` com senha = o próprio código. Portanto:

- Não há "senha" para recuperar no sentido tradicional
- Link foi renomeado para "Esqueci meu código de acesso" (não "Esqueci minha senha")
- Não transforma aluno/responsável em Auth user normal (sem mudança de produto)

### Fluxo implementado

1. Usuário no modo "Aluno / Responsável" clica em "Esqueci meu código de acesso"
2. Tela troca para `esqueciCodigo`
3. Usuário informa o e-mail cadastrado (se tiver)
4. Front chama `solicitarRecuperacaoCodigo(email)`:
   - Tenta inserir em `solicitacoes_acesso` (tabela a ser criada na D1C)
   - Se tabela não existir: falha silenciosa (logs no console)
5. Sempre exibe mensagem genérica

### Mensagem genérica

> "Se houver um acesso vinculado a este e-mail, enviaremos as instruções. Caso não receba, procure a coordenação da escola."

### Orientação adicional

> "Não tem e-mail cadastrado? Procure a coordenação da sua escola."

### O que a D1B NÃO faz (intencional/produto)

- Não cria Auth user normal para aluno/responsável
- Não envia código por e-mail automaticamente (aguarda D1C)
- Não exibe o código para o usuário (nem em tela, nem em log)
- A tabela `solicitacoes_acesso` é mencionada mas a migration fica para D1C

---

## 4. Superadmin e recuperação de senha

O superadmin usa o mesmo fluxo Auth que a coordenação. Se esquecer a senha:
- Usa o link "Esqueci minha senha" da tela de login
- Ou o operador usa o painel do Supabase Auth diretamente

---

## 5. Telas implementadas

| Tela | Variável `tela` | Gatilho |
|------|-----------------|---------|
| Login normal | `"login"` | Padrão |
| Esqueci minha senha | `"esqueciSenha"` | Clique em link (modo coordenação) |
| Esqueci meu código | `"esqueciCodigo"` | Clique em link (modo codigo) |
| Confirmação | `"confirmacao"` | Após submit de qualquer recuperação |
