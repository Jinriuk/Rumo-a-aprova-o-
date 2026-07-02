# FIX1 — Correção dos achados documentados da RC1

**Data:** 2026-07-02 · **Branch:** `claude/fix1-rc1-corrections-40rcya` · **Base:** `main` (`3cd0394`)
**Escopo fechado:** OBS-RC1-003, OBS-RC1-004, OBS-RC1-005, OBS-RC1-006 (avaliado e incluído), OBS-RC1-008.
Nada de PED2, ADM2 ou qualquer outra fase.

---

## 1. Objetivo

Fechar os cinco achados que a RC1 (`docs/auditoria/rc1/bugs-e-regressoes.md`) documentou
e delegou para FIX1, sem tocar RLS, Auth, checks de papel, `escola_id` ou isolamento
multi-tenant, e sem migrations.

## 2. Verificação independente de estado (Fase 0)

Nenhum relatório foi aceito como verdade — tudo abaixo foi reproduzido neste ambiente:

| Afirmação dos docs | Verificação | Resultado |
|---|---|---|
| Testes 341/341 (status) · 351/351 (tarefa) | `node --test` com Postgres 16 local, migrations + seed 2x | **459/459** antes do FIX1 — divergência PARA CIMA (fases PED1/ADM2/SEC3 adicionaram testes; docs de índice defasados) |
| `vite build` verde | `npm run build` | **Confirmado** (com warning de chunk >500 kB) |
| Migrations repo ↔ ledger 36==36 | `ls supabase/migrations` × `list_migrations` (MCP, projeto `bdjkgrzfzoamchdpobbl`) | **Confirmado: 36 == 36**, últimas `0034/0035/0036` presentes nos dois lados |
| Bundle 1.09 MB monolítico (OBS-RC1-006) | build atual | **Defasado:** UX1 já havia separado recharts; principal estava em **711 kB** (gzip 196 kB), ainda acima do warning |
| Os 5 achados FIX1 existem no código | leitura direta dos arquivos | **Confirmados um a um** (evidências na seção 3) |

Não verificado: nada crítico. Documentos `01_DOCUMENTO_CENTRAL...` e `02_MEMORIA...`
citados na tarefa não existem no repositório (lidos os equivalentes em `docs/fundacao/`
e `docs/00-indices/`). Nenhum P0/P1 novo encontrado.

## 3. Ações por item

### OBS-RC1-004 (P2) — Responsável com 2+ filhos via só 1 aluno · ✅ corrigido

- **Evidência do bug:** `shared/data/index.js › alunoVinculado()` fazia
  `vinculos_responsaveis ... .limit(1)`; `AreaResponsavel.jsx` consumia um único aluno,
  sem seletor. Com 2+ vínculos, o aluno exibido era indeterminado.
- **Decisão de produto (documentada na própria RC1 como recomendação):** listar todos os
  vínculos e mostrar **seletor** quando houver mais de um. Com um único vínculo, a
  experiência é idêntica à anterior (zero mudança para o caso comum).
- **Implementação:**
  - `alunosVinculados()` substitui `alunoVinculado()` no seam: busca todos os
    `aluno_id` dos vínculos (RLS decide o que sai) e os alunos correspondentes,
    **ordenados por nome** (determinístico — fim do "aluno sorteado").
  - `AreaResponsavel.jsx`: chips de seleção (aria-pressed, role=group) quando
    `alunos.length > 1`; dados zerados na troca (métrica do irmão anterior nunca
    aparece sob o nome do outro); erro do irmão anterior limpo na troca.
  - `registrarAcesso` (trilha LGPD) agora dispara **por aluno efetivamente
    consultado**, a cada troca no seletor — antes registrava só o primeiro.
- **Testes novos (`tests/fix1-responsavel-irmaos.test.mjs`, 7 casos, RLS valendo):**
  responsável vê os 2 vínculos e os 2 alunos; NÃO vê colega sem vínculo; log LGPD
  grava para cada filho e a coordenação vê a trilha; aluno segue vendo só a si;
  coordenação segue vendo a escola; nada atravessa tenant (respB × escola A);
  responsável segue sem poder criar/apagar vínculo.

