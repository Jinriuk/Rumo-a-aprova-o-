# EST1-A — Estabilização: integridade do motor (código)

**Data:** 2026-07-14 · **Base inicial:** `main` = `9756773` (pós-PED2-R2)
**Branch:** `claude/system-analysis-stabilization-mif9b2`
**Escopo:** os 5 pontos de código do bloco EST1-A do plano EST0 — os únicos
que são responsabilidade de desenvolvimento (integridade do motor e front).
Não inclui infra (OPS1), conteúdo (PED3) nem jurídico (JUR1), que dependem do
dono/operação.

## Resultado

**5 de 5 itens entregues, cada um com teste que o prova e commit próprio.**
Suíte completa saiu de **475/475** (linha de base medida antes de tocar em nada)
para **496/496 verdes** (+21 testes novos), migrations + seed aplicados 2× para
provar idempotência. Build de produção verde a cada item que tocou o front
(434 kB / gzip 124 kB, sem warning). Nenhum teste pulado, nenhum regredido.

| # | Item | Commit | Migration | Testes |
|---|------|--------|-----------|--------|
| A1 | Estorno de XP no DELETE (ledger não inflável) | `af6f33a` | `0038` | +4 |
| A2 | Virada de semana resiliente + FK + heartbeat | `a4016d3` | `0039` | +4 |
| A3 | Escrita do aluno restrita por coluna + whitelist no seam | `84f6c29` | `0040` | +5 |
| A4 | Trava real de duplo envio + confirmação de exclusão | `a72d87a` | — | +3 |
| A5 | Coerências pedagógicas (estrutura, critério, missões) | `ca49990` | — | +5 |

---

## A1 · Estorno de XP no DELETE — `0038` (fecha EST0 BANCO-02 / A2)

**Problema (confirmado adversarialmente):** a RLS dá ao aluno INSERT e DELETE
em `simulados`. Cada INSERT creditava +50 XP no ledger com `idempotency_key`
amarrada ao id novo, e **não existia gatilho de DELETE**. O ciclo inserir →
apagar → inserir de novo inflava XP sem limite — contradizendo a doutrina
"impossível de forjar pelo aluno" (0024) e corrompendo ranking/patente que a
escola vê.

**Correção:** `AFTER DELETE` em `simulados` e `registros_estudo` marca
`status='estornado'` no evento cuja origem sumiu (SECURITY DEFINER, como os
demais gatilhos do motor). Nada é apagado do ledger — a auditoria preserva o
que aconteceu; `estornado` não pontua. `vw_aluno_xp_total` e o cliente já
somavam só `valido`, então nenhum consumidor mudou. `meta_atividades` ficou
deliberadamente fora (objetivos são do servidor; estorno ali invalidaria XP
legítimo em regeneração de meta).

**Prova:** `tests/est1-estorno-progresso-db.test.mjs` — estorno no delete, grind
de 3 voltas = 0 XP, registro honesto, estorno cirúrgico (não toca outras origens).

## A2 · Virada de semana resiliente — `0039` (fecha EST0 BANCO-01 / A3)

**Problema (confirmado adversarialmente, e pior que o alegado):** a virada
global iterava todos os alunos numa transação única **sem bloco de exceção**, e
o próprio SELECT do loop chamava `semana_da_data()` por linha. Um único aluno
com trilha vazia/inexistente (e `alunos.trilha_id` não tinha FK) abortava a
transação inteira — nenhuma meta fechada nem gerada para **nenhuma escola**, em
silêncio (não há alerta do pg_cron).

**Correção, em três partes:**
1. `app.gerar_meta_protegida`: cálculo de semana + geração de meta por aluno em
   `begin/exception` — aluno problemático é pulado e reportado, os demais
   seguem. Virada global e por-escola recriadas com essa blindagem; o retorno
   ganhou `alunos_com_erro` (flui pelos wrappers `to_jsonb`, a Edge não quebra).
2. FK `alunos.trilha_id → trilhas(id) ON DELETE SET NULL` — o "uuid pendurado"
   morre na raiz. O seed 01 criava Lucas/Bruno antes da trilha (seed 02): agora
   nascem sem trilha e o vínculo idempotente é feito no seed 03.
3. Tabela `virada_execucoes` (**heartbeat**): toda execução grava
   fechadas/geradas/erros; RLS só super_admin lê. **A ausência de linha recente
   — ou `alunos_com_erro > 0` — é o sinal que o alerta da EST1-B vai monitorar.**

**Prova:** `tests/est1-virada-resiliente-db.test.mjs` — aluno com trilha vazia é
pulado e reportado enquanto os demais ganham meta; variante por escola; FK
recusa uuid pendurado; RLS do heartbeat (coordenação não lê, super_admin lê).

## A3 · Escrita do aluno restrita por coluna — `0040` (fecha EST0 BANCO-03)

