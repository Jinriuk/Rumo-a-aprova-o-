# Auditoria GitHub / CI

> Repo `Jinriuk/Rumo-a-aprova-o-`. Somente-leitura.

## Branch default e branches vivas
- **Default branch = `main`** ✅ (`git ls-remote --symref origin HEAD` → `refs/heads/main`).
- **3 branches** vivas: `main`, `claude/naval-system-build-g9h0t5`, `claude/demo-base-realista-auditoria-t5ji99`. Nenhuma protegida.
  - `naval-system-build`: ahead 1 / behind 13 — o único commit é um **merge redundante** (PR #10), conteúdo já na `main`. Seguro apagar.
  - `demo-base-realista`: ahead 8 / behind 51 — contém 2 commits de **refactor de frontend “16.8”** (`c07d6e8`, `b71201f`) **não confirmados** na `main`. **Revisar antes de apagar.**
- 4 branches de fase já foram deletadas após a Fase R (limpeza autorizada feita).

## PRs (mergeados na linha principal)
PRs #1–#16 mergeados. #1/#2 (Fases 15/16), #3 (16.9 perf), #4 (auditoria 18), #5 (Fase A), #6 (B-min), #7/#8/#9 (C0.5/Bloco B/docs), #10 (consolidação main), #11–#15 (C1A–C1D), #16 (D0). Base migrou de `naval-system-build` (#1–#9) para `main` (#11–#16) — coerente com a Fase R.
> Nota: a API lista `merged:false` em todos, porém `merged_at` está preenchido e os **merge commits existem no histórico** (`git log`) — são merges reais; o campo é um artefato do conector.

## CI — o ponto crítico desta auditoria

**Workflow `ci.yml`**: 2 jobs — `build-e-unitarios` (build + migrations/seed + `npm test` em Postgres) e `e2e` (Playwright, 42 testes, timeout 25 min, concurrency `e2e-demo-db`). Dispara em `push`/`pull_request`/`workflow_dispatch`, sem filtro de branch.

**Os 30 runs mais recentes: 26 `failure` + 4 `cancelled`. ZERO verdes.**

Decomposição por job (runs na `main`):

| Run (main) | Commit | `build-e-unitarios` | `e2e` | Run final |
|---|---|---|---|---|
| **#112** | `bffe3ba` (D0) | ✅ **success** (211 testes; seed+migrations+unitários) | ❌ **cancelled** (E2E rodou 25 min → timeout) | cancelled |
| #109 | C1D | ❌ failure (seed 13 abortava → testes) | — | failure |
| #106/#103/#100/#97 | C1C…C1A | ❌ failure (mesmo seed) | — | failure |
| #93/#92/#90 | Fase R/C0.5 | ❌ failure | — | failure |

**Leitura:**
1. **O job de unitários/RLS ficou verde a partir da D0** (#112): a correção do `reset-db.sh` (pular seeds 04/13/14) e do seed 13 destravou os 211 testes. Confirmado: presente no repo. Antes disso, **de Bloco B até C1D o job de testes estava vermelho** (seed 13 inserindo em `auth.users` inexistente no Postgres vanilla) — ou seja, **toda a suíte ficou pulada/vermelha por várias fases**, exatamente como a D0 reportou.
2. **O job `e2e` nunca completou verde** — é cancelado por timeout (25 min) em todo run, **inclusive no último da `main` (#112)**. Logo, **a suíte E2E Playwright nunca passou no CI** em nenhum momento do histórico recente.

## “Verde falso” e testes pulados
- Os relatórios de A, B-min, C0.5, C1A–D, D0 repetem “build verde” (verdade — o **build** passa) e tratam “E2E roda no CI” como rede de segurança. **A rede não existe:** o E2E nunca fechou verde. Isso é o principal **“verde falso”** do projeto — não no sentido de teste mascarado, mas de **gate prometido que não funciona**.
- Seeds problemáticas (04/13/14) **foram isoladas corretamente** no `reset-db.sh` (a partir da D0): `case "$f" in */04_*|*/13_*|*/14_*) continue;; esac`. Isso é a correção certa e está no repo.
- O job de unitários **não pula testes** hoje (211 rodam, 0 skipped no #112).

## Testes reproduzidos nesta auditoria
- `npm run build`: ✅ verde (5.99s).
- Lógica pura (`node --test`, 12 suítes): **82/82**; as 8 falhas são `ECONNREFUSED:54322` (testes de banco em `motor.test.mjs`, sem Postgres aqui) — ambiental.
- DB/RLS e E2E: não executáveis localmente (sem Postgres/Chromium); DB/RLS verde no CI #112; E2E nunca verde.

## Riscos
- **P1** — **Suíte E2E não funcional no CI** (cancelada por timeout em todo run); workflow nunca verde de ponta a ponta; foi citada como mitigação em várias fases. É preciso ou consertar (reduzir/segmentar o E2E, subir o timeout, isolar o ambiente) ou **deixar de tratá-la como rede de segurança**.
- **P2** — Sem branch protection / sem gate verde obrigatório antes do merge (merges com build quebrada chegaram a deploy — ver `11-vercel.md`).
- **P3** — `naval-system-build` apagável; `demo-base-realista` a revisar (2 refactors 16.8).

## Decisão
**Aprovada com ressalvas graves no CI.** GitHub está organizado (default `main`, PRs mergeados, seeds isoladas, unitários verdes desde a D0). A ressalva **P1** é o E2E nunca-verde — a verificação automatizada de ponta a ponta é hoje **inexistente na prática**.
