# Relatório Final — Fase A: Segurança, Operação e Prontidão Técnica

## 1. Resumo executivo

A pergunta central desta fase era: **se uma escola real começar a usar
amanhã, conseguimos operar, corrigir, voltar atrás, entender erros e
evitar falhas graves?** A resposta, depois do trabalho abaixo, é **sim,
com duas pendências de infraestrutura já conhecidas e documentadas**
(região do banco em `sa-east-1` e backup confirmado — ambas decisões de
plano/infra, não de código, já registradas em `docs/lgpd-e-infra.md` e
`docs/backup-retencao-lgpd.md`).

O trabalho não foi de expansão: nenhuma tela nova de produto, nenhuma
regra pedagógica mudou, nenhuma dependência externa obrigatória foi
criada. Foi fechamento de lacunas de **segurança de exposição de erro**,
**observabilidade**, **auditoria** e **documentação operacional** — a RLS
já estava bem desenhada antes desta fase e continua exatamente como
estava, sem nenhuma política enfraquecida.

## 2. Arquivos alterados

**Novos:**
- `app/src/shared/lib/erros.js` — tradução de erro técnico → mensagem humana.
- `app/src/shared/lib/observabilidade.js` — captura de erro + relato opcional.
- `app/src/shared/ui/ErroFronteira.jsx` — error boundary do React.
- `supabase/migrations/0022_logs_coordenacao.sql` — nova tabela de auditoria.
- `tests/logs-coordenacao-db.test.mjs` — testes de RLS da tabela nova.
- `docs/operacao.md`, `docs/rollback.md`, `docs/backup-retencao-lgpd.md`,
  `docs/checklist-go-live-piloto.md`, `docs/ambientes-e-variaveis.md`.

**Modificados:**
- `app/src/main.jsx` — instala captura global de erro + error boundary.
- `app/src/shared/hooks/useRecurso.js`, `useSessao.js`,
  `app/src/modules/conteudo/useTrilha.js` — erro técnico trocado por
  `mensagemAmigavel()`.
- `app/src/routes/aluno/AreaAluno.jsx`, `VisaoEstudo.jsx`,
  `app/src/routes/responsavel/AreaResponsavel.jsx`,
  `app/src/routes/escola/AreaEscola.jsx`,
  `app/src/routes/admin/AreaAdmin.jsx`,
  `app/src/modules/motor/Registrar.jsx`, `MetaSemana.jsx`,
  `app/src/modules/pessoas/CadastroAlunos.jsx`, `ListaAlunos.jsx`,
  `app/src/modules/escola/Marca.jsx`,
  `app/src/modules/desempenho/Progresso.jsx` — idem, em cada catch que
  mostrava erro na tela.
- `app/src/shared/data/index.js` — nova função `registrarLogCoordenacao`
  (best-effort) chamada em `criarTurma`, `renomearTurma`, `removerTurma`,
  `cadastrarAlunos`, `atualizarMarca`.
- `supabase/functions/{provisionar-aluno,lgpd-titular,gerar-meta,virar-semana}/index.ts`
  — removido o campo `detail` (erro técnico cru) da resposta HTTP de erro;
  o `console.error` que já existia (log do servidor) foi mantido.
- `tests/isolamento.test.mjs` — `logs_coordenacao` incluída na lista de
  tabelas isoladas por tenant.
- `.env.example` — documentada a variável opcional `VITE_ERROR_REPORT_URL`.

Nenhum arquivo de regra pedagógica, gamificação, simulado ou backoffice
foi alterado.

## 3. Correções implementadas (por categoria)

### A.1 — Documentação operacional
Criados `docs/operacao.md` (runbook central: erros, observabilidade,
travas, login, logs, RLS, suporte), `docs/rollback.md` (runbook de
reversão por cenário), `docs/backup-retencao-lgpd.md` (política de
backup/retenção/LGPD). Todos cross-referenciam os documentos da Fase 17
já existentes (`deploy-checklist.md`, `lgpd-e-infra.md`,
`monitoramento-backup.md`, `go-live-checklist.md`) em vez de duplicá-los.

### A.2 — Separação de ambientes
`docs/ambientes-e-variaveis.md` documenta os 4 ambientes em uso (dev
local, CI unitários, CI E2E, demo/produção atual) e tabula toda variável
de ambiente do sistema com sensibilidade e obrigatoriedade. Confirmado
por leitura de código que `service_role` não aparece em nenhum arquivo do
front (só em `scripts/*.mjs` e nas Edge Functions, que rodam no
servidor).

