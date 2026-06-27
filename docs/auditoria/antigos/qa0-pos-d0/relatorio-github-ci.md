# Relatório GitHub / CI — QA0 pós-D0

## Repositório

- Jinriuk/Rumo-a-aprova-o- — Público, JavaScript.
- Workflow único ci.yml (on: push) com 2 jobs: build-e-unitarios e e2e.
- 116 execuções; fluxo de desenvolvimento intenso assistido por Claude (muitos PRs merged).

## Estado real do CI (evidência do run #115, último na main)

- build-e-unitarios: verde (29s) — build + testes unitários passam.
- e2e: falha — excede o tempo máximo de 25m0s e é CANCELADO (25m 15s).
- Status geral do run: Cancelled. Os ícones neutros nos commits recentes da main são, na prática, runs cancelados por timeout do e2e — NÃO são verdes.
- Warning: E2E_SUPABASE_URL ausente — E2E roda contra o ambiente padrão (demo), sem isolamento.
- Warning: Node.js 20 depreciado nos runners (checkout@v4 / setup-node@v4).

## Achados

| ID | Achado | Área | Impacto | Prio | Sugestão | Esforço | Fase |
|----|--------|------|---------|------|----------|---------|------|
| CI-1 | Job e2e estoura 25min e é cancelado em todo push recente | CI | Alto. A main NÃO tem CI verde ponta a ponta; build verde nos títulos refere-se só aos unitários; sem sinal confiável de regressão e2e | P1 | Investigar lentidão (e2e esperando ambiente/seed), paralelizar/limitar suíte, ou aumentar timeout com causa-raiz resolvida | Médio | S1 |
| CI-2 | E2E roda contra o ambiente demo (faltam E2E_SUPABASE_URL/ANON_KEY) | CI | Médio. Testes podem sujar/depender da vitrine; resultado não isolado | P1 | Configurar secrets de ambiente e2e dedicado (a doc docs/operacao/e2e-ambiente.md já prevê) | Baixo | S1 |
| CI-3 | Repositório público | Segurança | Médio (ver SEC-4) | P2 | Tornar privado | Baixo | patch |
| CI-4 | Actions em Node.js 20 (depreciado) | CI | Baixo. Quebra futura | P3 | Atualizar para actions Node 24 | Baixo | patch |
| CI-5 | Run #109 (main) com falha vermelha (C1D) | CI | Baixo (histórico) | P3 | Conferir se foi resolvido nos merges seguintes | Baixo | — |

## Pontos fortes

- README excelente: arquitetura multi-tenant, regra do service_role, fórmulas fixas com testes (nota projetada Dia1 = (mat+ing)x2,5), virada de semana server-side agendada (pg_cron), ponto único de acesso ao Supabase (shared/data).
- Suíte de testes inclui prova de isolamento (Bloco 0) com papel authenticated + claims JWT reais — exatamente o que a RLS recebe. Forte.
- Unitários + build verdes e rápidos.
