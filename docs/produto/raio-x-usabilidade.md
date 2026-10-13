# Raio-x de usabilidade (13/10/2026)

Documento de diagnóstico. Nada daqui foi implementado: cada mudança espera aprovação.

## Como foi feito

- **App:** front do PR #184 (inclui a correção da maturidade do CFO PMERJ), apontado para o **demo** (`bdjkgrzfzoamchdpobbl`). A stack local não sobe nesta máquina (sem Docker).
- **Contas, todas na escola "Escola de teste P1.1 (apagar)":**
  - uma coordenação de teste;
  - um aluno criado pela própria interface (cadastro, credencial, troca de senha);
  - um responsável criado pela interface;
  - a conta super_admin temporária já autorizada para a medição da Quest, reativada só durante as capturas e desativada em seguida.
- **Telas:** desktop em 1366 px; aluno e responsável também no celular (390 px). As capturas estão em [`capturas/`](capturas/).
- **O que não foi versionado:** a Visão geral, a lista de escolas e os Logs do super_admin mostram nomes e e-mails de outras escolas. Por isso não entraram no repositório e estão descritos só em texto. A tela "Nova escola" foi recortada para ficar só o formulário.
- **Artefato das capturas de página inteira:** o cabeçalho fixo às vezes aparece no meio da imagem. Isso não acontece na tela real.
- **Simulados (aluno):** a aba ainda mostrava "Carregando os simulados…" no momento da captura. Por isso não há inventário dessa tela.

## Resumo para quem tem 1 minuto

1. **O aluno novo vê três coisas diferentes chamadas "missão" na mesma tela.**
   - "MISSÃO 2" é a semana.
   - "Missões (0 de 18)" são os assuntos de cada matéria.
   - "Missão: Poderes e elementos…" é um item da lista da semana.

   Além disso, a mesma lista da semana se chama, conforme a tela, objetivos, alvos, atividades ou metas.
2. **O Hoje do primeiro acesso tem 32 botões de ação, fora o menu, e 4 camadas por cima da tarefa.** São elas:
   - o formulário de boas-vindas;
   - o convite do guia, que cobre o cartão principal no celular;
   - o aviso de pré-edital;
   - o cronômetro.

   Para começar a estudar existem 6 botões diferentes: "Continuar missão", "Praticar esta missão", "Resolver questões aqui", "Praticar agora", "Iniciar estudo" e "Concluir".
3. **As questões resolvidas no app não contam onde o aluno olha.** Depois de 5 questões, o assunto mostra 5/20, mas "Objetivos da semana" continua 0/13 e o XP continua 0.
4. **O primeiro acesso pode travar o aluno.**
   - A tela pede "mínimo 8 caracteres" e marca a senha como "Forte".
   - O servidor de autenticação do demo exige minúscula, maiúscula e número.
   - Uma senha sem número dá só "Não foi possível salvar a senha agora".
5. **Um aluno cadastrado hoje já entra na "Semana 2", com a semana 1 "encerrada".** Nada explica isso.

## 1. Inventário por tela

Legenda: **Objetivo**, **Nomes** (termos do domínio que a tela usa), **Textos longos** (acima de cerca de 160 caracteres, ou repetidos), **Botões** (ações visíveis, sem contar o menu).

### Público

| Tela | Objetivo | Nomes | Textos longos | Botões |
|---|---|---|---|---|
| [Entrada](capturas/publico-01-entrada.jpg) | Escolher o tipo de acesso e entrar | central, missão, plano, prática, domínio, código de acesso | Chamada "Sua prova tem um alvo. Seu estudo também." e um diagrama de 3 passos (Plano, Prática, Domínio) que não se repete dentro do app | Aluno / Responsável, Coordenação, Entrar na missão, Esqueci meu código de acesso, "Efeitos ativos" (não diz o que faz) |
| [Login por e-mail](capturas/publico-03-login-email.jpg) | Coordenação e super_admin entram | coordenação | — | Entrar na missão, Esqueci minha senha |
| [Recuperar conta](capturas/publico-04-esqueci-senha.jpg) | Recuperação por e-mail (só coordenação) | conta de coordenação | — | Enviar instruções, Voltar ao login |

