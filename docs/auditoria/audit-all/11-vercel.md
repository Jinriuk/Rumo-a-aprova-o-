# Auditoria Vercel

> Projeto `rumo-a-aprova-o` (`prj_Q7tcLOOTptRgdTrfIUoDFWJDx0oO`), team `Jinriuk's projects`.
> Somente-leitura. Secrets não expostos.

## Produção e branch
- **Production Branch = `main`** ✅ — todo deploy `target: production` desde a Fase R tem `githubCommitRef: main`; alias `rumo-a-aprova-o-git-main-jinriuk-s-projects.vercel.app`.
- **Último deploy de produção:** `bffe3ba` (merge **PR #16 / D0**), `state: READY`, `target: production`, criado 2026-06-20 — é o `isRollbackCandidate` atual. **Produção atual sã.**
- Node 24.x. Framework `null` (build custom via `vercel.json`: `cd app && npm install && npm run build`, output `app/dist`, SPA rewrites).

## Domínios
- `rumo-a-aprova-o.vercel.app`
- `rumo-a-aprova-o-jinriuk-s-projects.vercel.app`
- `rumo-a-aprova-o-git-main-jinriuk-s-projects.vercel.app` (confirma o vínculo com `main`)

## Histórico de deploys (últimos 20) — leitura crítica
- Production deploys saem de `main` a cada merge (C1A `58a73b8`, C1B `413fbd8`, C1C `f7bc4f5`, C1D `6cd6b0a`, D0 `bffe3ba`) — todos **READY**, exceto:
- **2 deploys `ERROR`** na janela do **C1B**: o merge #12 (`eee2bc4`, production) e seu preview (`400e0534`) **falharam o build na Vercel**. Foram **sucedidos** pelo merge #13 (`413fbd8`, READY). → houve uma janela em que a produção tentou subir uma build quebrada; corrigida no commit seguinte.
- Antes da Fase R, os production deploys saíam de `claude/naval-system-build-g9h0t5` (#8/#9). A migração de Production Branch para `main` é visível no histórico (a partir de `077cbc6`, “merge: relatório Fase R”).

## Variáveis de ambiente
- Não inspecionadas em detalhe (não expor secrets). Pelo `.env.example` e doutrina do projeto, o front usa **só chaves públicas** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`); `service_role` não vai ao front (confirmado no código). Opcional `VITE_ERROR_REPORT_URL`.
- **Pendência de verificação:** confirmar no painel da Vercel que **apenas** variáveis `VITE_*` públicas estão configuradas no projeto (não verificável via MCP sem ler env). Classificada P3.

## Warnings de build / bundle
- Build de produção emite o aviso **“chunks larger than 500 kB”** (preexistente, cosmético) — reproduzido nesta auditoria. Sem code-splitting/`manualChunks`. Não bloqueante.

## Riscos
- **P2** — Não há gate verde de CI antes do deploy de produção: o merge C1B chegou a publicar uma build **ERROR** (a Vercel reconstrói por conta própria; o GitHub CI não barra merge). Um merge que quebra a build pode ir a produção até o próximo commit.
- **P3** — Bundle único grande (>500 kB) sem splitting.
- **P3** — Conferência manual das env vars da Vercel (só `VITE_*`) pendente.

## Decisão
**Aprovada com ressalvas.** Vercel aponta para `main`, produção atual READY e saindo da `main` — a promessa da Fase R está cumprida no ambiente. Ressalvas: ausência de gate verde pré-deploy (um ERROR já ocorreu) e conferência de env/bundle.
