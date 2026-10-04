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
