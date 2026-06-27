# Fase C0.5 — Auditoria da Fase 15, ligação ao runtime e rebuild da base demo

## 7.1 Promessa da fase
**Bloco A:** auditar a Fase 15 (que existia no banco mas estava desconectada do runtime) e ligar aluno + coordenação às trilhas/missões por `exam_tag`; reconciliar o motor C0 e as migrations faltantes no remoto.
**Bloco B:** rebuild controlado da base de vitrine — escola + 5 turmas, 60 alunos, todos com `exam_tag` e credenciais, progresso pelo **motor C0**, responsáveis, sem alunos órfãos, Lucas preservado, dados coerentes.

## 7.2 Evidência no código
- `8e300ff` liga a Fase 15 ao runtime por exam_tag; `e506d18` reconcilia o C0 (0024) + liga o front ao ledger.
- `supabase/seed/13_vitrine_militar_demo.sql` (rebuild idempotente da vitrine).
- Docs: `docs/auditoria/14-fase-c0-5-auditoria-fase15.md`, `15-bloco-b-rebuild-base-demo.md`, `docs/relatorios/{COMPARACAO_MIGRATIONS_REPO_REMOTO,RECONCILIACAO_MIGRATIONS_C0}.md`.

## 7.3 Evidência no ambiente (Supabase remoto)
| Verificação | Esperado (PR #8) | Observado |
|---|---|---|
| Escola vitrine “Matriz Educação RM” | 1 | ✅ id `11111111-1111-4111-8111-111111111111` |
| Turmas na vitrine | 5 | ✅ **5** |
| Alunos na vitrine | 60 | ✅ **60** |
| Alunos sem concurso (exam_tag) | 0 | ✅ **0** |
| Alunos órfãos (sem turma) | 0 | ✅ **0** (global) |
| Eventos via motor C0 | ~859 | ✅ ledger com **964** (cresceu nas C1) |
| Lucas preservado (topo) | 1400 XP | ✅ **1400 XP, 1º** |
| `trilha_planos` por exam_tag | por concurso | ✅ 12 planos, **5 exam_tags** |
| Reconciliação `0022_logs_coordenacao` + `0023_indices` no remoto | aplicar | ✅ aplicadas (logs_coordenacao=88 linhas; índices presentes) |
| Responsáveis | existir | `vinculos_responsaveis` = 2 |

Há uma **segunda escola** “Curso Beta Preparatório” (3 alunos, 2 turmas) — tenant B, coerente com a prova de isolamento multi-tenant.

## 7.4 O que foi realmente entregue
Fase 15 efetivamente **ligada ao runtime** (0 alunos sem concurso; planos por exam_tag); base de vitrine reconstruída exatamente como prometido (60/5/0-órfãos), progresso nascido do motor C0, Lucas no topo. Migrations faltantes reconciliadas no remoto (confirmado por dados vivos).

## 7.5 O que não foi entregue
- Os **responsáveis** na vitrine são poucos (`vinculos_responsaveis` = 2) — a “ligação ao responsável” existe mas é mínima; suficiente para a demo (RESPDEMO), não para exercício amplo.

## 7.6 Divergências
- O briefing fala em “exam_tag ligado ao aluno”; no schema isso é via `concurso_id` (não coluna em `alunos`) — mesma observação da Fase 15. Sem impacto.
- Ajuste manual único documentado e marcado (`ajuste_coordenacao`): Manuela `cm→espcex`; Alice matriculada em EsPCEx. Coerente com o relatório.

## 7.7 Riscos
- **P3** — Cobertura de responsáveis na vitrine é mínima (2 vínculos): a tela do responsável é pouco exercitada por dados reais.
- **P3** — `exam_tag` por junção (clareza de schema).

## 7.8 Decisão da fase
**Aprovada.** Os números batem com a promessa no ambiente real (60/5/0-órfãos/Lucas/eventos do motor) e a reconciliação de migrations está confirmada por dados vivos. Ressalvas menores (responsáveis escassos) não comprometem a fase.
