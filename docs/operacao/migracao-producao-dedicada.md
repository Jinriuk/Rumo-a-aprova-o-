# PROD1 — Migração para o projeto de produção dedicado

**Data da análise:** 2026-07-15 · **Status:** preparação concluída; aplicação
aguardando o projeto de produção ficar visível na org certa (ver §7).
**Decisão de arquitetura:** separação **Produção** (projeto novo, dedicado)
× **Teste e Vitrine** (o atual `bdjkgrzfzoamchdpobbl`, que permanece intacto).

---

## 1. Por que separar (e por que produção nasce LIMPA)

- **LGPD/região:** o projeto atual é `us-east-1` (EUA). O posicionamento do
  produto ("dado de menor fica no Brasil", Doc 4 §8) exige `sa-east-1`. Limpar
  dados não muda região; projeto novo resolve.
- **O demo precisa continuar vivo:** a venda depende da vitrine (Matriz
  Educação RM, 60 alunos fictícios). Separar preserva o ambiente de
  demonstração em vez de destruí-lo na virada.
- **Prod que nasce limpo não tem o risco do "limpar":** deletar demo à mão no
  mesmo banco do dado real é a receita clássica de acidente. No projeto novo
  não há o que limpar.
- **Fecha pendências do EST0:** P1-2 (região) e P2-2 (separação demo × real;
  a SDB-AUDIT já apontava "credenciais demo em produção").

## 2. Análise do banco atual (medida em 15/07 — decide o que migra)

### Dado de tenant (por escola) — **NADA disso vai para produção**

| Escola | Papel | Alunos | Registros | Simulados | Eventos | Último uso |
|---|---|---|---|---|---|---|
| Matriz Educação RM (`vitrine`) | demo/vitrine | 60 | 429 | 52 | 953 | 24/06 |
| Curso Beta Preparatório | demo/semente | 3 | 27 | 2 | 49 | 11/06 |
| Escola Piloto I1 | ambiente de teste | 5 | 0 | 0 | 0 | — |
| **Colégio e Curso Ícone** | **piloto real (candidata)** | **0** | **0** | **0** | **0** | — |

**Achado decisivo:** o Ícone tem **zero alunos e zero atividade** — só 1 conta
de coordenação. **Não existe nenhum dado real de aluno** no banco atual; tudo é
demo/teste. Portanto a produção nasce 100% limpa **sem perda de nada**: o Ícone
é recriado no prod pelo backoffice em ~5 minutos (escola + coordenador) quando
o piloto começar — com credencial nova, o que é até desejável.

Auth: 77 contas (todas demo/sintéticas + 1 super_admin + coordenações de
teste) — **não migram**; prod cria as suas. Storage: bucket público
`Logos-escolas` (2 logos de demo) — recriar o bucket vazio no prod.

### Conteúdo global (produto) — **isso VAI para produção**

6 concursos (todos com selo de maturidade carimbado) · 1 trilha CN (9 semanas,
50 atividades, 8 disciplinas) · 9 matérias · 5 provas / 7 dias / 31
prova-matérias · 11 assuntos / 22 subassuntos · 8 missões · 12 planos de
trilha · catálogo de gamificação (8 patentes, 13 conquistas) · 18 configs
oficiais · 3 turmas comerciais · recorrência/tagueamento de amostra (3+3+1,
com status honesto) · espelho de maturidade.

## 3. Classificação dos 18 seeds (o mapa da aplicação)

| Vai para produção (conteúdo global) | Fica só no demo (dev/vitrine) |
|---|---|
| `02_trilha_cn` (gerado) | `01_escolas_dev` (escolas de vitrine/contraste) |
| `05_concursos` | `03_dados_dev` (registros do Lucas) |
| `06_pedagogia` §1–3 | `04_usuarios_auth_dev` (contas demo no Auth) |
| `07_provas` | `08_niveis_dev` |
| `09_trilhas_missoes` §1–3, §5 | `11_simulado_concurso_dev` |
| `10_gamificacao` (catálogo) | `13_vitrine_militar_demo` (60 alunos) |
| `12_recorrencia` | `14_c1a` · `15_c1c` · `16_c1d` · `17_qa1` (patches de demo) |
| `18_maturidade_concursos` (gerado) | |

## 4. Melhorias feitas nesta preparação (PROD1-B)

1. **Blocos demo dentro de seeds globais blindados por `EXISTS`**
   (`06_pedagogia`, `09_trilhas_missoes`, `10_gamificacao`): os overrides da
   escola Vitrine e o ledger demo do Lucas agora só inserem **se a escola de
   vitrine existir**. Em produção viram no-op em vez de estourar FK — o mesmo
   arquivo serve a qualquer ambiente, sem bifurcar conteúdo. (Os `update
   alunos` de demo já eram no-op em base limpa.) Suíte local: **518/518** —
   comportamento em dev inalterado.
