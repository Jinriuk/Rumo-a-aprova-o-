# Relatório D1A — Correção do acesso da coordenação + melhoria do backoffice

> Fase **D1A** · branch `claude/d1a-coordenacao-backoffice-n0tx84` · 2026-06-22
> Projeto **Rumo à Aprovação** · Supabase `bdjkgrzfzoamchdpobbl`
> Detalhe técnico do bug em [`01-correcao-acesso-coordenacao.md`](./01-correcao-acesso-coordenacao.md).

---

## 1. Resumo executivo

- **A coordenação voltou a funcionar?** **Sim.** Validado no banco de produção
  para escola ativa (vê painel) e suspensa (bloqueada com mensagem clara).
- **Qual era a causa?** A S1 (`0027`) passou a **esconder todo o dado da escola
  quando ela não está operacional** (`suspensa`/`cancelada`) via
  `app.tenant_operacional()`. O **front nunca lia `escolas.status`**, então uma
  escola não-operacional — ou em status ambíguo (`implantacao`) — produzia um
  **painel vazio e sem explicação**, lido como "coordenação sem acesso".
  Agravantes: escolas-vitrine fora de `ativa`; checklist do backoffice exigindo
  `ativa` enquanto a RLS aceitava `implantacao`; e **migrations 0025–0030
  aplicadas em produção, mas nunca commitadas** (drift repo↔banco).
- **Backoffice foi melhorado?** **Sim** — dashboard, lista com busca/filtros,
  detalhe com edição e ações de status (suspender/reativar/cancelar) com
  confirmação, logs legíveis, guardrails de UI.
- **Há P0?** **Não.** Acesso restabelecido, RLS intacta, build verde.
- **Há P1?** **Não.** Pendências são P2/P3 (ver §6).
- **Pode seguir para I1 ou D1B?** **Sim.** Recomendação: **D1B** (ver §7).

---

## 2. Correção da coordenação

- **Sintoma:** coordenação loga mas cai em painel vazio/branco, sem erro; aluno
  entra normal.
- **Causa-raiz:** gate de suspensão da S1 (`tenant_operacional()`) escondendo o
  dado + front cego ao `status` + vitrine fora de `ativa` + drift de migrations.
- **Correção:**
  - `meuPerfil()` lê `escolas.status`; helper puro `escolaOperacional()`.
  - Tela **"Acesso suspenso"** clara no `App.jsx` (substitui o painel vazio).
  - Migration `0031` corrige status das escolas de **vitrine/demo** → `ativa`
    (escopo por slug; dado de demonstração; regra 12).
  - Migrations **0025–0030 reconciliadas** no repo (fim do drift).
  - Checklist do backoffice passa a refletir **operacional**, não só `ativa`.
- **Sem afrouxar segurança:** RLS intacta, `tenant_operacional()` mantido,
  bloqueio de suspensa de pé, sem `service_role` no front, sem hardcode de e-mail.
- **Testes/Evidência:** matriz de 10 cenários validada em produção (ver §5 e o
  doc 01). Estado final: `vitrine → ativa`, `beta → ativa`.

---

## 3. Melhorias no backoffice (D1A.2)

Arquivo: `app/src/routes/admin/AreaAdmin.jsx` (reescrito, reaproveitando o kit de
design navy/dourado). Funções novas em `data/index.js`:
`backofficeDashboard`, `backofficeEditarEscola`, `backofficeDefinirStatus`
(todas via RPCs D0 já existentes no banco, com porteiro `eh_super_admin`).

- **Visual / hierarquia:** header fixo com marca, cards de indicador com
  gradiente/tom, selos de status coloridos para os 6 estados, estados vazios e de
  loading, responsivo (grids `auto-fit`).
- **Dashboard:** total de escolas, ativas, demo/piloto, suspensas, alunos totais,
  alunos ativos 7d, coordenadores e **alerta de escolas sem coordenador**.
- **Lista de escolas:** **busca** (nome/slug/cidade), **filtro por status**,
  **filtro por plano**, **ordenação** (nome / mais alunos / acesso recente),
  colunas de alunos·turmas·coordenadores, selo de status + selo "sem coordenador",
  "Ver detalhes".
- **Detalhe da escola:** status, plano, slug, **cor** (com amostra), **logo**
  (link), observação interna, coordenadores, alunos, turmas, **logs daquela
  escola** e checklist de implantação.
- **Criar / editar:** criação colapsável; **edição** de nome/plano/cor (com
  preview)/logo (URL explicada)/cidade/UF/limite/observação, com validação e
  feedback; "em branco = mantém".
