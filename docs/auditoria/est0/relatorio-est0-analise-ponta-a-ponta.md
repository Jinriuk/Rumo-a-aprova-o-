# EST0 — Análise ponta a ponta e plano de estabilização até a venda

**Data:** 2026-07-14 · **Base:** `main` = `9756773` (pós-PED2-R2)
**Natureza:** auditoria independente + planejamento (não altera produto, banco ou segurança)
**Método:** 7 auditores independentes por dimensão (segurança, banco, arquitetura,
front-end, pedagogia, negócio, qualidade) com **verificação adversarial** — achados
críticos julgados por 3 céticos independentes, altos por 1 — mais inspeção direta do
ambiente real (Supabase via MCP, medido em 14/07). Ao todo: 24 agentes, ~1,9M tokens,
668 leituras de arquivo, suíte de testes **executada de verdade** neste ambiente.
Detalhe integral dos 74 achados em
[`anexo-achados-por-dimensao.md`](./anexo-achados-por-dimensao.md).

---

## 1. Sumário executivo

**O sistema de engenharia está pronto; o produto vendável ainda não.** A fundação
técnica é genuinamente forte — RLS provada em 46/46 tabelas, isolamento multi-tenant
sem nenhum caminho de vazamento encontrado, 475/475 testes verdes reproduzidos nesta
auditoria em Postgres real, build limpo de 124 kB gzip, paridade repo↔remoto 37==37
migrations confirmada por MCP em 14/07. Nenhum P0/P1 de segurança foi encontrado.

O que separa o estado atual da primeira venda **não é qualidade de código**, e sim
quatro coisas, em ordem de urgência:

1. **⏰ O único produto pedagógico completo expira em 2,5 semanas.** A trilha do
   Colégio Naval é um calendário fixo de 30/05 a **01/08/2026** (`trilha-cn-v1.json`).
   Depois dessa data, nenhum concurso tem trilha utilizável. É o item mais urgente do
   projeto inteiro e só o dono pode resolver (a metodologia é autoral — decisão 16).
2. **Conteúdo: 1 de 6 concursos vendáveis.** EsPCEx está em `beta` (3/7 matérias com
   assunto, 0 semanas de trilha); EEAr/ESA/EPCAR são esqueleto; CM é indisponível.
   O posicionamento "preparatórios militares" tem lastro real só para o CN.
3. **Zero instrumento jurídico.** Não existe contrato B2B, DPA/cláusula de operador,
   termos de uso, política de privacidade nem texto do termo de consentimento — nada
   assinável com uma escola, para um produto que trata dado de menor.
4. **Infra de produção inexistente como ambiente separado.** Projeto Supabase único
   (demo = "produção"), plano Free, `us-east-1` (contra a promessa LGPD do próprio
   produto), sem backup automático testado*, sem observabilidade com destino, sem
   nenhum alerta (a virada de semana falha em silêncio).

*\*Sinal positivo medido em 14/07: existe um projeto `ops1-r1-restore-test-descartavel`
na organização Supabase (criado 03/07) — o teste de restore aparenta ter sido iniciado
após o fechamento da REG1. Formalizar o resultado em `docs/operacao/`.*

Além disso, a auditoria confirmou **2 bugs de integridade que corroem o argumento
central de venda** (gamificação confiável): o ledger de XP é inflável pelo aluno via
ciclo inserir/apagar simulado, e a virada de semana global aborta para TODAS as
escolas se um único aluno tiver dado inconsistente — em silêncio.

**Fase de negócio atual: pré-piloto** (demo controlada liberada; receita zero; preço
hipotético; validação de mercado não iniciada). Com o plano da seção 6, a primeira
venda é realista em **2,5–4 meses**, sendo o caminho crítico o material-fonte de
conteúdo (dono) e o piloto real com o Colégio Ícone.

---

## 2. Nota por dimensão

