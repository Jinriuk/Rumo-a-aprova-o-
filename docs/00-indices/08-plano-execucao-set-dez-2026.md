# Plano mestre final - Triliva

**Janela executiva:** 1º de setembro a 1º de dezembro de 2026  
**Versão:** 1.0 - consolidação final  
**Data de corte técnico:** 1º de setembro de 2026  
**Repositório:** `Jinriuk/Rumo-a-aprova-o-`  
**Base verificada:** `main` no commit `cd75cc5`; o último commit de produto permanece `8c8a808`, de 24/08/2026  
**Estratégia:** B2B como motor principal; B2C somente como beta fechado, assistido e dentro da mesma plataforma  
**Meta pessoal relacionada:** gerar caixa relevante até 01/12/2026, antes do casamento de 18/12/2026  

> Este é o documento central de comando do projeto. Ele substitui, para a janela setembro-dezembro de 2026, o plano técnico antigo e o plano integrado anterior. Os relatórios históricos continuam válidos como evidência, mas não como ordem de execução.

---

# 1. Decisão executiva

O Triliva deve ser tratado como uma empresa B2B em validação comercial, e não como um catálogo genérico de concursos ou um curso online concorrente de grandes plataformas.

## 1.1 O que será vendido

Uma camada white-label de execução pedagógica para escolas e cursos preparatórios, capaz de:

- transformar edital e metodologia da escola em uma trilha semanal;
- organizar metas, atividades, missões, XP e progresso;
- permitir que a coordenação identifique atraso e risco;
- permitir que o responsável acompanhe o aluno;
- operar várias escolas com isolamento de dados;
- usar o conteúdo da própria instituição sem substituir seu LMS, ERP ou banco de questões.

## 1.2 Estratégia por modelo

| Modelo | Decisão até 01/12 | Papel |
|---|---|---|
| B2B | prioridade absoluta | gerar contratos, caixa, case e validação institucional |
| B2C | beta fechado de até 30 alunos | validar uso, cobrança e suporte; não financiar sozinho a meta de caixa |
| Venda integral do ativo | não perseguir agora | preparar propriedade intelectual e data room para aumentar valor futuro |
| Desenvolvimento de catálogo | somente por demanda | não construir seis concursos incompletos antes do primeiro piloto |

## 1.3 Resultado esperado em 1º de dezembro

O resultado mínimo aceitável não é “ter programado muito”. É ter:

1. um pipeline de pelo menos 50 contas qualificadas;
2. ao menos 10 reuniões de descoberta, cinco demos e três propostas;
3. uma LOI, contrato de design partner ou piloto pago;
4. produção reproduzível, separada da demo e aprovada nos gates antes do primeiro aluno real;
5. uma trilha 2027/2028 versionada por coorte e validada para o piloto;
6. beta B2C fechado somente se segurança, conteúdo e documentos estiverem prontos;
7. métricas de ativação, uso, suporte, renovação e valor para a coordenação;
8. documentação suficiente para repetir a venda e reduzir a dependência do fundador.

## 1.4 Verdade financeira

O beta B2C de 30 alunos a R$ 29,90 gera no máximo R$ 897 por mês antes de taxas e inadimplência. Ele é um experimento de produto, não o caminho principal para R$ 50 mil.

A meta de R$ 50 mil até 01/12 é uma meta agressiva, não uma previsão. Para produzir esse caixa apenas com o Rumo, seria necessário, por exemplo:

- dois pilotos de R$ 25 mil pagos integralmente; ou
- três pilotos de aproximadamente R$ 17 mil; ou
- combinação de setup, entrada de pilotos e outras fontes de renda.

O objetivo operacional do Rumo deve ser buscar R$ 20 mil a R$ 50 mil em valor contratado e maximizar a parcela recebida antes de dezembro, sem prometer implantação insegura.

---

# 2. Evidência atual do sistema

## 2.1 O que foi confirmado na main

| Tema | Estado confirmado | Consequência |
|---|---|---|
| Arquitetura | React/Vite, Supabase Auth/Postgres/RLS, seis Edge Functions, multi-tenant | existe produto real, não apenas protótipo visual |
| Banco | 44 migrations versionadas e fábrica de seeds | produção pode ser reconstruída pelo repositório |
| Testes | auditoria de 25/08 mediu 558 testes verdes | base técnica é útil, mas não substitui E2E |
| E2E | workflow é opcional e pula sem secrets | CI verde não comprova os quatro perfis no navegador |
| Produção pública | `.env.production` continua apontando para projeto rotulado como demo | ambiente atual não deve receber novos alunos reais |
| E-mail da coordenação | Edge Function usa `generateLink` e chama o resultado de “enviado” | primeiro acesso e recuperação permanecem bloqueadores |
| Cadastro do aluno | falha de `gerar-meta` é capturada no console e o cadastro aparece como sucesso | aluno pode nascer sem plano operacional |
| Credencial | `password: codigo` ainda existe no provisionamento e no login | o código permanente continua sendo usuário e senha |
| Credencial opaca | migration 0044 criou fundação de hash/rotação, mas o corte não foi feito | controle existe de forma dormente, não protege o login atual |
| Segurança | RLS principal é sólida; há writes e permissões a endurecer | piloto exige revisão cross-tenant e de suspensão |
| Observabilidade | gancho existe, mas destino está vazio | erro real pode virar apenas console |
| Conteúdo | EsPCEx é o ativo mais maduro; CN é parcial; demais são esqueletos | venda deve ser estreita e honesta |
| Jurídico/LGPD | mecanismos técnicos iniciais, mas documentos e governança incompletos | menor real não entra antes do pacote mínimo |
| Propriedade intelectual | repositório público, sem pacote de notices/data room completo | reduz diligência e valor de uma venda integral |

## 2.2 O que precisa ser verificado ao vivo novamente

Como os projetos do Supabase foram restaurados em 01/09, os seguintes itens não podem ser presumidos a partir de documentos antigos:

- [ ] nomes, organizações, planos, regiões e status dos dois projetos ativos;
- [ ] qual projeto pertence ao Rumo e qual pertence a outro sistema;
- [ ] migrations presentes no ledger remoto;
- [ ] versões e status das seis Edge Functions;
- [ ] usuários Auth e dados de cada tenant;
- [ ] cron, heartbeat e última execução;
- [ ] SMTP, redirects, templates e rate limits do Auth;
- [ ] buckets, policies e objetos do Storage;
- [ ] secrets do Supabase e variáveis da Vercel;
- [ ] backups disponíveis e possibilidade de restauração;
- [ ] plano, ownership e domínio do deployment atual da Vercel.

Item não demonstrado permanece “não aceito” até haver evidência.

## 2.3 Decisão sobre migração

A evidência medida em 15/07 apontou que não havia aluno real no projeto do Rumo: a escola Ícone tinha zero alunos e todo o restante era demonstração ou teste. Portanto, a decisão padrão é:

> produção nova e limpa, com migrations, conteúdo global selecionado, SuperADM novo, escola piloto nova e credenciais novas.

Somente abandonar essa decisão se o inventário de setembro comprovar que surgiram dados reais que precisam ser preservados.

---

# 3. Comparação dos dois planos anteriores

## 3.1 Onde o plano técnico inicial era superior

O plano inicial era mais forte em:

- checklist de infraestrutura profissional;
- migração limpa do banco;
- Edge Functions, cron, secrets e backend;
- segurança, RLS, credenciais e rate limit;
- backup, restore e continuidade;
- observabilidade;
- E2E, CI/CD e carga;
- LGPD, contratos e propriedade intelectual;
- checklist objetivo para autorizar aluno real.

Seu defeito era tratar quase todo gasto e toda infraestrutura paga como ação imediata, mesmo sem caixa e sem contrato, além de deixar a prospecção concentrada no fim.

## 3.2 Onde o plano integrado era superior

O plano integrado era mais forte em:

- começar CRM e prospecção na primeira semana;
- manter engenharia, conteúdo e comercial em paralelo;
- considerar a sazonalidade setembro-dezembro;
- separar B2B principal de B2C fechado;
- criar trilhas por evidência de demanda;
- usar Supabase Free e desenvolvimento local enquanto não há aluno real;
- controlar o uso das IAs dentro do orçamento;
- definir métricas de vendas, produto e operação.

Seu defeito era resumir excessivamente vários controles técnicos do plano anterior e não decompor alguns bloqueadores em tarefas executáveis.

## 3.3 Resolução final dos conflitos