2. **`REDIRECT_URL` da `backoffice-coordenador` via ambiente**
   (`PASSWORD_RESET_REDIRECT_URL`): produção terá domínio próprio; o default
   preserva o demo. (As origens de CORS já eram env: `ALLOWED_ORIGINS`.)
3. Auditoria de env das functions: além dos itens acima, as functions só usam
   `SUPABASE_URL`/`SERVICE_ROLE_KEY` (injetados pelo Supabase). A
   `virar-semana` usa a própria service key como gate (timing-safe) — nenhum
   secret extra a provisionar.

## 5. Passo a passo da aplicação no projeto de produção (executável via MCP)

> Executo assim que o projeto estiver visível (ver §7). Nada disso toca o demo.

1. **Migrations `0001` → `0044`** na ordem, via `apply_migration` (ledger fica
   com paridade 44==44; a série é provada idempotente pelo reset local 2×).
   A `0004` agenda o pg_cron da virada automaticamente.
2. **Seeds de conteúdo global**, na ordem: 02 → 05 → 06 → 07 → 09 → 10 → 12 →
   18 (com as guardas do §4, rodam limpos numa base sem demo).
3. **Storage:** criar bucket público `Logos-escolas` (vazio).
4. **Edge Functions:** deploy das 6 (`provisionar-aluno`, `gerar-meta`,
   `virar-semana` com `verify_jwt=false`, `lgpd-titular`,
   `backoffice-coordenador`, `revogar-responsavel` — as demais com
   `verify_jwt=true`).
5. **Verificação:** paridade de migrations, contagens de conteúdo iguais ao
   §2, advisors (segurança/performance), smoke da credencial opaca e da
   `virada_saude`, `cron.job` agendado.

## 6. O que fica com o dono (checklist, ~30 min)

| # | Ação | Onde |
|---|------|------|
| 1 | **Projeto de produção na org certa**: precisa estar na org "Central de projetos - Rumo ao Milhão com SaaS" (a org Pro — e a única que o acesso MCP enxerga). Região **`sa-east-1`** | Dashboard → New project |
| 2 | **Renomear** (meu acesso não renomeia projeto): atual → "Rumo à Aprovação — Teste e Vitrine"; novo → "Rumo à Aprovação — PRODUÇÃO" | Project Settings → General |
| 3 | **Secrets das Edge Functions** no prod: `ALLOWED_ORIGINS` (domínio real, CSV) e `PASSWORD_RESET_REDIRECT_URL` (`https://<domínio>/redefinir-senha`) | Edge Functions → Secrets |
| 4 | **Os 4 toggles de Auth** (leaked password, política de senha, rate limits, TOTP) — repetir o que já está no demo | Authentication |
| 5 | **SMTP com o domínio real** (P0-1 do piloto) | Auth → SMTP |
| 6 | **Backup**: confirmar backups diários ativos (Pro) e agendar um teste de restore | Database → Backups |
| 7 | **Super admin**: `SUPABASE_URL=<prod> SUPABASE_SERVICE_ROLE_KEY=<prod> node scripts/criar-super-admin.mjs` (a service key do prod nunca entra no repo) | máquina do operador |
| 8 | **Vercel**: novo deployment/projeto apontando `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` para o prod (o deployment atual continua sendo o demo). Definir `VITE_ERROR_REPORT_URL` quando houver coletor | Vercel → Env |
| 9 | **Excluir `ops1-r1-restore-test-descartavel`** (meu acesso não deleta projeto; deixei **pausado**) | Project Settings → General → Delete project |
| 10 | Quando o piloto começar: criar o Ícone + coordenação **pelo backoffice** (nada de SQL manual) | backoffice |

## 7. Pendência que bloqueia a aplicação (§5)

Na análise de 15/07, **nenhum projeto novo apareceu na org "Central de
projetos"** (a única visível ao MCP, e a que tem o Pro). Se o projeto de
produção foi criado em outra organização (ex.: "Jinriuk's projects"), ele está
**fora do plano Pro e fora do meu alcance** — recriar na org Central (ou
transferir) resolve os dois problemas de uma vez.

## 8. Segurança da operação

- O demo (`bdjkgrzfzoamchdpobbl`) **não é tocado** em nenhum passo — zero
  risco de regressão na vitrine.
- Produção nasce vazia; qualquer erro na aplicação é corrigível recriando o
  projeto (nada real a perder até o primeiro aluno).
- Atenção de produto (já registrada no EST0): a trilha CN v1 expira em
  **01/08/2026** — o prod nascerá com ela; a v2 (CPACN/2027) é conteúdo do
  dono e entra pela fábrica quando existir.
