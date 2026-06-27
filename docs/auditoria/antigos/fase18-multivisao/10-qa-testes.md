# Auditoria — Persona 10: QA / TESTES

> Auditoria por especialista em QA/automação (Playwright, unitários, integração, RLS, CI).
> Base: `tests/*.mjs` (17 arquivos), `tests/identidades.mjs`, `tests/reset-db.sh`,
> `app/e2e/*.spec.js` (5 specs), `app/playwright.config.js`, `.github/workflows/ci.yml`.

---

## 1. Nota geral de maturidade da área: **80/100**

A cobertura de testes é forte e, em alguns pontos, exemplar: ~145 testes unitários (lógica
pura + banco real), um teste de isolamento que assume a identidade real do Supabase e prova
ausência de vazamento entre escolas, e CI que sobe Postgres real, exercita idempotência (seed
2x) e roda E2E com artefatos em falha. Perde pontos pelo banco de demo compartilhado no E2E,
seletores E2E frágeis (labels sem `htmlFor`) e ausência de teste de carga/performance.

## 2. O que está forte

- **Prova de isolamento robusta** (`isolamento.test.mjs`, ~11 testes / 21 asserts). Usa
  `como(identidade, fn)` (`identidades.mjs`) que abre transação, faz `set local role
  authenticated` e injeta `request.jwt.claims` (sub, role, app_metadata.escola_id, papel) —
  **exatamente o que o PostgREST/Supabase entrega à RLS**. Prova leitura zero, escrita negada
  e forja de tenant bloqueada em ~13 tabelas isoladas; valida também conteúdo global legível e
  `anon` sem acesso. Rollback automático não suja o banco.
- **Cobertura ampla por feature, em dois níveis.** Cada domínio tem `*.test.mjs` (lógica pura)
  + `*-db.test.mjs` (banco + RLS): motor, regras, níveis, gamificação, missões, simulado,
  recorrência, provas, pedagogia. Os `-db` rodam contra **Postgres 15 real** no CI.
- **Testes de RLS além do isolamento.** `niveis-db` (aluno não altera o próprio nível),
  `gamificacao-db` (aluno não se autopontua), `missoes-db` (ajuste isolado por escola),
  `simulado-db` (isolamento + FK exam_tag).
- **Regras sagradas testadas.** `regras.test.mjs` confere `semanaAtual`, `notaProjetadaDia1 =
  (mat+ing)×2,5` e os 365 dias do ano; `motor.test.mjs` cobre a virada e a LGPD.
- **CI sério.** Job 1: build + 145 unitários contra Postgres real, com `reset-db.sh` rodando
  migrations+seed 2x (idempotência exercitada). Job 2: E2E Playwright com timezone
  America/São_Paulo, screenshots `only-on-failure`, `trace on-first-retry`, e upload do
  relatório como artefato (retenção 14 dias).
- **reset-db.sh** robusto: `set -euo pipefail`, `ON_ERROR_STOP=1`, cria roles se faltam, pula
  `pg_cron`, roda seed duas vezes.

## 3. O que está fraco

- **Banco de demo compartilhado no E2E.** Os specs rodam contra um Supabase de demo
  compartilhado; o teste de Marca escreve e restaura. O CI serializa com
  `concurrency: e2e-demo-db` + `cancel-in-progress: false`, mas é um workaround — não um
  ambiente E2E efêmero por execução.
- **Seletores E2E frágeis.** Labels sem `htmlFor` forçam seletor de irmão (`label + input`);
  `page.locator("select").first()` sem distinguir qual select. Isso quebra fácil ao mexer na UI.
- **Sem teste de carga/performance.** Nada exercita 300/10.000/100.000 alunos; os riscos de
  escala (listas sem paginação, agregação no cliente, índices sem tenant) não têm teste que os
  pegue.
- **E2E não cobre os fluxos pedagógicos novos** (níveis/missões/gamificação/simulado na UI) —
  porque ainda não há UI ligada a eles; cobertos só por testes de banco/lógica.

## 4. O que está confuso

- **Contagem de E2E:** o CI rotula "42 testes" (specs × projetos desktop+mobile); são ~21
  specs executados em dois projetos. Vale alinhar a nomenclatura para não confundir.
- **Qual ambiente é o E2E** (demo vs. efêmero) não está formalizado num doc de QA.

## 5. O que pode quebrar (flaky / confiança)

- **Colisão no demo DB** se a serialização falhar ou rodar fora do CI.
- **Seletores frágeis** quebram com mudança de UI, gerando falso-vermelho.
- **Retry só no CI (1x)**; local sem retry pode dar falso negativo.

## 6. Problemas críticos

- Nenhum crítico. A base de testes dá confiança real para merge das regras e do isolamento.

## 7. Problemas importantes

1. **Ambiente E2E efêmero/isolado por execução** (em vez de demo compartilhado).
2. **Robustez de seletores** (adicionar `htmlFor`/`data-testid`).
3. **Testes de carga/performance** para os riscos de escala.

## 8. Melhorias desejáveis

- `data-testid` nos pontos de interação E2E.
- Seed E2E parametrizado por run id; reset antes da suíte.
- Teste de performance com volume sintético (k alunos) + asserts de tempo.
- Cobrir na UI os fluxos pedagógicos quando forem ligados.

## 9. O que não precisa mexer

- Estratégia de isolamento (`identidades.mjs` + `isolamento.test.mjs`) — manter como gate.
- Dois níveis de teste por feature (lógica pura + banco).
- `reset-db.sh` e a idempotência via seed 2x.
- Artefatos de falha no CI.

## 10. O que falta para release seguro / eliminar flaky

1. Ambiente E2E isolado por execução (mata a fonte principal de flaky).
2. Seletores estáveis (`data-testid`/`htmlFor`).
3. Teste de carga cobrindo escala.
4. Gate de release documentado: unitários + isolamento + E2E verdes obrigatórios.

## 11. Plano de melhoria de testes

| # | Ação | Prioridade |
|---|------|------------|
| 1 | Provisionar projeto Supabase efêmero por execução de E2E | Alta |
| 2 | Adicionar `data-testid`/`htmlFor` e refatorar seletores | Alta |
| 3 | Suíte de performance com volume sintético | Média |
| 4 | Cobrir fluxos pedagógicos na UI quando ligados | Média |
| 5 | Padronizar nomenclatura (specs × projetos) e doc de QA | Baixa |

## 12. Veredito final

**Aprovado com ressalvas.** A qualidade de testes é uma das forças do projeto: o isolamento
multi-tenant e as regras críticas estão provados contra banco real, e o CI dá confiança para
merge dessas camadas. As ressalvas — ambiente E2E compartilhado, seletores frágeis e ausência
de teste de carga — precisam ser resolvidas para confiar em releases de produção sob escala.
Resolvidas, a área chega à faixa de 90.
