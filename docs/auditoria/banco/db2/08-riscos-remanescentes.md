# DB2 — Riscos remanescentes

> Classificação P0 (bloqueador) · P1 (alto) · P2 (médio) · P3 (baixo).

## P0 — bloqueadores
**Nenhum.** Sem mudança destrutiva; RLS verde; suspensão bloqueando;
backoffice e papéis funcionando; paridade de migrations mantida.

## P1 — alto (operacional / dono — herdados)
- **P1.1 — Backup/plano:** free sem backup automático. Antes da 1ª escola
  real: Pro (backup diário) ou `pg_dump` externo. *(Fora do escopo DB2.)*
- **P1.2 — Região `us-east-1` × LGPD:** dado de menor deveria ir p/
  `sa-east-1`. *(Fora do escopo DB2.)*
- **P1.3 — Leaked Password Protection** (Auth) desligado — toggle do dono.

> O runbook de migrations (P1 da DB1) foi **resolvido** nesta DB2
> (`docs/operacao/runbook-migrations-supabase.md`).

## P2 — médio (encaminhado p/ DB3 / produto)
- **P2.1 — Tabelas Fase 15 vazias** (`aluno_xp_eventos`, `aluno_niveis`,
  `aluno_nivel_historico`, `aluno_onboarding`, `missoes_escola`):
  marcadas `[DB3]` no banco. Remover só após provar ausência de escrita.
- **P2.2 — Duas noções de "trilha"** (semanal × por concurso): decisão de
  **produto**, não de banco. Documentada (motor semanal segue necessário).
- **P2.3 — Repositório público** com PII no roadmap — recomendar privado
  antes do piloto. *(Decisão do dono.)*

## P3 — baixo
- **P3.1 — `unused_index` (20)**: 11 novos da DB1 (ainda sem carga) + 9
  antigos. Reavaliar com `pg_stat` sob carga real (DB3). Não remover agora.
- **P3.2 — 27 FKs sem índice** (auditoria/exam_tag/catálogos): criar só
  com volume (ver `05-indices-advisors.md`).
- **P3.3 — Par `lgpd_excluir/exportar`** duplicado `app`/`public`:
  consolidação cosmética (DB3, opcional).
- **P3.4 — 8 advisors secdef** (`backoffice_*`/`resumo_escola`/
  `sou_super_admin`): by-design, mantidos.

## Resumo
| Prioridade | Qtde | Bloqueia piloto? |
|---|---|---|
| P0 | 0 | — |
| P1 | 3 | Não (dono/operacional) |
| P2 | 3 | Não |
| P3 | 4 | Não |
