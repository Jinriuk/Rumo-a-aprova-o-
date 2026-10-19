-- ============================================================
-- DEMO (bdjkgrzfzoamchdpobbl) — filtros do CFO PMERJ com banca preferida FGV.
-- Saída de: node scripts/quest-cobertura.mjs --sql --ativar <16 chaves> (faab87d).
-- Rodar SÓ depois da 0066 e da questoes-integradas de faab87d publicada.
-- ============================================================
-- Gerado por scripts/quest-cobertura.mjs --sql a partir de supabase/seed/quest-filtros-pmerj-cfo-v1.json.
-- Exige a 0066 e as missões do CFO PMERJ publicadas (P0.6).
-- Ligadas: PMERJ-M01-ADM, PMERJ-M01-CONST, PMERJ-M01-PEN, PMERJ-M01-CPP, PMERJ-M01-CPM, PMERJ-M01-DH, PMERJ-M02-ADM, PMERJ-M02-CONST, PMERJ-M02-CPP, PMERJ-M02-DH, PMERJ-M03-ADM, PMERJ-M03-CONST, PMERJ-M03-PEN, PMERJ-M03-CPP, PMERJ-M03-CPM, PMERJ-M03-DH.
-- Banca preferida: FGV (0066: busca nela até esgotar, depois em qualquer banca).
begin;
insert into app.quest_filtros_missao (missao_id, materia, assunto, assunto_id_fornecedor, ativo, observacao, banca_preferida)
select d.missao_id, d.materia, d.assunto, d.assunto_id, d.ativo, d.observacao, 'FGV'
  from (values
  ('7728d300-be18-4a72-83d2-7fe1298fdb0a'::uuid, 'Direito Administrativo', 'Organização Administrativa', null, true, 'PMERJ-M01-ADM'),
  ('9316e253-4447-4c83-85f3-ac821e51de63'::uuid, 'Direito Constitucional', 'Aplicabilidade das normas constitucionais, eficácia e aplicabilidade das normas constitucionais ou classificação das normas constitucionais ou vigência e eficácia das normas constitucionais ou normas constitucionais: classificação e eficácia', null, true, 'PMERJ-M01-CONST'),
  ('1c9d395e-712c-4bc3-8581-510f6939eade'::uuid, 'Direito Penal', 'Lei penal no tempo', null, true, 'PMERJ-M01-PEN'),
  ('05c1a28b-0665-46d9-8436-85cea84de1ef'::uuid, 'Direito Processual Penal', 'Princípios do Direito Processual Penal', null, true, 'PMERJ-M01-CPP'),
  ('b95f3a5a-3e32-4646-8e0f-84add9fef021'::uuid, 'Direito Penal Militar', 'Aplicação da Lei Penal Militar', null, true, 'PMERJ-M01-CPM'),
  ('92bb8154-6418-4744-84c0-b9bf5e6b32d0'::uuid, 'Direitos Humanos', 'Direitos Humanos no Ordenamento Nacional', null, true, 'PMERJ-M01-DH'),
  ('ca8a6bc3-cbac-4ae7-82a1-6bd48548af8e'::uuid, 'Direito Administrativo', 'Atos Administrativos', null, true, 'PMERJ-M02-ADM'),
  ('5417e635-9aa3-4a2b-87a6-128e1f0e81ff'::uuid, 'Direito Constitucional', 'Direitos e deveres individuais e coletivos ou direitos e deveres individuais e coletivos; direito à vida, à liberdade, à igualdade,àsegurançaeàpropriedade (artigo 5º da CF)', null, true, 'PMERJ-M02-CONST'),
  ('60b90ac5-2c9c-4ecd-8a08-f44f34722b4f'::uuid, 'Direito Penal', 'Fato Típico', null, false, 'PMERJ-M02-PEN'),
  ('337e314f-3b26-4164-89ed-10822917bc74'::uuid, 'Direito Processual Penal', 'Inquérito policial', null, true, 'PMERJ-M02-CPP'),
  ('cfbf6f01-e897-4291-82cf-74fd4875158e'::uuid, 'Direito Penal Militar', 'Culpabilidade e Imputabilidade', null, false, 'PMERJ-M02-CPM'),
  ('533bb1c0-fa99-4f7b-8e7b-bd4357ad7659'::uuid, 'Direitos Humanos', 'Convenção Americana sobre Direitos Humanos (Pacto de San José)', null, true, 'PMERJ-M02-DH'),
  ('642fb6a7-93bb-4633-8e7c-95be1543ea62'::uuid, 'Direito Administrativo', 'Processo Administrativo Disciplinar', null, true, 'PMERJ-M03-ADM'),
  ('84092195-23aa-4d05-8a8a-125a2d7eea31'::uuid, 'Direito Constitucional', 'Ações de controle concentrado de constitucionalidade', null, true, 'PMERJ-M03-CONST'),
  ('9c77a0f6-1c32-459c-827c-d9695571a178'::uuid, 'Direito Penal', 'Culpabilidade', null, true, 'PMERJ-M03-PEN'),
  ('5e057b4e-b5b0-4ebc-82d6-314d702ab5eb'::uuid, 'Direito Processual Penal', 'Ação penal', null, true, 'PMERJ-M03-CPP'),
  ('cef3d2ce-6e62-4fb8-863a-cc01a8128b8a'::uuid, 'Direito Penal Militar', 'Das Penas', null, true, 'PMERJ-M03-CPM'),
  ('887e70b7-0283-4ce8-8ae2-6b341fcdf9fa'::uuid, 'Direitos Humanos', 'Sistema Interamericano de Proteção aos Direitos Humanos: Instituições', null, true, 'PMERJ-M03-DH'),
  ('d8238ad0-bf63-4037-8682-bd8f5ab90a2b'::uuid, 'Direito Administrativo', 'Lei nº 12.527/2011 - Lei de Acesso à Informação', null, false, 'PMERJ-M04-ADM'),
  ('f45fbec1-d44f-4162-8438-3541ecbafd29'::uuid, 'Direito Constitucional', 'Remédios constitucionais ou writs constitucionais ou ações constitucionais ou garantias constitucionais', null, false, 'PMERJ-M04-CONST'),
  ('fb411a84-9b9f-4065-850a-671206a4d3d4'::uuid, 'Direito Penal', 'Prescrição', null, false, 'PMERJ-M04-PEN'),
  ('4edc501d-f213-4960-8ba5-f55292bc0b14'::uuid, 'Direito Processual Penal', 'Incidente de insanidade', null, false, 'PMERJ-M04-CPP'),
  ('a0ad28d9-b925-48be-861b-33653fce29c8'::uuid, 'Direito Penal Militar', 'Suspensão Condicional da Pena', null, false, 'PMERJ-M04-CPM'),
  ('08b09658-1e72-4a35-8695-f9ad26415b40'::uuid, 'Direitos Humanos', 'Uso da Força e Letalidade Policial', null, false, 'PMERJ-M04-DH · filtro não conferido')
  ) as d(missao_id, materia, assunto, assunto_id, ativo, observacao)
  join public.missoes m on m.id = d.missao_id
