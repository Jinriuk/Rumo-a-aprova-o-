# Relatório Final — D0: Backoffice Interno / Superoperador

> Branch: `claude/d0-backoffice-superoperador` · base: `main` (C1D mergeada,
> PR #15) · escopo: mínimo operacional seguro para o dono administrar
> escolas **sem entrar no Supabase**.

---

## 1. Resumo executivo

- **D0 concluída?** Sim. A pergunta-central — *“consigo operar uma nova
  escola sem entrar no Supabase?”* — é **sim**: criar, editar,
  suspender/ativar/cancelar, definir plano/status e vincular a
  coordenação principal, tudo por `/admin-interno`, com log de cada ação.
- **Superadmin opera escolas?** Sim, via RPCs `SECURITY DEFINER` com
  porteiro e uma Edge Function segura para a conta da coordenação.
  **Nenhuma `service_role` no front.**
- **Há P0/P1?** Um **P0 pré-existente foi encontrado e corrigido**: o
  passo *“Migrations + seed”* do CI estava **vermelho desde o “Bloco B”**
  (a seed 13 da vitrine insere em `auth.users`, que não existe no Postgres
  vanilla do CI, e o `reset-db.sh` não a pulava), o que fazia **toda a
  suíte de testes ser pulada**. Corrigido (ver §4 e §6). Sem P0/P1 abertos.
- **Pode seguir para DB1 ou S1?** Sim. Recomendação em §8.

Muito do alicerce já existia das fases 17.4/17.5 (`internal_admins`,
`admin_logs`, gate `eh_super_admin`, criar/listar/detalhar escola). A D0
**completou** o ciclo operacional sobre essa base, sem duplicar tabela.

---

## 2. Modelo de acesso

- **Fonte da verdade:** tabela `internal_admins` (`auth_user_id` = `auth.users.id`,
  `email`, `nome`, `ativo`). O papel `super_admin` **não** é um `usuarios`
  (que é sempre de uma escola) e não se mistura com `coordenacao`.
- **Quem acessa:** autenticado no Supabase Auth **e** com linha em
  `internal_admins` com `ativo = true`. O gate é o banco (`app.eh_super_admin()`),
  não a tela.
- **Bloqueio do usuário comum:**
  - não autenticado → login;
  - autenticado e não-admin que abre `/admin-interno` → tela **“Acesso
    restrito”** (App.jsx), sem vazar dado;
  - admin com `ativo = false` → tratado como não-admin (revogar = `ativo=false`);
  - no banco, qualquer não-super_admin que chame as RPCs recebe
    `acesso negado`; anon recebe `permission denied`.
- **Admin inicial (`gabrielpecanha103@gmail.com`):** sem senha no
  repositório. Duas vias documentadas em
  `docs/operacao/backoffice-superoperador.md`:
  1. `scripts/criar-super-admin.mjs` (cria conta no Auth + registra admin),
     senha só por variável de ambiente na máquina do operador;
  2. `select app.registrar_super_admin('gabrielpecanha103@gmail.com', 'Gabriel Peçanha');`
     no SQL Editor — promove por e-mail uma conta **já existente** no Auth,
     sem mexer em senha.

---

## 3. Funcionalidades implementadas

| D0 | Funcionalidade | Onde |
|---|---|---|
| D0.1 | **Dashboard** com contadores (escolas por status, alunos, alunos ativos 7d, coordenadores, escolas sem coordenação) | `backoffice_dashboard()` + `PainelVisaoGeral` |
| D0.2 | **Lista de escolas** (nome, slug, status, plano, alunos, turmas, coord., último acesso) | `backoffice_escolas()` + `AreaAdmin` |
| D0.3 | **Detalhe da escola** (status, plano, marca, composição, checklist de implantação) | `backoffice_detalhe_escola()` + `DetalheEscola` |
| D0.4 | **Criar escola** (nasce em implantação; só log, sem criar aluno/coord automático) | `backoffice_criar_escola()` + `NovaEscola` |
| D0.5 | **Editar** (nome, plano, cor, logo, cidade/UF, limite, observação; `atualizada_em`; log antes/depois) | `backoffice_editar_escola()` + `EditarEscola` |
| D0.6 | **Suspender / ativar / cancelar** (reversível, com confirmação; nunca apaga dado) | `backoffice_definir_status()` + `AcoesStatus` |
| D0.5/6 | **Plano e status** alteráveis com log específico | idem acima |
| D0.7 | **Coordenação principal** (conta presa à escola, senha aleatória + link de definição; convite seguro) | Edge Function `backoffice-coordenador` + `Coordenacao` |
| D0.8 | **Logs** de toda ação sensível | `admin_logs` |

Status suportados: `implantacao`, `demo`, `piloto`, `ativa`, `suspensa`,
`cancelada` (ampliação **aditiva** do conjunto da 0021 — nada removido).
Planos sugeridos no front: `demo`, `essencial`, `gestao`, `performance`,
`licenca` (campo texto livre no banco, respeitando o modelo atual).

---

## 4. Banco de dados

**Migration nova:** `supabase/migrations/0025_backoffice_d0.sql` (aditiva,
idempotente, anon revogado na própria migration).

- **`escolas`** — colunas novas: `observacao text`, `atualizada_em timestamptz`.
- **`escolas_status_check`** — recriada com o conjunto ampliado de status.
- **RPCs `SECURITY DEFINER` (porteiro `app.eh_super_admin()`):**
  - `public.backoffice_dashboard()` → `jsonb` de contadores;
  - `public.backoffice_editar_escola(...)` → edita dados básicos + log antes/depois;
  - `public.backoffice_definir_status(escola, status)` → suspender/ativar/etc + log;
  - `app.registrar_super_admin(email, nome)` → promove admin por e-mail
    (só `service_role`; resolve `auth.users`).
- **Edge Function nova:** `supabase/functions/backoffice-coordenador`
  (`verify_jwt=true` + checagem de `internal_admins` no código). Registrada
  em `supabase/config.toml`.

Já existentes e reaproveitados (fases 17.4/17.5): `internal_admins`,
`admin_logs`, `app.eh_super_admin()`, `public.sou_super_admin()`,
`backoffice_escolas()`, `backoffice_criar_escola()`, `backoffice_detalhe_escola()`.

**Correção de harness (pré-existente):**
`tests/reset-db.sh` passa a pular as seeds **13 e 14** (vitrine/demo que
dependem de `auth.users`, como a 04 já pulada); `supabase/seed/13_*.sql`
teve o `create temp table ... on commit drop` corrigido (sob `psql -f`
em autocommit a temp table era descartada antes do INSERT).

---

## 5. Segurança / RLS

- **Nada de RLS enfraquecida.** As tabelas `escolas`/`alunos`/`usuarios`
  continuam com policies tenant-scoped. O super_admin **não** lê essas
  tabelas direto (não tem `escola_id` no token) — só pelas RPCs
  `SECURITY DEFINER` com porteiro. *Provado em teste:* `select * from escolas`
  como super_admin volta vazio; o dado vem só pela RPC.
- **`service_role` nunca no front.** A única operação que exige privilégio
  elevado (criar conta de coordenação) roda na Edge Function, onde a chave
  vive (`_shared/contexto.ts`). Confirmado: nenhuma ocorrência de
  `service_role`/`SERVICE_ROLE` em `app/`.
- **Isolamento do coordenador:** a conta nasce com `app_metadata.escola_id`
  da escola alvo; a RLS de `usuarios`/`alunos` garante que ela só enxerga
  a própria escola (coberto pela suíte `isolamento.test.mjs` existente).
- **Anon revogado** explicitamente das RPCs novas (lição das migrations
  0018/0020).
- **Senha:** nunca hardcoded; a da coordenação é aleatória e descartável,
  com link de definição (convite). O admin inicial usa env/segredo do operador.

---

## 6. Testes

**Unitários + RLS (Postgres real, mesmas migrations de produção):**

```
cd tests && bash reset-db.sh && npm test
# 211 testes · 211 pass · 0 fail · 0 skipped
```

Novos casos em `tests/backoffice-db.test.mjs` (D0):

- dashboard: super_admin recebe contadores; não-admin e anon recusados;
- editar: altera dados e grava antes/depois; `NULL` não apaga campo
  (coalesce) e **não afeta outra escola**;
- status: suspender/ativar geram a ação certa no log; status inválido
  recusado; coordenação (não-admin) recusada em editar/status.

**Build de produção:** `cd app && npm run build` → **verde**.

**CI:** o job `build-e-unitarios` estava **vermelho desde o Bloco B**
(passo de seed abortando → testes pulados). Com a correção do `reset-db.sh`
e da seed 13, o passo de seed conclui e os 211 testes rodam. O job de
**build** já era verde (era a isso que os relatórios anteriores se referiam).

**Validação manual (§12 do briefing):** roteiro em
`docs/operacao/backoffice-superoperador.md`. Pendente de execução pelo
operador no ambiente real (criar admin → login → listar → criar/editar/
suspender/ativar → vincular coordenação → conferir logs → testar bloqueio
com usuário comum). Os equivalentes server-side estão cobertos por teste.

---

## 7. Pendências

- **P0:** nenhuma aberta. *(Resolvido nesta entrega: CI de testes vermelho
  por seed da vitrine — §4/§6.)*
- **P1:** nenhuma.
- **P2:**
  - Validação manual no ambiente real ainda a executar pelo operador.
  - Efeito de **suspensão** hoje é de status (campo + bloqueio de tela do
    backoffice); um **bloqueio global de login** por escola suspensa
    (ex.: checagem no carregamento de perfil/RLS) fica para fase futura —
    o campo já está pronto.
- **P3:**
  - E2E Playwright do backoffice depende de uma conta super_admin no
    ambiente E2E (hoje inexistente); cobertura atual é DB + manual.
  - Busca/paginação da lista de escolas (hoje lista simples) quando o nº
    de escolas crescer.

---

## 8. Próxima recomendação

**Seguir para S1.** A D0 entrega a operação mínima confiável e o CI de
testes voltou ao verde — base sólida para evoluir produto/segurança. Antes
de S1, recomenda-se um **patch curto** apenas para a **validação manual**
no ambiente real e, se desejado, o **bloqueio global por escola suspensa**
(P2). **DB1** pode vir depois, sem urgência — o modelo de dados da D0 é
aditivo e não bloqueia.
