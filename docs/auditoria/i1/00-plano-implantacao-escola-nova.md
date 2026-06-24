# Plano de Implantação — Escola Nova (I1)

**Versão:** 1.0  
**Data:** 2026-06-24  
**Fase:** H1 (planejamento) → executar em PR1/I1  
**Status:** RASCUNHO — revisar com equipe antes de executar

---

## Objetivo

Este documento descreve os passos operacionais para implantar uma nova escola no sistema "Rumo à Aprovação". Deve ser seguido por um operador com acesso ao Supabase (painel ou MCP) e ao Vercel.

Escola de referência para este plano: **Escola Piloto I1** (já cadastrada, ID `i1000000-...`).

---

## Pré-requisitos

Antes de iniciar, confirmar:

- [ ] Contrato assinado com a escola
- [ ] Nome oficial da escola definido
- [ ] E-mail da coordenadora/diretor definido
- [ ] Domínio de e-mail da escola (para SMTP e convites)
- [ ] SMTP configurado no Supabase Auth e testado (ver `docs/operacao/d1c/`)
- [ ] Plano Supabase adequado (backups automáticos para escola real)

---

## Etapa 1 — Criar escola no banco

Executar via Supabase SQL Editor (ou MCP `execute_sql`):

```sql
-- Substituir com os dados reais
INSERT INTO escolas (id, nome, status)
VALUES (gen_random_uuid(), 'Nome da Escola', 'ativa');

-- Anotar o UUID gerado:
SELECT id FROM escolas WHERE nome = 'Nome da Escola';
```

**Variável:** `$ESCOLA_ID` = UUID gerado acima.

---

## Etapa 2 — Criar usuário de coordenação no Auth

Via Supabase Dashboard → Authentication → Users → "Invite user":

1. E-mail: coordenadora@escola.com.br
2. Após criação, anotar o `auth.users.id` gerado (`$COORD_AUTH_ID`)

Ou via SQL (service_role):

```sql
-- NÃO executar via cliente anon — exige service_role
-- Usar o Supabase Dashboard ou a Edge Function backoffice-coordenador
```

---

## Etapa 3 — Criar registro em `usuarios`

```sql
INSERT INTO usuarios (id, nome, email, escola_id, papel, ativo)
VALUES (
  '$COORD_AUTH_ID',          -- mesmo UUID do auth.users
  'Nome da Coordenadora',
  'coordenadora@escola.com.br',
  '$ESCOLA_ID',
  'coordenacao',
  true
);
```

---

## Etapa 4 — Definir `app_metadata` da coordenadora

O `app_metadata` é usado pelas Edge Functions e RLS para identificar escola e papel. Definir via Supabase Dashboard → Authentication → Users → editar usuário:

```json
{
  "escola_id": "$ESCOLA_ID",
  "papel": "coordenacao"
}
```

Ou via SQL com `service_role`:

```sql
UPDATE auth.users
SET raw_app_meta_data = jsonb_build_object(
  'escola_id', '$ESCOLA_ID'::uuid,
  'papel', 'coordenacao'
)
WHERE id = '$COORD_AUTH_ID';
```

---

## Etapa 5 — Enviar convite de acesso

Via Supabase Dashboard → Authentication → Users → "Send magic link" ou resetar senha.

A coordenadora receberá um e-mail com link de redefinição de senha. Ela deve:
1. Acessar o link
2. Definir uma senha forte
3. Acessar `https://rumo-a-aprova-o.vercel.app`
4. Fazer login com o e-mail e a senha definida

---

## Etapa 6 — Verificar acesso da coordenadora

Solicitar que a coordenadora:

- [ ] Acesse o painel de coordenação
- [ ] Visualize a lista de turmas (vazia inicialmente)
- [ ] Crie uma turma teste
- [ ] Tente acessar dados de outra escola → deve ser bloqueado (RLS)

---

## Etapa 7 — Criar turmas e importar alunos

A coordenadora faz isso via backoffice:

1. **Criar turma:** Nome, período, ano letivo
2. **Provisionar aluno:** nome, e-mail, turma → backoffice chama `provisionar-aluno`
3. Aluno recebe e-mail de convite (se SMTP configurado)
4. Aluno acessa o app, define senha, começa a usar

---

## Etapa 8 — Vincular responsáveis (opcional)

Para cada aluno:
1. Coordenadora usa "Adicionar responsável" no backoffice
2. Responsável recebe convite por e-mail
3. Responsável faz login → vê apenas os dados do seu filho

---

## Etapa 9 — Smoke test pós-implantação

| Cenário | Resultado esperado |
|---------|-------------------|
| Aluno faz login | ✅ Acessa o app |
| Aluno vê só sua escola | ✅ RLS isolada |
| Coordenadora cria turma | ✅ Aparece na listagem |
| Coordenadora vê só sua escola | ✅ RLS isolada |
| Responsável vê filho | ✅ Apenas o aluno vinculado |
| Outro aluno não visível | ✅ RLS bloqueou |
| Revogação de responsável | ✅ Responsável perde acesso |

---

## Etapa 10 — Documentar implantação

Criar arquivo `docs/auditoria/i1/implantacao-<nome-escola>.md` com:
- Data
- UUID da escola
- Nome da coordenadora
- Quantidade de alunos
- Incidentes ou observações

---

## Rollback

Se algo der errado:

```sql
-- Remover alunos provisionados (apenas os desta escola)
DELETE FROM vinculos_responsaveis WHERE escola_id = '$ESCOLA_ID';
DELETE FROM usuarios WHERE escola_id = '$ESCOLA_ID';
-- Remover auth.users requer service_role ou Supabase Dashboard

-- Remover escola (cascade apaga tudo vinculado)
DELETE FROM escolas WHERE id = '$ESCOLA_ID';
```

⚠️ **ATENÇÃO:** O cascade deleta turmas, alunos e logs. Só usar em caso de erro grave na implantação, antes de qualquer dado real ser inserido.

---

## Referências

- `docs/operacao/deploy-checklist.md`
- `docs/operacao/checklist-go-live-piloto.md`
- `docs/operacao/auth-credenciais-checklist.md`
- `docs/auditoria/d1b/relatorio-d1b-provisionamento-login.md`
- `docs/auditoria/d1c/relatorio-d1c-email-recuperacao-acesso.md`