| Dimensão | Avaliação | Síntese de uma linha |
|---|---|---|
| Segurança | **Forte** | RLS 46/46 deny-by-default, JWT via `app_metadata`, service_role confinada, timing-safe, LGPD atômica; nenhum vazamento cross-tenant encontrado. Restam: credencial opaca, rate limit, MFA, paginação do backoffice. |
| Banco de dados | **Forte, com 2 furos de integridade** | Schema maduro, ledger idempotente, paridade 37==37. Furos confirmados: XP inflável (delete sem estorno) e virada global sem isolamento de falha. |
| Arquitetura | **Forte** | Arquitetura real fiel à declarada; seam único confirmado por grep; regras críticas no servidor; grafo de módulos acíclico. Falta: destino de observabilidade, ambientes separados, roteamento por URL. |
| Front-end / UX | **Bom** | Design system consistente, code-splitting real, a11y básica genuína, estados de UI presentes. Falta: rota/URL, white-label pré-login, duplo envio no simulado, CSV sem escape de fórmula. |
| Pedagogia / conteúdo | **Motor pronto; produto incompleto** | Fábrica com validador honesto e motor idempotente. Mas: 1/6 concursos utilizável, trilha CN expira 01/08, recorrência "medida" tem 3 linhas de amostra, incoerências motor↔UI. |
| Negócio | **Embrionário** | B2B white-label bem fundamentado nos docs; mas receita zero, sem jurídico, preço não validado, sem superfície comercial, bus factor = 1. |
| Qualidade / CI | **Forte no banco, cego nas bordas** | 475/475 verdes (reproduzido), CI real com guarda anti-verde-vazio. Mas: E2E nunca roda (52 specs pulados), Edge Functions sem teste de runtime, zero lint/typecheck, zero monitoramento. |
| Ambiente real | **Saudável, mas é a demo** | Medido 14/07: `bdjkgrzfzoamchdpobbl` ACTIVE_HEALTHY, us-east-1, Free, PG 17.6; 37==37 migrations; 6/6 functions ACTIVE; advisors: 10 WARN de SECURITY DEFINER exposto (mitigados por porteiro interno), ~28 FKs sem índice, 1 regressão de policy duplicada (`aluno_missoes`). Deploy Vercel não verificável desta sessão (outra conta). |

---

## 3. O que foi verificado no ambiente real (14/07/2026)

- **Projeto:** `bdjkgrzfzoamchdpobbl` ("Rumo a Aprovação"), `us-east-1`, plano Free,
  Postgres 17.6.1.127, status ACTIVE_HEALTHY.
- **Migrations:** ledger remoto com **37** entradas, última `0037_fix2_deprecar_escrita_conquistas`
  (aplicada 02/07) — **paridade total com o repo, drift 0**.
- **Edge Functions:** **6/6 ACTIVE** (provisionar-aluno v3, backoffice-coordenador v5,
  revogar-responsavel v2, gerar-meta v2, virar-semana v2 com `verify_jwt=false` + gate
  por token, lgpd-titular v2) — bate com o `03-status-atual.md`.
- **Advisors de segurança:** 10 WARN, todos `authenticated_security_definer_function_executable`
  (funções `backoffice_*`, `resumo_escola`, `salvar_onboarding_aluno`, `sou_super_admin`).
  Não são vulnerabilidade direta — todas têm porteiro interno (`eh_super_admin`/tenant) —
  mas seguem no radar do advisor a cada revisão.
- **Advisors de performance:** ~28 FKs sem índice cobrindo (mais que os 13 do SDB-AUDIT —
  a lista cresceu com 0033/0034); 9 índices nunca usados; **1 WARN de policies permissivas
  duplicadas em `aluno_missoes`** (regressão do padrão que a 0029 tinha zerado); Auth com
  estratégia de conexões absoluta (10).
- **Organização Supabase:** existe `ops1-r1-restore-test-descartavel` (criado 03/07,
  us-east-1) — evidência de teste de restore iniciado e não documentado no repo.
- **Vercel:** o time acessível a esta sessão não contém o projeto do front — o deploy
  vive em outra conta; não foi possível verificar status/erros de runtime daqui.

