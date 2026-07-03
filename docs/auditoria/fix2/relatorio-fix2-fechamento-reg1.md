# FIX2 — Fechamento de Achados da REG1

**Data:** 2026-07-02 · **Branch:** `claude/fix1-rc1-corrections-40rcya` (reiniciada de `origin/main` = `55daf92`, pós-merge da REG1 no PR #61) · **Tag de preservação:** `fix2-fechamento-reg1`
**Escopo fechado:** Item 1 (tabela fantasma P1-5) · Item 2 (conquistas com escrita órfã) · Item 3 (verificação do PR #49). Nada além disso.

---

## 0. Estado verificado (Fase 0 — reproduzido, não citado)

| Afirmação do prompt | Verificação própria | Resultado |
|---|---|---|
| `solicitacoes_acesso` ausente do remoto | `information_schema.tables` via MCP | **Confirmado**: 0 ocorrências; 46 tabelas base (+3 views) |
| 15.5 sem consumidor na UI | `grep concederXp\|listarPatentes\|listarConquistas\|carregarGamificacaoAluno\|desbloquearConquista` em `routes/`+`modules/` | **Confirmado**: 0 usos |
| `aluno_conquistas` com "escrita viva" | SQL no remoto: 110 rows, `max(desbloqueada_em)` = **2026-06-24** | **DIVERGIU (importante)**: a última escrita é 3 dias ANTES da PED1. Os 110 eventos têm `origem='motor'` → autor é o **C0 (0024)**, não a PED1. O gatilho PED1 (`trg_ped1_registro`) está habilitado mas **nunca disparou em produção** (0 eventos `motor_*`; sem atividade de aluno desde 24/06). Ou seja: havia **DOIS escritores** armados (C0 ativo + PED1 latente), não um — o achado era maior que o descrito |
| PR #49 existe/mergeado | GitHub API | **Confirmado**: `merged: true` em 2026-06-27T17:13:17Z, squash `d0a9ad7`, base `9962a78` (PED1), 12 arquivos, +1136/−15 |
| Contagem de testes antes | `bash reset-db.sh && npm test` | **471/471** (bate com REG1) |
| Docs `01_DOCUMENTO_CENTRAL…`/`02_MEMORIA…` | `ls` | **Não existem no repositório** (3ª fase seguida que os cita; as "9 condições do documento central" não são verificáveis — usei as regras duras do prompt + regras REG1) |

## 1. Item 1 — `solicitacoes_acesso` (P1-5) ✅ fechado

**Investigação (o que acontecia de fato):** o link "Esqueci meu código de acesso"
fica **sempre visível** no modo aluno/responsável do Login. A tela coletava
e-mail, chamava `solicitarRecuperacaoCodigo` → `INSERT` na tabela inexistente →
erro **engolido em silêncio** (`console.warn`, sem crash, sem erro visível) →
o usuário via **"Solicitação recebida … enviaremos as instruções"**. Mentira
dupla: nada era gravado E não existe infra de e-mail transacional para aluno.
Não há nenhuma UI de fila para a coordenação no código (`grep` em
`routes/escola`, `routes/admin`, `modules` → 0) — o cenário "fila quase pronta"
**não existe**, então vale a decisão padrão do prompt.

**Decisão (padrão):** remover a escrita e tornar a tela honesta e estática.
- `Login.jsx`: a tela "esqueci meu código" virou orientação sem formulário —
  explica que o código é emitido pela escola e que a coordenação gera um novo
  pelo painel dela. Sem coleta de e-mail, sem botão "Enviar", sem promessa de
  envio. (2ª passada ajustou o texto: "reemite na hora" → "gera e entrega um
  novo código", porque `provisionar-aluno` exige revogar credencial existente
  antes de gerar outra — HTTP 409 — e o texto não pode prometer mais que isso.)
- `shared/data/index.js`: `solicitarRecuperacaoCodigo` **removida**, com
  comentário de contexto apontando fila real → ADM2 (escrita pré-auth exige
  análise de abuso própria).
- Link mailto/whatsapp por escola foi descartado: **não há contexto de escola
  antes do login** (o branding só resolve pós-auth), então qualquer contato
  específico seria chute — a orientação genérica é o mínimo que não mente.

**Evidência:** smoke Playwright (preview + Chromium): `TELA_HONESTA: OK`,
`SEM_FORM_EMAIL: OK`, `SEM_BOTAO_ENVIAR: OK`, `SEM_PROMESSA_FALSA: OK`,
`VOLTAR_OK: OK`.

## 2. Item 2 — conquistas com escrita órfã ✅ opção (a), com escopo corrigido

**O que a investigação mudou:** o achado real é **maior** que o enunciado — não
é (só) o gatilho da PED1. São dois escritores server-side em `aluno_conquistas`:

| Escritor | Migration | Estado em produção |
|---|---|---|
| `app.desbloquear_conquista_basica` (C0, "primeira vez") | 0024 | **Ativo** — autor das 110 rows (origem `motor`, xp_delta 0) |
| `app.motor_conquista_xp` (PED1, premiada com xp_bonus) | 0033 | Armado, 0 disparos (sem atividade de aluno desde 24/06) |

E zero leitores: a aba Conquistas do aluno deriva o catálogo **no cliente**
(`Conquistas.jsx:62`, `catalogoConquistas`) e a régua de patente é `jargao.js`.

**Decisão: (a)** — desligar a escrita nos **dois** motores e deprecar a 15.5
por completo. **(b) foi rejeitada** porque: religaria a UI a um dado alimentado
por dois escritores com catálogos diferentes, exigiria reescrever a aba
Conquistas (que hoje mostra *progresso rumo à* conquista, mais rico que a linha
binária do banco) e mexeria na tela mais usada pelo aluno — mais caro e mais
arriscado, exatamente o que o prompt manda evitar.

**Implementação:**
- **Migration `0037_fix2_deprecar_escrita_conquistas.sql`**: os dois escritores
  viram **no-ops assinatura-compatíveis** (os call sites nos gatilhos continuam
  funcionando); `COMMENT ON TABLE` carimba as 4 tabelas da 15.5 como
  deprecadas/congeladas. **Nada destrutivo**: nenhuma tabela dropada, nenhum
  dado apagado, nenhuma RLS tocada. Rollback = recriar as 2 funções com os
  corpos de 0024/0033 (documentado no cabeçalho).
- **Aplicada no remoto** via MCP (runbook, nunca `db push`): `success: true`;
  verificação ao vivo: ambas as funções com corpo no-op, **110 rows preservadas**,
  ledger **37 == 37 repo** (paridade da SDB-FIX1 mantida).
- **Seam**: as 5 funções mortas da 15.5 removidas (`listarPatentes`,
  `listarConquistas`, `carregarGamificacaoAluno`, `concederXp`,
  `desbloquearConquista`) — "sem escrita nem leitura" também no app.
- **O que segue vivo (e provado)**: eventos de registro no ledger C0, missão
  fechando com XP (PED1), nível por matéria, XP total do aluno.

**Evidência (testes novos — `tests/fix2-conquistas-deprecadas.test.mjs`, 4):**
registro dispara os DOIS gatilhos + `motor_avaliar_aluno` explícito → nenhum
`aluno_conquistas` novo, nenhum evento `conquista_desbloqueada` novo; missão/
nível/evento de registro seguem funcionando; conquista histórica do seed
preservada; RLS inalterada (aluno segue sem escrever conquista direto).
`tests/progresso-db.test.mjs` atualizado: a asserção que exigia a escrita
antiga agora exige a ausência dela (comportamento novo documentado).

**Fica fora (documentado, não escondido):** o módulo puro
`conteudo/gamificacao.js` + teste (código morto sem fonte de dados — limpeza
FE2/DB3) e a **remoção física** das 4 tabelas (P4, DB3). O seed 10 continua
inserindo dados estáticos de vitrine nessas tabelas — é dado de demo, não motor.

## 3. Item 3 — PR #49 (PED2 rodada 1) ✅ confirmado, com 2 ressalvas de higiene

- **Existe e está mergeado:** PR #49, `merged: true` 27/06 17:13Z, squash
  `d0a9ad7` sobre a base `9962a78` (PED1 #48). 12 arquivos, +1136/−15.
- **O diff contém o que o relatório alega:** `maturidade.js` (fonte única) +
  `SeloMaturidade.jsx` + gates em `CadastroAlunos.jsx`/`AreaAluno.jsx` +
  `scripts/validar-conteudo.mjs` + `scripts/gerar-seed-maturidade.mjs` +
  migration `0034` + seed `18` + 12 testes + 3 docs.
- **Estado VIVO verificado (02/07):** `maturidade`/`SeloMaturidade` importados
  por `CadastroAlunos.jsx` e `AreaAluno.jsx` (não órfãos); validador executa e
  passa (`✓ conteúdo íntegro e maturidade honesta`); migration 0034 no ledger
  remoto (aplicada 29/06 pela SDB-FIX1); seed 18 roda no `reset-db.sh`; os 12
  testes estão na suíte verde.
- **Ressalva 1 (gate):** a frase "validador reprova o build" é verdadeira **via
  suíte** (o teste chama `validar()` completo e a suíte é gate de CI), mas o
  validador **não** está plugado em `npm run build` nem chamado direto no
  `ci.yml` — quem reprova é `npm test`. Funciona; a descrição é imprecisa.
- **Ressalva 2 (números):** o corpo do PR cita "migration 0024", "seed
  13_maturidade" e "196 testes" — os artefatos reais são **0034**, **seed 18**
  e a suíte da época era maior. Mesmo padrão de número-sem-comando que a REG1
  documentou; aqui o **diff sustenta a entrega**, só o texto está impreciso.

**Veredito Item 3: alegação SUSTENTADA** — diferente do fechamento-100%, a
fábrica existe, está viva na UI e testada.

## 4. Prova final

```
cd tests && bash reset-db.sh && npm test   → # tests 475 · pass 475 · fail 0   (471 → 475)
cd app && npm run build                    → verde; index 433.74 kB (gzip 124.18)
smoke (preview+Chromium)                   → 5/5 OK na tela nova do Login
remoto: ledger 37 == repo 37 · funções no-op ao vivo · 110 rows preservadas
```

## 5. Dupla passada (o que a 2ª pegou)

1. **Item 1:** o texto novo prometia "reemite na hora" — `provisionar-aluno`
   devolve 409 para aluno já provisionado (exige revogar antes); texto ajustado
   para não prometer além do fluxo real.
2. **Item 2:** o enunciado atribuía a escrita à PED1; a investigação achou o
   escritor real (C0) e um segundo armado — a correção cobriu os dois. Se
   tivéssemos desligado só a PED1 (letra do enunciado), o achado continuaria
   aberto — isso seria maquiagem.
3. **Item 3:** checado estado vivo (imports, validador executado, ledger), não
   só o git log — como o prompt exigiu.

## 6. Riscos, P0/P1 novos e pendências

- **P0/P1 novos: nenhum.**
- **Risco residual baixo:** alunos futuros não acumulam mais linhas em
  `aluno_conquistas` — se o produto decidir religar o catálogo oficial (DB3),
  haverá lacuna histórica entre 02/07 e a religação (aceito e documentado).
- **Pendências (inalteradas, com dono):** observabilidade sem destino (P1-3),
  E2E sem secrets (P2-3), credencial opaca (P2-5), rate limit (P2-6),
  storage/FKs (P2-7), remoção física das tabelas deprecadas (DB3/P4), módulo
  puro `gamificacao.js` morto (FE2).
- **Branch preservada:** a tag **`fix2-fechamento-reg1`** foi criada apontando
  para o commit de código da FIX2 (**`5d47f12`**), mas o push de `refs/tags` é
  **bloqueado pelo proxy deste ambiente** (HTTP 403, 3 tentativas com backoff —
  push de branch funciona, push de tag não). Registro de preservação, portanto:
  (1) o hash `5d47f12` fica gravado aqui e na mensagem do PR; (2) o GitHub
  preserva o `head sha` do PR mesmo se a branch for apagada no merge; (3) o
  dono pode criar a tag pelo GitHub (Releases → New tag `fix2-fechamento-reg1`
  no commit `5d47f12`) em 30 segundos. **Não apagar a branch sem confirmação.**

## 7. Índices atualizados (regra REG1 cumprida)

`02-linha-do-tempo.md` (linha FIX2), `03-status-atual.md` (475 testes, 37==37,
fios soltos fechados), `05-camadas-faltantes.md` (1.8 🟢; sequência de fases),
`07-pendencias-para-piloto-real.md` (P1-5 e P2-8 resolvidos).
