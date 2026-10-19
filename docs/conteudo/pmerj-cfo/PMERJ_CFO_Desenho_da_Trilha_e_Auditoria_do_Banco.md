# CFO PMERJ na Triliva — desenho da trilha e auditoria do banco

**Documento operacional v1.0 · 03/10/2026 · Gabriel / Triliva**

**Decisão:** construir a trilha no domínio já existente, com calendário semanal, catálogo jurídico e missões por assunto. A base comporta esse caminho. Porém, cadastrar conteúdo sozinho ainda não entrega acompanhamento confiável por assunto: o motor atual avança missões com base na matéria do registro.

**Nome público recomendado:** “CFO PMERJ — preparação pré-edital”. Identificador interno proposto: `pmerj_cfo`. Não fixar “prova 2026” no nome: a pesquisa anterior encontrou preparação administrativa para ingresso em 2027, e não uma data definitiva de prova. Quando o edital final for validado, versionar o conteúdo e atualizar a identificação do ciclo.

**Escopo desta entrega:** desenho pedagógico e especificação de encaixe no produto, depois de inspeção somente em leitura. Nenhuma migration, seed, configuração ou dado de produção foi alterado. Não é um arquivo pronto para importar no banco.

## 1. O que Gabriel precisa saber primeiro

1. **O relatório solicitado foi convertido integralmente para Markdown.** O arquivo complementar `PMERJ_CFO_Matriz_e_Modelo_de_Metas.md` contém a pesquisa, as 219 linhas catalogadas do Anexo II e o modelo matemático de metas.
2. **PMERJ ainda não estava cadastrado no banco de produção consultado.** Não encontrei suas seis matérias jurídicas no catálogo global. Isso é trabalho de conteúdo, não reconstrução de arquitetura.
3. **A trilha semanal e a fila de missões são mecanismos distintos.** Precisam nascer da mesma fonte de conteúdo e ter ligação verificável. Hoje uma semana sugerida no plano não restringe automaticamente a fila de missões.
4. **O maior ajuste funcional é vincular prática ao assunto e à missão corretos.** Atualmente um registro de uma matéria pode contar para a missão corrente dessa matéria, mesmo que seu tópico escrito seja outro.
5. **A data de prova precisa poder ficar desconhecida.** Hoje o cadastro exige mês/dia e o frontend calcula a próxima ocorrência anual. Inserir uma data arbitrária criaria uma contagem regressiva enganosa.
6. **A trilha pode estar operacional e continuar provisória quanto ao edital.** O produto precisa representar essas duas coisas separadamente. Hoje a configuração de maturidade mistura prontidão do conteúdo e existência de estrutura oficial.
7. **Quantidade realizada não prova domínio.** O modelo adaptativo do documento anterior é uma proposta; os dados atuais de registro manual não permitem verificar questões inéditas, repetição, cobertura ou a consolidação estatística proposta.

**Caminho de lançamento recomendado:** publicar um calendário útil e revisado, com fonte histórica explícita e registro manual honesto; liberar resolução integrada quando fornecedor, licença, cobertura, tentativas e contagem estiverem testados. Só apresentar “progresso automático por assunto” quando o vínculo descrito neste documento estiver funcionando.

## 2. Evidências e limites da inspeção

### 2.1 Referência atual do código

