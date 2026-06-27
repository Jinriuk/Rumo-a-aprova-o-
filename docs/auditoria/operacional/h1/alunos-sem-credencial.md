# Alunos sem Credencial — Investigação H1

**Data:** 2026-06-24  
**Fase:** H1  
**Tipo:** Verificação read-only (nenhuma alteração foi feita)

---

## Contexto

Durante a fase H1, foi feita uma verificação read-only no Supabase para identificar alunos cadastrados na tabela `alunos` que não possuem `usuario_id` (ou seja, não têm conta de acesso criada). Isso pode indicar alunos que foram importados mas nunca tiveram credenciais provisionadas.

---

## Consulta executada

```sql
SELECT
  a.id            AS aluno_id,
  a.nome          AS aluno_nome,
  a.usuario_id,
  e.nome          AS escola_nome,
  t.nome          AS turma_nome
FROM alunos a
JOIN escolas e ON e.id = a.escola_id
LEFT JOIN turmas t ON t.id = a.turma_id
WHERE a.usuario_id IS NULL
ORDER BY e.nome, a.nome;
```

---

## Resultado

| Total de alunos no sistema | 68 |
|---|----|
| Com `usuario_id` | 66 |
| **Sem `usuario_id` (orphans)** | **2** |

### Alunos orphans identificados

| Nome | Escola | Turma |
|------|--------|-------|
| Fernanda Sales Moreira | Curso Beta Preparatório | — |
| Thiago Bento Cardoso | Curso Beta Preparatório | — |

---

## Diagnóstico

Ambos os alunos orphans pertencem à escola **"Curso Beta Preparatório"**, que é uma escola de **demo/semente** (ID padrão `b0000000-...`). Os dados desta escola são fictícios e foram criados para fins de demonstração da plataforma.

**Causa provável:** Esses dois registros foram inseridos via seed SQL sem o correspondente `usuario_id`, possivelmente por omissão no script de semente ou por representarem alunos "rascunho" na demo.

---

## Impacto

| Cenário | Impacto |
|---------|---------|
| Escola de demo | **Baixo** — dados fictícios, sem alunos reais afetados |
| Escola real | N/A — não há alunos reais sem `usuario_id` |
| Funcionalidade | Os dois registros não conseguem fazer login (sem `usuario_id` = sem auth.user) |
| RLS | Sem `usuario_id`, esses alunos são invisíveis para qualquer política de acesso via `app.usuario_id()` |

---

## Classificação de risco

**P3 — Baixo risco.** Escola de demo, dados fictícios. Não afeta nenhuma escola real.

---

## Recomendação

**Para a escola de demo (Curso Beta Preparatório):** Opcional — estes registros podem ser deixados como estão (são dados de teste), ou provisionados via backoffice se a escola demo for usada em apresentações onde login de aluno é necessário.

**Para escolas reais:** Garantir que o fluxo de provisionamento (`provisionar-aluno`) seja sempre usado para criar alunos, de forma que `usuario_id` seja sempre preenchido. O campo deveria ter `NOT NULL` idealmente, mas como a constraint não existe na migration atual, o controle é feito pelo fluxo de backoffice.

**Sugestão de verificação preventiva em PR1:** Antes do go-live da primeira escola real, executar a consulta acima e confirmar que retorna 0 linhas para a escola real.

---

## Ação tomada nesta fase

**Nenhuma** — investigação read-only conforme escopo da fase H1. Não foram criadas migrations, não foram alterados dados.
