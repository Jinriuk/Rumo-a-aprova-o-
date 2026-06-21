# Relatório Supabase — QA0 pós-D0

## Infra observada (painel autenticado, read-only)

- Projeto: Rumo-a-aprova-o. Status: Healthy.
- Plano: FREE. Compute: NANO (t4g.nano). CPU 2% / Disk 14% / RAM 53% / 14-60 conns.
- Região: East US (North Virginia) — us-east-1.
- Última migration: 0025_backoffice_d0.
- Branch: main (PRODUCTION), sem branches de banco.
- Último backup: NENHUM (No backups).

## Achados

| ID | Achado | Área | Impacto | Prio | Sugestão | Esforço | Fase |
|----|--------|------|---------|------|----------|---------|------|
| SUP-1 | Banco em us-east-1 (EUA), contraria o README que exige São Paulo sa-east-1 (LGPD, dado de menor no Brasil) | Infra/LGPD | Alto. Plataforma trata dados de menores sob LGPD; residência nos EUA é risco jurídico/comercial e contradiz a doc; migrar região no Supabase exige recriar projeto | P1 | Decidir antes do piloto: recriar em sa-east-1 e migrar, ou documentar base legal de transferência internacional. Resolver cedo | Alto | S1/DB1 |
| SUP-2 | Sem backups configurados (No backups) | Infra | Alto para piloto com dados reais. FREE não tem PITR; perda de dados sem rede de proteção | P1 | Subir de plano para habilitar backups/PITR antes de entrar dado real | Médio | S1 |
| SUP-3 | Plano FREE / compute NANO | Infra | Médio. OK para demo; arriscado para piloto (limites de conexão, pausa por inatividade) | P2 | Migrar para plano pago antes do piloto | Baixo | S1 |
| SUP-4 | 7 tabelas com políticas permissivas múltiplas (aluno_conquistas, aluno_niveis, aluno_onboarding, aluno_xp_eventos, config_escola, missoes_escola, vinculos_responsaveis) | RLS/Perf | Baixo. Custo de performance; confirma que RLS está ativo nessas tabelas | P3 | Consolidar policies redundantes por role/action | Médio | S1 |
| SUP-5 | Performance Advisor: 45 sugestões (índices ausentes em FK / índices não usados) | Perf | Baixo em escala demo | P3 | Revisar em S1 com volume real | Médio | S1 |

## Pontos fortes

- Security Advisor com 0 errors.
- RLS comprovadamente ativo e isolando (ver relatorio-seguranca.md).
- Migrations versionadas e sequenciais (até 0025).