| Tema | Plano inicial | Plano integrado | Decisão final |
|---|---|---|---|
| Supabase Pro | imediatamente | depois de receita | Free/local para construir e demonstrar; Pro em São Paulo antes do primeiro dado real |
| Staging pago | projeto adicional | segundo Free/candidato | local + ambiente remoto sem dado real; staging pago somente se necessário |
| Vercel Pro | imediatamente | financiado pelo piloto | Hobby apenas para demo não comercial; Pro antes de operação paga |
| Região nos EUA | trocar por obrigação LGPD | documentar transferência | não é automaticamente ilegal; produção em São Paulo por estratégia de residência, latência e confiança |
| Prospecção | depois do sprint técnico | começa já | começa no dia 1 e nunca para |
| Conteúdo | EsPCEx primeiro | CN/EsPCEx + CMRJ/CEFET | EsPCEx é default técnico; o contrato escolhe a trilha do piloto; CMRJ é expansão estratégica; CEFET é teste sazonal condicional |
| Login do aluno | proxy opaco | senha temporária e troca | código como identificação + senha temporária forte + senha pessoal obrigatória; código nunca mais é a senha |
| B2C | não central | beta de 30 | beta concierge dentro do mesmo multi-tenant, após gates |
| Catálogo | seis concursos | demanda primeiro | uma trilha vendável; demais somente após evidência |
| Contratação | após produto pronto | pré-venda condicionada | vender agora contrato/LOI; go-live fica condicionado aos gates |
| Meta de dezembro | não tratada | receita até 01/12 | receber entrada e iniciar piloto; o case completo pode terminar depois |

---

# 4. Princípios que não podem ser violados

1. Conversar, demonstrar e enviar proposta pode começar agora.
2. Nenhum aluno real entra no ambiente demo.
3. Nenhum aluno real entra antes do gate técnico, jurídico e operacional.
4. Nenhuma trilha incompleta será anunciada como completa.
5. O Rumo não será dividido em dois produtos para o beta B2C.
6. Código de matrícula e senha devem ser segredos diferentes.
7. Mudança de banco sempre nasce em migration; painel não é fonte da verdade.
8. Migration antiga aplicada não é editada; correções começam na 0045.
9. Demo, produção e desenvolvimento não compartilham dados reais.
10. IA implementa, mas teste determinístico e revisão independente aprovam.
11. Todo trabalho deve destravar segurança, venda, conteúdo do piloto ou receita.
12. O primeiro pagamento deve financiar domínio, produção e operação paga.
13. O Rumo não tentará virar LMS, ERP ou banco de questões antes do piloto.
14. O GrinderBank não ocupa os blocos definidos para o Rumo até a revisão de 01/12.

---

# 5. Gates de decisão

## Gate G0 - Demonstração segura

Autoriza apenas demonstrações com dados fictícios.

- [ ] demo claramente identificada;
- [ ] nenhuma conta real;
- [ ] roteiro de demo e avisos de maturidade honestos;
- [ ] nenhuma alegação de SLA, banco de questões ou produção madura;
- [ ] dados da escola demonstrada são fictícios ou autorizados.

## Gate G1 - Proposta e LOI

Autoriza enviar proposta e receber aceite condicionado.

- [ ] dor e turma definidas;
- [ ] concurso e coorte identificados;
- [ ] escopo do piloto delimitado;
- [ ] preço, marcos e responsabilidades claros;
- [ ] go-live condicionado ao G3;
- [ ] escola reconhece seu papel na validação/fornecimento de conteúdo.

## Gate G2 - Receber entrada

Autoriza receber dinheiro para implantação, ainda sem aluno ativo.

- [ ] contrato/LOI assinado;
- [ ] nota/forma de recebimento validada com contador e regras profissionais do fundador;
- [ ] cronograma e critério de cancelamento definidos;
- [ ] verba reservada para produção, domínio, e-mail e contingência;
- [ ] não há promessa de data impossível.

## Gate G3 - Primeiro aluno real

Autoriza beta B2C ou piloto B2B.

- [ ] todos os itens do checklist final da seção 22 estão “SIM”;
- [ ] produção paga e separada;
- [ ] conteúdo/coorte validado;
- [ ] Auth, e-mail, backup/restore, RLS, monitoramento e E2E aprovados;
- [ ] contratos, DPA, Privacidade e tratamento de menores aprovados;
- [ ] suporte e incidente definidos.

## Gate G4 - Cem alunos ou segunda escola

- [ ] primeira coorte estável por pelo menos duas semanas;
- [ ] sem incidente crítico aberto;
- [ ] carga e lote de 100 aprovados;
- [ ] métricas, suporte e custo conhecidos;
- [ ] onboarding repetível;
- [ ] isolamento entre duas escolas provado em produção equivalente.

## Gate G5 - Checkout, tráfego pago ou venda integral

- [ ] ao menos 20 B2C pagantes e retenção de segundo mês; ou
- [ ] dois ou três clientes B2B pagantes e case documentado;
- [ ] cadeia de IP, contratos, data room e operação transferível;
- [ ] unit economics conhecidos.

---

# 6. Topologia de ambientes e regra de gastos

## 6.1 Enquanto não houver contrato ou pagante

| Ambiente | Uso | Dados reais | Custo desejado |
|---|---|---:|---:|
| Supabase local | desenvolvimento, migrations, resets e testes | não | R$ 0 |
| projeto Rumo atual | Teste e Vitrine | não | Free |
| segundo projeto Free | usar apenas se for realmente do Rumo e não prejudicar outro sistema | não | Free |
| Vercel Hobby | demo não comercial | não | R$ 0 |
| CRM | planilha | contatos empresariais públicos | R$ 0 |
| Resend | preparar domínio/integração quando disponível | não antes do domínio | Free inicial |

Se o segundo projeto ativo for GrinderBank ou outro sistema, ele não será reaproveitado. O staging remoto do Rumo espera; desenvolvimento e QA usam Supabase local mais a vitrine controlada.

## 6.2 Quando houver contrato/entrada e antes do G3

- criar organização oficial do Rumo;
- criar produção dedicada em Supabase Pro;
- escolher `sa-east-1` para a produção;
- migrar frontend comercial para Vercel Pro ou hospedagem explicitamente comercial;
- comprar/configurar domínio;
- configurar e-mail corporativo e SMTP;
- ligar monitoramento e backups;
- manter demo separada.

## 6.3 Custo revisado

As regras atuais do Supabase concedem dois projetos Free no total para owners/admins. No plano pago, a cobrança é por organização mais compute por projeto, com crédito de compute. Para uma produção pequena, reservar aproximadamente US$ 25-30/mês para um projeto; staging pago adicional aumenta o custo.

A Vercel restringe Hobby a uso pessoal não comercial; Pro começa em torno de US$ 20/mês. O Resend informa plano gratuito de 3.000 e-mails por mês.

Reserva inicial recomendada para go-live:

| Item | Reserva mensal |
|---|---:|
| Supabase Pro com uma produção pequena | US$ 25-30 |
| Vercel Pro | a partir de US$ 20 |
| Resend | US$ 0 no início |
| monitoramento | US$ 0 no início |
| staging pago opcional | aproximadamente US$ 10-15 |
| domínio | anual, preço variável |

Faixa prática: aproximadamente US$ 45-65/mês, antes de impostos, câmbio, domínio e excedentes. Não contratar staging pago sem necessidade comprovada.

Fontes oficiais:

- [Supabase - billing e projetos Free](https://supabase.com/docs/guides/platform/billing-on-supabase)
- [Supabase - FAQ de cobrança](https://supabase.com/docs/guides/platform/billing-faq)
- [Supabase - backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase - regiões](https://supabase.com/docs/guides/platform/regions)
- [Vercel - Hobby](https://vercel.com/docs/plans/hobby)
- [Vercel - Pro](https://vercel.com/docs/plans/pro-plan)
- [Resend - preços](https://resend.com/pricing)

---

# 7. Plano final em 14 etapas

As etapas trabalham em paralelo. Cada item possui período, dependências, entregáveis e critério de saída. “Concluído” significa evidência, não sensação.

---

## Etapa 1 - Comando, foco, governança e fonte da verdade

**Período:** 01-02/09  
**Dependências:** nenhuma  
**Objetivo:** impedir desenvolvimento aleatório e perda de tempo entre ferramentas.

### Ações

- [ ] declarar este documento como plano executivo da janela;
- [ ] criar backlog único com ID, etapa, responsável, prioridade, prazo, aceite e evidência;
- [ ] usar estados: pendente, em execução, bloqueado, revisão, validado e concluído;
- [ ] limitar trabalho simultâneo a três resultados por semana;
- [ ] congelar funcionalidades que não destravem risco, venda, conteúdo ou receita;
- [ ] separar decisões de “agora”, “antes do G3” e “depois do piloto”;
- [ ] registrar toda decisão arquitetural relevante em ADR;
- [ ] registrar qual commit está em demo, staging e produção;
- [ ] definir um segundo operador confiável e o nível mínimo de acesso;
- [ ] criar calendário semanal fixo de engenharia, comercial e revisão;
- [ ] reservar blocos do Rumo sem concorrência com GrinderBank;
- [ ] manter planilha simples de gastos e caixa do produto.

### Papéis

| Papel | Responsabilidade |
|---|---|
| Gabriel | dono do escopo, produto, vendas e aceite final |
| Sonnet | implementação principal em tarefas fechadas |
| Opus | Auth, RLS, migrations, arquitetura e bugs críticos |
| Fable/browser | validação funcional, visual e multidevice |
| GPT-5.6 Sol | auditoria adversarial no fechamento de cada etapa |
| advogado/contador | jurídico, LGPD, contratação e recebimento |
| escola design partner | validar método, conteúdo, implantação e métricas |

### Critério de saída

Toda tarefa aberta pertence a uma etapa e possui critério de aceite verificável.

---

## Etapa 2 - Inventário e posse profissional da infraestrutura

**Período:** 01-05/09  
**Dependências:** Etapa 1  
**Objetivo:** descobrir e controlar o estado real dos ativos restaurados.

### Contas e ownership

- [ ] criar organização oficial no GitHub e no Supabase, mesmo que inicialmente Free;
- [ ] definir e-mail empresarial assim que o domínio existir;
- [ ] não apagar contas pessoais até a transferência estar comprovada;
- [ ] ativar MFA no Supabase, GitHub, Vercel, registrador e e-mail;
- [ ] adicionar segundo operador com menor privilégio suficiente;
- [ ] inventariar recovery codes e guardar offline em local seguro;
- [ ] mapear domínio, DNS, Vercel, Supabase, GitHub, Resend e monitoramento;
- [ ] registrar owner, admins, billing e contato de recuperação de cada serviço;
- [ ] remover acessos antigos ou sem justificativa;
- [ ] verificar se o projeto Vercel atual pertence à conta/equipe correta;
- [ ] planejar transferência do repositório para organização sem quebrar deploys.

### Dois projetos Supabase restaurados

- [ ] registrar nome, ref, organização, plano, região e Postgres de cada projeto;
- [ ] identificar qual é Rumo, GrinderBank ou legado;
- [ ] não reaproveitar projeto de outro produto;
- [ ] contar tabelas, usuários Auth, tenants e linhas críticas;
- [ ] listar migrations remotas e comparar com as 44 do repositório;
- [ ] listar Edge Functions e versões;
- [ ] listar cron jobs, heartbeat e última atividade;
- [ ] listar buckets, policies e objetos;
- [ ] verificar SMTP, redirects, templates, MFA e rate limits;
- [ ] registrar secrets existentes sem copiá-los para documentos;
- [ ] gerar dump antes de qualquer mudança;
- [ ] identificar dados fictícios, testes e qualquer dado potencialmente real;
- [ ] confirmar publicamente que a aplicação atual é demo/vitrine.

### Entregáveis

- inventário de ativos;
- matriz owner x acesso x MFA;
- relatório repo x remoto;
- mapa de ambientes;
- backup inicial;
- decisão escrita sobre cada projeto.

### Critério de saída

É possível responder quem controla cada ativo, qual banco contém cada dado e como reconstruir o sistema sem depender da memória.

---

## Etapa 3 - Fundação comercial, CRM e materiais

**Período:** 01-07/09, em paralelo  
**Dependências:** Etapa 1  
**Objetivo:** começar vendas antes do fim da engenharia.

### ICP e segmentação

- [ ] priorizar cursos presenciais/híbridos de 30-300 alunos;
- [ ] priorizar dono ou coordenador acessível;
- [ ] priorizar quem já possui conteúdo, mas não acompanhamento fora da aula;
- [ ] criar segmentos: pré-militar, Colégios Militares, pré-técnico e rede;
- [ ] iniciar pelo Rio de Janeiro e proximidades operacionais;
- [ ] expandir para outros estados após validar mensagem e demo;
- [ ] classificar pequena, média e rede, com critério objetivo;
- [ ] separar conta, unidade e contato para não confundir uma rede com uma escola.

### Campos mínimos do CRM

- [ ] instituição e unidade;
- [ ] cidade, bairro e distância operacional;
- [ ] tipo e porte estimado;
- [ ] concursos/turmas;
- [ ] site e redes oficiais;
- [ ] decisor: dono, diretor ou coordenação;
- [ ] contatos empresariais públicos e fonte;
- [ ] data do primeiro contato;
- [ ] dor confirmada;
- [ ] ciclo de renovação e início das turmas;
- [ ] solução atual;
- [ ] interesse por responsável/coordenação;
- [ ] trilha pedida;
- [ ] estágio do funil;
- [ ] valor potencial;
- [ ] próxima ação e data;
- [ ] motivo de perda;
- [ ] consentimento/legitimidade para contatos quando aplicável.

### Materiais

- [ ] one-page institucional;
- [ ] apresentação de oito minutos;
- [ ] roteiro de demo;
- [ ] mensagem inicial de WhatsApp;
- [ ] e-mail de prospecção;
- [ ] roteiro de ligação;
- [ ] follow-ups D+2, D+5, D+10 e encerramento;
- [ ] questionário de descoberta;
- [ ] proposta de piloto;
- [ ] modelo de LOI;
- [ ] calculadora simples de ROI/tempo da coordenação;
- [ ] FAQ de objeções;
- [ ] página ou PDF com segurança, LGPD e implantação, sem alegações falsas.

### Primeira lista

- [ ] consolidar 50 contas prioritárias;
- [ ] começar por SEYP, Curso Queiroz, Praticar Ensino, Winners, PFD e cursos locais equivalentes;
- [ ] tratar redes como segunda onda;
- [ ] não abordar grande edtech para aquisição antes de tração.

### Critério de saída

Gabriel consegue localizar um decisor, abrir conversa, realizar diagnóstico, demonstrar e enviar proposta sem improvisar um novo documento.

---

## Etapa 4 - Arquitetura de ambientes, domínio e gate de gastos

**Período:** 03-12/09  
**Dependências:** Etapa 2; gasto pago depende do G2  
**Objetivo:** obter separação profissional sem consumir caixa antes do momento necessário.

### Agora, sem gasto

- [ ] usar Supabase local como desenvolvimento;
- [ ] manter o projeto atual como Teste e Vitrine;
- [ ] usar somente dados fictícios;
- [ ] separar arquivos de ambiente por destino;
- [ ] remover qualquer ideia de “produção” do deployment demo;
- [ ] adicionar marca visual DEMO apenas no ambiente de vitrine;
- [ ] configurar dump manual/automatizado criptografado;
- [ ] inventariar opções de domínio e e-mail sem contratar plano desnecessário;
- [ ] configurar alertas gratuitos disponíveis;
- [ ] documentar o caminho de upgrade.

### Após entrada ou imediatamente antes do G3

- [ ] criar organização Supabase Pro oficial;
- [ ] criar projeto “Triliva - Produção” em `sa-east-1`;
- [ ] manter demo fora da organização paga, se isso reduzir custo e não prejudicar ownership;
- [ ] usar um ambiente remoto de staging sem dado real;
- [ ] migrar a Vercel para Pro ou hosting comercial equivalente;
- [ ] transferir deployment para equipe oficial;
- [ ] comprar/configurar domínio;
- [ ] usar `app.<dominio>` para aplicação;
- [ ] usar `www.<dominio>` para landing page;
- [ ] criar `suporte@`, `privacidade@` e `comercial@`;
- [ ] configurar SPF, DKIM e DMARC;
- [ ] configurar Resend ou equivalente;
- [ ] ligar spend cap/orçamento e alertas;
- [ ] remover dependência operacional de projeto legado;
- [ ] testar redirects de Auth no domínio real.

### Decisão de região

Hospedagem nos EUA não é automaticamente ilegal. A Resolução CD/ANPD nº 19/2024 disciplina mecanismos de transferência internacional. Mesmo assim, a produção será criada em São Paulo por:

- narrativa comercial mais simples;
- menor latência para o público do RJ;
- controle de residência do banco primário;
- redução da complexidade contratual.

Demo nos EUA só pode conter dados fictícios.

### Critério de saída

Nenhum build pode confundir demo, staging e produção; o upgrade comercial tem custo, responsável e gatilho definidos.

---

## Etapa 5 - Banco limpo, migrations e produção reproduzível

**Período:** 04-14/09  
**Dependências:** Etapas 2 e 4  
**Objetivo:** provar que a produção nasce do repositório, sem sujeira de demo.

### Rehearsal local e staging

- [ ] congelar mudanças de schema durante a reconciliação;
- [ ] gerar backup do banco atual;
- [ ] aplicar migrations 0001-0044 em banco local limpo;
- [ ] executar o reset completo duas vezes;
- [ ] rodar seeds globais permitidos;
- [ ] confirmar que seeds demo não entram sem a escola de vitrine;
- [ ] rodar toda a suíte PostgreSQL;
- [ ] aplicar em staging;
- [ ] executar `supabase db push --dry-run` ou equivalente seguro;
- [ ] comparar migration history local x staging x remoto;
- [ ] documentar extensões, roles, functions, triggers e cron;
- [ ] proibir edição manual do schema pelo Table Editor;
- [ ] criar migration 0045 para qualquer nova correção;
- [ ] nunca editar migration antiga já aplicada;
- [ ] registrar rollback/forward fix para alterações sensíveis.

### Produção limpa

- [ ] aplicar 0001-0044 na ordem;
- [ ] aplicar somente seeds pedagógicos globais aprovados;
- [ ] não importar escolas, alunos, responsáveis ou Auth da demo;
- [ ] criar SuperADM novo;
- [ ] criar escola piloto pelo backoffice;
- [ ] criar coordenação com e-mail real;
- [ ] recriar bucket de logos vazio e privado por padrão;
- [ ] comparar contagens de conteúdo com staging;
- [ ] registrar commit e migration head da produção.

### Plano de exceção se houver dado real

- [ ] suspender escrita no banco antigo;
- [ ] exportar schema, dados, Auth e contagens;
- [ ] definir invalidação de sessões;
- [ ] migrar UUIDs e vínculos;
- [ ] validar cada tenant;
- [ ] manter antigo somente leitura por prazo definido;
- [ ] excluir de modo seguro somente após aceite formal.

### Critério de saída

Um ambiente vazio pode ser reconstruído, testado e comparado sem operação manual oculta.

---

## Etapa 6 - Backend, Edge Functions, cron, e-mail e geração de meta

**Período:** 05-16/09  
**Dependências:** Etapa 5  
**Objetivo:** corrigir os dois bloqueadores funcionais mais concretos.

### Implantação backend

- [ ] implantar as seis Edge Functions;
- [ ] configurar `SUPABASE_URL` e chaves públicas corretas;
- [ ] manter `service_role` somente no servidor;
- [ ] configurar secrets por ambiente;
- [ ] configurar `ALLOWED_ORIGINS` sem preview amplo em produção;
- [ ] configurar `PASSWORD_RESET_REDIRECT_URL` do domínio real;
- [ ] implantar `pg_cron`;
- [ ] confirmar virada semanal e heartbeat;
- [ ] criar alerta quando o heartbeat parar;
- [ ] registrar versão/hash de cada função implantada;
- [ ] testar suspensão e reativação de escola;
- [ ] testar LGPD exportar/excluir;
- [ ] testar revogação de responsável.

### Corrigir e-mail da coordenação

O método `generateLink` gera um link para envio por provedor customizado; ele não envia. O fluxo atual precisa mudar.

- [ ] escolher envio nativo real por `inviteUserByEmail`/reset com SMTP ou envio customizado pelo Resend;
- [ ] se usar `generateLink`, enviar o `action_link` no servidor via provedor;
- [ ] nunca devolver link privilegiado para a interface de produção;
- [ ] manter fallback manual somente na demo, claramente rotulado;
- [ ] mostrar “enviado” apenas depois de aceitação pelo provedor;
- [ ] registrar status aceito, entregue, bounced e rejeitado;
- [ ] criar webhook de entrega;
- [ ] testar primeiro acesso e redefinição;
- [ ] criar E2E que abra a caixa de teste e conclua o fluxo;
- [ ] não registrar token/link em log.

Fonte oficial: [Supabase generateLink](https://supabase.com/docs/reference/javascript/auth-admin-generatelink).

### Corrigir aluno sem meta

- [ ] remover `.catch(console.error)` como comportamento final;
- [ ] cadastrar aluno com estado `pendente_configuracao`;
- [ ] gerar meta de forma transacional ou em workflow com retry idempotente;
- [ ] se falhar, mostrar erro real e próxima ação;
- [ ] impedir login/trilha ativa até o provisionamento terminar;
- [ ] impedir concurso sem trilha operacional;
- [ ] criar reprocessamento seguro;
- [ ] no lote, devolver criados, pendentes, falhas e motivo;
- [ ] monitorar fila e tempo de processamento;
- [ ] testar repetição sem duplicar meta ou usuário.

### Critério de saída

Coordenação recebe acesso de verdade e nenhum aluno é anunciado como pronto sem meta válida.

---

## Etapa 7 - Autenticação, primeiro acesso e ciclo de credenciais

**Período:** 06-18/09  
**Dependências:** Etapa 6  
**Objetivo:** separar identificação de autenticação e permitir revogação segura.

### Decisão de arquitetura do aluno

O fluxo final do piloto será:

1. coordenação cadastra o aluno;
2. sistema gera código/matrícula de identificação;
3. sistema gera senha temporária aleatória e separada;
4. aluno entra com código + senha temporária;
5. primeiro acesso força senha pessoal;
6. coordenação nunca vê a senha pessoal;
7. esquecimento gera reset assistido e nova senha temporária;
8. atraso/suspensão bloqueia acesso sem apagar histórico.

### Implementação

- [ ] remover `password: codigo`;
- [ ] manter código como identificador, não segredo permanente;
- [ ] criar senha temporária forte de uso inicial;
- [ ] marcar `must_change_password` ou estado equivalente;
- [ ] criar rota de primeira troca;
- [ ] impedir uso normal antes da troca;
- [ ] implementar reset assistido para aluno sem e-mail próprio;
- [ ] definir fluxo do responsável com senha própria;
- [ ] tornar mensagens de login genéricas contra enumeração;
- [ ] expirar senha temporária;
- [ ] registrar rotação, revogação e reset;
- [ ] revogar todas as sessões quando comprometido;
- [ ] definir duração de sessão e refresh;
- [ ] aplicar bloqueio temporário por tentativas;
- [ ] aplicar rate limit por identificador, IP e dispositivo;
- [ ] alertar padrão distribuído;
- [ ] usar a fundação da migration 0044 quando fizer sentido, sem manter dois fluxos concorrentes;
- [ ] migrar somente contas piloto; demo pode ser recriada;
- [ ] criar rollback da mudança de Auth;
- [ ] testar aluno, responsável, coordenação e SuperADM.

### MFA

- [ ] MFA obrigatório para SuperADM;
- [ ] MFA obrigatório ou fortemente recomendado para coordenação;
- [ ] recovery codes guardados;
- [ ] processo de perda do segundo fator;
- [ ] nenhuma MFA obrigatória para criança no piloto sem análise de usabilidade.

### Critério de saída

Conhecer o código do aluno não basta para entrar; senha pessoal, reset, rotação, suspensão e revogação funcionam ponta a ponta.

---

## Etapa 8 - Segurança, RLS, integridade e Storage

**Período:** 10-22/09  
**Dependências:** Etapas 5-7  
**Objetivo:** provar isolamento real e fechar abusos same-tenant.

### RLS e permissões

- [ ] restringir colunas de `escolas` que coordenação pode editar;
- [ ] impedir coordenação de alterar plano, limites, status e comercial;
- [ ] revisar policies criadas após o bloqueio de suspensão;
- [ ] exigir `tenant_operacional()` em todo write aplicável;
- [ ] revisar `config_escola`, missões e tabelas legadas;
- [ ] revisar helpers `SECURITY DEFINER`;
- [ ] validar tenant dentro de helpers sensíveis;
- [ ] adicionar FKs compostas por `escola_id` nos vínculos sensíveis;
- [ ] garantir aluno e turma na mesma escola;
- [ ] garantir responsável e aluno no mesmo tenant;
- [ ] testar duas escolas com UUIDs conhecidos;
- [ ] testar escola suspensa e cancelada;
- [ ] testar SuperADM desativado;
- [ ] executar advisors do Supabase e revisar cada finding.

### Logs

- [ ] tornar logs de ações críticas obrigatórios/transacionais;
- [ ] manter eventos não críticos best-effort apenas quando documentado;
- [ ] remover credenciais, tokens, links e dados excessivos;
- [ ] definir retenção e anonimização;
- [ ] monitorar falha do ledger;
- [ ] proteger logs contra alteração comum da coordenação.

### Storage

- [ ] usar Storage próprio para logos;
- [ ] evitar URL externa arbitrária em produção;
- [ ] bucket privado ou regras RLS explícitas;
- [ ] restringir MIME, tamanho e dimensões;
- [ ] remover SVG/scriptável se não houver sanitização dedicada;
- [ ] testar upload cross-tenant;
- [ ] incluir objetos no plano de backup, pois backup do banco não restaura arquivos apagados.

### Dependências e pentest

- [ ] rodar `npm audit` nos dois workspaces;
- [ ] revisar CodeQL real, não apenas status do workflow;
- [ ] gerar SBOM;
- [ ] executar pentest autenticado entre duas escolas de teste;
- [ ] testar IDOR, abuso de papel, suspensão, exportação e uploads;
- [ ] não fazer teste destrutivo contra demo pública sem janela autorizada.

### Critério de saída

Uma conta de uma escola não consegue ler, escrever, vincular ou inferir dados de outra, e uma escola suspensa não continua operando por policy esquecida.

---

## Etapa 9 - Backups, restore, continuidade e observabilidade

**Período:** 08-23/09  
**Dependências:** Etapas 4-6  
**Objetivo:** transformar “tem backup” em recuperação comprovada.

### Backup e restore

- [ ] enquanto Free, executar `supabase db dump` regular e criptografado;
- [ ] armazenar cópia fora do Supabase;
- [ ] definir quem acessa a chave de criptografia;
- [ ] ao subir para Pro, confirmar backups diários;
- [ ] registrar retenção de sete dias do Pro;
- [ ] definir RPO do piloto;
- [ ] definir RTO do piloto;
- [ ] restaurar cópia completa em staging;
- [ ] cronometrar o restore;
- [ ] validar Auth, RLS, Functions, cron e Storage depois do restore;
- [ ] escrever runbook de desastre;
- [ ] escrever rollback do frontend;
- [ ] escrever rollback das Edge Functions;
- [ ] usar forward fix para migration irreversível;
- [ ] treinar segundo operador;
- [ ] repetir restore trimestralmente.

Fonte oficial: [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups).

### Observabilidade

- [ ] ligar error tracking no frontend;
- [ ] capturar erros das Edge Functions;
- [ ] evitar PII em eventos;
- [ ] monitorar tela pública;
- [ ] monitorar endpoint sintético autenticado;
- [ ] monitorar heartbeat do cron;
- [ ] monitorar e-mail aceito/entregue/bounced;
- [ ] monitorar falha de provisionamento;
- [ ] monitorar geração de meta;
- [ ] monitorar crescimento do banco e egress;
- [ ] criar alerta de gasto;
- [ ] definir canal de incidente;
- [ ] definir responsáveis e escalonamento;
- [ ] criar dashboard de saúde por escola;
- [ ] criar template de página/status de indisponibilidade.

### Critério de saída

Um operador detecta falha antes da escola, restaura o serviço em tempo medido e consegue explicar quanto dado pode ser perdido.

---

## Etapa 10 - Testes, CI/CD, carga, mobile e UX institucional

**Período:** 12-25/09  
**Dependências:** Etapas 6-9  
**Objetivo:** transformar a main em um gate de release completo.

### CI/CD

- [ ] configurar secrets E2E para ambiente isolado;
- [ ] executar Playwright em PR relevante;
- [ ] tornar E2E obrigatório antes de deploy de produção;
- [ ] tornar CodeQL obrigatório;
- [ ] limitar bypass administrativo a emergência documentada;
- [ ] usar `npm ci` também na Vercel;
- [ ] adicionar lint;
- [ ] adicionar typecheck gradual sem migração massiva imediata;
- [ ] medir cobertura de testes;
- [ ] adicionar axe/acessibilidade;
- [ ] publicar relatório de falha;
- [ ] implantar staging automaticamente;
- [ ] exigir aprovação manual para produção;
- [ ] registrar commit, migration e functions em cada release;
- [ ] testar rollback antes do piloto.

### Matriz E2E obrigatória

- [ ] aluno: primeiro acesso, troca, hoje, registro, meta e trilha;
- [ ] responsável: múltiplos filhos, leitura e revogação;
- [ ] coordenação: convite, login, aluno único, lote, turma e relatórios;
- [ ] SuperADM: escola, status, coordenação e isolamento;
- [ ] duas escolas simultâneas;
- [ ] escola suspensa;
- [ ] recuperação de coordenação;
- [ ] reset assistido de aluno;
- [ ] exportação e exclusão LGPD;
- [ ] e-mail real em caixa de teste;
- [ ] desktop, iPhone, Android e tablet;
- [ ] rede lenta e falha parcial.

### Carga e desempenho

- [ ] simular lote de 100 alunos;
- [ ] simular 100 logins/usuários simultâneos;
- [ ] simular virada semanal de todas as escolas;
- [ ] medir consultas lentas;
- [ ] revisar índices e FKs sem índice;
- [ ] definir orçamento de bundle e performance;
- [ ] confirmar que paginação suporta o piloto;
- [ ] adiar virtualização ampla até haver evidência.

### UX e confiança

- [ ] inputs mobile com pelo menos 16 px;
- [ ] corrigir zoom automático;
- [ ] conferir viewport;
- [ ] remover código de demo do login de produção;
- [ ] incluir Termos, Privacidade, operador e suporte;
- [ ] usar domínio próprio;
- [ ] diferenciar erro, vazio e indisponibilidade;
- [ ] corrigir contraste e textos pequenos;
- [ ] garantir ordenação por teclado;
- [ ] criar onboarding da coordenação;
- [ ] criar tour curto do aluno;
- [ ] validar experiência do responsável;
- [ ] preparar demo resetável.

### Critério de saída

Release de produção só ocorre quando quatro perfis, duas escolas, Auth, LGPD e mobile passam no ambiente candidato.

---

## Etapa 11 - LGPD, ECA Digital, contratos e propriedade intelectual

**Período:** 08-25/09  
**Dependências:** pode começar em paralelo; revisão profissional antes do G3  
**Objetivo:** tornar a operação com menores e a venda institucional defensáveis.

### Jurídico B2B

- [ ] contrato de design partner/piloto;
- [ ] contrato SaaS/licenciamento;
- [ ] DPA;
- [ ] SLA proporcional ao piloto;
- [ ] termos de suporte;
- [ ] critério de aceite;
- [ ] propriedade das customizações e do conteúdo;
- [ ] confidencialidade;
- [ ] encerramento, devolução e exclusão de dados;
- [ ] limites de responsabilidade e incidentes;
- [ ] autorização de case/depoimento separada.

### Privacidade e menores

- [ ] Termos de Uso;
- [ ] Política de Privacidade;
- [ ] aviso em linguagem adequada a crianças/adolescentes;
- [ ] Política de Retenção;
- [ ] matriz finalidade x dado x titular x base x acesso x retenção;
- [ ] definir escola controladora e Rumo operador quando aplicável;
- [ ] registrar melhor interesse do menor;
- [ ] coletar faixa etária com minimização;
- [ ] vincular responsável legal quando necessário;
- [ ] consentimento específico e destacado quando essa for a base escolhida;
- [ ] permitir retirada quando aplicável;
- [ ] registrar versão integral aceita;
- [ ] criar canal do titular;
- [ ] registrar solicitações e prazos;
- [ ] publicar suboperadores;
- [ ] documentar transferências internacionais;
- [ ] incorporar mecanismo contratual aplicável;
- [ ] produzir RIPD;
- [ ] testar exportação completa;
- [ ] incluir onboarding, progresso, XP, missões, níveis e schema atual;
- [ ] tornar exclusão resiliente à falha parcial;
- [ ] definir anonimização e retenção dos logs;
- [ ] criar playbook de incidente e simulação.

### ECA Digital

A Lei nº 15.211/2025 e o Decreto nº 12.880/2026 adicionam obrigações relevantes para serviços digitais acessados por crianças e adolescentes. O advogado deve validar a aplicação exata ao Rumo.

- [ ] privacidade e segurança por padrão;
- [ ] declaração/faixa etária proporcional ao risco;
- [ ] experiência adequada à idade;
- [ ] transparência para aluno e responsável;
- [ ] evitar padrões manipulativos e estímulo compulsivo na gamificação;
- [ ] não usar publicidade comportamental para menores;
- [ ] não transformar desempenho em perfil para finalidade incompatível;
- [ ] ferramentas e comunicações adequadas ao responsável;
- [ ] processo de denúncia, suporte e proteção;
- [ ] revisão da gamificação sob melhor interesse.

Fontes:

- [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/L13709compilado.htm)
- [ECA Digital - Lei 15.211/2025](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm)
- [Decreto 12.880/2026](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/d12880.htm)
- [ANPD - transferência internacional](https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-19-de-23-de-agosto-de-2024)
- [ANPD - RIPD](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/relatorio-de-impacto-a-protecao-de-dados-pessoais-ripd)

### Propriedade intelectual

- [ ] tornar repositório privado antes de comercialização operacional;
- [ ] entender que o histórico público não desaparece;
- [ ] adicionar aviso de código proprietário;
- [ ] identificar todos os contribuidores humanos;
- [ ] formalizar cessões, inclusive identidade Build/Mylena se aplicável;
- [ ] registrar uso de IA e revisão humana;
- [ ] gerar SBOM e notices;
- [ ] inventariar dependências MPL/permissivas;
- [ ] inventariar fontes, imagens, logos, editais, provas e questões;
- [ ] criar ledger com autor, origem, licença, evidência e versão;
- [ ] remover conteúdo sem origem comprovada;
- [ ] verificar marca e domínio;
- [ ] centralizar ativos na organização;
- [ ] criar data room;
- [ ] documentar custos, fornecedores, arquitetura e runbooks.

### Critério de saída

Nenhum menor entra sem instrumento aplicável, e nenhum comprador/escola recebe afirmação de titularidade que o data room não consiga provar.

---

## Etapa 12 - Motor de coortes e portfólio pedagógico

**Período:** 01-22/09  
**Dependências:** Etapa 1; publicação depende das Etapas 5 e 10  
**Objetivo:** vender ciclos 2027/2028 sem criar um catálogo frágil.

### Motor de coortes

- [ ] modelar data de início da coorte;
- [ ] modelar data-alvo da prova;
- [ ] guardar fuso;
- [ ] calcular semana por turma/aluno;
- [ ] permitir duas turmas do mesmo concurso em semanas diferentes;
- [ ] versionar trilha sem alterar coorte em andamento;
- [ ] permitir transição de edição 2026 para 2027/2028;
- [ ] remover dependência de calendário global do seed;
- [ ] testar virada por escola e por coorte;
- [ ] impedir mudança retroativa silenciosa.

### Portfólio decidido

| Trilha | Papel | Decisão |
|---|---|---|
| EsPCEx | ativo técnico mais maduro e demo principal | criar edição 2027/2028; default se não houver contrato escolhendo outra |
| Colégio Naval | ativo existente, porém raso | adaptar para coorte e revisar conteúdo antes de vender |
| Colégio Militar/CMRJ | expansão estratégica da temporada | pesquisa e pré-venda; completar quando demanda ou parceiro validar |
| CEFET/RJ 2027 | oportunidade de reta final | beta somente se houver distribuição imediata; não desviar o B2B |
| IFRJ/pré-técnico | família futura | monitorar edital oficial e demanda |
| EPCAR, ESA e EEAR | esqueletos | produzir sob demanda após gate comercial |

### Gate para nova trilha completa

Uma trilha sobe de esqueleto quando ocorrer ao menos um:

- LOI ou proposta assinada que dependa dela;
- cinco B2C pagantes do mesmo concurso;
- dez leads qualificados com dor confirmada;
- parceiro pedagógico responsável pela validação;
- demo decisiva já agendada.

### Fábrica editorial

- [ ] edital e retificações oficiais;
- [ ] estrutura da prova e critérios eliminatórios;
- [ ] matérias, pesos e recortes;
- [ ] assuntos e subassuntos;
- [ ] provas oficiais permitidas;
- [ ] incidência e nível de confiança;
- [ ] semanas, carga e atividades;
- [ ] missões e metas;
- [ ] fontes e direitos;
- [ ] estado rascunho, revisão, aprovado e publicado;
- [ ] autor/revisor;
- [ ] versão, data e próximo gatilho de atualização;
- [ ] validação humana por professor/escola;
- [ ] validador de conteúdo, build e testes verdes.

### Linguagem comercial honesta

- “simulado” auto-informado deve ser chamado de “registro de simulado”;
- não vender “banco de questões” sem enunciados, alternativas, resolução e direitos;
- recorrência deve indicar tamanho da amostra e confiança;
- conteúdo incompleto deve aparecer como “em preparação”;
- a escola pode fornecer ou validar metodologia e material.

### Fora do escopo até 01/12

- ENEM genérico;
- OAB;
- concursos públicos genéricos;
- policiais sem edital/cliente definido;
- aulas, vídeos e apostilas próprias;
- banco amplo de questões protegido;
- papel professor/tutor completo;
- seis trilhas feitas apenas para parecer grande.

### Critério de saída

Existe ao menos uma edição 2027/2028 validada por coorte, e nenhuma trilha parcial é vendida como completa.

---

## Etapa 13 - Prospecção, pré-venda B2B e beta B2C concierge

**Período:** 05/09-31/10  
**Dependências:** Etapa 3; beta depende do G3  
**Objetivo:** transformar descoberta em contrato e validar B2C sem criar outro produto.

### Cadência B2B

- [ ] cinco novas contas por dia útil;
- [ ] follow-up diário no CRM;
- [ ] pedir diagnóstico, não vender tudo por WhatsApp;
- [ ] perguntar quando inicia a turma 2027;
- [ ] mapear renovação, evasão e comunicação com responsáveis;
- [ ] perguntar como acompanham estudo fora da aula;
- [ ] medir tempo gasto pela coordenação;
- [ ] identificar concurso repetido;
- [ ] oferecer demo somente depois de conhecer a dor;
- [ ] enviar proposta em até 24 horas;
- [ ] registrar motivo de ganho/perda;
- [ ] cobrar próxima ação e data.

### Metas acumuladas

| Marco | Até 18/09 | Até 05/10 | Até 01/12 |
|---|---:|---:|---:|
| contas qualificadas | 25 | 50 | 75 |
| conversas reais | 5 | 10 | 20 |
| demos | 3 agendadas | 5 realizadas | 8-10 |
| propostas | 1 | 3 | 5 |
| LOI/contrato | 0-1 | 1 | 1-2 |

### Oferta de piloto

**Design partner inicial:**

- uma escola;
- um concurso;
- uma turma de 30-80 alunos;
- oito semanas, podendo chegar a 12;
- implantação e suporte concierge;
- conteúdo validado em conjunto;
- reunião semanal;
- relatório final e autorização de case separada;
- R$ 10 mil-R$ 15 mil como faixa de entrada negociável;
- pagamento por marcos, com entrada suficiente para financiar produção.

**Piloto padrão após primeira validação:** R$ 18 mil-R$ 25 mil, conforme implantação, turma, conteúdo e suporte.

Esses valores são hipóteses comerciais, não preço garantido. Desconto deve comprar algo: acesso ao decisor, validação pedagógica, agilidade, depoimento ou case.

### Beta B2C concierge

**Estrutura:**

- tenant “Triliva - Alunos Individuais”;
- até 30 vagas;
- R$ 29,90/mês como preço fundador sugerido;
- aquisição por indicação e WhatsApp;
- cobrança recorrente manual por Mercado Pago ou equivalente;
- cadastro somente após pagamento;
- sem checkout próprio;
- sem tráfego pago;
- turmas separadas por concurso/coorte;
- responsável como pagador/representante quando aplicável.

### Fluxo B2C

- [ ] captar interessado;
- [ ] explicar beta e limites;
- [ ] registrar aluno, responsável e concurso;
- [ ] gerar cobrança recorrente;
- [ ] confirmar pagamento;
- [ ] criar conta e turma;
- [ ] entregar código + senha temporária por canais separados quando possível;
- [ ] forçar senha pessoal;
- [ ] fazer onboarding;
- [ ] acompanhar primeira semana;
- [ ] registrar atividade, suporte e feedback;
- [ ] suspender inadimplente sem apagar histórico;
- [ ] registrar renovação, cancelamento e indicação.

### Gate para checkout e tráfego

- pelo menos 20 pagantes;
- retenção de segundo mês relevante;
- maioria ativa semanalmente;
- indicações espontâneas;
- suporte administrável;
- conteúdo sustentável;
- produção e documentos preparados.

### Critério de saída

Há ao menos uma negociação B2B concreta e, se o G3 permitir, dados reais de uso e pagamento B2C sem vazamento ou produto paralelo.

---

## Etapa 14 - Onboarding, piloto, métricas, conversão e data room

**Período:** 26/09-01/12; piloto pode continuar após a data  
**Dependências:** G2 e G3  
**Objetivo:** produzir receita e evidência institucional.

### Antes do primeiro aluno

- [ ] contrato assinado;
- [ ] entrada recebida;
- [ ] ambiente G3 aprovado;
- [ ] turma e trilha validadas;
- [ ] lista de alunos validada;
- [ ] coordenação treinada;
- [ ] responsáveis informados;
- [ ] suporte e incidente comunicados;
- [ ] data de início e critérios de sucesso assinados.

### Onboarding

- [ ] criar escola pelo backoffice;
- [ ] configurar identidade e contatos;
- [ ] provisionar coordenação;
- [ ] testar convite e primeiro login;
- [ ] importar CSV validado;
- [ ] tratar falhas por linha;
- [ ] vincular responsáveis;
- [ ] atribuir coorte/trilha;
- [ ] validar uma conta de cada perfil;
- [ ] liberar em ondas pequenas;
- [ ] acompanhar diariamente na primeira semana;
- [ ] manter reunião semanal.

### Métricas do piloto

**Ativação:**

- contas provisionadas;
- primeiro login em 24/72 horas;
- primeiro registro de estudo;
- primeira meta acessada/concluída;
- responsável ativado.

**Engajamento:**

- WAU;
- sessões/semana;
- atividades e metas concluídas;
- tempo registrado;
- missões e progresso;
- alunos em risco.

**Valor institucional:**

- tempo economizado pela coordenação;
- alertas usados;
- contatos preventivos realizados;
- uso dos relatórios;
- satisfação da coordenação;
- intenção de renovação;
- aceitação dos responsáveis.

**Operação:**

- incidentes;
- falhas de login;
- tempo de resposta;
- tickets e minutos de suporte por aluno;
- custo de infraestrutura;
- idade do backup;
- restore mais recente.

### Conversão

- [ ] entregar relatório de meio do piloto;
- [ ] corrigir somente bloqueadores e itens de valor contratual;
- [ ] coletar depoimento autorizado;
- [ ] produzir case com números verificáveis;
- [ ] converter para licença recorrente;
- [ ] cobrar marcos restantes;
- [ ] usar o case na segunda onda comercial;
- [ ] enviar proposta à segunda e terceira escola;
- [ ] revisar preço, margem e suporte;
- [ ] decidir dezembro-março;
- [ ] atualizar data room.

### Critério de saída

Existe receita registrada, implantação demonstrável, decisão de renovação e evidência suficiente para repetir a venda.

---

# 8. Cronograma consolidado

| Período | Técnica/operacional | Comercial | Pedagógico/piloto |
|---|---|---|---|
| 01-07/09 | inventário, MFA, backup, backlog | CRM, 50 alvos, materiais | decisão de portfólio e coortes |
| 08-14/09 | banco local/staging, e-mail, environments | primeira onda e reuniões | EsPCEx/CN por coorte, pesquisa CMRJ |
| 15-21/09 | Auth, RLS, observabilidade, restore | demos e propostas | trilha demandada e validação |
| 22-30/09 | E2E, mobile, pacote jurídico, gate G3 | LOI/contrato e follow-up | preparação do beta/piloto |
| 01-15/10 | produção paga após entrada, estabilidade | onboarding e segunda onda | início do piloto/B2C |
| 16-31/10 | correções bloqueadoras | propostas 2 e 3 | métricas iniciais |
| 01-15/11 | suporte, incidentes, restore | conversão e case | relatório intermediário |
| 16/11-01/12 | somente risco/receita | cobrança, renovação e fechamento | case e plano dezembro-março |

## 8.1 Semana 1 - ações sem dinheiro

- [ ] inventariar os dois Supabase restaurados;
- [ ] MFA e recovery codes;
- [ ] dump do Rumo;
- [ ] rodar localmente migrations e testes;
- [ ] criar CRM;
- [ ] selecionar 50 contas;
- [ ] criar one-page, pitch e mensagens;
- [ ] iniciar cinco contatos por dia;
- [ ] escrever tarefas fechadas para Sonnet;
- [ ] reservar Opus para e-mail/Auth/RLS;
- [ ] não contratar Pro ainda;
- [ ] não cadastrar aluno real.

## 8.2 Gatilho de gasto

Assim que houver entrada contratual ou data real de go-live:

1. domínio e e-mail;
2. Supabase Pro produção em São Paulo;
3. Vercel Pro;
4. Resend/SMTP;
5. observabilidade;
6. staging pago somente se indispensável.

---

# 9. Rotina de execução e uso das IAs

## 9.1 Rotina semanal

### Segunda

- revisar caixa, pipeline, métricas e riscos;
- escolher três resultados da semana;
- preparar tarefas fechadas;
- confirmar reuniões.

### Terça a quinta

- um bloco de engenharia;
- um bloco diário de prospecção/follow-up;
- demos e entrevistas;
- atualização obrigatória do CRM.

### Sexta

- rodar testes e gates;
- revisar PRs;
- atualizar docs/evidências;
- enviar propostas e relatórios;
- decidir continuar, corrigir ou parar cada experimento.

### Regra diária

Nenhum dia útil termina sem uma ação comercial registrada.

## 9.2 Protocolo de IA

Cada tarefa para IA deve conter:

1. contexto mínimo;
2. um problema único;
3. arquivos permitidos;
4. arquivos proibidos;
5. regras de segurança;
6. migration/rollback quando aplicável;
7. critérios de aceite;
8. comandos de teste;
9. evidência esperada;
10. atualização documental.

### Separação de funções

- Sonnet implementa tarefas fechadas e de menor risco.
- Opus trabalha em Auth, RLS, migration, e-mail crítico e bugs persistentes.
- Fable valida o comportamento real no navegador.
- GPT-5.6 Sol revisa a etapa inteira contra este plano.
- a mesma IA que implementa não deve ser a única aprovação de mudança crítica.
- revisão textual não substitui teste local, CI ou E2E.

---

# 10. Backlog priorizado

## P0 comercial - fazer já

1. CRM e 50 alvos.
2. one-page, deck e roteiro.
3. cinco contatos/dia.
4. diagnóstico e demanda de trilha.
5. proposta/LOI condicionada.

## P1 - bloqueia aluno real

1. inventário e produção separada.
2. envio e recuperação real da coordenação.
3. código diferente da senha.
4. geração de meta confiável.
5. migrations/Functions/cron comprovados.
6. backup e restore.
7. E2E dos quatro perfis.
8. isolamento/suspensão.
9. observabilidade e alerta.
10. pacote LGPD/ECA Digital/jurídico.
11. trilha 2027/2028 por coorte.

## P2 - antes de 100 alunos/segunda escola

1. FKs compostas por tenant.
2. logs críticos transacionais.
3. Storage endurecido.
4. carga 100/300.
5. MFA coordenação e sessão.
6. cobertura/axe/lint/typecheck.
7. runbooks e segundo operador.
8. onboarding repetível.

## P3 - depois de validação

1. papel professor/tutor.
2. self-service.
3. checkout e billing integrado.
4. tráfego pago.
5. white-label avançado por domínio.
6. TypeScript amplo.
7. virtualização e refatorações grandes.
8. mais concursos sem cliente.

---

# 11. Métricas de comando

## Comercial B2B

- contas qualificadas;
- contatos novos;
- taxa de resposta;
- reuniões;
- demos;
- propostas;
- valor proposto;
- valor contratado;
- valor recebido;
- dias sem próxima ação;
- motivo de perda;
- trilha mais pedida.

## B2C

- interessados;
- cobranças geradas;
- pagamentos;
- ativações;
- primeiro estudo;
- WAU;
- renovação;
- atraso;
- cancelamento;
- suporte por aluno;
- indicações.

## Produto/operação

- deploys verdes;
- incidentes;
- tempo de detecção;
- tempo de recuperação;
- último backup;
- último restore;
- falhas de login;
- falhas de e-mail;
- falhas de meta;
- versão de trilha;
- solicitações de titulares;
- uso/custo do banco.

## Indicadores para continuar ou parar

Continuar B2C se houver uso semanal, renovação e suporte sustentável. Parar ou reduzir se o preço não cobrir suporte, se o conteúdo não se sustentar ou se desviar vendas B2B.

Continuar uma trilha se houver demanda e validação humana. Não continuar apenas porque foi rápida de gerar com IA.

---

# 12. Riscos principais e resposta

| Risco | Probabilidade | Impacto | Resposta |
|---|---:|---:|---|
| gastar antes de vender | alta | alto | Free/local até entrada; gatilho de gasto |
| vendas demorarem além de dezembro | alta | alto | prospecção diária, oferta estreita, entrada por marcos |
| IA gerar conteúdo incorreto | alta | alto | fonte oficial, professor, workflow editorial |
| aluno real entrar na demo | média | crítico | bloqueio de ambiente e checklist G3 |
| código continuar sendo senha | alta sem correção | alto | Etapa 7 antes do G3 |
| e-mail continuar falso positivo | alta sem correção | alto | envio real + webhook + E2E |
| vazamento cross-tenant | baixa/média | crítico | RLS, FKs, pentest autenticado |
| perda de dados | média | crítico | dump, Pro, restore e runbook |
| incidente com menor | média | crítico | LGPD/ECA Digital, minimização, segurança por padrão |
| catálogo consumir o prazo | alta | alto | gate comercial para trilha |
| suporte consumir o fundador | alta | alto | limite 30 B2C/80 piloto, runbook, métricas |
| repositório público reduzir IP | já ocorrido | médio/alto | privatizar, cessões, SBOM e data room |
| dependência de uma pessoa | alta | alto | segundo operador e documentação |
| meta de R$ 50 mil forçar promessa indevida | alta | crítico | separar contratação de go-live e não vender risco oculto |

---

# 13. O que não fazer até 1º de dezembro

- não criar produto B2C separado;
- não criar checkout antes de retenção;
- não investir em tráfego pago antes do G5;
- não migrar para Firebase ou Aiven;
- não construir backend próprio sem equipe;
- não fazer TypeScript em massa;
- não refatorar por estética;
- não criar seis concursos;
- não prometer banco de questões;
- não hospedar vídeo/aula própria;
- não criar professor/tutor completo;
- não fazer customização gratuita sem relação com contrato;
- não colocar produção paga antes do gatilho financeiro;
- não usar Vercel Hobby para operação comercial;
- não usar projeto demo para aluno real;
- não vender o ativo inteiro como “100% limpo” sem data room;
- não tratar revisão de IA como aprovação final.

---

# 14. Checklist final de autorização do piloto

Nenhum aluno real entra até todos os itens obrigatórios estarem “SIM”.

## Infraestrutura

- [ ] produção Supabase Pro separada;
- [ ] produção em `sa-east-1`;
- [ ] demo e staging sem dados reais;
- [ ] Vercel/hospedagem em plano comercial;
- [ ] domínio e HTTPS;
- [ ] ownership oficial e MFA;
- [ ] orçamento e alertas;
- [ ] segundo operador.

## Banco e backend

- [ ] migrations 0001-0044 + novas 0045+ aplicadas;
- [ ] history local, staging e prod reconciliada;
- [ ] seeds globais corretos;
- [ ] demo seeds ausentes;
- [ ] seis Edge Functions implantadas;
- [ ] CORS e redirects corretos;
- [ ] cron e heartbeat ativos;
- [ ] geração de meta confiável;
- [ ] suspensão/reativação testada.

## Auth

- [ ] coordenação recebe e-mail real;
- [ ] primeiro acesso e recuperação aprovados;
- [ ] código do aluno não é senha;
- [ ] troca obrigatória no primeiro acesso;
- [ ] reset assistido funciona;
- [ ] rate limit e bloqueio ativos;
- [ ] rotação e revogação testadas;
- [ ] MFA SuperADM.

## Segurança e QA

- [ ] cross-tenant aprovado;
- [ ] policies de suspensão aprovadas;
- [ ] colunas de escola restritas;
- [ ] FKs/vínculos críticos validados;
- [ ] logs críticos confiáveis;
- [ ] Storage endurecido;
- [ ] `npm audit` e CodeQL revisados;
- [ ] E2E de quatro perfis verde;
- [ ] desktop, iPhone, Android e tablet verdes;
- [ ] lote/carga do piloto aprovado;
- [ ] rollback testado.

## Continuidade

- [ ] backup automático confirmado;
- [ ] dump externo criptografado;
- [ ] restore executado e cronometrado;
- [ ] RPO/RTO definidos;
- [ ] alertas ativos;
- [ ] runbook e incidente simulados.

## Legal e pedagógico

- [ ] contrato do piloto;
- [ ] DPA;
- [ ] Termos e Privacidade;
- [ ] matriz de tratamento e retenção;
- [ ] fluxo de responsável/menor;
- [ ] RIPD e revisão jurídica;
- [ ] exportação/exclusão completas;
- [ ] trilha 2027/2028 por coorte;
- [ ] validação humana da escola/professor;
- [ ] fontes e direitos registrados;
- [ ] suporte e aceite assinados.

## Comercial

- [ ] entrada recebida;
- [ ] turma 30-80 alunos;
- [ ] oito a 12 semanas;
- [ ] critérios de sucesso;
- [ ] reuniões e relatórios definidos;
- [ ] cancelamento e limites definidos;
- [ ] autorização de case separada.

---

# 15. Definição de pronto em 1º de dezembro

O ciclo será considerado bem executado se:

- o Rumo tiver ao menos um contrato/LOI ou receita B2B;
- houver produção aprovada ou data de go-live financiada;
- o beta B2C tiver produzido aprendizado sem desviar o B2B;
- uma trilha 2027/2028 estiver versionada por coorte;
- nenhuma escola tiver sido exposta a promessa enganosa;
- os maiores riscos técnicos tiverem evidência de correção;
- o projeto tiver pipeline, case em formação e próxima venda clara.

Se não houver contrato até 1º de dezembro, a decisão não será “programar mais”. Será analisar:

1. quantidade e qualidade das conversas;
2. taxa de resposta;
3. dor e objeções;
4. preço e oferta;
5. uso do beta;
6. qual trilha gerou interesse;
7. se o problema é distribuição, confiança ou produto.

---

# 16. Referências internas e externas

## Internas

- `docs/00-indices/08-plano-execucao-set-dez-2026.md` - plano integrado anterior;
- `docs/operacao/migracao-producao-dedicada.md` - preparação da produção limpa;
- `docs/auditoria/ped2/inventario-conteudo-concursos.md` - maturidade pedagógica;
- `docs/conteudo/fabrica-trilhas-concursos.md` - pipeline editorial;
- `docs/00-indices/05-camadas-faltantes.md` - lacunas técnicas;
- `docs/00-indices/07-pendencias-para-piloto-real.md` - pendências históricas;
- auditoria independente de 25/08/2026.

## Externas

- [Supabase - billing](https://supabase.com/docs/guides/platform/billing-on-supabase)
- [Supabase - backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase - regiões](https://supabase.com/docs/guides/platform/regions)
- [Supabase - migração entre projetos](https://supabase.com/docs/guides/platform/migrating-within-supabase)
- [Supabase - generateLink](https://supabase.com/docs/reference/javascript/auth-admin-generatelink)
- [Vercel - Hobby](https://vercel.com/docs/plans/hobby)
- [Vercel - Pro](https://vercel.com/docs/plans/pro-plan)
- [Resend - preços](https://resend.com/pricing)
- [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/L13709compilado.htm)
- [ECA Digital](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm)
- [Regulamentação do ECA Digital](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/d12880.htm)
- [ANPD - transferência internacional](https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-19-de-23-de-agosto-de-2024)
- [ANPD - RIPD](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/relatorio-de-impacto-a-protecao-de-dados-pessoais-ripd)
- [CEFET/RJ - ingresso 2027](https://www.cefet-rj.br/index.php/noticias/10529-cefet-rj-oferece-1-024-vagas-para-cursos-tecnicos-integrados-ao-ensino-medio-em-2027)
- [Colégios Militares - processo seletivo](https://www.cmb.eb.mil.br/pt/processo-seletivo)

---

## Veredito final

O Triliva não precisa esperar ficar “100% pronto” para ser vendido, mas precisa estar 100% honesto sobre o que está sendo vendido.

A ordem correta é:

1. prospectar agora;
2. fechar uma escola e receber entrada condicionada;
3. usar essa entrada para produção profissional;
4. corrigir Auth, e-mail, meta, RLS, restore e compliance;
5. implantar uma trilha 2027/2028 escolhida pela demanda;
6. colocar uma turma pequena;
7. medir valor e converter;
8. repetir antes de ampliar catálogo ou buscar venda integral.

O ativo principal não será ter muitos concursos gerados rapidamente por IA. Será demonstrar que o Rumo transforma a metodologia da escola em uma trilha versionada, segura, acompanhável e capaz de gerar resultado operacional real.