Observações:
- O exemplo do campo de código é "NOME2026", mas o código real tem o formato `XXXX-XXXX-XXXX` (12 caracteres aleatórios).
- Não existe caminho de entrada para o aluno B2C: todo acesso de aluno começa com "código entregue pela escola".

### Aluno

| Tela | Objetivo | Nomes | Textos longos | Botões |
|---|---|---|---|---|
| [Primeiro acesso: senha](capturas/aluno-01-trocar-senha.jpg) | Trocar a senha temporária | senha temporária, coordenação | Parágrafo de 4 linhas | Definir senha e continuar, Sair |
| [Hoje, primeira vez](capturas/aluno-02-primeira-tela.jpg) ([guia](capturas/aluno-03-guia-passo1.jpg), [celular](capturas/aluno-celular-01-hoje.jpg)) | Dizer o que estudar agora | Missão 2, alvo atual, alvos abatidos, objetivos, Missões, Recruta, XP, Soldado, Radar de desempenho, Precisão, Horas de instrução, Ritmo diário, Próxima Missão, Pré-edital, Cronômetro, Modo completo | Aviso pré-edital (2 linhas, repetido em 22 das 40 capturas); cada objetivo da semana tem 2 a 3 linhas ("Missão: … Leitura: cerca de 56 min. Prática dirigida: 20 questões novas, resolvidas e corrigidas.") | Formulário de boas-vindas, Agora não / Começar o guia, Iniciar estudo, Modo completo, Continuar missão, Praticar esta missão (×6), Resolver questões aqui (×6), Praticar agora / Concluir / Adiar (×3 visíveis), Ver todos os 13 objetivos |
| [Hoje, missão com botão](capturas/aluno-05-hoje-missao-com-botao.jpg) | Iniciar as questões do assunto | Missões, dir_adm, dir_const… (códigos crus de matéria como título de grupo) | "começa na sua próxima prática desta missão com acertos · alvo: 20 questões · +60 XP" | Praticar esta missão, Resolver questões aqui |
| [Questão](capturas/aluno-06-questao.jpg) | Responder | Questões · <assunto>, Corrigidas no servidor | "Não registre estas mesmas questões de novo à mão." | Certo/Errado (ou A–E), Confirmar resposta, Fechar |
| [Correção](capturas/aluno-07-correcao.jpg) | Ver se acertou | Certa. / Errada. Gabarito: X. | — | Próxima questão, Fechar |
| [Resultado do lote](capturas/aluno-08-resultado-lote.jpg) | Fechar a sessão | "2 de 5 certas" | "Estas questões já entraram no seu histórico. Registrar de novo à mão contaria duas vezes." | Mais questões, Fechar |
| [Hoje depois do lote](capturas/aluno-09-hoje-depois-do-lote.jpg) | Ver o avanço | Atual, 5/20 questões, 40% de acerto | Igual ao Hoje | Igual ao Hoje |
| [Trilha](capturas/aluno-10-trilha.jpg) | Ver o curso inteiro | Trilha do concurso, Plano de CFO PMERJ (por prova), Ciclo pré-edital de 12 semanas, Missões do seu concurso, Metas de estudo do edital alvo, prioridade alta | 3 blocos acima de 160 caracteres; "Cartões apenas informativos" | Nenhuma ação |
| [Registrar](capturas/aluno-11-registrar.jpg) | Lançar estudo feito fora do app | Registro rápido, Matéria, Tópico, Questões, Acertos, Tempo, Registros recentes | — | Iniciar estudo, Observação e data, Confirmar estudo, Apagar registro |
| [Desempenho](capturas/aluno-12-desempenho.jpg) | Ver evolução | Leitura rápida, Estimativa inicial de nível por matéria, Eficiência por setor, Trajetória de precisão, Desempenho por meta, Evolução por semana | "Base insuficiente para estimar… O sistema não chuta." | Resumo, Por matéria, Tempo, Questões, 14 dias, 30 dias, Tudo |
| [Simulados](capturas/aluno-13-simulados.jpg) | Lançar e ver simulados | — | — | (estava carregando) |
| [Conquistas](capturas/aluno-14-conquistas.jpg) | Gamificação | Recruta, Soldado, Praças, oficiais, chevrons, patentes, XP, Ofensiva, Constância, Volume, Precisão, Missões ("Conclua seu primeiro objetivo de missão"), Batismo de Fogo | Explicação de patentes | Ver carreira completa (13 patentes), Ver mais (×4) |
| [Histórico](capturas/aluno-15-historico.jpg) | Ver as semanas passadas | Histórico da jornada, Semana 2 AGORA, feitas, pend. | — | Uma linha por semana (abre o detalhe) |
| [Plano](capturas/aluno-16-plano.jpg) | Ver as 12 semanas | Sua jornada, semana 2 de 12, objetivos, Simulado completo | Objetivos expandidos | ver N objetivos (×12) |

