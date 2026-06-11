# Documento 4 — Arquitetura do Sistema

Desenho de arquitetura do sistema multi-tenant de acompanhamento de estudos, white-label, para escolas/cursinhos preparatórios. Escrito como decisão de engenharia, não como código. Lê os Documentos 1, 2 e 3 antes. Onde este documento e os anteriores divergem, este é mais novo e prevalece, com a divergência sinalizada no texto.

Referência de produto: o sistema “guruja / Rumo ao fisco” do capitão (prints recebidos). Serve de inspiração para o motor de gamificação, não de checklist de cópia. A maior parte daquilo é Fase 2 ou Fase 3 para a gente.

-----

## 0. Decisão de topo (a que orienta todas as outras)

**Desenhar para multi-tenant. Construir primeiro single-tenant-ready.**

O banco, os papéis e o isolamento nascem corretos desde o primeiro dia (todo dado já carrega a qual escola pertence, e o isolamento é regra de banco, não de tela). Mas a operação inicial roda com UMA escola semeada (a do demo). Não se constrói painel de gestão de várias escolas, nem onboarding self-service de escola, nem faturamento por tenant, antes de a primeira escola pagar.

Por quê: o que dá trabalho em multi-tenant não é suportar N escolas, é nascer com o isolamento certo. Se a fundação nasce certa, ligar a segunda escola é configuração, não reescrita. Se nasce errada (dado sem dono, isolamento só no front), aí sim quebra e exige reconstruir tudo. Então a gente paga o custo da fundação agora (que é inevitável) e adia o custo da operação (que só se justifica com receita).

Consequência prática para o “demo em uma semana”: o demo é uma escola single-tenant rodando sobre fundação multi-tenant. É honesto chamar de demo, não de produto pronto.

-----

## 1. Modelo de tenancy (isolamento entre escolas)

**Decisão: schema compartilhado, com `tenant_id` em toda tabela, e isolamento forçado por Row-Level Security (RLS) no Postgres.**

Cada linha de cada tabela sabe a que escola pertence. O banco recusa, por política, qualquer leitura ou escrita fora da escola do usuário logado. O isolamento vive na camada de dados, abaixo da aplicação. Mesmo que o front tenha um bug, o banco não entrega dado de outra escola.

### Alternativas consideradas e por que foram rejeitadas

- **Banco por escola (database-per-tenant):** isolamento máximo, mas operação e migração viram pesadelo com 5 a 6 escolas (rodar toda mudança de estrutura em N bancos, backup de N bancos). Custo desproporcional ao risco no nosso porte. Rejeitado.
- **Schema por escola:** complica migração (cada nova coluna replicada por schema) e não dá ganho real de segurança sobre RLS bem-feito neste porte. Rejeitado.
- **Isolar só no front (esconder o que não é da escola):** é o que a versão atual faz com o modo “Acompanhamento”. É a opção que vaza. Qualquer um que abra o painel do navegador vê tudo. Inaceitável para dado de menor. Rejeitado explicitamente.

### Encaixe com a stack atual

Postgres com RLS é nativo do Supabase, que você já usa. A decisão alinha com o que já está no seu ferramental, não exige stack nova.

### Modo de falha número 1 (o erro que mata multi-tenant)

RLS é furado por dentro quando a aplicação fala com o banco usando a chave de serviço (service role), que ignora todas as políticas. Regra dura: a chave de serviço NUNCA vai ao navegador, nunca ao front. Front fala com o banco só com a identidade do usuário logado, sujeita à RLS. Operações que precisam de poder elevado (gerar meta da semana, rodar rotina noturna) rodam no servidor, isoladas. Se essa regra furar uma vez, o isolamento inteiro deixa de existir e você nem percebe até vazar.

-----

## 2. Identidade e acesso (login e papéis)

A versão atual usa PIN por perfil. É provisório e inseguro. Sai.

### Papéis (definidos no backend, refletidos no front, nunca só no front)