Repositório: [Jinriuk/Rumo-a-aprova-o-](https://github.com/Jinriuk/Rumo-a-aprova-o-).

Branch consultada: `main`. SHA: [`7124ccd025af6bfd43d34fb923be82cafcfb041a`](https://github.com/Jinriuk/Rumo-a-aprova-o-/commit/7124ccd025af6bfd43d34fb923be82cafcfb041a), de 02/10/2026, mensagem “Missões em sequência · front: fila inteira por matéria e aviso de acertos (#172)”. As referências de código ao fim deste documento estão fixadas nesse SHA.

**[CONFIRMADO POR LEITURA]** Foram lidos os arquivos de conteúdo, cadastro, métricas, scripts de geração e validação, a migration `0061_missoes_em_sequencia.sql` e funções efetivamente instaladas no banco. Código existente não equivale a teste de jornada executado.

### 2.2 Bancos separados

| Ambiente | Projeto Supabase | Evidência relevante na consulta |
|---|---|---|
| Produção | `zckyhihxjjbnqjqilymn` | Acesso direto confirmado; `ACTIVE_HEALTHY`; catálogo e definições consultados |
| Demo | `bdjkgrzfzoamchdpobbl` | Catálogo consultado separadamente; conteúdo diferente de produção |

**Contagens exatas por `SELECT count(*)`, não estimativas do inventário:**

| Estrutura | Produção | Demo | Consequência |
|---|---:|---:|---|
| Concursos | 6 | 6 | PMERJ não consta no catálogo consultado |
| Trilhas semanais | 2 | 2 | Há uma de Colégio Naval e outra de EsPCEx |
| Semanas | 18 | 18 | Existem calendários reais, não apenas modelos de tela |
| Atividades-modelo | 159 | 100 | Demo não é espelho atual de conteúdo de produção |
| Missões | 30 | 8 | Validar o seed específico de PMERJ; não presumir paridade |
| Planos de concurso | 14 | 12 | Planos e missões precisam ser versionados juntos |

Em produção também foram encontrados: **9 matérias**, **86 assuntos**, **354 subassuntos** e **99 vínculos plano–missão**. As nove matérias são as escolares já usadas no produto; as seis jurídicas propostas abaixo precisam ser adicionadas. Havia **zero registros de estudo e zero `aluno_missoes`** na consulta. Isso não prova ausência de clientes em outros fluxos: significa que não houve histórico nessas duas tabelas para validar o comportamento com uso real.

Calendários existentes em produção:

| Trilha | Semanas / atividades | Intervalo cadastrado | Observação |
|---|---|---|---|
| Colégio Naval | 9 / 50 | 15/08/2026 a 17/10/2026 | Datas globais do calendário, não relativas a cada matrícula |
| EsPCEx | 9 / 109 | 13/07/2026 a 13/09/2026 | Intervalo já encerrado na data desta inspeção |

O ledger de produção contém `0061_missoes_em_sequencia`, versão `20261002085342`; também contém `0060_heartbeat_virada` e `0059_coletor_erros`. Portanto, não use o diagnóstico antigo que terminava na migration 0058 como retrato atual.

**Limites:** esta etapa não executou E2E, carga, tentativa de autorização com usuários distintos, chamada à API contratada nem teste de deploy. Não inspeccionou credenciais e não certifica a segurança geral. A contratação da API é informação fornecida por Gabriel; seu funcionamento e acervo ainda precisam do teste de integração.

## 3. Como a trilha funciona hoje

### 3.1 Calendário: o que fazer nesta semana

| Peça existente | Função real | Uso para PMERJ |
|---|---|---|
| `trilhas` | Identidade, nicho, versão e publicação | Calendário PMERJ específico, sem sobrescrever CN/EsPCEx |
| `disciplinas` | Matérias da trilha semanal | As seis jurídicas, com códigos iguais aos do catálogo |
| `trilha_semanas` | Número, início, fim, foco e meta de questões | Calendário de estudo e orçamento de prática |
| `atividades_modelo` | Tarefas por semana e disciplina; texto e prioridade | Conteúdo, prática, revisão e discursiva escritos de modo executável |
| `metas` | Semana atribuída ao aluno | Gerada por `app.gerar_meta` usando a data |
| `meta_atividades` | Estado das tarefas do aluno | Conclusão de execução, sem equivalência automática a domínio |

`app.semana_da_data` usa as datas cadastradas da trilha; depois do fim, sua seleção retorna a última semana. Há tratamento de ciclo na aplicação, mas não se deve interpretar isso como ciclo novo ou semana relativa à matrícula.

### 3.2 Conteúdo e missões: em que o aluno está avançando

| Peça existente | Função real | Uso para PMERJ |
|---|---|---|
| `concursos`, `provas`, `prova_dias`, `prova_materias` | Identificação e estrutura da prova | Estrutura histórica com fonte; próximo ciclo provisório |
| `materias`, `assuntos`, `subassuntos` | Taxonomia pedagógica | Preservar redação do Anexo II e separar recortes autorais |
| `trilha_planos` | Descrição dos planos | Plano inicial de preparação pré-edital |
| `missoes` | Objetivo, assunto, metas, ordem, XP | Missões pequenas e verificáveis, sem prometer domínio pelo volume |
| `trilha_plano_missoes` | Relação com fase, semana sugerida e ordem | Planejamento editorial; não é hoje um agendador da fila |
| `missoes_escola` | Ajustes por instituição | Não usar para personalização de um único aluno B2C |
| `aluno_missoes` | Estado e acumulados do aluno | Execução das missões, distinta de consolidação pedagógica |
| `registros_estudo` | Matéria, tópico livre, questões, acertos e tempo | Registro manual; não comprova quais questões foram respondidas |
| `app.missao_registros` | Vínculo registro–missão do aluno | Reutilizar o vínculo no redesenho; não criar outro ledger paralelo |

No frontend, `carregarPlanoConcurso` carrega os planos e missões, mas não utiliza `trilha_plano_missoes` para aplicar `semana_sugerida`. `TrilhaConcurso.jsx` apresenta os cartões de plano como informativos. A função `app.missoes_fila` ordena missões ativas da matéria e do concurso por `ordem`/ID; não filtra por semana, plano ou nível selecionado.

**Consequência:** cadastrar três missões “Essencial”, “Base” e “Reforço” com metas positivas não cria três alternativas de carga. No motor atual, elas podem virar três missões sucessivas obrigatórias. As faixas do modelo matemático precisam ser alternativas da mesma unidade, não três cópias publicadas.

### 3.3 O que o progresso atual consegue afirmar

| Indicador | Situação atual | Linguagem permitida |
|---|---|---|
| Volume de questões registrado | Existe | “Você registrou X questões” |
| Acertos informados no registro | Existe; pode ser preenchimento manual | “Acurácia dos registros com acertos informados” |
| Missão sequencial concluída | Existe por volume/acurácia e fila da matéria | “Missão concluída segundo os registros vinculados” |
| Questões inéditas por assunto | Não comprovável no registro agregado atual | Não exibir como fato |
| Consolidação pelo modelo estatístico | Não implementada no fluxo inspecionado | “Modelo proposto”, não “domínio medido” |
| Questões integradas respondidas e corrigidas no servidor | Não encontrada no domínio inspecionado | Liberar após a implementação e o teste da integração |

Há ainda diferença entre agregadores: `calcularMetricas` calcula o acerto geral dividindo acertos pelo volume total, enquanto outros agregadores tratam separadamente registros sem acertos. Padronizar o denominador antes de usar esse indicador para adaptar metas. Um registro sem correção não deve ser apresentado como erro do aluno.

## 4. Ajustes necessários antes de prometer uma trilha inteligente

### 4.1 P0 — prática do assunto correto

**[CONFIRMADO NO CÓDIGO E NA DEFINIÇÃO SQL]** `app.missoes_reprocessar` seleciona registros pela matéria; `registros_estudo.topico` é texto livre, sem chave de assunto. O tópico não funciona como filtro pedagógico da fila.

**Exemplo do risco, inferido do código; não foi executado em produção:** a missão corrente é “Ato administrativo”. O aluno registra questões de “Licitação” na matéria Administrativo. O motor pode creditá-las à missão corrente mesmo sem terem praticado atos administrativos.

**Desenho recomendado:**

- Toda sessão iniciada pelo botão de uma missão deve levar uma referência validada dessa missão e de seu assunto.
- O backend confere aluno, tenant, concurso, matéria e compatibilidade temática; não aceita apenas o ID enviado pelo navegador.
- Registro livre sem assunto tipado continua compondo volume geral, com identificação de origem manual, mas não comprova conclusão de uma missão temática.
- Revisão de uma missão anterior permanece ligada ao assunto anterior. Não deve “vazar” para a próxima missão só por ser da mesma matéria.
- Prática mista e simulado são tipos distintos. Só contam como evidência temática quando suas questões estiverem mapeadas e deduplicadas.
- Reutilizar `app.missao_registros` e o motor existente; adaptar a seleção dos registros em vez de criar outra árvore pedagógica.

**Extensão mínima a especificar pelo agente:** referências tipadas em `registros_estudo` ou no vínculo existente, classificação de origem/tipo de prática e autorização do vínculo. Como a tabela de vínculo atual liga cada registro agregado a uma só missão, uma sessão com assuntos diferentes deve gerar grupos separados ou manter tentativas individuais como fonte. A decisão de campos exatos exige preservar compatibilidade do gatilho 0061 e do histórico legado.

**Saída rápida, se esse ajuste atrasar:** publicar tarefas com acompanhamento manual de execução e manter explícito que o volume é por matéria. Não promover essa versão como medida automática de domínio por assunto.

### 4.2 P0 — data desconhecida e ciclo provisório

`concursos.mes_prova` e `dia_prova` são obrigatórios no banco atual. `proximaProva` e `diasParaProva`, em `concursos.js`, calculam a data recorrente quando não há uma data-alvo individual. Isso não atende honestamente um pré-edital sem data confirmada.

**Decisão de implementação proposta:** permitir ausência do par mês/dia, manter validação quando ambos existirem e exibir “Data da prova aguardando edital”. Tratar `null` em toda contagem regressiva. `alunos.data_prova_alvo` já admite ausência, mas isso sozinho não elimina o fallback anual.

**Não preencher 31/12, a data da prova anterior, 05/12 da meta financeira ou uma previsão de cursinho como data oficial.** O calendário pedagógico abaixo tem início e fim próprios, independentemente da prova.

### 4.3 P0 — prontidão do produto separada do status do edital

`maturidade.js` é a fonte central da disponibilidade. Concurso desconhecido fica indisponível. O nível `beta` não habilita trilha semanal; `completa` exige estrutura oficial. Portanto, apenas inserir linhas no banco não torna a nova trilha utilizável no cadastro.

**Proposta:** adicionar uma representação explícita de “trilha operacional pré-edital”, com calendário disponível e aviso de fonte histórica. Ajustar a configuração, os helpers de apresentação, o cadastro e o validador juntos. Não marcar o próximo edital como oficial só para vencer um gate, nem remover os gates dos outros concursos.

Os valores atuais de `status_dado` incluem `oficial`, `inferencia` e `validar`. Não criar silenciosamente um valor `provisorio` onde o schema não o aceita. No MVP, usar os valores suportados e registrar, em fonte/observação, “base histórica de 2024; aplicabilidade ao próximo ciclo provisória”. A prontidão operacional deve ser tratada separadamente.

### 4.4 P0 de honestidade — nota eliminatória e discursivas

A estrutura prevista no termo oficial inclui seis matérias objetivas e quatro respostas discursivas jurídicas. Esse termo ainda não substitui o edital final. Fonte: [Termo de Referência SEPM, seção de exame intelectual](https://sepm.rj.gov.br/wp-content/uploads/2026/07/TERMO-DE-REFERENCIA-2.pdf).

No código, os modelos de eliminação disponíveis são `absoluto_50`, `absoluto_5` e `mediana`. Não representam diretamente a combinação prevista de percentual total com proibição de zero em matéria. **MVP: deixar eliminação sem modelo suportado e mostrar “regra a validar”, em vez de atribuir um modelo de outro concurso.** Só adicionar um modelo PMERJ quando a regra e seus testes estiverem documentados.

Também não converter as quatro discursivas em “redação” genérica. `simulados.redacao_nota` é um campo único; não constitui correção de quatro respostas jurídicas. No primeiro ciclo, criar tarefas de escrita por Administrativo, Constitucional, Penal e Processo Penal, sem pontuação automática de aprovação e sem prometer correção humana incluída.

### 4.5 P1 — metas personalizadas e excesso de questões

Os campos de meta em `aluno_missoes` não são, hoje, uma configuração individual imutável: o reprocessamento usa as metas do catálogo/override da escola. Alterar esses campos diretamente não implementa o fator de dificuldade individual da fórmula.

`criterio_conclusao` é uma descrição editorial; o motor sequencial inspecionado encerra a missão por volume e acurácia, não por interpretar esse texto. Escrever “corrigir todos os erros” no campo não comprova que a correção aconteceu. Essa entrega precisa de tarefa explícita ou evidência própria na interface. Da mesma forma, `meta_acuracia` é um gate de execução escolhido pelo produto, não a implementação do critério experimental de consolidação.

Para o MVP, usar metas editoriais fixas por missão e ajustar a carga semanal de modo assistido. Para adaptação real, versionar uma meta por aluno/ciclo e fazer o motor usá-la como fonte, com motivo e data de recalibração. Alterar a meta global não pode desfazer a história de todos os alunos sem uma regra de migração.

Atualmente, um registro acima do alvo fica inteiro na missão corrente, sem distribuir o excedente para a seguinte. Para “30 da missão + 20 extras” a partir de 50, a UI pode derivar `creditadas = min(feitas, meta)` e `extras = max(0, feitas - meta)`, preservando o total. Isso não está comprovado como apresentação pronta e não equivale a 20 questões de outro assunto.

## 5. Estrutura proposta para o conteúdo PMERJ

### 5.1 Identidade e taxonomia

| Camada | Identificador proposto | Regra |
|---|---|---|
| Tenant B2C | “Triliva — Alunos Individuais” | Mantém arquitetura multi-tenant; não sugere cursinho com aulas |
| Concurso | `pmerj_cfo` | Manter coerência entre `codigo` e `exam_tag` |
| Nicho semanal | `pmerj-cfo` | Calendário separado das trilhas existentes |
| Conteúdo | `v1-pre-edital` no manifesto | Versão editorial; campos numéricos do banco continuam numéricos |
| Plano | `tipo = intensiva`, nome “Ciclo pré-edital de 12 semanas” | Tipo suportado; não inventar um enum de plano |
| Calendário | Turma com datas explícitas | Data de ingresso não muda silenciosamente a semana de todos |
| Fonte de programa | Anexo II do edital histórico + notas do termo atual | Atualizar por diferença quando sair o edital final |

| Código de matéria proposto | Nome de exibição | Questões no caderno FGV contado | Participação objetiva histórica |
|---|---|---:|---:|
| `dir_adm` | Direito Administrativo | 15 | 18,75% |
| `dir_const` | Direito Constitucional | 15 | 18,75% |
| `dir_pen` | Direito Penal | 15 | 18,75% |
| `dir_proc_pen` | Direito Processual Penal | 15 | 18,75% |
| `dir_pen_mil` | Direito Penal Militar | 10 | 12,50% |
| `dir_hum` | Direitos Humanos | 10 | 12,50% |

Contagem própria do [caderno histórico FGV](https://conhecimento.fgv.br/sites/default/files/concursos/oficial-da-policia-militarof-pm-tipo-1.pdf), detalhada no documento complementar, com a [página oficial FGV do concurso](https://conhecimento.fgv.br/concursos/pmerj24/oficiais). As porcentagens são cálculo sobre as 80 questões contadas; não são previsão de incidência do próximo edital. Os códigos são decisões propostas, ainda não inseridas no banco.

**Preservar duas leituras do conteúdo:** a redação literal do Anexo II serve à rastreabilidade; o recorte operacional serve a ensinar e praticar. Não chamar uma linha ampla como “Lei nº 443/1981” de uma pequena unidade dominável com 25 questões.

Usar `assuntos` para os itens catalogados e `subassuntos` para recortes operacionais, quando a relação for hierárquica. Para linhas sobrepostas, documentar um item primário e referências secundárias no manifesto. Não duplicar a mesma prática como se fossem dois aprendizados distintos. Questões FGV continuam tendo uma classificação primária para contagem.

### 5.2 Contrato editorial de cada missão

Toda missão deve responder:

| Campo pedagógico | Conteúdo obrigatório | Destino existente / extensão |
|---|---|---|
| Identidade | Concurso, matéria, assunto, recorte e versão | `missoes` + manifesto |
| Objetivo | Um verbo observável: distinguir, identificar, aplicar, justificar | `objetivo` |
| Conteúdo | Fonte, recorte de leitura, limites e resultado esperado | Texto da atividade e referência editorial |
| Prática | Número de questões, filtro e alternativa se o acervo faltar | `meta_questoes`, `qtd_questoes_sugerida` e manifesto |
| Correção | Registrar causa dos erros: conceito, norma, exceção, leitura ou tempo | Atividade de correção; classificação estruturada posterior |
| Revisão | Recuperação sem consulta e retorno posterior | Atividade semanal; revisão vinculada à missão após ajuste |
| Encerramento | Execução cumprida e correção feita | `criterio_conclusao` |
| Consolidação | Amostra válida e desempenho posterior | Regra pedagógica separada; ainda não implementada |
| Tempo | Estimativa de leitura, resolução e correção separadas | Manifesto; `tempo_estimado_min` para a missão |
| Evidência | ID da sessão / registro, origem manual ou API | Registro e vínculo autorizado |

**Não usar nomes como “domínio completo” ou “sem erro” para concluir uma missão apenas por quantidade.** Preferir “primeira prática corrigida”, “aplicação de regras” e “revisão de erros”.

## 6. Calendário proposto de 12 semanas

### 6.1 Premissas da turma de referência

**[HIPÓTESE DE PLANEJAMENTO]** Aluno bacharel em Direito ou com base jurídica prévia, com aproximadamente **22 horas semanais**: 10 para leitura/conteúdo, 10 para questões e correção e 2 para escrita/revisão discursiva. Não é a carga presumida de todo comprador.

Para disponibilidade menor, reduzir unidades simultâneas e estender o ciclo. Se a prova for marcada antes do fim, recalcular pelo tempo restante; não comprimir automaticamente todo o programa em poucas semanas. Para quem estiver começando do zero nas seis matérias, este ciclo é uma primeira passagem orientada, não promessa de esgotar o edital.

**Turma ilustrativa:** 05/10/2026 a 27/12/2026. São datas de estudo escolhidas neste plano, não datas oficiais de prova. Para outra abertura, manter intervalos de segunda a domingo e criar uma turma/calendário versionado. O dia 05/12 continua sendo uma meta financeira da empresa, não o encerramento pedagógico obrigatório.

### 6.2 Orçamento de questões — resolução e correção cabem no tempo

| Tipo de semana | Novas dirigidas (N) | Revisões (R) | Mistas/simulado (S) | Total | Hipótese de tempo |
|---|---:|---:|---:|---:|---|
| Normal | 130 | 50 | 20 | 200 | 3 min por resposta já incluindo correção: 600 min |
| Simulado completo | 50 | 30 | 80 | 160 | 4 h de prova + 2 h de correção; outras 80 respostas × 3 min = 4 h |

**Não somar o simulado por fora da meta semanal.** Nas semanas 4, 8 e 12, ele substitui parte da carga dirigida. A janela de 4 horas é uma hipótese de treino alinhada à estrutura prevista no termo, não afirmação de duração de todo caderno histórico. Se usar um caderno com outra duração, recalcular a carga restante.

O tempo de três minutos é uma hipótese inicial que inclui resolver e corrigir. Se a mediana real for cinco minutos, 10 horas comportam cerca de 120 respostas, não 200. Questões anuladas, sem gabarito confiável ou incompatíveis com a norma atual não servem como evidência de acurácia.

| Matéria | Semana normal N / R / S | Total normal | Semana com simulado N / R / S | Total com simulado |
|---|---|---:|---|---:|
| Administrativo | 25 / 9 / 4 | 38 | 10 / 5 / 15 | 30 |
| Constitucional | 25 / 9 / 4 | 38 | 10 / 5 / 15 | 30 |
| Penal | 25 / 9 / 4 | 38 | 10 / 5 / 15 | 30 |
| Processo Penal | 25 / 9 / 4 | 38 | 10 / 5 / 15 | 30 |
| Penal Militar | 15 / 7 / 2 | 24 | 5 / 5 / 10 | 20 |
| Direitos Humanos | 15 / 7 / 2 | 24 | 5 / 5 / 10 | 20 |
| **Total** | **130 / 50 / 20** | **200** | **50 / 30 / 80** | **160** |

Nos simulados, as questões são distribuídas pelo peso histórico; nas semanas normais, a distribuição é ligeiramente arredondada. As revisões podem ser realocadas conforme erros, preservando prática nas seis matérias.

No ciclo: **9 semanas normais + 3 semanas de simulado = 2.280 respostas planejadas**, sendo 1.320 dirigidas, 540 revisões e 420 mistas/simulados. Não são 2.280 questões inéditas comprovadas, nem uma exigência universal de aprovação.

O documento matemático anterior mostra um exemplo uniforme de 200 respostas por semana. Aqui o calendário concreto reduz o total nas semanas de simulado para reservar sua correção. Não são duas promessas cumulativas: este orçamento é o que rege a turma ilustrativa deste documento.

### 6.3 Fases, datas e resultados esperados

| Semana | Período de estudo | Objetivo da semana | Questões planejadas | Entrega de escrita |
|---|---|---|---:|---|
| 1 | 05–11/10 | Diagnosticar rotina; instalar fundamentos nas seis matérias | 200 | Um parágrafo jurídico estruturado e revisão do raciocínio |
| 2 | 12–18/10 | Avançar em atos, direitos fundamentais e teoria do crime | 200 | Uma resposta em Administrativo |
| 3 | 19–25/10 | Aplicar controle constitucional, investigação e culpabilidade | 200 | Uma resposta em Constitucional |
| 4 | 26/10–01/11 | Simulado de linha de base e correção; preservar estudo dirigido | 160 | Uma resposta em Penal, fora das 10 h de questões |
| 5 | 02–08/11 | Entrar em licitações, organização estatal, penas e cautelares | 200 | Uma resposta em Processo Penal |
| 6 | 09–15/11 | Aplicar serviços públicos, competências e procedimentos | 200 | Duas respostas curtas: Administrativo e Constitucional |
| 7 | 16–22/11 | Consolidar estatutos e crimes; tratar lacunas detectadas | 200 | Duas respostas curtas: Penal e Processo Penal |
| 8 | 23–29/11 | Segundo simulado; comparar acurácia e tempo com a semana 4 | 160 | Corrigir e reescrever uma resposta fraca |
| 9 | 30/11–06/12 | Legislação específica, recursos e grupos protegidos | 200 | Uma resposta integrada de Direito Público |
| 10 | 07–13/12 | Fechar primeira passagem pelos blocos complementares | 200 | Uma resposta jurídica com fonte e contraponto |
| 11 | 14–20/12 | Reduzir erros recorrentes e completar lacunas do catálogo | 200 | Duas respostas nos temas de maior erro |
| 12 | 21–27/12 | Terceiro simulado e plano individual do próximo ciclo | 160 | Diagnóstico de escrita; planejar sessão completa em bloco separado |

As respostas discursivas não incluem correção profissional contratada. Autoavaliação guiada: identificação do problema, regra aplicável, aplicação ao caso, conclusão e fonte conferível. Treino completo de quatro respostas precisa de janela própria; não escondê-lo dentro das duas horas se o tempo medido não couber.

### 6.4 Conteúdos semanais — quatro matérias principais

Os nomes abaixo são **sínteses pedagógicas**, não transcrição substitutiva do Anexo II. A matriz integral com redação literal está no documento complementar. O mapa de cobertura no Apêndice A indica onde cada linha histórica entra primeiro.

| Semana | Administrativo | Constitucional | Penal | Processo Penal |
|---|---|---|---|---|
| 1 | Princípios, organização e administração direta/indireta | Constituição, interpretação, eficácia, poder constituinte e Estado de Direito | Fontes, princípios e aplicação temporal/espacial da lei | Princípios, sistemas e aplicação da lei processual |
| 2 | Poderes e atos administrativos; atributos e invalidação | Direitos fundamentais, sociais, nacionalidade e direitos políticos | Fato típico, causalidade, dolo e culpa | Inquérito, arquivamento e ANPP |
| 3 | Processo administrativo, agentes, responsabilidades e PAD | Controle difuso/concentrado, ADI/ADC/ADPF e súmula vinculante | Tentativa, desistência, ilicitude, culpabilidade, erros e concurso de pessoas | Ação penal, competência, conexão e continência |
| 4 | LAI/LGPD e revisão dos erros do simulado | Ações constitucionais, ACP e acesso à informação; revisão | Prescrição e punibilidade; revisão da parte geral | Incidentes, sanidade, questões prejudiciais e medidas assecuratórias |
| 5 | Licitação e contratos; distinguir os regimes pertinentes | Organização do Estado, competências e intervenção | Penas, dosimetria, concurso de crimes e efeitos | Provas: admissibilidade, meios e obtenção; normas relacionadas |
| 6 | Serviços, concessões, PPP e consórcios | Administração pública; Legislativo e Executivo | Crimes contra pessoa, patrimônio e dignidade sexual | Prisões, liberdade e cautelares pessoais |
| 7 | Terceiro setor, OS/OSCIP, MROSC, terceirização e reforma | Judiciário, garantias e funções essenciais à Justiça | Crimes contra fé pública, Administração, Justiça e Estado Democrático | Sujeitos, atos, sentença e procedimentos comum/juizados |
| 8 | Estatuto PMERJ e Lei Orgânica Nacional: primeira leitura orientada | Segurança pública e defesa do Estado | Tortura, abuso, armas e drogas; corrigir o simulado | Maria da Penha, Henry Borel e procedimento de funcionários públicos |
| 9 | Estatuto PMERJ: segunda rodada; previdência e concurso público | Ordem social e Convenção sobre deficiência | Organização criminosa, lavagem, hediondos e alterações penais transversais | Recursos, habeas corpus, revisão criminal e nulidades |
| 10 | Bens, desapropriação, indenização e limitações | Constituição estadual e comparação com a federal | Racismo, ECA, Maria da Penha, Henry Borel, pessoa idosa e com deficiência | Execução penal; ECA e procedimentos especiais remanescentes |
| 11 | Responsabilidade estatal, controle, improbidade e anticorrupção | Revisão por erros de competências, poderes e controle | Trânsito, ambiente, consumo e crimes complementares do catálogo | Interceptação, crime organizado e Pacote Anticrime; casos integrados |
| 12 | Infrações administrativas/LRF e lacunas finais | Simulado, mapa de lacunas e próximo ciclo | Simulado, distinção entre tipos e próximo ciclo | Simulado, sequência procedimental e próximo ciclo |

### 6.5 Conteúdos semanais — Penal Militar e Direitos Humanos

| Semana | Penal Militar | Direitos Humanos |
|---|---|---|
| 1 | Aplicação e especificidades; identificar o âmbito militar | Fundamentos constitucionais e legislação de proteção |
| 2 | Crime, imputabilidade e concurso de agentes | Convenções e sistemas de proteção: conceitos e competências |
| 3 | Penas e aplicação; diferenças frente ao Penal comum | Sistema interamericano e tratados: segunda rodada aplicada |
| 4 | Suspensão/livramento, efeitos e medidas; revisão do simulado | Letalidade policial, ADPF 635 e Caso Nova Brasília: mapa inicial |
| 5 | Ação penal e extinção da punibilidade | Violência contra a mulher: formas e proteção |
| 6 | Crimes em paz; próprios e impróprios | Igualdade racial, discriminação e ações afirmativas |
| 7 | Crimes contra a pessoa | Desigualdade, interseccionalidade, população de rua e LGBTQIA+ |
| 8 | Crimes contra o patrimônio; revisão do simulado | Povos indígenas, quilombolas e territórios |
| 9 | Crimes contra a administração militar: primeira rodada | Pessoa idosa: proteção e inclusão |
| 10 | Crimes contra a administração militar: casos e distinções | Pessoa com deficiência: legislação, inclusão e convenção |
| 11 | Crimes em guerra; revisão comparada da parte geral | Letalidade e proteção: aplicação, atualização de fontes e revisão |
| 12 | Simulado e correção dos grupos mais fracos | Simulado e correção dos grupos mais fracos |

**Regra de capacidade:** um bloco amplo pode atravessar mais de uma semana. O aluno não será marcado como “conteúdo dominado” por terminar a semana. O calendário dá a primeira passagem; a fila de missões conserva os recortes ainda incompletos e alimenta o ciclo seguinte. As semanas de simulado têm menos questões dirigidas de propósito.

## 7. Exemplos concretos de como o aluno verá a trilha

### 7.1 Semana 1 — seis entregas, sem uma lista vaga de matérias

Cada linha vira atividades de conteúdo/prática/correção no calendário. Revisões e treino misto são tarefas separadas com os limites da seção 6.

| Matéria | Objetivo observável | Conteúdo a executar | Meta dirigida inicial | Evidência de execução |
|---|---|---|---:|---|
| Administrativo | Distinguir administração direta, indireta e delegação | Ler o recorte indicado no material do aluno; fazer quadro com entidade, vínculo e regime | 25 | Respostas corrigidas e três distinções escritas |
| Constitucional | Distinguir eficácia das normas e limites de reforma | Ler Constituição e material de apoio selecionado; classificar exemplos | 25 | Respostas corrigidas; justificar dois erros com fonte |
| Penal | Resolver conflito de leis no tempo e no espaço | Ler os dispositivos correspondentes e montar sequência de decisão | 25 | Respostas corrigidas; explicar retroatividade e ultratividade |
| Processo Penal | Distinguir sistema, norma e aplicação temporal | Ler disposições iniciais e comparar hipóteses de aplicação | 25 | Respostas corrigidas e síntese de um caso |
| Penal Militar | Reconhecer quando o enquadramento militar deve ser examinado | Ler recorte vigente do CPM e material jurídico do aluno | 15 | Respostas corrigidas; apontar o elemento militar do caso |
| Direitos Humanos | Distinguir proteção constitucional e convencional | Ler recorte de Constituição e documentos oficiais indicados | 15 | Respostas corrigidas e mapa de instrumentos de proteção |

**Os 25/15 são parcelas do orçamento da semana, não metas finais de domínio de todos os assuntos da linha.** Missões menores dividem essas parcelas. Se uma unidade exigir 50 questões no ciclo, ela pode ser praticada em dois blocos de 25, sem que o primeiro seja rotulado como domínio.

### 7.2 Exemplo detalhado — semana 3, Controle de Constitucionalidade

**Unidade:** fundamentos do controle concentrado. **Missão:** identificar cabimento, legitimidade e efeitos básicos de ADI/ADC. **Assunto histórico associado:** a linha do Anexo II que reúne ADC, ADI, ADPF e súmula vinculante; o recorte ADI/ADC é autoral e não esgota a linha.

| Etapa | O que executar | Critério |
|---|---|---|
| Conteúdo | Ler Constituição e legislação processual pertinente em fonte oficial; construir tabela objeto / legitimados / efeitos | Preencher a tabela sem copiar uma resposta pronta |
| Prática | Resolver 25 questões novas compatíveis com o recorte | Registrar respostas e corrigir todas |
| Revisão | Revisitar nove erros ou casos de contraste anteriores de Constitucional | Relacionar o erro à regra confundida; se não houver nove erros, usar recuperação de memória e casos anteriores |
| Misto | Quatro questões de Constitucional no bloco semanal | Anotar tempo e motivo da alternativa |
| Explicação | Justificar duas respostas com fonte conferível | Não inventar precedente ou dispositivo |
| Retorno | Reservar verificação depois de pelo menos sete dias | Evidência posterior separada do volume já realizado |

Se for desejada uma missão de **30 questões**, reservar 30 dirigidas para ela e reduzir cinco dirigidas de outra matéria nessa semana, ou aumentar tempo de prática de modo explícito. Não adicionar cinco silenciosamente a um orçamento fechado.

No modelo matemático, se o recorte for normal, de alta prioridade e o aluno acertar 60%, a meta Base calculada é 70 questões novas. Os 25 dessa semana são uma parcela; a sequência pode ser 25 + 25 + 20 em semanas futuras. O restante de Constitucional conserva seu lugar no orçamento; não se conclui todo o bloco com o primeiro lote.

### 7.3 Como dividir conteúdo amplo

“Lei nº 443/1981” deve gerar missões como: identificar categorias e situações funcionais; distinguir direitos/deveres; analisar regras de carreira aplicáveis; resolver casos previstos no recorte validado. Antes de publicar, o editor precisa conferir o texto vigente e o conteúdo efetivamente exigido. Esta enumeração é um método de decomposição, não interpretação definitiva do estatuto.

Nunca gerar 40 ou 50 questões automaticamente para cada uma das 219 linhas. Há sobreposição, agrupamentos e temas transversais. O manifesto deve identificar a unidade operacional primária para evitar duplicidade de carga.

## 8. Modelo matemático aplicado ao sistema real

### 8.1 A fórmula mantida

`Q_base(i) = 5 × teto[(40 × C_i × P_i × D_i) / 5]`

`D_i = limitar(1 + 2 × (0,80 − a_i); 0,75; 1,75)`

- `C`: abrangência compacta 0,75; normal 1; ampla 1,5. Mais de cinco objetivos distintos: dividir.
- `P`: prioridade baixa 0,75; média 1; alta 1,25.
- `a`: acerto recente em questões novas e válidas do assunto; amostra insuficiente usa `D = 1,25`.
- Essencial = 60% da Base, arredondada para cima em blocos de cinco; Reforço = 150% da Base, com o mesmo arredondamento.

**Todos os coeficientes são hipóteses operacionais.** Não são médias comprovadas de aprovados nem fórmula de probabilidade de aprovação. A explicação integral, os exemplos e as limitações estão no documento complementar.

### 8.2 Duas travas antes de automatizar

**Trava de dado:** não calcular `a_i` por assunto usando apenas acerto agregado da matéria. Não tratar questão repetida como nova. Enquanto só houver registro manual, usar meta editorial provisória e apresentar os dados como autodeclarados.

**Trava de tempo:** para questões e correção,

`B_semana = 5 × piso[(60 × H_pratica / minutos_por_questao_corrigida) / 5]`.

Para uma semana com simulado completo, retirar primeiro seu tempo de execução e correção; distribuir apenas o tempo restante. Leitura e discursiva têm orçamento separado.

Se a soma das metas desejadas exceder a capacidade, priorizar pré-requisitos, incidência comprovada, importância do edital e erros recentes; distribuir a execução ao longo das semanas. **Não diminuir silenciosamente o critério de aprendizado para dizer que tudo coube.**

### 8.3 Domínio, execução e probabilidade de aprovação

O modelo anterior propõe, para consolidação, acerto observado de 85%, limite inferior de Wilson de 75%, cobertura representativa, mais de uma sessão e verificação posterior. Isso é uma regra experimental de produto, dependente da qualidade e independência aproximada das questões. Não é “95% de chance de passar”.

O produto atual tem heurísticas próprias em `niveisAluno.js`, com faixas de volume/acerto e proximidade de prova. Elas não implementam esse modelo. **Não reutilizar o rótulo “avançado” como sinônimo de consolidação estatística.**

Para Gabriel acompanhar inicialmente: volume executado, acurácia com origem identificada, tempo por questão, erros recorrentes e resultado em amostra mista. Progresso para aprovação exige ainda regra do edital, classificação, discursiva e demais etapas do concurso; uma trilha de questões não determina isso sozinha.

## 9. Banco de questões: encaixe na trilha

### 9.1 O que se reaproveita e o que falta

Reaproveitar matéria → assunto → subassunto → missão e o histórico de progresso. `questoes_prova` continua tendo papel de referência/tagueamento de prova histórica; não possui o domínio completo de resolução.

A integração deve acrescentar apenas o necessário para identificar questão externa, sessão/entrega e tentativa. Campos conceituais: fornecedor, ID externo, assunto interno, missão, aluno/tenant, versão do gabarito, resposta, acerto, duração, instante e status de anulação. O schema físico definitivo depende do contrato real da API e da decisão sobre agrupamento de registros.

**Não guardar enunciado ou alternativas de modo persistente antes de confirmar a licença.** Também verificar permissão para cache, exibição comercial, imagens, comentários e uso com IA. A assinatura não demonstra automaticamente essas permissões.

### 9.2 Fluxo mínimo

1. Aluno abre uma missão e solicita um lote compatível com o recorte.
2. Backend autentica o aluno e valida a missão/tenant; seleciona questões disponíveis e permitidas.
3. Gabarito não é enviado junto da pergunta antes da resposta.
4. Backend recebe resposta idempotente, calcula o resultado e salva a tentativa.
5. Uma única projeção atualiza o progresso existente, com vínculo temático correto.
6. Erro entra em revisão do mesmo assunto; repetição não se torna nova questão inédita.
7. Sem fornecedor disponível, a trilha continua aberta e oferece registro manual identificado como tal.

A chave fica em secret do backend, nunca em variável `VITE_`. Aplicar timeout, limite por aluno, retry apenas quando seguro e observabilidade com IDs de correlação sem enunciados/dados pessoais desnecessários.

**Idempotência obrigatória:** retransmitir a mesma resposta não pode gerar segunda tentativa válida, segundo registro agregado ou XP duplicado. Uma sessão registrada manualmente e depois importada pela API precisa de regra de conciliação; não contar as duas silenciosamente.

### 9.3 Gate de cobertura antes de ativar o botão

| Teste | Critério de aceite |
|---|---|
| Catálogo | As seis matérias e seus recortes críticos têm IDs/filtros conferidos |
| Primeiras semanas | Cada missão publicada tem lote suficiente e gabarito utilizável; faltas ficam explicitadas |
| Penal Militar e normas PMERJ | Inspeção manual de amostra; não presumir cobertura por haver “Direito” no catálogo |
| Atualidade | Questões de lei revogada são excluídas da acurácia atual ou identificadas como históricas |
| Repetição | O sistema reconhece questão já respondida pelo aluno |
| Falhas | Timeout/limite do fornecedor não impede entrar na trilha ou registrar estudo |
| Explicação | Gabarito e revisão funcionam sem comentário; IA só entra com fonte e licença adequadas |
| Segurança | Aluno não acessa tentativa, sessão ou missão privada de outro aluno/tenant |

Ausência de amostra Cesgranrio suficiente em Processo Penal ou Penal Militar não significa que essas matérias serão irrelevantes. Usar fontes e questões válidas de outras bancas como treino de conteúdo, identificando a banca; não vender “perfil Cesgranrio comprovado” onde a pesquisa registrou “não encontrado”.

## 10. Encaixe técnico: campos e fonte única

### 10.1 Manifesto de conteúdo

Criar `supabase/seed/trilha-pmerj-cfo-v1.json` como fonte editorial e adaptar um gerador versionado. Os geradores existentes possuem escolhas específicas de CN e EsPCEx; não apenas trocar o título. Em especial, não copiar a distribuição de assuntos por módulo/rotação do gerador EsPCEx para disciplinas jurídicas com pré-requisitos.

O manifesto deve gerar calendário, tarefas, catálogo e missões de maneira consistente. IDs estáveis por versão; nomes podem mudar sem criar registros duplicados. Reaplicar o mesmo seed deve ser idempotente e não mover datas já atribuídas aos alunos.

**Publicação e permissões:** nas policies inspecionadas, diversas tabelas globais de conteúdo são legíveis por usuários autenticados; o catálogo de missões não tem o mesmo filtro de publicação de `trilhas`. Não inserir rascunhos supondo que estarão privados nem armazenar conteúdo licenciado por tenant em catálogo global sem regra específica. Testar primeiro em ambiente apropriado; publicação visual e autorização de acesso são controles diferentes.

| Decisão de conteúdo | Destino no modelo atual | Cuidado |
|---|---|---|
| Nome e versão da turma | `trilhas` | Não alterar versão já em uso sem plano de migração |
| Datas e orçamento | `trilha_semanas` | `meta_questoes` é capacidade semanal, não corte de aprovação |
| Tarefa de conteúdo/revisão | `atividades_modelo.texto` | Hoje não existe ligação tipada com missão |
| Matérias | `materias` e `disciplinas` | Códigos idênticos nos dois domínios |
| Fonte histórica | `status_dado` + observação + manifesto | Diferenciar oficial histórico de inferência sobre próximo ciclo |
| Alvo da prática | `missoes.assunto_id` / `subassunto_id` | Recorte da missão precisa estar claro e ser validável |
| Ordem da prática | `missoes.ordem` | Motor atual usa esta ordem; semana sugerida não substitui isso |
| Semana pedagógica | `trilha_plano_missoes.semana_sugerida` | Hoje apenas metadado, não controle automático da fila |
| Progresso individual | `aluno_missoes` + registros vinculados | Não editar acumulados no frontend |
| Meta adaptativa individual | Extensão proposta | Não confundir com override de toda a escola |

### 10.2 Exemplo de contrato, não payload pronto para produção

```json
{
  "nicho": "pmerj-cfo",
  "examTag": "pmerj_cfo",
  "nome": "CFO PMERJ — preparação pré-edital",
  "versao": 1,
  "statusDado": "inferencia",
  "fontePrograma": "Anexo II do edital CFO PMERJ 2024, retificado; aplicabilidade ao próximo ciclo provisória",
  "dataProvaConfirmada": null,
  "turmaInicio": "2026-10-05",
  "semanas": [
    {
      "n": 3,
      "inicio": "2026-10-19",
      "fim": "2026-10-25",
      "foco": "Controle constitucional, culpabilidade e investigação",
      "metaQuestoes": 200,
      "tarefas": [
        {
          "s": "dir_const",
          "p": "F",
          "t": "Distinguir cabimento, legitimidade e efeitos de ADI/ADC; preencher quadro comparativo e resolver 25 questões corrigidas.",
          "missaoRefEditorial": "pmerj-cfo-v1-const-controle-adi-adc-01"
        }
      ]
    }
  ]
}
```

`dataProvaConfirmada`, `turmaInicio` e `missaoRefEditorial` são propriedades propostas do manifesto; **não são colunas já disponíveis nem recursos automaticamente reconhecidos pelo gerador atual**. O trecho é parcial, não contém a semana inteira nem todos os IDs. O agente deve implementar o contrato e sua validação antes de gerar SQL.

Os códigos `F/P/X` são a enumeração atual de prioridade de tarefas; eles não são as faixas Essencial/Base/Reforço da carga de questões. Preservar a semântica exibida no produto.

### 10.3 Inscrição tardia

Com o calendário global atual, cadastrar em novembro um aluno na turma iniciada em outubro pode abrir a semana corrente enquanto sua fila temática começa do início. Isso precisa ser uma decisão consciente.

**MVP proposto:** turmas com início explícito e escolha manual de calendário no cadastro. Abrir nova turma apenas quando houver necessidade, com identidade/versionamento próprios. Não executar um gerador que recalcule as datas de uma turma em andamento. Um modelo individual “semana 1 a partir da matrícula” exige mudança no cálculo de calendário e fica para depois se a operação manual atender.

Na primeira sessão, informar: semana da turma, ponto de entrada do aluno e atividades de recuperação necessárias. O calendário orienta a rotina, e as missões mostram as pendências temáticas; um não deve fingir que o outro está concluído.

## 11. Plano de execução para Gabriel e agente de código

As durações são **estimativas de esforço com revisão**, não promessa de tempo de geração da IA. O total depende do estado da integração em outra branch e da cobertura real do fornecedor. Não assumir que uma resposta rápida do agente elimina teste e revisão pedagógica.

| Etapa | O que / por quê | Quem / ferramenta | Esforço estimado | Dependência | Aceite / risco se faltar |
|---|---|---|---|---|---|
| P0.1 | Confirmar versão do programa e indicação pré-edital | Gabriel + revisão editorial | 1–2 h | Edital histórico e termo | Fontes e versão explícitas; evita vender edital inexistente |
| P0.2 | Permitir data não confirmada e prontidão pré-edital | Agente, branch local + testes | 3–6 h | Código atual deste relatório | Cadastro e telas sem data falsa; outros concursos preservados |
| P0.3 | Montar manifesto das seis matérias e calendário | Agente gera; Gabriel revisa amostra e cobertura | 6–12 h | P0.1; mapa do Apêndice A | Todos os itens históricos mapeados; primeiras semanas revisadas |
| P0.4 | Vincular prática ao assunto/missão; distinguir manual, revisão e misto | Agente, RPC/gatilhos + testes | 6–12 h | Decisão de vínculo e contrato API | Questão fora do assunto não conclui missão; falha não duplica XP |
| P0.5 | Testar fornecedor, licença e cobertura da primeira sequência | Gabriel no painel; agente no backend de teste | 2–4 h, fora resposta do fornecedor | Conta já contratada | Amostra com filtros/IDs/gabarito; limitações documentadas |
| P0.6 | Publicar conteúdo em teste, depois release autorizada | Agente; Gabriel valida interface | 3–5 h | P0.2–P0.5, gates do produto | Jornada completa e diff de banco restrito ao escopo |
| P0.7 | Definir turma e realizar onboarding manual | Gabriel no painel | 20–30 min no primeiro ensaio | Conteúdo aprovado | Aluno certo, tenant certo, calendário certo, primeira missão visível |
| P1.1 | Persistir tentativas, revisão e feedback da API com segurança | Agente | 6–12 h, ajustar após contrato | P0.4/P0.5 | Corrigir resposta no servidor, idempotência e fallback testados |
| P1.2 | Unificar métricas e tratamento de simulados | Agente + Gabriel valida exemplos | 3–6 h | Origem das tentativas definida | Simulado conta uma vez; ausência de acertos não vira erro |
| P1.3 | Meta individual versionada e classificação experimental de consolidação | Agente + editor pedagógico | 4–8 h para desenho/primeira implementação | Dados confiáveis por questão/assunto | Recalibração não altera história nem metas de toda a escola |
| P1.4 | Melhorar apoio à discursiva e regras de nota | Editor + agente | Estimar após edital/escopo | Regra oficial e capacidade de revisão | Quatro respostas não viram uma nota genérica de redação |

**Ordenação:** P0.2, P0.3 e verificação de fornecedor podem avançar em paralelo de trabalho, sem alterar produção. P0.4 é obrigatório antes de vender atribuição temática automática. P1.1 passa a ser gate de lançamento se “resolver questões dentro da Triliva” estiver na oferta contratada. Sem esse recurso, ajustar a oferta à versão realmente disponível, com transparência.

**Custo:** nenhum gasto novo foi realizado nesta auditoria. Implementação usa ferramentas já disponíveis; o custo financeiro incremental depende do plano da API já comprado, capacidade de hospedagem e eventual revisão jurídica/pedagógica. Esses valores não foram fornecidos/verificados nesta etapa; **não encontrado**, não assumir custo zero. Não é necessário criar outro projeto Supabase pago só para armazenar a nova trilha.

### O que Gabriel faz

- Aprova o nome pré-edital e o perfil/carga da turma inicial.
- Confirma, no painel do fornecedor, plano, limites e documentos de licença; entrega secrets pelo mecanismo seguro do backend, não em conversa ou frontend.
- Testa um cadastro sintético autorizado e percorre Hoje → semana → missão → questão/registro → progresso.
- Confere o texto de seis missões, uma de cada matéria, e a clareza da primeira semana.
- Aprova a publicação depois das evidências; nenhuma publicação está autorizada por este documento.

### O que o agente faz

- Reconfere o SHA antes de implementar e preserva mudanças posteriores a esta auditoria.
- Cria manifesto, gerador e validação; implementa os ajustes restritos de data, prontidão e vínculo.
- Trabalha com banco local ou ambiente de teste apropriado; não copia dados pessoais de produção para testar.
- Entrega diff, testes, evidências e procedimento de retorno; só aplica banco/deploy após autorização.

### O que pode ser automatizado

Validação da cobertura do programa, geração idempotente de seeds, soma das metas, checagem de fontes obrigatórias, consistência de códigos e datas, testes de vínculo e detecção de duplicidade. Revisão de interpretação jurídica, escolha de recortes e qualidade da questão exigem validação editorial.

## 12. Testes que fecham esta trilha

| Teste | Resultado esperado |
|---|---|
| Concurso sem data confirmada | Nenhuma contagem regressiva inventada; calendário de estudos disponível |
| Fonte histórica / prontidão operacional | Aviso pré-edital claro sem bloquear indevidamente a semana pronta |
| Cadastro | PMERJ recebe somente a trilha e as matérias PMERJ |
| Nova turma | Datas de turma anterior não mudam |
| Registro livre de outro assunto | Soma volume geral, não conclui missão temática errada |
| Registro de revisão | Permanece no assunto de origem, não avança automaticamente a próxima missão |
| Edição/exclusão de registro | Reprocessa o vínculo correto, sem XP órfão ou duplicado |
| Resposta repetida por retry | Uma tentativa válida e um crédito de progresso |
| Questão anulada | Preserva histórico, exclui da métrica de acurácia aplicável e informa o aluno |
| Falta de gabarito/questão indisponível | Não grava acerto inventado; permite continuar com outra questão/fallback |
| Meta 30, registro válido 50 | Total 50; meta atendida 30 e extras 20 se a UI for implementada; sem crédito automático na próxima |
| Meta por aluno | Ajustar um aluno não muda as metas dos demais no mesmo tenant |
| Simulado de 80 | Oitenta respostas contadas uma vez; nunca 80 no simulado mais 80 duplicadas no total |
| Autorização | Aluno A não obtém nem altera sessão/tentativa de B; troca de IDs não contorna o tenant |
| API fora do ar | Hoje, calendário e registro manual continuam utilizáveis |
| Cobertura editorial | Todas as 219 linhas históricas têm destino ou pendência explícita; nada some por ter zero na amostra FGV |

**Observação sobre simulados:** `calcularMetricas` usa `registros_estudo` para o volume semanal; um simulado armazenado apenas em `simulados` não é automaticamente esse volume. A integração deve ter uma fonte canônica de tentativas e uma projeção única, ou uma conciliação explícita no modo manual. Esse comportamento precisa ser testado antes de exibir as metas totais da seção 6 como realizadas pelo sistema.

## 13. Como atualizar quando sair o edital

1. Registrar fonte, publicação, retificações e data oficial, quando houver.
2. Comparar programa linha a linha: manter, alterar, incluir ou remover; preservar histórico de 2024.
3. Conferir banca, número de questões, pesos, alternativas, duração, discursivas e regras eliminatórias.
4. Recalcular tempo disponível e sequência; apresentar mudanças ao aluno sem apagar trabalho feito.
5. Versionar conteúdo e metas; não reescrever gabaritos, tentativas ou XP sem política explícita.
6. Reexecutar validação de conteúdo e jornada de exemplo antes da publicação.

**Decisão final desta etapa:** manter o calendário de estudo, o catálogo jurídico e as missões no modelo existente. Priorizar verdade do progresso, data desconhecida e coerência entre semana e missão. Não construir novo LMS, novo catálogo pedagógico paralelo ou uma máquina de “aprovação garantida”.

## Apêndice A — mapa verificável das 219 linhas históricas

Este mapa é uma decisão editorial de **primeira exposição**. Não afirma que todas as linhas estarão dominadas na semana indicada. Os números identificam a posição sequencial das linhas de cada matéria na seção 6 do documento `PMERJ_CFO_Matriz_e_Modelo_de_Metas.md`, preservada da pesquisa anterior. Não são números oficiais do edital.

Transversais voltam nas semanas seguintes; cada linha recebe um destino primário para auditoria. O agente deve materializar esses vínculos no manifesto e validar a cobertura antes de publicar. Nas linhas com erros materiais aparentes da própria transcrição histórica — por exemplo, a referência de ano da lei de tortura — manter a citação literal para rastreabilidade e conferir o diploma correto em fonte oficial antes de montar a atividade.

Legenda: ADM = Administrativo; CONST = Constitucional; PEN = Penal; CPP = Processo Penal; CPM = Penal Militar; DH = Direitos Humanos. “—” significa revisão/aplicação de itens já introduzidos, não ausência de estudo.

| Semana de primeira exposição | ADM | CONST | PEN | CPP | CPM | DH |
|---|---|---|---|---|---|---|
| 1 | 1–3 | 1–6 | 1–11,56,70–71 | 1–5,46–47 | 1 | 1,12 |
| 2 | 11–12 | 10–12 | 12–23 | 6–8 | 2–4 | 2 |
| 3 | 13,18–21 | 7–9 | 24–32 | 9–13 | 5–6 | — |
| 4 | 40 | 13–15 | 38–40 | 14–19 | 7–11 | 7 |
| 5 | 14–15 | 16–18 | 33–37 | 20–24,45 | 12–13 | 8 |
| 6 | 9–10,16–17 | 19–21 | 41–42,44 | 25,27–29 | 14–16 | 6 |
| 7 | 4–8 | 22–24 | 48–51 | 26,30–34 | 17 | 3–5 |
| 8 | 23–24 | 25–26 | 58,62,64,67 | 35–37 | 18 | 9 |
| 9 | 22,25 | 27,29 | 54,60,65,68 | 38–43 | 19 | 10 |
| 10 | 26–33 | 28 | 52–53,61,63,66,69 | 44 | — | 11 |
| 11 | 34–37 | — | 43,45–47,55,57,59 | — | 20 | — |
| 12 | 38–39 | — | — | — | — | — |

**Validação do mapa:** ADM 40 + CONST 29 + PEN 71 + CPP 47 + CPM 20 + DH 12 = **219 linhas**; cada linha tem exatamente um primeiro destino. Trata-se de contagem do catálogo histórico transcrito, não de questões da prova.

**Exemplos de leitura do mapa:** CONST 7–9 são as três linhas de controle constitucional, iniciadas na semana 3; ADM 23–24 são Lei Orgânica Nacional e Estatuto PMERJ, iniciados na semana 8; DH 7 é letalidade policial/ADPF 635/Nova Brasília, iniciado na semana 4 e retomado na 11.

As disposições constitucionais e a jurisprudência de Penal (70–71) e Processo Penal (46–47) são introduzidas como método na semana 1 e atravessam todo o ciclo. PEN 56 tem conexão com os tratados de Direitos Humanos. CPP 45 tem primeira exposição no estudo de provas, mas seu conjunto de normas será retomado em procedimentos e investigação. Esses vínculos não autorizam duplicar acertos na medição.

**Como o agente transforma o mapa em dados:** ler as linhas da matriz por matéria, atribuir chave editorial estável como `ADM-01`, guardar redação literal e posição de origem, associar a semana acima e acrescentar o recorte operacional. Não depender apenas da posição depois de uma retificação: uma nova versão precisa de um mapa explícito entre IDs antigos e novos.

## Apêndice B — fontes técnicas fixadas na versão inspecionada

Consultas de banco: schemas `public` e `app`, metadados de colunas/constraints/policies, contagens exatas, conteúdo pedagógico e `pg_get_functiondef` das rotinas relevantes. Não foi extraído cadastro nominal de alunos para este relatório.

| Evidência | Arquivo no SHA inspecionado | O que sustenta |
|---|---|---|
| Fábrica editorial | [docs/conteudo/fabrica-trilhas-concursos.md](https://github.com/Jinriuk/Rumo-a-aprova-o-/blob/7124ccd025af6bfd43d34fb923be82cafcfb041a/docs/conteudo/fabrica-trilhas-concursos.md) | Pipeline de conteúdo, maturidade, seeds e testes |
| Operação das missões | [docs/operacao/missoes-em-sequencia.md](https://github.com/Jinriuk/Rumo-a-aprova-o-/blob/7124ccd025af6bfd43d34fb923be82cafcfb041a/docs/operacao/missoes-em-sequencia.md) | Comportamento e manutenção da fila sequencial |
| Motor SQL | [supabase/migrations/0061_missoes_em_sequencia.sql](https://github.com/Jinriuk/Rumo-a-aprova-o-/blob/7124ccd025af6bfd43d34fb923be82cafcfb041a/supabase/migrations/0061_missoes_em_sequencia.sql) | app.missoes_fila, app.missoes_reprocessar, app.missoes_aplicar e vínculo de registros |
| Carregamento de dados | [app/src/shared/data/index.js](https://github.com/Jinriuk/Rumo-a-aprova-o-/blob/7124ccd025af6bfd43d34fb923be82cafcfb041a/app/src/shared/data/index.js) | carregarPlanoConcurso, registros e leituras de missão |
| Tela de concurso | [app/src/modules/conteudo/TrilhaConcurso.jsx](https://github.com/Jinriuk/Rumo-a-aprova-o-/blob/7124ccd025af6bfd43d34fb923be82cafcfb041a/app/src/modules/conteudo/TrilhaConcurso.jsx) | Planos informativos e apresentação do catálogo |
| Fila no frontend | [app/src/modules/conteudo/missoes.js](https://github.com/Jinriuk/Rumo-a-aprova-o-/blob/7124ccd025af6bfd43d34fb923be82cafcfb041a/app/src/modules/conteudo/missoes.js) | Seleção/apresentação das metas das missões |
| Calendário no frontend | [app/src/modules/conteudo/useTrilha.js](https://github.com/Jinriuk/Rumo-a-aprova-o-/blob/7124ccd025af6bfd43d34fb923be82cafcfb041a/app/src/modules/conteudo/useTrilha.js) | Consumo de semanas e tarefas |
| Maturidade | [app/src/modules/conteudo/maturidade.js](https://github.com/Jinriuk/Rumo-a-aprova-o-/blob/7124ccd025af6bfd43d34fb923be82cafcfb041a/app/src/modules/conteudo/maturidade.js) | Regras completa/beta/esqueleto/indisponivel |
| Data da prova | [app/src/modules/conteudo/concursos.js](https://github.com/Jinriuk/Rumo-a-aprova-o-/blob/7124ccd025af6bfd43d34fb923be82cafcfb041a/app/src/modules/conteudo/concursos.js) | proximaProva e diasParaProva |
| Cadastro | [app/src/modules/pessoas/CadastroAlunos.jsx](https://github.com/Jinriuk/Rumo-a-aprova-o-/blob/7124ccd025af6bfd43d34fb923be82cafcfb041a/app/src/modules/pessoas/CadastroAlunos.jsx) | Escolha do concurso e trilha |
| Provisionamento | [supabase/functions/provisionar-aluno/index.ts](https://github.com/Jinriuk/Rumo-a-aprova-o-/blob/7124ccd025af6bfd43d34fb923be82cafcfb041a/supabase/functions/provisionar-aluno/index.ts) | Criação controlada e atribuição de trilha |
| Estrutura e nota | [app/src/modules/conteudo/simuladoConcurso.js](https://github.com/Jinriuk/Rumo-a-aprova-o-/blob/7124ccd025af6bfd43d34fb923be82cafcfb041a/app/src/modules/conteudo/simuladoConcurso.js) | Regra eliminatória e tratamento de redação |
| Pedagogia | [app/src/modules/conteudo/pedagogia.js](https://github.com/Jinriuk/Rumo-a-aprova-o-/blob/7124ccd025af6bfd43d34fb923be82cafcfb041a/app/src/modules/conteudo/pedagogia.js) | Modelos de eliminação e seus significados |
| Heurísticas de nível | [app/src/modules/conteudo/niveisAluno.js](https://github.com/Jinriuk/Rumo-a-aprova-o-/blob/7124ccd025af6bfd43d34fb923be82cafcfb041a/app/src/modules/conteudo/niveisAluno.js) | Níveis existentes, distintos do modelo experimental proposto |
| Métricas de tela | [app/src/modules/desempenho/metricas.js](https://github.com/Jinriuk/Rumo-a-aprova-o-/blob/7124ccd025af6bfd43d34fb923be82cafcfb041a/app/src/modules/desempenho/metricas.js) | calcularMetricas: volume de registros e tratamento do acerto geral |
| Agregadores | [app/src/shared/metricas/agregados.js](https://github.com/Jinriuk/Rumo-a-aprova-o-/blob/7124ccd025af6bfd43d34fb923be82cafcfb041a/app/src/shared/metricas/agregados.js) | Denominador de registros com acertos informados |
| Seed e gerador EsPCEx | [scripts/gerar-seed-trilha-espcex.mjs](https://github.com/Jinriuk/Rumo-a-aprova-o-/blob/7124ccd025af6bfd43d34fb923be82cafcfb041a/scripts/gerar-seed-trilha-espcex.mjs) | Geração específica, distribuição de assuntos e missões |
| Gerador CN | [scripts/gerar-seed-trilha.mjs](https://github.com/Jinriuk/Rumo-a-aprova-o-/blob/7124ccd025af6bfd43d34fb923be82cafcfb041a/scripts/gerar-seed-trilha.mjs) | Calendário específico e risco de copiar regras de datas |
| Validador | [scripts/validar-conteudo.mjs](https://github.com/Jinriuk/Rumo-a-aprova-o-/blob/7124ccd025af6bfd43d34fb923be82cafcfb041a/scripts/validar-conteudo.mjs) | Gates de conteúdo e maturidade |
| Exemplo JSON | [supabase/seed/trilha-espcex-v1.json](https://github.com/Jinriuk/Rumo-a-aprova-o-/blob/7124ccd025af6bfd43d34fb923be82cafcfb041a/supabase/seed/trilha-espcex-v1.json) | Formato de disciplinas, rotinas e missões existente |

### Consulta de referência, somente leitura

```sql
select 'concursos' as estrutura, count(*) as quantidade from public.concursos
union all select 'trilhas', count(*) from public.trilhas
union all select 'trilha_semanas', count(*) from public.trilha_semanas
union all select 'atividades_modelo', count(*) from public.atividades_modelo
union all select 'missoes', count(*) from public.missoes
union all select 'trilha_planos', count(*) from public.trilha_planos;

select table_schema, table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema in ('public', 'app')
  and table_name in ('concursos', 'trilha_semanas', 'atividades_modelo',
    'registros_estudo', 'aluno_missoes', 'missao_registros')
order by table_schema, table_name, ordinal_position;
```

As conclusões de código são análises da versão informada. Se a `main`, o schema ou uma branch de integração mudar, revisar os pontos afetados. Esta especificação não substitui a validação da release candidata.
