# Fase 15.5 — XP, patentes e conquistas (13/06/2026)

Quinta subfase da Fase 15. Cria a camada de **gamificação pedagógica**:
XP (ledger de eventos), patentes (catálogo) e conquistas (catálogo +
desbloqueio do aluno). Tudo travado no `exam_tag` do alvo. Aditiva;
catálogo global; progresso isolado por escola. Sem motor adaptativo.

## Estrutura de XP

XP é um **ledger** (`aluno_xp_eventos`): cada linha é um evento com
`origem` explícita (`missao`, `semana_completa`, `melhoria_materia`,
`simulado`, `evolucao`, `recuperacao`, `conquista`, `ajuste_manual`),
`pontos`, `exam_tag` e quem concedeu. O total de XP é a **soma** do
ledger — auditável, nunca "número mágico". O XP é travado no `exam_tag`
(D2: não soma entre exames).

## Critérios de pontuação (lógica pura `gamificacao.js`)

- `xpDeMissao({xpBase, peso, nivel, acuracia, limiarAcuracia})` —
  **antigaming**: só pontua se a acurácia bateu o limiar (domínio);
  escala por `MULT_PESO` (peso oficial) × `MULT_DIFICULDADE` (nível).
- `BONUS` fixos para semana completa, melhoria de matéria, simulado,
  recuperação de ponto fraco.
- `totalXp(eventos, examTag)` — soma travada no alvo.

## Estrutura de patentes

Catálogo global `patentes` (doc §13), tema militar sem exagero,
reskinável por força: Recruta (0), Soldado (300), Cabo (800),
3º Sargento (1800), 2º Sargento (3500), 1º Sargento (6000),
Subtenente (9000), Aspirante (13000). Cada uma: `nome`, `xp_necessario`,
`criterio_adicional` (nos degraus altos, p/ não virar só grind) e
`significado` pedagógico. `patenteParaXp(xp, patentes)` devolve a atual,
a próxima, o progresso e quanto falta.

## Estrutura de conquistas

Catálogo global `conquistas` com `tipo` ∈ {constancia, volume,
desempenho, simulado, materia, evolucao, reta_final, corte, recuperacao,
alavancagem}, `criterio` (jsonb) e `xp_bonus`. O aluno desbloqueia em
`aluno_conquistas` (ausência de linha = medalha cinza). `avaliarConquista`
avalia o critério pelo estado do aluno; `separarConquistas` divide
acesas × bloqueadas.

## Como evitar gamificação vazia

- **XP de missão exige acurácia** (sem domínio, XP = 0).
- **Conquista de volume carrega piso de acurácia** no próprio critério
  (`acuracia_min`): volume alto com acerto baixo **não** vale (testado).
- Critérios sempre por acurácia/nota/constância — nenhuma conquista é
  decorativa.
- Conquistas de **corte/piso** = alerta precoce de eliminação;
  conquistas de **alavancagem** = aluno-vitrine (sinal B2B para a escola).

## Como o XP se conecta a missões, simulados e evolução

O ledger registra a origem: `missao` (acurácia da missão concluída),
`simulado` (bônus por simulado completo), `melhoria_materia`/`evolucao`
(subir de nível, transformar erro em acerto), `recuperacao` (recuperar
matéria abaixo do piso), `semana_completa` (constância). Os fetchers
`concederXp` e `desbloquearConquista` registram esses eventos.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/0013_xp_patentes_conquistas.sql` | **novo** — 4 tabelas, RLS, grants |
| `supabase/seed/10_gamificacao.sql` | **novo** — patentes, conquistas, demo |
| `tests/reset-db.sh` | glob de seed de dois dígitos (suporta 10+), 04 pulado |
| `app/src/modules/conteudo/gamificacao.js` | **novo** — lógica pura de XP/patente/conquista |
| `app/src/shared/data/index.js` | + 5 fetchers (catálogo + progresso) |
| `tests/gamificacao.test.mjs` | **novo** — 11 testes de lógica pura |
| `tests/gamificacao-db.test.mjs` | **novo** — 10 testes de banco/RLS |

## O que ficou fora (proposital)

Simulados por concurso (15.6); recorrência real e motor adaptativo
(15.7). O motor que concede XP automaticamente (ao concluir missão/
simulado) entra com o motor de progresso; aqui a estrutura está pronta e
os fetchers existem. Nenhuma UI montada (footprint zero no E2E).

## Riscos ou dúvidas

- Multiplicadores de XP e limiares de patente são preliminares
  (🟡 doc §11/§13) — centralizados em `MULT_PESO`/`MULT_DIFICULDADE`/
  `BONUS` e no catálogo, para calibrar com a escola.
- A avaliação automática de conquistas depende do estado agregado do
  aluno (streak, acurácia por matéria, simulados), que o motor de
  progresso vai alimentar; a lógica de avaliação já está pronta e testada.

## Testes

- **build:** ✅ passou (bundle inalterado).
- **unitários:** ✅ 118/118 (97 anteriores + 11 lógica de gamificação +
  10 banco/RLS).
- **E2E:** ⏳ não executável localmente (browser do Playwright bloqueado
  pela egress); validado pelo CI. Impacto esperado nenhum (sem wiring).
- **RLS/isolamento:** ✅ catálogo global (escrita só `service_role`); XP
  e conquistas isolados por escola e travados no `exam_tag`; aluno lê o
  próprio XP mas não se autopontua; responsável lê só o vinculado.

## Status

✅ **Subfase 15.5 encerrada** (pendente da confirmação do E2E verde no
CI). **A 15.6 não foi iniciada** — simulados por concurso intactos.
