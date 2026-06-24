# Relatório de Branches — H1

**Data:** 2026-06-24  
**Fase:** H1 — Higiene de Repositório  
**Repositório:** `jinriuk/rumo-a-aprova-o-`

---

## Metodologia

Para cada branch não mergeada na main, foi verificado:
1. Quantos commits à frente da main (`ahead`)
2. Quantos commits atrás da main (`behind`)
3. Se os commits à frente existem apenas nessa branch (trabalho único) ou já foram integrados

Critério de segurança para deleção: `ahead == 0` (nenhum commit único na branch).

---

## Branches analisadas

### `claude/av1-auditoria-geral-jaoscu`

| Métrica | Valor |
|---------|-------|
| Ahead da main | **1 commit** |
| Behind da main | 2 commits |
| Commits únicos | Sim |

**Diagnóstico:** Possui trabalho único não mergeado. **NÃO deletar** sem revisar o conteúdo e decidir conscientemente sobre descarte ou merge.

**Recomendação:** Manter por enquanto. Criar issue ou PR para revisão.

---

### `claude/demo-base-realista-auditoria-t5ji99`

| Métrica | Valor |
|---------|-------|
| Ahead da main | **8 commits** |
| Behind da main | 91 commits |
| Commits únicos | Sim (8) |

**Diagnóstico:** Branch com trabalho substancial (8 commits únicos). Está 91 commits atrás da main, o que indica divergência significativa. **NÃO deletar** sem revisão do proprietário. O trabalho pode ser valioso (base demo realista para auditoria) ou pode estar obsoleto dado o progresso das fases D1 e HF1.

**Recomendação:** Revisar os 8 commits únicos. Se o conteúdo foi supersedido pela base de dados atual, pode ser arquivado. Se contiver dados ou scripts relevantes, abrir PR de integração.

---

### `claude/naval-system-build-g9h0t5`

| Métrica | Valor |
|---------|-------|
| Ahead da main | **0 commits** |
| Behind da main | 52 commits |
| Commits únicos | Nenhum |

**Diagnóstico:** Branch completamente subsumida pela main. Não há nenhum commit único nessa branch que não esteja já na main. **É seguro deletar.**

**Recomendação:** ✅ Deletar — não há risco de perda de trabalho.

---

### `claude/hf1-deploy-revogar-responsavel-cpey7k`

| Status | Mergeada via PR #30 (2026-06-24) |
|--------|----------------------------------|

Branch já mergeada. Pode ser deletada (convencional após merge).

---

### `claude/h1-higiene-repo-docs-operacao`

| Status | Em andamento (esta branch) |
|--------|---------------------------|

Branch atual do H1. Será mergeada via PR após conclusão.

---

## Resumo de ações

| Branch | Ação recomendada | Risco |
|--------|-----------------|-------|
| `claude/av1-auditoria-geral-jaoscu` | Preservar, revisar | Médio se deletada |
| `claude/demo-base-realista-auditoria-t5ji99` | Preservar, revisar | Alto se deletada sem revisão |
| `claude/naval-system-build-g9h0t5` | **Pode deletar** | Nenhum |
| `claude/hf1-deploy-revogar-responsavel-cpey7k` | Pode deletar (pós-merge) | Nenhum |
| `claude/h1-higiene-repo-docs-operacao` | Mergear no PR1 | N/A |

---

## Política de branches do projeto

- Prefixo `claude/` para branches criadas pelo assistente
- Branches de hotfix: `claude/hf<n>-<descricao>-<hash>`
- Branches de fase: `claude/<fase>-<descricao>-<hash>` ou sem hash
- Nunca deletar branch com commits únicos não revisados
- Após merge de PR, a branch pode ser deletada pelo GitHub automaticamente
- Registrar motivo no relatório antes de qualquer deleção
