# Auditoria — Persona 7: BACKEND / SUPABASE / POSTGRES

> Auditoria por especialista em Supabase/Postgres/RLS/RPC/performance.
> Base: `supabase/migrations/0001–0015`, `supabase/functions/*`, `supabase/config.toml`,
> `scripts/seed-auth-usuarios.mjs`. Personas de segurança em arquivo separado (09).

---

## 1. Nota geral de maturidade da área: **82/100**

O banco é o melhor componente do sistema. A modelagem multi-tenant é correta e disciplinada:
toda tabela isolável nasce com `escola_id`, a RLS está habilitada em todas as tabelas (inclusive
as 0008–0015), as funções de motor/LGPD são `SECURITY DEFINER` com `search_path` fixado e só
executáveis pelo `service_role`, e há prova de isolamento automatizada. Perde pontos em
índices compostos que não levam `escola_id` no prefixo (custo em escala grande) e em alguns
detalhes de robustez (agregação só no servidor inexistente, virada com escopo global).

## 2. O que está forte

- **Modelagem tenant correta.** `escola_id` em todas as tabelas de progresso/pessoas, FKs
  `on delete cascade`, conteúdo global (trilhas/disciplinas/provas/missões/patentes) sem dono e
  só-leitura via API. A separação progresso (da escola) × conteúdo (do operador) é clara.
- **RLS "negar por padrão" completa.** `0002` habilita RLS em todas as tabelas base; as
  migrations 0008–0015 mantêm o padrão — nenhuma tabela nova ficou sem RLS/política. Tabelas
  isoláveis (`config_escola`, `aluno_niveis`, `missoes_escola`, `aluno_xp_eventos`,
  `aluno_conquistas`, `aluno_onboarding`, `aluno_nivel_historico`) têm policy por tenant; as
  globais têm `select` para `authenticated` e escrita só por `service_role`.
- **Helpers de identidade isolados.** `app.jwt()/usuario_id()/tenant_id()/papel()` são a única
  porta para a identidade do token; `app.meu_aluno_id()` e `app.sou_responsavel_de()` são
  `SECURITY DEFINER` para evitar recursão de RLS — desenho correto.
- **Porta do servidor bem fechada.** `0005` cria wrappers públicos (PostgREST só expõe
  `public`) que **revogam de `public/authenticated/anon` e concedem só ao `service_role`**.
  As funções de motor/LGPD em `app.*` também são revogadas de todos e concedidas só ao
  `service_role`. Defesa em profundidade real.
- **`search_path` endurecido** (`0006`) nas funções `SECURITY DEFINER` — fecha o vetor
  clássico de escalonamento por troca de search_path.
- **Motor idempotente e determinístico.** `app.gerar_meta`/`app.virar_semana` não duplicam ao
  rodar duas vezes; virada por data local (America/São_Paulo), agendada por `pg_cron` (`0004`)
  às 03:05 UTC = 00:05 BRT, com fallback quando `pg_cron` não existe (teste local).
- **LGPD de verdade.** `app.lgpd_exportar` monta o dossiê completo (sem `usuario_id`);
  `app.lgpd_excluir` apaga em cascata e devolve os ids de Auth a remover, preservando o log de
  acesso como trilha de auditoria.
- **Migrations aditivas e ordenadas** (0001→0015), com `reset-db.sh` aplicando migrations +
  seed 2x (exercita idempotência).

## 3. O que está fraco

- **Índices sem `escola_id` no prefixo.** `aluno_xp_eventos (aluno_id, exam_tag)`,
  `aluno_conquistas (aluno_id, exam_tag)`, `missoes_escola (escola_id)` (só), `metas (aluno_id)`.
  As queries multi-tenant filtram por `escola_id`+`aluno_id`; sem o prefixo, em 100k+ alunos o
  planner tende a bitmap scan. Hoje (5–6 escolas) é irrelevante; em escala, importa.
