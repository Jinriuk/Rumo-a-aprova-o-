# Prompt de execução — BKL-004 e BKL-005

Contexto: Rumo à Aprovação (github.com/Jinriuk/Rumo-a-aprova-o-), branch `main` em `cd75cc5`.
Banco de teste ativo: Supabase `bdjkgrzfzoamchdpobbl` ("Teste e Vitrine").
Congelamento de funcionalidades em vigor (ADR-0004): não iniciar nada além do que está descrito abaixo.

## Tarefa 1 — Decisão sobre a branch `claude/jornada-transformadora-uxg2-r2-806vu0`

Ela tem 4 commits sobre `c3fe4ab` (UXG1+UXG2, já em `main`): refino de CSS/tema
(`app/src/shared/ui/experiencia.css`, `tema.js`), atualização de
`docs/UXG2-JORNADA-VERTICAL.md`, e uma suíte de teste nova
(`tests/uxg2-jornada.test.mjs`, 227 linhas).

1. Faça checkout da branch e rode a suíte de testes completa contra ela.
2. Verifique se há conflito de merge contra o `main` atual.
3. Revise o conteúdo funcional (nomeação de XP pelo ledger, alvos de toque de
   32px no formulário, correções de foco e lista adiada).
4. Se estiver limpo e os testes passarem: abra PR para `main` referenciando
   esta tarefa como resolução de BKL-002/BKL-005.
5. Se não estiver limpo: registre exatamente por que (conflito, teste
   quebrado, revisão reprovada) em `docs/backlog/etapa-01.md`, item BKL-005,
   e feche ou mantenha a branch com essa justificativa.

## Tarefa 2 — Migration 0045: registrar `rls_auto_enable` e o event trigger `ensure_rls`

Ambos existem ativos hoje **só no banco** `bdjkgrzfzoamchdpobbl`, sem
migration correspondente no repositório. Definição atual, extraída
diretamente do Postgres em 02/09/2026:

```sql
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

-- event trigger associado, confirmado ativo (evtenabled = 'O'):
DROP EVENT TRIGGER IF EXISTS ensure_rls;
CREATE EVENT TRIGGER ensure_rls
  ON ddl_command_end
  EXECUTE FUNCTION public.rls_auto_enable();
```

1. Crie `supabase/migrations/0045_est1_rls_auto_enable.sql` reproduzindo
   função + event trigger de forma idempotente (`create or replace
   function`, `drop event trigger if exists` antes do `create`).
2. Aplique localmente e confirme que reaplicar não quebra nada
   (idempotência real, não só ausência de erro na primeira vez).
3. Confirme que `supabase migration list` bate entre repositório e remoto
   depois de aplicada no projeto de teste.
4. Não alterar as funções `backoffice_*`, `resumo_escola`,
   `salvar_onboarding_aluno` ou `sou_super_admin` — já têm guarda interna
   correta (`eh_super_admin()`), confirmada nas migrations 0019/0021/0025/0032.
   Não fazem parte desta tarefa.

Fora essas duas tarefas, nada mais deve ser iniciado (congelamento em vigor).