---

## 4. Achados críticos e altos (17 de 74)

Todos os itens abaixo foram confirmados: os marcados (✓3) por 3 céticos independentes,
(✓1) por 1 cético, (✓m) manualmente pelo orquestrador com evidência reproduzida.
Detalhe completo (descrição, evidência, recomendação) no
[anexo](./anexo-achados-por-dimensao.md).

| # | Sev. | Achado | Evidência-chave | Esforço |
|---|---|---|---|---|
| C1 (✓3) | 🔴 | Só 1 dos 6 concursos tem produto pedagógico utilizável | seed 18 + banco remoto: EsPCEx 0 semanas, EEAr/ESA/EPCAR 0 assuntos | semanas + material do dono |
| C2 (✓3) | 🔴 | Nenhum instrumento jurídico assinável (contrato, DPA, termos, privacidade) | nenhum arquivo no repo/docs; termo de consentimento "v1" sem texto | dias (com advogado) |
| A1 (✓m) | 🟠 | Trilha CN (único produto completo) expira em **01/08/2026** | `trilha-cn-v1.json` semana 9: fim `2026-08-01` | dias + metodologia do dono |
| A2 (✓1) | 🟠 | Ledger de XP inflável: aluno insere/apaga simulado em loop, +50 XP por ciclo, sem estorno no DELETE | 0002:197-201 (RLS delete), 0024:199-221 (trigger só insert), status `estornado` sem escritor | dias |
| A3 (✓1) | 🟠 | Virada de semana global = transação única sem isolamento por aluno; 1 dado ruim bloqueia metas de TODAS as escolas, em silêncio | 0003:34-37 e :84-112 (loop sem exception), `alunos.trilha_id` sem FK (0001:81) | dias |
| A4 (✓1) | 🟠 | Observabilidade sem destino: `VITE_ERROR_REPORT_URL` indefinida em todo lugar | `observabilidade.js:9`; ausente de `.env.production`/CI | horas |
| A5 (✓1) | 🟠 | pg_cron roda às cegas: nenhum alerta se a virada falhar | nenhum monitor de `cron.job_run_details` | horas |
| A6 (✓1) | 🟠 | Ambientes: projeto único demo=produção, Free, us-east-1 — contra a promessa LGPD do Doc 4 | `list_projects` 14/07; `lgpd-e-infra.md` | dias (operação) |
| A7 (✓1) | 🟠 | Registro de simulado aceita duplo envio e exclui sem confirmação (fora da garantia FE1) | `SimuladoConcurso.jsx` sem `useEnvioUnico` | horas |
| A8 (✓1) | 🟠 | `backoffice-coordenador` lê só a 1ª página de 1000 do Auth — re-vínculo de coordenador quebra com ~2 escolas reais (todo aluno/responsável é `auth.users`) | `backoffice-coordenador/index.ts:168-170` | horas |
| A9 (✓3) | 🟠 | Produto vendável hoje só para escolas de Colégio Naval | idem C1, lado comercial | — |
| A10 (✓1) | 🟠 | Infra atual incompatível com cliente pagante (mistura demo/real, sem backup automático) | idem A6 | dias |
| A11 (✓1) | 🟠 | Consentimento LGPD autodeclarado pela coordenação; "termo v1" não tem texto | `PainelConformidade.jsx` / tabela `consentimentos` | dias |
| A12 (✓1) | 🟠 | Bus factor = 1: desenvolvimento e operação dependem de uma única pessoa | histórico de commits; runbooks sem 2º operador | semanas (processo) |
| A13 (✓m) | 🟠 | Edge Functions (camada de provisionamento e LGPD) sem nenhum teste de runtime | nenhum `Deno.test` no repo | dias |
| A14 (✓m) | 🟠 | E2E nunca roda: 52 specs Playwright pulados no CI por falta de secrets/staging | `ci.yml:101-146` (e2e-guard) | dias (após staging) |
| A15 (✓m) | 🟠 | Zero monitoramento/alertas de produção | idem A4/A5 | horas–dias |

