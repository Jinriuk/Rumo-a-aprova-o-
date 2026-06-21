# S1.1 — CI/E2E confiável (honesto)

## Problema
O `ci.yml` tinha um job `e2e` que, **sem os secrets de ambiente
isolado**, rodava a suíte Playwright contra o **banco de demo
compartilhado** (com um `::warning::`). Dois efeitos ruins:

1. **Poluição**: o teste de marca escreve o nome da escola no demo.
2. **Falso verde**: a E2E contra o demo, com `concurrency` e timeout,
   podia ser cancelada/enfileirada e o resultado não refletir a verdade
   ("verde" que não testou nada de fato).

## Decisão (Opção adotada)
**Gate único determinístico + E2E opcional e isolado.**

- `build-e-unitarios` é o **único gate autoritativo** do PR: build de
  produção + `reset-db.sh` (migrations + seeds 2×, idempotência) +
  `node --test` (lógica pura + motor + RLS + **suspensão**). Não depende
  de rede externa nem de secret.
- Novo job `e2e-guard` traduz a presença de `E2E_SUPABASE_URL` num
  output booleano. O job `e2e` só roda
  `if: needs.e2e-guard.outputs.isolado == 'true'`.
  - **Sem ambiente isolado** → E2E **pulada explicitamente** ("skipped"
    no GitHub + `::warning::`). Nunca toca o demo, nunca finge passar.
  - **Com ambiente isolado** → E2E roda contra o projeto de teste.
- **Guarda anti-"verde vazio"**: um passo confere que a suíte rodou
  ≥ 200 testes; se algo for pulado silenciosamente (ex.: seed abortou),
  o CI **falha** em vez de passar vazio.

## Por que é honesto agora
- Verde do gate = build + 222 testes realmente rodaram.
- E2E nunca aparece como "passou" sem ter ambiente para rodar: aparece
  como **skipped** (estado distinto de success), com a razão no log.
- Nenhuma execução de teste escreve no banco de demo.

## Verificação
- Suíte completa local (Postgres 16 real): **222 pass / 0 fail**.
- Build de produção: verde (`vite build`).

## Pendência
Ligar o E2E isolado é um passo de painel (criar projeto de teste +
secrets) — ver `02-ambiente-e2e-isolado.md` e
`docs/operacao/e2e-ambiente.md`.
