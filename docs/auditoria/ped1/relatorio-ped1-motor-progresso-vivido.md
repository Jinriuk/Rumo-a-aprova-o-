# PED1 — Relatório: Motor de progresso vivido (XP, missões, níveis e onboarding)

- **Camada:** PED1 — alta prioridade (destrava valor percebido).
- **Branch:** `claude/ped1-motor-progresso-vivido-74brq0`
- **Data:** 2026-06-27
- **Status global:** ✅ **Concluído** (com limitações documentadas em §7).

---

## 1. Problema (antes)

O modelo pedagógico-gamificado das fases 15.3–15.5 existia no banco, nos seeds
e nos testes, mas estava **dormente**: `concederXp`, `desbloquearConquista`,
`salvarNivelAluno`, `carregarMissoes`, `salvarAjusteMissaoEscola` e
`salvarOnboarding` não eram chamados por **nenhuma tela**. O aluno via XP
**derivado ao vivo** (`motor/jargao.js`), não um evento persistido; missões
eram **texto**, não fechavam sozinhas; nível por matéria não vinha do estudo
real; o onboarding não era acionado. (Confirma a auditoria
`docs/auditoria/12-edtech-pedagogica.md` §3 e `13-verificacao-tecnica.md`.)

## 2. Decisão de arquitetura (e por quê)

A RLS de `aluno_xp_eventos` (migration 0013) **proíbe o aluno de se
autopontuar** — só coordenação/servidor escrevem (antigaming). Conceder XP "no
clique" no cliente do aluno **violaria** essa política. Solução que **não
enfraquece a RLS**:

> Um **motor SECURITY DEFINER** (dono `postgres`, igual ao
> `app.registrar_nivel_historico` já existente) é disparado pelos **mesmos
> eventos que o aluno já pode gravar** — registro de estudo e simulado. Ele
> concede XP, fecha missão e persiste nível, **derivando** tudo do estudo real.
> O aluno continua **sem** poder inserir XP na unha (RLS intacta e testada).

**Idempotência (critério de aceite):** cada concessão é amarrada a
`(aluno, exam_tag, origem, referencia_id)` por **índice único parcial**
(`idx_xp_idem`). Clique duplo, reload ou retry reprocessam o mesmo evento e o
duplicado é **descartado**. Missão (`aluno_missoes`) e conquista
(`aluno_conquistas`) têm `unique` próprios.

## 3. O que mudou (arquivos)

**Banco**
- `supabase/migrations/0024_motor_progresso_vivido.sql` (novo): índice de
  idempotência; `meta_questoes`/`meta_acuracia` em `missoes`; tabela
  `aluno_missoes` (+ RLS isolada por escola); primitivas e gatilhos do motor;
  RPC `public.salvar_onboarding_aluno` (autoatendimento do aluno).
- `supabase/seed/09_trilhas_missoes.sql`: backfill do critério estruturado das
  missões (volume + acurácia-piso).
- `supabase/seed/03` e `11`: flag `app.motor_seed='on'` para o motor **não**
  disparar sobre o fixture curado (evita XP/nível duplicado no seed).

**Frontend**
- `app/src/shared/data/index.js`: `carregarMissoesAluno`, `salvarOnboardingAluno`.
- `app/src/routes/aluno/VisaoEstudo.jsx`: lê XP/missões/conquistas
  **persistidos**; XP exibido passa a ser o do ledger; **toast de feedback** no
  momento da ação; seção de missões persistidas.
- `app/src/modules/motor/ProgressoVivido.jsx` (novo): `FeedbackProgresso`
  (toast +XP / missão concluída / conquista) e `MissoesPersistidas`.
- `app/src/modules/motor/Onboarding.jsx` (novo) + `routes/aluno/AreaAluno.jsx`:
  diagnóstico inicial do aluno na 1ª vez (gate por `concluido_em`).
- `app/src/modules/desempenho/FichaAluno.jsx`: coordenação vê o **XP
  persistido** do aluno (isolado por RLS), não só o derivado.

## 4. Evidência de teste

- **Suite completa: 196/196 ✅** (era 184; +12 da PED1). Sem regressão nos 4
  perfis (aluno/responsável/coordenação/superadmin) — as suítes de isolamento,
  motor, níveis, simulado, painel e backoffice seguem verdes.
