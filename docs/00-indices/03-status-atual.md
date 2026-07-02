# Status Atual do Projeto

**Data:** 2026-07-02 (REG1 — todos os números abaixo foram **medidos nesta data**,
não copiados de relatório anterior; o comando de verificação acompanha cada um)
**Fase encerrada:** FIX1 (PR #60, mergeada 02/07 com CI verde) + REG1 (reconciliação)
**Próxima fase:** decisão do dono — PED2 rodada 2 (produção de conteúdo) e/ou FIX2
(tabela fantasma + fios soltos da auditoria sênior) e/ou PR1 (piloto real)

---

## Resumo executivo

Sistema **liberado para piloto controlado pequeno** (desde SEG2, reafirmado pela
SDB-AUDIT). Entre 26/06 e 02/07 a `main` recebeu **14 rodadas de trabalho**
(REG0 → FIX1 — ver `02-linha-do-tempo.md` §4), incluindo quatro fora do pipeline
numerado. A REG1 reconciliou estes índices com o estado real. **Nenhum P0/P1 de
segurança aberto.** O maior fio solto conhecido é a **tabela fantasma
`solicitacoes_acesso`** (fluxo de recuperação de código promete e grava no vazio
— P1 de produto, documentado desde a auditoria sênior, ainda sem correção).

---

## Números verificados (2026-07-02)

| Métrica | Valor | Comando/evidência |
|---|---|---|
| Testes | **471 / 471 verdes** | `cd tests && bash reset-db.sh && npm test` (Postgres 16 local, migrations + seed 2×) |
| Build de produção | **verde**, sem warning de chunk | `cd app && npm run build` — principal 434 kB (gzip 124 kB), áreas em chunks lazy |
| Migrations no repo | **36** | `ls supabase/migrations \| wc -l` |
| Migrations no ledger remoto | **36** (paridade, drift 0) | `list_migrations` (MCP) — últimas: 0034/0035/0036 aplicadas 29/06 |
| Tabelas públicas remotas | **46, todas com RLS** | `list_tables` (MCP, projeto `bdjkgrzfzoamchdpobbl`) |
| Edge Functions | **6/6 ACTIVE** | `list_edge_functions` (MCP) — versões abaixo |
| TypeScript em `app/src` | 0 arquivos (dívida conhecida) | `find app/src -name '*.ts*' \| wc -l` |

## Estado do Supabase remoto

**Projeto:** `bdjkgrzfzoamchdpobbl` (us-east-1, Free — PostgreSQL 17.6)

| Função | Versão | verify_jwt |
|--------|--------|-----------|
| `provisionar-aluno` | v3 | true |
| `backoffice-coordenador` | v5 | true |
| `revogar-responsavel` | v2 | true |
| `gerar-meta` | v2 | true |
| `virar-semana` | v2 | false (gate por token de serviço, comparação timing-safe) |
| `lgpd-titular` | v2 | true |

CORS por allowlist nas 6 (SEG2). Auditoria completa do banco em
`auditoria/sdb-audit/relatorio-final-sdb-audit.md` (29/06) — ressalvas P2
(storage sem restrição, 13 FKs sem índice, credenciais demo em produção)
seguem válidas.

---

## O que mudou desde o último status (27/06 → 02/07)

| Rodada | Entrega principal |
|---|---|
| PED1 (#48/#50) | Motor de progresso **vivido** sobre o C0: missões fecham por gatilho, níveis persistidos, onboarding do aluno, feedback "+XP" (migration 0033) |
| PED2 rodada 1 (#49) | Maturidade por concurso (fonte única + selo + validador de build + view 0034) e **fábrica versionada** de trilhas — *não* é produção de conteúdo |
| ADM2 (#51) | SuperADM profissional (categoria, risco, go-live, logs filtráveis) |
| PERF1 (#52) | Export CSV, comparativo por turma/concurso, plano de carga 300/500/10k |
| SEC3 (#53) | Virada por escola (0035), atomicidade LGPD (0036), timing-safe |
| FE1 (#54) | Trava de duplo envio real, contratos/DTOs, cancelamento (AbortController) |
| UX1 (#55) | Acessibilidade (`htmlFor` em 11 arquivos), skeletons, modo essencial do aluno |
| Auditoria sênior (#56) | Só documento — achou motor de XP duplicado, tabela fantasma, fios soltos |
| Fechamento 100% (#57) | Liga recorrência + simulado-por-concurso à UI; recharts em chunk lazy; CSP `script-src 'self'` |
| SDB-AUDIT (#58) / SDB-FIX1 (#59) | Auditoria do banco remoto; drift 0034–0036 aplicado, paridade 36==36 |
| FIX1 (#60) | 5 achados da RC1: responsável multi-filhos com seletor, log de auth esperada rebaixado, branch morto removido, contextos de erro, code-splitting por área |

## Fios soltos conhecidos e ABERTOS (verificados hoje no código)

| Item | Severidade | Evidência |
|---|---|---|
| **Tabela fantasma `solicitacoes_acesso`** — Login oferece "recuperar código", grava numa tabela que não existe (nem migration, nem remoto); usuário vê sucesso, coordenação nunca sabe | **P1 (produto)** | `Login.jsx:80` → `index.js › solicitarRecuperacaoCodigo`; `grep solicitacoes_acesso supabase/migrations/` vazio; ausente do `list_tables` remoto |
| **Motor de XP parcialmente duplicado** — `aluno_xp_eventos` (0 rows) + catálogo `patentes` mortos; a UI usa a régua hard-coded `jargao.js` (5 componentes); `aluno_conquistas` é gravada pelo gatilho PED1 (110 rows remotas) mas a aba Conquistas do aluno mostra um catálogo **derivado no cliente**, não o do banco | P2 (arquitetura/dívida) | `grep -rln concederXp\|listarPatentes app/src/routes app/src/modules` → 0; `Conquistas.jsx:62` usa `catalogoConquistas` local |
| Observabilidade sem destino — captura instalada, `VITE_ERROR_REPORT_URL` indefinida em todo lugar | P2 (antes de aluno real) | `observabilidade.js:9`; ausente de `.env.production`/CI |
| E2E nunca roda — 6 specs Playwright pulados sem secrets `E2E_SUPABASE_*` | P2 | `ci.yml` (job `e2e-guard`) |
| Credencial do aluno = código (email/senha derivados) — modelo opaco **documentado** na SEC3, não implementado | P2 | `provisionar-aluno/index.ts:205` (`password: codigo`) |
| `.env.production` versionado (só chaves públicas) | P4 | `ls app/.env.production` |

> **Atenção de processo:** o doc de fechamento (28/06) afirma que a tabela
> fantasma e o motor duplicado tinham sido "corrigidos" antes dele. A REG1
> verificou: **não estão corrigidos na `main` nem no remoto** — nenhum commit no
> histórico toca esses pontos. Tratar essa alegação como incorreta (detalhe em
> `auditoria/reg1/relatorio-reg1-reconciliacao-pos-fechamento.md`).

---

## Escolas cadastradas (remoto)

| Escola | Tipo |
|--------|------|
| Colégio e Curso Ícone | Real (piloto candidata) |
| Escola Piloto I1 | Ambiente de testes |
| Curso Beta Preparatório | Demo / semente |
| Matriz Educação RM | Demo / semente |

(4 escolas, 68 alunos, 76 usuários — `list_tables` 02/07.)

## Pendências (resumo)

Lista completa e priorizada em [`07-pendencias-para-piloto-real.md`](./07-pendencias-para-piloto-real.md);
inventário por camada em [`05-camadas-faltantes.md`](./05-camadas-faltantes.md)
(ambos reconciliados pela REG1 em 02/07).
