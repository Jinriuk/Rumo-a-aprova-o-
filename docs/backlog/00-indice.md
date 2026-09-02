# Índice do backlog — Rumo à Aprovação

**Atualizado em:** 02/09/2026 (revisão 5 — PR #84, #85, #86 e os 3 dependabot mergeados em `main`)
**Como usar:** este índice é a visão cruzada de tudo que está aberto. O detalhe de cada item mora no arquivo da etapa correspondente (`etapa-01.md`, `etapa-02.md`, ...). "Frente" é engenharia, comercial ou revisão. "Etapa" é a etapa do plano mestre à qual o item pertence, é uma tag de dependência, não uma fila: o trabalho roda por frente, em paralelo, não etapa a etapa.

**Regra de carga (BKL-013):** no máximo 3 itens em estado `em execução` **por frente** ao mesmo tempo.

| ID | Título | Etapa | Frente | Responsável | Prioridade | Estado | Prazo |
|---|---|---|---|---|---|---|---|
| BKL-001 | Ambiguidade dos projetos Supabase restaurados | 2 | engenharia | Gabriel | Baixa | concluído | — |
| BKL-002 | Nenhum commit de produto em 14 dias | 1 | engenharia | Gabriel | Alta | concluído | — |
| BKL-003 | Fonte da auditoria de 25/08 | 2 | engenharia | Gabriel | Baixa | validado | — |
| BKL-004 | SECURITY DEFINER / Auth (migration `rls_auto_enable`) | 2 | engenharia | técnico (Opus) | Média | concluído | — |
| BKL-005 | Branches pendentes | 1 | engenharia | técnico (Opus) + Gabriel | Alta | concluído | — |
| BKL-006 | Papel da organização Supabase nova | 2 | engenharia | Gabriel | Baixa | concluído | — |
| BKL-007 | Congelamento de funcionalidades | 1 | revisão | Gabriel | Alta | validado | vigente |
| BKL-008 | Separar decisões agora / antes do G3 / depois do piloto | 1 | revisão | Gabriel | Média | validado | — |
| BKL-009 | Registro de commit em demo/staging/produção | 1 | engenharia | Gabriel | Baixa | concluído | — |
| BKL-010 | Nível mínimo de acesso do Leandro | 1 | comercial | Gabriel | Média | concluído | — |
| BKL-011 | Calendário semanal fixo / blocos GrinderBank | 1 | revisão | Gabriel | Média | pendente (parcial) | 05/09 |
| BKL-012 | Planilha de gastos e caixa do produto | 1 | revisão | Gabriel | Média | concluído | — |
| BKL-013 | Regra de carga simultânea (3 por frente) | 1 | revisão | Gabriel | Baixa | validado | — |

Detalhe completo de cada item: [etapa-01.md](./etapa-01.md) (governança) e [etapa-02.md](./etapa-02.md) (inventário técnico).
Decisões arquiteturais registradas: [`docs/adr/`](../adr/).
Prompt de execução técnica (BKL-004 + BKL-005): [`prompt-execucao-bkl004-005.md`](./prompt-execucao-bkl004-005.md).