### A.3 — Segurança do login por código
Investigado: ~55 bits de entropia no código de acesso, sem rate limit
customizado no código do projeto — a proteção contra força bruta é a do
próprio Supabase Auth (não enfraquecida, não contornada, não
reimplementada por fora). Reemissão de credencial já existe. Documentado
em `docs/operacao.md` §4 como postura aceita, com pendência explícita:
confirmar no painel do Supabase, antes do piloto, que os limites de rate
limit do Auth estão calibrados para o volume esperado. Nenhuma gambiarra
foi introduzida.

### A.4 — Observabilidade mínima
`ErroFronteira` (error boundary) + `instalarCapturaGlobal()`
(`window.onerror`/`unhandledrejection`) instalados em `main.jsx`. Relato
externo via `VITE_ERROR_REPORT_URL` é **opcional e best-effort** — sem
ela definida, o sistema funciona normalmente, só sem envio externo.

### A.5 — Tratamento humano de erros
Toda mensagem de erro técnica (`e.message` vindo de `falha()`/Supabase)
que chegava à tela foi substituída por `mensagemAmigavel()`. Confirmado
por busca (`grep`) que não há mais nenhum `.message` renderizado
diretamente na UI. As quatro Edge Functions que devolviam `detail` com o
erro cru no corpo da resposta HTTP (visível via DevTools, ainda que não
renderizado na tela) foram corrigidas — o detalhe técnico agora só existe
no log do servidor (`console.error`, já existente antes desta fase).

### A.6 — Travas contra duplo envio
Auditado: praticamente toda ação sensível já tinha proteção de
ocupado/desabilitado antes desta fase (`Registrar`, `MetaSemana`,
`CadastroAlunos`, `ListaAlunos`, `Marca`, `AreaAdmin`). Um gap residual de
baixo risco foi identificado e documentado (não corrigido, por ser de
baixo risco e exigir mexer em padrão `window.prompt`/`confirm` fora do
escopo desta fase) — ver riscos remanescentes.

### A.7 — Revisão de RLS
Revisão completa não encontrou política a enfraquecer nem `using (true)`
em escrita. Nenhuma política existente foi tocada. A única mudança de
schema relacionada a RLS foi a criação da nova tabela `logs_coordenacao`,
com isolamento por tenant no mesmo padrão de `logs_acesso` — coberta por
testes próprios e pela suíte de isolamento geral.

### A.8 — Logs mínimos de ações sensíveis
Achado importante: criação de escola e geração de credencial **já eram**
auditadas antes desta fase (`admin_logs` via RPC `backoffice_criar_escola`;
`logs_acesso` via Edge Function `provisionar-aluno`). A lacuna real era
mais estreita: turma criada/renomeada/excluída, alunos importados em
lote, marca alterada — nenhuma dessas ações deixava rastro. Criada a
tabela `logs_coordenacao` (migration `0022`, aditiva, RLS no mesmo
padrão de `logs_acesso`) e conectados os 5 pontos de gravação
(`criarTurma`, `renomearTurma`, `removerTurma`, `cadastrarAlunos`,
`atualizarMarca`) via helper best-effort em `data/index.js` — uma falha
ao gravar o log nunca impede a ação principal.

### A.9 — Checklist de go-live do piloto
Criado `docs/checklist-go-live-piloto.md`: checklist por escola (distinto
do checklist de sistema já existente em `docs/go-live-checklist.md`),
cobrindo criação da escola, coordenação, alunos, responsáveis,
credenciais, concurso/trilha, suporte e canal de emergência.

## 4. Riscos reduzidos

- Erro técnico do Supabase/Postgres não chega mais à tela do usuário
  final (aluno, responsável ou coordenação), nem ao corpo da resposta
  HTTP das Edge Functions.
- Uma exceção não tratada no render não derruba mais a tela inteira em
  branco — cai numa fronteira com mensagem humana e botão de recuperação.
- Ações de turma, importação de alunos e marca, antes sem nenhum rastro,
  agora são auditáveis por escola.
- Postura de segurança do login por código foi investigada e documentada
  (antes, implícita e não registrada em lugar nenhum).
- Separação de ambientes e variáveis está documentada de ponta a ponta,
  com confirmação ativa de que `service_role` não está exposto.

## 5. Riscos remanescentes (P0–P3)