on conflict (missao_id) do update set
  materia = excluded.materia,
  assunto = excluded.assunto,
  assunto_id_fornecedor = excluded.assunto_id_fornecedor,
  ativo = excluded.ativo,
  observacao = excluded.observacao,
  banca_preferida = excluded.banca_preferida,
  -- filtro mudou: a paginação recomeça
  cursor = case when app.quest_filtros_missao.materia is distinct from excluded.materia
                          or app.quest_filtros_missao.assunto is distinct from excluded.assunto
                          or app.quest_filtros_missao.assunto_id_fornecedor is distinct from excluded.assunto_id_fornecedor
                        then null else app.quest_filtros_missao.cursor end,
  -- a busca com banca recomeça também quando a banca muda
  cursor_preferida = case when app.quest_filtros_missao.materia is distinct from excluded.materia
                          or app.quest_filtros_missao.assunto is distinct from excluded.assunto
                          or app.quest_filtros_missao.assunto_id_fornecedor is distinct from excluded.assunto_id_fornecedor
                          or app.quest_filtros_missao.banca_preferida is distinct from excluded.banca_preferida
                        then null else app.quest_filtros_missao.cursor_preferida end,
  esgotada_em = null,
  preferida_esgotada_em = null,
  atualizado_em = now();
do $$ begin
  if (select count(*) from app.quest_filtros_missao f join public.missoes m on m.id = f.missao_id
       where m.exam_tag = 'pmerj_cfo') <> 24 then
    raise exception 'quest: nem todas as 24 missões do CFO PMERJ estão no banco (rodar depois da P0.6)';
  end if;
end $$;
commit;
-- conferência: 24 linhas, 16 ativas, 24 com FGV; cursores gerais preservados
select count(*) total, count(*) filter (where ativo) ativos,
       count(*) filter (where banca_preferida = 'FGV') com_fgv,
       count(*) filter (where cursor is not null) com_cursor_geral,
       count(*) filter (where cursor_preferida is not null) com_cursor_fgv
  from app.quest_filtros_missao;
-- como a banca está gravada no estoque (a ordem FGV-primeiro compara sem maiúscula)
select upper(banca) as banca, count(*) from app.quest_questoes group by 1 order by 2 desc limit 10;
