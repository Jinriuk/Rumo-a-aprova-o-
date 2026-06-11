-- ============================================================
-- 0002 — ISOLAMENTO (RLS): a matriz de acesso do Doc 6, seção 3,
-- como POLÍTICA DE BANCO, não como condição de tela.
-- ------------------------------------------------------------
-- Negar por padrão: RLS habilitada em toda tabela; sem política
-- permissiva, nada sai. Nenhum papel enxerga outra escola.
-- A coordenação NÃO escreve meta nem registro (quem gera meta é
-- o motor no servidor; quem registra estudo é o aluno).
-- ============================================================

-- Helpers que as políticas usam. SECURITY DEFINER de propósito:
-- precisam ler alunos/vínculos sem disparar a própria RLS
-- (senão a política entraria em recursão).
create or replace function app.meu_aluno_id() returns uuid
language sql stable security definer set search_path = public, app as $$
  select a.id from alunos a
  where a.usuario_id = app.usuario_id() and a.escola_id = app.tenant_id()
  limit 1
$$;

create or replace function app.sou_responsavel_de(p_aluno uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from vinculos_responsaveis v
    where v.aluno_id = p_aluno
      and v.responsavel_id = app.usuario_id()
      and v.escola_id = app.tenant_id()
  )
$$;

grant execute on function app.meu_aluno_id(), app.sou_responsavel_de(uuid) to authenticated, service_role;

-- ------------------------------------------------------------
-- Liga a RLS em TODAS as tabelas (inclusive as globais: nelas a
-- política só permite leitura; escrita é só do operador/service
-- role, que tem BYPASSRLS).
-- ------------------------------------------------------------
alter table escolas                enable row level security;
alter table usuarios               enable row level security;
alter table turmas                 enable row level security;
alter table alunos                 enable row level security;
alter table alunos_turmas          enable row level security;
alter table vinculos_responsaveis  enable row level security;
alter table trilhas                enable row level security;
alter table disciplinas            enable row level security;
alter table trilha_semanas         enable row level security;
alter table atividades_modelo      enable row level security;
alter table metas                  enable row level security;
alter table meta_atividades        enable row level security;
alter table registros_estudo       enable row level security;
alter table simulados              enable row level security;
alter table consentimentos         enable row level security;
alter table logs_acesso            enable row level security;

-- ============================================================
-- ESCOLA / MARCA — coordenação lê e escreve a própria; aluno e
-- responsável leem a própria escola (precisam da marca na tela).
-- ============================================================
create policy escolas_select on escolas for select to authenticated
  using (id = app.tenant_id());

create policy escolas_update on escolas for update to authenticated
  using (id = app.tenant_id() and app.papel() = 'coordenacao')
  with check (id = app.tenant_id());

-- ============================================================
-- USUÁRIOS — coordenação vê os da própria escola; cada um vê a si.
-- Criação de usuário é provisão (servidor), não passa por aqui.
-- ============================================================
create policy usuarios_select on usuarios for select to authenticated
  using (escola_id = app.tenant_id() and (app.papel() = 'coordenacao' or id = app.usuario_id()));

-- ============================================================
-- TURMAS — coordenação cria e gerencia (própria escola).
-- ============================================================
create policy turmas_coordenacao on turmas for all to authenticated
  using (escola_id = app.tenant_id() and app.papel() = 'coordenacao')
  with check (escola_id = app.tenant_id() and app.papel() = 'coordenacao');

-- ============================================================
-- ALUNOS — coordenação gerencia; aluno lê só o próprio;
-- responsável lê só o vinculado.
-- ============================================================
create policy alunos_select on alunos for select to authenticated
  using (
    escola_id = app.tenant_id() and (
      app.papel() = 'coordenacao'
      or (app.papel() = 'aluno' and usuario_id = app.usuario_id())
      or (app.papel() = 'responsavel' and app.sou_responsavel_de(id))
    )
  );

create policy alunos_insert on alunos for insert to authenticated
  with check (escola_id = app.tenant_id() and app.papel() = 'coordenacao');

create policy alunos_update on alunos for update to authenticated
  using (escola_id = app.tenant_id() and app.papel() = 'coordenacao')
  with check (escola_id = app.tenant_id());

create policy alunos_delete on alunos for delete to authenticated
  using (escola_id = app.tenant_id() and app.papel() = 'coordenacao');

-- ============================================================
-- ALUNOS × TURMAS — coordenação gerencia.
-- ============================================================
create policy alunos_turmas_coordenacao on alunos_turmas for all to authenticated
  using (escola_id = app.tenant_id() and app.papel() = 'coordenacao')
  with check (escola_id = app.tenant_id() and app.papel() = 'coordenacao');

-- ============================================================
-- VÍNCULO RESPONSÁVEL — coordenação cria e gerencia; o próprio
-- responsável lê o vínculo dele (pra achar o aluno vinculado).
-- ============================================================
create policy vinculos_coordenacao on vinculos_responsaveis for all to authenticated
  using (escola_id = app.tenant_id() and app.papel() = 'coordenacao')
  with check (escola_id = app.tenant_id() and app.papel() = 'coordenacao');

