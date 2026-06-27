# AV2 — 00: Fundamentos do Sistema

**Fase:** AV2 — Auditoria Funcional Total e Coerência do Produto
**Data:** 2026-06-24
**Auditor:** Claude (claude/av2-auditoria-funcional-total)
**Branch base:** main (HF2 confirmado mergeado: commit 0581ec5, PR #33)

---

## 4.1 — O que o sistema promete?

O **Rumo à Aprovação** é uma plataforma SaaS white-label de acompanhamento de estudos para cursinhos/colégios preparatórios para concursos militares. Modelo multi-escola com isolamento por RLS.

### Promessas por papel:

**Aluno:**
- Tem plano de estudo semanal (missões com objetivos)
- Tem trilha de concurso (macrovisão do caminho)
- Tem metas semanais com XP e gamificação (patentes militares)
- Acompanha desempenho por matéria (precisão, volume, tempo)
- Registra estudo rápido (questões/acertos/tempo)
- Usa cronômetro integrado com registro automático
- Vê simulados com nota projetada
- Vê conquistas e histórico de semanas

**Responsável:**
- Acompanha aluno vinculado em visão simplificada
- Vê resumo da semana, meta, atividades, desempenho por matéria
- Acessa por código (igual aluno)

**Coordenação:**
- Gerencia escola: alunos, turmas, ranking, LGPD, marca
- Provisiona alunos (individual ou em lote)
- Gerencia responsáveis (adicionar, revogar, revincular)
- Vê alertas de risco e destaques
- Personaliza marca (nome, cor, logo)

**Superadmin (Backoffice):**
- Cria e gerencia escolas
- Provisiona coordenadores
- Suspende/reativa/cancela escolas
- Vê logs administrativos
- Não precisa de script manual para nenhuma operação

---

## 4.2 — O que deve ser verdade?

| Regra | Verificada na AV2? |
|-------|-------------------|
| Responsável só vê aluno vinculado | ✅ Confirmado: respdemo2026x só vê Lucas |
| Coordenação só vê sua escola | ✅ Confirmado: Coord Vitrine vê apenas Vitrine |
| Aluno só vê seu próprio progresso | ✅ Confirmado: login por código único |
| Superadmin vê operação interna | ✅ Confirmado: Backoffice com todas as escolas |
| Revogar responsável remove vínculo, não apaga conta | ✅ Confirmado: conta permanece, "Responsável do Lucas" aparece para revincular |
| Revincular responsável recria vínculo, não duplica conta | ✅ Confirmado: mesma conta reativada |
| Plano/trilha/hoje precisam ser coerentes | ✅ Parcialmente: semana 4 de 9, missão 4, objetivos coerentes |
| RLS isola escolas | ✅ Não verificado cross-tenant diretamente; estrutura RLS documentada em S1 |
| Escola suspensa bloqueia usuários | ✅ Não testado diretamente nesta fase (escola real não suspensa) |
| Backoffice substitui ações manuais no banco | ✅ Confirmado: criar escola, provisionar coordenador, suspender, reativar via UI |

---

## Stack confirmada

| Camada | Tecnologia |
|--------|-----------|
| Front-end | React + Vite (SPA) |
| Hospedagem front | Vercel |
| Backend | Supabase (Postgres 15 + RLS + Edge Functions Deno) |
| Auth | Supabase Auth (email/password) |
| CI/CD | GitHub Actions |
| Repositório | GitHub público: jinriuk/rumo-a-aprova-o- |

---

## Edge Functions deployadas (confirmadas em status atual)

| Função | Status | Descrição |
|--------|--------|-----------|
| provisionar-aluno | ACTIVE v1 | Cria usuarios + auth.users para aluno |
| backoffice-coordenador | ACTIVE v4 | CRUD de turmas, alunos, responsáveis |
| revogar-responsavel | ACTIVE v1 | Revoga vínculo responsável-aluno (HF1) |
| gerar-meta | ACTIVE v1 | Gera meta semanal para aluno |
| virar-semana | ACTIVE v1 | Avança semana pedagógica |
| lgpd-titular | ACTIVE | Exportar/excluir dados LGPD |

---

## Fases anteriores concluídas

QA1 → S1 → DB1 → DB2 → D1A → D1B → D1C → HF1 → HF2 → H1

**HF2 mergeado:** PR #33 em 24/06/2026, 2 horas antes desta auditoria.
Correções: CORS de provisionar-aluno + re-vinculação de responsável.
