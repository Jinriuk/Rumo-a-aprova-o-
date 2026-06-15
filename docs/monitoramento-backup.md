# Monitoramento, logs e backups (Fase 17.6)

> Objetivo: não operar no escuro. Responder "o que aconteceu, quando,
> quem fez e em qual escola".

## O que monitorar

- **Advisors do Supabase** (Dashboard → Advisors, ou MCP `get_advisors`):
  rodar após cada migration. Hoje: **sem ERROR**; WARNs conhecidos =
  funções `SECURITY DEFINER` com porteiro (`resumo_escola`,
  `sou_super_admin`, `backoffice_*`) — intencionais — e
  `leaked_password_protection` (habilitar, ver `lgpd-e-infra.md`).
- **Erros do front** (console) — os testes E2E já falham em erro de
  console (`coletarErros`).
- **Falhas de Edge Functions / RPC** (Dashboard → Logs / `get_logs`).
- **Tentativas de acesso negado** e **uso por escola** (via `logs_acesso`).
- **Crescimento**: tamanho do banco, storage, registros/dia, alunos
  ativos — Dashboard do Supabase (Reports).

## Logs que já existem no sistema

- **`logs_acesso`** — trilha LGPD: quem leu dado de aluno, quando, qual
  ação. Coordenação lê os da própria escola (RLS).
- **`admin_logs`** — ações do operador no backoffice (criar escola,
  etc.). Visível no backoffice em **"Atividade administrativa"** (lê via
  RLS do super_admin). Toda nova ação sensível do backoffice deve gravar
  aqui (padrão: `registrarAcaoAdmin` / `insert ... admin_logs`).
- **`aluno_nivel_historico`** — auditoria de mudança de nível (gatilho).

## Backups (pendência de infra — sua)

- **Habilitar backup automático** do Supabase (depende do plano; free
  tier tem retenção curta → avaliar plano pago para produção real).
- **Export manual periódico** (dump) guardado fora do Supabase, no começo.
- **Antes de migration sensível** (que apaga/transforma dado): backup +
  `node scripts/checar-migrations.mjs` (ver `deploy-checklist.md`).
- **Retenção / exclusão do titular**: definir prazo de guarda; o
  endpoint `lgpd-titular` já exporta/exclui dados de um aluno.

## Critério de conclusão (17.6)
A parte de código está pronta (admin_logs + visualizador + logs_acesso).
Falta a configuração de infra (backups automáticos, alertas), que é
feita no painel do Supabase pelo operador.