### Responsável

| Tela | Objetivo | Nomes | Textos longos | Botões |
|---|---|---|---|---|
| [Painel](capturas/responsavel-01-painel.jpg) ([celular](capturas/responsavel-02-celular.jpg)) | Acompanhar o filho sem jargão | Vale acompanhar, Meta da semana, atividades concluídas, Acerto no ciclo, Dias ativos, Atividades da semana, Pontos de atenção | Lista de 13 atividades com o texto pedagógico completo de cada uma (2 a 3 linhas) | Sair |

É a tela mais clara do sistema. Ela tem um resumo em uma frase e 5 números. Mesmo assim, chama de "atividades" o que o aluno vê como "objetivos", e usa "ciclo" sem explicar.

### Coordenação

| Tela | Objetivo | Nomes | Textos longos | Botões |
|---|---|---|---|---|
| [Painel](capturas/coord-01b-painel-sem-guia.jpg) ([com guia](capturas/coord-01-painel.jpg)) | Ver quem precisa de atenção | Alertas de risco, Sem atividade, Sem credencial, Pendências da semana, "Missão desta semana ainda em aberto", Destaques da semana | — | Ver lista filtrada, Liberar credenciais, Ver alunos com pendências, Ver completo |
| [Alunos](capturas/coord-02-alunos.jpg) | Cadastrar e gerir | credencial, consentimento, aguardando troca de senha, meta 0/13, concurso, trilha de estudo | — | Cadastrar alunos, Ver desempenho, Mais ações (8 itens), Gerar credencial, 2 seletores por aluno (concurso e trilha) |
| [Cadastrar aluno](capturas/coord-08-cadastrar-aluno.jpg) | Novo aluno | Individual / Em lote, Turma, Concurso, Pré-edital, consentimento (termo v1) | Aviso pré-edital | + Cadastrar aluno |
| [Credencial gerada](capturas/coord-09-credencial-gerada.jpg) | Entregar o acesso | Código (identificação), Senha temporária | "Anote e entregue agora…" | Copiar, Entreguei, fechar |
| [Mais ações](capturas/coord-10-mais-acoes.jpg) | Ações raras | Renomear, Adicionar responsável, Gerenciar responsáveis, Registrar consentimento, Resetar senha, Revogar credencial, Exportar/Excluir dados (LGPD) | — | 8 itens |
| [Ficha do aluno](capturas/coord-13-ficha-aluno.jpg) | Ver um aluno a fundo | Ações rápidas, Atividades da semana, Trilha do concurso, "Missões do **seu** concurso" (a coordenação lê "seu"), Histórico de progresso, Onboarding pedagógico | 4 blocos acima de 160 caracteres; cerca de 1.700 palavras numa tela | Voltar ao painel, Ver vínculos, Editar |
| [Ranking](capturas/coord-03-ranking.jpg) | Comparar alunos | Estudos, Simulados, % acerto, meta da semana | — | 11 filtros e 3 exportações |
| [Turmas](capturas/coord-04-turmas.jpg) | Agrupar alunos | turma | — | + Criar turma |
| [Ciclo](capturas/coord-05-ciclo.jpg) | Abrir a próxima edição quando a trilha acaba | Próximo ciclo, plano, trilha, edição | — | — (vazio na maior parte do tempo) |
| [LGPD](capturas/coord-06-lgpd.jpg) | Consentimentos e trilha de acesso | controladora, consentimento, trilha de acesso | 3 parágrafos | — |
| [Marca](capturas/coord-07-marca.jpg) | Logo e cor | Missão da semana (na prévia) | Instrução sobre link de imagem | Salvar marca |

### Super_admin (Backoffice)

