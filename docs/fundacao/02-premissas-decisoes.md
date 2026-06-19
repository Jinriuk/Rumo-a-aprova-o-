# Documento 2 — Premissas e Decisões

Decisões já tomadas e restrições que orientam o projeto. Servem para qualquer pessoa (ou IA) que entrar no projeto não reabrir o que já foi decidido.

## Estratégia de negócio

1. **Validar barato antes de construir tudo.** Como construir o MVP custa pouco tempo ao idealizador, o próprio MVP é o instrumento de validação — mas travado no escopo mínimo (ver abaixo).
1. **Ordem de execução:** estudo de mercado → escolher colégio-alvo → MVP mínimo → piloto barato em cursinho pequeno → vender → reinvestir o faturamento na evolução do sistema.
1. **Crescer com dinheiro de cliente, não com aposta própria.** O faturamento do primeiro piloto/escola paga a abertura do CNPJ dedicado e a contratação de especialistas. Não se tira do bolso para escalar antes de haver receita.
1. **Foco:** não largar o low ticket por completo (é o único retorno em dias), mas priorizar este sistema porque tem potencial de prazo mais longo e dá ocupação à tia. Consciência explícita: o sistema só paga depois de meses (escolher colégio → construir → jurídico → vender → escola decidir).

## CNPJ e fiscal

1. **Piloto inicial faturado pela Alinhatta** (que está 100% no nome do idealizador no papel; o sócio Vinicius é de palavra, 50/50, por ser militar). É só para o faturamento inicial de validação.
1. **Assim que a primeira escola pagar, abrir CNPJ dedicado ao sistema** e migrar a operação para lá. Abrir CNPJ não é barato (referência: ~R$ 4 mil em taxas na abertura da Alinhatta; software não cabe em MEI e ME exige junta). Por isso usa-se o dinheiro da validação para abrir, não o próprio bolso.
1. **Conversar com o Vinicius antes de faturar o piloto pela Alinhatta:** deixar explícito que esse faturamento é do sistema e não entra na divisão 50/50 da consultoria, ou acertar como entra. Acordo de palavra quebra no que não foi combinado na frente.
1. **Mário (contador) decide a forma fiscal.** Pergunta específica a fazer a ele: “dá para pendurar na Alinhatta ou é melhor abrir separado, considerando que tem dado de menor e a Alinhatta vai para licitação?” Recomendação atual: separar, para não misturar o risco do sistema (dado de menor, assinatura) com a empresa que disputa edital público.

## LGPD e jurídico

1. **A escola é a controladora dos dados; o sistema/idealizador é o operador.** A escola busca o consentimento dos pais e cadastra (ou repassa os dados para cadastro). Mas, como operador, o idealizador NÃO fica isento: responde por segurança e por não usar o dado para outro fim.
1. **O contrato com a escola precisa ter cláusula de operador (tratamento de dados / DPA).** Isso vale desde o piloto.
1. **Consentimento documentado dos pais desde o piloto** — é responsabilidade da escola, mas tem que existir desde o cio pequeno (custa zero, é termo no cadastro). Não confundir com auditoria de segurança cara, que pode esperar.

## Produto e escopo

1. **MVP travado no mínimo que faz uma escola dizer sim:** área da escola (vê os alunos), cadastro de turma fácil, aluno registrando estudo, plano do nicho (CN/EsPCEx/EEAr/CM). Tudo isto white-label (leva o nome da escola).
1. **Fase 2 (só depois do primeiro contrato):** painel de professor, nivelamento automático (base/intermediário/avançado), reconhecimento da prova, indicação de livro por IA.
1. **Preservar da versão atual:** lógica de virada de semana por data local; design (navy #0A1622, dourado #CDA349, fontes Fraunces/Archivo); cálculo de nota projetada do Dia 1 = (mat + ing) × 2,5; o conteúdo do plano de estudos já revisado.

## Segurança

1. **Segurança é processo contínuo, não item de arquitetura que se risca da lista.** Mas é proporcional ao risco: no piloto (cursinho pequeno, ~100–200 alunos) o estrato de um furo é pequeno.
1. **Contratar especialista para revisar/testar segurança a partir da 2ª–3ª escola**, pago com o faturamento. Banco de dados tratado como fundação: construído desde já pensando em multi-tenant e isolamento de dados entre escolas/alunos, mesmo que o MVP comece pequeno.

## Pricing (a validar — não são números fechados)

1. Modelo: setup + mensalidade de manutenção. A mensalidade sustenta a operação e financia contratações.
1. Exemplos discutidos (hipóteses): cursinho pequeno piloto — barato, quase a preço de teste; escola maior — setup ~R$ 15 mil + ~R$ 2 mil/mês. **Confirmar faixas reais no estudo de mercado** (ver prompt separado).