- **Escola / coordenação (controladora):** vê e gerencia todos os alunos e turmas da própria escola. Não vê outras escolas.
- **Aluno:** registra e vê só o próprio progresso.
- **Responsável:** leitura do aluno vinculado a ele. Só leitura.
- **Professor:** Fase 2. Leitura de uma turma vinculada.
- **Você (operador / superadmin):** acesso de manutenção, fora do fluxo das escolas, com trilha de auditoria do que toca. Esse papel é sensível e fica separado dos papéis de tenant.

O papel e a escola do usuário viajam dentro do token de login e são lidos pelas políticas de isolamento do banco. Papel não é estado de tela, é claim de identidade verificada.

### O ponto espinhoso: aluno é menor de idade

Pedir que um aluno de 13 anos administre e-mail e senha é fricção e risco. **Decisão recomendada: a escola provisiona o acesso do aluno.** A escola cadastra a turma e o sistema gera credenciais (código de acesso ou link), que a escola distribui. O aluno não cria conta sozinho. O responsável recebe um acesso de leitura vinculado ao aluno. Isso também põe a coleta de dado do menor sob a escola (controladora), que é onde a LGPD quer que ela esteja.

Decisão que preciso de você (seção 13): aluno loga por código emitido pela escola, ou por e-mail/senha? Recomendo código emitido pela escola para o MVP.

-----

## 3. Mapa de módulos (contextos do sistema)

O sistema atual é quase tudo um arquivo só (`App.jsx`). Isso não escala e não é o que um produto multi-tenant aguenta. A arquitetura se organiza nestes módulos com fronteiras claras. Cada um é dono do seu pedaço e conversa com os outros por contrato, não por dependência embolada.

1. **Identidade e Acesso** — login, papéis, tenancy, políticas de isolamento.
1. **Escola e Marca (white-label)** — cadastro da escola, identidade visual por escola.
1. **Pessoas e Organização** — escola, turma, aluno, responsável, professor (Fase 2). Vínculos entre eles.
1. **Metodologia e Conteúdo** — trilhas, planos de estudo, disciplinas, mapa de capítulos, atividades-modelo. É o conteúdo que VOCÊ autora. É o moat (ver seção 5).
1. **Motor de Estudo e Gamificação** — metas, registro de estudo, reforços, agendamento de virada de semana, calibração. É o coração do produto (ver seção 6).
1. **Análise e Desempenho** — cálculo e exibição de desempenho por meta, por disciplina, acumulado.
1. **Consentimento e Conformidade (LGPD)** — registro de consentimento, trilha de acesso, pedidos do titular (exclusão, portabilidade).
1. **Notificações** — liberação de meta, lembretes. Mínimo no MVP.

A regra que segura a fundação: os módulos 4 (conteúdo) e 5 (motor) são separados de propósito. O conteúdo é seu, compartilhado; o progresso é da escola, isolado. Misturar os dois é o erro que trava a escala depois.

-----

## 4. Domínio (entidades e relações, em conceito, sem código)

Descrição conceitual, não estrutura de banco. Lista do que existe e como se liga.

- **Escola (Tenant):** a unidade de isolamento. Toda outra entidade pertence a uma escola, exceto Conteúdo (ver abaixo).
- **Usuário:** pertence a uma escola, tem um papel. Aluno, responsável, coordenação são tipos de usuário.
- **Turma:** agrupa alunos dentro de uma escola.
- **Aluno:** pertence a uma escola e a uma ou mais turmas. Vinculado a uma trilha.
- **Responsável:** vinculado a um ou mais alunos. Acesso de leitura.
- **Trilha / Plano (Conteúdo):** a metodologia do nicho (ex.: plano de 9 semanas do Colégio Naval). Não pertence a uma escola: é seu, e é assinado pelas escolas. Versionado.
- **Disciplina:** dentro de uma trilha.
- **Atividade-modelo:** unidade de estudo (tipo: teoria, revisão, exercício; relevância; tempo estimado; código; ligada a disciplina e capítulo). Vive no Conteúdo, é o gabarito do que o aluno faz.
- **Meta (ciclo / sprint):** janela de estudo do aluno (semanal), com um conjunto de atividades, data de início e data de liberação da próxima. Pertence ao aluno/escola.
- **Registro de estudo:** o que o aluno fez (questões, acertos, tempo, data). Pertence ao aluno/escola.
- **Reforço:** item de revisão espaçada gerado a partir de estudo passado. Fase 2.
- **Consentimento:** registro de que o responsável autorizou o tratamento do dado daquele aluno. Pertence à escola.
- **Trilha de acesso (log):** quem acessou o dado de qual aluno e quando.

