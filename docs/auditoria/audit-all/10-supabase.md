# Auditoria Supabase

> Projeto: `bdjkgrzfzoamchdpobbl` · região **`us-east-1`** · Postgres **17.6** · status ACTIVE_HEALTHY.
> Somente-leitura. Nada aplicado/alterado.

## 9.1 Migrations

**Remoto (`schema_migrations`) — 24 aplicadas:**
`0001`–`0007`, `0016_painel_agregado`, `0008`–`0015`, `0017`, `0018`, `0019`, `0020`, `0021`, **`0022_motor_progresso`**, **`0022_logs_coordenacao`**, `0023_indices_escala_coordenacao`, `0025_backoffice_d0`.

**Repo (`supabase/migrations/`) — 25 arquivos:** `0001`…`0025` em ordem crescente, com `0024_motor_progresso.sql`.

| Divergência | Detalhe | Severidade |
|---|---|---|
| **Dois `0022`** no remoto | `0022_motor_progresso` **e** `0022_logs_coordenacao` | P2 |
| **`0024` ausente no remoto** | o motor está como `0022_motor_progresso`; o repo numera `0024_motor_progresso` (body idêntico, idempotente) | P2 |
| `0016` aplicado fora de ordem | aplicado antes de `0008`–`0015` (timestamp) — cosmético, sem efeito | P3 |
| `0023`/`0022_logs` aplicados na C0.5 | confirmado por dados vivos (logs_coordenacao=88, índices presentes) | — |

**Armadilha operacional:** um `supabase db push` veria `0024_motor_progresso.sql` (repo) como não-aplicado (não há linha `0024` no remoto) e tentaria rodá-lo. O body é idempotente (`create … if not exists`), então tende a ser no-op de schema — **mas não se deve depender disso**. Recomendação (DB1, **não executar agora**): alinhar o rótulo no `schema_migrations` (registrar `0024` como aplicado / marcar o motor) de forma controlada. **Não reaplicar o motor.**

## 9.2 Tabelas (classificação)

| Categoria | Tabelas (linhas) |
|---|---|
| **Núcleo atual** | `escolas`(2), `usuarios`(65), `turmas`(7), `alunos`(63), `alunos_turmas`(63), `vinculos_responsaveis`(2), `consentimentos`(19), `registros_estudo`(455), `metas`(169), `meta_atividades`(851), `simulados`(54) |
| **Fase 15** | `concursos`(6), `provas`(5), `prova_dias`(7), `prova_materias`(31), `materias`(9), `assuntos`(11), `subassuntos`(22), `config_oficial`(18), `config_escola`(1), `trilhas`(1), `trilha_semanas`(9), `trilha_planos`(12), `trilha_plano_missoes`(3), `missoes`(8), `patentes`(8), `conquistas`(13), `aluno_conquistas`(108), `recorrencia_assunto`(3), `provas_anteriores`(1), `questoes_prova`(3), `atividades_modelo`(50), `disciplinas`(8), `turmas_comerciais`(3), `turmas_comerciais_concursos`(5) |
| **C0 (motor)** | `aluno_eventos_progresso`(964) + view `vw_aluno_xp_total` |
| **Fase 15 dormente / legado-vivo** | `aluno_niveis`(0), `aluno_nivel_historico`(0), `aluno_onboarding`(0), `aluno_xp_eventos`(0), `missoes_escola`(0) |
| **D0 / backoffice** | `internal_admins`(1), `admin_logs`(0), `escolas` (colunas D0) |
| **Logs / auditoria** | `logs_acesso`(915), `logs_coordenacao`(88), `admin_logs`(0) |
| **Risco de duplicidade / fonte ambígua** | `aluno_xp_eventos`(15.5, vazia) **vs** `aluno_eventos_progresso`(C0, fonte real) — duas “fontes de XP”, uma morta |

Todas as tabelas públicas têm **RLS habilitada** (`rls_enabled = true`).

## 9.3 RLS

