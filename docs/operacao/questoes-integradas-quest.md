# Questões integradas (Quest API) — P1.1

Origem: seção 9 de `docs/conteudo/pmerj-cfo/PMERJ_CFO_Desenho_da_Trilha_e_Auditoria_do_Banco.md`.
A Quest autorizou guardar questão e gabarito na nossa base.

## Estado em 04/10/2026

| Peça | Onde | Estado |
|---|---|---|
| Migration | `supabase/migrations/0065_quest_questoes_integradas.sql` | no repositório, **não aplicada** em lugar nenhum |
| Edge Function | `supabase/functions/questoes-integradas/` | no repositório, **não publicada** |
| Filtros das 24 missões | `supabase/seed/quest-filtros-pmerj-cfo-v1.json` | proposta, **nenhum conferido** contra o catálogo da Quest |
| Cobertura | `scripts/quest-cobertura.mjs --medir` | **não medida** (ver "Por que a tabela ainda não existe") |
| Botão no front | PR de front separado | escondido até `app.quest_filtros_missao.ativo = true` |

## Contrato e custo da Quest

Conferido pelo dono na documentação oficial (04/10): base `https://api.quest.api.br/v2`,
cabeçalho `X-API-Key`, resposta `data.items` e `data.total`, `per_page` até 100,
`include_gabarito=true` embute o gabarito, paginação por cursor `after_id`. Banca, matéria e
assunto exigem o valor exato (`GET /v2/filtros/materias` e `/v2/filtros/assuntos`, parâmetro `q`).
Bancas: `CESGRANRIO` e `FGV`.

**Custo: 3 créditos por questão entregue sem gabarito, 6 com gabarito.** Consequências no código:

- Questão guardada serve a todos os alunos da missão, de qualquer escola, sem nova chamada
  (provado em `p11-quest-db`: "créditos: questão guardada serve outro aluno…").
- A busca só acontece quando o estoque que o aluno ainda não respondeu não fecha o lote, e pede
  só as que faltam (`faltam`), com gabarito, a partir do cursor da missão. Teto por busca: 20
  questões, 120 créditos.
- A medição pede `per_page=1` e **sem** gabarito: no máximo 3 créditos por chamada, 3 chamadas
  por missão (total, CESGRANRIO, FGV), e total zero não gasta as chamadas por banca. Teto para as
  24 missões: 216 créditos.
- `GET /filtros/*` custa **1 crédito por chamada** (painel de Uso da Quest). O levantamento de nomes
  (`--filtros`) faz 6 chamadas de matéria + 1 por termo de assunto: ~30 créditos na primeira rodada.
  Teto da medição completa (nomes + cobertura): ~246 créditos, mais uma rodada de filtros por ajuste.
- Questão descartada na normalização (imagem, anexo, gabarito fora das alternativas) já foi paga.
  O filtro `tem_anexos=false` reduz isso, mas não zera.

## Por que a tabela ainda não existe

1. A chave só pode morar no secret `QUEST_API_KEY` das Edge Functions. A medição precisa
   rodar dentro da função.
2. A função não está publicada em nenhum ambiente, e publicar é decisão do dono.
3. A ação `cobertura` só atende super_admin ativo; o script entra com o login do operador.

## Como medir (sem aplicar a 0065)

A ação `cobertura` não lê nem grava nada no banco além do login. Ela funciona com a
função publicada mesmo antes da 0065.

1. Edge Functions › Secrets do projeto escolhido: `QUEST_API_KEY` (e, se a base for outra,
   `QUEST_API_BASE_URL`).
2. Publicar só a função: `supabase functions deploy questoes-integradas --project-ref <ref>`.
3. Na máquina do operador:

   ```bash
   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=<publishable> \
   OPERADOR_EMAIL=... OPERADOR_SENHA=... \
     node scripts/quest-cobertura.mjs --medir --saida cobertura-quest.json
   ```

   Sai uma tabela por missão (Meta, Total, Cesgranrio, FGV, Outras, utilizáveis numa amostra
   de 20, situação) e uma por matéria. Custa por missão 1 chamada de amostra + 1 por banca
   (24 × 3 = 72 chamadas com as duas bancas padrão).
4. Ajustar `materia`/`assunto`/`assunto_id` em `quest-filtros-pmerj-cfo-v1.json` onde vier zero,
   marcar `conferido: true` no que foi conferido, medir de novo.

## Medição de 04/10/2026 (demo, função v5)

Filtros conferidos em `/v2/filtros/*` (23 de 24, gravados em `supabase/seed/quest-filtros-pmerj-cfo-v1.json`
com `conferido: true`). Medição com `per_page=1`, sem gabarito, filtros fixos `tem_gabarito`, `anulada=false`,
`tem_anexos=false`. Resultado bruto: `docs/operacao/quest-cobertura-pmerj-2026-10-04.json`.

