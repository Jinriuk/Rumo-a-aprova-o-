# Bloco B — Rebuild da Base Demo / Vitrine Militar — Relatório Final

> **Status:** ✅ **CONCLUÍDO** e aplicado no Supabase remoto (`bdjkgrzfzoamchdpobbl`).
> Data: 2026-06-19. Escopo: **somente** a escola de vitrine
> (`11111111-1111-4111-8111-111111111111`). Lucas Demo **preservado**.
> Artefato: `supabase/seed/13_vitrine_militar_demo.sql` (idempotente, 1 sessão).

## 1. Escola de vitrine

- **Escola:** Vitrine (`11111111-1111-4111-8111-111111111111`) — reaproveitada (não recriada).
- **Coordenação:** `coordenacao@vitrine.demo` / `vitrine-coord-2026` (já existia, preservada).
- **Trilha base dos alunos:** CN v1 (`b1388388-c660-4b4b-811c-b58358689e92`) — todos os
  alunos ligados a ela; o **alvo real** de cada um é o `concurso` (exam_tag).

## 2. Turmas (5) e distribuição

| Turma | exam_tags | Alunos |
|---|---|--:|
| CN/EPCAR — Manhã | cn (9), epcar (7) | 16 |
| CN/EPCAR — Tarde | cn (9), epcar (6) | 15 |
| EsSA/EEAr 2026 | esa (7), eear (6) | 13 |
| EsPCEx 2026 | espcex (14) | 14 |
| Turma CN 2026 | cn (2 — Lucas + Aline) | 2 |
| **Total** | | **60** |

Cada aluno está ligado ao **exam_tag correto** (concurso) — 0 alunos sem concurso,
0 sem turma, 0 sem conta.

## 3. Alunos e credenciais

- **60 alunos** no total (1 Lucas + 21 existentes + 38 novos fictícios).
- **Removido:** "Gabriel Silva" (aluno órfão sem concurso/exam_tag).
- **100% com conta de acesso** (`usuarios` + `auth.users` + `auth.identities`).
- **Padrão de login (código):** `VITRINE0NN` → e-mail `vitrineNNN@codigo.acesso.local`,
  senha = o próprio código. Ex.: aluno 023 = **`VITRINE023`**; aluno 002 = **`VITRINE002`**.
  (NN = sufixo do id do aluno: 002…060.) Hash bcrypt validado em amostra (023 e 002 → OK).
- **Dados 100% fictícios** — nenhum dado pessoal real.

### Ajuste de coordenação documentado
- **Manuela Castro e Silva** (`a0000000-…-022`): estava com exam_tag `cm` mas matriculada
  na turma **EsPCEx**. Vínculo corrigido para `espcex` (coerência turma × concurso).
  Marcado como `ajuste_coordenacao` neste relatório (eventos C0 antigos mantêm a tag anterior).
- **Alice Fernandes Quintanilha** (`a0000000-…-020`): estava **sem turma** → matriculada em EsPCEx 2026.

## 4. Progresso gerado pelo MOTOR C0 (não XP manual)

Todo XP/patente/conquista nasceu dos **gatilhos do ledger** `aluno_eventos_progresso`,
a partir de ações reais inseridas (registros_estudo, meta_atividades concluídas, simulados).
Nenhum `insert` manual de evento/XP. `app.backfill_progresso` retornou **0** (os gatilhos
já cobriram tudo na inserção — prova de que o motor está ativo e idempotente).

- **Eventos de progresso na vitrine:** 859 (ledger).
- **Conquistas distintas desbloqueadas:** 3 (primeiro_registro, primeira_missão, primeiro_simulado).

### Perfis variados (alunos novos)

| Perfil | Alunos | Registros | Metas/atividades | Simulados | XP (motor) |
|---|--:|---|---|--:|--:|
| **FORTE** | 9 | ~12 recentes | S1+S2 100% + S3 3/6 | 2 | **1260** |
| **MEDIANO** | 15 | ~7 | S1 3/5 + S2 3/4 | 1 | **610** |
| **EM RISCO** | 8 | ~3 (defasados >10d) | S2 fechada 1/4 (resto atrasado) | 0 | **100** |
| **SEM ATIVIDADE** | 6 | 0 | S3 plano lançado, 0 entregue | 0 | **0** |

- **Lucas Demo** continua **no topo do ranking** (1400 XP) — âncora da demo preservada.
- Os 21 alunos existentes mantiveram seu progresso histórico (não recalculado).

## 5. Utilidade para a demo (ranking / alertas / ficha)

- **Ranking:** espectro de 0 → 1400 XP, com empates realistas por perfil e Lucas liderando.
- **Alerta "sem atividade":** **6 alunos** com 0 evento (perfil SEM).
- **Alerta "missão atrasada":** alunos com meta de semana **fechada** e atividades ainda
  **pendentes** (perfis RISCO e MEDIANO parciais) — base farta para a coordenação.
- **Ficha do aluno:** cada perfil tem histórico coerente (constância, missões, simulados,
  conquistas e XP do ledger) para abrir em apresentação.

## 6. Validação executada

| Verificação | Resultado |
|---|---|
| Total de alunos na vitrine | 60 |
| Alunos com conta de acesso | 60 / 60 |
| Alunos sem concurso (exam_tag) | 0 |
| Matrículas em turma | 60 / 60 |
| Credencial bcrypt (amostra 023 e 002) | válida |
| Eventos do motor C0 | 859 |
| `backfill_progresso` (idempotência) | 0 novos (gatilhos cobriram) |
| Conquistas distintas | 3 |
| Sem atividade / Missão atrasada | presentes (6 / muitos) |
| `get_advisors(security)` | **sem regressão** (warnings pré-existentes) |

## 7. Regras do Bloco B — cumpridas

- ✅ Dados fictícios; nenhum dado pessoal real.
- ✅ RLS intacta (nenhuma policy alterada; advisor sem regressão).
- ✅ Sem `service_role` no front (seed roda no banco, não no cliente).
- ✅ Demo **não** hardcodada como regra permanente (é seed de demo, escopo na vitrine).
- ✅ XP veio do **motor C0** (gatilhos), não de XP fake manual.
- ✅ Único ajuste manual (Manuela cm→espcex) marcado e documentado.

## 8. Pendências / observações

- Datas do seed seguem o calendário fictício de 2026 usado pelos seeds existentes
  (S1 30/05→07/06, S2 08/06→14/06, S3 15/06→21/06) para consistência da base.
- Reset/re-seed: o script é idempotente; reexecutar não duplica (ids fixos + idempotency_key).
- **Demo-ready:** ✅ a base está pronta para apresentação (login de aluno, ranking,
  alertas e ficha com dados coerentes).
