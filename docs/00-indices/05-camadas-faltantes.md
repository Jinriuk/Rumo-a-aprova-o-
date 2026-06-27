# 05 — Camadas Faltantes (Registro Vivo / Fonte Única de Verdade)

**Fase:** REG0 · **Data:** 2026-06-27 · **Natureza:** governança (não altera produto, banco ou segurança)
**Substitui:** a leitura defasada da auditoria multivisão (Fase 18, ~74/100), anterior a C0/B-min/Fase A/I2/HF3/SEG1/SEG2.

> **O que é este documento.** O inventário verificado das 10 camadas de acabamento que faltam
> para "fechar" o sistema, com **status conferido no código de hoje** (não em texto antigo).
> É a base de todas as fases seguintes (RC1 → ARCH1). Cada item aponta a **fase responsável**.
>
> **Base de versão:** construído sobre a reorganização de docs (branch `claude/docs-reorganizacao`)
> + deploy SEG2 — ainda **não mergeados na `main`**. Os caminhos `docs/auditoria/seguranca/seg1`
> e `.../seg2` refletem a estrutura nova (na `main` antiga ainda são `docs/auditoria/seg1|seg2`).

## Legenda de status

| Símbolo | Significado |
|---|---|
| 🟢 | **Concluído** — verificado no código/doc atual |
| 🟡 | **Parcial** — parte entregue, parte aberta (com justificativa) |
| 🔴 | **Aberto** — não iniciado |
| ⛔ | **Bloqueado** por julho / Pro / domínio / staging / SMTP (decisão externa, não falha de código) |
| ⚪ | **Fora de escopo** agora (fase futura nomeada) |

**Prioridade:** P1 (bloqueia produto fechado de valor) · P2 (bloqueia dado real de menor) · P3 (importante) · P4 (acabamento/plataforma).

---

## Camada 1 — Motor de progresso "vivido" · fase **PED1** · lacuna de VALOR

| # | Item | Status | Evidência (verificada) | Prio |
|---|------|:---:|---|:--:|
|1.1| XP concedido por evento + persistido (não derivado) | 🔴 | `concederXp`/`aluno_xp_eventos` não chamados por tela; aluno vê XP derivado de `motor/jargao.js` | P1 |
|1.2| Missões fecham por gatilho (não por texto) | 🔴 | nenhuma `carregarMissoes`/fechamento em telas | P1 |
|1.3| Nível por matéria gravado pela escola (tela) | 🔴 | `salvarNivelAluno`/`carregarNivelAluno` dormentes; só nível calculado ao vivo | P1 |
|1.4| Onboarding pedagógico na UI | 🔴 | `salvarOnboarding`/`aluno_onboarding` dormentes | P1 |
|1.5| Feedback imediato de XP ("+60 XP") | 🔴 | inexistente na UI | P3 |
|1.6| Ledger C0 visível (histórico) | 🟢 | `HistoricoProgresso.jsx:31` chama `carregarEventosProgresso({limite:50})` | — |
|1.7| Tagueamento de recorrência com volume útil | 🔴 | amostra (~3 questões / <1%); `recorrencia_assunto` dormente na UI | P3 |

## Camada 2 — Conteúdo e trilhas · fase **PED2** · lacuna de ABRANGÊNCIA

| # | Item | Status | Evidência | Prio |
|---|------|:---:|---|:--:|
|2.1| Trilha completa do Colégio Naval | 🟢 | único `supabase/seed/02_trilha_cn.sql` (9 semanas, 33 assuntos) | — |
|2.2| Trilha completa EsPCEx | 🟡 | ~70% (estrutura+literatura); sem 9 semanas detalhadas | P1 |
|2.3| Trilhas EEAr / EPCAR / ESA | 🔴 | esqueleto (2–4 assuntos) | P3 |
|2.4| Config Colégio Militar | 🔴 | sem config | P3 |
|2.5| Fábrica/pipeline versionada de conteúdo | 🔴 | inexistente; conteúdo é trabalho manual | P3 |

## Camada 3 — Papel professor/tutor + intervenção · fase **ROLE1**

