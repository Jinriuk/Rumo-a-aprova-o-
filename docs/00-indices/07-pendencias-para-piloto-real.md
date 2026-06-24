# Pendências para o Piloto Real (PR1)

**Data:** 2026-06-24  
**Fase de origem:** H1  
**Próxima fase:** PR1

Este documento lista o que **falta** antes de colocar a primeira escola real em produção. Os itens estão priorizados por criticidade.

---

## P0 — Bloqueadores absolutos (must-have antes do go-live)

| # | Item | Responsável | Status |
|---|------|------------|--------|
| P0-1 | SMTP validado com domínio real do piloto (não o de demo) | Operação | 🔲 Pendente |
| P0-2 | Escola real criada no Supabase (`escolas`, `usuarios` coordenação, `auth.users`) | Operação | 🔲 Pendente |
| P0-3 | Primeira turma e alunos reais provisionados via backoffice | Coordenação | 🔲 Pendente |
| P0-4 | Login do primeiro aluno real testado end-to-end | QA | 🔲 Pendente |
| P0-5 | Recuperação de senha do aluno testada com e-mail real | QA | 🔲 Pendente |
| P0-6 | Revisão do `docs/operacao/checklist-go-live-piloto.md` | Todos | 🔲 Pendente |

---

## P1 — Alta prioridade (resolver antes ou logo após o go-live)

| # | Item | Responsável | Status |
|---|------|------------|--------|
| P1-1 | Habilitar backups automáticos no Supabase (plano pago) | Infra | 🔲 Pendente |
| P1-2 | Configurar alertas de uptime (Supabase / Vercel) | Infra | 🔲 Pendente |
| P1-3 | Validar RLS com usuário real de coordenação (não seed) | QA | 🔲 Pendente |
| P1-4 | Teste de responsável vinculado + revogação com dados reais | QA | 🔲 Pendente |
| P1-5 | Plano de I1 revisado e aprovado (`docs/auditoria/i1/00-plano-implantacao-escola-nova.md`) | Operação | 🔲 Pendente |

---

## P2 — Importantes (roadmap próximo)

| # | Item | Status |
|---|------|--------|
| P2-1 | Ambiente E2E isolado (secrets `E2E_SUPABASE_URL` / `E2E_SUPABASE_ANON_KEY`) | 🔲 Pendente |
| P2-2 | Branch `claude/naval-system-build-g9h0t5` deletada (sem commits únicos) | 🔲 Pendente |
| P2-3 | 2 alunos orphans na escola demo resolvidos (sem `usuario_id`) | 🔲 Pendente (baixo risco) |
| P2-4 | Smoke test manual em produção pós-merge H1 | 🔲 Pendente |

---

## P3 — Melhoria futura (não bloqueia piloto)

| # | Item |
|---|------|
| P3-1 | Endurecer `Access-Control-Allow-Origin: *` para domínio Vercel nas Edge Functions |
| P3-2 | Tabela `admin_logs` separada para ações de superadmin (hoje usa `logs_coordenacao`) |
| P3-3 | Otimizar dupla chamada `auth.getUser()` em `revogar-responsavel` para superadmin |
| P3-4 | Implementar ambiente E2E isolado (ver `docs/operacao/e2e-ambiente.md`) |

---

## O que já está resolvido (não é mais pendência)

| Item | Quando resolvido |
|------|-----------------|
| `revogar-responsavel` não estava deployada (P1 AV1) | HF1 — 2026-06-24 |
| Bug: revogar apagava usuário responsável | HF1 — 2026-06-24 |
| Superadmin não conseguia revogar | HF1 — 2026-06-24 |
| CORS nas Edge Functions | D1B |
| SMTP de recuperação de senha | D1C |
| CI gate com 200+ testes | S1 |
| RLS multi-escola auditada | S1/DB1 |
| 32 migrations sincronizadas | DB2 |
