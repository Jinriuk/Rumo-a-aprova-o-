# Documento 6 — Arquitetura Fechada

Este documento trava as quatro decisões que estavam em aberto (Doc 4, seção 13) e preenche o que faltava para a arquitetura ficar pronta para construir. Depois deste documento a arquitetura está fechada. O próximo artefato é código, não mais um documento. Lê os Documentos 4 e 5 antes.

-----

## 1. As quatro decisões, travadas

### 1.1 Login do aluno: código provisionado pela escola

O aluno não cria conta. A coordenação cadastra o aluno e o sistema gera uma credencial de acesso, que a escola entrega ao aluno. O responsável recebe um acesso de leitura, também provisionado pela escola, vinculado ao aluno. Só a coordenação tem conta própria (e-mail e senha).

Por quê: aluno é menor. Pôr um adolescente pra administrar e-mail e senha é fricção e risco, e jogaria a coleta de dado pra fora da escola, que é quem a LGPD quer como controladora. Provisão pela escola resolve os três de uma vez.

### 1.2 White-label: marca leve sobre design fixo

O sistema de design é fixo (layout, componentes, navy #0A1622, dourado #CDA349, Fraunces e Archivo, herdados da versão atual). Por cima, uma camada de marca por escola: logo, nome e, no máximo, uma cor de acento dentro de limites. A escola se vê como dona, sem você manter um tema visual diferente por cliente.

Por quê: white-label visual total brigava com o “preservar navy/dourado” dos Docs 2 e 3, e multiplicaria a manutenção por escola. A marca leve entrega o que vende (a escola vê o nome dela) sem o custo que não se paga no seu porte.

### 1.3 Escopo do motor: só o miolo no build inicial

Entra: meta semanal, registro de estudo, estados de atividade (concluída, pendente, ignorada), virada por data local, nota projetada do Dia 1 = (mat+ing)×2,5, e as telas de desempenho. Fica para depois: reforço (revisão espaçada), calibração automática da próxima meta, comparativo e ranking, painel de professor, nivelamento, reconhecimento de prova, indicação de livro por IA.

Por quê: o miolo é o que faz uma escola dizer sim. A profundidade é o que te encantou no sistema do capitão, mas custa meses e não muda a decisão de compra da primeira escola.

### 1.4 Escola do demo: vitrine fictícia, marca real depois

O build inicial é semeado com uma escola de vitrine fictícia, com uma marca de exemplo. Quando houver um alvo concreto, a marca real entra pela camada de branding (1.2), sem tocar no resto.

Por quê: esperar uma escola real pra começar a construir trava o build por um fato que pode demorar. A vitrine fictícia destrava a construção hoje, e a arquitetura de branding já prevê a troca. Este é o único ponto que depende de uma informação sua (qual escola), e foi desenhado pra não bloquear nada enquanto você não a tem.

-----

## 2. Modelo de dados (conceitual, pronto para construir, sem código)

Regra que organiza tudo: **progresso pertence a uma escola e é isolado. Conteúdo é seu, é global, não pertence a escola nenhuma.**

### Carregam o dono (tenant) e são isolados por escola

- **Escola (Tenant):** é a própria unidade de isolamento. O id dela é o dono que todas as outras entidades carregam.
- **Usuário:** pertence a uma escola, tem um papel (coordenação, aluno, responsável). Liga-se à escola.
- **Turma:** pertence a uma escola.
- **Aluno:** pertence a uma escola, a uma ou mais turmas, e assina uma trilha (conteúdo global).
- **Vínculo responsável-aluno:** liga um responsável a um aluno, dentro da escola.
- **Meta:** instância semanal do aluno. Pertence ao aluno e à escola. Aponta para atividades-modelo (conteúdo global).
- **Registro de estudo:** o que o aluno fez (questões, acertos, tempo, data). Pertence ao aluno e à escola.
- **Consentimento:** autorização do responsável pelo tratamento do dado daquele aluno. Pertence à escola (controladora).
- **Log de acesso:** quem acessou o dado de qual aluno e quando. Pertence à escola.
- **Marca/config da escola:** a camada de white-label leve. Pertence à escola.

### NÃO carregam dono, são globais (conteúdo seu)

- **Trilha / Plano:** a metodologia do nicho (ex.: 9 semanas do Colégio Naval). Versionada.
- **Disciplina:** dentro de uma trilha.
- **Atividade-modelo:** a unidade de estudo (tipo, relevância, tempo, código, ligada a disciplina e capítulo).

O conteúdo global é lido por todas as escolas e escrito só por você (operador). É a exceção deliberada à regra do dono, e é o que mantém o método como seu ativo, não como algo que a escola edita ou leva embora.

-----

## 3. Matriz de acesso (o contrato de segurança)

Quem pode ler e escrever o quê. É a intenção das políticas de isolamento (RLS) do banco, em palavras. Tudo que não está autorizado aqui é negado por padrão. Nenhum papel enxerga outra escola.

|Entidade                          |Coordenação                          |Aluno                 |Responsável         |Operador (você)|
|----------------------------------|-------------------------------------|----------------------|--------------------|---------------|
|Escola / marca                    |lê; escreve config e marca da própria|nada                  |nada                |manutenção     |
|Turma                             |cria e gerencia (própria escola)     |nada                  |nada                |manutenção     |
|Aluno                             |cria e gerencia (própria escola)     |lê só o próprio       |lê só o vinculado   |manutenção     |
|Vínculo responsável               |cria e gerencia                      |nada                  |nada                |manutenção     |
|Meta                              |lê (alunos da escola)                |lê só a própria       |lê só a do vinculado|manutenção     |
|Registro de estudo                |lê (alunos da escola)                |lê e escreve o próprio|lê só o do vinculado|manutenção     |
|Consentimento                     |cria e gerencia (controladora)       |nada                  |nada                |manutenção     |
|Log de acesso                     |lê (própria escola)                  |nada                  |nada                |lê             |
|Trilha / Atividade-modelo (global)|lê                                   |lê                    |lê                  |cria e gerencia|

Notas que fazem essa matriz valer:

- **A coordenação não escreve meta nem registro.** Quem gera meta é o motor (servidor); quem registra estudo é o aluno. A coordenação acompanha, não falsifica progresso.
- **A coordenação não edita conteúdo.** Ela consome a sua trilha. Só você autora o método.
- **Acesso de responsável e (na Fase 2) de professor a dado de aluno é registrado no log.** É exigência de LGPD e custa pouco.
- **O papel de operador é cross-tenant e sensível.** Toda ação dele é logada. Fica fora do fluxo normal das escolas.

-----

## 4. Fluxos principais (passo a passo, sem código)

### 4.1 Escola entra no sistema

No demo, é seed (a vitrine fictícia já nasce no banco). Em produção, você provisiona a escola e a conta da coordenação. Não há cadastro self-service de escola no build inicial (seria operação antes de receita).

### 4.2 Coordenação monta a turma

Coordenação cria a turma, cadastra os alunos (em lote ou um a um), e o sistema gera as credenciais de acesso. A coordenação distribui as credenciais aos alunos e vincula os responsáveis. Tem que ser simples: é aqui que a escola decide se o sistema é fácil ou um peso.

### 4.3 Aluno entra e estuda

Aluno entra com a credencial. Vê a meta da semana, com as atividades vindas da trilha. Marca atividade como feita, lança questões, acertos e tempo. O registro alimenta o desempenho. No Dia 1, a nota projetada sai de (mat+ing)×2,5.

### 4.4 Responsável acompanha

Responsável entra com o acesso provisionado, lê o progresso do aluno vinculado. Só leitura. O acesso fica registrado no log.

### 4.5 Virada de semana e geração da próxima meta

Roda no servidor (Edge Function), agendada por data local. Não depende de o aluno abrir o app. Fecha a meta corrente, gera a próxima a partir da trilha. A geração usa privilégio elevado, que nunca fica no front.

### 4.6 Pedido do titular (LGPD)

A escola pede exportar ou apagar o dado de um aluno. Uma Edge Function dedicada faz a exportação ou a exclusão. Projetado agora porque remendar depois é caro.

-----

## 5. Identidade na prática

A escola e o papel do usuário viajam dentro do token de login, como informação verificada. O front usa isso pra decidir qual tela mostrar. O banco usa o mesmo token pra decidir qual dado entregar (a matriz da seção 3 vira política de banco). Os dois confiam na mesma fonte. Papel não é estado de tela que se possa burlar pelo navegador: é identidade carimbada no token. É isso que faz a matriz de acesso ser real e não decorativa.

-----

## 6. Migração do Rumo ao Naval para a fundação nova

O que existe hoje não se joga fora. Ordem de operações:

1. **Importar a trilha do Colégio Naval** (plano de 9 semanas, mapa de capítulos, prioridades) como a primeira trilha de conteúdo global. É o ativo, entra primeiro.
1. **Reescrever o seam de dados** (`shared/data`, herdeiro do `db` atual) pra falar com o Supabase em vez do localStorage. É o único ponto que muda; as telas não percebem.
1. **Preservar as regras intactas** (`shared/regras`): virada por data local e nota projetada. Migram sem alteração, com teste.
1. **Migrar o Lucas como primeiro aluno** da escola de vitrine. Vira o caso real que prova o fluxo ponta a ponta.
1. **Decompor o `App.jsx`** nos módulos do Doc 5, à medida que cada tela é religada ao dado real. Não é reescrever do zero: é redistribuir o que já funciona.

-----

## 7. Ambientes e deploy

- **Front no Vercel** (onde já está). **Banco, auth e funções no Supabase**, região São Paulo (LGPD).
- **Dois ambientes:** desenvolvimento (com seed da vitrine) e produção. Seed não roda em produção real.
- **Segredos:** a chave pública (anon) vai ao front. A chave de serviço fica só no servidor (Edge Functions) e nas variáveis de ambiente do Supabase. Nunca no repositório, nunca no navegador. Repito porque é o erro que apaga o isolamento inteiro.

-----

## 8. Definição de pronto do build inicial (a régua do demo)

O demo só está pronto pra anunciar quando tudo isto for verdade. Serve pra você não chamar de pronto o que ainda vaza, e pra medir o “uma semana” contra a realidade.

- Uma escola de vitrine logada, com marca aplicada.
- Coordenação cadastra turma e aluno, e o sistema gera credencial.
- Aluno entra com credencial, vê a meta da semana, registra estudo, e o desempenho aparece.
- Responsável entra e lê o aluno vinculado, sem ver mais nada.
- Isolamento provado: uma segunda escola semeada não enxerga nada da primeira (ver seção 9).
- Virada de semana roda no servidor, sem depender do app aberto.
- Consentimento existe como registro, e o acesso ao dado do aluno é logado.
- Nota projetada e virada por data preservadas e conferidas contra a versão atual.

Tudo que não está nesta lista é Fase 2 e não bloqueia o demo.

-----

## 9. O único spike antes de confiar nesta arquitetura

A arquitetura está fechada no papel. No papel ela não vaza. Antes de construir tudo em cima, vale provar a peça da qual tudo depende: **semear duas escolas no banco e confirmar que uma não acessa, de jeito nenhum, o dado da outra**, com a política de isolamento ligada e a identidade real no token. É um teste pequeno e descartável, mas é o que separa “isolamento que eu desenhei” de “isolamento que existe”. Se essa peça falhar, nenhuma outra parte importa. Se passar, o resto é construção sobre fundação provada.

Isso é trabalho do seu build, não meu. Fica como a primeira coisa a validar antes de seguir.

-----

## 10. Arquitetura fechada

Os quatro pontos estão travados, o modelo de dados e o contrato de segurança estão definidos, os fluxos e a migração estão escritos. Não falta decisão de arquitetura pra começar a construir. O próximo passo não é um Documento 7: é abrir o build e provar o isolamento (seção 9). Se aparecer uma pergunta nova durante a construção, ela se resolve no contexto do código, não em mais uma rodada de planejamento. A esta altura, mais documento vira fuga de construir.