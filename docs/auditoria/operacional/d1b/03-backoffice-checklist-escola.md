# D1B — Backoffice: Checklist e Detalhe da Escola

## Checklist de implantação — antes vs depois

### Antes (D1A)

| Item | Calculado por dado real? | Dica problemática |
|------|--------------------------|-------------------|
| Escola criada | ✅ (sempre true) | — |
| Coordenador provisionado | ✅ (`d.coordenadores.length > 0`) | ❌ "via scripts/criar-coordenacao.mjs" |
| Marca configurada | ✅ | — |
| Turmas criadas | ✅ | — |
| Alunos importados | ✅ | — |
| Credenciais geradas | ✅ | — |
| Responsáveis vinculados | ✅ | — |
| Escola ativada | ✅ | — |

### Depois (D1B)

| Item | Calculado por dado real? | Mudança |
|------|--------------------------|---------|
| Escola criada | ✅ (sempre true) | — |
| Dados básicos preenchidos | ✅ (`nome && slug`) | **NOVO** |
| Contato administrativo informado | ✅ (`email_institucional \|\| contato_nome \|\| telefone_contato`) | **NOVO** |
| Coordenador provisionado | ✅ (`coords.length > 0`) | Dica atualizada: "Use o botão 'Criar coordenador' abaixo" |
| Marca configurada | ✅ | — |
| Turmas criadas | ✅ (`turmas.length > 0`) | Dados agora são objetos completos |
| Alunos cadastrados | ✅ (`d.alunos > 0`) | Rótulo melhorado |
| Credenciais/códigos gerados | ✅ (`d.alunos_com_credencial > 0`) | — |
| Responsáveis vinculados | ✅ (`d.responsaveis > 0`) | — |
| Escola ativada | ✅ | — |

**10 itens** (vs 8 antes). Todos calculados por dados reais.

---

## Detalhe da escola — campos adicionados

### Antes

Mostrava: status, plano, alunos, turmas, cor/logo, observação interna.

### Depois

Adicionado na seção de info (grade responsiva):
- **Responsável administrativo** (`e.contato_nome`)
- **E-mail institucional** (`e.email_institucional`) — com link mailto
- **Telefone/WhatsApp** (`e.telefone_contato`)
- Observação de contato (`e.contato_observacao`)

---

## Seção "Coordenação" — antes vs depois

### Antes

```
EmptyState: "Rode scripts/criar-coordenacao.mjs..."
```
```
Nota: "Para adicionar/reativar coordenador ou redefinir senha, use a camada de operador (script)."
```

### Depois

- Estado vazio: botão "+ Criar coordenador" visível
- Formulário inline: nome + e-mail + botão "Criar acesso"
- Para coordenador existente: card com nome, e-mail, botão "↻ Reenviar acesso"
- Sem qualquer referência a script manual

---

## Formulário de criar escola — antes vs depois

### Antes (1 bloco implícito)
nome, slug, cidade, UF, plano, limite de alunos

### Depois (3 blocos explícitos)

**Bloco A — Dados da escola**  
nome, slug, status inicial, plano, limite, cidade, UF, cor, logo, observação interna

**Bloco B — Contato administrativo**  
nome do responsável, e-mail institucional, telefone, observação de contato

**Bloco C — Acesso da coordenação**  
opção: criar agora / deixar para depois  
(se criar agora: nome + e-mail do coordenador)

---

## Logs legíveis no painel

Ações agora mapeadas em `ACOES`:

```js
"vincular-coordenador": "Coordenador vinculado",
"reenviar-acesso": "Acesso reenviado",
```

Com detalhes legíveis:
```
Coordenador vinculado · Maria Silva (maria@escola.local)
Acesso reenviado · João Coord (joao@escola.local)
```
