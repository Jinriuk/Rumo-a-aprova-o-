# Mapa Geral do Projeto — Rumo à Aprovação

**Atualizado em:** 2026-06-24 (H1)

---

## Visão de uma linha

Plataforma SaaS de preparação para concursos públicos. Modelo multi-escola com isolamento por RLS. Alunos resolvem provas, acumulam XP, sobem de patente e acompanham o progresso via dashboard. Responsáveis têm acesso de leitura restrito ao seu aluno. Coordenação gerencia turmas, alunos e credenciais.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Front-end | React + Vite (SPA) |
| Hospedagem front | Vercel |
| Backend | Supabase (Postgres 15 + RLS + Edge Functions Deno) |
| Auth | Supabase Auth (email/password) |
| CI/CD | GitHub Actions |
| Repositório | GitHub (público) — `jinriuk/rumo-a-aprova-o-` |

---

## Fases concluídas

| Fase | Nome | Status |
|------|------|--------|
| QA1 | Demo-pedagogia — validação vitrine e motor | ✅ Concluída |
| S1 | Segurança — CI, RLS, Edge Functions, LGPD | ✅ Concluída |
| DB1 | Consolidação Supabase (inventário, RLS, RPCs) | ✅ Concluída |
| DB2 | Migrations consolidadas e idempotência | ✅ Concluída |
| D1A | Acesso coordenação + backoffice | ✅ Concluída |
| D1B | Provisionamento de alunos e responsáveis | ✅ Concluída |
| D1C | Email de recuperação de acesso + SMTP | ✅ Concluída |
| HF1 | Hotfix — deploy `revogar-responsavel` + correção bugs | ✅ Concluída |
| H1 | Higiene de repositório, docs e pendências operacionais | ✅ Concluída |

---

## Fase em andamento

| Fase | Nome | Status |
|------|------|--------|
| PR1 | Prontidão de Piloto Real | 🔲 Planejada |

---

## Fases futuras planejadas

| Fase | Nome | Dependências |
|------|------|-------------|
| I1 | Implantação de escola nova (onboarding operacional) | PR1 |
| P1 | Pedagógica — conteúdo e trilhas reais | PR1 + I1 |
| M1 | Monitoramento e observabilidade em produção | PR1 |
| R1 | Recorrência e tagueamento avançado | P1 |

---

## Arquitetura de segurança (resumo)

- **RLS** em todas as tabelas: `app.tenant_id()`, `app.papel()`, `app.usuario_id()`
- **Edge Functions** com `verify_jwt: true` — `service_role` nunca exposta no front
- **SMTP** configurado via Supabase Auth (email recuperação)
- **Repositório público** — nenhuma secret commitada (ver `docs/operacao/github/repositorio-publico.md`)
- **Leaked Password Protection** ativa no Supabase Auth

---

## Escolas cadastradas

| Escola | Papel |
|--------|-------|
| Colégio e Curso Ícone | Escola real (piloto candidata) |
| Escola Piloto I1 | Ambiente de testes operacionais |
| Curso Beta Preparatório | Demo / semente (dados fictícios) |
| Matriz Educação RM | Demo / semente (dados fictícios) |

---

## Links rápidos

- [Status atual](./03-status-atual.md)
- [Linha do tempo](./02-linha-do-tempo.md)
- [Pendências para piloto real](./07-pendencias-para-piloto-real.md)
- [O que ler primeiro](./04-o-que-ler-primeiro.md)
- [Mapa de dependências](./06-mapa-de-dependencias.md)
- [docs/README.md](../README.md) — índice completo da documentação
