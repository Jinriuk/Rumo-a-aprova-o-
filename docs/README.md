# Documentação — Rumo à Aprovação

**Atualizado em:** 2026-06-27 (pós-SEG2)

Documentação organizada por **área** e por **assunto**. Comece pelos índices em
[`00-indices/`](./00-indices/) se você não conhece o projeto.

## 📁 Estrutura

| Pasta | O que contém |
|---|---|
| [`00-indices/`](#-00-indices) | Mapa geral, linha do tempo, status atual, dependências, pendências, guia de leitura |
| [`fundacao/`](#-fundacao) | Visão geral do produto, premissas, decisões e arquitetura do sistema |
| [`fases/`](#-fases) | Histórico de **build** do produto, fase a fase (14.5 → 17) |
| [`auditoria/`](./auditoria/README.md) | Auditorias e fases de evolução, **por assunto** (segurança, banco, operacional, produto) + `antigos/` |
| [`operacao/`](#-operacao) | Documentação **viva** de operação: infra, ambientes, backup, rollback, go-live, LGPD, runbooks |

> **Regra de leitura:** `fundacao/` e `operacao/` são **referência viva**. `auditoria/`
> registra **o que foi feito em cada fase**. `auditoria/antigos/` é **histórico** e não
> reflete mais o estado atual — para o estado de hoje veja
> [`00-indices/03-status-atual.md`](./00-indices/03-status-atual.md).

---

## 🗂 00-indices

Ponto de entrada. Visão geral rápida e estado do projeto.

- [01-mapa-geral-do-projeto.md](./00-indices/01-mapa-geral-do-projeto.md) — stack, fases, escolas, links
- [02-linha-do-tempo.md](./00-indices/02-linha-do-tempo.md) — cronologia completa das fases
- [03-status-atual.md](./00-indices/03-status-atual.md) — estado do sistema hoje (banco, funções, CI, segurança)
- [04-o-que-ler-primeiro.md](./00-indices/04-o-que-ler-primeiro.md) — guia de leitura por perfil
- [05-camadas-faltantes.md](./00-indices/05-camadas-faltantes.md) — **registro vivo das lacunas (fonte única de verdade, REG0)** · [resumo executivo](./00-indices/05-camadas-faltantes-resumo-executivo.md)
- [06-mapa-de-dependencias.md](./00-indices/06-mapa-de-dependencias.md) — dependências entre fases
- [07-pendencias-para-piloto-real.md](./00-indices/07-pendencias-para-piloto-real.md) — o que falta para o piloto real

## 🏛 fundacao

Por que o produto existe e como está arquitetado (referência estável).

- [00-prompt-de-build.md](./fundacao/00-prompt-de-build.md) · [01-visao-geral.md](./fundacao/01-visao-geral.md) · [02-premissas-decisoes.md](./fundacao/02-premissas-decisoes.md)
- [04-arquitetura-sistema.md](./fundacao/04-arquitetura-sistema.md) · [05-estrutura-de-pastas.md](./fundacao/05-estrutura-de-pastas.md) · [06-arquitetura-fechada.md](./fundacao/06-arquitetura-fechada.md) · [07-decisoes-do-build.md](./fundacao/07-decisoes-do-build.md)

## 🧱 fases

Histórico de construção do produto (núcleo pedagógico e camada visual).

- [08-fase-14-5-encerramento.md](./fases/08-fase-14-5-encerramento.md)
- [09-fase-15-1-fundacao-pedagogica.md](./fases/09-fase-15-1-fundacao-pedagogica.md) → [15-fase-15-7-recorrencia-tagueamento.md](./fases/15-fase-15-7-recorrencia-tagueamento.md) (Fase 15.1 → 15.7)
- [09-fase-16-camada-visual.md](./fases/09-fase-16-camada-visual.md)
- [16-fase-17-operacao-go-live.md](./fases/16-fase-17-operacao-go-live.md)

## 🔍 auditoria

Auditorias e fases de evolução, **por assunto**. Índice próprio em
[`auditoria/README.md`](./auditoria/README.md).

- 🔒 [`seguranca/`](./auditoria/README.md#-seguranca--segurança-e-operação-técnica) — S1, SEG1, SEG2
- 🗄 [`banco/`](./auditoria/README.md#-banco--banco-de-dados-supabase--postgres) — DB1, DB2
- ⚙️ [`operacional/`](./auditoria/README.md#️-operacional--coordenação-provisionamento-acesso-implantação) — D1A/B/C, HF1/2/3, H1, I1, I2
- 🎯 [`produto/`](./auditoria/README.md#-produto--auditoria-funcional-pedagógica-e-ux) — AV2, PED-UX1
- 🗃 [`antigos/`](./auditoria/antigos/README.md) — histórico (audit-all, QA0, Fase 18 multivisão, QA1, C1, D0, Fase R, A, B-min)

## ⚙️ operacao

Runbooks e checklists vivos. Destaques:

- **Deploy / rollback:** [deploy-checklist.md](./operacao/deploy-checklist.md) · [rollback.md](./operacao/rollback.md) · [runbook-migrations-supabase.md](./operacao/runbook-migrations-supabase.md)
- **Go-live:** [go-live-checklist.md](./operacao/go-live-checklist.md) (sistema) · [checklist-go-live-piloto.md](./operacao/checklist-go-live-piloto.md) (por escola)
- **Infra / LGPD:** [ambientes-e-variaveis.md](./operacao/ambientes-e-variaveis.md) · [lgpd-e-infra.md](./operacao/lgpd-e-infra.md) · [plano-migracao-sa-east-1.md](./operacao/plano-migracao-sa-east-1.md)
- **Backup:** [backup-retencao-lgpd.md](./operacao/backup-retencao-lgpd.md) · [backup-e-plano-supabase.md](./operacao/backup-e-plano-supabase.md) · [monitoramento-backup.md](./operacao/monitoramento-backup.md)
- **Acesso / coordenação:** [auth-codigos-alunos.md](./operacao/auth-codigos-alunos.md) · [auth-credenciais-checklist.md](./operacao/auth-credenciais-checklist.md) · [backoffice-superoperador.md](./operacao/backoffice-superoperador.md)
- **GitHub / Supabase:** [github-seguranca.md](./operacao/github-seguranca.md) · [github/repositorio-publico.md](./operacao/github/repositorio-publico.md) · [supabase/leaked-password-protection.md](./operacao/supabase/leaked-password-protection.md)
