# PED1 — Relatório: Motor de progresso vivido (missões, níveis e onboarding)

- **Camada:** PED1 — alta prioridade (destrava valor percebido).
- **Branch:** `claude/ped1-motor-progresso-vivido-74brq0` · **PR #48**
- **Data:** 2026-06-27
- **Status global:** ✅ **Concluído** (reconciliado com a Fase C0; limitações em §7).

---

## 1. Problema (antes)

O modelo pedagógico-gamificado das fases 15.3–15.5 estava no banco mas
**dormente**: XP derivado na tela, missões como texto, nível por matéria não
persistido, onboarding não acionado (auditoria `12-edtech-pedagogica.md` §3).

## 2. Reconciliação com a Fase C0 (decisão do dono)

Durante a revisão do PR #48, a `main` já havia recebido a **Fase C0**
(`0024_motor_progresso.sql`): um **motor mínimo persistido** que torna o
ledger `aluno_eventos_progresso` a **fonte de verdade** do XP — cada ação do
aluno vira evento idempotente (registro = 0 XP; objetivo de missão = XP por
prioridade; simulado = 50 XP), com `vw_aluno_xp_total` e leitura por
`carregarXpPersistido`. Havia, portanto, **dois motores** candidatos.

**Decisão do dono:** *estender o C0*. Esta camada **não** cria um segundo
ledger; ela **adiciona** sobre o C0 só o que faltava, escrevendo no **mesmo**
`aluno_eventos_progresso`:

1. **Missão que fecha sozinha** por **VOLUME + ACURÁCIA** (o C0 premiava o
   objetivo-checkbox; aqui a *missão do catálogo* fecha quando o aluno domina a
   matéria) — XP no ledger do C0 (`tipo_evento='missao_concluida'`,
   `origem='motor_missao'`), idempotente pela `idempotency_key`.
2. **Nível por matéria persistido** (mesma regra de `niveisAluno.js`), com
   auditoria; **nunca** sobrescreve nível `manual` da coordenação.
3. **Conquistas data-driven** (constância / volume com domínio / matéria),
   creditando o `xp_bonus` no ledger do C0.
4. **Onboarding do aluno** (autoatendimento) por RPC SECURITY DEFINER restrito
   à própria linha — complementa o onboarding da coordenação que o C0 trouxe.

A doutrina do C0 é preservada: o aluno escreve só `registros_estudo`; um
gatilho SECURITY DEFINER deriva o progresso — o aluno **não** fecha missão nem
se autopontua por API.

## 3. O que mudou (arquivos)

**Banco**
- `supabase/migrations/0033_ped1_missoes_niveis.sql` (novo): `aluno_missoes`
  (+RLS), `meta_questoes`/`meta_acuracia` em `missoes`, `app.motor_avaliar_aluno`
  (fecha missão / persiste nível / conquistas) emitindo no ledger do C0, RPC
  `public.salvar_onboarding_aluno`, gatilho em `registros_estudo` (gate de seed).
- `supabase/seed/09_trilhas_missoes.sql`: backfill do critério estruturado.
- `supabase/seed/03` e `11`: flag `app.motor_seed='on'` (o motor extra não roda
  sobre o fixture curado; os gatilhos do C0 seguem como na `main`).

**Frontend**
- `app/src/shared/data/index.js`: `carregarMissoesAluno`, `salvarOnboardingAluno`.
- `app/src/routes/aluno/VisaoEstudo.jsx`: XP exibido = ledger do C0
  (`dados.xpPersistido`); **toast de feedback** no momento da ação (delta de XP +
  missões fechadas); seção `MissoesPersistidas`.
- `app/src/modules/motor/ProgressoVivido.jsx` (novo): `FeedbackProgresso` e
  `MissoesPersistidas`.
- `app/src/modules/motor/Onboarding.jsx` (novo) + `routes/aluno/AreaAluno.jsx`:
  diagnóstico inicial do aluno na 1ª vez (gate por `concluido_em`).
- `FichaAluno.jsx`: mantida a versão da `main` (já mostra XP persistido,
  histórico do ledger e onboarding da coordenação).

## 4. Evidência de teste

- **Suíte completa: 351/351 ✅** (inclui as suítes da `main` + 10 da PED1). Sem
  regressão nos 4 perfis.
- **`tests/ped1-motor-db.test.mjs` — 10/10 ✅**: missão fecha por volume+acurácia
  e credita XP em `aluno_eventos_progresso`; **idempotência** (reprocessar não
  duplica); antes/depois do critério; antigaming (200 questões a 20% não
  fecham); nível por matéria `calculado` que não rebaixa `manual`; aluno sem
  alvo não gera nada; isolamento entre escolas; onboarding do aluno grava só a
  própria linha e barra escrita direta + valida disponibilidade.

**Como rodar:** `cd tests && bash reset-db.sh && node --test`. **Build:**
`cd app && npm run build` → ✅.

## 5. Segurança / LGPD

- RLS **não** enfraquecida: o aluno não insere XP/nível/missão direto; o motor
  escreve por SECURITY DEFINER (padrão do C0/0011).
- Isolamento por `escola_id`/`exam_tag` mantido e testado.
- Onboarding do aluno restrito a `app.meu_aluno_id()`; `revoke ... from anon`.
- Nenhum secret exposto; nenhum dado/seed apagado.

## 6. Risco e rollback

- **Risco:** o gatilho extra dispara junto com o do C0 em cada registro.
  Mitigações: avaliação escopada a um aluno; `exception when others` (o motor
  nunca derruba o registro); `idempotency_key`/`unique` impedem duplicação;
  gate de seed evita poluir fixtures.
- **Rollback:** bloco no fim de `0033_*.sql` (drop de gatilho/funções/tabela/
  colunas). O ledger já concedido não é apagado (append-only).

## 7. Itens parciais / fora de escopo (honesto)

- Fechamento de missão é **por matéria** (registro não tem assunto);
  `meta_acuracia` semeada uniforme em 70% (🟡 calibrar por edital).
- Conquistas `desempenho/evolucao/corte/recuperacao/reta_final` seguem
  **adiadas** (exigem sinal por-simulado/temporal mais rico) — não simuladas.
- Recorrência, conteúdo de novos concursos e banco de questões: **fora de
  escopo** (mantido conforme §7 do prompt PED1).

## 8. Critérios de aceite — checagem

| Critério | Situação |
|---|---|
| XP e eventos críticos persistidos e visíveis | ✅ ledger do C0 + UI |
| Missões fecham automaticamente ao bater critério | ✅ `aluno_missoes` + gatilho (PED1) |
| Conquistas/níveis/onboarding não dormentes | ✅ acionados pelo motor/UI |
| Nenhuma concessão duplica por duplo envio | ✅ idempotency_key (testado) |
| UI informa sucesso/erro de forma clara | ✅ toast de progresso + erros amigáveis |
| Build, testes e smoke passam | ✅ 351/351 + build do front |