| Missão | Matéria | Assunto (filtro) | Meta | Total | Cesgranrio | Fgv | Outras | Situação |
|---|---|---|---|---|---|---|---|---|
| PMERJ-M01-ADM | dir_adm | Organização Administrativa | 20 | 745 | 1 | 41 | 703 | ok |
| PMERJ-M01-CONST | dir_const | Aplicabilidade das normas constitucionais, eficácia e aplicabilidade das normas constitucionais ou classificação das normas constitucionais ou vigência e eficácia das normas constitucionais ou normas constitucionais: classificação e eficácia | 20 | 115 | 1 | 14 | 100 | ok |
| PMERJ-M01-PEN | dir_pen | Lei penal no tempo | 20 | 22 | 0 | 2 | 20 | ok |
| PMERJ-M01-CPP | dir_proc_pen | Sistemas Processuais Penais | 20 | 6 | 0 | 0 | 6 | abaixo da meta (20) |
| PMERJ-M01-CPM | dir_pen_mil | Aplicação da Lei Penal Militar | 13 | 21 | 0 | 2 | 19 | ok |
| PMERJ-M01-DH | dir_hum | Direitos Humanos no Ordenamento Nacional | 13 | 84 | 0 | 10 | 74 | ok |
| PMERJ-M02-ADM | dir_adm | Atos Administrativos | 20 | 816 | 2 | 32 | 782 | ok |
| PMERJ-M02-CONST | dir_const | Direitos e deveres individuais e coletivos ou direitos e deveres individuais e coletivos; direito à vida, à liberdade, à igualdade,àsegurançaeàpropriedade (artigo 5º da CF) | 20 | 2812 | 1 | 142 | 2669 | ok |
| PMERJ-M02-PEN | dir_pen | Fato Típico | 20 | 1 | 0 | 0 | 1 | abaixo da meta (20) |
| PMERJ-M02-CPP | dir_proc_pen | Inquérito policial | 20 | 112 | 0 | 12 | 100 | ok |
| PMERJ-M02-CPM | dir_pen_mil | Culpabilidade e Imputabilidade | 13 | 5 | 0 | 1 | 4 | abaixo da meta (13) |
| PMERJ-M02-DH | dir_hum | Convenção Americana sobre Direitos Humanos (Pacto de San José) | 13 | 151 | 0 | 19 | 132 | ok |
| PMERJ-M03-ADM | dir_adm | Processo Administrativo Disciplinar | 20 | 160 | 0 | 8 | 152 | ok |
| PMERJ-M03-CONST | dir_const | Ações de controle concentrado de constitucionalidade | 20 | 36 | 0 | 6 | 30 | ok |
| PMERJ-M03-PEN | dir_pen | Culpabilidade | 20 | 29 | 0 | 2 | 27 | ok |
| PMERJ-M03-CPP | dir_proc_pen | Ação penal | 20 | 49 | 0 | 12 | 37 | ok |
| PMERJ-M03-CPM | dir_pen_mil | Aplicação da Pena | 13 | 2 | 0 | 0 | 2 | abaixo da meta (13) |
| PMERJ-M03-DH | dir_hum | Sistema Interamericano de Proteção aos Direitos Humanos: Instituições | 13 | 19 | 0 | 7 | 12 | ok |
| PMERJ-M04-ADM | dir_adm | Lei nº 12.527/2011 - Lei de Acesso à Informação | — | 1179 | 0 | 34 | 1145 | sem meta (acompanhamento manual) |
| PMERJ-M04-CONST | dir_const | Remédios constitucionais ou writs constitucionais ou ações constitucionais ou garantias constitucionais | — | 347 | 0 | 28 | 319 | sem meta (acompanhamento manual) |
| PMERJ-M04-PEN | dir_pen | Prescrição | — | 33 | 0 | 3 | 30 | sem meta (acompanhamento manual) |
| PMERJ-M04-CPP | dir_proc_pen | Incidente de insanidade | — | 6 | 0 | 2 | 4 | sem meta (acompanhamento manual) |
| PMERJ-M04-CPM | dir_pen_mil | Suspensão Condicional da Pena | — | 6 | 0 | 1 | 5 | sem meta (acompanhamento manual) |
| PMERJ-M04-DH | dir_hum | Uso da Força e Letalidade Policial | — | 0 | 0 | 0 | 0 | sem assunto na Quest |

Por matéria (soma das missões; uma questão pode servir a duas missões):

| Matéria | Total | CESGRANRIO | FGV | Outras | Missões sem medida |
|---|---|---|---|---|---|
| dir_adm | 2900 | 3 | 115 | 2782 | 0 |
| dir_const | 3310 | 2 | 190 | 3118 | 0 |
| dir_pen | 85 | 0 | 7 | 78 | 0 |
| dir_proc_pen | 173 | 0 | 26 | 147 | 0 |
| dir_pen_mil | 34 | 0 | 4 | 30 | 0 |
| dir_hum | 254 | 0 | 36 | 218 | 0 |