| # | Item | Status | Evidência | Prio |
|---|------|:---:|---|:--:|
|3.1| Papel `professor`/`tutor` no schema | 🔴 | `check (papel in ('coordenacao','aluno','responsavel'))` — migration de usuários | P3 |
|3.2| RLS por turma (menor privilégio) | 🔴 | não existe | P3 |
|3.3| Tela de intervenção pedagógica (lista de risco) | 🔴 | não existe | P3 |
|3.4| Anotação/acompanhamento por aluno | 🔴 | não existe | P3 |
|3.5| Indicador "não estudou × estuda e não rende" | 🔴 | dado permite inferir; sem indicador | P3 |

## Camada 4 — Escala, relatórios e carga · fase **PERF1**

| # | Item | Status | Evidência | Prio |
|---|------|:---:|---|:--:|
|4.1| RPC de agregação `resumo_escola()` | 🟢 | `supabase/migrations/0016_painel_agregado.sql`; usada em PainelGestao/AreaEscola | — |
|4.2| Paginação nas listas | 🟢 | `ListaAlunos.jsx:10` (`paginar`), controles "página X de Y" | — |
|4.3| Índices de escala da coordenação | 🟢 | `0023_indices_escala_coordenacao.sql` (`escola_id` em registros/metas/simulados/consentimentos) | — |
|4.4| Virtualização (react-window) em listas grandes | 🔴 | ausente (paginação cobre o essencial) | P3 |
|4.5| Índices compostos por tenant nas tabelas de gamificação | 🟡 | `aluno_xp_eventos`/`aluno_conquistas` sem prefixo `escola_id` (tabelas dormentes → baixa urgência) | P4 |
|4.6| Exportação CSV/PDF por turma/escola | 🔴 | inexistente (só export LGPD de aluno) | P3 |
|4.7| Comparação entre turmas / recorte por concurso | 🔴 | inexistente | P3 |
|4.8| Teste de carga 300/10k em staging | 🔴 | nunca medido | P3 |

## Camada 5 — Operação de produção / DevOps · fase **OPS1** · lacuna de CONFIABILIDADE

| # | Item | Status | Evidência | Prio |
|---|------|:---:|---|:--:|
|5.1| Observabilidade real (error tracking, métricas, tracing) | 🔴 | só `app/src/shared/lib/observabilidade.js` (log cliente); sem Sentry/equivalente | P2 |
|5.2| Alerta de falha da virada (cron) + health check/uptime | 🔴 | inexistente | P2 |
|5.3| Backup automático + restore testado (drill) | ⛔ | Pro/julho | P2 |
|5.4| Região `sa-east-1` (LGPD dado de menor) | ⛔ | ainda `us-east-1` | P2 |
|5.5| Rollback de migrations + gate de versão front↔banco | 🟡 | runbook (`operacao/runbook-migrations-supabase.md`, `rollback.md`); migrations reversíveis não sistemáticas; sem gate | P3 |
|5.6| Ambiente E2E efêmero | ⛔ | ainda demo compartilhado; plano em `operacao/e2e-ambiente.md` (staging/julho) | P3 |
|5.7| Separação formal demo × staging × prod | 🔴 | não formalizada | P3 |

## Camada 6 — Endurecimentos de segurança restantes · fase **SEC3**

| # | Item | Status | Evidência | Prio |
|---|------|:---:|---|:--:|
|6.1| CORS allowlist + headers A + branch protection + CodeQL/Dependabot | 🟢 | SEG1/SEG2 (deploy 6 funções; `auditoria/seguranca/seg2/`) | — |
|6.2| Credencial de aluno desacoplada do código (email/senha opacos) | 🔴 | `provisionar-aluno`: `email=codigo@…`, `senha=codigo` (~59 bits) | P2 |
|6.3| Rate limiting no login por código | 🔴 | não implementado (depende do GoTrue) | P2 |
|6.4| Leaked Password Protection | ⛔ | Pro/julho; senha endurecida ≥8+letras/díg. | P3 |
|6.5| `timingSafeEqual` na `virar-semana` | 🔴 | `virar-semana/index.ts:25` usa `token !== …` | P4 |
|6.6| Blindar `virar_semana()` por escola | 🔴 | escopo global (só `service_role`) | P4 |
|6.7| Atomicidade banco+Auth na exclusão LGPD | 🔴 | log antes da RPC; sem transação distribuída | P4 |
|6.8| `.env.production` fora do repo | 🔴 | `app/.env.production` versionado (só chaves públicas) | P4 |

## Camada 7 — Qualidade de frontend · fase **FE1**