| Tela | Objetivo | Nomes | Textos longos | Botões |
|---|---|---|---|---|
| Visão geral (não versionada) | Saúde da operação | Reais (B2B), Teste/piloto, Demonstração, Individual/B2C, Com risco | — | — |
| [Escolas](capturas/admin-03-escolas-filtrada.jpg) | Lista e busca | slug, plano, categoria, status | — | + Nova escola, filtros |
| [Detalhe da escola](capturas/admin-04-escola-detalhe.jpg) | Operar uma escola | Avisos de risco, Checklist de go-live, Modalidades (roadmap com itens "Placeholder — não implementado"), Coordenação | "Roadmap de modalidades. Só 'concurso' está em produção…" | Editar, Suspender, Cancelar, Criar coordenador, Reenviar acesso |
| [Nova escola](capturas/admin-05-nova-escola.jpg) | Criar escola | Bloco A/B/C, slug, status inicial, **plano** (comercial), limite de alunos | — | Deixar para depois / Criar coordenador agora, Criar escola |
| Logs (não versionada) | Auditoria | ação técnica em kebab-case (`reenviar-acesso-coordenador`) | — | — |

## 2. Glossário

Contagem feita no texto das 40 telas capturadas.

| Conceito (o que é) | Nomes usados hoje e onde | Conflito | Nome único proposto |
|---|---|---|---|
| O curso inteiro de um concurso (12 semanas no PMERJ) | "Trilha" (aba do aluno, coordenação "trilha de estudo"); "Plano" (aba do aluno com as semanas; "Plano de CFO PMERJ (por prova)"); "Ciclo pré-edital de 12 semanas"; "Sua jornada"; "edição" (aba Ciclo) | São 5 nomes para a mesma coisa. "Plano" também é o plano comercial no backoffice. | **Trilha**. Combina com a marca Triliva. "Plano" fica só para o comercial ("plano contratado"). Saem "ciclo", "jornada" e "edição". |
| Cada uma das 12 semanas | "Semana 2" (Plano, Histórico); **"MISSÃO 2"** e "Próxima Missão: Missão 3" (Hoje); "Missão desta semana" (painel da coordenação, Marca) | Semana chamada de missão | **Semana** ("Semana 2 de 12") |
| A lista de tarefas da semana (13 itens) | "Objetivos da semana" (Hoje, Plano); "alvos abatidos 0/13" (Hoje); "Meta da semana 0/13 atividades" (responsável, ficha); "meta 0/13" (lista de alunos, ranking); "Metas de estudo do edital alvo" (Trilha) | 4 nomes para a lista e 2 para o item | **Tarefas da semana**; cada item é uma **tarefa**. "Meta" e "alvo" deixam de nomear a lista. |
| Tipo de tarefa de estudo novo | Item que começa com "Missão:" | Terceiro sentido de "missão" | **Estudo:** (ex.: "Estudo: Poderes e elementos do ato administrativo") |
| Unidade de assunto de uma matéria, em sequência (M01-ADM…), com alvo de questões, onde ficam as questões integradas | "Missões (0 de 18)" (Hoje); "Missões do seu concurso" (Trilha, ficha); "objetivo de missão" (Conquistas) | Concorre com semana e tarefa | **Missão**. É o único lugar onde "missão" sobra; combina com "Entrar na missão" e com a gamificação. |
| Quantidade de questões pedida por missão | "alvo: 20 questões", "alvo atual" | "Alvo" também é "concurso alvo" e "edital alvo" | **"20 questões"** (sem rótulo) e "**missão atual**" |
| Lançar à mão o que estudou | "Registrar" (aba), "Registro rápido", "Confirmar estudo", "Praticar esta missão" (abre o registro), "Praticar agora", "Iniciar estudo" (cronômetro) | 4 verbos para a mesma ação | **Registrar estudo** |
| Resolver questões no app | "Resolver questões aqui", "Prática dirigida: 20 questões novas, resolvidas e corrigidas" | Na tarefa da semana, a prática dirigida não leva às questões do app | **Resolver questões** |
| Prática de erros e de missões já concluídas | "Revisão: 7 questões de erros anteriores…" (tarefa); tipo revisão na missão concluída | Coerente | **Revisão** (manter) |
| Percentual de acerto | "Precisão" (Radar, Conquistas), "acerto no ciclo", "% de acerto", "Trajetória de precisão" | "Ciclo" sem definição; 2 palavras | **Acerto** ("acerto na trilha", "acerto na semana") |
| Visão de evolução | "Desempenho" (aba, ficha), "Radar de desempenho", "Leitura rápida", "Eficiência por setor", "Estimativa inicial de nível por matéria" | "Nível" também é nível de patente; "setor" não aparece em nenhum outro lugar | **Progresso** (aba) e "**domínio por matéria**" no lugar de "nível" |
| Tempo estudado | "Horas de instrução", "tempo registrado", "Tempo estudado", "Tempo" | 3 nomes | **Tempo de estudo** |
| Fim da trilha e abertura da próxima | Aba "Ciclo" → "Próximo ciclo", "próxima edição" | "Ciclo" também aparece em "acerto no ciclo" | **Renovar turma**, dentro de Turmas (deixa de ser aba) |
| Prova completa de treino | "Simulados" (aba), "Simulado" como opção de **matéria** no Registrar, "Simulado completo: 80 questões" (semana 4) | Simulado aparece como matéria | **Simulado** (manter); sai da lista de matérias |
| Gamificação | XP, patente, Recruta/Soldado/Praças/oficiais/chevrons, conquistas, ofensiva, "nível 1 de 13" | "Nível" dividido com o domínio por matéria; vocabulário militar puro para B2C civil | **XP**, **patente** e **conquista**; "ofensiva" vira "**dias seguidos**" |
| Acesso de aluno e responsável | "credencial", "Gerar credencial", "Código (identificação)", "código de acesso", "senha temporária" | Coordenação diz credencial, aluno diz código | **Acesso** ("Gerar acesso" = código + senha temporária) |
| Concurso escolhido | concurso, "concurso alvo", "edital alvo", "prova" | "Prova" só deveria ser a data | **Concurso** (e "data da prova") |
| Matéria | "Matéria" (Registrar, Desempenho), "disciplina" ("7 disciplinas"), "DIR_ADM" e "dir_adm" (código cru, Hoje) | 3 formas | **Matéria**, sempre pelo nome |
| Primeira configuração do aluno | "Bem-vindo, Aluno!" (formulário), "Onboarding pedagógico" (ficha), "Guia do sistema", "Primeira vez aqui?" | Inglês na ficha; 2 recursos de boas-vindas simultâneos | **Boas-vindas** (formulário) e **Guia** (tour) |
| Situação do conteúdo do concurso | "Pré-edital", "Calendário de estudo pronto, montado sobre o programa do edital anterior (fonte histórica)…" | Repetido em 22 das 40 capturas (todas as do aluno depois da senha, as do responsável e o cadastro da coordenação) | **Pré-edital**, explicado uma vez |

