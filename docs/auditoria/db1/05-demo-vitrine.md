# DB1-F — Higienização de Demo / Vitrine

> Data: 2026-06-21 · Projeto `bdjkgrzfzoamchdpobbl`. Verificação read-only
> ao vivo + revisão dos seeds 13/14/15/16/17.

## 1. Estrutura da demo

Não há tabela dedicada de demo. A vitrine é **dado escopado por
`escola_id`** dentro das tabelas de núcleo:

| Escola | slug | status | alunos | turmas | usuários |
|---|---|---|---|---|---|
| Matriz Educação RM | `vitrine` (`1111…`) | implantacao | **60** | **4** | 62 |
| Curso Beta Preparatório | `beta` (`2222…`) | implantacao | 3 | 2 | 3 |

## 2. Verificações ao vivo

| Item | Esperado | Medido | OK |
|---|---|---|---|
| Alunos da vitrine | 60 | 60 (18+15+14+13) | ✅ |
| Turmas da vitrine | distribuição militar | `CN/EPCAR — Manhã` 18 · `CN/EPCAR — Tarde` 15 · `EsPCEx 2026` 14 · `EsSA/EEAr 2026` 13 | ✅ |
| Aluno **Lucas** | presente | 1 (`a0000000-…0001`) | ✅ |
| Vínculos de responsável | demo presente | 2 | ✅ |
| Órfãos em `alunos_turmas` | 0 | **0** | ✅ |
| Órfãos em `aluno_eventos_progresso` | 0 | **0** | ✅ |
| Órfãos em `registros_estudo` | 0 | **0** | ✅ |
| Distribuição de exam_tag (eventos) | multi-concurso plausível | cn 384 · espcex 211 · epcar 178 · esa 118 · eear 95 · cm 5 | ✅ |

**Sem órfãos, sem resíduos, sem dados reais** (as duas escolas são
demo/implantação). A distribuição por concurso é coerente com as turmas
militares (CN/EPCAR concentra a maioria dos eventos).

## 3. Idempotência dos seeds

- `tests/reset-db.sh` aplica migrations + **todos os seeds 2×** de
  propósito; o teste de motor confere que **nada duplicou**. Rodado nesta
  DB1: **222/222 pass** — idempotência exercitada e verde.
- Seeds `04`, `13`, `14` inserem em `auth.users` (contas de acesso) e por
  isso são **pulados** no Postgres vanilla do CI/local (não há GoTrue) —
  documentado no próprio `reset-db.sh`. Não é falha: são seeds de
  ambiente Supabase real.
- Seeds `15` (Lucas) e `16` (higiene) operam sobre 01–12; `17` (pedagogia
  demo / exam_tag) é coberto pelo teste `qa1-exam-tag.test.mjs`.

## 4. Pedagogia / coerência (EsPCEx × CN)

Confirmado nos testes de `qa1-exam-tag` (verdes): o tagueamento de
conteúdo por `exam_tag` impede a mistura indevida (ex.: turma EsPCEx não
recebe trilha/itens de CN). Sem inconsistência pedagógica detectada na
vitrine.

## 5. Correção de seed aplicada na DB1

**Nenhuma.** A vitrine está **coerente, idempotente, sem órfãos e
reconstruível** pelos seeds existentes — não houve necessidade de tocar
em seed nesta fase. Qualquer ajuste futuro de seed deve permanecer
(a) idempotente, (b) restrito à `escola_id` demo, (c) sem afetar escola
real, (d) com relatório antes/depois — conforme regra DB1-F.

## 6. Veredito

Demo/vitrine **validada**: Lucas, responsável e coordenação demo
presentes; 60 alunos / 4 turmas; zero órfãos; seeds idempotentes
(provado 2×). **Não apagar a vitrine** — e, se um dia for reconstruída,
os seeds 13–17 já fazem isso de forma idempotente.
