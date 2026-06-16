-- Fase A.8: trilha mínima de ações sensíveis da coordenação que hoje não
-- deixam rastro nenhum (turma criada/renomeada/excluída, alunos importados
-- em lote, marca alterada). NÃO substitui logs_acesso (trilha LGPD por
-- aluno; aluno_id é obrigatório lá) nem admin_logs (trilha do operador,
-- restrita a super_admin) — é o equivalente para ações de coordenação que
-- não têm necessariamente um aluno associado. Append-only, como as outras
-- trilhas: sem policy de update/delete.
create table if not exists logs_coordenacao (
  id          bigint generated always as identity primary key,
  escola_id   uuid not null references escolas (id) on delete cascade,
  usuario_id  uuid not null,
  papel       text not null,
  acao        text not null,                 -- ex.: 'criou-turma', 'importou-alunos'
  entidade    text,                           -- ex.: 'turma', 'aluno', 'escola'
  entidade_id uuid,
  detalhe     jsonb not null default '{}'::jsonb,
  em          timestamptz not null default now()
);

create index if not exists idx_logs_coordenacao_escola on logs_coordenacao (escola_id, em);

alter table logs_coordenacao enable row level security;

-- só a própria coordenação grava, só para a própria escola, só como si mesma.
create policy logs_coordenacao_insert on logs_coordenacao for insert to authenticated
  with check (
    escola_id = app.tenant_id() and usuario_id = app.usuario_id()
    and papel = app.papel() and papel = 'coordenacao'
  );

create policy logs_coordenacao_select on logs_coordenacao for select to authenticated
  using (escola_id = app.tenant_id() and app.papel() = 'coordenacao');

grant select, insert on logs_coordenacao to authenticated;
revoke all on logs_coordenacao from anon;