- **Nenhuma RPC de agregação.** As leituras de escola (`listarRegistrosEscola`,
  `listarMetasEscola`, `listarSimuladosEscola`) trazem linhas cruas e o cliente agrega. Para
  300+ alunos isso devia ser um `resumo_escola()` no banco.
- **Virada com escopo global.** `app.virar_semana()` itera **todos** os alunos com trilha, sem
  filtro por escola. Não é alcançável pelo usuário (só `service_role`), mas é uma porta única
  que, se a chave vazar, atua em todos os tenants — convém defesa adicional.

## 4. O que está confuso

- **Wrappers `public.motor_*`/`public.lgpd_*` em SQL `language sql`** sem `security` explícito:
  herdam o `SECURITY DEFINER` das funções `app.*` que chamam, e o grant é só `service_role`.
  Correto, mas o comportamento "herdado" merece um comentário explícito para o próximo dev.
- **View `vw_recorrencia_medida`** é global e não filtra tenant — aceitável (é estatística de
  conteúdo, não dado de aluno), mas vale documentar que é proposital.

## 5. O que pode quebrar com uso real

- **Query de escola cresce linearmente** sem agregação no banco (full scan de
  `registros_estudo` da escola a cada abertura do painel).
- **`seed-auth-usuarios.mjs` refaz `listUsers(perPage:1000)` em loop** — lento e frágil acima
  de 1000 contas; deve listar uma vez e cachear.

## 6. Problemas críticos

- Nenhum crítico de correção/segurança no banco (o isolamento é provado por teste). Os pontos
  são de **escala e robustez**, não de furo.

## 7. Problemas importantes

1. **Índices compostos com `escola_id` no prefixo** para tabelas de progresso/gamificação.
2. **RPC `resumo_escola()` agregada** (e paginada) para o painel da coordenação.
3. **Defesa adicional na virada** (parametrizar por escola, ou afirmar invariante).
4. **Seed de Auth**: cachear `listUsers`.

## 8. Melhorias desejáveis

- `EXPLAIN ANALYZE` das queries de escola sob volume sintético (10k/100k).
- Índices parciais para filtros de status ("sem atividade 7d") se virarem RPC.
- Documentar comportamento `SECURITY DEFINER` herdado nos wrappers.

## 9. O que não precisa mexer

- Estrutura de RLS e helpers de identidade.
- Porta do servidor (`0005`) e grants ao `service_role`.
- `search_path` endurecido (`0006`).
- Motor idempotente e LGPD export/exclusão.

## 10. O que falta para considerar fechado (visão backend)

1. Índices compostos por tenant nas tabelas de progresso/gamificação.
2. RPC de agregação/paginação para a escola.
3. Validação de performance sob volume (EXPLAIN ANALYZE).
4. Pequenos endurecimentos (virada por escola, seed listUsers).

## 11. Lista objetiva de recomendações (com prioridade)

| # | Recomendação | Prioridade |
|---|--------------|------------|
| 1 | Índices `(escola_id, aluno_id, exam_tag)` em xp/conquistas; `(escola_id, ...)` em metas/missoes_escola | Alta |
| 2 | Criar `resumo_escola()` agregada + paginação | Alta |
| 3 | Teste de carga (EXPLAIN ANALYZE) com 10k/100k alunos | Média |
| 4 | Parametrizar/blindar `virar_semana` por escola | Média |
| 5 | Cachear `listUsers` no seed de Auth | Baixa |
| 6 | Comentar `SECURITY DEFINER` herdado nos wrappers | Baixa |

## 12. Veredito final

**Aprovado.** O backend é maduro e bem desenhado: isolamento correto, RLS completa, funções de
privilégio fechadas, LGPD real e migrations organizadas, tudo coberto por testes de banco. As
ressalvas (índices por tenant e agregação no servidor) são de **escala** e não bloqueiam uso
real em escolas pequenas/médias; resolvidas, a área chega à faixa de 92.
