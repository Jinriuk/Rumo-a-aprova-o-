# Pendências para o Piloto Real (PR1)

**Atualizado em:** 2026-07-02 (REG1 — reconciliado com PED1→FIX1 e SDB-AUDIT)
**Próxima fase:** PR1 (go-live) · trabalho de código remanescente em FIX2/PED2 r2

O que falta antes de colocar a primeira escola real em produção, priorizado por
criticidade. **Nenhum P0/P1 de segurança** está aberto — os P0 abaixo são de
**operação do go-live**; o P1-5 é o único P1 de **produto** (fluxo que mente ao
usuário), documentado desde a auditoria sênior de 28/06 e ainda sem correção.

---

## P0 — Bloqueadores do go-live (antes da primeira escola real)

| # | Item | Responsável |
|---|------|------------|
| P0-1 | SMTP validado com domínio real do piloto (não o de demo) | Operação |
| P0-2 | Escola real criada (`escolas` + coordenação + `auth.users`) | Operação |
| P0-3 | Primeira turma e alunos reais provisionados via backoffice | Coordenação |
| P0-4 | Login do primeiro aluno real testado end-to-end | QA |
| P0-5 | Recuperação de senha testada com e-mail real | QA |
| P0-6 | Revisão do `docs/operacao/checklist-go-live-piloto.md` | Todos |

---

## P1 — Alta prioridade (antes ou logo após o go-live)

| # | Item | Destino |
|---|------|---------|
| P1-1 | Backups automáticos no Supabase (plano Pro) + **restore testado** | Julho / Infra |
| P1-2 | Região `sa-east-1` (LGPD — dado de menor no Brasil) | Julho / Infra |
| P1-3 | Alertas de uptime (Supabase / Vercel) + **destino da observabilidade** (`VITE_ERROR_REPORT_URL` — o gancho existe, aponta para lugar nenhum) | Infra |
| P1-4 | Validar RLS e responsável+revogação com dados reais (não seed) — incl. o **seletor multi-filhos do FIX1** ao vivo | QA |
| ~~P1-5~~ | ✅ **Resolvido (FIX2, 02/07):** a tela "esqueci meu código" não coleta mais e-mail nem grava na tabela inexistente — orienta honestamente a pedir novo código à coordenação (que emite pelo painel). Fila real pré-auth ficou para o ADM2, com análise de abuso própria | FIX2 |

---

## P2 — Importantes (roadmap próximo)

| # | Item | Estado |
|---|------|--------|
| P2-1 | Curls de verificação do CORS preflight (deploy já feito na SEG2) | ⏳ dono |
| P2-2 | Separação demo × real (projeto Supabase dedicado); SDB-AUDIT: credenciais demo em produção | 🔲 antes do aluno real |
| P2-3 | Staging isolado + secrets `E2E_SUPABASE_*` (specs existem e são puladas no CI) | 🔲 Julho |
| P2-4 | Leaked Password Protection (recurso Pro) | 🔲 Julho |
| P2-5 | Credencial de aluno opaca — modelo documentado (SEC3), `provisionar-aluno` ainda usa `password = codigo` | 🔲 SEC3b |
| P2-6 | Rate limiting no login por código (GoTrue) | 🔲 SEC3b |
| P2-7 | Restrições no bucket de storage + 13 FKs sem índice (SDB-AUDIT §7, antes de QA2) | 🔲 DB3 |
| ~~P2-8~~ | ✅ **Fechado (FIX2 0037, 02/07):** escritores de conquista dos DOIS motores (C0 0024 + PED1 0033) viraram no-op; 5 funções mortas do seam removidas; dados preservados; fonte única = ledger C0 + derivação no cliente. Resta só a **remoção física** das 4 tabelas deprecadas (P4, DB3) | FIX2 / DB3 |

---

## P3 — Melhoria futura (não bloqueia piloto)

| # | Item |
|---|------|
| P3-1 | Retenção/rotação de logs (`logs_acesso` com 1008 rows sem retenção — SDB-AUDIT) |
| P3-2 | Tagueamento de recorrência com volume útil (hoje 3 questões) |
| P3-3 | A11y restante (auditoria axe/contraste), `data-testid`, gate de release formal |

---

## Já resolvido (não é mais pendência)

| Item | Fase | Verificado REG1 |
|------|------|:---:|
| CORS `*` → allowlist nas 6 Edge Functions (código **e deploy**) | SEG1/SEG2 | ✅ 6/6 ACTIVE |
| Branch protection, CodeQL, Dependabot, Secret Protection, headers A | SEG1/SEG2 | — |
| Motor de progresso vivido (XP/missões/níveis/onboarding) | PED1 | ✅ 0033 + UI |
| Maturidade de conteúdo + fábrica de trilhas + validador | PED2 r1 | ✅ 0034 + gates |
| SuperADM profissional | ADM2 | ✅ |
| Export CSV + comparativo turma/concurso | PERF1 | ✅ na UI da escola |
| Virada por escola (0035) + atomicidade LGPD (0036) + timing-safe | SEC3 | ✅ aplicadas remoto |
| Trava de duplo envio, DTOs, cancelamento | FE1 | ✅ |
| A11y base (`htmlFor`), skeletons, modo essencial | UX1 | ✅ |
| Recorrência na trilha + simulado por concurso ligados à UI | Fechamento-100% | ✅ imports verificados |
| CSP `script-src 'self'` (era P3-2 antigo) | Fechamento-100% | ✅ `vercel.json` |
| Drift de migrations 0034/0035/0036 — paridade repo 36 == ledger 36 | SDB-FIX1 | ✅ MCP 02/07 |
| 5 achados RC1 (responsável multi-filhos, logs, branch morto, contextos, bundle) | FIX1 | ✅ PR #60 + CI verde |
| `admin_logs` separada para superadmin (era P3-3 antigo) | D0/ADM2 | ✅ tabela existe (14 rows) |
| Suíte de testes + gate de CI verde | S1 → FIX1 | ✅ **471/471** |
