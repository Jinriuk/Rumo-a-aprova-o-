# Prompt de Build — Construção do Sistema

Este é o prompt que governa a construção do sistema. Não é mais um documento de planejamento: é a ordem de execução. Cole-o no início do chat/agente de build, junto dos seis documentos.

-----

## 0. Antes de escrever qualquer linha

Leia, na íntegra, os Documentos 1 a 6 do projeto. Eles são a fonte da verdade sobre O QUE construir e PORQUÊ. Este prompt governa COMO construir e em que ordem. Onde este prompt e os documentos divergirem sobre execução, este prompt prevalece; sobre escopo e regras de negócio, os documentos prevalecem. Em caso de dúvida real e bloqueante, pare e pergunte; em todo o resto, decida e siga.

-----

## 1. Objetivo e o que significa "finalizar"

Construir o sistema multi-tenant de acompanhamento de estudos, white-label, descrito nos seis documentos, até o estado de **demo pronto para anunciar**.

"Finalizar" tem definição exata: é a **Definição de Pronto do build inicial (Documento 6, seção 8)**. Nada além disso. Especificamente, **NÃO construa a Fase 2** (reforço/revisão espaçada, calibração automática, comparativo/ranking, painel de professor, nivelamento, reconhecimento de prova, indicação de livro por IA), mesmo que pareça fácil, mesmo que sobre tempo. Construir Fase 2 agora é violar uma decisão travada.

-----

## 2. Modelo de execução

- **Autônomo de ponta a ponta.** Execute toda a sequência da seção 3 sem pedir aprovação humana a cada passo. O dono do projeto pediu execução contínua, não aprovações sequenciais.
- **Com travas de auto-verificação.** Ao fim de cada bloco da sequência, rode a verificação correspondente (seção 7) você mesmo, antes de avançar. Não avance sobre um bloco que não passou na própria verificação.
- **Uma única condição de parada obrigatória:** se você não conseguir PROVAR o isolamento entre escolas (seção 3, bloco 0), pare e reporte. Não construa nada em cima de isolamento não comprovado. Esse é o único caso em que parar é melhor que seguir.
- **Sem narração inútil.** Não descreva cada microação. Trabalhe, verifique, e ao final entregue um relatório do que ficou pronto contra a Definição de Pronto.
- **Não invente o que não é seu.** A metodologia (trilha, plano, mapa de capítulos) é autorada pelo dono e está nos documentos. Importe-a. Não gere conteúdo de estudo, não crie plano novo, não "melhore" o método.

-----

## 3. Sequência de build (executada de forma contínua, nesta ordem)

A ordem não é "parar por partes": é o espinhaço que impede o trabalho de virar mistura. Execute do bloco 0 ao 7 sem interrupção, verificando cada um.

**Bloco 0 — Prova de isolamento (vem antes de tudo).**
Suba o banco com a política de isolamento (RLS) ligada. Semeie DUAS escolas com dados distintos. Prove, com teste automatizado, que um usuário da escola A não lê nem escreve absolutamente nada da escola B, com a identidade real no token. Se isso não passar, PARE (seção 2).

**Bloco 1 — Fundação de dados.**
Modele todas as entidades do Documento 6, seção 2. Toda tabela isolável nasce com o dono (tenant) e com RLS habilitada por padrão (negar por padrão). Conteúdo global (trilha, disciplina, atividade-modelo) é a exceção deliberada, sem dono, leitura por todos, escrita só pelo operador.

**Bloco 2 — Identidade e acesso.**
Login real com papéis (coordenação, aluno, responsável). Fim do PIN. A escola e o papel viajam no token como informação verificada, e as políticas do banco leem isso. Implemente a matriz de acesso do Documento 6, seção 3, COMO POLÍTICA DE BANCO, não só como condição de tela.

**Bloco 3 — Pessoas e provisão.**
Cadastro de turma e de aluno pela coordenação, fácil, em lote ou um a um. Geração de credencial do aluno (aluno é menor, ele não cria conta). Vínculo e acesso de leitura do responsável. Aplicação da marca da escola (white-label leve: logo, nome, cor de acento; design fixo preservado).

**Bloco 4 — Conteúdo.**
Importe a trilha do Colégio Naval dos documentos como a primeira trilha global versionada. Não reescreva os textos do plano.

**Bloco 5 — Motor (só o miolo).**
Meta semanal, registro de estudo (questões, acertos, tempo), estados de atividade (concluída, pendente, ignorada). Virada de semana por data local, rodando NO SERVIDOR e agendada, não dependente de o aluno abrir o app. Nota projetada do Dia 1 = (mat+ing)×2,5, preservada exatamente.

**Bloco 6 — Desempenho e telas por papel.**
Telas de desempenho reaproveitando os gráficos da versão atual. Área da coordenação (lista de alunos), área do aluno (própria meta e progresso), área do responsável (leitura do vinculado). Cada papel vê só o que a matriz autoriza.

**Bloco 7 — Conformidade mínima e migração.**
Consentimento como registro real. Log de acesso ao dado do aluno. Funções de exportação e exclusão de dado do titular (LGPD). Migre o Lucas como primeiro aluno da escola de vitrine, provando o fluxo ponta a ponta. Confira virada e nota projetada contra a versão atual.

-----

## 4. Personas por parte (a mentalidade que você assume em cada bloco)

Em cada bloco, raciocine como o especialista correspondente, com a diretriz principal dele em primeiro lugar.

