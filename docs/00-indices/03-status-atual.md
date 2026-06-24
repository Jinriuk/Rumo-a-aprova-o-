# Status Atual do Projeto

**Data:** 2026-06-24  
**Fase encerrada:** H1 — Higiene de Repositório, Documentação e Pendências Operacionais  
**Próxima fase:** PR1 — Prontidão de Piloto Real

---

## Resumo executivo

O projeto está **pronto para a fase PR1**. Todas as funções de coordenação operacional estão deployadas e funcionando. A documentação foi consolidada. Os riscos operacionais identificados estão documentados. A suíte de testes passa com 32+ testes e o build de produção está verde.

---

## Estado do Supabase remoto (2026-06-24)

### Edge Functions (todas ACTIVE)

| Função | Versão | Descrição |
|--------|--------|-----------|
| `provisionar-aluno` | v1 | Cria `usuarios` + `auth.users` para aluno |
| `backoffice-coordenador` | v4 | CRUD de turmas, alunos, responsáveis |
| `revogar-responsavel` | v1 | Revoga vínculo responsável-aluno ✅ HF1 |
| `gerar-meta` | v1 | Gera meta semanal para aluno |
| `virar-semana` | v1 | Avança semana pedagógica |
| `lgpd-titular` | v1 | Exporta/apaga dados do titular |

### Migrations

- **Total aplicadas:** 32
- **Última:** `0032_d1b_provisionamento_acessos`
- **Estado:** em sincronia com o repositório

### Escolas cadastradas

| Escola | Tipo | Alunos |
|--------|------|--------|
| Colégio e Curso Ícone | Real (piloto candidata) | — |
| Escola Piloto I1 | Ambiente de testes | — |
| Curso Beta Preparatório | Demo/semente | 68 |
| Matriz Educação RM | Demo/semente | — |

---

## Estado do repositório (2026-06-24)

### Branches abertas (não mergeadas)

| Branch | Ahead/Behind | Recomendação |
|--------|-------------|-------------|
| `claude/av1-auditoria-geral-jaoscu` | +1 / -2 | Preservar — tem commit único |
| `claude/demo-base-realista-auditoria-t5ji99` | +8 / -91 | Preservar — 8 commits únicos |
| `claude/naval-system-build-g9h0t5` | +0 / -52 | Pode ser deletada (sem commits únicos) |
| `claude/h1-higiene-repo-docs-operacao` | em andamento | Esta branch (H1) |

### CI

- **Gate principal:** `build-e-unitarios` — verde
- **E2E:** pulada (sem ambiente isolado configurado)
- **Testes:** 32+ testes passando

---

## Pontos de atenção para PR1

| Item | Status | Onde documentado |
|------|--------|-----------------|
| 2 alunos sem `usuario_id` (orphans em demo) | ⚠️ Baixo risco — escola demo | `docs/auditoria/h1/alunos-sem-credencial.md` |
| Repositório público — secrets auditadas | ✅ Nenhuma secret commitada | `docs/operacao/github/repositorio-publico.md` |
| Leaked Password Protection | ✅ Ativa | `docs/operacao/supabase/leaked-password-protection.md` |
| CORS `*` nas Edge Functions | ⚠️ P3 — aceitável com JWT | Pode ser endurecido no futuro |
| Branch `claude/naval-system-build-g9h0t5` sem commits únicos | ⚠️ Recomenda-se deleção | `docs/operacao/github/relatorio-branches-h1.md` |

---

## Checklist de prontidão para PR1

- [x] Todas as Edge Functions deployadas e ACTIVE
- [x] Migrations sincronizadas (32/32)
- [x] CI verde (gate `build-e-unitarios`)
- [x] Build de produção passa (`npm run build`)
- [x] Documentação consolidada (este índice)
- [x] Riscos operacionais documentados
- [ ] SMTP validado com domínio real do piloto
- [ ] Primeira escola real criada e testada end-to-end
- [ ] Credenciais de alunos reais provisionadas
- [ ] Checklist de go-live revisado (`docs/operacao/checklist-go-live-piloto.md`)