**Problema:** a policy de UPDATE de `meta_atividades` gateava a linha, não a
coluna — o aluno podia trocar `atividade_modelo_id` para uma atividade de
prioridade F antes de concluir e maximizar o XP (100 em vez de 40/60).

**Correção:** privilégio de UPDATE **por coluna** — o papel `authenticated` só
escreve `estado`/`atualizado_em` (permission denied antes da RLS); `service_role`
e o motor seguem intactos. No seam, `atualizarAluno` ganhou whitelist explícita
(`patchAluno` em `shared/contratos/dto.js`): só `nome/trilha_id/concurso_id`
passam; campo desconhecido é erro imediato, não repasse silencioso.

**Prova:** `tests/est1-escrita-restrita-db.test.mjs` — fluxo legítimo preservado,
3 colunas barradas, coordenação segue sem falsificar progresso, whitelist pura.

## A4 · Trava real de duplo envio + confirmação de exclusão (fecha EST0 FRONTEND-01 e FRONTEND-06)

**Problema:** os dois formulários de simulado (`Progresso.jsx`,
`SimuladoConcurso.jsx`) e os quatro fluxos de escrita do backoffice (criar
escola, editar, status, provisionar/reenviar coordenador) usavam guard por
estado — dois disparos no mesmo tick liam `ocupado===false` e duplicavam
INSERT/e-mail. O × de apagar simulado não pedia confirmação.

**Correção:** todos migrados para `useEnvioUnico` (padrão FE1: latch síncrono +
"Salvando…" + erro padronizado). O × de apagar simulado agora exige
`dialogo.confirmar()`, mesmo contrato do registro de estudo.

**Prova:** `tests/est1-travas-frontend.test.mjs` — teste de fonte (padrão
`sec3-endurecimento-edge`) que trava a propriedade nos 3 arquivos e impede o
anti-padrão de voltar.

## A5 · Coerências pedagógicas (fecha EST0 PEDAGOGIA-03, -04, -05)

**PEDAGOGIA-03 (estrutura divergente):** `provas.js` — lido pelo ranking da
turma e pelo resumo do responsável — divergia da estrutura oficial do banco
(seed 07): ESA 40q vs 50, EsPCEx com dias trocados, EPCAR 20q vs 16, CN Dia 2
com fis/qui max 10 e a chave agregada `soc`. Como o `SimuladoConcurso` salva com
as chaves oficiais (bio/his/geo), esses acertos eram **subcontados** nas telas
que sustentam o valor para a escola. Agora `provas.js` é espelho 1:1 do seed 07,
com compat documentada do dado legado (`soc` → his/geo) para simulados antigos
não perderem pontos.

**PEDAGOGIA-04 (critério exibido ≠ aplicado):** a UI mostrava o
`criterio_conclusao` aspiracional ("≥80% nas últimas 30"), mas o motor fecha por
`meta_questoes + meta_acuracia`. `MissoesPersistidas` passa a exibir o alvo
**real** (X questões e ≥Z% de acerto) e o progresso X/meta.

**PEDAGOGIA-05 (missão inalcançável):** a missão CN de Biologia ("Citologia sem
susto") ficava travada em 0% porque a trilha CN não tem disciplina registrável
de Biologia. Agora, missão cuja matéria não está na trilha do aluno é marcada
honestamente como **acompanhamento da coordenação** (não some, não finge
progresso). Tornar Biologia registrável no CN é decisão de conteúdo do dono
(ver abaixo).

**Prova:** `tests/est1-provas-oficial.test.mjs` — paridade com os números do
seed oficial por concurso + compat do dado legado.

---

## O que EST1-A NÃO faz (fora do escopo de código / próximos blocos)

- **EST1-B (operação observável):** definir destino de erro
  (`VITE_ERROR_REPORT_URL`), alerta da virada (consumindo o heartbeat de A2),
  alerta de uptime, correção da paginação de 1000 do `backoffice-coordenador`,
  higiene do advisor (policies duplicadas de `aluno_missoes`, índices de FK).
  Parte é código, parte é configuração de infra do dono.
- **EST1-C (SEC3b):** credencial opaca do aluno, rate limit, MFA de super_admin —
  envolve configuração do projeto Supabase (Pro) além de código.
- **Decisão de conteúdo (dono):** tornar Biologia uma disciplina registrável na
  trilha CN (o exame oficial tem bio; a trilha autorada não). Não foi feito aqui
  porque altera conteúdo autoral (decisão 16) — A5 apenas deixou a missão
  honesta em vez de silenciosamente quebrada.

## Como verificar

```bash
# Postgres local (Node 20+):
cd tests && bash reset-db.sh && npm test      # 496/496
cd ../app && npm run build                     # verde, 434 kB / gzip 124 kB
```