### OBS-RC1-003 (UX/P3) — Falha de auth esperada logava `console.error` · ✅ corrigido

- `falha()` ganhou a marca `esperada`; `entrarComCodigo`/`entrarComEmail` marcam como
  esperada **somente** credencial inválida (`invalid_credentials` / "Invalid login
  credentials"). Esperada → `console.warn` em dev, **silêncio em produção**;
  inesperada (rede, RLS, config) → `console.error`, como antes (observabilidade intacta).
- `mensagemAmigavel()` aplica o mesmo rebaixamento quando recebe erro `esperada`.
- **A mensagem ao usuário não mudou** (o `Login.jsx` já mostrava texto fixo amigável).
- Teste: `tests/fix1-erros.test.mjs` (esperada não vai a `console.error`; inesperada vai).

### OBS-RC1-005 (P3) — Branch `ESCOLA_SUSPENSA` morto em `useSessao.js` · ✅ removido

- **Decisão: remover** (não implementar). Justificativa: `meuPerfil()` nunca lança
  `ESCOLA_SUSPENSA`; a suspensão já tem dono claro — a **RLS** (migration 0027) bloqueia
  o dado e o `App.jsx` explica a tela via `escolaOperacional(perfil.escola)`, que lê o
  `status` que `meuPerfil()` devolve. Implementar o lançamento criaria um SEGUNDO
  caminho para a mesma regra (duas fontes de verdade para suspensão), exatamente o tipo
  de duplicação que a auditoria sênior de 2026-06-28 mandou eliminar no motor de XP.
- Removidos o branch do catch e o campo `suspensa` do estado (nenhum consumidor existia
  — `App.jsx` desestrutura só `carregando, sessao, perfil, superAdmin, erro`).
- A suíte inteira (incl. `suspensao-db.test.mjs`) segue verde — o gate real não mudou.

### OBS-RC1-008 (P3/UX) — Contextos sem entrada em `mensagemAmigavel` · ✅ corrigido

- Adicionadas a `MENSAGENS` as três chaves usadas por `VinculosResponsavel.jsx`:
  `revogar`, `vincular responsável`, `carregar responsáveis`, com mensagens específicas.
  Fallback genérico preservado para contexto desconhecido (testado).
- Varredura completa dos contextos usados no app (`mensagemAmigavel(e, "...")`,
  `useEnvioUnico("...")` e `enviar(fn, "...")`): nenhum outro contexto órfão.

### OBS-RC1-006 (P3/Perf) — Bundle sem code-splitting · ✅ avaliado e INCLUÍDO

- **Avaliação:** o padrão `lazy()+Suspense` já existia no projeto (UX1,
  `VisaoEstudo.jsx`, para os módulos recharts) — estender o mesmo padrão para o
  roteamento por papel no `App.jsx` é mudança pequena, idiomática e reversível
  (risco baixo), então **entrou** no FIX1 em vez de ser adiada.
- **Implementação:** `AreaAluno`, `AreaEscola`, `AreaResponsavel`, `AreaAdmin` e
  `RedefinirSenha` viraram chunks próprios; `Login` continua eager (primeira tela).
  Fallback de Suspense reutiliza a mesma tela neutra "Preparando seu painel…".
- **Resultado medido:** chunk principal **711 kB → 434 kB** (gzip 196 → 124 kB);
  warning de chunk >500 kB **eliminado**; o aluno no celular não baixa mais o painel
  da coordenação nem o backoffice. Smoke confirmou que nenhum chunk de área é
  baixado antes do login.

## 4. Evidências

- **Testes:** 459/459 (antes) → **471/471** (depois; +7 RLS irmãos, +5 unitários erros).
  Ambiente: Postgres 16 local porta 54322, `reset-db.sh` (migrations + seed 2x).
- **Build:** verde, sem warning de tamanho de chunk. Áreas em chunks separados
  (`AreaAluno` 73 kB, `AreaEscola` 80 kB, `AreaAdmin` 55 kB, `AreaResponsavel` 3 kB).
- **Smoke manual (vite preview + Chromium, console aberto):** login renderiza; mensagem
  amigável na tela em falha de login; nenhum texto técnico visível ao usuário; nenhum
  chunk de área baixado antes do login. **Limite do ambiente:** sem rota de rede para o
  Supabase (`HTTP 000`, mesmo bloqueio registrado em OBS-RC1-007), então login real,
  seletor de irmãos ao vivo e fluxos com dado real ficam para a E2E no ambiente isolado
  (`e2e-guard` + secrets `E2E_SUPABASE_*`) ou smoke humano no deploy de preview.
- **Regressão nos 4 perfis:**
  - *Banco (RLS real):* suíte completa verde + 7 testes novos cobrindo responsável
    (multi-vínculo), aluno, coordenação e cross-tenant; superadmin coberto pela suíte
    ADM2 existente (nenhuma RPC/policy foi tocada).
  - *Front:* aluno/escola/admin não tiveram lógica alterada (só passaram a carregar
    lazy); responsável foi re-testado por render offline + testes de contrato.

## 5. Riscos e classificação

| Item | Sev. original | Risco residual da correção |
|---|---|---|
| OBS-RC1-004 | P2 | Baixo. Leitura do responsável coberta por 7 testes RLS; caso de 1 vínculo idêntico ao anterior. Resíduo conhecido (pré-existente): `useTrilha` retém a trilha anterior durante recarga — na troca entre irmãos de trilhas DIFERENTES pode haver métrica transitória (<1s) até a trilha nova chegar; irmãos na mesma trilha (caso comum) não são afetados. |
| OBS-RC1-003 | P3 | Baixo. Só nível de log; falha inesperada continua em `console.error`. |
| OBS-RC1-005 | P3 | Nulo. Código morto removido; gate real (RLS + `escolaOperacional`) intacto e testado. |
| OBS-RC1-008 | P3 | Nulo. Só textos novos + fallback preservado. |
| OBS-RC1-006 | P3 | Baixo. Chunk de área pode falhar ao carregar em rede ruim (mesmo risco já aceito na UX1 para os gráficos); fallback neutro cobre a espera. Deploy novo invalida hash de chunk antigo — sintoma seria erro de import dinâmico em aba aberta durante deploy (comportamento igual ao dos lazy existentes). |

**Não foram alterados:** RLS, policies, Auth, checks de papel, `escola_id`, Edge
Functions, migrations, seeds, `.env`, dados.

## 6. Pendências / itens adiados

- **E2E ao vivo do seletor de irmãos** — bloqueada pelo ambiente (OBS-RC1-007: sem rede
  para Supabase e Chromium 1194 ≠ 1228 esperado). Roda no `e2e-guard` com secrets
  `E2E_SUPABASE_*` ou smoke humano no preview do Vercel.
- **Docs de índice defasados** (341 vs 459 testes) — não atualizados aqui de propósito:
  `03-status-atual.md` é fotografia da fase SEG2 e reescrevê-lo está fora do escopo FIX1.
- Duplo log de falhas **inesperadas** (uma em `falha()`, outra em `mensagemAmigavel()`)
  — pré-existente, por design de observabilidade; fora de escopo.

## 7. Critérios de aceite

| Critério | Estado |
|---|---|
| Responsável com 2+ vínculos vê e escolhe todos os filhos | ✅ (query + UI + testes RLS) |
| Log LGPD por aluno consultado | ✅ (testado) |
| Falha de login esperada sem `console.error`; mensagem ao usuário intacta | ✅ (testado) |
| Branch morto removido com justificativa | ✅ |
| Contextos de `mensagemAmigavel` completos | ✅ (testado) |
| Bundle: decisão fundamentada | ✅ (incluído; −277 kB no chunk principal, warning eliminado) |
| Testes verdes + build verde + smoke | ✅ 471/471 · build ok · smoke offline ok |
| RLS/Auth/multi-tenant intocados | ✅ (diff não toca supabase/) |

## 8. Veredito

**FIX1 concluída** nos cinco itens de escopo, com duas passadas (a segunda pegou:
`RETURNING` indevido no teste de log LGPD — o app não usa; e `erro` residual na troca de
aluno no seletor). Smoke ao vivo com dado real fica como pendência explícita de
ambiente, não de código. Sem migration, sem mudança de RLS, sem novo P0/P1.
