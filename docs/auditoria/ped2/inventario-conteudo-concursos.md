# PED2 — Inventário de conteúdo por concurso

> Auditoria do conteúdo existente (trilhas, semanas, matérias, assuntos, missões,
> metas) por concurso e definição do **MVP de conteúdo** com a matriz de
> maturidade. Base factual de toda a camada PED2.
>
> **Fonte única da maturidade:** `app/src/modules/conteudo/maturidade.js`.
> **Verificação automática:** `node scripts/validar-conteudo.mjs` (cruza esta
> matriz com os seeds) e `tests/conteudo-maturidade.test.mjs`.

Data do levantamento: 2026-06-27 · Atualização: PED2-R3, 2026-08-13 · Método:
leitura dos seeds, validação gerada e execução do schema completo em Postgres
(migrations + seeds), com consulta à `vw_concurso_qualidade`.

---

## 1. Onde o conteúdo mora (mapa de fontes)

| Camada | Tabela(s) | Seed | Escopo |
|---|---|---|---|
| Concursos do nicho | `concursos` | `05_concursos.sql` / migration `0007` | datas médias, nível |
| Estrutura de prova | `provas`, `prova_dias`, `prova_materias` | `07_provas.sql` | matérias, pesos, dias — **oficial** |
| Catálogo pedagógico | `materias`, `assuntos`, `subassuntos` | `07_provas.sql` | assuntos por `exam_tag` |
| Trilha **semanal** (calendário real) | `trilhas`, `disciplinas`, `trilha_semanas`, `atividades_modelo` | `02_trilha_cn.sql` e `20_trilha_espcex.sql` | **CN e EsPCEx**, por nicho próprio |
| Trilha por horizonte + missões | `trilha_planos`, `missoes`, `trilha_plano_missoes` | `09_trilhas_missoes.sql` + `20_trilha_espcex.sql` | quatro horizontes e 24 missões EsPCEx |
| **Maturidade** (PED2) | `concursos.maturidade`, view `vw_concurso_qualidade` | `18_maturidade_concursos.sql` / migration `0034` | nível de prontidão auditável |
| Provas anteriores e recorrência | `provas_anteriores`, `questoes_prova`, `recorrencia_assunto` | `19_espcex_ped2_r3.sql` (de `espcex-ped2-r3-v1.json`) | referências curtas, tags e incidência medida; sem enunciados completos |

Há **dois conceitos de "trilha"** no sistema, e a confusão entre eles era a raiz
do problema:

1. **Trilha semanal** (`trilhas` + `trilha_semanas` + `atividades_modelo`): um
   calendário real, datado, com tarefas por semana. **CN e EsPCEx têm.** É o que a
   `AreaAluno` usa para a contagem regressiva real e o plano de estudo.
2. **Trilha por horizonte** (`trilha_planos` + `missoes`): planos anuais/reta
   final com missões soltas. Vários concursos têm um esqueleto disso, mas **sem
   calendário**.

O cadastro agora resolve a trilha publicada pelo `trilhaNicho` do concurso.
Assim, CN recebe `colegio-naval`, EsPCEx recebe `espcex` e um concurso sem
calendário nunca herda a versão mais nova de outro nicho.

---

## 2. Densidade de conteúdo (medida no banco)

Saída real de `vw_concurso_qualidade` após aplicar migrations + seeds:

| código | nome | prova | matérias | assuntos | missões | planos |
|---|---|:--:|:--:|:--:|:--:|:--:|
| `cn` | Colégio Naval (CPACN) | ✅ | 9 | 6 | 3 | 4 |
| `espcex` | EsPCEx — Cadetes do Exército | ✅ | 8 | **80** | **24** | **4** |
| `esa` | ESA (EsSA) — Sargentos | ✅ | 6 | 0 | 1 | 2 |
| `epcar` | EPCAR — Cadetes do Ar | ✅ | 4 | 0 | 1 | 2 |
| `eear` | EEAR — Sargentos da Aeronáutica | ✅ | 4 | 0 | 1 | 2 |
| `cm` | Colégio Militar | ❌ | 0 | 0 | 0 | 0 |

Detalhe da trilha **semanal** do CN (`trilha-cn-v1.json`): **9 semanas**, 8
disciplinas, **50 atividades-modelo**, todas com disciplina + texto + foco
semanal — sem semana vazia (verificado por `integridadeTrilhaSemanal`).

