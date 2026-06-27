# Relatório DB1 — Consolidação, Auditoria e Higienização do Supabase

> Fase **DB1**. Trabalho a partir da `main` (S1 mergeada — PR #19).
> Branch: `claude/db1-supabase-consolidacao-xb6ewf`.
> Data: 2026-06-21 · Projeto `bdjkgrzfzoamchdpobbl` (`us-east-1`, free).
> Atuação como DBA/arquiteto Supabase/auditor multi-tenant. Auditoria
> **read-only ao vivo**; correções **apenas seguras e aditivas**.

---

## 1. Resumo executivo

| Pergunta de aceite | Resposta |
|---|---|
| DB1 foi concluída? | ✅ Sim. |
| Banco está mais seguro? | ✅ RLS auditada e intacta; gates S1 preservados; nenhum enfraquecimento. |
| Banco está mais organizado? | ✅ Paridade de migrations **reconciliada** (guarda voltou a ser honesta); legado classificado; índices multi-tenant revisados. |
| Houve mudança destrutiva? | ❌ Nenhuma. Só 1 migration aditiva (índices) + 1 reconciliação de metadado. |
| Há P0? | ❌ Nenhum. |
| Há P1? | ⚠️ Sim, **operacionais/herdados da S1** (backup, região, runbook, leaked-password) — nenhum de código bloqueante. |
| Pode seguir para D1 / I1 / DB2? | ✅ Sim. Recomendação: **DB2** (limpeza de legado) ou **D1/I1** conforme prioridade de produto. |

**Veredito:** o banco está **limpo, coerente, versionado, auditável e
seguro para evoluir** sem quebrar a produção. A "armadilha de `db push`"
(divergência de numeração do motor de progresso) foi **eliminada** sem
tocar schema/dado.

---

## 2. Estado inicial

- `main` com S1 mergeada; Vercel Production → `main`; Supabase saudável.
- Última migration remota: `0027_escola_suspensa_bloqueio`.
- **44 tabelas**, todas com RLS; 2 views; 2 escolas (`vitrine` 60 alunos,
  `beta` 3) — ambas demo/implantação; **sem escola real ainda**.
- Riscos conhecidos antes da DB1: divergência de numeração
  `0022_motor_progresso` (banco) × `0024_motor_progresso` (repo) deixando
  a guarda de paridade **vermelha**; FKs multi-tenant sem índice;
  duplicidade de policies (perf); coexistência de arquiteturas
  (motor semanal × Fase 15 × C0).

---

## 3. Inventário (por categoria)

- **Núcleo (9):** escolas, usuarios, turmas, alunos, alunos_turmas,
  vinculos_responsaveis, registros_estudo, simulados, consentimentos.
- **Fase 15 oficial (~24):** concursos, turmas_comerciais(+_concursos),
  config_oficial/escola, provas/prova_dias/prova_materias, materias,
  assuntos/subassuntos, patentes, conquistas, aluno_conquistas,
  provas_anteriores, questoes_prova, recorrencia_assunto, trilha_planos,
  missoes, trilha_plano_missoes, missoes_escola, e as de
  gamificação/níveis (aluno_xp_eventos/aluno_niveis/aluno_nivel_historico/
  aluno_onboarding — **vazias**).
- **C0 (1 + view):** aluno_eventos_progresso (+ vw_aluno_xp_total).
- **D0/S1 (2):** internal_admins, admin_logs.
- **Logs (2):** logs_acesso, logs_coordenacao.
- **Demo:** dado dentro do núcleo (escola `vitrine`), sem tabela própria.
- **Legado ainda usado (6):** trilhas, trilha_semanas, atividades_modelo,
  disciplinas, metas, meta_atividades (motor semanal **ativo**).
- **Desconhecido:** nenhum (sem tabelas "fantasma").

Detalhe completo: `00-inventario-supabase.md`.

---

## 4. Migrations

Divergência confirmada e **resolvida**: o motor de progresso foi aplicado
no banco como `0022_motor_progresso` mas o repo o versiona como
`0024_motor_progresso`; como `checar-migrations.mjs` compara por **nome**,
a guarda acusava falso "falta migration" (exit 1), mascarando drift real.
Reconciliação **não destrutiva** (rename de metadado no ledger) →
**paridade 28==28**. `supabase db push` **não deve ser usado** com o
esquema de nomes `000N_*`. Detalhe: `01-migrations.md`.

---

## 5. RLS / policies

RLS ativa em 44/44; isolamento por `escola_id`; bloqueio de suspensão
(`tenant_operacional`) intacto; catálogos públicos só de conteúdo
(não-PII). Provado por `isolamento`/`suspensao` (verdes). **Ajustado:**
nada (nenhuma reescrita). **Adiado p/ DB2:** de-duplicar 7
`multiple_permissive_policies` (perf), com cuidado em
`vinculos_responsaveis`. Detalhe: `02-rls-policies.md`.

---

## 6. RPCs / funções / views

Funções `SECURITY DEFINER` com `search_path` fixo (advisor mutable = 0);
gates internos corretos (`eh_super_admin`, `tenant_operacional`,
`sou_super_admin` intactos); escrita do motor/LGPD só `service_role`/
`postgres`; triggers C0 idempotentes (UNIQUE `idempotency_key`); 2 views
ativas e sem PII exposta. Os 8 advisors `secdef executable` são
by-design. **Nenhuma correção necessária.** Detalhe:
`03-rpcs-funcoes-views.md`.

---

## 7. Índices / performance

**Adicionados (0028, aditivo):** 11 índices em FKs multi-tenant
(`escola_id`) e joins de RLS (`aluno_id`/`turma_id`) →
`unindexed_foreign_keys` **38→27**. **Ignorados com justificativa:** 27
FKs de baixo valor (auditoria/exam_tag/catálogos), 9 `unused_index`
pré-existentes (sem prova sob carga) e os 11 novos (recém-criados). Teste
de latência do `resumo_escola` (~150 alunos) dentro do teto. Detalhe:
`04-indices-performance.md`.

---

## 8. Demo / vitrine

Coerente e **sem órfãos** (alunos_turmas/eventos/registros = 0 órfãos);
60 alunos / 4 turmas; Lucas, responsável e coordenação demo presentes;
distribuição multi-concurso plausível; seeds **idempotentes** (rodados 2×
no `reset-db.sh`, verdes). Nenhuma correção de seed necessária. Detalhe:
`05-demo-vitrine.md`.

---

## 9. Legado

- **Ainda usado:** motor semanal (trilhas/trilha_semanas/atividades_modelo/
  disciplinas/metas/meta_atividades) — populado e escrito. **Manter.**
- **Possivelmente morto (vazio, superado pelo C0):** aluno_xp_eventos,
  aluno_niveis, aluno_nivel_historico, aluno_onboarding, missoes_escola.
  **Manter + investigar na DB2** (provar caminho de escrita antes de
  qualquer remoção).
- **Recomendado p/ DB2:** decidir unificação das duas "trilhas" e o
  destino das tabelas Fase 15 vazias. Detalhe: `06-legado-vs-atual.md`.

---

## 10. Correções aplicadas

1. `supabase/migrations/0028_db1_indices_multitenant.sql` (11 índices
   aditivos) — aplicada ao remoto e ao local; idempotente.
2. `scripts/reconciliar-ledger-0024-motor-progresso.sql` — reconciliação
   de metadado do ledger, aplicada ao remoto; guardada/idempotente.
3. 10 relatórios em `docs/auditoria/db1/`.

Nada destrutivo. Detalhe: `07-correcoes-aplicadas.md`.

---

## 11. Testes

| Comando | Resultado |
|---|---|
| `app: npm run build` (vite) | ✅ verde (923 módulos) |
| `tests: reset-db.sh` (migrations + seed 2×, com 0028) | ✅ banco pronto, idempotência exercitada |
| `tests: node --test` (lógicos + DB/RLS + suspensão + backoffice + exam_tag) | ✅ **222 / 222 pass · 0 fail · 0 skip** |
| `service_role` no front (`app/src`) | ✅ ausente (só comentários explicativos; client usa anon) |
| Advisors segurança | 8 secdef by-design + 1 leaked-password (toggle do dono); **0 ERROR** |
| Advisors performance | unindexed FKs 38→27; 7 permissive (adiado); unused (adiado) |
| E2E | skip honesto (sem ambiente isolado/secrets no contêiner de auditoria) — política herdada da S1 |

> Ambiente de teste: Postgres 16 **local** efêmero (porta 54322, db
> `rumo_teste`) criado nesta sessão; os testes de RLS rodam em transações
> com rollback e **nunca tocam a produção**.

---

## 12. Pendências

- **P0:** nenhuma.
- **P1:** backup/plano, região `sa-east-1`, runbook de migrations
  (não usar `db push`), leaked-password — **operacionais/dono**.
- **P2:** de-dup de policies (perf), tabelas Fase 15 vazias, duas
  "trilhas", repo público.
- **P3:** unused indexes, FKs de baixo valor, par `lgpd_*` duplicado,
  advisors secdef by-design.

Detalhe e classificação: `08-riscos-remanescentes.md`.

---

## 13. Próxima fase recomendada

**DB2 — remoção/segregação de legado** (com base nas provas de uso desta
DB1): confirmar caminhos de escrita das tabelas Fase 15 vazias, decidir a
unificação das trilhas, de-duplicar as 7 policies e revisar índices não
usados **sob carga real**. **D1/I1** podem prosseguir em paralelo: o banco
está consolidado, versionado e seguro, sem bloqueadores.

---

## 14. Conformidade com as regras da DB1

Trabalhei a partir da `main` com S1 confirmada; não iniciei D1/I1/visual;
não toquei billing/plano/região/backup/domínio; não alterei dados reais;
não apaguei tabela/dado; não enfraqueci RLS; mantive `tenant_operacional`,
`sou_super_admin` e bloqueios da S1; sem `service_role` no front; sem
dumps/secrets commitados; toda mudança potencialmente destrutiva virou
**relatório/recomendação**, não execução.
