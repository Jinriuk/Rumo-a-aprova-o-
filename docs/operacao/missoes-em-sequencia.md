# Missões em sequência por matéria (migration 0061)

**Escrito em:** 02/10/2026. **Nada aplicado em demo nem em produção.**
Regra aprovada pelo dono em 02/10/2026. Depende do PR de banco dos alertas
(#170, migrations 0059 e 0060): a falha do motor é registrada no coletor
da Etapa 4.

## 1. O defeito (0033, `app.motor_avaliar_aluno`)

Para cada missão, o motor somava **todos** os registros do aluno na
matéria, de todo o tempo, e comparava com a meta daquela missão. Medido no
Postgres local, com aluno da EsPCEx (3 missões de Matemática: 70, 60 e 70
questões a 82%):

| Caso | Antes (0033) | Depois (0061) |
| --- | --- | --- |
| 1 registro de 70 questões com 86% | fecha as 3 missões, 270 XP | fecha só a primeira da fila, 90 XP |
| apagar esse registro | os 270 XP e as 3 missões ficam | a missão volta a "a seguir" e o XP vira `estornado` |
| 69 questões sem acerto + 1 certa | fecha as 3 com "100%" | não conta: registro sem acerto não entra |
| registro feito antes de a missão existir | conta | não conta |

O estorno da 0038 não pegava a missão porque só marca eventos que apontam
para o registro apagado, e o evento de missão aponta para `missoes`.

## 2. A regra

1. **Fila por matéria.** Missões automáticas (meta efetiva > 0, ativas na
   escola, do concurso-alvo do aluno), na ordem do catálogo
   (`missoes.ordem`, desempate por id), a mesma da tela da trilha. Uma em
   andamento por vez.
2. **Começo.** A missão começa no primeiro registro da matéria, com acertos,
   recebido quando ela é a próxima. O registro que fecha uma missão não
   conta para a seguinte; a seguinte começa no registro seguinte.
3. **Um registro, uma missão.** O vínculo fica em `app.missao_registros`
   (chave primária no registro). O "quando" é o horário do servidor
   (`app.registros_recebidos`, `clock_timestamp()`), porque o aluno pode
   alterar `criado_em` e `disciplina_codigo` do próprio registro.
4. **Sem transbordo.** O excedente do registro que fecha não passa adiante.
   Dois registros de 70 fecham duas missões; nenhuma questão conta duas vezes.
5. **Volume e acurácia** só sobre os registros da missão, e só registros com
   acerto informado. A tela de registro avisa (PR do front).
6. **Apagar ou editar** registro vinculado refaz a matéria a partir da missão
   dele: a que deixa de bater volta a "em andamento" e o XP dela vira
   `estornado`; as que começaram depois são refeitas com os mesmos registros,
   na ordem de recebimento. As anteriores não mudam. Registro que troca de
   matéria sai da missão e só entra na nova matéria se foi recebido depois
   do início da missão em andamento de lá.
7. **Ledger:** uma linha por aluno e missão (`missao_motor:<aluno>:<missao>`).
   Concluir de novo volta a mesma linha a `valido`, com o histórico em
   `metadata.historico`. Índice único parcial: no máximo um evento válido de
   missão do motor por aluno e missão.
8. **Legado:** missão concluída antes da 0061 fica concluída, com o XP,
   marcada `regra = 'legado'`, e não é recalculada. Linha antiga em
   andamento sai (não tinha XP). Produção em 01/10 (leitura do gestor):
   0 registros, 0 `aluno_missoes`, 0 eventos de missão, 26 missões com meta,
   nenhuma `missoes_escola` com `qtd_questoes`. Nada a estornar.
9. **Concorrência:** trava por aluno e matéria na transação, mais o índice
   "uma em andamento por aluno e matéria".
10. **Fora da regra:** nível por matéria, conquistas e o motor C0 não mudam.
    Missão concluída que a escola desativa fica como está; a em andamento
    sai da fila e os registros dela vão para a próxima.

Também na 0061: a Física da EsPCEx tem o avançado por último (Eletricidade 6,
Termologia 7, Mecânica 8), na migration e na fonte da seed 20
(`supabase/seed/trilha-espcex-v1.json`, regenerada).

## 3. Falha do motor

Além do `WARNING` no log do Postgres, a falha vira ocorrência no coletor
(`app.erros_ocorrencias`, origem `banco:motor_missoes` ou
`banco:motor_avaliar_aluno`) só com o SQLSTATE, sem id de aluno nem de
registro. O registro do aluno é gravado mesmo assim.

O e-mail: o banco reserva o envio (tetos da 0059) e pede, pelo `pg_net`, que
a Edge Function `registrar-erro` o despache (`?despachar=1`). A URL do projeto
vem do Vault, com o nome `project_url` (ver `alertas-dono.md`, 2.5). Sem ele,
o e-mail fica na fila e sai no próximo relato de erro do front.

## 4. Ordem de aplicação

1. PR dos alertas (#170) mesclado e aplicado (0059, 0060, funções).
2. Este PR: 0061 no demo, conferir, depois na produção.
3. Publicar `registrar-erro` de novo (ganhou o despacho) e as funções que
   importam `_shared/coletor-servidor.ts`.
4. `project_url` no Vault dos dois projetos.
5. PR do front das missões (fila inteira e aviso de acertos).

Conferência depois de aplicar, no SQL Editor:

```sql
select count(*) filter (where regra = 'legado') legado,
       count(*) filter (where estado = 'em_andamento') em_andamento,
       count(*) filter (where iniciada_em is null and regra = 'sequencial') sem_inicio  -- tem de ser 0
  from aluno_missoes;
select nome, nivel, ordem from missoes where exam_tag = 'espcex' and materia_codigo = 'fis' order by ordem;
```

## 5. Provas

- `tests/missoes-sequenciais-db.test.mjs`, entre os casos:
  - 70 questões fecham no máximo uma missão;
  - XP nunca é pago duas vezes pelo mesmo registro (e o banco recusa um segundo evento válido);
  - apagar estorna e reinserir revalida a mesma linha;
  - cinco ciclos de inserir e apagar não passam do XP de uma missão;
  - registro sem acerto ou anterior ao início não conta;
  - sem transbordo;
  - acurácia isolada;
  - troca de matéria;
  - legado;
  - meta da escola;
  - missão desativada;
  - índice de concorrência;
  - ordem da Física;
  - falha do motor no coletor sem dado de aluno, com o pedido de despacho.
- `tests/ped1-motor-db.test.mjs`: dois casos reescritos, porque contavam os
  registros da seed como volume da missão.
- P8 em `scripts/alertas/provas.mjs` (stack local da E3): falha injetada no
  motor vira e-mail no Resend simulado pelo caminho real (coletor → `pg_net`
  → Vault → `registrar-erro?despachar=1`).
