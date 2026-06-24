# Auth — Códigos de Acesso de Alunos e Responsáveis

## Como funciona o acesso

Alunos e responsáveis **não criam conta**. A coordenação provisiona o acesso via
painel e entrega o código gerado.

### Formato do código

```
XXXX-XXXX-XXXX   (12 caracteres + 2 traços)
```

Alfabeto: `ABCDEFGHJKMNPQRSTUVWXYZ23456789`  
Caracteres excluídos intencionalmente: `0 O 1 I L` (evitam confusão ao ditar por telefone).

### Como o código vira credencial de acesso

O código é transformado em e-mail sintético pela função:

```
emailDoCodigo("ABCD-EFGH-IJKM") → "abcdefghijkm@codigo.acesso.local"
```

No `auth.users` do Supabase:
- **email**: `<código_sem_traços_minúsculo>@codigo.acesso.local`
- **password**: o próprio código (com traços, maiúsculo)
- `email_confirm: true` (não passa por e-mail real)
- `app_metadata.papel`: `"aluno"` ou `"responsavel"`
- `app_metadata.escola_id`: UUID da escola (garante isolamento por tenant)

### Onde o código aparece

O código é exibido **uma única vez** no modal `CredencialGerada` logo após a
geração. Depois disso, não é recuperável — o código é armazenado como hash
no Auth do Supabase, não em claro no banco.

Se a escola precisar de um novo código, a coordenação pode **revogar** e criar
um novo via "Regerar credencial do aluno".

## Fluxo de provisionamento

```
Coordenação acessa "Alunos" → seleciona aluno → "Gerar credencial"
      ↓
Edge Function provisionar-aluno (service_role, nunca no navegador)
      ↓
1. Gera XXXX-XXXX-XXXX
2. Cria auth.users com email sintético
3. Insere em usuarios (escola_id, papel)
4. Atualiza alunos.usuario_id  (ou insere em vinculos_responsaveis)
5. Registra em logs_acesso
      ↓
Código retornado UMA vez para a coordenação
```

## Provisionamento de responsáveis

Mesmo fluxo, com `tipo: "responsavel"`:
- Cria conta separada para o responsável
- Insere vínculo em `vinculos_responsaveis (escola_id, responsavel_id, aluno_id)`
- Responsável vê apenas o resumo do aluno vinculado

## Revogação de acesso

Para revogar o acesso de um responsável:

```
Coordenação → Lista de Alunos → "Mais ações" → "Gerenciar responsáveis"
      ↓
Modal VinculosResponsavel → botão "Revogar acesso"
      ↓
Edge Function revogar-responsavel (service_role)
      ↓
1. Verifica que o vínculo pertence à escola da coordenação
2. Remove vinculos_responsaveis
3. Remove usuarios
4. Remove auth.users
5. Registra em logs_coordenacao
```

## Segurança

| Regra | Implementação |
|---|---|
| `service_role` nunca no front | Toda criação/revogação via Edge Function |
| Isolamento por escola | `app_metadata.escola_id` em todo auth.user |
| RLS garante tenant | Todas as tabelas têm `escola_id` com RLS |
| Código não recuperável | Hash no Supabase Auth, não em claro |
| Log obrigatório | `logs_acesso` e `logs_coordenacao` para toda ação |

## Importação em lote (CSV)

A coordenação pode importar alunos via:

1. **Textarea** — um nome por linha (sem turma, usa a turma padrão selecionada)
2. **CSV** — arquivo `.csv`, `.tsv` ou `.txt` com:
   - Coluna 1: nome do aluno (obrigatório, 2–80 caracteres)
   - Coluna 2: nome da turma (opcional; deve bater com turma cadastrada)
   - Suporta separadores: `,` `;` `|` `\t`
   - Cabeçalho detectado automaticamente (`nome`, `name`, `aluno`, `estudante`)

Linhas inválidas são exibidas com motivo e ignoradas na importação.
