-- ============================================================
-- 0053 — N02: consentimentos.registrado_em (quando a LINHA foi gravada)
-- ------------------------------------------------------------
-- APROVAÇÃO: migration em ambiente compartilhado com produção e com
-- gatilho novo — não aplicar sem a aprovação explícita no PR do Bloco 2.
--
-- O achado (revisão de 23/09/2026): os 7 consentimentos do tenant de
-- demonstração entraram numa única transação, DEPOIS das capturas de
-- 19/09, com `aceito_em` retroativo (26/08 a 01/09). A tabela não
-- guardava quando a linha foi criada, então nada no banco distinguia
-- "o responsável aceitou em 26/08" de "alguém digitou em 20/09 que o
-- responsável aceitou em 26/08". Para uma prova de consentimento, essa
-- é a diferença que importa.
--
--   aceito_em     = quando o responsável aceitou (declarado; pode ser
--                   retroativo — termo em papel lançado depois)
--   registrado_em = quando a linha entrou no banco (o real, para toda
--                   linha gravada depois desta migration)
--
-- Linhas existentes: o `default now()` de um ADD COLUMN é avaliado UMA
-- vez, no momento da migration — é esse o valor que elas recebem. Não
-- há como saber o instante real delas; o momento da migration é o
-- limite SUPERIOR honesto: a linha foi gravada até ali, nunca depois.
--
-- Por que um gatilho e não só o default: a coordenação tem INSERT e
-- UPDATE em todas as colunas de consentimentos (grant de tabela da
-- 0002 + policy consentimentos_coordenacao). Só com o default, qualquer
-- coordenador mandaria registrado_em = '2026-08-26' pela API e a
-- coluna mentiria como aceito_em. O gatilho força: no INSERT, now(); no
-- UPDATE, o valor antigo. SECURITY INVOKER, sem ler tabela nenhuma.
-- ============================================================

alter table public.consentimentos
  add column if not exists registrado_em timestamptz not null default now();

comment on column public.consentimentos.registrado_em is
  'N02 (0053): quando a linha foi gravada no banco, forçado por gatilho. Linhas anteriores à 0053 guardam o momento da migration (limite superior, não o instante real). aceito_em é o que foi declarado e pode ser retroativo.';

create or replace function app.consentimento_registrado_em()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.registrado_em := now();
  else
    new.registrado_em := old.registrado_em;
  end if;
  return new;
end
$$;

revoke all on function app.consentimento_registrado_em() from public;

drop trigger if exists trg_consentimento_registrado_em on public.consentimentos;
create trigger trg_consentimento_registrado_em
  before insert or update on public.consentimentos
  for each row execute function app.consentimento_registrado_em();