**Nuance registrada pelos céticos:** A8 é defeito de disponibilidade operacional (não
vazamento — o GoTrue barra a duplicidade); A3 é *pior* que o alegado (o SELECT do loop
chama `semana_da_data` por linha, então até o fechamento de metas vencidas aborta).

Os 35 achados médios e 22 baixos (policies de colunas, coerências motor↔UI, CSV,
white-label pré-login, a11y residual, parser CSV, DeprecationWarning do `pg`, etc.)
estão classificados no anexo com recomendação e esforço um a um.

---

## 5. Plano de estabilização (EST1) — fechar antes do piloto real

Objetivo: **nenhum achado alto de código aberto** e **operação observável**. Estimativa
total da trilha de código: **1–2 semanas de dev**. Cada item deve entrar com teste que
o prove (padrão do repo).

### EST1-A · Integridade do motor (o valor central)

| # | Item | Fecha | Esforço |
|---|---|---|---|
| 1 | Trigger de **estorno** AFTER DELETE em `simulados` (e `registros_estudo`) marcando `status='estornado'` no evento do ledger via `referencia_id`; total de XP passa a somar só eventos válidos | A2 | dias |
| 2 | `virar_semana()`: envolver `gerar_meta` por aluno em `begin/exception` (pula aluno ruim, acumula erros no retorno); FK `alunos.trilha_id → trilhas(id)`; registrar resultado de cada execução em tabela de heartbeat | A3, metade de A5 | dias |
| 3 | Whitelist de colunas em `atualizarAluno` (seam) e policy de UPDATE de `meta_atividades` restrita a `feito` (aluno não troca a atividade-modelo) | BANCO-03/04 | horas |
| 4 | Duplo envio + confirmação de exclusão no fluxo de simulado (`useEnvioUnico`, padrão FE1); mesmas travas nas escritas do `AreaAdmin` | A7 | horas |
| 5 | Coerências pedagógicas: fonte única de estrutura de prova (ranking da turma e resumo do responsável hoje usam números divergentes); critério de missão exibido = critério aplicado; corrigir missões estruturalmente inalcançáveis | PED-03/04/05 | dias |

### EST1-B · Operação observável (pré-requisito de SLA)

| # | Item | Fecha | Esforço |
|---|---|---|---|
| 6 | Definir destino de erro (Sentry free tier ou endpoint próprio) e setar `VITE_ERROR_REPORT_URL` em produção + CI | A4 | horas |
| 7 | Alerta da virada: heartbeat do item 2 + verificação diária (Edge Function agendada ou alerta externo) que notifica se a última execução falhou/não rodou | A5 | horas |
| 8 | Alerta de uptime (Vercel/Supabase → e-mail/WhatsApp do operador) | A15 | horas |
| 9 | Corrigir `backoffice-coordenador`: busca por e-mail direto (ou via `usuarios.email`) em vez de `listUsers` de página única | A8 | horas |
| 10 | Higiene do advisor: consolidar policies duplicadas de `aluno_missoes`; criar índices para as FKs quentes da lista de 28 (priorizar `aluno_missoes`, `aluno_eventos_progresso`, `alunos`) | ambiente | horas |

### EST1-C · Hardening de credencial (SEC3b, antes de aluno real)

| # | Item | Esforço |
|---|---|---|
| 11 | Credencial opaca do aluno: implementar o `proxy login-codigo` já desenhado em `sec3/modelo-credencial-opaca.md` (senha ≠ código, código só como hash, rotação sem recriar conta) | semana |
| 12 | Rate limit no login por código (no proxy do item 11) + trilha de tentativas | incluso |
| 13 | MFA (TOTP) para super_admin — e oferecido à coordenação; exigir AAL2 nas Edge Functions de backoffice | dias |
| 14 | Política de senha server-side no projeto de produção + Leaked Password Protection (vem com o Pro) | horas |

