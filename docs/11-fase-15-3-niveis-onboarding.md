# Fase 15.3 — Níveis de aluno e onboarding pedagógico (13/06/2026)

Terceira subfase da Fase 15. Cria a estrutura de **níveis** (geral e por
matéria) e o **onboarding** pedagógico, com ajuste manual rastreável pela
coordenação. Prepara o terreno para a 15.4 gerar trilhas/missões a partir
do nível. Aditiva; isolada por escola; sem motor adaptativo.

## Pré-requisito resolvido: exam_tag da ESA normalizado

Antes da 15.3, o código histórico `essa` (EsSA) foi padronizado para
`esa` (migration `0010`, guardada e idempotente; seeds 05/06/07, front
`provas.js`, testes e docs atualizados). `exam_tag` agora é estável para
todas as próximas subfases.

## O que foi implementado

- **Nível geral e por matéria** numa única tabela `aluno_niveis` (uma
  linha por `escopo`: `'geral'` ou o código da matéria). Níveis: `base`,
  `intermediario`, `avancado`, `reta_final`.
- **Origem do nível** (`origem`): `calculado` | `manual` | `diagnostico`
  | `validar` — preserva a honestidade do dado (sem precisão falsa).
- **Histórico append-only** `aluno_nivel_historico`, escrito por um
  **gatilho `SECURITY DEFINER`** (à prova de adulteração): toda mudança
  de nível registra quem, quando, de quê para quê e o motivo.
- **Onboarding** `aluno_onboarding` (1:1): experiência prévia,
  disponibilidade semanal, maior dificuldade, objetivo, observação da
  coordenação, conclusão.
- **Alvo pedagógico**: `alunos.concurso_secundario_id` (alvo secundário
  opcional, dentro da mesma turma comercial). O principal segue em
  `concurso_id` (D2); `data_prova_alvo`, `especialidade`, `ciclo` vieram
  na 0008.
- **Lógica pura** `app/src/modules/conteudo/niveisAluno.js`:
  `classificarPorDesempenho`, `calcularNivelMateria`, `estaEmRetaFinal`,
  `calcularNivelGeral`, `sugerirNivelInicial`, `resumirDiagnosticoAluno`.
- **Seam de dados**: `carregarNivelAluno`, `salvarNivelAluno`,
  `historicoNivelAluno`, `atualizarAlvoPedagogico`, `carregarOnboarding`,
  `salvarOnboarding`.

## Como o nível GERAL foi modelado

Linha `escopo='geral'` em `aluno_niveis`. No cálculo (`calcularNivelGeral`),
o estado **Reta Final** se sobrepõe quando a prova está a ≤ 90 dias;
senão, agrega os níveis por matéria pela média dos *ranks*
(base=0, inter=1, avançado=2) arredondada. Se falta matéria com dado, o
agregado sai como `validar`.

## Como o nível POR MATÉRIA foi modelado

Mesma tabela, `escopo = 'mat'|'por'|...`. `classificarPorDesempenho`
mapeia acerto×volume: `<40%`→Base; `≥70%` **com** volume `≥100`→Avançado;
o resto→Intermediário; volume `<20`→`validar`. Assim um aluno pode ser
geral Intermediário, Mat Base e Port Avançado (caso coberto por teste).

## Como o alvo pedagógico foi tratado

Principal = `alunos.concurso_id`; secundário = `concurso_secundario_id`
(opcional). A escolha é por `exam_tag`, validada contra a turma comercial
pelo módulo `pedagogia.js` (`alvoPermitido`) — turma não vira regra.

## Como a data de prova alvo foi tratada

`alunos.data_prova_alvo`. Alimenta `estaEmRetaFinal`/`calcularNivelGeral`
para o estado temporal Reta Final. Ajustável pela coordenação via
`atualizarAlvoPedagogico`.

## Como a coordenação ajusta o nível

`salvarNivelAluno`/`atualizarAlvoPedagogico` (RLS: só coordenação escreve
na própria escola). Toda alteração de nível dispara o gatilho que grava
`aluno_nivel_historico` com `alterado_por`, `em`, `nivel_anterior/novo`,
`origem` e `motivo` — rastreabilidade básica garantida no banco.

## Como aluno/responsável visualizam

`carregarNivelAluno` sob RLS: o **aluno** lê só o próprio nível e o
próprio onboarding (não edita); o **responsável** lê os do aluno
vinculado (não edita, não lê não-vinculado). `resumirDiagnosticoAluno`
entrega pontos fortes/atenção para um resumo simples ao responsável.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/0010_normalizar_esa.sql` | **novo** — rename `essa`→`esa` (pré-15.3) |
| `supabase/migrations/0011_niveis_onboarding.sql` | **novo** — níveis, histórico, onboarding, gatilho, RLS |
| `supabase/seed/05_concursos.sql`, `06_pedagogia.sql`, `07_provas.sql` | `essa`→`esa` |
| `supabase/seed/08_niveis_dev.sql` | **novo** — níveis/onboarding de demo (Lucas/Bruno) |
| `tests/reset-db.sh` | glob de seed inclui o 08 (`0[1235678]`) |
| `app/src/modules/conteudo/niveisAluno.js` | **novo** — lógica pura de nível |
| `app/src/modules/conteudo/provas.js` | chave `essa`→`esa` |
| `app/src/shared/data/index.js` | + 6 fetchers de nível/onboarding/alvo |
| `tests/niveis.test.mjs` | **novo** — 8 testes de lógica pura |
| `tests/niveis-db.test.mjs` | **novo** — 11 testes de banco/RLS |
| `tests/pedagogia*.test.mjs`, `provas-db.test.mjs`, `docs/09,10` | `essa`→`esa` |

## O que ficou fora (proposital)

Trilhas, missões, XP, patentes, conquistas, simulados avançados,
recorrência real, banco de questões nível 2 e motor adaptativo completo
— subfases 15.4–15.7. **Nenhuma UI foi montada**: a lógica e a RLS
sustentam as visões descritas, mas nenhuma tela importa os módulos novos,
então a suíte E2E (42) e o bundle ficam intocados (footprint zero).

## Riscos ou dúvidas

- Os limiares (volume 20/100; acerto 40/70; reta final 90 dias) são
  preliminares (🟡 doc §10) — calibrar com turma real. Centralizados em
  `LIMIAR` para ajuste fácil.
- Sob RLS, o `UPDATE` do aluno em nível/onboarding não levanta erro:
  filtra as linhas e altera **0** (dado intacto). A segurança está
  garantida; quem tenta `INSERT` é recusado explicitamente.
- Nível agregado é exibição; a decisão fina é por matéria (doc §8.1).

## Testes

- **build:** ✅ passou (bundle inalterado).
- **unitários:** ✅ 79/79 (60 anteriores + 8 lógica de nível + 11
  banco/RLS de nível). Inclui a revalidação pós-rename da ESA.
- **E2E:** ⏳ não executável localmente (browser do Playwright bloqueado
  pela egress); validado pelo CI. Impacto esperado nenhum (sem wiring).
- **RLS/isolamento:** ✅ coordenação lê/ajusta só a própria escola; aluno
  lê o próprio nível e não edita; responsável lê só o vinculado;
  histórico só a coordenação lê e só o gatilho escreve; config global
  segue segura.

## Status

✅ **Subfase 15.3 encerrada** (pendente da confirmação do E2E verde no
CI). **A 15.4 não foi iniciada** — sem trilhas, missões, XP, patentes
ou conquistas.
