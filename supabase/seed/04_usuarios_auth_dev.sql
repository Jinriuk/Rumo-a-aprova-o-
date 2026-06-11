-- ============================================================
-- SEED DE DESENVOLVIMENTO — contas de DEMO no Supabase Auth
-- ------------------------------------------------------------
-- SÓ para ambiente de demo/dev (escola de vitrine). NÃO rodar em
-- produção real. Idempotente (on conflict do nothing).
--
-- Cria as contas no GoTrue (auth.users + auth.identities) com os
-- MESMOS ids fixos do seed 01, com escola e papel carimbados no
-- app_metadata — os claims que a RLS lê. Alternativa equivalente:
-- scripts/seed-auth-usuarios.mjs (via API admin).
--
-- Credenciais de demonstração (troque ao apresentar):
--   coordenação vitrine:  coordenacao@vitrine.demo / vitrine-coord-2026
--   aluno Lucas (código): LUCASDEMO2026
--   responsável (código): RESPDEMO2026X
--   coordenação beta:     coordenacao@beta.demo / beta-coord-2026
--   aluno Bruno (código): BRUNODEMO2026
--   responsável (código): RESPBETA2026XX
-- ============================================================

create extension if not exists pgcrypto;

do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'coordenacao@vitrine.demo',              'vitrine-coord-2026',
       '11111111-1111-4111-8111-111111111111', 'coordenacao', 'Coordenação Vitrine'),
      ('aaaaaaaa-0000-4000-8000-000000000002'::uuid, 'lucasdemo2026@codigo.acesso.local',     'LUCASDEMO2026',
       '11111111-1111-4111-8111-111111111111', 'aluno',       'Lucas'),
      ('aaaaaaaa-0000-4000-8000-000000000003'::uuid, 'respdemo2026x@codigo.acesso.local',     'RESPDEMO2026X',
       '11111111-1111-4111-8111-111111111111', 'responsavel', 'Responsável do Lucas'),
      ('bbbbbbbb-0000-4000-8000-000000000001'::uuid, 'coordenacao@beta.demo',                 'beta-coord-2026',
       '22222222-2222-4222-8222-222222222222', 'coordenacao', 'Coordenação Beta'),
      ('bbbbbbbb-0000-4000-8000-000000000002'::uuid, 'brunodemo2026@codigo.acesso.local',     'BRUNODEMO2026',
       '22222222-2222-4222-8222-222222222222', 'aluno',       'Bruno'),
      ('bbbbbbbb-0000-4000-8000-000000000003'::uuid, 'respbeta2026xx@codigo.acesso.local',    'RESPBETA2026XX',
       '22222222-2222-4222-8222-222222222222', 'responsavel', 'Responsável do Bruno')
    ) as t(id, email, senha, escola_id, papel, nome)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new, is_sso_user
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
      u.email, crypt(u.senha, gen_salt('bf')), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'),
                         'escola_id', u.escola_id, 'papel', u.papel),
      jsonb_build_object('nome', u.nome),
      now(), now(), '', '', '', '', false
    ) on conflict (id) do nothing;

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), u.id, u.id::text,
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      'email', now(), now(), now()
    ) on conflict (provider_id, provider) do nothing;
  end loop;
end $$;
