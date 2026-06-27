# DB1-A — Inventário do Supabase

> Fase **DB1** (Consolidação, Auditoria e Higienização do Supabase).
> Branch: `claude/db1-supabase-consolidacao-xb6ewf` (a partir da `main`,
> com S1 já mergeada — PR #19).
> Data: 2026-06-21 · Projeto `bdjkgrzfzoamchdpobbl` (`us-east-1`, free).
> Levantamento **read-only** ao vivo via MCP. Nenhum dado real alterado.

## 1. Visão geral

- **44 tabelas base** em `public`, **todas com RLS ativa** (`relrowsecurity = true`).
- **2 views**: `vw_aluno_xp_total`, `vw_recorrencia_medida`.
- **2 escolas**: `vitrine` (Matriz Educação RM, 60 alunos, 4 turmas) e
  `beta` (Curso Beta Preparatório, 3 alunos, 2 turmas). Ambas em
  `status = implantacao`. **Não há escola real de produção ainda** — todo
  o dado atual é demo/vitrine + base de implantação.
- Schemas: `public` (API exposta) e `app` (helpers internos, não exposto).

## 2. Classificação das tabelas

Legenda de recomendação: **MANTER** (oficial/ativa) · **MANTER+INVESTIGAR**
(ativa mas com sobreposição arquitetural a esclarecer na DB2) ·
**DEPRECAR-DOC** (marcar como legado em docs, sem remover na DB1).

### 2.1 Núcleo atual — MANTER

| Tabela | escola_id | RLS | Linhas | No código | Recomendação |
|---|---|---|---|---|---|
| `escolas` | — (id) | ✅ | 2 | ✅ front+RPC | MANTER |
| `usuarios` | ✅ | ✅ | 65 | ✅ | MANTER |
| `turmas` | ✅ | ✅ | 6 | ✅ | MANTER |
| `alunos` | ✅ | ✅ | 63 | ✅ | MANTER |
| `alunos_turmas` | ✅ | ✅ | 63 | ✅ | MANTER |
| `vinculos_responsaveis` | ✅ | ✅ | 2 | ✅ | MANTER |
| `registros_estudo` | ✅ | ✅ | 455 | ✅ | MANTER |
| `simulados` | ✅ | ✅ | 54 | ✅ | MANTER |
| `consentimentos` (LGPD) | ✅ | ✅ | 19 | ✅ | MANTER |

### 2.2 Fase 15 oficial (conteúdo/pedagogia/gamificação) — MANTER

| Tabela | escola_id | RLS | Linhas | Observação |
|---|---|---|---|---|
| `concursos` | — | ✅ | 6 | catálogo global |
| `turmas_comerciais` | — | ✅ | 3 | catálogo |
| `turmas_comerciais_concursos` | — | ✅ | 5 | N:N turma↔exam |
| `config_oficial` | — | ✅ | 18 | config por exam_tag |
| `config_escola` | ✅ | ✅ | 1 | override por escola |
| `provas` | — | ✅ | 5 | estrutura de prova |
| `prova_dias` | — | ✅ | 7 | |
| `materias` | — | ✅ | 9 | |
| `prova_materias` | — | ✅ | 31 | |
| `assuntos` | — | ✅ | 11 | |
| `subassuntos` | — | ✅ | 22 | |
| `patentes` | — | ✅ | 8 | gamificação (catálogo) |
| `conquistas` | — | ✅ | 13 | gamificação (catálogo) |
| `aluno_conquistas` | ✅ | ✅ | 108 | **ativa** (XP de conquista) |
| `provas_anteriores` | — | ✅ | 1 | recorrência |
| `questoes_prova` | — | ✅ | 3 | recorrência |
| `recorrencia_assunto` | — | ✅ | 3 | recorrência |
| `trilha_planos` | — | ✅ | 12 | trilha por concurso (Fase 15) |
| `missoes` | — | ✅ | 8 | trilha por concurso |
| `trilha_plano_missoes` | — | ✅ | 3 | trilha por concurso |

### 2.3 Fase 15 — gamificação/níveis possivelmente SUPERSEDED — MANTER+INVESTIGAR

| Tabela | escola_id | RLS | Linhas | Observação |
|---|---|---|---|---|
| `aluno_xp_eventos` | ✅ | ✅ | **0** | XP migrou p/ `aluno_eventos_progresso` (C0). Front ainda referencia. |
| `aluno_niveis` | ✅ | ✅ | **0** | nível por aluno; vazia ao vivo. |
| `aluno_nivel_historico` | ✅ | ✅ | **0** | histórico de nível; vazia. |
| `aluno_onboarding` | ✅ | ✅ | **0** | onboarding; vazia. |
| `missoes_escola` | ✅ | ✅ | **0** | ativação de missões por escola; vazia. |

> Estão **vazias ao vivo** e o XP efetivo vem da família C0
> (`aluno_eventos_progresso` → `vw_aluno_xp_total`). O front ainda tem
> caminhos de leitura para elas. **Não remover na DB1** — provar caminho
> de escrita antes (DB2). Ver `06-legado-vs-atual.md`.

### 2.4 C0 / motor de progresso — MANTER (oficial atual)

| Tabela/View | escola_id | RLS | Linhas | Observação |
|---|---|---|---|---|
| `aluno_eventos_progresso` | ✅ | ✅ | 991 | **fonte de verdade de XP/progresso** |
| `vw_aluno_xp_total` (view) | ✅ | n/a | — | soma XP válido por aluno/exam_tag |

### 2.5 D0/S1 — backoffice/superadmin — MANTER

| Tabela | escola_id | RLS | Linhas | Observação |
|---|---|---|---|---|
| `internal_admins` | — | ✅ | 1 | super admins internos (gate `eh_super_admin`) |
| `admin_logs` | ✅ | ✅ | 0 | auditoria do backoffice (grava em produção; 0 = nada persistido fora de transações de teste) |

### 2.6 Logs / auditoria — MANTER

| Tabela | escola_id | RLS | Linhas |
|---|---|---|---|
| `logs_acesso` | ✅ | ✅ | 931 |
| `logs_coordenacao` | ✅ | ✅ | 96 |

### 2.7 Motor antigo (semanal) — legado AINDA USADO — MANTER (deprecar plano na DB2)

| Tabela | escola_id | RLS | Linhas | Evidência de uso |
|---|---|---|---|---|
| `trilhas` | — | ✅ | 1 | `app.semana_da_data`, front `useTrilha` |
| `trilha_semanas` | — | ✅ | 9 | `app.semana_da_data` |
| `atividades_modelo` | — | ✅ | 50 | FK de `meta_atividades`, `app.gerar_meta` |
| `disciplinas` | — | ✅ | 8 | front (display de trilha) |
| `metas` | ✅ | ✅ | 169 | **escrita ativa** por `app.gerar_meta`/`virar_semana`; front MetaSemana/MetaHero |
| `meta_atividades` | ✅ | ✅ | 851 | **escrita ativa**; trigger `trg_progresso_missao` |

> Estas tabelas estão **vivas e populadas**: o motor semanal
> (`gerar-meta`/`virar-semana`) escreve `metas`/`meta_atividades`, e a
> conclusão de atividade dispara progresso C0. **Não são legado morto.**
> Coexistem com a "trilha por concurso" da Fase 15 — sobreposição
> conceitual de duas noções de "trilha". Decisão de unificação fica para
> DB2 (ver `06-legado-vs-atual.md`).

## 3. Demo / vitrine

Não há **tabela** dedicada a demo: a vitrine é **dado** dentro das tabelas
de núcleo, escopado por `escola_id` da escola `vitrine`
(`11111111-…`). Reconstruível pelos seeds `13/14/15/16/17`. Detalhe em
`05-demo-vitrine.md`.

## 4. Cruzamento código × banco (resumo)

- **Tabelas referenciadas no front (`.from`)**: praticamente todas;
  RPCs do backoffice via `.rpc` (8: `sou_super_admin`, `resumo_escola`,
  `backoffice_*`).
- **Edge functions**: não tocam tabelas legado diretamente — operam via
  RPCs `SECURITY DEFINER` em `app`.
- **Seeds**: cobrem núcleo + Fase 15 + demo (01–17).
- **Testes**: 222 testes (lógicos + DB/RLS) cobrindo núcleo, motor,
  pedagogia, gamificação, isolamento, suspensão, backoffice, exam_tag.

## 5. Conclusão do inventário

Banco **coerente e compreensível**: tudo com RLS, multi-tenant por
`escola_id`, sem tabelas "fantasma" desconhecidas. Os únicos pontos de
atenção estrutural são (a) a coexistência motor-semanal × trilha-Fase-15
e (b) as tabelas de gamificação/níveis Fase 15 vazias possivelmente
superadas pelo C0 — ambos **documentados para DB2, sem remoção na DB1**.