## 3. Navegação nova do aluno (proposta)

Hoje há 8 abas: Hoje, Trilha, Registrar, Desempenho, Simulados, Conquistas, Histórico e Plano. No celular, 4 delas ficam escondidas em "Mais". Trilha, Plano e Histórico mostram a mesma trilha em três recortes. Desempenho e Conquistas medem a mesma coisa de dois jeitos.

**Proposta: 3 abas e uma ação fixa.**

| Aba | O que tem | Funde |
|---|---|---|
| **Hoje** | Um cartão "**Sua próxima tarefa**" com **um** botão (veja abaixo); a semana atual em uma linha ("Semana 2 de 12 · 3 de 13 tarefas"); a lista de tarefas, recolhida em 1 linha cada; o aviso de pré-edital só até ser fechado | Hoje atual sem o painel de 18 missões e sem o radar |
| **Trilha** | As 12 semanas (passadas com o que foi feito, a atual e as próximas, com os simulados marcados) e as **missões** por matéria com a barra de questões | Trilha, Plano, Histórico e a lista de missões que hoje fica no Hoje |
| **Progresso** | Acerto e tempo, domínio por matéria, simulados lançados, **questões resolvidas** (com o gabarito e um filtro "só erradas"), XP, patente e conquistas numa seção no fim | Desempenho, Simulados, Conquistas e a correção das questões |
| Ação fixa **"+ Registrar estudo"** | Botão sempre visível (canto no desktop, centro da barra no celular), com o cronômetro dentro | Aba Registrar e cronômetro solto no topo |

