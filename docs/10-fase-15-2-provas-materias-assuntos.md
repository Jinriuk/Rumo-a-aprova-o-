# Fase 15.2 — Concursos, provas, matérias e assuntos (13/06/2026)

Segunda subfase da Fase 15. Cadastra a **estrutura pedagógica** de
cada concurso (provas, dias, matérias, pesos, assuntos, subassuntos),
etiquetada por `exam_tag`. Conteúdo global, aditivo, sem tocar no motor
da 14.5 nem nas telas (E2E intocada).

## O que foi implementado

- **`provas`** — uma por concurso (`exam_tag` único): nº de dias,
  fórmula oficial da média, observação, `status_dado`.
- **`prova_dias`** — dias/blocos (CN e EsPCEx têm 2; os demais, bloco
  único), com duração informativa.
- **`materias`** — catálogo global de disciplinas (mat, por, ing, red,
  fis, qui, bio, his, geo). Separado de `disciplinas` (que é por trilha):
  aqui é a matéria do **edital**.
- **`prova_materias`** — o coração da subfase: para cada concurso, quais
  matérias caem, com nº de questões, peso, valor por questão, papel
  (objetiva/redação), bloco do edital e `status_dado`.
- **`assuntos`** + **`subassuntos`** — tópicos por matéria/concurso, com
  `prioridade` (alta/media/baixa, **preliminar**) e `status_dado`.
- **Módulo puro** `app/src/modules/conteudo/estruturaProva.js**: separa
  objetivas de redação, soma questões, agrupa por dia, ordena assunto
  por prioridade, compõe subassuntos, resume status. Testável sem banco.
- **Seam de dados**: `carregarEstruturaProva(examTag)`.

### Concursos cadastrados (estrutura fiel ao doc)

| Concurso | exam_tag | Matérias | Questões obj. | Redação | Dias |
|---|---|---|---|---|---|
| Colégio Naval | `cn` | 9 (inclui **Biologia**) | 90 | eliminatória | 2 |
| EPCAR | `epcar` | 4 | 48 | elim. + classif. | 1 |
| EsPCEx | `espcex` | 8 (inclui **Lit. Brasileira**) | 100 | elim. + classif. (p1) | 2 |
| ESA | `essa` | 6 | 50 | eliminatória | 1 |
| EEAR | `eear` | 4 | 96 | **ausente** | 1 |

- **CN ≠ EPCAR** e **ESA ≠ EEAR**: estruturas distintas mesmo dentro da
  turma comercial. Verificado por teste (Biologia só no CN; matérias de
  ESA e EEAR diferentes).
- **EsPCEx isolado** com os pesos oficiais (Mat/Port 2,0; Física/Inglês
  1,5; Química/Hist/Geo 1,0).

### Assuntos e subassuntos (starter + obrigatórios)

- **Biologia do CN** (programa catalogado, 🟢 oficial): Citologia,
  Genética e Evolução, Ecologia, Fisiologia Humana, Saúde Pública — com
  subassuntos (membrana/organelas/mitose-meiose, Mendel/DNA, cadeias/
  biomas, digestório/circulatório/nervoso, parasitoses/ISTs).
- **Literatura Brasileira da EsPCEx** (🟢 oficial): Quinhentismo, Barroco,
  Arcadismo, Modernismo 1ª/2ª/3ª gerações, tendências contemporâneas.
- Núcleo de Matemática (CN: Geometria Plana; EsPCEx: Geometria Analítica,
  Polinômios) e Química da EsPCEx (Radioatividade).

## Status dos dados

- **Oficial (🟢):** toda a estrutura de prova (matérias, nº de questões,
  pesos, dias, fórmula) e os programas catalogados de Biologia/CN e
  Literatura/EsPCEx.
- **Inferência (🟡):** a **prioridade** de cada assunto (deriva de peso ×
  recorrência; a recorrência ainda não foi medida).
- **Validar (⚠️):** `Eletroquímica/Eletrólise` na Química da EsPCEx — a
  transcrição trouxe "eletroforese", provável erro de OCR; observação
  registrada para conferência no Anexo C.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/0009_provas_materias_assuntos.sql` | **novo** — 6 tabelas, RLS global, grants |
| `supabase/seed/07_provas.sql` | **novo** — estrutura dos 5 concursos + assuntos |
| `tests/reset-db.sh` | glob de seed inclui o 07 (`0[123567]`) |
| `app/src/modules/conteudo/estruturaProva.js` | **novo** — recortes da estrutura |
| `app/src/shared/data/index.js` | + `carregarEstruturaProva` |
| `tests/provas.test.mjs` | **novo** — 8 testes de lógica pura |
| `tests/provas-db.test.mjs` | **novo** — 9 testes de estrutura + RLS |

## O que ficou fora (proposital)

- **Recorrência por assunto** (o ativo proprietário) — só na 15.7.
- Catálogo exaustivo de assuntos de todas as matérias: cadastrado o
  starter + os obrigatórios; o resto entra com o tagueamento (15.7).
- Níveis, trilhas, missões, XP, simulados — subfases 15.3–15.6.
- UI: nenhuma tela consome as novas tabelas ainda (footprint zero no
  bundle e na suíte E2E).

## Riscos ou dúvidas

- A `prioridade` é preliminar e marcada como tal; não virou regra fixa.
- A divisão 6/6/6 de Ciências do CN segue o doc; reconferir no edital
  vigente se é fixa por ano (item §15.8 do doc).
- EsPCEx Química "eletroforese" → `validar` (OCR).

## Testes

- **build:** ✅ passou (bundle inalterado).
- **unitários:** ✅ 60/60 (43 anteriores + 8 lógica de estrutura + 9
  estrutura/RLS no banco).
- **E2E:** ⏳ não executável localmente (browser do Playwright bloqueado
  pela egress); validado pelo CI. Impacto esperado nenhum (sem wiring).
- **RLS/isolamento:** ✅ estrutura é global (escola A e B leem igual);
  escrita negada ao usuário logado (só service_role).
- **observações:** migrations + seed rodados 2× (idempotência exercitada).

## Status

✅ **Subfase 15.2 encerrada.** Pode avançar para a 15.3 após o CI
confirmar o E2E verde no push.
