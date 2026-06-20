# Backoffice interno / Superoperador (D0)

Área interna para o dono/operador administrar escolas **sem entrar no
Supabase**. Rota discreta: **`/admin-interno`** (não aparece em nenhum
menu de aluno/responsável/coordenação; chega-se por URL direta).

## Quem pode acessar

O gate **real** é o banco, não a tela:

- só passa quem está autenticado no Supabase Auth **e** registrado em
  `internal_admins` com `ativo = true`;
- não autenticado → tela de login;
- autenticado, mas não admin → **“Acesso restrito”** (nada vaza);
- admin com `ativo = false` → bloqueado (é assim que se **revoga** um
  operador: `update internal_admins set ativo = false`).

O front pergunta `sou_super_admin()` ao banco; toda leitura/escrita
cross-tenant passa por RPCs `SECURITY DEFINER` com o porteiro
`app.eh_super_admin()`. **Nenhuma `service_role` no navegador.**

## Cadastrar o superadmin inicial

Exemplo: habilitar `gabrielpecanha103@gmail.com` como super_admin.
**Senha nunca vai para o repositório** — passe por ambiente, na máquina
do operador.

### Opção A — script (cria a conta no Auth + registra o admin)

```bash
SUPABASE_URL="https://<projeto>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service_role_da_maquina_do_operador>" \
ADMIN_EMAIL="gabrielpecanha103@gmail.com" \
ADMIN_SENHA="<senha-forte-temporaria>" \
ADMIN_NOME="Gabriel Peçanha" \
node scripts/criar-super-admin.mjs
```

Idempotente: rodar de novo só atualiza. Depois é só fazer login normal
com e-mail e senha — o app abre o Backoffice direto.

### Opção B — conta já existe no Auth, só promover por e-mail

Se a conta já foi criada/confirmada no Auth (ex.: convite), promova sem
mexer em senha, no **SQL Editor** do Supabase (roda como `service_role`):

```sql
select app.registrar_super_admin('gabrielpecanha103@gmail.com', 'Gabriel Peçanha');
```

A função resolve o `auth.users` pelo e-mail e faz o upsert em
`internal_admins` (ativo). Se não houver conta com aquele e-mail, ela
avisa — crie/confirme a conta primeiro.

> Por que não uma seed? `internal_admins` tem PK `auth_user_id`, que só
> existe **depois** que a conta nasce no Auth. Não dá para pré-cadastrar
> por e-mail numa migration — daí o passo de operador acima.

## O que dá para fazer

- **Visão geral**: contadores (escolas por status, alunos, alunos ativos
  em 7 dias, coordenadores, escolas sem coordenação).
- **Escolas**: listar (busca implícita pela lista), criar, abrir detalhe.
- **Detalhe da escola**: editar dados básicos (nome, plano, cor, logo,
  cidade/UF, limite, observação interna), **suspender/ativar/cancelar**
  (reversível, com confirmação), e **vincular a coordenação principal**.
- **Logs**: toda ação sensível grava em `admin_logs` (trilha de auditoria
  com antes/depois nas edições).

## Vincular a coordenação principal

No detalhe da escola, painel **“Coordenação principal”**: informe nome e
e-mail. A criação da conta roda na **Edge Function `backoffice-coordenador`**
(a `service_role` vive só na função, nunca no front):

- a função valida pelo token que quem chama é super_admin ativo;
- cria/atualiza a conta **presa à escola** (`app_metadata.escola_id`) —
  a RLS garante que essa coordenação só enxerga a própria escola;
- a senha é **aleatória e descartável**; devolve um **link de definição
  de senha** (convite seguro) para você repassar. Sem SMTP/link, a pessoa
  usa “Esqueci minha senha” no login;
- registra `vincular-coordenador` no `admin_logs`.

Alternativa de operador (linha de comando), idêntica em efeito:
`scripts/criar-coordenacao.mjs` (ver `docs/operacao/operacao.md`).

## Fora do escopo da D0 (não fazer aqui)

Exclusão definitiva de escola, impersonation/login como escola, cobrança
ou integração de pagamento, CRM, e edição pedagógica profunda. Suspensão
**nunca** apaga dados — é reversível.
