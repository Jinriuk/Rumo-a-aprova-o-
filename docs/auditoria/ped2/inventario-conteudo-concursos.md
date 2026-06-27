# PED2 — Inventário de conteúdo por concurso

> Auditoria do conteúdo existente (trilhas, semanas, matérias, assuntos, missões,
> metas) por concurso e definição do **MVP de conteúdo** com a matriz de
> maturidade. Base factual de toda a camada PED2.
>
> **Fonte única da maturidade:** `app/src/modules/conteudo/maturidade.js`.
> **Verificação automática:** `node scripts/validar-conteudo.mjs` (cruza esta
> matriz com os seeds) e `tests/conteudo-maturidade.test.mjs`.

Data do levantamento: 2026-06-27 · Método: leitura dos seeds + execução do
schema completo em Postgres 15 (migrations + seeds), consulta à view
`vw_concurso_qualidade`.

---

## 1. Onde o conteúdo mora (mapa de fontes)

| Camada | Tabela(s) | Seed | Escopo |
|---|---|---|---|
| Concursos do nicho | `concursos` | `05_concursos.sql` / migration `0007` | datas médias, nível |
| Estrutura de prova | `provas`, `prova_dias`, `prova_materias` | `07_provas.sql` | matérias, pesos, dias — **oficial** |
| Catálogo pedagógico | `materias`, `assuntos`, `subassuntos` | `07_provas.sql` | assuntos por `exam_tag` |
| Trilha **semanal** (calendário real) | `trilhas`, `disciplinas`, `trilha_semanas`, `atividades_modelo` | `02_trilha_cn.sql` (de `trilha-cn-v1.json`) | só **CN** hoje |
| Trilha por horizonte + missões | `trilha_planos`, `missoes`, `trilha_plano_missoes` | `09_trilhas_missoes.sql` | planos (anual/reta) + missões starter |
| **Maturidade** (PED2) | `concursos.maturidade`, view `vw_concurso_qualidade` | `18_maturidade_concursos.sql` / migration `0034` | nível de prontidão auditável |

Há **dois conceitos de "trilha"** no sistema, e a confusão entre eles era a raiz
do problema:

1. **Trilha semanal** (`trilhas` + `trilha_semanas` + `atividades_modelo`): um
   calendário real, datado, com tarefas por semana. **Só o CN tem.** É o que a
   `AreaAluno` usa para a contagem regressiva real e o plano de estudo.
2. **Trilha por horizonte** (`trilha_planos` + `missoes`): planos anuais/reta
   final com missões soltas. Vários concursos têm um esqueleto disso, mas **sem
   calendário**.

O `trilhaPadrao()` retornava sempre a trilha **semanal do CN** (a de maior
versão) e o cadastro a atribuía a **todo** aluno, de qualquer concurso — então um
aluno de EEAR herdava o calendário do Colégio Naval. Era a trilha incompleta
sendo vendida como pronta.

---

## 2. Densidade de conteúdo (medida no banco)

Saída real de `vw_concurso_qualidade` após aplicar migrations + seeds:

| código | nome | prova | matérias | assuntos | missões | planos |
|---|---|:--:|:--:|:--:|:--:|:--:|
| `cn` | Colégio Naval (CPACN) | ✅ | 9 | 6 | 3 | 4 |
| `espcex` | EsPCEx — Cadetes do Exército | ✅ | 8 | 5 | 2 | 2 |
| `esa` | ESA (EsSA) — Sargentos | ✅ | 6 | 0 | 1 | 2 |
| `epcar` | EPCAR — Cadetes do Ar | ✅ | 4 | 0 | 1 | 2 |
| `eear` | EEAR — Sargentos da Aeronáutica | ✅ | 4 | 0 | 1 | 2 |
| `cm` | Colégio Militar | ❌ | 0 | 0 | 0 | 0 |

Detalhe da trilha **semanal** do CN (`trilha-cn-v1.json`): **9 semanas**, 8
disciplinas, **33 atividades-modelo**, todas com disciplina + texto + foco
semanal — sem semana vazia (verificado por `integridadeTrilhaSemanal`).

---

## 3. Matriz de maturidade (MVP de conteúdo)

Níveis: **completa** > **beta** > **esqueleto** > **indisponível**. Regra de
produto: **só `completa` pode ser exibida/vendida como pronta.**

| Concurso | Maturidade | No MVP? | Por quê |
|---|---|---|---|
| **Colégio Naval** (`cn`) | 🟢 **completa** | ✅ núcleo | Trilha semanal real (9 sem / 33 ativ.) + estrutura oficial + missões. Testado ponta a ponta. |
| **EsPCEx** (`espcex`) | 🟡 **beta** | ✅ parcial | Estrutura oficial (2 dias, pesos), assuntos de Mat/Port/Quí e missões. **Falta o calendário semanal.** |
| **EPCAR** (`epcar`) | 🟠 **esqueleto** | ⚠️ parcial | Estrutura oficial + 1 missão de redação. Sem assuntos catalogados nem calendário. |
| **ESA** (`esa`) | 🟠 **esqueleto** | ⚠️ parcial | Estrutura oficial (4 partes) + 1 missão de inglês. Sem assuntos nem calendário. |
| **EEAR** (`eear`) | 🟠 **esqueleto** | ⚠️ parcial | Estrutura oficial (96 questões) + 1 missão de física. Sem assuntos nem calendário. |
| **Colégio Militar** (`cm`) | ⚪ **indisponível** | ❌ fora | Só cadastrado. Sem prova, assuntos, missões ou trilha. **Não recebe aluno.** |

### O que cada nível promete (e o validador exige)

| Nível | Estrutura de prova | Assuntos catalogados | Trilha semanal | Recebe aluno | Aparece como pronto |
|---|:--:|:--:|:--:|:--:|:--:|
| completa | obrigatória | obrigatória | **obrigatória** | sim | **sim** |
| beta | obrigatória | obrigatória | não | sim (com aviso) | não |
| esqueleto | obrigatória | — | — | sim (com aviso) | não |
| indisponível | — | — | — | **não** | não |

`scripts/validar-conteudo.mjs` falha o build se um concurso for declarado num
nível acima do que o conteúdo real entrega (ex.: `beta` sem assunto).

---

## 4. Lacunas priorizadas (backlog de conteúdo)

| Prioridade | Concurso | Lacuna | Para subir a |
|---|---|---|---|
| P1 | EsPCEx | montar calendário semanal (trilha datada) | completa |
| P2 | EEAR | catalogar assuntos (foco em Física, matéria de piso) | beta |
| P2 | ESA | catalogar assuntos (Inglês de alto ROI, Mat/Port) | beta |
| P3 | EPCAR | catalogar assuntos + redação (1/4 da nota) | beta |
| P4 | Colégio Militar | estrutura de prova + assuntos (cada CM tem edital próprio) | esqueleto |

O caminho de cada subida está em
[`docs/conteudo/fabrica-trilhas-concursos.md`](../../conteudo/fabrica-trilhas-concursos.md).

---

## 5. Fora do MVP (preparado, não implementado)

- **ENEM** e **concursos policiais**: deliberadamente **fora** desta camada
  (regra de escopo PED2 §7). O terreno está pronto — basta adicionar um concurso
  na fonte única com maturidade `indisponivel` e segui o pipeline; nada na UI
  quebra, pois o default de concurso desconhecido já é `indisponivel`.
- **Banco de questões oficiais**: fora de escopo (não criamos questões).
