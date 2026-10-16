-- ============================================================
-- PRODUÇÃO (zckyhihxjjbnqjqilymn) — NÃO RODAR sem aprovação do dono.
-- Missão resolvida por exam_tag + nome (guarda: 24 resolvidas; no fim, 24 linhas e 16 ativas).
-- Ordem: 0066 → questoes-integradas de faab87d → este arquivo.
-- ============================================================
begin;
create temp table _qf on commit drop as
select m.id as missao_id, d.*
  from (values
  ('PMERJ-M01-ADM', 'Organização administrativa: direta, indireta e delegação', 'Direito Administrativo', 'Organização Administrativa', null, true, 'PMERJ-M01-ADM'),
  ('PMERJ-M01-CONST', 'Eficácia das normas e limites da reforma', 'Direito Constitucional', 'Aplicabilidade das normas constitucionais, eficácia e aplicabilidade das normas constitucionais ou classificação das normas constitucionais ou vigência e eficácia das normas constitucionais ou normas constitucionais: classificação e eficácia', null, true, 'PMERJ-M01-CONST'),
  ('PMERJ-M01-PEN', 'Lei penal no tempo e no espaço', 'Direito Penal', 'Lei penal no tempo', null, true, 'PMERJ-M01-PEN'),
  ('PMERJ-M01-CPP', 'Sistema processual e aplicação da lei processual', 'Direito Processual Penal', 'Princípios do Direito Processual Penal', null, true, 'PMERJ-M01-CPP'),
  ('PMERJ-M01-CPM', 'Quando o caso é militar', 'Direito Penal Militar', 'Aplicação da Lei Penal Militar', null, true, 'PMERJ-M01-CPM'),
  ('PMERJ-M01-DH', 'Proteção constitucional e convencional', 'Direitos Humanos', 'Direitos Humanos no Ordenamento Nacional', null, true, 'PMERJ-M01-DH'),
  ('PMERJ-M02-ADM', 'Poderes e elementos do ato administrativo', 'Direito Administrativo', 'Atos Administrativos', null, true, 'PMERJ-M02-ADM'),
  ('PMERJ-M02-CONST', 'Direitos fundamentais e direitos políticos', 'Direito Constitucional', 'Direitos e deveres individuais e coletivos ou direitos e deveres individuais e coletivos; direito à vida, à liberdade, à igualdade,àsegurançaeàpropriedade (artigo 5º da CF)', null, true, 'PMERJ-M02-CONST'),
  ('PMERJ-M02-PEN', 'Fato típico: conduta, nexo, dolo e culpa', 'Direito Penal', 'Fato Típico', null, false, 'PMERJ-M02-PEN'),
  ('PMERJ-M02-CPP', 'Inquérito, arquivamento e acordo de não persecução', 'Direito Processual Penal', 'Inquérito policial', null, true, 'PMERJ-M02-CPP'),
  ('PMERJ-M02-CPM', 'Crime militar, imputabilidade e concurso de agentes', 'Direito Penal Militar', 'Culpabilidade e Imputabilidade', null, false, 'PMERJ-M02-CPM'),
  ('PMERJ-M02-DH', 'Sistemas de proteção e seus órgãos', 'Direitos Humanos', 'Convenção Americana sobre Direitos Humanos (Pacto de San José)', null, true, 'PMERJ-M02-DH'),
  ('PMERJ-M03-ADM', 'Responsabilidades do agente e processo disciplinar', 'Direito Administrativo', 'Processo Administrativo Disciplinar', null, true, 'PMERJ-M03-ADM'),
  ('PMERJ-M03-CONST', 'Controle concentrado: ADI e ADC', 'Direito Constitucional', 'Ações de controle concentrado de constitucionalidade', null, true, 'PMERJ-M03-CONST'),
  ('PMERJ-M03-PEN', 'Tentativa, ilicitude e culpabilidade', 'Direito Penal', 'Culpabilidade', null, true, 'PMERJ-M03-PEN'),
  ('PMERJ-M03-CPP', 'Ação penal e competência', 'Direito Processual Penal', 'Ação penal', null, true, 'PMERJ-M03-CPP'),
  ('PMERJ-M03-CPM', 'Penas e aplicação da pena no Código Penal Militar', 'Direito Penal Militar', 'Das Penas', null, true, 'PMERJ-M03-CPM'),
  ('PMERJ-M03-DH', 'Sistema interamericano aplicado', 'Direitos Humanos', 'Sistema Interamericano de Proteção aos Direitos Humanos: Instituições', null, true, 'PMERJ-M03-DH'),
  ('PMERJ-M04-ADM', 'Acesso à informação, dados pessoais e correção do simulado', 'Direito Administrativo', 'Lei nº 12.527/2011 - Lei de Acesso à Informação', null, false, 'PMERJ-M04-ADM'),
  ('PMERJ-M04-CONST', 'Ações constitucionais e correção do simulado', 'Direito Constitucional', 'Remédios constitucionais ou writs constitucionais ou ações constitucionais ou garantias constitucionais', null, false, 'PMERJ-M04-CONST'),
  ('PMERJ-M04-PEN', 'Prescrição, punibilidade e correção do simulado', 'Direito Penal', 'Prescrição', null, false, 'PMERJ-M04-PEN'),
  ('PMERJ-M04-CPP', 'Incidentes processuais e correção do simulado', 'Direito Processual Penal', 'Incidente de insanidade', null, false, 'PMERJ-M04-CPP'),
  ('PMERJ-M04-CPM', 'Suspensão, livramento, efeitos e correção do simulado', 'Direito Penal Militar', 'Suspensão Condicional da Pena', null, false, 'PMERJ-M04-CPM'),
  ('PMERJ-M04-DH', 'Letalidade policial e correção do simulado', 'Direitos Humanos', 'Uso da Força e Letalidade Policial', null, false, 'PMERJ-M04-DH · filtro não conferido')
  ) as d(chave, nome, materia, assunto, assunto_id, ativo, observacao)
  join public.missoes m on m.exam_tag = 'pmerj_cfo' and m.nome = d.nome;