- **`tests/ped1-motor-db.test.mjs` — 12/12 ✅**, cobrindo:
  - XP **persistido** no fluxo real (registro fecha missão e grava o evento);
  - **idempotência**: reprocessar N vezes não duplica XP/missão/conquista;
  - missão **antes/depois** do critério (em andamento → concluída no limiar);
  - **antigaming**: 200 questões a 20% **não** fecham a missão;
  - simulado concede XP + conquista, **sem** duplicar no retry;
  - nível por matéria persistido como `calculado`; **não** sobrescreve `manual`;
  - aluno **sem alvo** (exam_tag nulo): o motor não inventa nada;
  - responsável e coordenação **leem**; escola A **não vê** nada da B;
  - onboarding do aluno grava **só a própria linha**; escrita direta segue
    barrada pela RLS; disponibilidade fora de 0..168 é recusada.

**Como rodar:** `cd tests && bash reset-db.sh && node --test`
(Postgres local em 54322; ver `tests/reset-db.sh`).

**Build do front:** `cd app && npm run build` → ✅ (922 módulos).

### Verificação manual (console + banco)

Inserindo um registro de mat como o aluno Lucas (RLS real), o motor:
fechou a missão "Fechar Geometria Plana" (70 questões, 89%), gravou
`aluno_xp_eventos(origem='missao', +100)` e os bônus de conquista
(`Geômetra +100`, `Inglês Estratégico +120`); reprocessar 3× manteve **1**
evento de missão e **100** XP (idempotente). O `insert` direto de XP pelo aluno
foi **recusado** com `row-level security`.

## 5. Segurança / LGPD

- RLS **não** foi enfraquecida: o aluno continua sem inserir XP/nível/missão
  direto; o motor escreve por SECURITY DEFINER (padrão já auditado na 0011).
- Isolamento por `escola_id`/`exam_tag` mantido e testado (sem vazamento
  cross-tenant nas tabelas novas).
- Onboarding do aluno via RPC restrito a `app.meu_aluno_id()` — escopo de **uma
  linha, do próprio dono**; `revoke ... from anon`.
- Nenhum secret/`.env`/`service_role` exposto. Nenhum dado/seed apagado.

## 6. Risco e rollback

- **Risco:** gatilhos disparam em toda gravação de registro/simulado do aluno.
  Mitigações: avaliação **escopada a um aluno**; corpo `exception when others`
  → um erro do motor **nunca** derruba o registro do aluno (efeito colateral);
  índice de idempotência impede duplicação; gate de semeadura evita poluir
  fixtures. Custo por evento é O(missões do exam_tag) — barato para o piloto
  (300–500 alunos).
- **Rollback:** bloco documentado no fim de `0024_*.sql` (drop de gatilhos,
  funções, índice, tabela e colunas). O ledger já concedido **não** é apagado
  (append-only) — o motor só **para** de conceder novos.

## 7. Itens parciais / fora de escopo (honesto)

- **Parcial:** conquistas `desempenho/evolucao/corte/recuperacao/reta_final`
  ficam **adiadas** (exigem sinal por-simulado/temporal mais rico). A lógica
  pura existe; falta o dado persistido confiável — **não** foram simuladas.
- **Parcial:** fechamento de missão é **por matéria** (registro não tem
  assunto); `meta_acuracia` semeada uniforme em 70% (🟡 calibrar por edital).
- **Fora de escopo (mantido):** ampliar tagueamento de recorrência; conteúdo de
  novos concursos; banco de questões. Conforme §7 do prompt PED1.

## 8. Critérios de aceite — checagem

| Critério | Situação |
|---|---|
| XP e eventos críticos persistidos e visíveis | ✅ ledger + UI (aluno e coordenação) |
| Missões fecham automaticamente ao bater critério | ✅ `aluno_missoes` + gatilho |
| Conquistas/níveis/onboarding não dormentes | ✅ acionados pelo motor/UI |
| Nenhuma concessão duplica por duplo envio | ✅ índice de idempotência (testado) |
| UI informa sucesso/erro de forma clara | ✅ toast de progresso + erros amigáveis |
| Build, testes e smoke passam | ✅ 196/196 + build do front |
