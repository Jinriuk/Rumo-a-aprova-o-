# 00 — Diagnóstico: Plano × Trilha
**Fase:** PED-UX1 | **Data:** 2026-06-24

---

## 1. O que é "Plano" hoje

Aba **Plano** (`tab === "plano"`) no `VisaoEstudo.jsx` renderiza o componente `<Plano>` inline.

**Fonte de dados:** `useTrilha(aluno.trilha_id)` → consulta:
- `trilhas` (metadados da trilha semanal)
- `trilha_semanas` (semanas numeradas com início, fim, foco, simulado)
- `atividades_modelo` (tarefas por semana: disciplina, prioridade, texto)
- `disciplinas` (código, nome, cor, abreviação)

**O que renderiza:** uma linha do tempo de missões (jornada), com:
- progresso geral da jornada (missão N de Total)
- cada semana como "Missão X" com status (Encerrada / Em andamento / A desbloquear)
- ao expandir: lista de objetivos da semana com estado de conclusão

**Papel correto:** "Qual é meu caminho semanal até o concurso?" = **execução semanal**

---

## 2. O que é "Trilha" hoje

Aba **Trilha** (`tab === "concurso"`) no `VisaoEstudo.jsx` renderiza `<TrilhaConcurso>`.

**Fonte de dados:** `useRecurso(() => db.carregarPlanoConcurso(examTag))` → consulta:
- `trilha_planos` (horizontes por concurso: anual / semestral / intensiva / reta_final)
- `missoes` (missões oficiais por exam_tag e nível)
- `missoes_escola` (ajustes da escola sobre missões oficiais, isolado por RLS)

**O que renderiza:**
- Horizontes da trilha (cards por tipo: Anual, Semestral, Intensiva, Reta Final)
- Missões do concurso-alvo do aluno (filtra pelo `exam_tag` do aluno)
- Ajustes da escola sobre missões oficiais

**Papel correto:** "Qual é o plano macro do meu concurso?" = **macrovisão do edital**

---

## 3. O que está duplicado

| Conceito | Aparece em Plano? | Aparece em Trilha? | Risco de confusão |
|---|---|---|---|
| "Semanas de estudo" | ✅ como missões numeradas | ❌ não | baixo |
| "Missões" | ✅ como "Missão 1, 2, 3…" | ✅ como missões do edital | **ALTO** — mesma palavra, contextos diferentes |
| "Objetivos/tarefas" | ✅ (atividades_modelo) | ✅ (missoes.objetivo) | alto |
| "Progresso" | ✅ (barra de jornada) | ❌ não tem | médio |
| Concurso-alvo | ❌ não aparece | ✅ (por exam_tag) | médio |

**Confusão principal:** a palavra "missão" aparece nos dois contextos com significados distintos:
- No **Plano**: "Missão" = semana de execução (Missão 1, Missão 2…)
- Na **Trilha**: "Missão" = objetivo pedagógico do edital (ex.: "Missão de Física Básica")

---

## 4. O que está quebrado

### Bug 1 — VisaoEstudo.jsx: erro genérico quando aluno não tem trilha
**Localização:** `VisaoEstudo.jsx:67`
```js
if (erroTrilha || dados.erro) return <Erro>{erroTrilha || dados.erro}</Erro>;
```
Quando `aluno.trilha_id` é null, `useTrilha` define `erro: "aluno sem trilha"`.
Isso renderiza `<Erro>aluno sem trilha</Erro>` (mensagem técnica em vermelho) em vez de um empty state amigável.

### Bug 2 — TrilhaConcurso.jsx: erro genérico de rede mascarando problemas reais
**Localização:** `useRecurso` → `mensagemAmigavel` em `erros.js`
Quando `carregarPlanoConcurso` falha (tabela não existe, RLS negando, dados ausentes), o `useRecurso` chama `mensagemAmigavel(e, "carregar")`.

Se o erro técnico contiver palavras da regex `/failed to fetch|network|timeout|conex[aã]o|offline/i` (o que acontece com erros Supabase de "connection refused" ou timeout), o usuário vê:
> "Sua conexão parece instável. Verifique e tente de novo."

mesmo quando o problema é ausência de dados ou falha na query de JOIN da tabela `missoes_escola`.

### Bug 3 — FichaAluno.jsx: mesma lógica do Bug 1
**Localização:** `FichaAluno.jsx:47`
```js
if (erroTrilha || erroDados) return <Erro>{erroTrilha || erroDados}</Erro>;
```
Mesma exposição de mensagem técnica "aluno sem trilha" para a coordenação.

### Bug 4 — VisaoEstudo.jsx: aluno sem trilha não consegue nem ver a tela
**Localização:** `VisaoEstudo.jsx:68`
```js
if (!trilha) return <Empty txt="Aluno sem trilha de estudo." />;
```
Quando `erroTrilha = "aluno sem trilha"`, a linha 67 já retorna antes de chegar aqui.
Portanto, aluno sem `trilha_id` vê uma mensagem de erro vermelha ao invés do estado vazio amigável.

---

## 5. Qual deve ser a fonte de verdade

| Dado | Tabela fonte | Quem consome |
|---|---|---|
| Semanas de estudo | `trilha_semanas` + `atividades_modelo` | Plano (jornada semanal) + MetaSemana (Hoje) |
| Macrovisão do concurso | `trilha_planos` + `missoes` | Trilha (TrilhaConcurso) |
| Tarefas da semana atual | `metas` + `meta_atividades` | Hoje (MetaSemana) |
| Progresso real | `aluno_eventos_progresso` | Desempenho + Conquistas |

---

## 6. O que deve aparecer para o aluno

### Aba "Hoje"
> "O que eu faço **agora**?"
- Missão gamificada da semana (nome, progresso)
- Objetivos pendentes (MetaSemana)
- Botão de registrar estudo
- Conquistas recentes

### Aba "Plano" (renomear internamente: jornada de missões)
> "Qual é minha **semana de estudos**?"
- Missão atual com barra de progresso
- Lista de objetivos: concluídos / pendentes / adiados
- Visão da jornada completa (linha do tempo de semanas)

### Aba "Trilha"
> "Qual é meu **caminho até o concurso**?"
- Horizontes do concurso (Anual, Semestral, etc.)
- Missões do edital (do concurso-alvo do aluno)
- Ajustes da escola se houver

---

## 7. Decisão de nomenclatura

Para evitar confusão entre "Missão 1, 2, 3" (semanas) e "Missão de Física" (edital):

| Onde | Antes | Depois |
|---|---|---|
| Aba "Plano" → semana de execução | "Missão X" | **"Semana X"** |
| Aba "Trilha" → objetivo do edital | "Missão Y" | manter "Missão Y" (é do edital) |
| Aba "Hoje" → referência à semana | "missão da semana" | **"sua semana"** ou "plano da semana" |

Esta mudança reduz confusão sem mexer no banco.

---

## 8. Status

| Item | Status |
|---|---|
| Bug 1 (erro técnico aluno sem trilha) | ✅ corrigido em VisaoEstudo.jsx |
| Bug 2 (erro genérico TrilhaConcurso) | ✅ corrigido em TrilhaConcurso.jsx |
| Bug 3 (erro técnico FichaAluno) | ✅ corrigido em FichaAluno.jsx |
| Nomenclatura Plano × Trilha | ✅ clarificada nos componentes |
| Estados claros da Trilha | ✅ implementados |
