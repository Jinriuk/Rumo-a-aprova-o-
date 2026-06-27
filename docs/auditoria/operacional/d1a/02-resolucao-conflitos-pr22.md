# D1A.3 — Resolução dos conflitos do PR #22

> Fase **D1A.3** · branch `claude/d1a-coordenacao-backoffice-clean` · 2026-06-22
> Projeto **Rumo à Aprovação** · Supabase `bdjkgrzfzoamchdpobbl`

---

## 1. Por que existiam conflitos

O PR #22 (branch `claude/d1a-coordenacao-backoffice-n0tx84`) entrou em conflito
com a `main` em 7 arquivos porque a branch D1A **reconciliou** as migrations
0025–0030 a partir do banco de produção (elas estavam no banco mas nunca
commitadas), enquanto as fases S1, DB1 e DB2 já haviam **commitado essas mesmas
migrations na `main`** por caminhos paralelos.

Resultado: o mesmo arquivo existia nas duas branches com conteúdo ligeiramente
diferente (timestamp, formatação, comentários), causando conflitos não-triviais
que a estratégia automática de merge não conseguia resolver com segurança.

Arquivos conflitados no PR #22:

| Arquivo | Origem do conflito |
|---|---|
| `app/src/routes/admin/AreaAdmin.jsx` | D1A.2 (reescrita) × versão da main pré-D1A |
| `app/src/shared/data/index.js` | D1A.1 (status + D0 fns) × versão da main |
| `supabase/migrations/0026_endurecer_search_path_xp.sql` | Reconciliada D1A × S1 commitada |
| `supabase/migrations/0027_escola_suspensa_bloqueio.sql` | Reconciliada D1A × S1 commitada |
| `supabase/migrations/0028_db1_indices_multitenant.sql` | Reconciliada D1A × DB1 commitada |
| `supabase/migrations/0029_db2_policies_consolidadas.sql` | Reconciliada D1A × DB2 commitada |
| `supabase/migrations/0030_db2_comments_inventario.sql` | Reconciliada D1A × DB2 commitada |

---

## 2. Estratégia adotada

**Branch limpa a partir da `main` atual.**

Em vez de tentar resolver os conflitos no PR #22 arquivo a arquivo, criou-se
a branch `claude/d1a-coordenacao-backoffice-clean` diretamente de `origin/main`
(commit `77fb433`) e aplicou-se seletivamente, via `git checkout <branch> -- <arquivo>`,
apenas os arquivos que são **contribuições reais da D1A** — sem reintroduzir os
arquivos de migration que a main já possui.

### Arquivos preservados da `main` (não tocados)

Versão da `main` usada sem alteração para todos os 0025–0030:

| Migration | Branch de origem na main |
|---|---|
| `0025_backoffice_d0.sql` | D0 (PR anterior) |
| `0026_endurecer_search_path_xp.sql` | S1 (PR #19) |
| `0027_escola_suspensa_bloqueio.sql` | S1 (PR #19) |
| `0028_db1_indices_multitenant.sql` | DB1 (PR #20) |
| `0029_db2_policies_consolidadas.sql` | DB2 (PR #21) |
| `0030_db2_comments_inventario.sql` | DB2 (PR #21) |

### Arquivos trazidos da D1A

| Arquivo | Mudança |
|---|---|
| `app/src/App.jsx` | `TelaAcessoSuspenso` — substitui painel vazio |
| `app/src/shared/data/index.js` | `meuPerfil()` lê `status`; funções D0; re-export `escolaOperacional` |
| `app/src/shared/data/operacional.js` | Novo — helper puro espelho de `tenant_operacional()` |
| `app/src/routes/admin/AreaAdmin.jsx` | D1A.2 — reescrita do backoffice |
| `supabase/migrations/0031_d1a_vitrine_status_ativa.sql` | Novo — promove vitrine/beta para `ativa` |
| `tests/operacional.test.mjs` | Novo — 3 testes unitários do helper |
| `tests/coordenacao-acesso-db.test.mjs` | Novo — 12 testes de RLS (coord/aluno/resp × ativa/suspensa/cancelada) |
| `docs/auditoria/d1a/01-correcao-acesso-coordenacao.md` | Novo — diagnóstico técnico |
| `docs/auditoria/d1a/relatorio-d1a-coordenacao-backoffice.md` | Novo — relatório final D1A |

---

## 3. Migration 0031 — reconciliação com o ledger

A migration `0031_d1a_vitrine_status_ativa.sql` foi **aplicada ao banco de
produção** na sessão D1A anterior com a versão `20260622011627`. Ela estava no
branch conflitado mas não na `main`.

Nesta branch limpa, o arquivo é incluído **sem re-aplicação** — o Supabase CLI
reconhece pelo timestamp que já está no ledger e não a reaplicará quando a branch
for mesclada. A migration é idempotente (só promove `implantacao`/`demo`/`piloto`
para `ativa` em slugs específicos) e foi verificada contra o banco real.

Paridade repo ↔ ledger após esta branch:

| Migration | No repo | No ledger (produção) |
|---|---|---|
| 0025_backoffice_d0 | ✅ | ✅ |
| 0026_endurecer_search_path_xp | ✅ | ✅ |
| 0027_escola_suspensa_bloqueio | ✅ | ✅ |
| 0028_db1_indices_multitenant | ✅ | ✅ |
| 0029_db2_policies_consolidadas | ✅ | ✅ |
| 0030_db2_comments_inventario | ✅ | ✅ |
| 0031_d1a_vitrine_status_ativa | ✅ | ✅ |

---

## 4. Build e testes

| Verificação | Resultado |
|---|---|
| `cd app && npm run build` | ✅ 924 módulos, sem erro |
| `node --test operacional.test.mjs` | ✅ 3/3 |
| `node --test regras.test.mjs agregados.test.mjs` | ✅ 10/10 |
| Sem marcadores de conflito em nenhum arquivo | ✅ confirmado |
| E2E | Pulada honestamente — sem projeto Supabase isolado (`e2e-guard` controla via secret) |

---

## 5. Situação do PR #22

O PR #22 (`claude/d1a-coordenacao-backoffice-n0tx84`) permanece aberto mas
**não será mesclado** — substituído por este PR da branch limpa. A branch
original pode ser fechada/arquivada após a mesclagem desta.

---

## 6. Garantias mantidas

- ✅ Migrations 0026–0030 são exatamente as versões da `main` (sem alteração)
- ✅ Migration 0031 presente no repo e no ledger de produção
- ✅ Coordenação de escola ativa carrega o painel normalmente
- ✅ Escola suspensa bloqueia (RLS intacta, `tenant_operacional()` mantido)
- ✅ Front mostra "Acesso suspenso" em vez de painel vazio
- ✅ Backoffice funcional com ações sensíveis + confirmação
- ✅ Sem `service_role` no front (cliente usa só chave anon)
- ✅ RLS não enfraquecida