| # | Item | Status | Evidência | Prio |
|---|------|:---:|---|:--:|
|7.1| Error Boundary global | 🟢 | `app/src/shared/ui/ErroFronteira.jsx` | — |
|7.2| Trava de duplo envio (mutações) | 🟢 | `Registrar.jsx:49` (`!ocupado` em `podeSalvar`), botão `disabled`+"Salvando…" (142-143) | — |
|7.3| TypeScript (ao menos no seam) | 🔴 | 0 arquivos `.ts/.tsx` em `app/src` | P4 |
|7.4| Lógica de negócio extraída para hooks/utils | 🟡 | parte em `shared/metricas`, `conteudo/*.js`; parte inline nas telas | P4 |
|7.5| `AbortController` nos fetches | 🔴 | só flag `vivo` de cleanup | P4 |
|7.6| `useReducer` em AreaEscola + `React.memo` em listas | 🔴 | `useState` soltos | P4 |

## Camada 8 — Acabamento de interface (UX/a11y) · fase **UX1**

| # | Item | Status | Evidência | Prio |
|---|------|:---:|---|:--:|
|8.1| Acessibilidade: `htmlFor`/foco/contraste/axe | 🔴 | `htmlFor` em **0** arquivos de `app/src` | P3 |
|8.2| Skeletons de carga | 🔴 | "Carregando…" textual | P4 |
|8.3| Microcopy de erro/vazio humana (não `e.message`) | 🔴 | faixa vermelha técnica | P3 |
|8.4| Redução de densidade/abas + "modo essencial" do aluno | 🔴 | 7 abas aluno / 6 coordenação | P4 |
|8.5| Semáforo do responsável + benchmark "isso é bom?" | 🔴 | inexistente | P4 |
|8.6| Aviso de leitura no ranking + separar "Ajustes" | 🔴 | inexistente | P4 |
|8.7| Itens AV2: toast de sucesso ao registrar; cards de trilha "clicáveis"; dropdown "Mais" instável; login coord ~6s | 🔴 | `produto/av2/07-matriz-de-problemas.md` (MEL-P3-001..004) | P4 |

## Camada 9 — QA / E2E / release gate · fase **QA3**

| # | Item | Status | Evidência | Prio |
|---|------|:---:|---|:--:|
|9.1| Isolamento multi-tenant + unitários + DB real + CI | 🟢 | ~341 testes; `isolamento.test.mjs`; gate `build-e-unitarios` | — |
|9.2| Ambiente E2E efêmero (mata flaky do demo) | ⛔ | depende de staging (julho) | P3 |
|9.3| Seletores estáveis (`data-testid`/`htmlFor`) | 🔴 | seletores de irmão `label+input` | P3 |
|9.4| Teste de carga | 🔴 | inexistente (ver 4.8) | P3 |
|9.5| Gate de release formal documentado | 🟡 | CI verde exigido; gate "unit+isolamento+E2E" não formalizado em doc | P3 |
|9.6| Cobrir fluxos pedagógicos na UI (quando ligados) | 🔴 | depende de PED1 | P3 |

## Camada 10 — Arquitetura B2B / plataforma · fases **ARCH1** e **ADM2**

| # | Item | Status | Evidência | Prio | Fase |
|---|------|:---:|---|:--:|:--:|
|10.1| Backoffice de escolas (criar/editar/status/checklist) | 🟢 | D0 + HF3 (BUG-P1-001 corrigido); `/admin-interno` | — | — |
|10.2| Onboarding sem SQL (códigos, CSV, trilhas, responsáveis) | 🟢 | I2 (`operacional/i2/`) | — | — |
|10.3| SuperADM → centro de operação profissional (planos, saúde, limites, modalidades, demo/real, go-live) | 🔴 | backoffice funcional, não centro de operação | P4 | ADM2 |
|10.4| Self-service progressivo de escola | 🔴 | provisão ainda operada pelo dono | P4 | ADM2/ARCH1 |
|10.5| Contrato/DTO estável no seam (hoje PostgREST cru) | 🔴 | `shared/data/index.js` usa `supabase.from(...)` direto | P4 | ARCH1 |
|10.6| Fronteira white-label formalizada/versionada | 🔴 | white-label leve (logo/cor/nome) sem contrato | P4 | ARCH1 |

---

## Síntese por prioridade