Distinção que sustenta tudo: **Conteúdo (trilha, atividade-modelo) é compartilhado e seu. Progresso (meta, registro, reforço) é isolado por escola/aluno.** A escola consome a sua metodologia, ela não a edita.

-----

## 5. Conteúdo vs progresso (onde está o valor real)

Os documentos 1 e 2 dizem que a metodologia é o ativo mais valioso, mais que o código. A arquitetura tem que tratar isso como verdade estrutural, não como elogio.

A trilha (plano de 9 semanas, mapa de capítulos Fechar/Pincelar/Pular, peso real das provas) é **autorada por você uma vez, e assinada por todas as escolas do mesmo nicho.** A escola não cria conteúdo. Ela liga os alunos dela à sua trilha. Quando você melhora a metodologia, todas as escolas melhoram juntas, e isso é a razão de elas continuarem pagando mensalidade.

Implicação arquitetural:

- Trilha é versionada. Aluno fica preso a uma versão da trilha durante o ciclo dele, pra não mudar o plano embaixo do pé de quem está estudando.
- Trilha é separada do dado do aluno. Você edita conteúdo sem tocar em progresso de ninguém.
- White-label é da casca (marca da escola), não do miolo (sua metodologia). A escola põe o nome dela por fora; o método por dentro é seu. Isso é o que evita que uma escola pegue seu conteúdo e te dispense.

-----

## 6. Motor de estudo e gamificação (o coração)

É o que faz o estudo virar jogo, e é o que te encantou no sistema do capitão. Também é a parte mais fácil de superdimensionar. Vou separar o que é miolo (sem ele não há produto) do que é profundidade (Fase 2 e 3).

### Miolo (já existe em forma single-user no Rumo ao Naval, precisa virar multi-tenant)

- **Meta como ciclo semanal:** a meta tem início, um conjunto de atividades vindas da trilha, e uma data de liberação da próxima. A virada por data local (que você já tem) é a regra de relógio do motor. Preservar.
- **Registro de estudo:** aluno marca atividade feita, lança questões/acertos/tempo. Gera o desempenho.
- **Nota projetada do Dia 1 = (mat + ing) × 2,5.** Preservar exatamente.
- **Estados de atividade:** concluída, pendente, ignorada (o guruja usa isso, e é barato e útil). Entra no miolo.

### Profundidade (Fase 2 / 3, não construir agora)

- **Reforços (revisão espaçada):** gerar itens de revisão a partir do que o aluno errou ou estudou antes. É valioso e é o que dá cara de jogo, mas é um subsistema próprio (curva de espaçamento, geração, fila). Fase 2.
- **Calibração antes de gerar a próxima meta:** ajustar a próxima meta com base no desempenho. O guruja faz (“a calibragem só pode ser feita antes da geração”). Fase 2.
- **Comparativo, Jornada, Coordenadas, ranking:** camada de engajamento social/competição. Fase 3. Não chega perto do que faz uma escola dizer sim.

### Fronteira de design do motor

O motor é um serviço com fronteira clara, não lógica espalhada pela tela. Razão: ele vai evoluir muito (reforço, calibração, nivelamento). Se nascer acoplado ao front, cada evolução quebra a interface. A regra de virada de semana e a geração de meta rodam no servidor, em rotina agendada, não no navegador do aluno (senão dependem de o aluno abrir o app pra virar a semana, e furam).

-----

## 7. White-label (marca da escola)

Tensão real entre os documentos, preciso resolver com você: o Doc 2/3 manda **preservar** a identidade navy #0A1622 / dourado #CDA349 / Fraunces / Archivo. Ao mesmo tempo, white-label quer dizer que **o sistema leva a identidade da escola.** Os dois não cabem inteiros.

