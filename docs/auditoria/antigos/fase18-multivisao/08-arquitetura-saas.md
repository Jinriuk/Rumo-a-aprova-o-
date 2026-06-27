# Auditoria — Persona 8: ARQUITETURA SaaS (B2B multi-tenant)

> Auditoria por arquiteto de software sênior. Base: estrutura geral (`app/`, `supabase/`,
> `docs/`, `tests/`, `scripts/`), o seam de dados, o modelo multi-tenant e a separação de
> camadas.

---

## 1. Nota de maturidade arquitetural: **80/100**

A arquitetura tem uma espinha dorsal correta e rara em produtos nesse estágio: **o isolamento
multi-tenant é regra de banco (RLS), não disciplina de tela**, e há um único seam de dados
entre front e backend. As camadas estão separadas (front por domínio, banco com migrations,
funções de privilégio elevado isoladas, conteúdo global vs. progresso por escola). Perde
pontos porque o front depende diretamente da forma do banco (PostgREST), a agregação vive no
cliente, não há camada de serviço/observabilidade, e o backoffice/operador é processo manual
(scripts), não um plano de controle.

## 2. O que está forte

- **Multi-tenant no lugar certo.** O tenant viaja no JWT (`app_metadata.escola_id`) e a RLS
  decide linha a linha. Isso é o padrão correto para SaaS B2B — não dá para "esquecer o
  `where escola_id`" e vazar, porque o banco nega por padrão. Há teste que prova.
- **Seam de dados único** (`shared/data/index.js`): toda a fala com o backend passa por um
  ponto. Boa fronteira; facilita evoluir para uma API/SDK no futuro.
- **Separação progresso × conteúdo.** Conteúdo (trilha/provas/missões/patentes) é global, do
  operador; progresso é da escola e isolado. Modelo de domínio limpo e escalável: uma trilha
  serve N escolas sem duplicar.
- **Privilégio elevado isolado.** A `service_role` só existe nas Edge Functions; o motor e a
  LGPD só rodam no servidor (cron/funções). O front só tem chave pública. Fronteira de
  segurança bem desenhada.
- **Modularidade por domínio no front** (`modules/conteudo`, `motor`, `desempenho`, `pessoas`,
  `consentimento`, `escola`), com `shared/ui` e `shared/regras`.
- **Domínio pedagógico isolado em módulos de lógica pura** (`conteudo/*.js`) testáveis sem UI.

## 3. O que está fraco

- **Front acoplado à forma do banco.** O seam usa PostgREST direto (`supabase.from(...)`),
  com joins embutidos (`alunos(*, alunos_turmas(...))`). Mudança de schema vaza para o front.
  Não há contrato/DTO estável entre as camadas.
- **Agregação no cliente.** A lógica de "resumo da escola" roda no browser sobre linhas cruas;
  arquiteturalmente, isso é regra de negócio na camada errada.
- **Sem camada de serviço/observabilidade.** Não há logging estruturado, métricas, tracing ou
  error tracking. Para operar N escolas, falta o "saber o que está acontecendo".
- **Operador/backoffice é manual.** Provisão de escola, seed de conteúdo e contas são scripts
  (`scripts/*.mjs`, SQL). Não há painel de operador nem fluxo de onboarding de escola
  自動izado — vira gargalo ao crescer.

## 4. O que está confuso

- **Onde mora a regra de negócio** varia: parte no banco (motor, níveis, gatilhos), parte em
  módulos JS puros (gamificação, simulado, recorrência), parte inline nos componentes. Falta
  uma diretriz clara de "regra crítica no banco, derivação na borda".
- **White-label** é leve (logo/cor/nome) — bom para o MVP, mas a fronteira do que é
  customizável por escola não está formalizada.

## 5. O que pode quebrar ao escalar (10 → 100 → 1.000 escolas)

- **Sem provisionamento self-service de escola**, cada nova escola é trabalho manual do
  operador — o crescimento vira trabalho linear humano.
- **Sem agregação no banco**, o custo de cada painel cresce com o tamanho da escola.
- **Sem observabilidade**, incidentes em uma escola são difíceis de diagnosticar sem acesso
  ao banco.
- **Conteúdo só do CN** limita a proposta a um nicho até a fábrica de conteúdo escalar.

## 6. Problemas críticos

- Nenhum crítico de correção. O ponto estrutural mais sério é a **ausência de plano de
  controle do operador** (provisionar/observar escolas), necessário antes de escalar B2B.

## 7. Problemas importantes

1. **Contrato estável entre front e dados** (DTO/serviço) em vez de PostgREST cru no seam.
2. **Mover agregação para o servidor** (RPC) — regra na camada certa.
3. **Observabilidade** (logs estruturados, métricas, error tracking).
4. **Plano de controle do operador** (onboarding de escola, gestão de conteúdo).

## 8. Melhorias desejáveis

- Formalizar a fronteira white-label.
- Versionar o contrato do seam (e os tipos).
- Extrair o domínio pedagógico para um pacote/serviço reutilizável.

## 9. O que está maduro

- Modelo multi-tenant (RLS + JWT) e a separação progresso/conteúdo.
- Seam de dados único e isolamento da `service_role`.
- Modularização por domínio e domínio pedagógico em lógica pura testável.

## 10. O que ainda parece protótipo

- Backoffice/operador (scripts manuais).
- Observabilidade (inexistente).
- Conteúdo (um concurso completo).
- Agregação/escala das telas de gestão.

## 11. Lista objetiva de recomendações

| # | Recomendação | Prioridade |
|---|--------------|------------|
| 1 | Plano de controle do operador (provisionar/observar escolas) | Alta |
| 2 | RPCs de agregação + contrato/DTO estável no seam | Alta |
| 3 | Observabilidade (logs estruturados, métricas, Sentry) | Alta |
| 4 | Pipeline/ferramenta de produção de conteúdo por concurso | Alta |
| 5 | Formalizar fronteira white-label e versionar contrato | Média |

## 12. Veredito final + nota de maturidade arquitetural

**Aprovado com ressalvas. Maturidade arquitetural: 80/100.** A fundação é sólida e correta
para SaaS B2B multi-tenant — o que normalmente é o mais difícil (isolamento, seam, separação
de privilégio) está bem feito e provado. O que falta é a camada de **operação em escala**:
plano de controle do operador, agregação no servidor, observabilidade e fábrica de conteúdo.
Sem isso, escala para dezenas de escolas com esforço manual; com isso, vira plataforma. Nota
potencial pós-correções: ~90.
