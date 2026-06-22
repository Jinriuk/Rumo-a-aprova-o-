-- ============================================================
-- 0031 — D1A.1: corrigir o status das escolas de VITRINE/DEMO
-- ------------------------------------------------------------
-- Causa-raiz (ver docs/auditoria/d1a/01-correcao-acesso-coordenacao.md):
-- após a S1 (0027), o status da escola passou a VALER na RLS via
-- app.tenant_operacional(). As escolas de vitrine/demo ficaram em
-- 'implantacao' (default histórico da 0021), um estado ambíguo: o
-- gate de RLS o trata como operacional, mas o checklist do backoffice
-- ("Acesso liberado · status ativa") o trata como NÃO-liberado. Pior:
-- se a escola for marcada 'suspensa' (teste da S1), a coordenação
-- ENTRA mas vê painel vazio sem explicação (todo dado some na RLS).
--
-- Esta migration NÃO afrouxa segurança: o bloqueio de suspensa/
-- cancelada continua de pé. Ela só CORRIGE o status das escolas de
-- DEMO (vitrine/beta) para 'ativa' — dado de demonstração, não dado
-- real de cliente (regra 12 da D1A). Escopo travado por slug.
-- Idempotente; só promove a 'ativa' quem está num estado pré-ativação
-- (nunca "reativa" no escuro uma escola que o operador suspendeu).
-- ============================================================

update escolas
   set status = 'ativa',
       atualizada_em = now()
 where slug in ('vitrine', 'beta')
   and status in ('implantacao', 'demo', 'piloto');
