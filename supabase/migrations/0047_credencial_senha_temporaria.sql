-- ============================================================
-- 0047 — Etapa 7 / BLOCO B1-B5: senha temporária separada do código
-- ------------------------------------------------------------
-- Até aqui (provisionar-aluno): password = normalizarCodigo(codigo) — o
-- código que a escola entrega É a senha do Auth, reutilizável para
-- sempre por quem o vir uma vez (bilhete, foto, ombro). A fundação da
-- migration 0044 desenhou uma saída via PROXY de hash (código nunca
-- digitado como senha, senha opaca invisível ao aluno) — mas essa não é
-- a direção decidida agora: o modelo aqui é "código identifica, senha
-- autentica" com os DOIS campos conhecidos e digitados pelo aluno
-- (senha pessoal, trocável, recuperável), não um proxy que esconde a
-- senha do próprio dono dela. Por isso este corte usa autenticação
-- NATIVA do GoTrue (signInWithPassword direto, igual ao login da
-- coordenação já funciona) e NÃO toca em app.acessos_codigo/
-- app.login_tentativas (0044) — ficam dormentes, sem dois fluxos
-- concorrentes disputando o mesmo login.
--
-- Duas colunas, as duas escritas SÓ pelo service_role (Edge Functions):
--   • must_change_password — true ao provisionar/resetar; falso depois
--     que o próprio dono troca a senha (trocar-senha, Edge Function).
--     É o gate que bloqueia telas de aluno/responsável até a troca (B2).
--   • credencial_status — 'ativa'/'revogada'. ESPELHA o ban do Auth
--     (auth.admin.updateUserById com ban_duration) para o front/RLS
--     poderem ler o estado sem chamar a Admin API — a ENFORCEMENT real
--     do bloqueio de login é o ban no GoTrue; esta coluna é só a
--     fonte de verdade LEGÍVEL pela coordenação (B5).
-- ============================================================

alter table usuarios
  add column if not exists must_change_password boolean not null default false;

alter table usuarios
  add column if not exists credencial_status text not null default 'ativa';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'usuarios_credencial_status_check' and conrelid = 'usuarios'::regclass
  ) then
    alter table usuarios
      add constraint usuarios_credencial_status_check
      check (credencial_status in ('ativa', 'revogada'));
  end if;
end $$;

comment on column usuarios.must_change_password is
  '0047: true logo após provisionar-aluno criar a conta (senha temporária) '
  'ou depois de um reset pela coordenação — bloqueia o uso normal do app '
  '(App.jsx) até a Edge Function trocar-senha zerar a flag. Escrito só '
  'pelo service_role; coordenação/aluno nunca escrevem aqui direto.';

comment on column usuarios.credencial_status is
  '0047: espelho LEGÍVEL do estado do Auth (banido/ativo) para a tela da '
  'coordenação — quem BLOQUEIA o login de verdade é o ban_duration do '
  'GoTrue (auth.admin.updateUserById), não esta coluna. Escrito só pelo '
  'service_role, junto com a chamada que bane/reativa a conta, para os '
  'dois nunca divergirem.';

-- Defesa em profundidade: `usuarios` já não tinha NENHUMA policy de RLS
-- para UPDATE (só usuarios_select) — authenticated já estava bloqueado
-- na prática. Este revoke fecha o grant em lote da 0001 na CAMADA DE
-- BAIXO também (mesmo raciocínio da 0040/0046): se um dia alguém
-- adicionar uma policy de update por engano, o grant já não existe pra
-- ela valer. Idempotente.
revoke update on usuarios from authenticated;

-- ------------------------------------------------------------
-- ROLLBACK (manual, se necessário):
--   grant update on usuarios to authenticated;  -- volta ao grant em lote da 0001
--   alter table usuarios drop constraint usuarios_credencial_status_check;
--   alter table usuarios drop column credencial_status;
--   alter table usuarios drop column must_change_password;
-- ------------------------------------------------------------
