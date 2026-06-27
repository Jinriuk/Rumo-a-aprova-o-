# PED1 — Matriz de eventos: XP, missões, níveis, conquistas

> Mapa **completo** do motor pedagógico-gamificado e de como cada evento
> do aluno passa a conceder progresso **persistido e idempotente**.
> Fonte de verdade no banco: migrations `0011`, `0012`, `0013` (tabelas) e
> `0024_motor_progresso_vivido.sql` (motor). Seeds `08`–`11` (conteúdo).

---

## 1. Tabelas e funções do motor (inventário)

| Domínio | Tabela | Conteúdo | Escrita |
|---|---|---|---|
| XP | `aluno_xp_eventos` | ledger append-only de XP por origem/exam_tag | coordenação (RLS) **ou** motor (SECURITY DEFINER) |
| Patentes | `patentes` | catálogo global (XP cumulativo) | operador (service_role) |
| Conquistas | `conquistas` | catálogo global (critério jsonb por tipo) | operador |
| Conquistas do aluno | `aluno_conquistas` | medalhas desbloqueadas (unique) | coordenação **ou** motor |
| Missões | `missoes` | template global + **`meta_questoes`/`meta_acuracia`** (0024) | operador |
| Ajuste da escola | `missoes_escola` | override de qtd/xp/critério, `desvio_do_edital` | coordenação |
| **Progresso de missão** | **`aluno_missoes` (0024)** | uma linha por (aluno, missão): estado, volume, acurácia, XP | coordenação **ou** motor |
| Níveis | `aluno_niveis` | nível geral e por matéria (origem: calculado/manual/diagnóstico/validar) | coordenação **ou** motor |
| Histórico de nível | `aluno_nivel_historico` | trilha de auditoria append-only | gatilho `app.registrar_nivel_historico` |
| Onboarding | `aluno_onboarding` | diagnóstico inicial (1:1 com aluno) | coordenação **ou** `salvar_onboarding_aluno` (aluno) |
| Recorrência | `recorrencia_assunto`, `vw_recorrencia_medida` | grau estimada/validada/medida | operador |

**Primitivas do motor (0024, SECURITY DEFINER, dono = `postgres`):**

| Função | Papel |
|---|---|
| `app.exam_tag_do_aluno(aluno)` | resolve o concurso-alvo; sem alvo → `null` (motor para) |
| `app.motor_conceder_xp(...)` | insere XP **idempotente** por `(aluno, exam_tag, origem, referencia_id)` |
| `app.motor_desbloquear_conquista(...)` | desbloqueia por código + credita o bônus (idempotente) |
| `app.motor_streak_dias(aluno)` | maior sequência de dias consecutivos de estudo |
| `app.motor_avaliar_aluno(aluno)` | recalcula missões, níveis e conquistas data-driven |
| `app.motor_processar_simulado(simulado)` | XP de simulado + conquista "veterano" |
| `app.motor_semana_completa(meta)` | bônus quando todas as atividades da meta fecham |
| `public.salvar_onboarding_aluno(...)` | autoatendimento do aluno (só a própria linha) |

**Gatilhos** (param na semeadura via `app.motor_semeando()`):
`registros_estudo` (INSERT/UPDATE/DELETE) → `motor_avaliar_aluno`;
`simulados` (INSERT) → `motor_processar_simulado` + `motor_avaliar_aluno`;
`meta_atividades` (UPDATE→concluida) → `motor_semana_completa`.

---

## 2. Matriz EVENTO → CONCESSÃO (persistida)

| Evento do aluno | Origem XP | Pontos | Idempotência (referência) | Efeito colateral |
|---|---|---|---|---|
| Registrar estudo que **fecha** uma missão (volume ≥ `meta_questoes` **e** acurácia ≥ `meta_acuracia`) | `missao` | `missoes_escola.xp` ou `missoes.xp_sugerido` | `referencia_id = missao_id` | `aluno_missoes.estado='concluida'`; recalcula nível |
| Registrar estudo (qualquer) | — | — | — | atualiza progresso da missão; recalcula **nível por matéria** (`calculado`); avalia conquistas |
| Entregar **simulado** | `simulado` | 150 | `referencia_id = simulado_id` | conquista `veterano` (1º simulado) |
| Fechar **todas** as atividades da meta da semana | `semana_completa` | 60 | `referencia_id = meta_id` | — |
| 7 dias consecutivos de estudo | `conquista` (bônus) | `conquistas.xp_bonus` | `referencia_id = conquista_id` | conquista `maratona_7` (constância) |
| ≥600 questões/30d **com** acurácia ≥ piso | `conquista` (bônus) | `xp_bonus` | `referencia_id = conquista_id` | conquista `maratonista` (volume **com domínio**) |
| Matéria-alvo com acurácia ≥ piso (ex.: mat ≥80%, ing ≥80%) | `conquista` (bônus) | `xp_bonus` | `referencia_id = conquista_id` | `geometra` / `ingles_estrat` |
| Coordenação concede manualmente | `ajuste_manual` | livre | sem referência (fora do índice idem) | trilha de auditoria |

**Anti-gaming (doc §11/§12):** XP nunca vem de volume puro de cliques.
A missão só fecha com **acurácia** (domínio), a conquista de volume exige
**piso de acerto**, e o aluno **não** insere XP direto (RLS recusa) — o motor
concede, derivado do estudo real.

---

## 3. Conquistas: implementadas × adiadas

| Tipo | Estado | Sinal usado |
|---|---|---|
| `constancia` | ✅ no motor | sequência de dias de `registros_estudo` |
| `volume` | ✅ no motor | questões/30d + acurácia |
| `materia` / `alavancagem` | ✅ no motor | acurácia da matéria nos registros |
| `simulado` | ✅ no motor | existência de simulado |
| `desempenho`, `evolucao`, `corte`, `recuperacao`, `reta_final` | ⏳ adiado | exigem leitura por-simulado/temporal mais rica (tagueamento de matéria no simulado, série histórica). A lógica pura já existe em `gamificacao.js`; falta o sinal persistido confiável. Documentado como **pendente honesto**, não simulado. |

---

## 4. Níveis: persistência e auditoria

- A cada registro, o motor recalcula o **nível por matéria** com os mesmos
  limiares da lógica pura (`niveisAluno.js`): `<20` questões não classifica;
  `<40%` → base; `≥70%` **e** `≥100` questões → avançado; senão intermediário.
- Grava em `aluno_niveis` com `origem='calculado'`; o gatilho de histórico
  registra a mudança (quem/quando/de→para).
- **Nunca** sobrescreve `origem='manual'` ou `'diagnostico'` (decisão da
  coordenação prevalece). Provado em teste.

---

## 5. Limitações conhecidas (honestas)

1. O fechamento de missão usa o agregado **por matéria** dos registros (não
   por assunto), porque `registros_estudo` só tem `disciplina_codigo` + tópico
   livre. O `criterio_excelencia`/assunto segue como texto orientador.
2. `meta_acuracia` foi semeada com piso uniforme de **70%** (🟡 calibrar por
   edital); o `criterio_conclusao` textual original continua exibido.
3. Recorrência permanece como nas fases anteriores (amostra pequena); fora do
   escopo desta camada ampliar o tagueamento — ver §7 do prompt PED1.
