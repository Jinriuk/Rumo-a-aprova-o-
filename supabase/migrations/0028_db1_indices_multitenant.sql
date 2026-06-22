-- DB1-H: índices ADITIVOS de cobertura para FKs multi-tenant e joins de RLS.
create index if not exists idx_aluno_conquistas_escola      on public.aluno_conquistas    (escola_id);
create index if not exists idx_aluno_xp_eventos_escola       on public.aluno_xp_eventos     (escola_id);
create index if not exists idx_aluno_niveis_escola           on public.aluno_niveis         (escola_id);
create index if not exists idx_aluno_nivel_hist_escola       on public.aluno_nivel_historico(escola_id);
create index if not exists idx_aluno_onboarding_escola       on public.aluno_onboarding     (escola_id);
create index if not exists idx_alunos_turmas_escola          on public.alunos_turmas        (escola_id);
create index if not exists idx_meta_atividades_escola        on public.meta_atividades      (escola_id);
create index if not exists idx_vinculos_escola               on public.vinculos_responsaveis(escola_id);
create index if not exists idx_alunos_turmas_turma           on public.alunos_turmas        (turma_id);
create index if not exists idx_vinculos_aluno                on public.vinculos_responsaveis(aluno_id);
create index if not exists idx_consentimentos_aluno          on public.consentimentos       (aluno_id);
