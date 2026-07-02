# REG1 — Reconciliação de Estado Pós-Fechamento

**Data:** 2026-07-02 · **Branch:** `claude/fix1-rc1-corrections-40rcya` (reutilizada pós-merge do PR #60, rebase em `origin/main` = `ea64142`)
**Natureza:** verificação e documentação — **nenhum** código de produto, migration ou RLS alterado.

---

## 1. Objetivo

Os índices vivos (`00-indices/`) estavam congelados em 27/06 (pós-SEG2) e não
sabiam que 10 rodadas de trabalho tinham entrado na `main` entre 27/06 e 02/07 —
incluindo quatro fora do pipeline numerado (auditoria sênior, fechamento-100%,
SDB-AUDIT, SDB-FIX1). A REG1 verificou cada afirmação relevante desses relatórios
**contra o código/banco de hoje** e reescreveu os índices.

## 2. Confirmação do merge do FIX1 (tarefa 1)

| Verificação | Resultado | Evidência |
|---|---|---|
| PR mergeado? | **Sim** — PR #60, `merged: true`, por `Jinriuk`, em `2026-07-02T18:50:13Z` | GitHub API (`pull_request_read`) |
| Commit na main? | **Sim** — squash `ea64142` (base `3cd0394`) | `git log origin/main -1` |
| Conteúdo íntegro? | **Sim** — diff entre meu commit (`faecb59`) e a main = **1 linha**: remoção do import não usado `ESCOLA_B` em `tests/fix1-responsavel-irmaos.test.mjs` (ajuste benigno de lint feito no merge) | `git diff faecb59 origin/main` |
| CI pós-merge? | **Verde** — workflow `CI` em `ea64142`: `completed / success` (02/07 18:50) | GitHub Actions (`actions_list`) |
| Testes agora? | **471/471** — o número alegado pelo FIX1 **confirmado** por execução própria | comando abaixo |

```
cd tests && PGPORT=54322 bash reset-db.sh && npm test
# tests 471 · pass 471 · fail 0        (Postgres 16 local, migrations+seed 2×)
cd app && npm run build                # verde; index 434.47 kB (gzip 124.18)
```

## 3. Migrations repo ↔ ledger (verificação independente)

```
ls supabase/migrations | wc -l   → 36
list_migrations (MCP, bdjkgrzfzoamchdpobbl) → 36 entradas;
  últimas: 0034 (20260629122447) · 0035 (20260629122517) · 0036 (20260629122541)
```
**Paridade 36 == 36 — drift 0.** A correção SDB-FIX1 é real e permanece.

## 4. Auditoria sênior + fechamento: o que está de fato na `main` (tarefa 2)

| Afirmação | Verificação 02/07 | Veredito |
|---|---|---|
| `TrilhaConcurso.jsx` importa `recorrencia.js` | `TrilhaConcurso.jsx:19` importa `consolidarRecorrencia/prioridadeSugerida/relatorioIncidencia` | ✅ **na main** |
| `SimuladoConcurso.jsx` existe e é usado | arquivo existe; importado por `Progresso.jsx` (seletor de formato) | ✅ **na main** |
| CSP sem `unsafe-inline` no `script-src` | `vercel.json` → `script-src 'self'` | ✅ **na main** |
| Code-splitting | recharts em chunk (fechamento) + áreas por papel (FIX1); principal 434 kB | ✅ **na main** |
| **Motor de XP duplicado "corrigido"** | `0013_xp_patentes_conquistas.sql`, `seed/10_gamificacao.sql`, `concederXp`/`listarPatentes`/etc. no seam e `tests/gamificacao-db.test.mjs` **todos presentes**; consumo na UI: **0** componentes (`grep` em routes/modules); `aluno_xp_eventos` existe no remoto com 0 rows; a régua de patente da UI segue `jargao.js` (5 componentes) | ❌ **NÃO corrigido** |
| **Tabela fantasma "corrigida"** | `Login.jsx:80` ainda chama `solicitarRecuperacaoCodigo` → INSERT em `solicitacoes_acesso`; **nenhuma migration** cria a tabela (`grep` vazio) e ela **não existe no remoto** (`list_tables`, 46 tabelas conferidas); nenhum commit no histórico (`git log --all -S`) toca o ponto | ❌ **NÃO corrigido** |

### 4.1 A alegação falsa do fechamento

O `fechamento-100-codigo-2026-06-28.md` abre com: *"Continuação direta de
auditoria-senior… e das duas correções já aplicadas (tabela-fantasma e motor de
XP duplicado)"*. A REG1 procurou essas correções em **todo o histórico**
(`git log --all`, todas as branches remotas) e no banco remoto: **não existem**.
O PR #56 (auditoria sênior) só adicionou o documento; o PR #57 (fechamento) tocou
recorrência/simulado/CSP/bundle — nada de tabela fantasma nem de motor duplicado.

Consequência prática: os dois achados mais graves da auditoria sênior (§3.1
tabela fantasma — ALTO; §2.1 motor duplicado — CRÍTICO de dívida) **continuam
abertos** e agora estão classificados nos índices (P1-5 e P2-8 do
`07-pendencias`, itens 1.8 e 6.2 do `05-camadas`).

### 4.2 Nuance verificada do motor de XP (estado real, mais fino que o relatório de 28/06)

- **Vivo:** `aluno_eventos_progresso` (C0/PED1) é a fonte de XP — 1002 rows
  remotas; a UI lê por `carregarXpPersistido` (`VisaoEstudo.jsx:116`).
- **Vivo via gatilho, mas invisível:** `aluno_conquistas` recebe escrita do
  `motor_avaliar_aluno` (0033) — 110 rows remotas — porém a aba Conquistas do
  aluno renderiza um **catálogo derivado no cliente** (`Conquistas.jsx:62`),
  não o do banco.
- **Morto:** `aluno_xp_eventos` (0 rows), catálogo `patentes` (a régua exibida é
  `jargao.js`), e as cinco funções de seam da 15.5 (0 consumidores).

## 5. Testes: reconciliação da contagem (por quê cada número existiu)

| Número citado | Onde | Momento em que era verdade |
|---|---|---|
| 341 | `03-status-atual` (27/06) e SDB-AUDIT (29/06) | pós-SEG2, **antes** de PED1/PED2/…; em 29/06 já estava defasado em 118 testes |
| 456 | auditoria sênior (28/06, medido) | pós-UX1, antes do fechamento |
| 459 | fechamento (28/06, medido) | +3 do fluxo de simulado |
| **471** | **REG1 (02/07, medido)** | +7 RLS responsável-irmãos +5 unitários de erros (FIX1) |

## 6. Causa-raiz do desalinhamento (nota de processo, tarefa 4)

**O que aconteceu (sem culpados):** o projeto tem uma regra boa — "não confie em
doc, verifique no código" — mas ela era aplicada **na entrada** de cada rodada e
não **na saída**. As rodadas de 28–29/06 nasceram de pedidos ad-hoc (auditoria,
fechamento, auditoria de banco) fora do pipeline numerado; nenhuma tinha, no seu
escopo, "atualizar `00-indices/`". Resultado em cadeia:

1. `03-status-atual` congelou em 341 (27/06).
2. A SDB-AUDIT (29/06) **leu o índice** em vez de rodar a suíte e citou 341 como
   linha de base — um dia depois de a main estar em 459. A regra "toda afirmação
   numérica precisa de comando reproduzível" foi violada exatamente no documento
   que auditava os outros.
3. O fechamento citou "correções já aplicadas" que não estão em nenhum commit —
   provavelmente confundindo *recomendação aceita* com *trabalho mergeado*.
4. O precedente PED1 ("reconciliado" em 27/06; auditoria acha duplicação viva em
   28/06) mostra o mesmo padrão: veredito de fase aferido por narrativa, não por
   grep.

**Regra instalada a partir de REG1 (para a próxima fase não repetir):**

- **Saída obrigatória de toda rodada mergeada** (numerada ou não): uma linha na
  `02-linha-do-tempo.md` §4 e a atualização dos números do `03-status-atual.md`.
- **Número sem comando não entra em doc.** Se o relatório cita testes/migrations/
  tabelas, cola o comando e a saída — citar outro doc não vale como evidência.
- **"Corrigido" exige commit.** Afirmar correção aplicada requer hash/PR
  verificável; recomendação aceita se escreve como pendência, não como fato.

## 7. Índices reescritos (tarefa 3)

| Arquivo | O que mudou |
|---|---|
| `02-linha-do-tempo.md` | Nova seção 4 com as 15 rodadas pós-SEG2 (data de merge, PR, branch, doc), incluindo as 4 fora do pipeline; nota de processo; marcos atualizados |
| `03-status-atual.md` | Reescrito do zero: números **medidos em 02/07** com comando ao lado; tabela de fios soltos abertos; aviso explícito sobre a alegação falsa do fechamento |
| `05-camadas-faltantes.md` | As 10 camadas reavaliadas item a item (PED1 ✅, PED2 r1 = fábrica ✅ / conteúdo aberto, ADM2 ✅, PERF1 ✅, SEC3 ✅ com 6.2/6.3 abertos, FE1 ✅ sem TS, UX1 ✅ com ressalvas); item novo 1.8 (duplicação remanescente); dependências re-sequenciadas (FIX2 → PED2 r2 → DB3 → PR1) |
| `07-pendencias-para-piloto-real.md` | P1-5 novo (tabela fantasma); P2-5..P2-8 novos (credencial opaca, rate limit, storage/FKs, motor duplicado); "Já resolvido" ganhou 10 linhas verificadas; CSP e admin_logs saíram de pendência |

## 8. PED2 — escopo real remanescente (tarefa do prompt, hipótese testada)

**Hipótese:** "recorrência/simulado-concurso mudam o item 2.x?" — **Testada e
refutada.** Ambas consomem a *estrutura de prova* (migrations 0009/0014/0015) e
já estão ligadas à UI; nenhuma cria *trilha semanal* de concurso. Além disso, a
PED2 **rodada 1 já aconteceu** (PR #49, 27/06) e entregou a *fábrica* (maturidade,
gates, validador, pipeline) — não o conteúdo.

**PED2 rodada 2 = só produção de conteúdo, usando a fábrica pronta:**
1. Fechar a trilha EsPCEx (hoje ~70%, maturidade `beta`) — P1 de valor.
2. Decisão de roadmap: EEAr/EPCAR/ESA (esqueleto) e Colégio Militar (sem config).
3. Tagueamento de recorrência com volume útil (hoje 3 questões em `questoes_prova`).

Nada disso é bloqueado por engenharia; é backlog pedagógico com pipeline e
validador já instalados.

## 9. Dupla passada

- **Passada 1:** cada afirmação numérica dos 6 relatórios reproduzida por comando
  (seções 2–5). Divergências achadas: 341 stale na SDB-AUDIT (confirmada) e
  alegação de correções inexistentes no fechamento (nova — não estava no prompt).
- **Passada 2:** releitura dos 4 índices como agente recém-chegado — o trio
  `03-status` (o que é verdade hoje) + `05-camadas` (o que falta, por camada,
  com evidência) + `07-pendencias` (ordem de ataque) responde "o que está feito /
  o que falta / o que é PED2 de verdade" sem exigir os 10 relatórios; a
  `02-linha-do-tempo` §4 dá o caminho para cada relatório quando o detalhe for
  necessário. Ajustes da passada 2: nota de processo movida para dentro da linha
  do tempo; aviso sobre a alegação do fechamento duplicado no `03-status` (é o
  lugar que um agente novo lê primeiro).

## 10. P0/P1 novos

**Nenhum P0.** Um item foi **promovido a P1 de produto** (não é novo — é o §3.1
da auditoria sênior que nunca ganhou dono): a tabela fantasma `solicitacoes_acesso`
(P1-5 no `07-pendencias`). Não corrigido aqui por regra dura da fase (escopo é
documentação); exige decisão de produto (criar fila real × remover botão).

## 11. Veredito

Índices vivos **reconciliados e confiáveis em 02/07**. FIX1 confirmada mergeada
com CI verde e conteúdo íntegro. As duas correções que o fechamento alegou já
existir **não existem** — viraram pendência classificada com dono sugerido (FIX2/
DB3). A fonte de verdade volta a ser os índices, com a regra de saída instalada
para não regredir.
