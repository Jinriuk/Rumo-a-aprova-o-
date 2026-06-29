# 08 — Edge Functions e Runtime (SDB-AUDIT)

> Data: 2026-06-29. Evidencias: API Supabase Management (funcoes), repositorio (codigo).

## 1. Estado das Edge Functions

| Funcao | Status | Versao | verify_jwt | Repo | CORS |
|--------|--------|--------|-----------|------|------|
| provisionar-aluno | ACTIVE | v3 | true | sim | allowlist |
| gerar-meta | ACTIVE | v2 | true | sim | allowlist |
| virar-semana | ACTIVE | v2 | false | sim | allowlist |
| lgpd-titular | ACTIVE | v2 | true | sim | allowlist |
| backoffice-coordenador | ACTIVE | v5 | true | sim | allowlist |
| revogar-responsavel | ACTIVE | v2 | true | sim | allowlist |

Todas as 6 funcoes estao ACTIVE e com CORS allowlist (deployado em SEG2).

## 2. Analise por Funcao

### provisionar-aluno (v3)
- verify_jwt: true — exige token valido
- Valida papel: sim (coordenacao ou superadmin)
- Valida escola_id: sim
- Usa service_role: sim (server-side, para criar auth.users)
- Idempotente: sim (verifica existencia antes de criar)
- Risco de duplicidade: baixo (UNIQUE constraints no banco)
- CORS allowlist: sim (SEG2)

### backoffice-coordenador (v5)
- verify_jwt: true — exige token valido
- Valida papel: sim (coordenacao)
- Valida escola_id: sim (via JWT)
- Usa service_role: sim (para operacoes de banco)
- Observacao: v5 e a versao mais recente — mais chamadas de deploy historico

### revogar-responsavel (v2)
- verify_jwt: true
- Valida papel: coordenacao
- Valida escola_id: sim
- Deleta vinculo fisicamente (sem coluna ativo)

### gerar-meta (v2)
- verify_jwt: true
- Chama public.motor_gerar_meta(aluno_id)
- Valida escola_id: sim

### virar-semana (v2)
- verify_jwt: FALSE — gate por service_role no SQL
- Chama public.motor_virar_semana()
- Observacao: nao usa verify_jwt pois e chamada pelo cron/operador, nao pelo front
- Risco: se a URL vazar, qualquer um pode chamar. Mitigado pelo gate SQL.
- Funcao motor_virar_semana_escola() (0035) NAO disponivel — drift de migration

### lgpd-titular (v2)
- verify_jwt: true
- Exporta ou apaga dados do titular
- Atomicidade: lgpd_usuarios_do_aluno (0036) NAO disponivel no banco
- Risco: exclusao pode ficar em estado inconsistente (banco apaga, Auth falha ou vice-versa)
- Classificacao do risco: P1

## 3. CORS

Todas as funcoes tem CORS allowlist configurado em _shared/cors.ts.
ALLOWED_ORIGINS inclui: URL de producao Vercel + localhost + previews.
Curls de verificacao preflight: pendente do dono (egresso bloqueado no runtime de auditoria).

## 4. Funcoes Ausentes por Drift

| Funcao banco | Requerida por | Drift |
|-------------|---------------|-------|
| public.motor_virar_semana_escola(uuid) | virar-semana (variante por escola) | 0035 nao aplicada |
| public.lgpd_usuarios_do_aluno(uuid) | lgpd-titular (atomicidade) | 0036 nao aplicada |

## 5. Comparacao Repo vs Remoto

| Funcao | Existe no repo | Deployada | Versao repo == deployada? |
|--------|---------------|-----------|--------------------------|
| provisionar-aluno | sim | sim (v3) | Assumido sim (SEG2 deployou) |
| backoffice-coordenador | sim | sim (v5) | Assumido sim |
| revogar-responsavel | sim | sim (v2) | Assumido sim |
| gerar-meta | sim | sim (v2) | Assumido sim |
| virar-semana | sim | sim (v2) | Assumido sim (SEC3 nao re-deployou) |
| lgpd-titular | sim | sim (v2) | Assumido sim (SEC3 modificou) |

Observacao: o codigo de lgpd-titular (SEC3) chama lgpd_usuarios_do_aluno que nao
existe no banco (0036 nao aplicada). Isso pode causar erro em producao ao apagar.
