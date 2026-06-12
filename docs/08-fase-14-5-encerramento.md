# Fase 14.5 — Encerramento (12/06/2026)

Etapa de estabilização e QA antes da Fase 15. **Encerrada com CI verde.**

## Veredito final (CI run #5, commit `c8a90a5`)

| Job | Resultado | Tempo |
|---|---|---|
| `build-e-unitarios` | ✅ build de produção + migrations/seed 2x + regras + motor + **isolamento RLS** | 31s |
| `e2e` | ✅ suíte Playwright completa: 42 testes (39 executados + 3 skips corretos de viewport) em desktop 1366px e mobile ~390px | 88s |

Workflow: `.github/workflows/ci.yml` — roda em todo push e pull request.
Nenhum secret: o front usa só chaves públicas (anon key publicável; a
segurança é a RLS). A service_role não aparece em nenhum lugar do repo.

## O que a etapa entregou

- Auditoria de código (35 arquivos): sem bugs funcionais; imports limpos.
- Verificação de RLS no banco real: isolamento por escola (leitura e
  escrita), matriz de papéis (coordenação não escreve registro), escopo
  do aluno até o indivíduo.
- Suíte E2E (`app/e2e/`): autenticação dos 3 papéis, cronômetro completo,
  validações do registro, navegação, leitura do responsável, painel da
  coordenação, persistência da marca (com restauro), responsividade
  390px, e coletor de erros de console que reprova erro não-conhecido.
- CI com Postgres vanilla em service container (desenho do reset-db.sh:
  a migration 0001 cria as roles; a 0004 pula o pg_cron).
- Todas as falhas das iterações de CI eram de SELETOR DE TESTE, nunca
  do produto. Nenhuma linha de produto foi alterada nesta fase.

## Backlog técnico (pós-Fase 15 / polimento comercial — decisão do dono)

1. `htmlFor` nos labels (acessibilidade; também simplifica os seletores
   do E2E — hoje `e2e/_apoio.js#campo()` contorna via irmão no DOM).
2. Mover `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` de
   `app/.env.production` para variáveis do GitHub/Vercel (higiene de
   repositório; sem impacto de segurança real).
3. Code-splitting do recharts (bundle único de ~950 KB).
4. Remover `m.lastSim` (cálculo morto em `modules/desempenho/metricas.js`).
5. Atualizar actions para Node 24 quando o GitHub forçar (aviso de
   depreciação do Node 20 nos runners — 16/06/2026).

## Estado

O sistema está estável, testado e com trava de regressão no CI.
**Pronto para a Fase 15** (trilhas/missões/patentes/conquistas/banco de
questões definitivos — nada disso foi tocado nesta etapa).
