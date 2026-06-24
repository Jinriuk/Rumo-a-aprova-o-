# Documentação — Rumo à Aprovação

**Atualizado em:** 2026-06-24 (H1)

Documentação organizada por área. Os nomes de arquivo originais foram **preservados**
(incluindo os prefixos numéricos do histórico); apenas a pasta mudou.

## 📁 Estrutura

| Pasta | O que contém |
|---|---|
| [`00-indices/`](#-00-indices--índices-e-status) | Índices, mapa geral, linha do tempo, status atual, pendências |
| [`fundacao/`](#-fundacao--handoff-e-arquitetura) | Handoff, visão geral, premissas e arquitetura do sistema |
| [`fases/`](#-fases--histórico-de-build) | Histórico de build, fase a fase (14.5 → 17) |
| [`auditoria/`](./auditoria/README.md) | Auditoria multivisão de maturidade + auditorias de fase (C0.5, Bloco B, D1A/B/C, HF1, H1) |
| [`operacao/`](#-operacao--infra-lgpd-e-go-live) | Infra, ambientes, LGPD, backup, go-live, rollback, checklists |
| [`relatorios/`](#-relatorios--relatórios-de-fase-e-reconciliação) | Relatórios de fase e reconciliação de migrations |

---

## 🗂 00-indices — índices e status

Ponto de entrada para quem não conhece o projeto ou quer uma visão geral rápida.

- [01-mapa-geral-do-projeto.md](./00-indices/01-mapa-geral-do-projeto.md) — Stack, fases, escolas, links rápidos
- [02-linha-do-tempo.md](./00-indices/02-linha-do-tempo.md) — Cronologia de fases QA1 → H1 → PR1
- [03-status-atual.md](./00-indices/03-status-atual.md) — Estado do sistema hoje (banco, funções, CI)
- [04-o-que-ler-primeiro.md](./00-indices/04-o-que-ler-primeiro.md) — Guia de leitura por perfil
- [06-mapa-de-dependencias.md](./00-indices/06-mapa-de-dependencias.md) — Dependências entre fases
- [07-pendencias-para-piloto-real.md](./00-indices/07-pendencias-para-piloto-real.md) — O que falta para PR1

---

## 🏛 fundacao — handoff e arquitetura

- [00-prompt-de-build.md](./fundacao/00-prompt-de-build.md)
- [01-visao-geral.md](./fundacao/01-visao-geral.md)
- [02-premissas-decisoes.md](./fundacao/02-premissas-decisoes.md)
- [04-arquitetura-sistema.md](./fundacao/04-arquitetura-sistema.md)
- [05-estrutura-de-pastas.md](./fundacao/05-estrutura-de-pastas.md)
- [06-arquitetura-fechada.md](./fundacao/06-arquitetura-fechada.md)
- [07-decisoes-do-build.md](./fundacao/07-decisoes-do-build.md)

## 🧱 fases — histórico de build

- [08-fase-14-5-encerramento.md](./fases/08-fase-14-5-encerramento.md)
- [09-fase-15-1-fundacao-pedagogica.md](./fases/09-fase-15-1-fundacao-pedagogica.md)
- [10-fase-15-2-provas-materias-assuntos.md](./fases/10-fase-15-2-provas-materias-assuntos.md)
- [11-fase-15-3-niveis-onboarding.md](./fases/11-fase-15-3-niveis-onboarding.md)
- [12-fase-15-4-trilhas-missoes.md](./fases/12-fase-15-4-trilhas-missoes.md)
- [13-fase-15-5-xp-patentes-conquistas.md](./fases/13-fase-15-5-xp-patentes-conquistas.md)
- [14-fase-15-6-simulados-por-concurso.md](./fases/14-fase-15-6-simulados-por-concurso.md)
- [15-fase-15-7-recorrencia-tagueamento.md](./fases/15-fase-15-7-recorrencia-tagueamento.md)
- [09-fase-16-camada-visual.md](./fases/09-fase-16-camada-visual.md)
- [16-fase-17-operacao-go-live.md](./fases/16-fase-17-operacao-go-live.md)

## 🔍 auditoria

Auditoria multivisão (12 perspectivas) + auditorias de fase. Índice próprio em
[`auditoria/README.md`](./auditoria/README.md). Destaques recentes:

- [14-fase-c0-5-auditoria-fase15.md](./auditoria/14-fase-c0-5-auditoria-fase15.md) — Fase C0.5 (motor C0, ligação por exam_tag).
- [15-bloco-b-rebuild-base-demo.md](./auditoria/15-bloco-b-rebuild-base-demo.md) — Bloco B (rebuild da base demo/vitrine).
- [d1a/relatorio-d1a-coordenacao-backoffice.md](./auditoria/d1a/relatorio-d1a-coordenacao-backoffice.md) — D1A: acesso coordenação.
- [d1b/relatorio-d1b-provisionamento-login.md](./auditoria/d1b/relatorio-d1b-provisionamento-login.md) — D1B: provisionamento de alunos.
- [d1c/relatorio-d1c-email-recuperacao-acesso.md](./auditoria/d1c/relatorio-d1c-email-recuperacao-acesso.md) — D1C: e-mail e recuperação de acesso.
- [hf1/relatorio-hf1-revogar-responsavel.md](./auditoria/hf1/relatorio-hf1-revogar-responsavel.md) — HF1: deploy `revogar-responsavel` + correção de bugs.
- [h1/relatorio-h1-higiene-repo-docs-operacao.md](./auditoria/h1/relatorio-h1-higiene-repo-docs-operacao.md) — H1: higiene de repositório e documentação.
- [i1/00-plano-implantacao-escola-nova.md](./auditoria/i1/00-plano-implantacao-escola-nova.md) — I1: plano de implantação de escola nova.

## ⚙️ operacao — infra, LGPD e go-live

- [operacao.md](./operacao/operacao.md)
- [ambientes-e-variaveis.md](./operacao/ambientes-e-variaveis.md)
- [e2e-ambiente.md](./operacao/e2e-ambiente.md)
- [deploy-checklist.md](./operacao/deploy-checklist.md)
- [go-live-checklist.md](./operacao/go-live-checklist.md)
- [checklist-go-live-piloto.md](./operacao/checklist-go-live-piloto.md)
- [rollback.md](./operacao/rollback.md)
- [monitoramento-backup.md](./operacao/monitoramento-backup.md)
- [backup-retencao-lgpd.md](./operacao/backup-retencao-lgpd.md)
- [lgpd-e-infra.md](./operacao/lgpd-e-infra.md)
- [massa-volume-coordenacao.md](./operacao/massa-volume-coordenacao.md)
- [github/repositorio-publico.md](./operacao/github/repositorio-publico.md) — Riscos e mitigações do repositório público
- [github/relatorio-branches-h1.md](./operacao/github/relatorio-branches-h1.md) — Relatório de branches (H1)
- [supabase/leaked-password-protection.md](./operacao/supabase/leaked-password-protection.md) — Proteção contra senhas vazadas

## 📊 relatorios — relatórios de fase e reconciliação

- [relatorio-fase-a.md](./relatorios/relatorio-fase-a.md)
- [relatorio-fase-b-min.md](./relatorios/relatorio-fase-b-min.md)
- [relatorio-fase-r-higienizacao-branches.md](./relatorios/relatorio-fase-r-higienizacao-branches.md)
- [RECONCILIACAO_MIGRATIONS_C0.md](./relatorios/RECONCILIACAO_MIGRATIONS_C0.md)
- [COMPARACAO_MIGRATIONS_REPO_REMOTO.md](./relatorios/COMPARACAO_MIGRATIONS_REPO_REMOTO.md)
