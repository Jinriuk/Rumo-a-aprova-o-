-- ============================================================
-- 0036 — SEC3/T75: atomicidade da exclusão LGPD (banco + Auth)
-- ------------------------------------------------------------
-- PROBLEMA (residual após SEG1/SEG2):
--   A exclusão LGPD apaga dado em DOIS sistemas distintos e SEM
--   transação comum: o banco (app.lgpd_excluir) e o Auth/GoTrue
--   (admin.auth.admin.deleteUser, na Edge Function). `usuarios.id`
--   é o mesmo id do auth.users, mas NÃO há FK entre eles — apagar
--   um lado não cascateia no outro. Se o banco apaga e o Auth falha,
--   sobra conta órfã que ainda autentica (estado quebrado silencioso).
--
-- SOLUÇÃO desta camada:
--   - função SOMENTE-LEITURA que devolve, ANTES de apagar nada, a
--     lista exata de contas que a exclusão removeria (a do aluno + a
--     dos responsáveis cujo ÚNICO vínculo é este aluno);
--   - a Edge Function lgpd-titular passa a apagar o Auth PRIMEIRO
--     (idempotente: conta já ausente = ok) e só apaga o banco quando
--     todo o Auth saiu. Se algum Auth falhar, ABORTA e o banco fica
--     intacto para retry — nunca o estado "banco apagado, Auth órfão".
--
-- A lógica de "quem cai junto" é a MESMA de app.lgpd_excluir (0003),
-- aqui só extraída como leitura pura. Migração ADITIVA e reversível.
-- ============================================================

-- Devolve os ids de usuário (Auth) que a exclusão do aluno removeria.
-- Espelho EXATO da seleção de app.lgpd_excluir, sem efeito colateral:
-- a conta do aluno + responsáveis sem outro vínculo. Ordem estável.
create or replace function app.lgpd_usuarios_do_aluno(p_aluno uuid)
returns uuid[]
language plpgsql stable security definer set search_path = public, app as $$
declare
  v_aluno alunos;
  v_usuarios uuid[] := '{}';
  r record;
begin
  select * into v_aluno from alunos where id = p_aluno;
  if not found then raise exception 'aluno % não existe', p_aluno; end if;

  if v_aluno.usuario_id is not null then
    v_usuarios := v_usuarios || v_aluno.usuario_id;
  end if;

  -- responsáveis cujo ÚNICO vínculo é este aluno perdem a conta junto
  for r in
    select v.responsavel_id from vinculos_responsaveis v
    where v.aluno_id = p_aluno
      and not exists (select 1 from vinculos_responsaveis v2
                      where v2.responsavel_id = v.responsavel_id and v2.aluno_id <> p_aluno)
  loop
    v_usuarios := v_usuarios || r.responsavel_id;
  end loop;

  return v_usuarios;
end $$;

-- Porta no schema public para a Edge Function (service role) ler via RPC.
create or replace function public.lgpd_usuarios_do_aluno(p_aluno uuid)
returns uuid[] language sql stable as $$
  select app.lgpd_usuarios_do_aluno(p_aluno)
$$;

-- Privilégio: só o servidor (igual ao resto da família LGPD em 0003/0005).
-- Nenhum papel de escola lê esta lista de contas internas.
revoke all on function app.lgpd_usuarios_do_aluno(uuid) from public, authenticated, anon;
revoke all on function public.lgpd_usuarios_do_aluno(uuid) from public, authenticated, anon;

grant execute on function app.lgpd_usuarios_do_aluno(uuid) to service_role;
grant execute on function public.lgpd_usuarios_do_aluno(uuid) to service_role;

alter function public.lgpd_usuarios_do_aluno(uuid) set search_path = '';

-- ------------------------------------------------------------
-- ROLLBACK (manual, se necessário):
--   drop function if exists public.lgpd_usuarios_do_aluno(uuid);
--   drop function if exists app.lgpd_usuarios_do_aluno(uuid);
-- app.lgpd_excluir continua funcionando sozinha (fallback do fluxo antigo).
-- ------------------------------------------------------------
