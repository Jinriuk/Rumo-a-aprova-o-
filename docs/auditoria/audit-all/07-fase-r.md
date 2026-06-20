# Fase R — Branches, criação/consolidação da main, Vercel apontando para main

## 7.1 Promessa da fase
Higienizar branches, criar/consolidar a `main`, torná-la o default do GitHub, apontar a Production Branch da Vercel para `main`, e apagar/justificar branches antigas — tudo de forma não-destrutiva e autorizada.

## 7.2 Evidência no código/repo
- `docs/relatorios/relatorio-fase-r-higienizacao-branches.md` (+ `docs/auditoria/relatorio-final-fase-r.md`).
- A `main` consolida Fase 15, C0, C0.5, Bloco B, e depois C1A–D0.

## 7.3 Evidência no ambiente (GitHub + Vercel, hoje)
- **Default branch = `main`** ✅ (`git ls-remote --symref origin HEAD` → `refs/heads/main`). A troca pendente no relatório R **foi executada**.
- **Vercel Production Branch = `main`** ✅: todos os deploys de produção desde a Fase R têm `githubCommitRef: main`; alias `rumo-a-aprova-o-git-main-…`. Último de produção = `bffe3ba` (merge D0), **READY**.
- **Branches remanescentes (3):** `main`, `claude/naval-system-build-g9h0t5`, `claude/demo-base-realista-auditoria-t5ji99`.
- **4 branches mergeadas já foram deletadas** desde o relatório R (`phase-c0-5-audit-rebuild`, `infrastructure-scaling-study`, `rumo-aprovacao-audit`, `phase-15-pedagogical`) — a limpeza autorizada aconteceu.

## 7.4 O que foi realmente entregue
A consolidação na `main` está completa e operante: `main` é o default e a Production Branch; as 4 branches mergeadas seguras foram removidas; CI e Vercel seguem a `main` sem quebra.

## 7.5 O que não foi entregue
- **`claude/naval-system-build-g9h0t5` (a antiga oficial) ainda existe.** ahead 1 / behind 13 vs `main`. O “1 commit único” é o **merge commit redundante** (PR #10 “Merge pull request #10 from Jinriuk/main”), cujo conteúdo (relatório Fase R) **já está na `main`**. → **Sem conteúdo único real; seguro deletar.**
- **`claude/demo-base-realista-auditoria-t5ji99` ainda existe.** ahead 8 / behind 51. Dos 8 commits únicos: motor C0 (já reconciliado na `main` como 0024) e seed “Instituto Vitrine Militar” (superado pelo seed 13) são redundantes; **mas 2 commits — `c07d6e8` e `b71201f` (“refactors de frontend, auditoria 16.8”)** — **não há evidência de que foram incorporados** na `main`. → **Não deletar sem revisão.**

## 7.6 Divergências
- O **relatório R** descreve o estado em 2026-06-19 (default ainda `naval`, nada apagado, tudo pendente de autorização). A **realidade hoje** evoluiu: default já é `main`, Vercel já aponta para `main`, 4 branches já foram apagadas. Ou seja, o plano R foi **executado depois** do relatório — divergência **a favor** (mais feito que o relatório registra).
- Permanece aberto exatamente o que o relatório marcou como “revisar antes de apagar”: a branch `demo-base-realista` com os 2 refactors 16.8.

## 7.7 Riscos
- **P3** — `naval-system-build` órfã (sem conteúdo único): ruído, seguro apagar.
- **P3** — `demo-base-realista`: 2 commits de refactor de frontend (16.8) possivelmente úteis e não incorporados — risco de perda de trabalho se apagada sem revisão; risco de confusão se mantida indefinidamente.

## 7.8 Decisão da fase
**Aprovada com ressalvas.** O objetivo central (main = default + Vercel; limpeza das mergeadas) está cumprido e operante. As ressalvas são duas branches remanescentes: uma trivialmente descartável (`naval`) e uma que **exige decisão humana** sobre 2 refactors de frontend (`demo-base-realista`).
