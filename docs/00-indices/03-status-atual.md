# Status Atual do Projeto

**Data:** 2026-09-18 (fechamento do programa das 8 Ondas)
**Fase encerrada:** Ondas 0–8 + porta do ciclo seguinte
**Próxima fase:** G3 do Plano Mestre — ver `08-plano-execucao-set-dez-2026.md`

> **Como ler este documento.** Cada número abaixo está marcado com COMO
> foi obtido. `medido` = o comando ao lado foi executado nesta data, neste
> repositório, e o valor é o que ele imprimiu. `não verificado` = depende
> do Supabase remoto, que não é alcançável a partir do executor desta
> rodada — o valor anterior foi REMOVIDO em vez de repetido, porque
> número remoto copiado de julho foi exatamente o que tornou a versão
> anterior deste índice perigosa.

---

## Resumo executivo

O programa de correção das 8 Ondas está fechado no que é verificável
dentro do repositório. **Isso não é o mesmo que liberado para piloto.**

A versão anterior deste índice (02/07) dizia "liberado para piloto
controlado pequeno" e "nenhum P0/P1 de segurança aberto". As duas frases
foram retiradas, e não por excesso de zelo:

1. Ela mesma listava, algumas linhas abaixo, "credencial do aluno =
   código" como item ABERTO. Um documento não pode afirmar que não há P0/P1
   de segurança aberto e listar um na mesma página.
2. Os números (475 testes, 37 migrations, 6 Edge Functions) estavam
   vencidos por dois meses e meio de trabalho, então quem lesse o índice
   como estado atual decidiria sobre um sistema que não existe mais.
3. O Plano Mestre de setembro exige **G3** antes do primeiro aluno real.
   Concluir as Ondas não aprova G3 — G3 depende de ambiente, e-mail,
   backup/restore, RLS em ambiente equivalente, monitoramento, E2E em
   navegador e jurídico. Nada disso se prova daqui.

O que mudou de verdade: A9 e a regressão do S1 no reseed estavam abertos
e foram fechados; a vitrine parou de envelhecer sozinha; o ciclo seguinte
ganhou motor **e** porta na coordenação.

---

## Números verificados (2026-09-18)

