# PED1 — Matriz de eventos: XP, missões, níveis, conquistas

> Mapa do motor pedagógico-gamificado **reconciliado com a Fase C0**. A fonte
> de verdade do XP é o ledger **`aluno_eventos_progresso`** (C0,
> `0024_motor_progresso.sql`). A PED1 (`0033_ped1_missoes_niveis.sql`) **estende**
> esse ledger: missão que fecha por volume+acurácia, nível por matéria
> persistido, conquistas data-driven e onboarding do aluno.

---

## 1. Tabelas e funções (inventário)

| Domínio | Objeto | Origem | Escrita |
|---|---|---|---|
| **Ledger de XP** | `aluno_eventos_progresso` (+ `vw_aluno_xp_total`) | C0 | motor (SECURITY DEFINER); coordenação só `ajuste_coordenacao` |
| Conquistas (catálogo) | `conquistas` | 0013 + C0 (basics) | operador |
| Conquistas do aluno | `aluno_conquistas` | 0013 | coordenação ou motor |
| Missões (catálogo) | `missoes` + **`meta_questoes`/`meta_acuracia`** (PED1) | 0012 + PED1 | operador |
| Ajuste da escola | `missoes_escola` | 0012 | coordenação |
| **Progresso de missão** | **`aluno_missoes`** (PED1) | PED1 | coordenação ou motor |
| Níveis | `aluno_niveis` (+ histórico) | 0011 | coordenação ou motor |
| Onboarding | `aluno_onboarding` | 0011 | coordenação **ou** `salvar_onboarding_aluno` (aluno) |

**Funções do C0 (fonte de verdade do XP):** `app.progresso_de_registro`,
`app.progresso_de_missao` (objetivo da meta), `app.progresso_de_simulado`,
`app.desbloquear_conquista_basica`, `app.backfill_progresso`.

**Funções da PED1 (SECURITY DEFINER, escrevem no ledger do C0):**
`app.motor_avaliar_aluno` (fecha missão / persiste nível / conquistas),
`app.motor_conquista_xp`, `app.motor_streak_dias`, `app.exam_tag_do_aluno`,
`public.salvar_onboarding_aluno`.

**Gatilhos:** C0 — `registros_estudo`, `meta_atividades`, `simulados`.
PED1 — `trg_ped1_registro` em `registros_estudo` (gate de seed).

---

## 2. Matriz EVENTO → CONCESSÃO (no ledger `aluno_eventos_progresso`)

| Evento do aluno | Camada | tipo_evento / origem | xp_delta | Idempotência (idempotency_key) |
|---|---|---|---|---|
| Registrar estudo | C0 | `registro_estudo` | 0 (anti-grind) | `registro:<id>` |
| Concluir **objetivo** da meta (checkbox) | C0 | `missao_concluida` / meta_atividades | XP por prioridade (F100/P60/X40) | `meta_atividade:<id>` |
| Lançar **simulado** | C0 | `simulado_finalizado` | 50 | `simulado:<id>` |
| 1ª vez: registro / missão / simulado | C0 | `conquista_desbloqueada` | 0 | `conquista:<aluno>:<codigo>` |
| **Missão do catálogo FECHA** (volume ≥ `meta_questoes` **e** acurácia ≥ `meta_acuracia`) | **PED1** | `missao_concluida` / **`motor_missao`** | `missoes_escola.xp` ou `missoes.xp_sugerido` | `missao_motor:<aluno>:<missao_id>` |
| Registrar estudo (qualquer) | PED1 | — | — | atualiza `aluno_missoes`; recalcula **nível por matéria** |
| 7 dias consecutivos | PED1 | `conquista_desbloqueada` / `motor_conquista` | `conquistas.xp_bonus` | `conquista:<aluno>:maratona_7` |
| ≥600 questões/30d **com** acurácia ≥ piso | PED1 | idem | `xp_bonus` | `conquista:<aluno>:maratonista` |
| Matéria-alvo com acurácia ≥ piso (mat/ing ≥80%) | PED1 | idem | `xp_bonus` | `conquista:<aluno>:geometra` / `:ingles_estrat` |

**Anti-gaming:** registrar estudo não dá XP; a missão só fecha com **domínio**
(acurácia); conquista de volume exige **piso de acerto**; o aluno **não** insere
evento de XP (RLS recusa) — o motor deriva do estudo real.

---

## 3. Níveis: persistência e auditoria (PED1)

- A cada registro, recalcula o **nível por matéria** (limiares de
  `niveisAluno.js`: `<20`q não classifica; `<40%`→base; `≥70%` e `≥100`q→avançado;
  senão intermediário), grava em `aluno_niveis` (`origem='calculado'`).
- O gatilho de histórico (0011) registra quem/quando/de→para.
- **Nunca** sobrescreve `origem='manual'`/`'diagnostico'`. Provado em teste.

## 4. Conquistas: implementadas × adiadas

| Tipo | Estado |
|---|---|
| `constancia`, `volume`, `materia`/`alavancagem` | ✅ PED1 (data-driven, com piso de acurácia) |
| "primeira vez" (registro/missão/simulado) | ✅ C0 |
| `desempenho`, `evolucao`, `corte`, `recuperacao`, `reta_final` | ⏳ adiado (exigem sinal por-simulado/temporal; lógica pura existe em `gamificacao.js`) |

## 5. Limitações conhecidas (honestas)

1. Fechamento de missão é **por matéria** (registro só tem `disciplina_codigo`);
   o `criterio_excelencia`/assunto segue como texto orientador.
2. `meta_acuracia` semeada com piso uniforme **70%** (🟡 calibrar por edital).
3. Recorrência permanece como nas fases anteriores — fora do escopo da PED1.
