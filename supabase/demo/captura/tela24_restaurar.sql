-- ============================================================
-- CAPTURA · TELA 24 (Onboarding) — RESTAURAÇÃO (rollback do preparo)
-- ------------------------------------------------------------
-- Devolve a Helena exatamente ao que estava no backup de
-- tela24_preparar.sql: a linha inteira de aluno_onboarding (ou nenhuma,
-- se ela não tinha) e o must_change_password. Roda SEMPRE depois da
-- captura da 24, dê a captura certo ou não. Depois: critério de aceite
-- de novo (a Helena tem de voltar aos números de sábado).
--
-- Idempotente: sem backup, não faz nada (já restaurado). O backup é
-- apagado no fim; a cópia fica registrada em demo.execucoes.
-- ============================================================
do $$
declare
  v_escola constant uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  v_aluno  constant uuid := 'dddddddd-a000-4000-8000-000000000001';
  b        record;
begin
  if not exists (select 1 from public.escolas where id = v_escola and plano = 'demo') then
    raise exception 'tela 24: Meridiano/plano demo ausente — abortado';
  end if;
  if to_regclass('demo.backup_20260926_tela24') is null then
    raise notice 'tela 24: não há backup — nada a restaurar';
    return;
  end if;
  select * into b from demo.backup_20260926_tela24 where aluno_id = v_aluno;
  if not found then
    raise notice 'tela 24: backup da Helena já consumido — nada a restaurar';
    return;
  end if;
  if not exists (select 1 from public.alunos where id = v_aluno and escola_id = v_escola and usuario_id = b.usuario_id) then
    raise exception 'tela 24: a Helena mudou de usuário desde o backup — restauração abortada, conferir à mão';
  end if;

  delete from public.aluno_onboarding where aluno_id = v_aluno and escola_id = v_escola;
  if b.onboarding is not null then
    insert into public.aluno_onboarding
    select * from jsonb_populate_record(null::public.aluno_onboarding, b.onboarding);
  end if;
  update public.usuarios set must_change_password = b.must_change_password
   where id = b.usuario_id and escola_id = v_escola;

  insert into demo.execucoes (acao, hoje, detalhe)
  values ('tela24_restaurar', app.hoje_local(), jsonb_build_object('backup', to_jsonb(b)));
  delete from demo.backup_20260926_tela24 where aluno_id = v_aluno;
end $$;