- **0 advisor de segurança de nível ERROR** (nenhum `rls_disabled`/`policy_exists_rls_disabled`). RLS ativa em todas as tabelas públicas.
- Isolamento por escola coberto por `isolamento.test.mjs` (job de unitários verde no CI #112). Super_admin **não** lê tabelas tenant direto (sem `escola_id` no token) — só via RPC com porteiro (afirmado pelo relatório D0 e coerente com o modelo).
- **Advisor de performance — `multiple_permissive_policies` (WARN, 7 tabelas):** `aluno_conquistas`, `aluno_niveis`, `aluno_onboarding`, `aluno_xp_eventos`, `config_escola`, `missoes_escola`, `vinculos_responsaveis` têm **duas policies permissivas** para `authenticated`/`SELECT` (`*_coordenacao` + `*_select`). Não é furo de segurança — é custo de avaliação por linha. Endurecer em DB1.
- Papéis: aluno/responsável/coordenação isolados por tenant; `anon` revogado das RPCs sensíveis (migrations 0018/0020/0025); `authenticated` sem perfil cai nos gates.

## 9.4 RPCs

| RPC | Classe | SECURITY DEFINER | Observação |
|---|---|---|---|
| `resumo_escola()` | coordenação | sim | matriz RLS no WHERE; **advisor: executável por `authenticated`** |
| `sou_super_admin()` | superadmin | sim | gate; **advisor: executável por `authenticated`** (é o esperado — todo mundo pode perguntar “sou admin?”) |
| `backoffice_dashboard/escolas/detalhe_escola/criar_escola/editar_escola/definir_status` | superadmin | sim | porteiro `eh_super_admin`; **advisor: executáveis por `authenticated`** (autogated, mas advisor pede revogar EXECUTE) |
| `app.registrar_super_admin(email,nome)` | superadmin | sim | só `service_role` |
| `app.backfill_progresso(escola)` | servidor | sim | idempotente |
| `app.xp_por_prioridade`, `app.xp_simulado` | regra Fase 15 | — | **advisor: `search_path` mutável (WARN)** — contraria a doutrina “search_path fixo” |

**8 funções** marcadas pelo advisor como `authenticated_security_definer_function_executable` (WARN): as 6 `backoffice_*` + `resumo_escola` + `sou_super_admin`. Todas se autoprotegem por gate interno, mas o endurecimento recomendado (revogar `EXECUTE` de quem não deve) é item de **S1**.

## 9.5 Edge Functions

| Função | Status | `verify_jwt` | Papel |
|---|---|:--:|---|
| `provisionar-aluno` | ACTIVE | ✅ true | coordenação cria credencial |
| `gerar-meta` | ACTIVE | ✅ true | gera meta (idempotente) |
| `virar-semana` | ACTIVE | ❌ **false** | virada agendada (pg_cron) — sem JWT por design do agendador |
| `lgpd-titular` | ACTIVE | ✅ true | export/exclusão LGPD |
| `backoffice-coordenador` | ACTIVE | ✅ true | D0 — cria coordenação (service_role só aqui) |

- `virar-semana` com `verify_jwt = false` é o ponto a revisar em S1 (confirmar que só o cron/secret a aciona; não deve ser invocável anonimamente sem proteção).
- `service_role` vive só nas funções (`_shared/contexto.ts`), nunca no front (confirmado).

## 9.6 Advisors — resumo

- **Segurança:** 0 ERROR. WARN: 2 `function_search_path_mutable` (`app.xp_por_prioridade`, `app.xp_simulado`); 8 `authenticated_security_definer_function_executable`; 1 `auth_leaked_password_protection` (desabilitada).
- **Performance:** INFO — ~38 `unindexed_foreign_keys` (FKs sem índice de cobertura, em tabelas Fase 15/C0/responsáveis); ~9 `unused_index` (incl. índices da 0023 — esperado no volume baixo). WARN — 7 `multiple_permissive_policies`.

**Conclusão Supabase:** schema das fases **aplicado e íntegro**, RLS sem furo (0 ERROR), motor C0 vivo. Débitos: divergência de ledger de migration (P2), endurecimento de SECURITY DEFINER/`search_path`/leaked-password (P2), FKs sem índice e políticas permissivas duplicadas (P3) — todos **aditivos/não-bloqueantes** e candidatos a S1/DB1.