**Onde o aluno resolve questões.** No Hoje, o cartão "Sua próxima tarefa" mostra "Resolver 5 questões de Organização administrativa" quando a missão tem questões ligadas. Quando não tem, mostra "Registrar estudo". O botão abre uma **tela própria de sessão**, sem a página do Hoje atrás:
- enunciado;
- origem (banca e ano, hoje vazios: ver seção 5);
- alternativas;
- "Confirmar".

Pela Trilha, cada missão também tem "Resolver questões".

**Onde vê a correção.** A correção aparece logo depois de cada resposta ("Certa" ou "Errada, gabarito C"). No fim do lote, uma tela de resultado mostra o efeito visível: "5 questões: 2 certas. A missão foi de 0/20 para 5/20. A tarefa 'Estudo: Organização administrativa' foi de 0/20 para 5/20." Ela tem dois botões: "Mais 5 questões" e "Voltar ao Hoje". Depois, a correção fica em **Progresso → Questões resolvidas**, onde dá para refazer as erradas (isso é a revisão).

**Onde vê o progresso.** São três lugares, com o mesmo número em todos:
- no Hoje, a linha da semana;
- na Trilha, a barra de cada missão;
- no Progresso, os números e gráficos.

**Pré-requisito técnico.** A questão resolvida no app precisa contar também para a tarefa da semana e para o XP. Hoje ela conta só para a missão (seção 5, item 2). Sem isso, a navegação nova mostra números que não batem.

**O que remover.**
- A aba Plano, que entra na Trilha.
- A aba Histórico, que entra na Trilha.
- A aba Conquistas, que entra no Progresso.
- A aba Simulados, que entra no Progresso, com a semana do simulado marcada na Trilha.
- A aba Registrar, que vira ação fixa.
- O seletor "Preferência desta tela: Modo completo", que ninguém entende sem o guia.
- O "Radar de desempenho" no Hoje.

## 4. As 10 mudanças de maior efeito para quem vê o sistema pela primeira vez

Ordem: o que trava ou confunde no primeiro minuto vem antes do que melhora o uso diário. Esforço: **P** (até 1 dia), **M** (alguns dias), **G** (uma semana ou mais, ou mexe no motor).

| # | Mudança | Por que primeiro | Esforço | Risco |
|---|---|---|---|---|
| 1 | **Primeiro acesso sem trava.** A regra de senha mostrada passa a ser a mesma que o servidor de autenticação exige (minúscula, maiúscula e número no demo; conferir a produção), com a mensagem certa quando recusar. O retorno de sessão depois da troca já está corrigido no #184. | Hoje um aluno pode ficar preso na primeira tela, sem saber por quê | P | Baixo. É preciso confirmar a política de senha configurada na produção antes de mudar o texto. |
| 2 | **Uma ação principal no Hoje.** Cartão "Sua próxima tarefa" com um botão; boas-vindas como passo único antes do Hoje; guia só depois, nunca por cima do cartão. Tirar o radar e as 18 missões do Hoje. | De 32 botões para 1 decisão | M | Médio: o E2E e os passos do guia apontam para os elementos atuais |
| 3 | **Um nome por conceito** (seção 2). Os três primeiros: "Semana 2 de 12" no lugar de "Missão 2"; "tarefas" no lugar de objetivos, alvos, atividades e metas; "Estudo:" no lugar de "Missão:" nos itens. | É a principal fonte da sensação de "nomes confusos" | M (texto em cerca de 30 arquivos) | Baixo para o usuário; médio para a suíte, que confere textos |
| 4 | **A questão resolvida conta para a tarefa da semana e para o XP**, não só para a missão | Sem isso, o aluno resolve e o Hoje diz 0/13 e 0 XP | G | Alto: regra de contagem do motor (caminho da 0064), idempotência e risco de contar em dobro com o registro manual |
| 5 | **Tela própria da sessão de questões**, com origem da questão e resultado mostrando o que mudou | Hoje o bloco das questões abre no meio de uma página longa, entre o radar e a lista de missões | M | Baixo |
| 6 | **Aluno com 3 abas e "+ Registrar estudo" fixo** (seção 3) | Acaba o "Mais" no celular e as três visões da mesma trilha | G | Médio: navegação, guia, E2E móvel |
| 7 | **Entrada no meio da trilha explicada.** Quem entra na semana 2 vê "Você começou na semana 2. A semana 1 ficou como revisão opcional." Alternativa maior: calendário a partir da data de entrada do aluno. | Hoje o aluno novo vê "Semana 1 encerrada" e "Missão 2" no primeiro dia | M (texto) ou G (calendário por aluno) | Baixo (texto); alto (calendário, porque mexe em metas e em virada de semana) |
| 8 | **Menos ruído fixo.** Aviso de pré-edital uma vez, com "entendi" (hoje em 22 das 40 capturas). Matéria pelo nome, nunca "DIR_ADM". "Simulado" fora da lista de matérias. Exemplo do Registrar coerente com o concurso (hoje "MDC e MMC" num concurso de Direito). Exemplo de código coerente com o formato real. | Limpeza barata e visível em todas as telas | P | Baixo |
| 9 | **Primeiros passos da coordenação.** No painel vazio, um checklist "1. Cadastre um aluno → 2. Gere o acesso → 3. Entregue código e senha". Corrigir o menu "Mais" cortado com poucos alunos. Ficha em terceira pessoa ("Missões do concurso", não "do seu concurso"). Nome completo nos alertas (hoje "Aluno, Aluno, Aluno"). | É a primeira tela de quem compra (a escola) | M | Baixo |
| 10 | **Textos curtos.** Cada tarefa com 1 linha ("Estudo · Poderes do ato administrativo · 56 min + 20 questões") e o texto pedagógico em "ver detalhes". Ficha da coordenação dividida em abas internas (hoje cerca de 1.700 palavras numa tela). O responsável vê só o título das atividades. | "Textos longos" é a outra metade da queixa | M | Baixo. É preciso preservar o texto pedagógico, que é conteúdo editorial. |

