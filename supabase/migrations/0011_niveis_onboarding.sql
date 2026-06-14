-- ============================================================
-- 0011 — NÍVEIS DE ALUNO E ONBOARDING PEDAGÓGICO (Fase 15.3)
-- ------------------------------------------------------------
-- Estrutura para classificar o aluno por NÍVEL (geral e por matéria),
-- registrar o ONBOARDING pedagógico e dar à coordenação o ajuste
-- manual com rastreabilidade. Tudo isolado por escola (RLS).
--
-- Não é motor adaptativo: o cálculo de nível é uma lógica pura,
-- simples e testável (app/.../niveisAluno.js). Aqui ficam só as
-- tabelas, a RLS e o gatilho de histórico (à prova de adulteração).
-- A lógica é por exam_tag (alunos.concurso_id), nunca por turma.
--
-- Aditiva: nada das migrations 0001–0010 é alterado. Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Alvo pedagógico: o secundário (opcional, dentro da mesma turma
--    comercial). O principal já é alunos.concurso_id (D2). Data da
--    prova, especialidade e ciclo já vieram na 0008.
-- ------------------------------------------------------------
alter table alunos
  add column if not exists concurso_secundario_id uuid references concursos (id);

-- ------------------------------------------------------------
-- 2) NÍVEIS do aluno. Uma linha por escopo: 'geral' OU o código da
--    matéria ('mat','por',...). Assim o nível geral e o nível por
--    matéria moram na mesma tabela, sem coluna explodida.
--    origem: como o nível chegou ali (calculado/manual/diagnóstico/
--    validar) — preserva a honestidade do dado (sem precisão falsa).
-- ------------------------------------------------------------
create table if not exists aluno_niveis (
  id            uuid primary key default gen_random_uuid(),
  escola_id     uuid not null references escolas (id) on delete cascade,
  aluno_id      uuid not null references alunos (id)  on delete cascade,
  escopo        text not null,                 -- 'geral' ou código de matéria
  nivel         text not null check (nivel in ('base', 'intermediario', 'avancado', 'reta_final')),
  origem        text not null default 'validar' check (origem in ('calculado', 'manual', 'diagnostico', 'validar')),
  motivo        text,
  definido_por  uuid references usuarios (id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (aluno_id, escopo)
);

-- ------------------------------------------------------------
-- 3) HISTÓRICO de nível (trilha de auditoria append-only). Escrito
--    SÓ pelo gatilho (SECURITY DEFINER) — ninguém insere/edita via
--    API. A coordenação lê para ver quem mudou, quando e por quê.
-- ------------------------------------------------------------
create table if not exists aluno_nivel_historico (
  id              bigint generated always as identity primary key,
  escola_id       uuid not null references escolas (id) on delete cascade,
  aluno_id        uuid not null,               -- sem FK: o log sobrevive à exclusão do aluno
  escopo          text not null,
  nivel_anterior  text,
  nivel_novo      text not null,
  origem          text not null,
  motivo          text,
  alterado_por    uuid,
  em              timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4) ONBOARDING pedagógico (1:1 com o aluno). Captura o que o
--    diagnóstico inicial e a coordenação informam. Campos abertos
--    de propósito (texto) — é insumo, não regra.
-- ------------------------------------------------------------
create table if not exists aluno_onboarding (
  aluno_id               uuid primary key references alunos (id) on delete cascade,
  escola_id              uuid not null references escolas (id) on delete cascade,
  experiencia_previa     text,                 -- ex.: 'nunca estudou' | 'estuda há 1 ano'
  disponibilidade_semanal_h int check (disponibilidade_semanal_h is null or disponibilidade_semanal_h between 0 and 168),
  maior_dificuldade      text,
  objetivo               text,
  observacao_coordenacao text,
  concluido_em           timestamptz,
  atualizado_em          timestamptz not null default now()
);

create index if not exists idx_aluno_niveis_aluno     on aluno_niveis (aluno_id);
create index if not exists idx_aluno_nivel_hist_aluno on aluno_nivel_historico (aluno_id, em);

-- ------------------------------------------------------------
-- Gatilho de histórico: registra toda criação/alteração de nível.
-- SECURITY DEFINER para escrever no histórico sem depender da RLS
-- (a auditoria não pode ser burlada nem bloqueada pelo chamador).
-- ------------------------------------------------------------
create or replace function app.registrar_nivel_historico() returns trigger
language plpgsql security definer set search_path = public, app as $$
begin
  if tg_op = 'UPDATE' and new.nivel is not distinct from old.nivel
     and new.origem is not distinct from old.origem then
    return new;  -- nada relevante mudou: não polui o histórico
  end if;
  insert into aluno_nivel_historico (escola_id, aluno_id, escopo, nivel_anterior, nivel_novo, origem, motivo, alterado_por)
    values (new.escola_id, new.aluno_id, new.escopo,
            case when tg_op = 'UPDATE' then old.nivel else null end,
            new.nivel, new.origem, new.motivo, new.definido_por);
  return new;
end $$;

drop trigger if exists trg_nivel_historico on aluno_niveis;
create trigger trg_nivel_historico
  after insert or update on aluno_niveis
  for each row execute function app.registrar_nivel_historico();

-- ============================================================
-- RLS — isolado por escola (doutrina da 0002).
--   • aluno_niveis: coordenação lê/escreve a própria escola; aluno lê
--     o PRÓPRIO nível (não edita); responsável lê o do vinculado.
--   • aluno_onboarding: mesma matriz de leitura; escrita só coordenação.
--   • aluno_nivel_historico: leitura só coordenação; escrita só gatilho.
-- ============================================================
alter table aluno_niveis          enable row level security;
alter table aluno_nivel_historico enable row level security;
alter table aluno_onboarding      enable row level security;

-- NÍVEIS — leitura
create policy aluno_niveis_select on aluno_niveis for select to authenticated
  using (
    escola_id = app.tenant_id() and (
      app.papel() = 'coordenacao'
      or aluno_id = app.meu_aluno_id()
      or (app.papel() = 'responsavel' and app.sou_responsavel_de(aluno_id))
    )
  );
-- NÍVEIS — escrita só da coordenação (o aluno NÃO edita o próprio nível)
create policy aluno_niveis_coordenacao on aluno_niveis for all to authenticated
  using      (escola_id = app.tenant_id() and app.papel() = 'coordenacao')
  with check (escola_id = app.tenant_id() and app.papel() = 'coordenacao');

-- ONBOARDING — leitura (mesma matriz)
create policy aluno_onboarding_select on aluno_onboarding for select to authenticated
  using (
    escola_id = app.tenant_id() and (
      app.papel() = 'coordenacao'
      or aluno_id = app.meu_aluno_id()
      or (app.papel() = 'responsavel' and app.sou_responsavel_de(aluno_id))
    )
  );
create policy aluno_onboarding_coordenacao on aluno_onboarding for all to authenticated
  using      (escola_id = app.tenant_id() and app.papel() = 'coordenacao')
  with check (escola_id = app.tenant_id() and app.papel() = 'coordenacao');

-- HISTÓRICO — só a coordenação lê; escrita é exclusiva do gatilho.
create policy aluno_nivel_hist_select on aluno_nivel_historico for select to authenticated
  using (escola_id = app.tenant_id() and app.papel() = 'coordenacao');

grant select, insert, update, delete on aluno_niveis, aluno_onboarding to authenticated, service_role;
grant select on aluno_nivel_historico to authenticated;
grant insert on aluno_nivel_historico to service_role;