Detalhe EsPCEx PED2-R3: **80 assuntos oficiais / 339 subassuntos**, **200
questões** oficiais de 2024–2025 e **69 recorrências medidas**. A trilha própria
tem **9 semanas, 109 atividades e 24 missões**. Comandos: `node
scripts/validar-conteudo.mjs` e os testes `espcex-ped2-r3*` / `trilha-espcex*`.

---

## 3. Matriz de maturidade (MVP de conteúdo)

Níveis: **completa** > **beta** > **esqueleto** > **indisponível**. Regra de
produto: **só `completa` pode ser exibida/vendida como pronta.**

| Concurso | Maturidade | No MVP? | Por quê |
|---|---|---|---|
| **Colégio Naval** (`cn`) | 🟢 **completa** | ✅ núcleo | Trilha semanal real (9 sem / 50 ativ.) + estrutura oficial + missões. Testado ponta a ponta. |
| **EsPCEx** (`espcex`) | 🟢 **completa v3** | ✅ núcleo | Programa vigente, 9 semanas / 109 atividades, 24 missões e recorrência 2024–2025. |
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
- **Banco de enunciados completos**: fora de escopo. O produto guarda somente
  número, gabarito, referência curta e tags das questões oficiais.

---

## Adendo PED2-R2 (2026-07-03) — correções medidas

- **"33 atividades-modelo" do CN estava errado**: a trilha CN tem **50**
  atividades. Medido em três fontes: `trilha-cn-v1.json` (50 tarefas somadas
  por script), `seed/02_trilha_cn.sql` (50 linhas de prioridade F/P/X) e o
  banco remoto (`select count(*) from atividades_modelo` → 50). A nota em
  `maturidade.js` foi corrigida e o seed 18 regenerado.
- **Espelho de maturidade no remoto**: o seed 18 nunca tinha sido aplicado no
  projeto remoto (todos os concursos estavam `indisponivel`/v0 em
  `vw_concurso_qualidade`). Carimbado em 2026-07-03 via o próprio seed
  gerado; pós-carimbo, `suspeita_incoerencia = false` em todos os 6.
- **Gaps de material-fonte** por concurso documentados em
  [`docs/conteudo/gaps-material-fonte-concursos.md`](../../conteudo/gaps-material-fonte-concursos.md).

## Adendo PED2-R3 (2026-08-13) — EsPCEx completa

- **Programa:** o Anexo C do edital foi transcrito para 80 assuntos nas 8
  matérias. O total é reproduzível com
  `node -e "const d=require('./supabase/seed/espcex-ped2-r3-v1.json'); console.log(d.catalogo.length)"`
  → `80`. Os 339 subassuntos são recortes do texto e ficam honestamente em
  `status_dado='inferencia'`; os assuntos de primeiro nível ficam `oficial`.
- **OCR resolvido:** “Eletroquímica/Eletrólise” passa de `validar` para
  `oficial`; o Anexo C confirma eletrólise e não contém “eletroforese”.
- **Edital-alvo:** o programa de 2022 foi comparado com o Edital nº 2 S Conc
  Adms, de 22/04/2026; as mudanças de História e `Word formation` foram
  incorporadas sem quebrar chaves legadas.
- **Tagueamento real:** quatro cadernos de 2024–2025 somam **200 questões**;
  os quatro gabaritos são validados resposta por resposta.
- **Recorrência:** o seed deriva **69** linhas `medida` sobre dois anos e marca
  `config_oficial.recorrencia_status` com `[2024, 2025]`.
- **Calendário/missões:** a EsPCEx ganha calendário próprio de 9 semanas (datas
  oficiais 12–13/09/2026), 109 atividades, quatro horizontes e 24 missões.
- **Maturidade:** EsPCEx sobe para **`completa` v3**. A UI seleciona a trilha
  pelo nicho do concurso, eliminando atribuição cruzada com o CN.
- **Rastreabilidade:** hashes dos dez PDFs usados ficam nos JSONs/seeds; os
  PDFs não são versionados. Os geradores e o validador exigem 80/339/200,
  datas, faixas, gabaritos e paridade byte a byte dos seeds 19 e 20.
