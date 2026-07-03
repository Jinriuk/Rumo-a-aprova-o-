# 05 — Camadas Faltantes (Registro Vivo / Fonte Única de Verdade)

**Origem:** REG0 (2026-06-27) · **Reconciliado:** REG1 (2026-07-02)
**Natureza:** governança (não altera produto, banco ou segurança)

> **O que é este documento.** O inventário verificado das 10 camadas de acabamento,
> com **status conferido no código de 02/07** (`main` = `ea64142`, pós-FIX1).
> A versão REG0 deste arquivo ficou defasada em horas: entre 27/06 e 02/07 a `main`
> recebeu PED1, PED2 (rodada 1), ADM2, PERF1, SEC3, FE1, UX1, o fechamento-100%,
> SDB-AUDIT/SDB-FIX1 e FIX1. A REG1 reavaliou **item por item** — nada abaixo foi
> copiado de relatório; itens 🟢 novos têm a evidência medida ao lado.

## Legenda de status

| Símbolo | Significado |
|---|---|
| 🟢 | **Concluído** — verificado no código/banco em 02/07 |
| 🟡 | **Parcial** — parte entregue, parte aberta (com justificativa) |
| 🔴 | **Aberto** — não iniciado |
| ⛔ | **Bloqueado** por julho / Pro / domínio / staging / SMTP (decisão externa) |
| ⚪ | **Fora de escopo** agora (fase futura nomeada) |

**Prioridade:** P1 (bloqueia produto fechado de valor) · P2 (bloqueia dado real de menor) · P3 (importante) · P4 (acabamento/plataforma).

---

## Camada 1 — Motor de progresso "vivido" · fase **PED1** · ✅ entregue (27/06, PRs #48/#50)

| # | Item | Status | Evidência (verificada 02/07) | Prio |
|---|------|:---:|---|:--:|
|1.1| XP concedido por evento + persistido | 🟢 | C0 + PED1: ledger `aluno_eventos_progresso` (1002 rows remotas); `VisaoEstudo.jsx:116` lê `carregarXpPersistido` | — |
|1.2| Missões fecham por gatilho | 🟢 | migration `0033` › `app.motor_avaliar_aluno` (volume+acurácia, idempotente); `carregarMissoesAluno` na tela | — |
|1.3| Nível por matéria persistido | 🟢 | `0033` grava `aluno_niveis` com auditoria; nunca sobrescreve `manual` | — |
|1.4| Onboarding pedagógico na UI | 🟢 | RPC `salvar_onboarding_aluno` + `modules/motor/Onboarding.jsx` | — |
|1.5| Feedback imediato de XP ("+60 XP") | 🟢 | `VisaoEstudo.jsx:96` (`setFeedback({ xp: ganhouXp, … })`) | — |
|1.6| Ledger C0 visível (histórico) | 🟢 | `HistoricoProgresso.jsx` | — |
|1.7| Tagueamento de recorrência com volume útil | 🔴 | ainda amostra (3 questões em `questoes_prova` remoto); é trabalho pedagógico, não código | P3 |
|1.8| Duplicação do motor de gamificação (auditoria sênior §2.1) | 🟢 | **FIX2 (0037, 02/07):** escritores de conquista dos 2 motores viraram no-op; 5 funções mortas removidas do seam; 4 tabelas da 15.5 carimbadas deprecadas (dados preservados); fonte única = ledger C0 + `jargao.js`/derivação no cliente. Resta remoção física (P4, DB3) | — |

## Camada 2 — Conteúdo e trilhas · fase **PED2** · 🟡 infraestrutura pronta, conteúdo aberto

