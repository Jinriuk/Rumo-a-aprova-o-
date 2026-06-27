# Plano de migração para `sa-east-1` (S1.7)

> A região do Supabase **não muda in-place**. Migrar = criar um **novo
> projeto** em `sa-east-1` e mover schema + dados + chaves. Este é o
> plano; a execução é do dono (regra S1: não migrar automaticamente).

## Estado atual
- Projeto de demo: `bdjkgrzfzoamchdpobbl` em **`us-east-1`**.
- **Sem dado real de aluno hoje** — só vitrine/demo.

## Por que migrar
Dado pessoal de menores deve, na prática, morar no Brasil (LGPD,
latência, narrativa comercial). Ver `docs/operacao/lgpd-e-infra.md`.

## Janela ideal
**Antes de onboardear a primeira escola real** — migra-se um banco sem
PII, risco mínimo. Idealmente o projeto de produção **já nasce** em
`sa-east-1`, no plano Pro, com backup (junta S1.6 + S1.7).

## Passo a passo
1. **Criar projeto novo** em `sa-east-1` (plano Pro recomendado).
2. **Aplicar migrations** (tracking preservado):
   ```bash
   supabase link --project-ref <REF_SA_EAST_1>
   supabase db push        # 0001..0027, idempotentes
   ```
3. **Aplicar seeds** de catálogo (05–12) e, se quiser demo, 13–17
   (idempotentes). **Não** levar dado de teste para o projeto de
   produção real.
4. **Recriar contas de Auth** (seed 04 / scripts de operador) e o
   super_admin inicial (`app.registrar_super_admin`).
5. **Trocar as chaves** no front e no Vercel:
   - `app/.env.production`: nova `VITE_SUPABASE_URL` + nova anon key.
   - Variáveis do Vercel (produção).
6. **Edge Functions**: re-deploy no projeto novo; reconfigurar segredos
   (`SUPABASE_SERVICE_ROLE_KEY` etc.) **só no ambiente da função**.
7. **Smoke** (ver `docs/auditoria/s1/11-smoke-producao.md`): login dos 3
   papéis, backoffice, bloqueio de suspensa.
8. **Cron** (`virar-semana`) reagendado no projeto novo.

## Rollback
Enquanto o projeto antigo existir e as chaves não forem propagadas a
escolas reais, o rollback é **apontar o front de volta** para o projeto
antigo. Por isso a janela "antes de dado real" é a mais segura.

## Critério de conclusão
Front e Vercel apontando para `sa-east-1`; smoke verde; cron ativo;
backup confirmado (S1.6). Gate de região de `lgpd-e-infra.md` satisfeito.
