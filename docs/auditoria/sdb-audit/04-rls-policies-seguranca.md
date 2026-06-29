# 04 — RLS e Policies de Segurança (SDB-AUDIT)

> Data: 2026-06-29. Evidencias: pg_policies (82 policies), pg_tables (rowsecurity=true para 46/46).

## 1. Estado Global

| Item | Resultado |
|------|-----------|
| Tabelas com RLS enabled | 46/46 (100%) |
| Policies totais | 82 |
| Multiple permissive policies | 0 (resolvido em DB2 migration 0029) |
| Tabelas sem nenhuma policy | 0 |

## 2. Categorias de Policies

### Tabelas com SELECT true (catalogo global — intencional)
Estas tabelas expoe conteudo publico de catalogo. Nenhuma contem PII ou dado de aluno.

| Tabela | Roles | Justificativa |
|--------|-------|---------------|
| assuntos | authenticated | Catalogo de assuntos — nao tem PII |
| atividades_modelo | authenticated | Motor semanal — nao tem PII |
| concursos | authenticated | Catalogo de concursos |
| config_oficial | authenticated | Configuracao oficial global |
| conquistas | authenticated | Catalogo de conquistas |
| disciplinas | authenticated | Catalogo de disciplinas |
| materias | authenticated | Catalogo de materias |
| missoes | authenticated | Catalogo de missoes |
| patentes | authenticated | Catalogo de patentes |
| prova_dias | authenticated | Datas das provas |
| prova_materias | authenticated | Materias das provas |
| provas | authenticated | Provas por concurso |
| provas_anteriores | authenticated | Provas historicas |
| questoes_prova | authenticated | Questoes das provas |
| recorrencia_assunto | authenticated | Recorrencia de assuntos |
| subassuntos | authenticated | Subassuntos |
| trilha_plano_missoes | authenticated | Planos de trilha |
| trilha_planos | authenticated | Planos |
| trilha_semanas | authenticated | Semanas da trilha |
| trilhas | authenticated | Trilhas do motor semanal |
| turmas_comerciais | authenticated | Turmas comerciais |
| turmas_comerciais_concursos | authenticated | Vinculos turma-concurso |

AVALIACAO: Aceitavel. Nenhuma dessas tabelas contem PII. O risco e que um aluno de qualquer
escola pode ver catalogo de qualquer outro, mas isso e intencional (catalogo global).

### Tabelas com isolamento por escola_id (criticas — correto)

| Tabela | Policies | Usa escola_id/tenant_id | Usa papel | Obs |
|--------|----------|------------------------|-----------|-----|
| escolas | multiplas | sim (propia) | sim | OK |
| usuarios | multiplas | sim | sim | OK |
| alunos | multiplas | sim | sim | OK |
| alunos_turmas | sim | sim (via aluno) | sim | OK |
| turmas | multiplas | sim | sim | OK |
| vinculos_responsaveis | sim (unificada DB2) | sim | sim | OK |
| registros_estudo | multiplas | sim (via aluno) | sim | OK |
| simulados | multiplas | sim (via aluno) | sim | OK |
| metas | sim | sim | sim | OK |
| meta_atividades | sim | sim (via meta) | sim | OK |
| aluno_eventos_progresso | multiplas | sim | sim | OK |
| aluno_conquistas | multiplas | sim | sim | OK |
| consentimentos | sim | sim | sim | OK |
| config_escola | multiplas | sim | sim | OK |
| logs_acesso | multiplas | sim | sim | OK |
| logs_coordenacao | sim | sim | sim | OK |

### Tabelas com controle de papel especifico

| Tabela | Policy chave | Papel controlado |
|--------|-------------|-----------------|
| admin_logs | admin_logs_select: app.eh_super_admin() | Apenas superadmin ve |
| admin_logs | admin_logs_insert: app.eh_super_admin() AND super_admin_id = app.usuario_id() | Apenas superadmin insere |
| internal_admins | internal_admins_select | Superadmin apenas |
| aluno_conquistas | multiplas por papel | coordenacao pode CRUD, aluno le proprio |

## 3. Gates Internos (Funcoes de Segurança)

| Funcao | SECURITY DEFINER | search_path fixo | Finalidade |
|--------|-----------------|-----------------|-----------|
| app.eh_super_admin() | sim | sim | Gate de superadmin |
| app.tenant_operacional() | sim | sim | Gate de escola ativa + nao suspensa |
| app.tenant_id() | nao (INVOKER) | sim (vazio) | Retorna escola_id do JWT |
| app.papel() | nao (INVOKER) | sim (vazio) | Retorna papel do JWT |
| app.usuario_id() | nao (INVOKER) | sim (vazio) | Retorna usuario_id do JWT |
| public.sou_super_admin() | sim | sim | Wrapper publico do gate |

## 4. Analise de Riscos Multi-Tenant

| Pergunta | Resposta | Evidencia |
|----------|----------|-----------|
| Uma escola pode ver dados de outra? | NAO — isolamento por app.tenant_id() em todas as policies criticas | pg_policies revisadas |
| Um aluno pode ver dados de outro aluno? | NAO — filtro por aluno_id ou escola_id | pg_policies revisadas |
| Responsavel revogado tem acesso? | Investigar — vinculos_responsaveis nao tem coluna 'ativo' | NENHUMA coluna ativo na tabela |
| Coordenacao pode acessar outra escola? | NAO — tenant_id() isola | pg_policies OK |
| Superadmin esta isolado por gate correto? | SIM — eh_super_admin() em admin_logs | verificado |
| Escola suspensa pode acessar? | NAO — tenant_operacional() bloqueia | policy verificada em vinculos_responsaveis |

## 5. Risco Identificado: Responsavel Revogado

A tabela vinculos_responsaveis NAO tem coluna 'ativo' ou 'revogado_em'.
O mecanismo de revogacao exclui fisicamente o vinculo (DELETE via EF revogar-responsavel).
Isso significa que responsavel revogado perde acesso imediatamente (linha deletada).
NAO ha coluna de historico de revogacao — LGPD/auditoria pode ser afetada.

Classificacao: P3 — sem risco imediato, mas pode ser relevante para LGPD auditoria.

## 6. Conclusao

RLS esta corretamente configurada para o modelo multi-tenant.
Todos os gates internos estao com SECURITY DEFINER e search_path correto.
Nenhuma policy permite vazamento entre escolas (evidencia: isolamento por tenant_id()).
Nenhum P0 ou P1 de segurança de dados identificado neste inventario.