**PED2 rodada 1 (27/06, PR #49) entregou a *fábrica*, não o conteúdo:** fonte única
de maturidade (`maturidade.js`), selo/aviso honesto na UI, gates de cadastro,
validador de build (`validar-conteudo.mjs`), coluna+view no banco (0034) e pipeline
documentado (`docs/conteudo/fabrica-trilhas-concursos.md`). O que resta na camada
é **produção de conteúdo** usando essa fábrica ("PED2 rodada 2").

| # | Item | Status | Evidência | Prio |
|---|------|:---:|---|:--:|
|2.1| Trilha completa do Colégio Naval | 🟢 | `seed/02_trilha_cn.sql`; maturidade `completa` validada pelo build | — |
|2.2| Trilha completa EsPCEx | 🟡 | ~70% (estrutura+literatura); maturidade honesta na UI; faltam as semanas detalhadas | P1 |
|2.3| Trilhas EEAr / EPCAR / ESA | 🔴 | esqueleto — agora **sinalizado** como tal na UI (selo), mas segue esqueleto | P3 |
|2.4| Config Colégio Militar | 🔴 | sem config | P3 |
|2.5| Fábrica/pipeline versionada de conteúdo | 🟢 | PED2 #49: pipeline 6 passos + seed gerado + validador como porteiro | — |

> **Nota REG1 (hipótese testada):** recorrência-na-trilha e simulado-por-concurso,
> ligados pelo fechamento-100% (28/06), **não** alteram os itens 2.x — consomem a
> *estrutura de prova* (0009/0014/0015), não criam *trilha semanal* de concurso.
> São features distintas, já entregues. O escopo remanescente de PED2 é somente
> conteúdo: fechar EsPCEx (2.2), decidir se EEAr/EPCAR/ESA e CM entram no roadmap.

## Camada 3 — Papel professor/tutor + intervenção · fase **ROLE1** · 🔴 não iniciada

| # | Item | Status | Evidência | Prio |
|---|------|:---:|---|:--:|
|3.1–3.5| Papel no schema, RLS por turma, tela de intervenção, anotações, indicador | 🔴 | `check (papel in ('coordenacao','aluno','responsavel'))` inalterado; nenhum merge ROLE1 no histórico | P3 |

## Camada 4 — Escala, relatórios e carga · fase **PERF1** · ✅ código entregue (27/06, PR #52); carga real pendente

| # | Item | Status | Evidência | Prio |
|---|------|:---:|---|:--:|
|4.1–4.3| RPC agregada, paginação, índices de escala | 🟢 | (REG0 já confirmava) | — |
|4.4| Virtualização (react-window) | 🔴 | `grep react-window app/src` → 0 (paginação cobre o essencial) | P4 |
|4.5| Índices compostos de gamificação | 🟡 | tabelas seguem dormentes → baixa urgência; ver item 1.8 antes | P4 |
|4.6| Exportação CSV por turma/escola | 🟢 | `shared/lib/csv.js` + `desempenho/Relatorios.jsx` (usado em `AreaEscola.jsx:111`) | — |
|4.7| Comparação entre turmas / recorte por concurso | 🟢 | `shared/metricas/comparativo.js` + `TabelaComparativo` + `tests/comparativo.test.mjs` | — |
|4.8| Teste de carga 300/10k | 🟡 | plano escrito (`perf1/plano-carga-300-500-10000.md`); execução exige staging (⛔ julho) | P3 |

## Camada 5 — Operação de produção / DevOps · fase **OPS1** · 🔴/⛔ inalterada

| # | Item | Status | Evidência | Prio |
|---|------|:---:|---|:--:|
|5.1| Observabilidade real | 🔴 | gancho instalado, `VITE_ERROR_REPORT_URL` indefinida (auditoria sênior §3.2 — segue verdade em 02/07) | P2 |
|5.2| Alerta de falha da virada + uptime | 🔴 | inexistente | P2 |
|5.3| Backup + restore testado | ⛔ | Pro/julho (SDB-AUDIT reforça: P1 antes de aluno real) | P2 |
|5.4| Região `sa-east-1` | ⛔ | remoto segue `us-east-1` | P2 |
|5.5| Rollback de migrations + gate de versão | 🟡 | runbook existe; SDB-FIX1 exercitou o fluxo com rollback documentado | P3 |
|5.6| Ambiente E2E efêmero | ⛔ | staging/julho | P3 |
|5.7| Separação demo × staging × prod | 🔴 | projeto único; SDB-AUDIT: credenciais demo em produção (P2) | P3 |

## Camada 6 — Endurecimentos de segurança · fase **SEC3** · ✅ rodada entregue (27/06, PR #53); 2 itens abertos

| # | Item | Status | Evidência | Prio |
|---|------|:---:|---|:--:|
|6.1| CORS allowlist + headers A + branch protection + CodeQL | 🟢 | SEG1/SEG2 | — |
|6.2| Credencial de aluno desacoplada do código | 🟡 | **modelo documentado** (`sec3/modelo-credencial-opaca.md`); implementação não: `provisionar-aluno/index.ts:205` ainda `password: codigo` | P2 |
|6.3| Rate limiting no login por código | 🔴 | não implementado (GoTrue) | P2 |
|6.4| Leaked Password Protection | ⛔ | Pro/julho | P3 |
|6.5| `timingSafeEqual` na `virar-semana` | 🟢 | comparação SHA-256 tempo-constante (confirmada pela auditoria sênior §6 e presente no código) | — |
|6.6| `virar_semana()` por escola | 🟢 | migration `0035` (aplicada no remoto 29/06) | — |
|6.7| Atomicidade banco+Auth na exclusão LGPD | 🟢 | migration `0036` (aplicada no remoto 29/06) | — |
|6.8| `.env.production` fora do repo | 🔴 | `app/.env.production` segue versionado (só chaves públicas) | P4 |
|6.9| **NOVO:** CSP `script-src` sem `unsafe-inline` | 🟢 | fechamento-100% (#57): `vercel.json` → `script-src 'self'` (verificado 02/07) | — |

## Camada 7 — Qualidade de frontend · fase **FE1** · ✅ rodada entregue (28/06, PR #54); TS aberto

| # | Item | Status | Evidência | Prio |
|---|------|:---:|---|:--:|
|7.1| Error Boundary global | 🟢 | `ErroFronteira.jsx` | — |
|7.2| Trava de duplo envio | 🟢 | `useEnvioUnico` (trava síncrona por construção) usado nas mutações sensíveis | — |
|7.3| TypeScript no seam | 🔴 | 0 arquivos `.ts/.tsx` em `app/src` (medido 02/07) | P4 |
|7.4| Lógica extraída para hooks/utils | 🟢 | `shared/contratos/` (DTOs), `useEnvioUnico`, `useRecurso`, `shared/metricas/` | — |
|7.5| `AbortController` nos fetches | 🟢 | `comSinal()` no seam + cancelamento no unmount | — |
|7.6| `useReducer` + `React.memo` em listas | 🟡 | `useReducer` em 2 arquivos; `React.memo` 0 — parcial, baixo impacto com paginação | P4 |

## Camada 8 — Acabamento de interface (UX/a11y) · fase **UX1** · ✅ rodada entregue (28/06, PR #55)

| # | Item | Status | Evidência | Prio |
|---|------|:---:|---|:--:|
|8.1| Acessibilidade (`htmlFor`/foco/contraste) | 🟡 | `htmlFor` em **11** arquivos (era 0); foco visível no tema; auditoria axe/contraste completa não registrada | P3 |
|8.2| Skeletons de carga | 🟢 | `CarregandoBloco` + classe `.skel` usados nas áreas | — |
|8.3| Microcopy de erro humana | 🟢 | `mensagemAmigavel` + contextos específicos (FIX1 completou os órfãos) | — |
|8.4| Modo essencial do aluno | 🟢 | `VisaoEstudo.jsx:212` ("Modo essencial ativo — …") | — |
|8.5| Semáforo do responsável + benchmark | 🟢 | `ResumoResponsavel.jsx` (semáforo + faixa "isso é bom?") | — |
|8.6| Aviso de leitura no ranking | 🟡 | `ClassificacaoTurma.jsx` existe; aviso motivacional não localizado — reavaliar na próxima UX | P4 |
|8.7| Itens AV2 (toast, cards clicáveis, dropdown, login 6s) | 🟡 | não reverificados um a um na REG1 | P4 |

## Camada 9 — QA / E2E / release gate · fase **QA3** · 🟡

| # | Item | Status | Evidência | Prio |
|---|------|:---:|---|:--:|
|9.1| Unitários + RLS + CI | 🟢 | **471/471** (medido 02/07; comando no `03-status-atual.md`) | — |
|9.2| Ambiente E2E efêmero | ⛔ | staging/julho; specs existem e são **puladas** sem secrets | P3 |
|9.3| Seletores estáveis | 🟡 | RC1 migrou login para seletor por rótulo; `data-testid` segue 0 | P3 |
|9.4| Teste de carga | 🟡 | plano PERF1 escrito; execução ⛔ staging | P3 |
|9.5| Gate de release formal | 🟡 | CI obrigatório na main; gate documentado não formalizado | P3 |
|9.6| Cobrir fluxos pedagógicos na UI | 🟡 | PED1 ligado + testes DB; E2E de UI ainda não roda | P3 |

## Camada 10 — Arquitetura B2B / plataforma · fases **ARCH1** e **ADM2**

| # | Item | Status | Evidência | Prio | Fase |
|---|------|:---:|---|:--:|:--:|
|10.1–10.2| Backoffice + onboarding sem SQL | 🟢 | D0/HF3/I2 | — | — |
|10.3| SuperADM centro de operação profissional | 🟢 | **ADM2 #51** (categoria, risco, go-live, logs filtráveis; `auditoria/adm2/`) | — | — |
|10.4| Self-service progressivo | 🔴 | provisão segue operada pelo dono | P4 | ARCH1 |
|10.5| Contrato/DTO estável no seam | 🟡 | FE1 criou `shared/contratos/dto.js` (parcial); PostgREST cru ainda domina | P4 | ARCH1 |
|10.6| Fronteira white-label formalizada | 🔴 | sem contrato | P4 | ARCH1 |

---

## Síntese por prioridade (pós-REG1)

| Categoria | Itens | Fase dona |
|---|---|---|
| **P1 — produto** | ~~Tabela fantasma~~ ✅ (FIX2) · trilha EsPCEx (2.2) | PED2 rodada 2 |
| **P2 — antes de aluno real** | Observabilidade com destino (5.1) · alertas (5.2) · backup ⛔ (5.3) · sa-east-1 ⛔ (5.4) · credencial opaca (6.2) · rate limit (6.3) · separação demo/real (5.7) · ~~duplicação XP (1.8)~~ ✅ (FIX2) · storage + FKs sem índice (SDB-AUDIT) | OPS1 · SEC3b · DB3 |
| **P3 — importante** | Conteúdo EEAr/EPCAR/ESA/CM · tagueamento (1.7) · a11y restante (8.1) · seletores/gate QA (9.3/9.5) · carga (4.8/9.4) | PED2 r2 · UX2 · QA3 |
| **P4 — acabamento/plataforma** | TS no seam (7.3) · memo/reducer (7.6) · virtualização (4.4) · `.env` (6.8) · ARCH1 (10.4–10.6) | FE2 · ARCH1 |

## Dependências (o que destrava o quê) — revisão REG1

A tabela REG0 previa RC1 → PED2 → ADM2 → … Na prática, **PED1, PED2 r1, ADM2,
PERF1, SEC3, FE1 e UX1 já aconteceram** (27–28/06). O que resta, em ordem
sugerida de valor:

| Ordem | Fase | Escopo real remanescente | Depende de |
|---|---|---|---|
| 1 | ~~FIX2~~ | ✅ **Feita (02/07):** tabela fantasma removida do Login; duplicação de conquistas fechada (0037). Destino de observabilidade segue aberto (P1-3 do `07`) | — |
| 2 | **PED2 rodada 2** | Conteúdo: fechar EsPCEx; decidir EEAr/EPCAR/ESA/CM — usando a fábrica pronta (2.5) | backlog pedagógico |
| 3 | **DB3** | Remoção física das 4 tabelas deprecadas (0037) + tabelas dormentes (inventário DB2/SDB-AUDIT) | decisão de arquitetura |
| 4 | **PR1** | Piloto real (ver `07-pendencias-para-piloto-real.md`) | SMTP/infra do dono |
| 5+ | ROLE1 · OPS1 · SEC3b · QA3 · FE2 · ARCH1 | como antes | julho/Pro/staging |

**Não fazer agora:** TS em massa (7.3), virtualização (4.4), B2C/modalidades
(ARCH1) — inalterado desde REG0.

---

## Nota de governança

REG1 é **somente documentação** (como REG0): não altera produto, banco, RLS,
Auth ou migrations. Evidências e método em
`docs/auditoria/reg1/relatorio-reg1-reconciliacao-pos-fechamento.md`.