create policy vinculos_responsavel_select on vinculos_responsaveis for select to authenticated
  using (escola_id = app.tenant_id() and responsavel_id = app.usuario_id());

-- ============================================================
-- CONTEÚDO GLOBAL — leitura por todo usuário logado; escrita por
-- ninguém via API (só o operador, com service role / BYPASSRLS).
-- ============================================================
create policy trilhas_select on trilhas for select to authenticated using (publicada);
create policy disciplinas_select on disciplinas for select to authenticated using (true);
create policy trilha_semanas_select on trilha_semanas for select to authenticated using (true);
create policy atividades_modelo_select on atividades_modelo for select to authenticated using (true);

-- ============================================================
-- METAS — coordenação lê (alunos da escola); aluno lê só a própria;
-- responsável lê só a do vinculado. NINGUÉM escreve via API:
-- quem gera meta é o motor (servidor). Sem política de escrita.
-- ============================================================
create policy metas_select on metas for select to authenticated
  using (
    escola_id = app.tenant_id() and (
      app.papel() = 'coordenacao'
      or aluno_id = app.meu_aluno_id()
      or (app.papel() = 'responsavel' and app.sou_responsavel_de(aluno_id))
    )
  );

-- ============================================================
-- META_ATIVIDADES — leitura segue a meta; o ALUNO atualiza o
-- estado (concluída/pendente/ignorada) das atividades da própria
-- meta. Coordenação não escreve (não falsifica progresso).
-- ============================================================
create policy meta_atividades_select on meta_atividades for select to authenticated
  using (
    escola_id = app.tenant_id()
    and exists (select 1 from metas m where m.id = meta_id)  -- a RLS de metas decide
  );

create policy meta_atividades_update_aluno on meta_atividades for update to authenticated
  using (
    escola_id = app.tenant_id() and app.papel() = 'aluno'
    and exists (select 1 from metas m where m.id = meta_id and m.aluno_id = app.meu_aluno_id())
  )
  with check (escola_id = app.tenant_id());

-- ============================================================
-- REGISTROS DE ESTUDO — aluno lê e escreve o próprio; coordenação
-- lê; responsável lê o do vinculado.
-- ============================================================
create policy registros_select on registros_estudo for select to authenticated
  using (
    escola_id = app.tenant_id() and (
      app.papel() = 'coordenacao'
      or aluno_id = app.meu_aluno_id()
      or (app.papel() = 'responsavel' and app.sou_responsavel_de(aluno_id))
    )
  );

create policy registros_insert_aluno on registros_estudo for insert to authenticated
  with check (escola_id = app.tenant_id() and app.papel() = 'aluno' and aluno_id = app.meu_aluno_id());

create policy registros_update_aluno on registros_estudo for update to authenticated
  using (escola_id = app.tenant_id() and app.papel() = 'aluno' and aluno_id = app.meu_aluno_id())
  with check (escola_id = app.tenant_id() and aluno_id = app.meu_aluno_id());

create policy registros_delete_aluno on registros_estudo for delete to authenticated
  using (escola_id = app.tenant_id() and app.papel() = 'aluno' and aluno_id = app.meu_aluno_id());

-- ============================================================
-- SIMULADOS — mesmas regras dos registros de estudo.
-- ============================================================
create policy simulados_select on simulados for select to authenticated
  using (
    escola_id = app.tenant_id() and (
      app.papel() = 'coordenacao'
      or aluno_id = app.meu_aluno_id()
      or (app.papel() = 'responsavel' and app.sou_responsavel_de(aluno_id))
    )
  );

create policy simulados_insert_aluno on simulados for insert to authenticated
  with check (escola_id = app.tenant_id() and app.papel() = 'aluno' and aluno_id = app.meu_aluno_id());

create policy simulados_delete_aluno on simulados for delete to authenticated
  using (escola_id = app.tenant_id() and app.papel() = 'aluno' and aluno_id = app.meu_aluno_id());

-- ============================================================
-- CONSENTIMENTOS — coordenação cria e gerencia (controladora).
-- Aluno e responsável: nada (matriz do Doc 6).
-- ============================================================
create policy consentimentos_coordenacao on consentimentos for all to authenticated
  using (escola_id = app.tenant_id() and app.papel() = 'coordenacao')
  with check (escola_id = app.tenant_id() and app.papel() = 'coordenacao');

-- ============================================================
-- LOGS DE ACESSO — quem acessa dado de aluno registra o próprio
-- acesso (insert do próprio usuário); coordenação lê os da escola.
-- Ninguém edita nem apaga log via API.
-- ============================================================
create policy logs_insert on logs_acesso for insert to authenticated
  with check (escola_id = app.tenant_id() and usuario_id = app.usuario_id() and papel = app.papel());

create policy logs_select_coordenacao on logs_acesso for select to authenticated
  using (escola_id = app.tenant_id() and app.papel() = 'coordenacao');