Resolução recomendada: **sistema de design fixo (layout, componentes, tipografia herdada do atual), com uma camada leve de marca por escola (logo, nome, e no máximo uma cor de acento dentro de limites).** A escola se vê como dona, sem você ter que manter um tema visual diferente por cliente (o que viraria caos com 5 a 6 escolas). Isso preserva o seu design e ainda entrega o “white-label” que vende.

Se você quiser white-label visual total (cada escola com paleta própria), é possível, mas é mais trabalho e mais manutenção, e aí o “preservar navy/dourado” cai. Decida na seção 13.

-----

## 8. LGPD por design (dado de menor, não é opcional)

Dado de menor eleva o nível de cuidado, e isso é argumento de venda, não só obrigação: uma escola séria vai perguntar como você protege o dado dos alunos dela. Ter resposta é diferencial.

- **Papéis:** escola é **controladora** (decide e coleta), você é **operador** (processa a serviço dela). Você não fica isento: responde por segurança e por não usar o dado pra outro fim.
- **Consentimento:** registrado por aluno, gerido pela escola, desde o piloto. Custa zero, é termo no cadastro. Tem que existir como entidade no sistema, não como papel solto.
- **Minimização:** coletar só o necessário (nome, escola, turma, dado de estudo). Não pedir CPF nem documento do menor sem necessidade real.
- **Criptografia:** em trânsito (TLS) e em repouso (provido pelo Postgres/Supabase). Região de dados no Brasil (Supabase tem São Paulo), o que ajuda na LGPD.
- **Trilha de acesso:** registrar quem acessou o dado de qual aluno. Importante sobretudo no acesso de responsável e, na Fase 2, de professor.
- **Contrato com cláusula de operador (DPA):** vale desde o piloto. Sem isso, você está tratando dado de menor sem cobertura.
- **Pedidos do titular:** o sistema tem que conseguir exportar e apagar o dado de um aluno quando a escola pedir. Projetar isso agora é barato; remendar depois é caro.
- **Plano de resposta a incidente:** processo escrito, não funcionalidade. Existe no papel desde o piloto.

Nota de sequência: consentimento, isolamento e trilha de acesso entram no MVP (são fundação e custam pouco). Auditoria de segurança paga por especialista é Fase 2/3 (Doc 2 já diz isso, e está certo).

-----

## 9. Análise e desempenho

- O guruja mostra desempenho por meta (linha), por disciplina (treemap de tempo, toggle de questões), e acumulado (acertos, questões, % de acertos, tempo médio). É bonito e é viável reaproveitando o recharts que você já tem.
- **Decisão de cálculo:** desempenho acumulado é caro de recalcular a cada abertura de tela quando há muitos registros. Materializar o resumo (guardar o consolidado e atualizar quando entra registro novo), em vez de recomputar tudo toda vez. No MVP, com volume baixo, dá pra calcular na hora; mas projetar a saída pra materialização, pra não reescrever quando crescer.

-----

## 10. O que reaproveita da base atual e o que reescreve

### Reaproveita

- **O objeto `db` (`db.get` / `db.set`) como ponto único de troca.** Esse foi o melhor acerto da versão atual. A migração de localStorage para backend acontece reescrevendo o que está dentro do `db`, sem espalhar mudança pelo resto. Mantém o seam.
- **Componentes de gráfico (recharts), regras de negócio do nicho, virada de semana por data local, nota projetada (mat+ing)×2,5, conteúdo do plano.** Tudo preservado.

### Reescreve

- **Persistência:** de localStorage para Postgres/Supabase com RLS.
- **Autenticação:** de PIN para login real com papéis.
- **`App.jsx` monolítico:** decomposto nos módulos da seção 3. Não por estética, mas porque um arquivo só não suporta papéis, isolamento e múltiplas telas de gestão.

A migração não joga fora o trabalho feito. Troca o miolo de dados e identidade, preserva conteúdo e regras.

-----

## 11. Sequência de construção (o plano realista, não o de uma semana)