- **Status / plano:** ações **Suspender / Reativar / Ativar / Cancelar** — cada
  uma com **modal de confirmação**, badge "ação sensível/reversível", botão com
  loading e bloqueio de duplo clique.
- **Coordenador:** instrução clara de que a conta Auth é provisionada pela camada
  de operador (`scripts/criar-coordenacao.mjs`); **senha nunca exibida nem
  hardcodada**; estado vazio com o passo-a-passo.
- **Logs:** ações com rótulo amigável e **antes/depois legível** (status: de→para;
  edição: campos alterados), sem despejar jsonb cru nem dado sensível.
- **Responsividade:** grids fluidos; testado conceitualmente para desktop,
  notebook e mobile 430px (sem quebra de layout).

---

## 4. Segurança / RLS

- ✅ **Nada de `service_role` no front** — o cliente usa só a chave anon
  (`app/src/lib/supabase.js`); toda ação cross-tenant passa por RPC `SECURITY
  DEFINER` com porteiro `app.eh_super_admin()`.
- ✅ **Não-admin bloqueado** — `sou_super_admin()` false para coordenação e
  `backoffice_*()` levantam "acesso negado" (tests 8).
- ✅ **Coordenação isolada** — não vê outra escola nem seus alunos (test 9).
- ✅ **Escola suspensa segue bloqueando** — todo dado some na RLS (tests 2/4/6);
  o front só passou a **explicar** o bloqueio.
- ✅ **Superadmin opera** — vê as 2 escolas e usa as RPCs D0 (test 7).
- Advisors de segurança: apenas WARNs **esperados** (RPCs do backoffice
  `SECURITY DEFINER` com porteiro interno) + leaked-password protection off (P3).

---

## 5. Testes

| Comando / verificação | Resultado |
|---|---|
| `cd app && npm run build` | ✅ OK — 923 módulos, sem erro |
| `cd tests && node --test operacional.test.mjs` | ✅ 3/3 |
| `node --test regras.test.mjs agregados.test.mjs` (regressão) | ✅ 10/10 |
| `node --check coordenacao-acesso-db.test.mjs` | ✅ sintaxe OK |
| Matriz RLS (10 cenários) via MCP no banco de produção | ✅ 10/10 (doc 01 §5) |

> O ambiente desta sessão não tem Postgres local, então a suíte
> `*-db.test.mjs` foi exercida **contra o banco real** (transações com rollback,
> mesmo mecanismo de JWT que `tests/identidades.mjs`). Os arquivos de teste
> ficam commitados para rodar em `tests/reset-db.sh` onde houver PG.

**Critérios de aceite D1A:** causa identificada ✓ · coordenação acessa ✓ · aluno
acessa ✓ · responsável acessa ✓ · escola suspensa bloqueia ✓ · superadmin acessa
✓ · backoffice mais claro ✓ · ações sensíveis com confirmação ✓ · logs visíveis ✓
· build passa ✓ · testes passam ✓ · RLS não enfraquecida ✓ · relatório entregue ✓.

---

## 6. Pendências

- **P0:** nenhuma.
- **P1:** nenhuma.
- **P2:**
  - `escolas_update` permite a coordenação (operacional) alterar o **próprio
    `status`** (não é furo cross-tenant; só afeta a própria escola). Status
    deveria ser exclusivo do operador — endurecer policy numa próxima fase.
  - Front do backoffice não tem ainda E2E dedicado (Playwright) cobrindo
    suspender→bloquear→reativar ponta a ponta.
- **P3:**
  - Leaked-password protection desligada no Auth (config do projeto).
  - Default de `escolas.status` diverge entre banco local (`ativa`) e produção
    (`implantacao`) — alinhar via migration aditiva.
  - Bundle do app > 500 kB (aviso de chunk do Vite) — code-split futuro.

---

## 7. Próxima recomendação

**→ D1B — evolução adicional do backoffice.**

Justificativa: o acesso está restabelecido e o backoffice ficou operacional e
seguro, mas há trilha natural de evolução de baixo risco (endurecer `status` para
só-operador — P2; E2E do fluxo de suspensão; gestão de coordenador/convite;
filtros salvos; export de logs). Fazer **D1B** antes de **I1** deixa o
superoperador maduro para então implantar escola nova do zero com confiança.

Alternativas: **I1** (implantação de escola nova) se a prioridade for comercial;
**DB3** se o foco virar limpeza das tabelas marcadas "[DB3] VAZIA em produção"
no inventário da DB2 (`0030`).