- **Bloco 0 e 1 — Arquiteto de dados Postgres / multi-tenancy.** Diretriz: isolamento é regra de banco, nunca disciplina de quem escreve consulta. Negar por padrão. Desconfie de toda consulta que poderia atravessar escolas.
- **Bloco 2 — Engenheiro de autenticação e autorização.** Diretriz: o front nunca decide quem pode o quê; o banco decide. Papel é claim verificado no token, não estado de tela.
- **Bloco 3 — Engenheiro de produto focado em onboarding.** Diretriz: o cadastro de turma e aluno é onde a escola julga se o sistema é fácil ou um peso. Provisão de menor sem fricção e sem o aluno administrar senha.
- **Bloco 4 — Curador de conteúdo.** Diretriz: você transporta a metodologia, não a cria. Preserve os textos. Versione.
- **Bloco 5 — Engenheiro do motor de estudo.** Diretriz: a virada de semana e a nota projetada são regras sagradas. Preserve byte a byte e teste contra o comportamento atual. Trabalho de servidor não mora no navegador.
- **Bloco 6 — Arquiteto front-end React.** Diretriz: organize por módulo de negócio (Documento 5), nunca recrie o monólito `App.jsx`. Todo acesso a dado passa pelo seam único (`shared/data`).
- **Bloco 7 — Engenheiro de segurança e privacidade (LGPD).** Diretriz: dado de menor exige minimização, consentimento registrado e trilha de acesso. Exportar e apagar têm que funcionar de verdade.
- **Atravessando todos os blocos — QA / engenheiro de testes.** Diretriz: nenhum bloco está pronto sem a verificação dele passando (seção 7). Você é o cético do próprio trabalho.

-----

## 5. Cuidados inegociáveis

Estes não se negociam por pressa nem por elegância.

1. **A chave de serviço (service role) nunca vai ao front, nunca ao repositório.** Só vive no servidor. É o erro que apaga o isolamento inteiro.
1. **RLS habilitada em toda tabela isolável, negar por padrão, desde a criação.** Não existe tabela "vou ligar a política depois".
1. **Autorização no banco, não no front.** O front esconde botão; o banco recusa dado. As duas coisas, não só a primeira.
1. **Dado de menor: minimização.** Não colete CPF nem documento do menor sem necessidade real. Menos dado, menos risco.
1. **Consentimento e log de acesso existem desde o MVP.** Não são Fase 2. Custam pouco e cobrem o tratamento de dado de menor.
1. **Virada de semana por data local e nota projetada (mat+ing)×2,5: preservadas exatamente e testadas** contra a versão atual. Fixe o fuso (América/São_Paulo). Não "melhore" a fórmula.
1. **O aluno usa o sistema no celular.** As telas do aluno precisam funcionar bem no telefone, não só no desktop dos prints. Responsivo de verdade.
1. **Seed idempotente e ambiente reproduzível.** Rodar o seed duas vezes não duplica dado. Seed da vitrine não roda em produção real.
1. **Sem falha silenciosa.** Erro aparece, é tratado e registrado. Nada de engolir exceção.
1. **Não superdimensione.** O alvo é 5 a 6 escolas. Não construa para milhares. Não adicione camada que o porte não pede.

-----

## 6. O que NÃO fazer

- Não construa Fase 2 (lista na seção 1).
- Não gere nem altere a metodologia. Importe.
- Não confie no front para segurança.
- Não use a chave de serviço fora do servidor.
- Não recrie o monólito `App.jsx`; siga os módulos do Documento 5.
- Não crie as pastas reservadas de Fase 2 (Documento 5); só o nome fica no plano.
- Não peça aprovação humana a cada passo. Execute e verifique.

-----

## 7. Verificação e Definição de Pronto

Ao fim, tudo isto tem que ser verdade (Documento 6, seção 8), comprovado por você, não presumido:

- Escola de vitrine logada, com marca aplicada.
- Coordenação cadastra turma e aluno; o sistema gera credencial.
- Aluno entra com credencial, vê a meta da semana, registra estudo, e o desempenho aparece.
- Responsável entra e lê o aluno vinculado, sem ver mais nada.
- **Isolamento provado:** segunda escola semeada não enxerga nada da primeira (teste do bloco 0, ainda passando).
- Virada de semana roda no servidor, sem o app aberto.
- Consentimento registrado; acesso ao dado do aluno logado.
- Nota projetada e virada por data conferidas contra a versão atual.
- Telas do aluno funcionam no celular.

Testes mínimos que têm que existir e passar: o teste de isolamento entre duas escolas, e o teste das duas fórmulas preservadas (virada por data, nota projetada).

-----

## 8. Como reportar

Durante o trabalho, só interrompa para perguntar em caso de bloqueio real (algo que os seis documentos não respondem e sem o qual não dá para prosseguir com segurança). Para tudo o mais, decida e siga, registrando a decisão.

No fim, entregue um relatório curto: o que ficou pronto contra a Definição de Pronto (seção 7), quais testes passaram, quais decisões você tomou sozinho e por quê, e o que ficou conscientemente de fora (Fase 2 e o que mais foi adiado). Sem floreio.

-----

## 9. Fora do escopo deste prompt (de propósito)

Não são tarefa sua. São acompanhamento do dono, e citá-las aqui é só para você não tentar resolvê-las no código: prova de eficácia do método (aprovação de aluno), validação comercial (quem vende e se vende), janela sazonal de compra das escolas, e políticas de backup/retenção/saída de escola. Se esbarrar nelas, registre como observação no relatório final e siga. Não construa solução de negócio para elas.