| Categoria | Camadas/itens | Fases |
|---|---|---|
| **Bloqueia produto fechado de valor** | C1 (motor vivido) + C2.2 (EsPCEx) | PED1, PED2 |
| **Bloqueia dado real de menor** | 5.1–5.4 (observabilidade, alertas, backup/restore, sa-east-1) + 6.2–6.3 (credencial, rate limit) | OPS1, SEC3 |
| **Endurecimento de segurança** | 6.4–6.8 (LPP, timingSafe, virada por escola, atomicidade LGPD, .env) | SEC3 |
| **Escala de escola média** | 4.4–4.8 (carga, exportação, comparação de turmas) | PERF1 |
| **Acabamento** | C7 (resto), C8 (a11y/UX) | FE1, UX1 |
| **Plataforma** | C3 (professor), C9 (release gate), C10 (operador/arquitetura) | ROLE1, QA3, ADM2, ARCH1 |

---

## Tabela de dependências (qual camada destrava a seguinte)

| Ordem | Fase | Depende de | Destrava | Não fazer agora |
|---|---|---|---|---|
| 0 | **REG0** | docs reorg + SEG2 | tudo (fonte de verdade) | corrigir bug, criar tela, migration |
| 1 | **RC1** | REG0 | correção em massa com matriz real | corrigir antes de mapear |
| 2 | **PED1** | RC1 | valor pedagógico (C9.6, UX do motor) | conteúdo novo antes do motor |
| 3 | **PED2** | PED1 | abrangência (vender fora do CN) | prometer 5 concursos sem fábrica |
| 4 | **ADM2** | PED2 | operação profissional, demo/real | self-service pleno cedo demais |
| 5 | **ROLE1** | ADM2 | multi-tutor sem violar privilégio | dar acesso de coordenação ao tutor |
| 6 | **PERF1** | ROLE1 | escola média + relatórios | testar carga em produção real |
| 7 | **OPS1** | PERF1 | dado real de menor (LGPD/backup) | dado real antes de sa-east-1/backup |
| 8 | **SEC3** | OPS1 | muitos alunos reais | enfraquecer RLS p/ passar teste |
| 9 | **FE1** | SEC3 | refator seguro (DTO/hooks) | reescrever tudo / TS de uma vez |
| 10 | **UX1** | FE1 | "premium" / a11y | mexer em segurança/arquitetura |
| 11 | **QA3** | UX1 | gate de release confiável | gate sem ambiente efêmero |
| 12 | **ARCH1** | QA3 | escalar para dezenas de escolas | B2C/modalidades sobre base instável |

**Itens que NÃO devem ser feitos agora:** TS em massa (7.3), virtualização (4.4) e índices de gamificação (4.5) enquanto as tabelas estão dormentes, B2C/novas modalidades (ARCH1) antes de PED1+OPS1, e qualquer mudança de RLS/Auth/branch protection para "passar teste".

---

## Quadro de decisão (o que corrigir antes de cada marco)

| Marco | Pré-requisitos (itens) |
|---|---|
| **Vender / mostrar demo controlada** | Nada bloqueia hoje. Higiene de dados demo + domínio próprio (opcional). Itens ⛔ de julho/Pro **não** bloqueiam demo. |
| **Aluno real (dado de menor)** | 5.3 backup+restore, 5.4 sa-east-1, 5.1–5.2 observabilidade/alertas, 6.2–6.3 credencial+rate limit, consentimento dos pais (contrato/DPA) |
| **Escola "Matriz" (média, ~150–300)** | + 4.6 exportação, 4.8 carga em staging, ADM2 (operação profissional), PED1+PED2.2 (valor real) |
| **B2C (aluno paga direto)** | + ARCH1 (contrato/DTO, white-label, self-service), ROLE1, modelo de billing — **não iniciar antes de PED1+OPS1** |
| **Novas modalidades** | + fábrica de conteúdo (2.5), ARCH1 — base estável obrigatória |

---

## Nota de governança

REG0 é **somente documentação**: não altera produto, banco, RLS, Auth, segurança, migrations, telas, staging, backup, domínio ou SMTP. Itens marcados 🟢 foram conferidos no código/doc atual (ver `docs/auditoria/reg0/relatorio-reg0-inventario-camadas.md`, seção de evidências). Itens ⛔ são bloqueio de **dado real**, não de demo controlada.
