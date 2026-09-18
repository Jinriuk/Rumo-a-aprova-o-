-- ============================================================
-- SEED 21 — CONTAS DE AUTH DOS ALUNOS DA VITRINE
-- ------------------------------------------------------------
-- Extraído do seed 13 na Onda 8. Motivo da separação:
--
-- O 13 criava `usuarios` (schema público) e `auth.users`/
-- `auth.identities` (GoTrue) no mesmo laço. Como o schema `auth` não
-- existe no Postgres vanilla do CI, o `reset-db.sh` precisava pular o
-- seed 13 INTEIRO — e junto com ele sumia do CI toda a base da
-- vitrine: 60 alunos, seus registros, metas e simulados, sem um único
-- teste cobrindo. Foi exatamente por isso que as datas cravadas em
-- junho/2026 ficaram três meses congeladas sem ninguém perceber, até a
-- vitrine amanhecer com 455 de 457 registros vencidos.
--
-- Agora o corte é pelo SCHEMA: o 13 é 100% público e roda no CI; só
-- este arquivo (e o 04, pelo mesmo motivo) fica de fora.
--
-- Depende do seed 13 (as linhas de `usuarios` precisam existir).
-- Só roda em ambiente Supabase real. Idempotente.
--
-- CÓDIGO NÃO É SENHA (S1, Onda 7/8): estas contas nascem com uma senha
-- que NÃO é derivável do código de acesso. O código identifica e vai
-- na tela de login; a senha autentica. Alunos de cenário não levam
-- `must_change_password` — ninguém se loga neles numa demonstração, e
-- 60 selos "aguardando troca" no painel da coordenação seriam o oposto
-- do que a vitrine precisa mostrar. As contas em que ALGUÉM de fato
-- entra numa demonstração (Lucas, Bruno e responsáveis) estão no seed
-- 04 e essas, sim, exigem troca no primeiro acesso.
--
-- Login por CÓDIGO: VITRINE0NN → vitrine0NN@codigo.acesso.local
-- Senha inicial de cenário: 'triliva-cenario-2026'
-- ============================================================

create extension if not exists pgcrypto;

do $$
declare
  r record;
  v_escola uuid := '11111111-1111-4111-8111-111111111111';
  v_email text; v_codigo text; v_node text;
begin
  for r in
    select u.id, u.nome
      from usuarios u
     where u.escola_id = v_escola
       and u.papel = 'aluno'
       and u.id::text like 'aaaaaaaa-1111-4111-8111-%'
  loop
    v_node   := right(r.id::text, 12);
    v_codigo := 'VITRINE0' || lpad(ltrim(right(v_node, 3), '0'), 2, '0');
    v_email  := lower(v_codigo) || '@codigo.acesso.local';

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new, is_sso_user
    ) values (
      '00000000-0000-0000-0000-000000000000', r.id, 'authenticated', 'authenticated',
      v_email, crypt('triliva-cenario-2026', gen_salt('bf')), now(),
      jsonb_build_object('provider','email','providers', jsonb_build_array('email'),
                         'escola_id', v_escola::text, 'papel', 'aluno'),
      jsonb_build_object('nome', r.nome),
      now(), now(), '', '', '', '', false
    ) on conflict (id) do nothing;

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), r.id, r.id::text,
      jsonb_build_object('sub', r.id::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    ) on conflict (provider_id, provider) do nothing;
  end loop;
end $$;
