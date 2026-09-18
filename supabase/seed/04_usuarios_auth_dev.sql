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
-- CÓDIGO NÃO É SENHA (S1, Onda 7). Até a Onda 8 este seed gravava
-- `crypt(codigo, …)` — quem soubesse o código de acesso tinha a senha
-- junto. Era a mesma falha que o provisionar-aluno pré-#95 tinha em
-- produção, e ela renascia a cada reseed, mesmo depois de a produção
-- ter sido corrigida.
--
-- Agora o seed segue o mesmo modelo do provisionar-aluno pós-#95:
-- o código IDENTIFICA, a senha AUTENTICA, e as contas de login de
-- demonstração nascem com `must_change_password` (seed 01) — a troca
-- é forçada no primeiro acesso por App.jsx.
--
-- Credenciais de demonstração — o código é público (vai na tela de
-- login), a senha inicial não:
--   coordenação vitrine:  coordenacao@vitrine.demo / vitrine-coord-2026
--   coordenação beta:     coordenacao@beta.demo   / beta-coord-2026
--   aluno Lucas:          código LUCASDEMO2026  + SENHA_DEMO_INICIAL
--   responsável do Lucas: código RESPDEMO2026X  + SENHA_DEMO_INICIAL
--   aluno Bruno:          código BRUNODEMO2026  + SENHA_DEMO_INICIAL
--   responsável do Bruno: código RESPBETA2026XX + SENHA_DEMO_INICIAL
-- onde SENHA_DEMO_INICIAL = 'triliva-primeiro-acesso-2026'. Ela serve
-- só para o primeiro login; o app exige trocá-la em seguida.
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
      -- as 4 contas por código recebem a MESMA senha inicial, que não é
      -- o código: quem lê o código na tela de login não ganha o acesso.
      ('aaaaaaaa-0000-4000-8000-000000000002'::uuid, 'lucasdemo2026@codigo.acesso.local',     'triliva-primeiro-acesso-2026',
       '11111111-1111-4111-8111-111111111111', 'aluno',       'Lucas'),
      ('aaaaaaaa-0000-4000-8000-000000000003'::uuid, 'respdemo2026x@codigo.acesso.local',     'triliva-primeiro-acesso-2026',
       '11111111-1111-4111-8111-111111111111', 'responsavel', 'Responsável do Lucas'),
      ('bbbbbbbb-0000-4000-8000-000000000001'::uuid, 'coordenacao@beta.demo',                 'beta-coord-2026',
       '22222222-2222-4222-8222-222222222222', 'coordenacao', 'Coordenação Beta'),
      ('bbbbbbbb-0000-4000-8000-000000000002'::uuid, 'brunodemo2026@codigo.acesso.local',     'triliva-primeiro-acesso-2026',
       '22222222-2222-4222-8222-222222222222', 'aluno',       'Bruno'),
      ('bbbbbbbb-0000-4000-8000-000000000003'::uuid, 'respbeta2026xx@codigo.acesso.local',    'triliva-primeiro-acesso-2026',
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