do $$ begin
  if (select count(distinct missao_id) from _qf) <> 24 or (select count(*) from _qf) <> 24 then
    raise exception 'guarda: % de 24 missões resolvidas por nome', (select count(distinct missao_id) from _qf);
  end if;
end $$;
insert into app.quest_filtros_missao (missao_id, materia, assunto, assunto_id_fornecedor, ativo, observacao, banca_preferida)
select missao_id, materia, assunto, assunto_id, ativo, observacao, 'FGV' from _qf
on conflict (missao_id) do update set
  materia = excluded.materia,
  assunto = excluded.assunto,
  assunto_id_fornecedor = excluded.assunto_id_fornecedor,
  ativo = excluded.ativo,
  observacao = excluded.observacao,
  banca_preferida = excluded.banca_preferida,
  cursor = case when app.quest_filtros_missao.materia is distinct from excluded.materia
                          or app.quest_filtros_missao.assunto is distinct from excluded.assunto
                          or app.quest_filtros_missao.assunto_id_fornecedor is distinct from excluded.assunto_id_fornecedor
                        then null else app.quest_filtros_missao.cursor end,
  cursor_preferida = case when app.quest_filtros_missao.materia is distinct from excluded.materia
                          or app.quest_filtros_missao.assunto is distinct from excluded.assunto
                          or app.quest_filtros_missao.assunto_id_fornecedor is distinct from excluded.assunto_id_fornecedor
                          or app.quest_filtros_missao.banca_preferida is distinct from excluded.banca_preferida
                        then null else app.quest_filtros_missao.cursor_preferida end,
  esgotada_em = null,
  preferida_esgotada_em = null,
  atualizado_em = now();
do $$ begin
  if (select count(*) from app.quest_filtros_missao f join public.missoes m on m.id = f.missao_id where m.exam_tag = 'pmerj_cfo') <> 24
     or (select count(*) from app.quest_filtros_missao f join public.missoes m on m.id = f.missao_id where m.exam_tag = 'pmerj_cfo' and f.ativo) <> 16 then
    raise exception 'guarda: filtros fora do esperado (24 linhas, 16 ativas)';
  end if;
end $$;
commit;
select count(*) total, count(*) filter (where ativo) ativos, count(*) filter (where banca_preferida = 'FGV') com_fgv from app.quest_filtros_missao;