| Prioridade | Risco | Por que não foi resolvido agora | Onde está documentado |
|---|---|---|---|
| P1 | Banco de produção/demo ainda em `us-east-1`, não `sa-east-1` — bloqueia dado real de menor | decisão de infraestrutura/custo, fora do escopo de código desta fase | `docs/lgpd-e-infra.md` |
| P1 | Backup automático não confirmado para o plano em uso | decisão de infraestrutura/custo | `docs/backup-retencao-lgpd.md` |
| P2 | Sem rate limit customizado no login além do padrão do Supabase Auth | mudança maior que "proteção mínima segura"; instrução explícita de não enfraquecer/contornar o Auth | `docs/operacao.md` §4 |
| P2 | Política de retenção de dado após saída de aluno/escola não definida | decisão de produto/negócio, não técnica | `docs/backup-retencao-lgpd.md` |
| P3 | `Turmas.renomear`/`excluir` (em `AreaEscola.jsx`) sem trava de "ocupado" explícita no `window.prompt`/`confirm` | risco baixo (ação pouco frequente, efeito idempotente o suficiente); corrigir exigiria tocar no padrão prompt/confirm, fora do escopo mínimo desta fase | `docs/operacao.md` §3 |
| P3 | Suporte/canal de emergência do piloto ainda não nomeados (pessoa/canal) | decisão organizacional, não técnica | `docs/checklist-go-live-piloto.md` |

## 6. Testes executados

- **Build de produção**: `cd app && npm run build` — ✓ verde, sem erro
  (918 módulos, aviso de chunk grande já preexistente e não relacionado a
  esta fase).
- **Unitários + RLS** (`tests/`, Postgres 16 local iniciado para esta
  sessão): `npm test` — **170/170 verdes** (164 já existentes + 6 novos
  para `logs_coordenacao`). Suíte completa rodada duas vezes (antes e
  depois de adicionar os testes novos).
- **Migrations + seed**: `tests/reset-db.sh` rodado do zero, aplicando
  `0001`...`0022` e o seed **duas vezes** (idempotência exercitada) — ✓
  sem erro.
- **RLS de isolamento**: `tests/isolamento.test.mjs` — ✓, agora incluindo
  `logs_coordenacao` na lista de tabelas verificadas.
- **Edge Functions**: não há Deno disponível neste ambiente para
  type-check; verificação manual da edição (diff de uma linha por
  arquivo, balanceamento de chaves/parênteses confirmado por script) nas
  4 funções alteradas.
- **E2E (Playwright)**: **não executado nesta sessão** — o ambiente de
  execução remoto bloqueia o download do binário do Chromium
  (`cdn.playwright.dev` fora da allowlist de rede) e a instalação de
  dependências de sistema via apt (PPAs bloqueados). A suíte E2E já roda
  no CI do GitHub (`.github/workflows/ci.yml`, job `e2e`) a cada push —
  recomenda-se confirmar lá antes do merge/deploy.
- **Manual (login dos 3 perfis, duplo clique, erro controlado)**: não
  executado nesta sessão por falta de browser disponível no ambiente
  (mesma limitação de rede acima). Mitigado por: (a) o build de produção
  passou, o que já valida sintaticamente e por resolução de módulos todas
  as telas alteradas; (b) a lógica de erro/log foi exercitada
  indiretamente pelos testes de banco (ex.: `logs-coordenacao-db.test.mjs`
  confere que a gravação e a RLS da nova trilha funcionam). Recomenda-se
  rodar manualmente (ou via E2E no CI) antes do go-live do primeiro
  piloto real.

## 7. Evidências

```
$ cd app && npm run build
✓ 918 modules transformed.
✓ built in 6.75s

$ cd tests && PGPORT=5432 ... npm test
1..170
# tests 170
# pass 170
# fail 0
```

Grep de confirmação (nenhum erro técnico renderizado na UI) — rodado por
último, depois de corrigir um caso que a primeira passada tinha deixado
escapar (`Progresso.jsx`, formulário de simulado):
```
$ grep -rn 'setErro(e\.message)|alert(e\.message)' app/src
# nenhuma ocorrência — todas as ocorrências restantes de `e.message` são
# console.error (log de servidor) ou a construção interna de falha()
```

## 8. Decisão de prontidão

**O sistema está apto para um piloto controlado**, condicionado aos dois
itens P1 (região do banco e backup confirmado) — que são decisões de
infraestrutura/contrato, não de código, e já estavam identificados antes
desta fase. Nenhuma regra pedagógica, nenhuma política de RLS e nenhum
teste existente foi alterado ou mascarado. Recomendação: rodar a suíte
E2E completa no CI (já configurada) e o checklist
`docs/checklist-go-live-piloto.md` para a primeira escola antes de
liberar acesso real.
