# DB1 — Fechamento na `main`

> Registro oficial do encerramento da fase **DB1** e sua consolidação na
> `main`. Data: 2026-06-21 · Projeto Supabase `bdjkgrzfzoamchdpobbl`
> (`us-east-1`, free) · Repo `Jinriuk/Rumo-a-aprova-o-`.

## 1. Branch de origem

- Branch DB1: `claude/db1-supabase-consolidacao-xb6ewf`.
- Base: `main` em `1f7918e` (S1 mergeada — PR #19). A branch DB1 era
  **`main` + 1 commit** (`0fb1532`) → fast-forward limpo, **sem conflito**.

## 2. Commit mergeado

- PR: **#20** (`DB1: consolidação, auditoria e higienização do Supabase`).
- Commit da DB1: `0fb1532`.
- Merge commit na `main`: **`9fdeb3d`** (merge method: merge commit).
- Diff: **12 arquivos, +1040 linhas, 0 remoções** (10 relatórios +
  `0028_db1_indices_multitenant.sql` + script de reconciliação do ledger).
- **Nenhum** `drop`/`truncate`/`delete`/`drop column`/`rename` no diff
  (verificado por grep antes do merge).

## 3. Testes rodados e resultado

| Verificação | Comando | Resultado |
|---|---|---|
| Build de produção | `app: npm run build` (vite) | ✅ verde (923 módulos) |
| Banco de teste | `tests/reset-db.sh` (migrations + seed 2×, com 0028) | ✅ idempotência exercitada |
| Suíte completa | `tests: node --test` | ✅ **222 / 222 pass · 0 fail · 0 skip** |
| CI do PR — `build-e-unitarios` | GitHub Actions (run 27914189618) | ✅ success |
| CI do PR — `e2e-guard` | GitHub Actions | ✅ success |
| CI do PR — `e2e` | GitHub Actions | ⏭️ skipped (honesto — sem ambiente isolado/secrets) |
| CI do PR — Vercel Preview Comments | Vercel | ✅ success |

Cobertura da suíte: lógicos + DB/RLS + **suspensão de escola** +
**backoffice** + **exam_tag** + isolamento multi-tenant + seed/vitrine
(idempotência). Merge feito **somente após** o gate `build-e-unitarios`
ficar verde.

## 4. Status Vercel

- Integração Vercel ↔ GitHub **ativa e confirmada**: o check *Vercel
  Preview Comments* rodou e passou no PR #20.
- `vercel.json`: build `cd app && npm install && npm run build`, output
  `app/dist`; **Production segue a `main`** → o merge dispara deploy de
  produção automaticamente.
- Observação: o token MCP da Vercel disponível nesta sessão retornou
  `list_projects` vazio para o time (provável escopo SAML), então o ID do
  deployment não foi enumerado por aqui — o status acima é baseado na
  evidência do check do GitHub e na configuração do reppositório, sem
  inventar dados.

## 5. Status Supabase / última migration

- Ledger remoto: **28 migrations**; última = **`0028_db1_indices_multitenant`**.
- Reconciliação confirmada: ledger tem `0024_motor_progresso` e **não**
  tem mais `0022_motor_progresso`.
- **Paridade repo ↔ remoto: 28 == 28** (sem diferença perigosa).
- DB1 já havia sido aplicada ao banco real durante a fase (índices
  aditivos + reconciliação de metadado); o merge na `main` apenas alinha
  o repositório ao que já está no banco. Nenhuma migration destrutiva.

## 6. Smoke test pós-merge

Cobertura por papel/escola validada pela suíte verde (isolamento,
suspensão, backoffice) sobre o commit mergeado, **mais** verificação
read-only ao vivo dos dados de produção:

| Item | Evidência | OK |
|---|---|---|
| login aluno / responsável / coordenação | `isolamento.test.mjs` (RLS por papel) verde | ✅ |
| login superadmin / backoffice `/admin-interno` | `backoffice-db.test.mjs` + `internal_admins`=1 ao vivo | ✅ |
| aluno CN | 22 alunos com eventos `exam_tag='cn'` (ao vivo) | ✅ |
| aluno EsPCEx | 12 alunos com eventos `exam_tag='espcex'` (ao vivo) | ✅ |
| escola ativa | vitrine/beta operacionais | ✅ |
| escola suspensa (bloqueio) | `suspensao-db.test.mjs` (5 testes) verde | ✅ |
| ranking | `vw_aluno_xp_total` top XP = 1560 (ao vivo) | ✅ |
| ficha do aluno (Lucas) | 15 registros de estudo (ao vivo) | ✅ |
| vitrine sem órfãos | 0 órfãos em `alunos_turmas`/eventos (ao vivo) | ✅ |

> Observação: ao vivo as duas escolas estão em `implantacao` (não há
> escola `suspensa` no dado de produção agora) — o **bloqueio** de
> suspensão é provado pela suíte, não pelo estado atual do dado.

## 7. Pendências restantes (herdadas/abertas)

- **P1 (dono/operacional):** backup/plano, região `sa-east-1`,
  leaked-password (toggle Auth). Fora do escopo de código.
- **P1 (doc):** runbook de migrations ("não usar `db push` cego") — será
  entregue na **DB2** (`docs/operacao/runbook-migrations-supabase.md`).
- **P2 (DB2):** de-duplicar 7 `multiple_permissive_policies`; investigar
  tabelas Fase 15 vazias; decidir as duas "trilhas".
- **P0: nenhum.**

## 8. Conclusão

**DB1 oficialmente fechada na `main`** (PR #20 / merge `9fdeb3d`), com
GitHub, Vercel e Supabase **alinhados e sem divergência perigosa**.
Nenhum force push, nenhuma sobrescrita de `main`, nenhuma branch apagada.
Liberado para iniciar a **DB2**.