**Fora do top 10, mas decide venda B2C.** A tela de entrada só aceita "código entregue pela escola" ou "e-mail de coordenação". Um aluno que compre sozinho não tem por onde entrar nem por onde se cadastrar. O backoffice já tem a categoria "Individual/B2C" (0 escolas). Isso é decisão de produto antes de ser tela.

## 5. Defeitos achados no caminho (não são só de usabilidade)

| # | Defeito | Onde | Situação |
|---|---|---|---|
| 1 | Depois de trocar a senha temporária, toda Edge Function respondia 401: a troca apaga as sessões da conta e o app continuava com o token antigo | Primeiro acesso de qualquer aluno e responsável (vale também para a produção) | **Corrigido no #184** (o app entra de novo com a senha nova), com teste |
| 2 | Questões resolvidas no app contam para a missão, mas não para a tarefa da semana nem para o XP | Hoje, Histórico, responsável, ficha | Aberto (mudança 4) |
| 3 | A senha que a tela marca como "Forte" pode ser recusada pelo servidor de autenticação (falta número ou maiúscula), com mensagem genérica | Primeiro acesso | Aberto (mudança 1) |
| 4 | A senha temporária gerada pela escola saía sem número em cerca de 8% das vezes; o servidor recusava e a coordenação via "Não foi possível concluir a ação" | Gerar credencial | **Corrigido no #183** (falta publicar a função `provisionar-aluno` no demo e na produção) |
| 5 | Menu "Mais" abre para cima e fica cortado pelo cartão quando a lista tem poucos alunos; "Adicionar responsável" fica inalcançável | Coordenação → Alunos | Aberto (mudança 9) |
| 6 | O convite do guia, que não bloqueia a tela, fica por cima do cartão principal no celular e da caixa de nome do responsável; reaparece em cada aparelho novo | Aluno e coordenação | Aberto (mudança 2) |
| 7 | Banca e ano das questões guardadas ficam vazios (a normalização não reconhece onde a Quest manda esses campos), e a tela não mostra a origem | Questões integradas | Aberto (mudança 5) |
| 8 | Aluno criado hoje entra na semana 2 com a semana 1 "encerrada" | Aluno novo | Aberto (mudança 7) |

## Capturas

Em [`capturas/`](capturas/), com prefixo por papel: `publico-`, `aluno-`, `aluno-celular-`, `responsavel-`, `coord-`, `admin-`. Os dados vêm só da escola de teste, que é apagada depois. Código e senha da tela de credencial aparecem cobertos.