O que entra no **build inicial** (a fatia que já nasce multi-tenant-ready, rodando como demo de uma escola):

1. Fundação: banco com dono por linha e isolamento por RLS, desde o início, com uma escola semeada.
1. Identidade: login real, papéis de escola/aluno/responsável, fim do PIN.
1. Pessoas e Organização: cadastro de turma e de alunos fácil para a escola.
1. Conteúdo: importar a trilha do Colégio Naval que já existe, como trilha-modelo.
1. Motor (miolo): meta semanal, registro de estudo, estados de atividade, virada por data, nota projetada. Reaproveitando a lógica atual.
1. Desempenho: telas que você já tem, ligadas ao dado real.
1. Responsável: modo leitura do aluno vinculado.
1. LGPD mínimo viável: consentimento como entidade, trilha de acesso, contrato com cláusula de operador.
1. Marca: camada leve de white-label, semeada com uma escola.

O que **fica de fora do build inicial** (Fase 2+, com o cheque da primeira escola):

- Reforços / revisão espaçada.
- Calibração automática da próxima meta.
- Painel de professor.
- Nivelamento (base / intermediário / avançado).
- Reconhecimento de prova e indicação de livro por IA.
- Comparativo / ranking / jornada social.
- Onboarding self-service de escola, faturamento por tenant, painel multi-escola.

Sobre prazo, sem rodeio: o build inicial acima, feito direito, com você dividido entre quatro frentes, é trabalho de semanas, não de uma. A parte visível (telas) é a menor fatia. A fundação (isolamento, login real, LGPD mínimo) é a maior, e é justamente a que não dá pra pular sem o produto virar o que a versão atual já é: um painel single-user que vaza. O “demo em uma semana” só fecha se for um demo single-tenant com a marca de uma escola por cima da base atual, e mesmo isso é apertado.

-----

## 12. Riscos e modos de falha a projetar contra

1. **Furar RLS com chave de serviço no front.** O erro que apaga o isolamento inteiro. Chave de serviço só no servidor.
1. **Esquecer o dono (`tenant_id`) em uma consulta.** Vaza dado entre escolas. Mitigar fazendo o isolamento ser regra de banco (RLS), não disciplina de quem escreve a consulta.
1. **Motor de gamificação acoplado à tela.** Cada evolução (reforço, calibração) quebra a interface. Mitigar com fronteira de serviço clara desde já.
1. **Virada de semana dependendo do navegador do aluno.** Some pra quem não abre o app. Roda no servidor, agendado.
1. **Recalcular desempenho do zero a cada tela.** Lento quando cresce. Projetar pra materializar o resumo.
1. **Credencial de menor mal distribuída.** Aluno administrando senha é fricção e risco. Escola provisiona.
1. **Perder o dado/lógica do Lucas na migração.** A trilha e as regras atuais são o ativo. Migrar preservando, com o `db` como seam.
1. **Superconstruir a Fase 2 antes de uma escola pagar.** O risco que os Docs 2 e 3 já avisam, e que o “quero o sistema todo pronto” reabre. A arquitetura segura isso pondo Fase 2 fora do build inicial de propósito.

-----

## 13. Decisões que preciso de você para fechar a arquitetura

Poucas, mas travam o resto. Recomendação ao lado de cada uma.

1. **Login do aluno:** código emitido pela escola, ou e-mail/senha do próprio aluno? (Recomendo código pela escola, por ser menor.)
1. **White-label:** design fixo com marca leve por escola (logo + nome + acento), ou identidade visual total por escola? (Recomendo o leve. O total mata o “preservar navy/dourado” e multiplica manutenção.)
1. **Escopo do motor no build inicial:** confirma que reforço e calibração ficam pra Fase 2, e o miolo é meta semanal + registro + desempenho? (Recomendo confirmar. É o que faz a escola dizer sim sem te custar meses.)
1. **A escola do demo:** existe uma escola-alvo concreta cujo nome e marca a gente semeia no demo, ou é uma escola fictícia de vitrine? (Muda como a gente monta o white-label inicial.)