# Gaps de material-fonte por concurso (PED2-R2)

**Data:** 2026-07-03 · **Fase:** PED2-R2 (produção de conteúdo)
**Regra desta página:** conteúdo de trilha só entra no produto com **fonte real**
(edital, prova oficial ou metodologia autorada pelo dono). Nenhum bloco abaixo
foi preenchido por inferência do agente — o que falta está **aguardando
material-fonte do dono**, e é melhor um gap declarado do que uma trilha
plausível sem lastro.

> Contexto: a decisão 16 do build (`docs/fundacao/07-decisoes-do-build.md`)
> reserva ao dono o plano de estudos por concurso — "o plano precisa ser pensado
> prova a prova". A única trilha semanal existente (CN) é a metodologia autorada
> por ele, importada do app original (`supabase/seed/trilha-cn-v1.json`,
> comentário de cabeçalho: "NÃO reescrever, não 'melhorar'").

## 0. O que foi verificado (Fase 0, 2026-07-03)

- **Repositório:** nenhum PDF, edital ou prova de referência
  (`find . -iname "*.pdf"` e `find . -iname "*edital*"` → 0 resultados fora de
  `node_modules`).
- **Storage remoto (Supabase):** só um logo de escola
  (`select bucket_id, name from storage.objects` → 2 objetos, bucket
  `Logos-escolas`).
- **Banco remoto:** `provas_anteriores` = 1 linha (CPACN 2024, `status_dado`
  `validar`, sem o documento da prova); `questoes_prova` = 3 (amostra do seed
  12); `recorrencia_assunto` = 3 (2 `estimada` + 1 `medida`, todas `cn`,
  amostra do seed 12). Nada para espcex/eear/epcar/esa/cm.

## 1. EsPCEx — `beta` (fonte parcial; trilha semanal sem fonte)

**O que tem lastro hoje** (transcrição do doc do dono, Fase 15.0/15.2):
estrutura de prova `oficial` (2 dias, 100 questões, pesos por matéria) e 5
assuntos (`Literatura Brasileira` com 7 subassuntos, `Geometria Analítica`,
`Polinômios`, `Radioatividade` e `Eletroquímica/Eletrólise` — este último
`status_dado = 'validar'` por suspeita de OCR "eletroforese").

**Cobertura medida (banco remoto, 2026-07-03):**

```sql
select pm.materia_codigo, pm.num_questoes, pm.eh_redacao,
  (select count(*) from assuntos a
    where a.exam_tag='espcex' and a.materia_codigo=pm.materia_codigo) as assuntos
from prova_materias pm where pm.exam_tag='espcex' order by pm.ordem;
-- por 20q → 1 assunto | red → 0 | fis 12q → 0 | qui 12q → 2
-- mat 20q → 2 | ing 12q → 0 | his 12q → 0 | geo 12q → 0
```

3 de 7 matérias objetivas têm algum assunto catalogado; trilha semanal:
**0 semanas** (`select count(*) from trilhas where nicho like '%espcex%'` → 0;
a única trilha no banco é `colegio-naval` v1, 9 semanas / 50 atividades).

**O que falta para `completa` (aguardando material-fonte do dono):**

| # | Material necessário | O que destrava (passo da fábrica) |
|---|---|---|
| 1 | **Anexo C do edital EsPCEx** (programa oficial) — PDF ou transcrição conferida | Passo 3: catalogar assuntos `oficial` de fís/ing/his/geo/red e completar mat/por/quí; resolver o item `validar` (eletroforese × eletroquímica) |
| 2 | **Metodologia semanal autorada pelo dono** (equivalente EsPCEx do plano CN: sequência, foco por semana, prioridades F/P/X, meta de questões) | Passo 5: `trilha-espcex-v1.json` → `gerar-seed-trilha.mjs` → seed SQL. Molde CN: 9 semanas, 50 atividades-modelo, 8 disciplinas. Faltam **todas** as semanas (0 de ~9 no molde CN) |
| 3 | **Provas anteriores oficiais (PDF + gabarito)** | Tagueamento em `questoes_prova` + recorrência `medida` (15.7) — hoje só há recorrência para CN, e de amostra |

Sem o item 2, a maturidade fica **honestamente em `beta`** — o gate de UI já
avisa o aluno e não atribui calendário de outro concurso.

## 2. EEAr — `esqueleto` (sem fonte para assuntos)

Tem: estrutura `oficial` (96 questões, 4 matérias, piso 5,0 por matéria) e 1
missão. Falta (→ `beta`): **programa oficial do edital CFS** para catalogar
assuntos de mat/fis/por/ing (hoje **0 assuntos** — query do §0). Depois
(→ `completa`): metodologia semanal do dono + provas anteriores.

## 3. ESA — `esqueleto` (sem fonte para assuntos)

Tem: estrutura `oficial` (4 partes iguais, 50 questões) e 1 missão. Falta
(→ `beta`): **programa oficial do edital ESA** (mat/por/his/geo/ing; hoje 0
assuntos). Depois: metodologia semanal + provas anteriores.

## 4. EPCAR — `esqueleto` (sem fonte para assuntos)

Tem: estrutura `oficial` (48 questões, redação eliminatória+classificatória) e
1 missão. Falta (→ `beta`): **programa oficial do edital CPCAR** (por/mat/ing +
redação; hoje 0 assuntos). Depois: metodologia semanal + provas anteriores.

## 5. Colégio Militar — `indisponivel` (sem fonte nenhuma)

Só o cadastro em `concursos`. **Cada CM tem edital próprio** — antes de
qualquer conteúdo é preciso o dono definir **qual(is) CM(s)** e anexar o(s)
edital(is). Falta (→ `esqueleto`): estrutura de prova oficial (passo 2 da
fábrica). O gate de cadastro segue bloqueando aluno em `cm` (correto).

## 6. Tagueamento e recorrência (transversal)

`questoes_prova` só cresce com **prova real em mãos** (documento + gabarito
oficial). A única prova referenciada (CPACN 2024) não está anexada ao projeto,
então **nenhuma questão nova foi tagueada nesta fase** — inventar questão ou
gabarito está proibido. Recorrência: os graus continuam como estavam (2
`estimada` + 1 `medida`, todas CN); a regra de ouro do `recorrencia.js` (só
`validada`/`medida` promove prioridade) permanece intocada.

## 7. Como entregar o material (para o dono)

Qualquer um dos formatos serve: PDF no repositório (`docs/conteudo/fontes/`),
upload num bucket do Supabase, ou transcrição textual conferida. Com material
em mãos, o caminho é o pipeline de 6 passos de
[`fabrica-trilhas-concursos.md`](./fabrica-trilhas-concursos.md) — a fábrica
está pronta e testada; o que falta é exclusivamente a matéria-prima.
