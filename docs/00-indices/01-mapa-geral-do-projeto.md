# Mapa Geral do Projeto — Rumo à Aprovação

**Atualizado em:** 2026-06-27 (pós-SEG2)

---

## Visão de uma linha

Plataforma SaaS **B2B white-label** de preparação para concursos (foco inicial:
militares no RJ). Multi-escola com isolamento por **RLS no Postgres**. Alunos
resolvem provas, acumulam XP, sobem de patente e acompanham progresso; responsáveis
têm leitura restrita ao seu aluno; coordenação gerencia turmas, alunos e credenciais;
superadmin opera o backoffice cross-tenant.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Front-end | React + Vite (SPA) |
| Hospedagem front | Vercel |
| Backend | Supabase (Postgres + RLS + Edge Functions Deno) |
| Auth | Supabase Auth (email/senha; alunos/responsáveis por código) |
| CI/CD | GitHub Actions (gate `build-e-unitarios`, CodeQL) |
| Repositório | GitHub (público) — `Jinriuk/Rumo-a-aprova-o-` |

---

## Fases (ver [linha do tempo](./02-linha-do-tempo.md) para detalhe)

| Grupo | Fases | Onde |
|------|-------|------|
| Build / fundação | 14.5 → 15.1…15.7 → 16 → 17 | `docs/fases/` |
| Segurança | S1, SEG1, **SEG2** ✅ | `auditoria/seguranca/` |
| Banco | DB1, DB2 | `auditoria/banco/` |
| Operacional | D1A/B/C, HF1/2/3, H1, I1, I2 | `auditoria/operacional/` |
| Produto / UX | AV2, PED-UX1 | `auditoria/produto/` |
| Histórico | A, B-min, C0, C0.5, R, C1, D0, QA1, audit-all, QA0, Fase 18 | `auditoria/antigos/` |

**Fase encerrada:** SEG2 · **Próxima:** PR1 (Prontidão de Piloto Real).

---

## Arquitetura de segurança (resumo)

- **RLS** em todas as tabelas: `app.tenant_id()`, `app.papel()`, `app.usuario_id()`
- **Edge Functions** com `verify_jwt: true` (exceto `virar-semana`, gate por service_role); `service_role` nunca no front
- **CORS allowlist** nas 6 funções (SEG2) — sem curinga `*`
- **Branch protection** na `main`; CodeQL + Dependabot + Secret Protection ativos
- **Headers** de segurança nota A; repositório público sem secrets versionados

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

- [Status atual](./03-status-atual.md) · [Linha do tempo](./02-linha-do-tempo.md)
- [Pendências para piloto real](./07-pendencias-para-piloto-real.md) · [O que ler primeiro](./04-o-que-ler-primeiro.md)
- [Mapa de dependências](./06-mapa-de-dependencias.md) · [docs/README.md](../README.md)
