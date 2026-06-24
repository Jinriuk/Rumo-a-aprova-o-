# DB1 — Riscos Remanescentes

> Data: 2026-06-21 · Classificação P0 (bloqueador) · P1 (alto) ·
> P2 (médio) · P3 (baixo).

## P0 — bloqueadores

**Nenhum.** Não há mudança destrutiva, RLS está íntegra, escola suspensa
continua bloqueando, build e testes verdes, sem `service_role` no front.

## P1 — alto (operacional, herdado da S1 / pendência de dono)

- **P1.1 — Backup/plano Supabase.** Plano **free** não tem backup
  automático utilizável. Antes da 1ª escola real: Pro (backup diário) ou
  `pg_dump` periódico externo. *(Fora do escopo DB1 — pendência de dono.)*
- **P1.2 — Região `us-east-1` × LGPD.** Dado de menor deveria morar em
  `sa-east-1`. Migração não-automática. *(Fora do escopo DB1.)*
- **P1.3 — Runbook de migrations.** Registrar que o deploy é via
  MCP/pipeline e que **`supabase db push` NÃO deve ser usado** com o
  esquema de nomes `000N_*` (interpretaria tudo como não aplicado). A
  guarda `checar-migrations.mjs` deve rodar antes de publicar. *(Doc
  pequeno; nenhuma ação de código pendente além de registrar.)*
- **P1.4 — Leaked Password Protection** (Auth) ainda desligado — toggle de
  painel do dono. *(Herdado da S1.)*

## P2 — médio

- **P2.1 — `multiple_permissive_policies` (7 tabelas).** Duplicidade de
  SELECT (perf, não segurança). De-duplicar com cuidado na DB2 —
  atenção a `vinculos_responsaveis` (coordenação só lê pela política
  `FOR ALL`). Exige teste de não-regressão por papel.
- **P2.2 — Tabelas Fase 15 vazias** (`aluno_xp_eventos`, `aluno_niveis`,
  `aluno_nivel_historico`, `aluno_onboarding`, `missoes_escola`).
  Possivelmente superadas pelo C0. Provar caminhos de escrita antes de
  qualquer remoção (DB2).
- **P2.3 — Duas noções de "trilha"** coexistindo (semanal × por
  concurso). Decisão de produto/arquitetura para DB2.
- **P2.4 — Repositório público** com PII no roadmap — recomendar privado
  antes do piloto. *(Herdado da S1; decisão de dono.)*

## P3 — baixo

- **P3.1 — `unused_index` (9 pré-existentes + 11 novos da 0028).** Os
  novos aparecem "unused" só por terem acabado de ser criados; os 9
  antigos devem ser reavaliados com `pg_stat` sob carga real (DB2). Não
  remover por intuição.
- **P3.2 — 27 FKs sem índice restantes** (auditoria/exam_tag/catálogos
  pequenos). Reavaliar sob carga.
- **P3.3 — Par `lgpd_excluir/exportar`** duplicado em `app`/`public`.
  Consolidação cosmética (DB2).
- **P3.4 — 8 advisors `authenticated_security_definer_function_executable`.**
  By-design (backoffice/resumo/sou_super_admin com gate interno). Mantidos.

## Resumo

| Prioridade | Qtde | Bloqueia piloto? |
|---|---|---|
| P0 | 0 | — |
| P1 | 4 | Não (operacional/dono) |
| P2 | 4 | Não |
| P3 | 4 | Não |