**Critério de saída da EST1:** suíte ≥475 verde com testes novos cobrindo itens 1–5 e 9;
advisor sem WARN de policy duplicada; erro de produção chega a um destino monitorado;
falha da virada gera alerta em <24h; login de aluno passa por proxy com rate limit.

---

## 6. Fases até a venda — roadmap

Quatro trilhas paralelas. O **caminho crítico é a trilha de conteúdo** (D), porque
depende de material que só o dono pode fornecer (decisão 16: metodologia autoral).

```
Semana:        1    2    3    4    5    6    7    8    9   10   11   12
Código    EST1 ████████
Infra     OPS1      ████████
Credencial SEC3b        ████
Conteúdo  PED3 ██████████████████████  (gargalo: material do dono)
Jurídico  JUR1 ████████████
Piloto    PR1            ████████████████████████
Comercial GTM1                     ████████████████████████
Venda 1                                              ★ (M3)
```

### OPS1 — Infra de produção real (1–2 semanas, decisão + operação)

1. **Projeto Supabase de produção dedicado**: Pro, `sa-east-1`, migrations aplicadas do
   zero (paridade já provada pelo reset-db 2×). O projeto atual vira demo/vitrine
   oficialmente. Fecha A6/A10 e o P2-2.
2. **Backup automático + restore testado e documentado** — formalizar o que o projeto
   `ops1-r1` começou; registrar o runbook executado em `docs/operacao/`.
3. **SMTP + domínio do piloto** (P0-1) — pré-requisito de recuperação de senha real.
4. **Staging + secrets `E2E_SUPABASE_*`** → os 52 specs Playwright passam a rodar em
   todo PR (fecha A14). Aproveitar para rodar o plano de carga 300/500 do PERF1 e ter
   um número defensável de capacidade.
5. **Retenção de logs** (`logs_acesso` etc.) — política LGPD declarada e job de expurgo.

### PED3 — Conteúdo vendável (começa AGORA; gargalo do roadmap)

| Prio | Item | Dependência |
|---|---|---|
| ⏰ **P0** | **Decidir o ciclo CN v2 (CPACN 2027)** antes de 01/08 — sem isso o único produto morre no fim do mês. Aproveitar para tornar o calendário **por coorte/turma** (hoje é global e fixo — modelo não sobrevive a duas turmas em fases diferentes) | metodologia do dono |
| P1 | Trilha EsPCEx completa: Anexo C do edital (programa oficial) + metodologia semanal + provas anteriores com gabarito — a fábrica está pronta e testada; falta só a matéria-prima (gaps §1) | material do dono |
| P2 | Recorrência **medida** de verdade: adquirir provas oficiais CN (2021–2025) + gabaritos e taguear `questoes_prova` (hoje: 3 questões de amostra sustentam a promessa "prioridade pelo que mais cai") | provas oficiais |
| P3 | Decidir roadmap EEAr/ESA/EPCAR/CM (quais entram, quando) e comunicar via selo de maturidade — que já é honesto na UI | decisão comercial |
| P3 | Fluxo mínimo de redação (5 dos 6 concursos têm redação eliminatória/classificatória; hoje não existe superfície nenhuma) | design de produto |

### JUR1 — Pacote jurídico e societário (paralelo, ~2–3 semanas de calendário)

1. Contrato de licença B2B com **cláusula de operador de dados (DPA)** — a escola é
   controladora, o sistema é operador; anexar SLA simples e prazo de atendimento de
   titular (a `lgpd-titular` já suporta tecnicamente).
2. Termos de uso + política de privacidade publicados (URL pública — hoje a rota
   pública é só o login).
3. **Texto real do termo de consentimento** do responsável + fluxo de registro com
   evidência (hoje é autodeclaração da coordenação sem documento).
4. Faturamento do piloto: acordo escrito com a estrutura existente (Alinhatta) e plano
   de CNPJ próprio com a primeira receita.

