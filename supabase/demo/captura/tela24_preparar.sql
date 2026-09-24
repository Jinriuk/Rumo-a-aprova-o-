-- ============================================================
-- CAPTURA · TELA 24 (Onboarding) — PREPARO
-- ------------------------------------------------------------
-- SÓ projeto de demonstração, SÓ a Helena Vasconcelos do Instituto
-- Meridiano. Roda no sábado da captura oficial, DEPOIS do critério de
-- aceite e da captura principal (o estado abaixo muda a tela Hoje da
-- Helena, então nada mais é capturado com ele).
--
-- O que muda (e nada além disto):
--   aluno_onboarding.concluido_em da Helena → null (o cartão
--     "Bem-vindo, Helena!" aparece acima da tela Hoje; o formulário abre
--     vazio, as respostas antigas ficam guardadas na linha);
--   usuarios.must_change_password da Helena → false (se estivesse true, o
--     login cairia na troca de senha e não no onboarding).
--
-- Backup: demo.backup_20260926_tela24 guarda a linha inteira de
-- aluno_onboarding (jsonb) e o must_change_password ANTES do preparo.
-- Idempotente: rodar de novo não sobrescreve o backup (on conflict do
-- nothing), então o backup continua sendo o estado original.
-- Rollback: tela24_restaurar.sql. Conferência: tela24_conferir.sql.
-- Nenhuma escrita em logs_acesso nem em consentimentos.
-- ============================================================
do $$
declare
  v_escola  constant uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  v_aluno   constant uuid := 'dddddddd-a000-4000-8000-000000000001';
  v_usuario uuid;
begin
  -- regra 3: só o tenant de demonstração
  if not exists (select 1 from public.escolas where id = v_escola and plano = 'demo') then
    raise exception 'tela 24: Meridiano/plano demo ausente — abortado';
  end if;
  select usuario_id into v_usuario from public.alunos
   where id = v_aluno and escola_id = v_escola and nome = 'Helena Vasconcelos';
  if v_usuario is null then
    raise exception 'tela 24: Helena Vasconcelos não encontrada no Meridiano (ou sem credencial) — abortado';
  end if;

  -- regra 4: backup antes
  create table if not exists demo.backup_20260926_tela24 (
    aluno_id             uuid primary key,
    usuario_id           uuid not null,
    onboarding           jsonb,           -- null = a Helena não tinha linha
    must_change_password boolean not null,
    tomado_em            timestamptz not null default now()
  );
  alter table demo.backup_20260926_tela24 enable row level security;
  insert into demo.backup_20260926_tela24 (aluno_id, usuario_id, onboarding, must_change_password)
  select v_aluno, v_usuario,
         (select to_jsonb(o) from public.aluno_onboarding o where o.aluno_id = v_aluno),
         u.must_change_password
    from public.usuarios u
   where u.id = v_usuario and u.escola_id = v_escola
  on conflict (aluno_id) do nothing;

  -- o estado da tela 24
  update public.aluno_onboarding set concluido_em = null
   where aluno_id = v_aluno and escola_id = v_escola and concluido_em is not null;
  update public.usuarios set must_change_password = false
   where id = v_usuario and escola_id = v_escola and must_change_password;

  insert into demo.execucoes (acao, hoje, detalhe)
  values ('tela24_preparar', app.hoje_local(),
          (select jsonb_build_object('backup', to_jsonb(b)) from demo.backup_20260926_tela24 b where b.aluno_id = v_aluno));
end $$;
