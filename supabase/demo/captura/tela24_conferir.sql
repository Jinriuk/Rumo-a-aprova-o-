-- ============================================================
-- CAPTURA · TELA 24 — CONFERÊNCIA (só leitura)
-- ------------------------------------------------------------
-- Antes do preparo: pendente = false, backup = false.
-- Depois do preparo: pendente = true, troca_senha = false, backup = true.
-- Depois da restauração: igual a "antes" (concluido_em e troca_senha
-- iguais aos do backup registrado em demo.execucoes).
-- ============================================================
select a.nome,
       o.concluido_em,
       o.concluido_em is null                    as onboarding_pendente,
       u.must_change_password                    as troca_senha,
       -- backup ativo = houve preparo sem restauração depois (pelo registro
       -- em demo.execucoes, que existe sempre; a tabela de backup pode não existir)
       coalesce((select e.acao = 'tela24_preparar' from demo.execucoes e
                  where e.acao in ('tela24_preparar', 'tela24_restaurar')
                  order by e.id desc limit 1), false) as backup_ativo,
       md5(coalesce(to_jsonb(o)::text, ''))      as md5_onboarding
  from public.alunos a
  left join public.aluno_onboarding o on o.aluno_id = a.id
  left join public.usuarios u on u.id = a.usuario_id
 where a.id = 'dddddddd-a000-4000-8000-000000000001'
   and a.escola_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
