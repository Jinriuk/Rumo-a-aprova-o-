-- ============================================================
-- 0057 — C-S06: função interna SECURITY DEFINER não é chamável por usuário
-- ------------------------------------------------------------
-- APROVAÇÃO: PENDENTE. Não aplicar em demonstração nem em produção sem
-- aprovação explícita do dono, pedida em prompt próprio (Etapa 2,
-- trava 3). Escrita e ensaiada só em Postgres local descartável.
-- NUMERAÇÃO: o roteiro chamava esta de 0056; a 0055 virou a correção
-- urgente (#138) e a C-S04 virou 0056 (#140). Depende das duas só pela
-- numeração contígua exigida por teste; não reescreve nada delas.
--
-- O ACHADO (auditoria C-S06; matriz de autorização, fatia 2)
--   Recontagem de 24/09/2026, idêntica em demo, produção e local: 50
--   funções SECURITY DEFINER em public/app, 28 com EXECUTE para anon ou
--   authenticated. Todas com search_path fixo. O dono de todas é
--   `postgres`, que tem BYPASSRLS nos hospedados: dentro delas a RLS não
--   é avaliada.
--   Doze funções do schema `app` tinham EXECUTE pelo PUBLIC sem que
--   usuário nenhum precisasse delas; seis recebem ID de escola ou aluno.
--   A matriz executou, como coordenação da escola A e com IDs da B:
--   backfill_progresso (escreve eventos da B), motor_avaliar_aluno,
--   motor_conquista_xp (concede conquista e XP), desbloquear_conquista_
--   basica (no-op desde a 0037), exam_tag_do_aluno e motor_streak_dias
--   (leem dado do aluno da B). Pela API elas só são alcançáveis se `app`
--   estiver entre os schemas expostos do PostgREST — NÃO VERIFICADO por
--   HTTP (a sessão não alcança *.supabase.co). `anon` não tem USAGE em
--   `app` nos dois projetos (medido), então o EXECUTE de anon já não
--   valia. Esta migration tira o privilégio de quem não precisa dele,
--   independentemente de `app` estar exposto.
--
-- CLASSIFICAÇÃO (a registrada no teste e2-cs06-secdef-db)
--   (a) operação exposta que confere autorização no corpo — 12, todas em
--       public: abrir_proximo_ciclo, backoffice_* (8), resumo_escola,
--       salvar_onboarding_aluno, sou_super_admin. NÃO MUDAM.
--   (b) helper usado em policy — app.eh_super_admin, meu_aluno_id,
--       sou_responsavel_de, tenant_operacional. Precisam de EXECUTE para
--       authenticated porque a expressão da policy roda como quem
--       consulta; só leem. NÃO MUDAM.
--   (c) função de gatilho — 6 abaixo. O gatilho dispara sem EXECUTE de
--       quem escreve (o privilégio só é conferido ao CRIAR o gatilho).
--       Revoga de PUBLIC, anon e authenticated.
--   (d) interna chamada só por outra SECURITY DEFINER ou pelo operador —
--       6 abaixo. Revoga de PUBLIC, anon e authenticated; service_role
--       fica (operador e Edge Function).
--   As outras 22 SECURITY DEFINER já não tinham EXECUTE para usuário.
--
-- QUEM CHAMA CADA UMA (conferido: nenhum rpc() no front, nas Edge
-- Functions, nos scripts nem no overlay do demo)
--   backfill_progresso ........... ninguém (ferramenta de operador)
--   desbloquear_conquista_basica . progresso_de_registro/_missao/_simulado (SD)
--   motor_avaliar_aluno .......... trg_ped1_registro (SD)
--   motor_conquista_xp ........... motor_avaliar_aluno (SD)
--   motor_streak_dias ............ motor_avaliar_aluno (SD)
--   exam_tag_do_aluno ............ motor_avaliar_aluno (SD)
--   Dentro de uma SECURITY DEFINER o chamador efetivo é o dono
--   (postgres), que tem EXECUTE como dono: a cadeia não depende do grant
--   de PUBLIC.
--
-- ROLLBACK
--   grant execute on function <cada uma> to public;
--   (volta exatamente ao estado de antes: EXECUTE pelo PUBLIC).
-- ============================================================

-- (c) funções de gatilho
revoke execute on function app.estornar_progresso_de_origem() from public, anon, authenticated;
revoke execute on function app.progresso_de_missao()          from public, anon, authenticated;
revoke execute on function app.progresso_de_registro()        from public, anon, authenticated;
revoke execute on function app.progresso_de_simulado()        from public, anon, authenticated;
revoke execute on function app.registrar_nivel_historico()    from public, anon, authenticated;
revoke execute on function app.trg_ped1_registro()            from public, anon, authenticated;

-- (d) internas: só a cadeia SECURITY DEFINER e o operador
revoke execute on function app.backfill_progresso(uuid)                             from public, anon, authenticated;
revoke execute on function app.desbloquear_conquista_basica(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function app.motor_avaliar_aluno(uuid)                            from public, anon, authenticated;
revoke execute on function app.motor_conquista_xp(uuid, uuid, text, text)           from public, anon, authenticated;
revoke execute on function app.motor_streak_dias(uuid)                              from public, anon, authenticated;
revoke execute on function app.exam_tag_do_aluno(uuid)                              from public, anon, authenticated;

grant execute on function app.backfill_progresso(uuid)                             to service_role;
grant execute on function app.desbloquear_conquista_basica(uuid, uuid, text, text) to service_role;
grant execute on function app.motor_avaliar_aluno(uuid)                            to service_role;
grant execute on function app.motor_conquista_xp(uuid, uuid, text, text)           to service_role;
grant execute on function app.motor_streak_dias(uuid)                              to service_role;
grant execute on function app.exam_tag_do_aluno(uuid)                              to service_role;
