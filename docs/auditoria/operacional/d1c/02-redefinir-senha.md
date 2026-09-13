# D1C — Rota /redefinir-senha

**Data**: 2026-06-23

---

## 1. Implementação

**Arquivo**: `app/src/routes/publico/RedefinirSenha.jsx`

### Fluxo completo:

> **Revisão (correção do link que trocava sessão alheia).** O fluxo abaixo
> substitui o original. O anterior deixava o SDK processar o hash sozinho
> (`detectSessionInUrl` no padrão), o que gravava a sessão do link na MESMA
> chave de localStorage da sessão normal: quem já estava logado no navegador
> — SuperADM inclusive, em qualquer aba da origem — era substituído sem aviso.
> Hoje o token do link NUNCA passa pelo cliente compartilhado.

```
Supabase gera link → E-mail enviado → Coordenador clica no link
    ↓
https://<origem>/redefinir-senha
    #access_token=XXX&token_type=bearer&type=recovery&...
    ↓
Vercel rewrite (vercel.json) → serve index.html
    ↓
React app carrega → App.jsx detecta hash type=recovery
    (o SDK NÃO processa o hash: detectSessionInUrl:false)
    ↓
<RedefinirSenha /> renderizada (sem passar por useSessao)
    ↓
lerHashRecuperacao(location.hash) → access_token extraído à mão
    ↓
Usuário preenche senha + confirmação + valida força
    ↓
fetch PATCH {URL}/auth/v1/user
    headers: apikey + Authorization: Bearer <access_token do link>
    body:    { password }
    ↓
NADA é gravado na sessão compartilhada — sem setSession, sem updateUser
    ↓
Tela "Senha alterada! Faça login com a senha nova"  (sem signOut:
derrubar a sessão do cliente derrubaria a de quem já estava logado)
    ↓
window.location.replace('/') → login normal (sem hash)
```

### Detecção no App.jsx:

```js
// shared/lib/recuperacao.js — módulo puro, sem cliente Supabase
function detectarRecuperacao() {
  return ehRotaRecuperacao(window.location.hash, window.location.pathname);
}

// Antes de qualquer roteamento por papel:
if (detectarRecuperacao()) {
  return <BrandingProvider ...><RedefinirSenha /></BrandingProvider>;
}
```

A checagem é síncrona, antes de `useSessao` resolver, evitando race conditions.

Ela cobre **três** entradas, não só a feliz:

| Entrada | Tela |
|---|---|
| `#access_token=…&type=recovery` | formulário de nova senha |
| `#error=…&error_code=otp_expired` (link velho/usado) | "este link expirou ou já foi usado" |
| `/redefinir-senha` sem hash utilizável | "este endereço não tem link válido" |

A segunda e a terceira existem para não haver redirecionamento silencioso:
antes, um link vencido caía no login (ou no painel de quem estivesse
logado) sem nenhuma explicação.

---

## 2. Validação de senha

- Mínimo: 8 caracteres
- Força mínima para envio: "Razoável" (2 de 4 critérios: maiúsculas, minúsculas, números, símbolos)
- Confirmação obrigatória (campos devem coincidir)
- Indicador visual de força (fraca/razoável/forte)

---

## 3. Tratamento de erros

| Erro | Mensagem ao usuário |
|------|---------------------|
| Link expirado / já usado (401/403, ou hash de erro) | "Este link expirou ou já foi usado. Solicite um novo link de recuperação na tela de login." |
| Senha igual à anterior (422 `same_password`) | "A nova senha precisa ser diferente da senha atual." |
| Senha recusada pelo servidor (422 `weak_password`) | "O servidor recusou esta senha por ser fraca…" |
| Endereço sem link válido | "Este endereço não tem um link de recuperação válido…" |
| Outros erros | "Não foi possível atualizar a senha. Tente novamente ou solicite um novo link." |
| Sucesso | "Senha alterada! Faça login com a senha nova" + botão e redirect em 4s |

---

## 4. Segurança

- Não expõe token em console
- Não revela estado do usuário (expirado vs. inexistente — mesma mensagem)
- `window.location.replace('/')` remove o hash da URL histórica
- O token do link **nunca** entra no cliente compartilhado nem no
  localStorage: vive só na memória da tela, num header de uma chamada
- Sessão de quem já estava logado (qualquer papel, qualquer aba da mesma
  origem) fica intocada — não há `signOut()` neste fluxo
- O próprio GoTrue invalida o link após o uso (recuperação é de uso único)
- `service_role` não está no frontend ✓

### Por que não `supabase.auth.updateUser()`

Ele exige a sessão do link carregada no cliente, e o cliente é um singleton
que persiste na mesma chave de localStorage da sessão normal. Era esse
carregamento — feito automaticamente pelo `detectSessionInUrl` — que
substituía a sessão ativa. As travas contra a regressão estão em
`tests/recovery-sessao-isolada.test.mjs`.

---

## 5. Vercel routing

O `vercel.json` já tem:
```json
"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
```

Isso garante que `/redefinir-senha` sirva o `index.html` sem 404.

---

## 6. Teste manual

1. No backoffice, provisionar um coordenador com e-mail real
2. Se SMTP configurado: coordenador recebe e-mail → clica no link → `/redefinir-senha`
3. Se SMTP não configurado: copiar o link do backoffice → abrir no navegador
4. Definir senha (mínimo razoável)
5. Ver tela de sucesso
6. Ser redirecionado para login
7. Logar com e-mail + nova senha

**Cenário obrigatório de regressão** (é o bug que originou esta revisão):
com uma aba já logada como SuperADM, abrir o link de recuperação de um
coordenador em outra aba do MESMO navegador, trocar a senha, e conferir que
a aba do SuperADM continua logada como SuperADM. Vale também o link vencido:
tem que aparecer a mensagem de link expirado, nunca tela em branco.
