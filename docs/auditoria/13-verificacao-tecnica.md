# Verificação Técnica — Cruzamento de Fatos da Auditoria

> Esta auditoria (Fase 18) usou, além de leitura direta, agentes de exploração para varrer o
> repositório. Para não tratar inferência como fato, fiz uma **passagem de verificação** das
> afirmações mais "load-bearing", lendo o código-fonte diretamente. Este documento registra o
> que foi confirmado, o que foi **corrigido** e o método — para que os 12 relatórios sejam
> auditáveis.

---

## 1. Afirmação verificada e CORRIGIDA — "módulos pedagógicos não ligados à UI"

**Afirmação original (persona 12):** "Nada ligado à UI… footprint zero no bundle."
**Status: IMPRECISA — corrigida.**

**O que a leitura de imports mostrou (`app/src/`):**

- O que o **aluno vê** de gamificação/níveis/conquistas vem de um sistema **derivado ao vivo**,
  herança do "Rumo ao Naval", e **está ligado**:
  - `modules/motor/jargao.js` → `calcularXP`, `patente` (importado por `VisaoEstudo.jsx:17`,
    `FichaAluno.jsx`, `MetaHero.jsx`, `Conquistas.jsx`, etc.).
  - `modules/motor/Conquistas.jsx` → `catalogoConquistas({ m, metas, simulados })` (derivado).
  - `modules/desempenho/Niveis.jsx` → `NiveisPorMateria` (renderizado em `VisaoEstudo.jsx:115`),
    que importa `conteudo/niveisAluno.js` mas é alimentado por **métricas ao vivo (`m`)**.
- `conteudo/provas.js` (pontuação de simulado: `provaDoConcurso`, `notaPct`, `totalAcertos`…)
  **está ligado** a `ClassificacaoTurma.jsx`, `ResumoResponsavel.jsx`, `Progresso.jsx`.

**Mas todo o layer DB das fases 15.x está DORMENTE** — nenhuma dessas funções é chamada por
tela (só definidas em `shared/data/index.js`):

| Função (seam de dados) | Tabela / recurso | Chamada por tela? |
|------------------------|------------------|:-----------------:|
| `carregarNivelAluno` / `salvarNivelAluno` | `aluno_niveis` | ❌ dormente |
| `carregarOnboarding` / `salvarOnboarding` | `aluno_onboarding` | ❌ dormente |
| `atualizarAlvoPedagogico` | `alunos` (alvo) | ❌ dormente |
| `concederXp` / `desbloquearConquista` | `aluno_xp_eventos` / `aluno_conquistas` | ❌ dormente |
| `carregarMissoes` / `salvarAjusteMissaoEscola` | `missoes` / `missoes_escola` | ❌ dormente |
| `carregarRecorrencia` | `recorrencia_assunto` | ❌ dormente |
| `carregarEstruturaProva` | `provas`/`assuntos`/… | ❌ dormente |
| `configEscola` / `listarPatentes` | `config_escola` / `patentes` | ❌ dormente |

**Conclusão precisa:** existem **dois sistemas pedagógicos paralelos** — o derivado (ligado, o
que o aluno usa) e o persistido das fases 15.x (construído, semeado, testado, porém **nunca
lido nem escrito pela interface**). A correção: não é "footprint zero" (provas.js e niveisAluno.js
entram no bundle); é "layer DB dormente". Relatórios afetados e ajustados: **12 (pedagógica),
3 (professor), 4 (coordenação)**.

---

## 2. Afirmação verificada e CONFIRMADA — RLS em todas as tabelas novas (0008–0015)

Lido o DDL diretamente. **Todas** as tabelas das migrations 0008–0015 têm
`enable row level security` e política:

- 0008: `turmas_comerciais`, `turmas_comerciais_concursos`, `config_oficial`, `config_escola` — RLS + 5 policies.
- 0009: `provas`, `prova_dias`, `materias`, `prova_materias`, `assuntos`, `subassuntos` — RLS + 6 policies.
- 0011: `aluno_niveis`, `aluno_nivel_historico`, `aluno_onboarding` — RLS + 5 policies.
- 0012: `trilha_planos`, `missoes`, `trilha_plano_missoes`, `missoes_escola` — RLS + 5 policies.
- 0013: `patentes`, `conquistas`, `aluno_xp_eventos`, `aluno_conquistas` — RLS + 6 policies.
- 0014: **não cria tabela** (só adiciona `exam_tag` a `simulados`, já protegida) → 0 policy é correto/seguro.
- 0015: `provas_anteriores`, `questoes_prova`, `recorrencia_assunto` — RLS + 3 policies.

**Nenhuma tabela nova sem RLS.** Persona 7 e 9 confirmadas neste ponto.

---

## 3. Afirmação verificada e CONFIRMADA — índices sem `escola_id` no prefixo

Lido o DDL. As tabelas de progresso/gamificação têm índice por `aluno_id`/`exam_tag`, **sem
`escola_id` no prefixo**:

- `idx_aluno_niveis_aluno on aluno_niveis (aluno_id)`
- `idx_xp_aluno on aluno_xp_eventos (aluno_id, exam_tag)`
- `idx_aluno_conq_aluno on aluno_conquistas (aluno_id, exam_tag)`
- `idx_missoes_escola_esc on missoes_escola (escola_id)` (só `escola_id`, sem `missao_id`)

Persona 7 confirmada: a recomendação de índices compostos com tenant no prefixo procede (custo
em escala grande; irrelevante no porte atual).

---

## 4. Afirmação verificada e CONFIRMADA — credencial de aluno derivada do código

Lido `supabase/functions/provisionar-aluno/index.ts`:

- Código: `crypto.getRandomValues(12 bytes)` mapeado em alfabeto de 31 símbolos (sem 0/O/1/I/L)
  → 12 caracteres ≈ **59 bits de entropia**.
- `email = codigo@codigo.acesso.local` e `password = codigo` (derivação determinística).
- Porteiro correto: exige `papel = coordenacao`, valida `alunoDaEscola`, registra log, faz
  rollback de conta órfã em falha.

Persona 9 confirmada: risco A1 (credencial acoplada ao código) é real; a entropia de ~59 bits é
a mitigação. A recomendação de desacoplar + rate limiting procede.

---

## 5. Afirmação verificada e CONFIRMADA — porta do servidor (`0005`) fechada

Releitura direta de `0005_api_servidor.sql`: os wrappers `public.motor_*`/`public.lgpd_*`
**revogam de `public, authenticated, anon` e concedem só ao `service_role`**. (Um agente havia
afirmado que eram executáveis por `authenticated` — **incorreto**; o arquivo prova o contrário.)
Persona 7 e 9 refletem o fato correto: defesa em profundidade real.

---

## 6. Contagens conferidas

- **E2E:** 21 testes `test(...)` em 5 specs (aluno 6, auth 5, coordenação 5, mobile 3,
  responsável 2). O CI rotula "42" porque roda em 2 projetos (desktop + mobile). Persona 10
  ajustada para refletir "~21 specs × 2 projetos".
- **Unitários:** ~145 testes em 17 arquivos `.mjs` (lógica pura + `-db` contra Postgres real),
  conforme persona 10.

---

## 7. Impacto das correções na nota

As correções são de **precisão de descrição**, não mudam a direção dos vereditos: o achado de
"layer DB dormente" na verdade **reforça** o diagnóstico central de que falta integração
(motor + UI), já presente no consolidado. As notas das personas 3, 4 e 12 permanecem
(respectivamente 62, 72, 72) — o problema já estava contabilizado; agora está descrito com
exatidão. Nota geral do sistema mantida em **~74/100**.