| Métrica | Valor | Como foi obtido |
|---|---|---|
| Testes | **1160 / 1160 verdes** | medido em 25/09 (Etapa 3: jornadas E2E; trava de destino com o Edge Runtime direto) — `bash reset-db.sh && npm test` em Postgres 16 local dedicado (migrations + seed 2×), com `PGHOST=127.0.0.1` (a matriz de autorização recusa socket) |
| Arquivos de teste | **110** (116 `.mjs` em `tests/`; 6 são apoio, sem `node:test`: `identidades.mjs`, `calendario-cn.mjs`, os dois da matriz e os dois da guarda de embed ambíguo, `embeds-postgrest.mjs` e `embeds-fks-multiplas.mjs`) | medido em 25/09 (Etapa 3: guarda de efeito sem retorno implícito) — `grep -l 'node:test' tests/*.mjs \| wc -l` |
| Lint | **0 errors / 256 warnings** | medido — `cd app && npm run lint` |
| Build de produção | **verde** | medido — `cd app && npm run build` |
| Migrations no repo | **59** (últimas: `0055_coerencia_tenant`, `0056_tenant_operacional_nega_por_padrao`, `0057_revoga_execute_funcoes_internas` e `0058_escolas_colunas_por_papel`, aplicadas em 24/09 na demonstração entre 17:24 e 17:47 de Brasília e, com aprovação escrita do dono, em produção entre 19:02 e 19:52 de Brasília, com o SQL do ledger igual ao dos arquivos por md5; as 7 Edge Functions do #142 e do #145 foram publicadas nos dois ambientes (registro, reversão e arquivo das funções anteriores em `docs/operacao/aplicacao-e2-0055-0058.md`); antes delas, `0054_proximo_ciclo_semanas_seg_dom`; a `0053_consentimento_registrado_em` foi aplicada na demonstração em 23/09 às 22:02 e em produção em 24/09 às 06:02 de Brasília; a `0054` foi aplicada na demonstração em 24/09 às 06:10 de Brasília; em produção a 0051, a 0052 e a 0054 foram aplicadas em 24/09 entre 10:25 e 10:26 de Brasília, nessa ordem, com o corpo das funções igual ao da demonstração e nenhum dado alterado. Os dois ambientes estão na 0058) | medido — `ls supabase/migrations/*.sql \| wc -l` |
| Seeds no repo | **21** (o 04 e o 21 só rodam em Supabase real — escrevem em `auth`) | medido — `ls supabase/seed/*.sql \| wc -l` |
| Edge Functions no repo | **7** | medido — `ls -d supabase/functions/*/ \| grep -v _shared` |
| TypeScript em `app/src` | 0 arquivos (dívida conhecida; `supabase/functions` é TS) | medido — `find app/src -name '*.ts*' \| wc -l` |
| Migrations no ledger remoto | — | **não verificado** nesta rodada |
| Tabelas públicas remotas / RLS | — | **não verificado** nesta rodada |
| Edge Functions ACTIVE no remoto | — | **não verificado** nesta rodada |

> As duas `0047` (`0047_credencial_senha_temporaria` e
> `0047_revogar_execute_rls_auto_enable`) coexistem de propósito: a Onda
> 2.5 decidiu não renomear migration já aplicada só por estética. A regra
> de não multiplicar prefixo ambíguo vale para as novas.

## Estado do Supabase remoto

**Não verificado nesta rodada.** O executor desta rodada não alcança o
projeto Supabase, então a tabela de versões de Edge Function, a paridade
do ledger de migrations e a contagem de tabelas com RLS foram REMOVIDAS
em vez de recopiadas de julho.

O que se pode afirmar do repositório: as 7 funções em
`supabase/functions/` usam a allowlist de CORS compartilhada
(`_shared/cors.ts`) — a Onda 1 centralizou 3 e a Onda 1 complementar
(#103) descobriu que as outras 4 ainda tinham cópia inline e as trouxe
junto. Que o deploy remoto reflita isso é outra pergunta, e continua sem
resposta aqui.

A auditoria do banco em
`auditoria/sdb-audit/relatorio-final-sdb-audit.md` (29/06) é de junho. As
ressalvas P2 que ela levanta (storage sem restrição, FKs sem índice,
credenciais demo em produção) não foram reverificadas nesta rodada.

---

## O que mudou desde o último status (27/06 → 02/07)

| Rodada | Entrega principal |
|---|---|
| PED1 (#48/#50) | Motor de progresso **vivido** sobre o C0: missões fecham por gatilho, níveis persistidos, onboarding do aluno, feedback "+XP" (migration 0033) |
| PED2 rodada 1 (#49) | Maturidade por concurso (fonte única + selo + validador de build + view 0034) e **fábrica versionada** de trilhas — *não* é produção de conteúdo |
| ADM2 (#51) | SuperADM profissional (categoria, risco, go-live, logs filtráveis) |
| PERF1 (#52) | Export CSV, comparativo por turma/concurso, plano de carga 300/500/10k |
| SEC3 (#53) | Virada por escola (0035), atomicidade LGPD (0036), timing-safe |
| FE1 (#54) | Trava de duplo envio real, contratos/DTOs, cancelamento (AbortController) |
| UX1 (#55) | Acessibilidade (`htmlFor` em 11 arquivos), skeletons, modo essencial do aluno |
| Auditoria sênior (#56) | Só documento — achou motor de XP duplicado, tabela fantasma, fios soltos |
| Fechamento 100% (#57) | Liga recorrência + simulado-por-concurso à UI; recharts em chunk lazy; CSP `script-src 'self'` |
| SDB-AUDIT (#58) / SDB-FIX1 (#59) | Auditoria do banco remoto; drift 0034–0036 aplicado, paridade 36==36 |
| FIX1 (#60) | 5 achados da RC1: responsável multi-filhos com seletor, log de auth esperada rebaixado, branch morto removido, contextos de erro, code-splitting por área |

## Fios soltos conhecidos e ABERTOS (conferidos no código em 18/09)

| Item | Severidade | Evidência / o que mudou |
|---|---|---|
| ~~Credencial do aluno = código~~ | ✅ **fechado** | `provisionar-aluno/index.ts` gera `novaSenhaTemporaria()` independente do código, com `must_change_password: true`. A versão anterior deste índice ainda apontava `password: codigo` — **essa linha estava errada** e foi corrigida aqui. |
| ~~Reseed recriava senha = código~~ | ✅ **fechado (Onda 8)** | O seed 13 escrevia `crypt(v_codigo, …)` em `auth.users` e o `reset-db.sh` o pulava, então o CI nunca via. A parte de Auth saiu para o seed 21 e o 13 virou 100% público: agora o 13 e o 14 rodam no CI. |
| ~~A9 — histórico sem `exam_tag` reetiquetado pelo concurso atual~~ | ✅ **fechado** | `segregarPorFormato` em `modules/conteudo/simuladoConcurso.js`; contrafactual executado em `tests/onda8-a9-historico-sem-formato.test.mjs`. |
| ~~Ciclo encerrado sem saída~~ | ✅ **fechado** | Motor em `0051_proxima_edicao_trilha.sql` e porta na aba "Ciclo" da Área da Escola. |
| Proteção contra senhas vazadas no Auth (S1/S2) | **P1 — antes do primeiro aluno** | Configuração do Supabase Auth, não código. Não verificável daqui: exige abrir as settings de demo e produção. Revogação no app (`credencial_status='revogada'`) **não** basta sozinha para bloquear login no GoTrue — precisa de ban no Auth (corrigido no relatório da Onda 7 pela #113). |
| Observabilidade sem destino — `VITE_ERROR_REPORT_URL` indefinida | P2 (antes de aluno real) | `observabilidade.js`; ausente de `.env.production`/CI |
| E2E nunca roda — specs Playwright pulados sem secrets `E2E_SUPABASE_*` | P2 | `ci.yml`, job `e2e-guard`. Os testes de tela deste repo são inspeção de fonte e lógica pura; **não** substituem navegador. |
| Revisão visual das mudanças de contraste/cor não executada | P2 (antes da demo) | O token vermelho é calculado em runtime (`clarearAteRazao("#D9695E", …, 4.5)` em `shared/ui/tema.js`) e também é fundo e borda, então o raio da mudança é maior que "texto vermelho". Precisa de olho humano em 1366×768 e 390×844. |
| `.env.production` versionado (só chaves públicas) | P4 | `ls app/.env.production` |

> **Atenção de processo (mantida, e agora com um segundo caso).** O doc de
> fechamento de 28/06 afirmou corrigidos dois itens que não estavam — a REG1
> verificou e refutou. O mesmo padrão se repetiu na Onda 1: a PR #100
> declarou B1 fechado com teste verde, e a #103 mostrou que 4 das 7 funções
> continuavam com allowlist inline — **o teste passava porque inspecionava o
> helper, não os consumidores**. Declaração de fechamento vale o que vale a
> evidência; teste verde sobre o arquivo errado não é evidência.

---

## Escolas cadastradas (remoto)

**Não verificado nesta rodada** (a contagem anterior era de 02/07 via
`list_tables`). O repositório semeia 2 escolas no banco local de teste;
isso não diz nada sobre o remoto.

---

## Pendências (resumo)

Lista completa e priorizada em [`07-pendencias-para-piloto-real.md`](./07-pendencias-para-piloto-real.md);
inventário por camada em [`05-camadas-faltantes.md`](./05-camadas-faltantes.md)
(ambos reconciliados pela REG1 em 02/07).
