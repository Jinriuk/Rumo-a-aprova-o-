# Diagnóstico: fim da trilha e data da prova vencida

**03/10/2026 · PR 1 (P0.2) · somente diagnóstico, nada foi corrigido aqui.**

Pergunta do dono: o que acontece com o aluno quando a trilha passa da
última semana, e quando a data da prova passa? O sistema trava, repete a
última semana ou bloqueia o registro?

Resposta curta: **nenhum dos três, com uma ressalva em cada caso.** A
trilha encerrada para de gerar meta e mostra "ciclo concluído"; o
registro continua aceito. A data da prova vencida vira "prova realizada"
quando é a data do aluno, e rola para o ano seguinte quando é a média do
concurso. Uma não interfere na outra.

Referências fixadas na `main` 7124ccd. Conferido no Postgres local com
migrations e seeds do repositório (trilha do CN empurrada 400 dias para
o passado, dentro de transação desfeita).

## 1. Trilha passou da última semana

| Camada | Comportamento | Onde |
|---|---|---|
| Calendário no banco | `app.semana_da_data` **continua devolvendo a última semana para sempre** | `supabase/migrations/0003_motor_lgpd.sql:41` |
| Estado do ciclo | `app.estado_ciclo` devolve `encerrado`, sem semana | `supabase/migrations/0049_estado_ciclo.sql:73-75` |
| Geração de meta (virada e botão) | `app.gerar_meta_protegida` pergunta `estado_ciclo` antes e responde `ciclo_encerrado` sem gerar nada | `0049_estado_ciclo.sql:147-150`; a virada chama por `0039_est1_virada_resiliente.sql:144,198`; a Edge Function `gerar-meta` usa `motor_gerar_meta_segura` (`0046_aluno_pendente_configuracao.sql:56`), que passa pela mesma função |
| Rota antiga sem proteção | `public.motor_gerar_meta` chama `app.gerar_meta` direto, que usa o clamp e devolveria a meta já existente da última semana (sem duplicar). **Não há chamador no repositório**: a `gerar-meta` trocou para a versão segura na 0046 | `0005_api_servidor.sql:10-12`; `0003_motor_lgpd.sql:60` |
| Tela do aluno | `estadoDoCiclo` devolve `encerrado` e `MissaoAtual` mostra "CICLO CONCLUÍDO" antes de ler qualquer meta | `app/src/shared/regras/regras.js:72`; `app/src/modules/motor/MetaHero.jsx:127` |
| Métricas | `semanaAtual` repete a última semana de propósito, só como referência de cálculo | `app/src/shared/regras/regras.js:44-48` |
| Registro de estudo | **aceito**. A política de inserção só confere tenant, papel e o próprio aluno; não olha trilha nem data | `supabase/migrations/0002_rls.sql:175-176` |
| Missões | seguem a fila por matéria (`missoes.ordem`), que não depende de semana; o registro entra na missão em andamento ou fica sem vínculo quando a fila da matéria acabou | `0061_missoes_em_sequencia.sql:298-314` (`app.missoes_fila`) |

Medido no banco local, com a trilha do CN encerrada:

```
estado_ciclo            → { estado: 'encerrado', semana_numero: null }
semana_da_data          → { numero: 9 }            ← o clamp segue lá
gerar_meta_protegida    → { resultado: 'ciclo_encerrado' }
motor_gerar_meta_segura → { resultado: 'ciclo_encerrado' }
insert em registros_estudo como o aluno (RLS ligada) → aceito
```

**Ressalva.** O clamp de `semana_da_data` é uma armadilha para quem
escrever código novo: qualquer função que perguntar "qual a semana de
hoje?" a ela, em vez de a `estado_ciclo`, volta a "repetir a última
semana". Hoje nenhum chamador ativo faz isso. A 0049 manteve o clamp de
propósito; mudar isso é decisão separada.

**Para o PMERJ.** O fim da turma pré-edital cai nesse mesmo caminho:
sem meta nova, "ciclo concluído", registro liberado. A continuação é
abrir a próxima edição (`app.abrir_proximo_ciclo`, 0051/0054), que
hoje sugere a âncora pela data da prova. Sem data, não há sugestão, e a
coordenação precisa escolher a data à mão (ver seção 3).

## 2. Data da prova passou

Tudo no front, em `app/src/modules/conteudo/concursos.js`. O banco não
usa a data da prova para nada.

| Origem da data | Comportamento | Onde |
|---|---|---|
| `alunos.data_prova_alvo` no passado | "prova realizada", sem número de dias | `concursos.js:67-68`; `app/src/shared/ui/Cabecalho.jsx:39` |
| Data média do concurso (`mes_prova`/`dia_prova`) | rola para o mesmo dia do ano seguinte; nunca diz "realizada" | `concursos.js:45` |
| Nenhuma das duas | sem contagem | `concursos.js:77-78` |

A data vencida **não** pausa a trilha, não fecha meta, não gera meta e
não bloqueia registro. Ela também não mexe no nível do aluno: a reta
final (`niveisAluno.js:80`) exige `0 ≤ dias ≤ limiar`, e `dias` é
`null` em prova realizada.

**Ressalva.** Para concurso com data média, a rolagem silenciosa
significa que, no dia seguinte à prova, o aluno vê "≈ 364 dias". Para
os concursos anuais isso é o comportamento desenhado; para um concurso
sem periodicidade fixa, é uma contagem enganosa. Por isso o PMERJ não
pode receber data média: o PR de front deste mesmo item trata o par
vazio como "Data da prova aguardando edital".

## 3. Efeito colateral encontrado: âncora do próximo ciclo

`gruposParaRenovar` (`app/src/modules/escola/proximoCiclo.js:63`) usa
`proximaProva` para sugerir a âncora da próxima edição.

**Na `main` (7124ccd), com data vazia, isto quebra.**
- `proximaProva` devolve `dataIso: "2026-null-null"`. É uma string
  preenchida, então vira a âncora sugerida do grupo.
- `validarAncora` (`proximoCiclo.js:97`) aceita essa string: ela não é
  vazia e, na comparação de texto, fica depois de qualquer fim de
  trilha de 2026 (`"n"` vem depois dos dígitos).
- A tela chama `abrir_proximo_ciclo` com uma data inválida, e o
  Postgres recusa a conversão para `date`.

**Com o PR de front deste item, deixa de quebrar.** `proximaProva`
devolve `null` sem o par mês/dia. O concurso entra no grupo sem
`proxima`, a âncora sugerida vem de outro concurso do grupo ou fica
`null`, e `validarAncora` recusa âncora vazia com "Escolha a data da
próxima prova.". Ou seja: não quebra, só deixa de sugerir. O caso está
coberto em `tests/p02-pre-edital.test.mjs`.

Por isso a 0062 (que abre o vazio no banco) só deve ser aplicada junto
com esse PR de front, ou depois dele.

## 4. Antes desta mudança, o que quebraria com data vazia

Com `mes_prova`/`dia_prova` nulos e o `concursos.js` da `main`, a
string montada seria `"2026-null-null"`. A comparação de texto com
`hoje` dá `false` (`"n"` vem depois de qualquer dígito), a data fica no
ano corrente, e `daysBetween` com `new Date("2026-null-null")` devolve
`NaN`, que o `Math.max(0, …)` não corrige. O cabeçalho mostraria `NaN dias p/ prova`. Hoje isso
é impossível porque o banco recusa o vazio (`0007_concursos.sql:21-22`);
a migration 0062 abre o vazio e o PR de front fecha esse buraco no
mesmo item.