### PR1 — Piloto real (Colégio Ícone) — 4–8 semanas de acompanhamento

Pré-requisitos: EST1 + OPS1 (1–4) + SEC3b + JUR1 (3). Executar os P0 do
`07-pendencias-para-piloto-real.md` (SMTP validado, escola real no projeto de
produção, turma+alunos provisionados, login e recuperação testados end-to-end,
checklist por escola). Durante o piloto:

- Medir uso real (o painel ADM2 já tem logs filtráveis) e coletar depoimentos.
- Validar preço em campo (as faixas R$ 5–15k setup + R$ 600–2.000/mês são hipótese
  declarada de 2026-06 — as conversas da parte comercial devem testá-las).
- Treinar a **segunda pessoa** nos runbooks (go-live, rollback, emergência) — reduz o
  bus factor antes de assinar contrato com SLA.

### GTM1 — Superfície comercial (paralelo ao piloto)

1. Landing page institucional com planos e demo agendável (hoje o front começa no login).
2. Roteiro de demo para a vendedora + ambiente demo controlado (sem credenciais
   compartilhadas versionadas — mover as credenciais demo para o projeto de vitrine).
3. Proposta comercial padrão + estudo de caso do piloto (a prova de eficácia é o que
   converte a 2ª–5ª escola).

### Marcos

| Marco | Condição | Estimativa |
|---|---|---|
| **M1 — Pronto para aluno real** | EST1 + OPS1(1–3) + SEC3b + JUR1(3) | ~4 semanas |
| **M2 — Piloto rodando** | PR1 P0 completos, Ícone ativo em produção dedicada | ~5–6 semanas |
| **M3 — Primeira venda** | CN v2 + EsPCEx completa + caso do piloto + contrato assinável + preço validado | **~2,5–4 meses** |
| **M4 — 5 escolas pagantes** | + ROLE1 (professor/tutor) se exigido, carga 300/500 executada, suporte formalizado, 2º operador | ~6–9 meses |

### O que NÃO fazer agora (inalterado desde REG0/REG1, reconfirmado)

TypeScript em massa · virtualização de listas · B2C/novas modalidades · remoção física
das tabelas deprecadas (DB3 pode esperar janela) · self-service completo (ARCH1) ·
reescritas de qualquer natureza. Nenhum desses move M1–M3.

---

## 7. Riscos principais do plano

| Risco | Mitigação |
|---|---|
| Material-fonte de conteúdo não chega (metodologia é autoral do dono) | É o caminho crítico: reservar agenda do dono para CN v2 **nesta quinzena**; EsPCEx logo após. A fábrica está pronta — o custo é só autoria. |
| Ciclo de vida do conteúdo: trilha como calendário fixo global | Ao produzir a v2, migrar para calendário por coorte — senão o problema volta em 2027. |
| Bus factor = 1 em dev **e** operação | 2ª pessoa nos runbooks antes do 1º contrato com SLA; documentação já é excepcional, o custo é treino. |
| Histórico de auto-reporte inflado (doc de 28/06 alegou correções inexistentes — pego pela REG1) | Manter o padrão REG1/EST0: nenhuma alegação de fase fechada sem evidência medida e comando de verificação ao lado. |
| Advisor voltou a acumular (28 FKs, policy duplicada) | Incluir `get_advisors` no gate de release formal (QA3 9.5). |

## 8. Limitações desta auditoria

- O deploy do Vercel não é visível desta sessão (outra conta) — status de runtime do
  front não foi verificado.
- 4 dos 21 vereditos adversariais foram concluídos manualmente pelo orquestrador (limite
  de sessão nos céticos): A1, A13, A14, A15 — todos com evidência reproduzida no repo.
- Playwright/E2E não foi executado (exigiria Supabase isolado — exatamente a lacuna A14).
- A análise de mercado/concorrência da dimensão negócio é qualitativa (conhecimento
  geral de edtech BR), não um estudo de mercado — que segue sendo o passo 1 declarado
  e não executado do plano de validação.
