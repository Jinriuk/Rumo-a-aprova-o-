-- ============================================================
-- 0005 — PORTA DO SERVIDOR (wrappers para as Edge Functions)
-- ------------------------------------------------------------
-- O PostgREST só expõe o schema public; estas funções são a única
-- porta pela qual as Edge Functions (service role) chamam o motor
-- e a LGPD via RPC. Execução concedida SÓ ao service_role — o
-- usuário logado não as enxerga nem executa.
-- ============================================================

create or replace function public.motor_gerar_meta(p_aluno uuid)
returns uuid language sql as $$
  select app.gerar_meta(p_aluno)
$$;

create or replace function public.motor_virar_semana()
returns jsonb language sql as $$
  select to_jsonb(r) from app.virar_semana() r
$$;

create or replace function public.lgpd_exportar(p_aluno uuid)
returns jsonb language sql as $$
  select app.lgpd_exportar(p_aluno)
$$;

create or replace function public.lgpd_excluir(p_aluno uuid)
returns jsonb language sql as $$
  select app.lgpd_excluir(p_aluno)
$$;

revoke all on function public.motor_gerar_meta(uuid),
              public.motor_virar_semana(),
              public.lgpd_exportar(uuid),
              public.lgpd_excluir(uuid)
  from public, authenticated, anon;

grant execute on function public.motor_gerar_meta(uuid),
                  public.motor_virar_semana(),
                  public.lgpd_exportar(uuid),
                  public.lgpd_excluir(uuid)
  to service_role;
