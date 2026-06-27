# Massa sintética de volume — Fase B-min (B.7)

Script para testar a Área da Escola com o volume do primeiro piloto real
(300–500 alunos), sem usar dado pessoal de ninguém.

## O que ele cria

`supabase/seed-volume/massa_coordenacao.sql` gera, dentro da escola de
vitrine já semeada (`Colégio Vitrine Naval`, id
`11111111-1111-4111-8111-111111111111`):

- 6 turmas sintéticas ("Turma Volume 01".."06"), 80 alunos cada (480 no total).
- 480 alunos ("Aluno Volume 001".."480"), todos na trilha CN v1 e no
  concurso Colégio Naval.
- ~4 em 5 alunos com credencial provisionada (`usuarios` + `usuario_id`);
  os outros ficam "sem credencial" de propósito, para exercitar o filtro.
- ~3 em 4 com consentimento registrado; os outros ficam "sem consentimento".
- ~5 em 6 com registros de estudo nos últimos 9 dias (questões/acertos/
  minutos sintéticos); os outros ficam "sem atividade", para o filtro
  e o selo de risco.
- Meta da semana corrente gerada pelo motor real (`app.gerar_meta`, o
  mesmo caminho de produção), com parte das atividades marcada como
  concluída (para "meta atrasada" aparecer no filtro).
- ~1 em 3 com um simulado lançado.

Nenhum CPF, e-mail ou dado real — só nomes sintéticos e métricas
derivadas do índice do aluno (determinísticas, não `random()`).

## Como rodar

Pré-requisito: o seed padrão (`supabase/seed/01_*.sql` .. `12_*.sql`) já
aplicado — é dele que vem a escola, a trilha CN e o concurso CN que este
script reaproveita.

```bash
psql "$DATABASE_URL" -f supabase/migrations/*.sql   # se ainda não aplicado
psql "$DATABASE_URL" -f supabase/seed/01_escolas_dev.sql   # ... 02 a 12, na ordem
psql "$DATABASE_URL" -f supabase/seed-volume/massa_coordenacao.sql
```

Ou, num banco já preparado por `tests/reset-db.sh` (que aplica migrations +
seed padrão), só a última linha é necessária.

## Por que não fica em `supabase/seed/`

`tests/reset-db.sh` aplica automaticamente todo arquivo que casa com
`supabase/seed/[0-9][0-9]_*.sql`, duas vezes, em **todo** `npm test`. Um
arquivo de 480 alunos ali tornaria a suíte padrão mais lenta sem
necessidade. Este script é sob demanda, para quem for medir
performance/volume manualmente ou rodar o teste de volume
(`tests/volume-coordenacao-db.test.mjs`).

## Idempotência

Todos os ids são determinísticos (prefixo fixo + índice do aluno/turma/
dia, sem `gen_random_uuid()` nem `random()`) e todo insert usa
`on conflict do nothing`. Rodar o script duas (ou mais) vezes produz
exatamente o mesmo resultado, nunca duplica.

## Limpeza

É dado sintético dentro da escola de vitrine (mesma escola usada em dev/
demo) — não precisa de rotina de limpeza para uso local/manual. Para
remover:

```sql
delete from alunos where id between 'dddddddd-0000-4000-8000-000000000001'
                                 and 'dddddddd-0000-4000-8000-000000000480';
delete from turmas where id between 'eeeeeeee-0000-4000-8000-000000000001'
                                 and 'eeeeeeee-0000-4000-8000-000000000006';
delete from usuarios where id between 'ffffffff-0000-4000-8000-000000000001'
                                   and 'ffffffff-0000-4000-8000-000000000480';
```

(`alunos`/`turmas`/`usuarios` cascateiam para `alunos_turmas`,
`metas`/`meta_atividades`, `registros_estudo`, `simulados` e
`consentimentos` via `on delete cascade`.)
