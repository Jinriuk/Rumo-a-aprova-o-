# Decisões tomadas durante o build

Registro das decisões que o agente de build tomou sozinho (Prompt de Build, seção 8),
com o porquê. Nenhuma reabre decisão travada dos Documentos 1–6.

## Identidade e acesso

1. **Código de acesso = credencial completa.** O aluno/responsável digita um único código
   (`XXXX-XXXX-XXXX`, alfabeto sem 0/O/1/I/L para ser ditável por telefone). Por baixo, o
   código vira uma conta no Supabase Auth (e-mail sintético derivado do código + o código
   como senha). Por quê: um campo só no login é o mínimo de fricção para um menor; a
   identidade continua sendo conta real do Auth, com `escola_id` e `papel` carimbados no
   `app_metadata` (claims verificados que a RLS lê). O código aparece UMA vez para a
   coordenação e não fica legível depois.
2. **`provisionar-aluno` também provisiona o responsável** (parâmetro `tipo`). Doc 5 reserva
   quatro funções; criar uma quinta só para responsável seria fragmentar o mesmo fluxo de
   provisão. O nome da função do Doc 5 foi mantido.
3. **Helpers de RLS em `SECURITY DEFINER`** (`app.meu_aluno_id`, `app.sou_responsavel_de`):
   evita recursão de política sobre política. São estáveis, mínimos e só leem.

## Motor

4. **A virada de semana mora no BANCO (`app.virar_semana()`), agendada por pg_cron às
   03:05 UTC (= 00:05 América/São_Paulo; o Brasil não tem mais horário de verão).** A Edge
   Function `virar-semana` existe como disparo manual do operador. Por quê: a regra fica
   testável localmente com data explícita e não depende de nenhum serviço além do Postgres.
   Roda todo dia e é idempotente — atraso ou re-execução não duplicam nada.
5. **Semântica preservada do `currentWeek()`:** intervalo inclusivo `[inicio, fim]`; antes
   da 1ª semana vale a 1ª; depois da última vale a última (meta já nasce fechada nesse caso).
   Testado dia a dia contra a cópia literal do código atual (365 datas de 2026).
6. **Estados de atividade** (`pendente/concluida/ignorada`) são atualizáveis pelo aluno na
   própria meta — é a forma multi-tenant do checklist atual. A coordenação não escreve
   progresso (matriz do Doc 6).

## Dados e LGPD

7. **`logs_acesso` sem FK para `alunos`:** o log de auditoria sobrevive à exclusão LGPD do
   aluno (a trilha de acesso é da escola; o dado de estudo é do titular e esse some).
8. **`lgpd_excluir` também remove contas:** a conta do aluno e a de responsáveis cujo único
   vínculo era aquele aluno. Devolve os ids para a Edge Function apagar no Auth.
9. **Consentimento no fluxo de cadastro:** no cadastro um-a-um o termo é checkbox na mesma
   tela; no cadastro em lote é registrado aluno a aluno depois (cada um tem responsável
   diferente). A lista de alunos mostra quem está sem consentimento.
10. **Minimização:** aluno = nome, escola, turma, dado de estudo. Sem CPF, sem documento,
    sem e-mail real de menor.

## Conteúdo

11. **Trilha CN importada verbatim** de `src/App.jsx` da versão atual para
    `supabase/seed/trilha-cn-v1.json` (fonte) → SQL gerado por script com IDs
    determinísticos (seed idempotente). Nenhum texto do plano foi alterado.
12. **`trilhas.publicada`:** o conteúdo só aparece para as escolas quando publicado —
    permite preparar a v2 da trilha sem vazar rascunho. Alunos apontam para `trilha_id`
    fixo: a versão não muda embaixo do aluno.

## Teste e ambiente

13. **A prova de isolamento roda em Postgres puro** com `SET ROLE authenticated` +
    `request.jwt.claims` — exatamente o mecanismo que o PostgREST/Supabase usa em produção.
    Sem mock: a RLS real, as migrations reais, negação real.
14. **Migração do Lucas:** o seed da vitrine traz o Lucas como primeiro aluno com meta
    gerada pelo motor, registros e simulado. A importação do histórico real (KV
    `cn:logs`/`cn:sims` do projeto antigo) é operação de produção com a chave antiga — fica
    documentada como passo do operador, fora deste repositório.

## Concursos e classificação (pedidos do dono pós-build)

15. **Cadastro global de concursos com data MÉDIA da prova** (migration 0007 + seed 05):
    CN ~01/08, EPCAR ~28/06, EsPCEx ~28/09, EsSA ~01/10, EEAr ~16/11 (2ª edição; tem duas
    por ano), CM ~25/10 — médias das edições 2023–2026, ajustáveis pelo operador quando o
    edital sai. A escola seleciona o concurso de cada aluno (no cadastro e na lista). A
    contagem regressiva usa a data REAL da trilha quando o aluno tem trilha (CN 2026);
    sem trilha, a próxima ocorrência da data média, rotulada como "(data média)".
16. **Trilhas específicas por concurso ficam para depois** (decisão do dono): os níveis
    variam (fundamental/médio/questões de superior) e o plano precisa ser pensado prova a
    prova. O aluno pode estar num concurso sem trilha pronta — o sistema não quebra.
17. **Classificação da turma é da COORDENAÇÃO, não do aluno.** O dono pediu o ranking da
    visão da escola (estilo guruja). O comparativo/ranking ENTRE alunos na tela do aluno
    segue travado como Fase 3 (Doc 4 §6). A classificação ordena por questões resolvidas
    (desempate: acerto, tempo), com janela de 7 dias ou geral e filtro por turma.

## O que ficou conscientemente de fora (além da Fase 2)

- Deploy real (Supabase/Vercel): o repositório está pronto; o passo a passo está no README.
- Materialização do resumo de desempenho (Doc 4, seção 9): volume do piloto não pede;
  a saída está projetada (cálculo concentrado em `modules/desempenho/metricas.js`).
- Revogação/regeração de credencial pela coordenação (hoje: excluir e reprovisionar).
- O Documento 3 não veio nos anexos do build (vieram 1, 2, 4, 5 e 6); as regras que ele
  citaria (design/fórmulas) estão cobertas pelos Docs 2 e 6.
