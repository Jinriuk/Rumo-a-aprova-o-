# D1C — Rota /redefinir-senha

**Data**: 2026-06-23

---

## 1. Implementação

**Arquivo**: `app/src/routes/publico/RedefinirSenha.jsx`

### Fluxo completo:

```
Supabase gera link → E-mail enviado → Coordenador clica no link
    ↓
https://rumo-a-aprova-o.vercel.app/redefinir-senha
    #access_token=XXX&token_type=bearer&type=recovery&...
    ↓
Vercel rewrite (vercel.json) → serve index.html
    ↓
React app carrega → App.jsx detecta hash type=recovery
    ↓
<RedefinirSenha /> renderizada (sem passar por useSessao)
    ↓
Supabase client auto-processa o hash → cria sessão de recuperação
    ↓
Usuário preenche senha + confirmação + valida força
    ↓
supabase.auth.updateUser({ password }) → senha atualizada
    ↓
supabase.auth.signOut() → sessão encerrada
    ↓
window.location.replace('/') → volta para login (sem hash)
```

### Detecção no App.jsx:

```js
function detectarRecuperacao() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  return hash.get("type") === "recovery" && !!hash.get("access_token");
}

// Antes de qualquer roteamento por papel:
if (detectarRecuperacao()) {
  return <BrandingProvider ...><RedefinirSenha /></BrandingProvider>;
}
```

A checagem é síncrona, antes de `useSessao` resolver, evitando race conditions.

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
| Link expirado / já usado | "Este link expirou ou já foi usado. Solicite um novo link de recuperação na tela de login." |
| Outros erros | "Não foi possível atualizar a senha. Tente novamente ou solicite um novo link." |
| Sucesso | Mensagem de confirmação + redirect automático em 2,5s |

---

## 4. Segurança

- Não expõe token em console
- Não revela estado do usuário (expirado vs. inexistente — mesma mensagem)
- `window.location.replace('/')` remove o hash da URL histórica
- Após `signOut()`, a sessão de recuperação é invalidada
- `service_role` não está no frontend ✓

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
