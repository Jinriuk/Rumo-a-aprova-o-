# Relatório Final — Fase R: Higienização de Branches

> Auditoria somente-leitura + criação não-destrutiva da `main`.
> **Nenhuma branch foi apagada. O default branch NÃO foi alterado.**
> Repositório: `Jinriuk/Rumo-a-aprova-o-` · Data: 2026-06-19.

## 1. Resumo executivo

- O repositório tem **6 branches remotas**. Destas, **4 já estão 100% mergeadas** na branch
  oficial e são seguras para excluir; **1 é a própria oficial** (consolida tudo); **1 tem
  commits únicos não incorporados** e precisa de revisão antes de qualquer exclusão.
- A branch oficial/default atual é **`claude/naval-system-build-g9h0t5`** (tip `fa04c53`),
  confirmada por HEAD remoto **e** pela configuração do GitHub (`default_branch`).
- **`main` foi criada** a partir do tip da oficial (cópia idêntica, `fa04c53`) — passo
  não-destrutivo e reversível. Ela já contém Fase 15, C0, C0.5 e **Bloco B** (tudo o que a
  oficial tem, pois PRs #7, #8 e #9 já foram mergeados).
- **CI e Vercel não quebram** com a padronização: o workflow não filtra por branch e o
  `vercel.json` não fixa branch. O único passo manual é trocar o *Production Branch* no
  painel da Vercel quando o default mudar para `main`.
- **Pendente de autorização explícita:** (a) trocar o default branch → `main`; (b) excluir as
  4 branches mergeadas; (c) decidir o destino da branch não-mergeada após revisão.

## 2. Branch oficial atual

| Verificação | Resultado |
|---|---|
| HEAD remoto (`git ls-remote --symref`) | `claude/naval-system-build-g9h0t5` |
| Default branch no GitHub (API) | `claude/naval-system-build-g9h0t5` |
| Tip da oficial | `fa04c53` (2026-06-19) |
| Permissão no repo | **admin** (permite trocar default e apagar branches via API) |
| Branch protegida? | Nenhuma branch protegida |
| Vercel | Conectado (`rumo-a-aprova-o.vercel.app`); produção segue o default branch |
| CI (`.github/workflows/ci.yml`) | Dispara em `push` / `pull_request` / `workflow_dispatch` — **sem filtro de branch** |

## 3. Branches encontradas (auditoria completa)

Comparação contra a oficial `claude/naval-system-build-g9h0t5` (`fa04c53`).
`ahead` = commits únicos da branch; `behind` = commits da oficial que faltam nela.

| Branch | Último commit | Data | Mergeada? | ahead/behind | Escopo provável | Recomendação |
|---|---|---|:--:|:--:|---|---|
| **`claude/naval-system-build-g9h0t5`** *(oficial/default)* | `fa04c53` | 2026-06-19 | — (é a base) | — | Build naval + Fase 15 + C0 + C0.5 + Bloco B (consolidado) | **Manter** (vira base do `main`) |
| **`main`** *(criada nesta fase)* | `fa04c53` | 2026-06-19 | = oficial | 0 / 0 | Cópia padronizada da oficial | **Manter** (nova principal) |
| `claude/phase-c0-5-audit-rebuild-2d53a5` | `dc1ac44` | 2026-06-19 | ✅ **MERGED** (PR #8/#9) | 0 / 3 | C0.5 + Bloco B + reorganização de `/docs` | **Deletar** (após OK) |
| `claude/infrastructure-scaling-study-naaef7` | `2437476` | 2026-06-16 | ✅ **MERGED** | 0 / 17 | Fase B-min — performance da coordenação | **Deletar** (após OK) |
| `claude/rumo-aprovacao-audit-ogf7s3` | `c2f8b97` | 2026-06-15 | ✅ **MERGED** | 0 / 34 | Auditoria multivisão + verificação técnica | **Deletar** (após OK) |
| `claude/phase-15-pedagogical-ya6vwz` | `2e1916c` | 2026-06-13 | ✅ **MERGED** | 0 / 46 | Fase 15.7 — recorrência real + tagueamento | **Deletar** (após OK) |
| `claude/demo-base-realista-auditoria-t5ji99` | `bbb4341` | 2026-06-19 | ❌ **não mergeada** | **8** / 36 | Motor C0 (já reconciliado na oficial) **+ refactors de frontend "auditoria 16.8"** | **Revisar** (não deletar) |

## 4. Status mergeado / não-mergeado

- **Mergeadas (ahead = 0)** — todo o conteúdo já está na oficial:
  `phase-c0-5-audit-rebuild-2d53a5`, `infrastructure-scaling-study-naaef7`,
  `rumo-aprovacao-audit-ogf7s3`, `phase-15-pedagogical-ya6vwz`.
- **Não-mergeada (ahead = 8)** — `demo-base-realista-auditoria-t5ji99`. Seus 8 commits únicos:
  - `dcc8fbd`, `90b8ba9`, `bbb4341` → **motor C0 + E2E** → **já reconciliados** na oficial
    (motor virou `0024_motor_progresso`; `app/e2e/motor-progresso.spec.js` **existe** na oficial).
  - `d58bd37`, `94ee2b5`, `42bef6a` → seed "Instituto Vitrine Militar" (Fase 16.8) →
    **superado** pelo `supabase/seed/13_vitrine_militar_demo.sql` (Bloco B).
  - `c07d6e8`, `b71201f` → **refactors de frontend "auditoria 16.8"** (escala p/ 300 alunos,
    centralização de métricas, ficha, responsável, tokens) em `app/src/modules/desempenho/*`,
    `motor/*`, `pessoas/ListaAlunos.jsx`, `routes/aluno/VisaoEstudo.jsx`. **Não há evidência
    direta de que tenham sido incorporados** — podem conter melhorias úteis ou já estarem
    superados pela evolução posterior da oficial. **Requer revisão humana.**

## 5. Branches seguras para excluir (somente após autorização)

| Branch | Justificativa |
|---|---|
| `claude/phase-c0-5-audit-rebuild-2d53a5` | ahead=0, mergeada (PR #8/#9). Sem commits exclusivos. |
| `claude/infrastructure-scaling-study-naaef7` | ahead=0, mergeada. |
| `claude/rumo-aprovacao-audit-ogf7s3` | ahead=0, mergeada. |
| `claude/phase-15-pedagogical-ya6vwz` | ahead=0, mergeada. |

> Todas têm o conteúdo preservado na oficial/`main`. Excluí-las não perde nada.
> **Não executado** — aguarda autorização explícita (regra 1, 8).

## 6. Branches a preservar

| Branch | Motivo |
|---|---|
| `claude/naval-system-build-g9h0t5` | Oficial/default atual; base do `main`. Não tocar até o default migrar e validar. |
| `main` | Nova branch principal (criada nesta fase). |
| `claude/demo-base-realista-auditoria-t5ji99` | Tem 8 commits únicos; parte já reconciliada, mas os refactors de frontend precisam de revisão (regra 2 — não apagar com commits únicos não incorporados). |

## 7. Plano para criar ou renomear `main`

**Feito nesta fase (não-destrutivo):**
1. ✅ `main` criada a partir de `claude/naval-system-build-g9h0t5` (`fa04c53`) — conteúdo idêntico,
   já inclui Fase 15, C0, C0.5 e Bloco B.

**Pendente (requer sua autorização — impacto em deploy/PRs):**
2. ⏳ **Trocar o default branch** do GitHub para `main`
   (Settings → Branches → Default branch → `main`). Reversível.
3. ⏳ **Vercel:** ajustar *Production Branch* para `main` (Settings → Git). Enquanto o default
   for a branch antiga, a produção continua saindo dela; ao migrar, a Vercel precisa apontar p/ `main`.
4. ⏳ Após validar produção em `main`, **excluir as 4 branches mergeadas** (Seção 5).
5. ⏳ **Revisar** `demo-base-realista-auditoria-t5ji99`; se os refactors de frontend não
   agregarem, então excluir; se agregarem, abrir PR para `main` antes.
6. ⏳ (Opcional) Excluir `claude/naval-system-build-g9h0t5` **somente** depois que `main` for o
   default e a produção estiver validada (regra 3).

> Optei por **criar `main`** (em vez de renomear a oficial) para não mexer no default/produção
> sem sua confirmação. Renomear via GitHub move o histórico e re-aponta PRs automaticamente,
> mas dispara a troca de produção na Vercel — por isso fica como passo autorizado, não automático.

## 8. Impacto em Vercel / GitHub Actions

- **GitHub Actions:** sem impacto. O `ci.yml` dispara em `push`/`pull_request`/`workflow_dispatch`
  sem `branches:` — roda igual em `main`. Nenhuma referência hardcoded a nome de branch.
- **Vercel:** `vercel.json` **não** fixa branch (só `buildCommand`/`outputDirectory`/`rewrites`).
  A produção segue o **default branch** do GitHub. Ação manual necessária ao migrar o default:
  confirmar *Production Branch = `main`* no painel. Previews de outras branches não são afetados.
- **Referências em docs:** menções a `claude/demo-base-realista-auditoria-t5ji99` e à branch da
  C0.5 aparecem em `docs/auditoria/14-…` e `docs/relatorios/RECONCILIACAO_MIGRATIONS_C0.md` —
  são **registro histórico factual** (de onde veio o motor C0). Recomendo **não reescrever**.
- **README / scripts / badges:** nenhuma referência a nome de branch encontrada.

## 9. Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Trocar default quebra produção na Vercel | Média | Ajustar Production Branch p/ `main` no mesmo momento; validar deploy antes de apagar a oficial. |
| Apagar branch com trabalho útil (demo-base) | Baixa (se seguir o plano) | Marcada como **revisar**; não excluir sem PR/decisão. |
| PRs abertos apontando para a oficial antiga | Baixa | Não há PRs abertos (open_issues/PR = 0). |
| Perda de histórico | Nenhuma | `main` == oficial; branches mergeadas preservadas no histórico do `main`. |
| Force push | N/A | Não usado; nenhuma reescrita de histórico. |

## 10. Próximos passos (aguardando autorização)

1. **Autorizar troca de default** GitHub → `main` (eu não altero default sem seu OK — regra 6).
2. **Você** ajusta *Production Branch* na Vercel para `main` e valida o deploy.
3. **Autorizar exclusão** das 4 branches mergeadas (Seção 5) — faço via API após seu OK.
4. **Decidir** sobre `demo-base-realista-auditoria-t5ji99` (revisar refactors 16.8 → PR ou descartar).
5. Por último, **autorizar exclusão** de `claude/naval-system-build-g9h0t5` depois que `main` for
   o default e a produção estiver validada.

---

### Critérios de aceite — situação

- [x] Todas as branches auditadas (6/6).
- [x] Branch oficial confirmada (HEAD + GitHub default).
- [x] `main` existe (criada a partir da oficial, conteúdo idêntico).
- [x] Nenhum commit útil perdido (nada apagado; não-mergeada preservada).
- [x] Deploy/CI não quebrados (sem alteração de default; sem mexer na Vercel).
- [x] Relatório final gerado.
- [x] Limpeza destrutiva **não** executada (aguarda autorização).