Missões com volume para a meta: 14 de 18 com meta automática (6 sem meta: semana de simulado). Créditos gastos na medição: 141. Medido em 2026-10-04T14:24:23.464Z.

**Créditos:** 42 em `/filtros` (30 + 12, duas rodadas) e 141 na medição (47 chamadas que devolveram 1 item, a
3 créditos). Total: **183**. As duas rodadas anteriores falharam com 422 (`desatualizada` não é filtro aceito)
e não entregaram questão.

**Leitura:**
- Cesgranrio quase não aparece (3 questões em Administrativo, 2 em Constitucional, 0 nas outras quatro matérias).
  FGV aparece em todas, com pouco volume em Penal Militar (4) e Penal (7). "Outras" é a maior parte em tudo.
- Abaixo da meta: M01-CPP (6 de 20), M02-PEN (1 de 20), M02-CPM (5 de 13), M03-CPM (2 de 13). Penal Militar
  tem 34 questões somando as quatro missões: é a matéria em que a Quest não sustenta a trilha.
- M02-PEN: "Fato Típico" deu 1; "Elementos do Fato Típico" existe no catálogo e não foi medido. Conferir antes
  de concluir que falta questão.
- M04-ADM: a Quest tem duas grafias da LAI; a segunda não está somada.
- M04-DH (letalidade policial, ADPF 635): sem assunto no catálogo da Quest. Fica no registro manual.
- Semana 4 é de simulado: missões sem meta automática, fora da fila; o botão não se aplica a elas.
- O total não exclui questões desatualizadas (a Quest não aceita esse filtro); a normalização descarta as que
  vierem marcadas.

## Como ligar (depois da tabela e com aprovação)

1. Backup novo. Aplicar a 0064 (se ainda não estiver) e a 0065.
2. Missões do CFO PMERJ publicadas (P0.6).
3. `node scripts/quest-cobertura.mjs --sql --ativar PMERJ-M01-ADM,...` e rodar o SQL.
   Só as chaves listadas ficam com o botão. Sem `--ativar`, todas entram desligadas.
4. Publicar o front.

Desligar uma missão: `update app.quest_filtros_missao set ativo = false where missao_id = '...';`
O botão some na próxima carga da tela; lotes abertos continuam respondíveis até vencer (6 h).

## Regras que o banco garante (testadas em `tests/p11-quest-db.test.mjs`)

- Lote sai **sem gabarito**. O gabarito volta só na resposta.
- Correção no servidor. **Uma tentativa por aluno e questão**: a mesma resposta (ou outra)
  reenviada devolve a primeira correção, sem segundo registro nem XP duplicado.
- O pedido de lote leva `pedido_id`: reenvio devolve o mesmo lote. Lote aberto da missão é
  retomado em vez de gastar outro.
- O lote vira **um** registro de estudo (`tipo_pratica` `missao` ou `revisao`, com `missao_id`)
  e segue o caminho da 0064. Quando a missão fecha, o resto do lote vira revisão.
- `missao` só na missão da vez da matéria; `revisao` em missão já iniciada; fora disso, recusa.
- Questão já respondida não volta. Anulada ou desatualizada não entra em lote nem é corrigida.
- Gabarito trocado na Quest sobe `gabarito_versao`; a tentativa guarda a versão usada.
- Limites por aluno: 120 questões por dia (data de Brasília), 6 lotes por hora, lote de até 20.
  Busca na Quest no máximo a cada 2 min por missão. Valores em `app.quest_limites()`.
- O aluno não edita nem apaga, pelo app, registro que veio de questão corrigida.
- Nada de `app.quest_*` é legível por aluno, coordenação ou anon. O dossiê LGPD leva as
  tentativas (sem enunciado).

## Falha da Quest

Timeout de 8 s, sem retry dentro do pedido do aluno. Se havia questão guardada, o lote sai
com o que há. Se não havia, a função responde 503 `fornecedor_indisponivel` com
`fallback: registro_manual` (o 5xx vai ao coletor com `correlation_id`, sem enunciado nem aluno).
O registro manual não passa pela função e não depende dela.

## O que fica aberto

- **Conciliação manual × Quest**: quem registrar à mão as mesmas questões conta duas vezes.
  A tela avisa; o banco não detecta.
- **Regravar tentativas antigas** quando a Quest muda gabarito: não feito; a versão fica guardada.
- **Penal Militar e normas PMERJ** (9.3): a medição dá número, não qualidade. Amostra manual
  continua obrigatória antes de ligar essas missões.
- **Licença de imagem, comentário e uso com IA**: a função descarta questão com imagem/anexo e
  não guarda comentário.

## Reverter

Ver o bloco ROLLBACK no fim da 0065. Para só esconder: `update app.quest_filtros_missao set ativo = false;`
e, se preciso, `supabase functions delete questoes-integradas`.
