# Documento 5 — Estrutura de Pastas e Organização do Código

Como o código se divide em pastas. Deriva direto dos módulos do Documento 4 (seção 3). Não é código: é o esqueleto de diretórios, com a função de cada pasta. Lê o Doc 4 antes, porque a estrutura só faz sentido sabendo o que cada módulo é.

-----

## Decisões que a estrutura assume (vindas do Doc 4)

1. **SPA em Vite, falando direto com o Supabase.** Sem backend Node próprio. O Supabase é o backend (banco, auth, isolamento por RLS). O código de servidor que precisa de privilégio elevado vive nas Edge Functions do Supabase, não num servidor à parte.
1. **Monorepo.** Front, banco e documentação no mesmo repositório, em pastas separadas. Com 5 a 6 escolas, separar em vários repositórios é complexidade sem retorno.
1. **Organização por módulo de negócio, não por tipo de arquivo.** As pastas seguem os contextos do Doc 4 (identidade, escola, pessoas, conteúdo, motor, desempenho, consentimento). NÃO se cai no padrão `components/`, `utils/`, `helpers/` tudo plano, que é exatamente no que o `App.jsx` monolítico degenera e o que não aguenta papéis e telas múltiplas.

-----

## As duas regras que esta estrutura existe pra proteger

- **Seam de dados único.** Todo acesso a dado passa por uma camada só (`shared/data`). É ali, e só ali, que se troca localStorage por Supabase. Nenhuma tela fala com o banco direto.
- **Privilégio elevado só no servidor.** Tudo que precisa de poder além do usuário logado (gerar meta da semana, virar semana agendada, provisionar credencial de aluno, exportar/excluir dado por pedido LGPD) vive em `supabase/functions`. Nunca no front. Se isso furar, o isolamento entre escolas deixa de existir.

-----

## Raiz do repositório

```
sistema-estudos/
├── app/              Front-end (React + Vite). A aplicação que escola, aluno e responsável usam.
├── supabase/         Banco, isolamento (RLS), código de servidor (Edge Functions), seed.
├── docs/             Os documentos de handoff (01 a 05). Onde este arquivo vive.
├── .env.example      Modelo das variáveis de ambiente. NUNCA a chave de serviço de verdade aqui.
└── README.md         Como rodar, com aviso explícito: chave de serviço só no servidor.
```

-----

## Front-end: `app/`

```
app/
├── src/
│   ├── modules/                  Um diretório por contexto do Doc 4. O coração da organização.
│   │   ├── identidade/           Login, papéis, proteção de rota por papel. Fim do PIN.
│   │   ├── escola/               Dados da escola (tenant) e camada de marca (white-label).
│   │   ├── pessoas/              Turma, aluno, responsável: cadastro e vínculos.
│   │   ├── conteudo/             Consumo da trilha/plano (só leitura no front; o conteúdo é seu).
│   │   ├── motor/                Meta semanal, registro de estudo, virada por data, nota projetada.
│   │   ├── desempenho/           Gráficos e indicadores (reaproveita o recharts atual).
│   │   └── consentimento/        Telas de LGPD: termo, registro de consentimento, pedidos do titular.
│   │
│   ├── routes/                   Composição de telas por PAPEL. Puxa dos módulos acima.
│   │   ├── escola/               Área da coordenação: lista de alunos, turmas, cadastro.
│   │   ├── aluno/                Área do aluno: meta atual, registro, desempenho próprio.
│   │   ├── responsavel/          Área do responsável: leitura do aluno vinculado.
│   │   └── publico/              Login e telas sem sessão.
│   │
│   ├── shared/                   O que é de todos os módulos.
│   │   ├── data/                 O SEAM. Reescrita do antigo objeto db. Único ponto que fala com o Supabase.
│   │   ├── ui/                   Sistema de design: componentes, navy #0A1622, dourado #CDA349, Fraunces/Archivo.
│   │   ├── branding/             Aplica a marca da escola por cima do design fixo (white-label leve).
│   │   ├── hooks/                Lógica reutilizável de tela (sessão, papel atual, escola atual).
│   │   └── regras/               Regras de negócio puras: virada de semana, nota projetada (mat+ing)×2,5.
│   │
│   ├── lib/
│   │   └── supabase.js           Configuração do cliente Supabase. Só a chave pública (anon). NUNCA a de serviço.
│   │
│   ├── App.jsx                   Casca: roteamento por papel e sessão. Magro, não mais o monólito de hoje.
│   └── main.jsx                  Ponto de entrada do Vite.
│
├── index.html
├── package.json
└── vite.config.js
```

Notas:

- **`shared/data` é o herdeiro do `db` atual.** Foi o melhor acerto da versão de hoje. A migração de localStorage para Supabase acontece dentro daqui, sem espalhar mudança pelas telas.
- **`shared/regras` guarda o que NÃO pode mudar:** virada por data local e nota projetada. Isolado de propósito, pra preservar e testar.
- **`routes/` separa por papel; `modules/` separa por domínio.** Um aluno e a coordenação veem telas diferentes (routes), mas o conceito de “meta” é o mesmo (module). Essa separação é o que impede o retorno do monólito.

-----

## Back-end: `supabase/`

```
supabase/
├── migrations/        Evolução do banco, versionada. Toda tabela nasce com dono (tenant_id).
│                      É aqui que vivem as políticas de isolamento (RLS): a regra que impede
│                      uma escola de ver dado de outra, no nível do banco.
│
├── functions/         Edge Functions. O código de servidor com privilégio elevado.
│   ├── gerar-meta/         Monta a próxima meta do aluno a partir da trilha. Roda no servidor.
│   ├── virar-semana/       Rotina agendada que vira a semana por data. NÃO depende do aluno abrir o app.
│   ├── provisionar-aluno/  Gera a credencial do aluno que a escola distribui (aluno é menor).
│   └── lgpd-titular/       Exporta ou apaga o dado de um aluno quando a escola pede.
│
├── seed/              Dados iniciais: a escola demo e a trilha do Colégio Naval já existente.
│
└── config.toml        Configuração do projeto Supabase (região: São Paulo, por causa da LGPD).
```

Notas:

- **A RLS mora nas migrations**, junto da criação das tabelas. Isolamento é estrutura de banco, não disciplina de quem escreve consulta.
- **`functions/` é o cofre.** Tudo aqui roda com privilégio que o front não tem e não pode ter. É a aplicação concreta da regra número 2 lá de cima.
- **`virar-semana` agendada no servidor** resolve o furo de a virada depender de o aluno abrir o app.

-----

## O que NÃO se cria agora (Fase 2, fica reservado)

Estas pastas têm lugar reservado na arquitetura, mas não se criam no build inicial. Criá-las agora é construir Fase 2 antes de uma escola pagar, o erro que o Doc 4 (seção 12, item 8) manda evitar.

```
modules/reforcos/      Revisão espaçada. Fase 2.
modules/calibracao/    Ajuste da próxima meta pelo desempenho. Fase 2.
modules/professor/     Painel e leitura de turma do professor. Fase 2.
modules/nivelamento/   Base / intermediário / avançado. Fase 2.
modules/comparativo/   Ranking, jornada social. Fase 3.
```

Deixar reservado é diferente de construir. O nome existe no plano pra ninguém alocar essas funções em outro lugar errado quando a hora chegar. A pasta, não.

-----

## Regra de ouro de manutenção

Toda nova função entra dentro do módulo dela. Quando você (ou outra IA, ou um dev contratado) for adicionar algo, a primeira pergunta é “de qual módulo do Doc 4 isso é?”. Se a resposta for “de nenhum”, ou é Fase 2 disfarçada, ou é um módulo novo que precisa ser decidido de propósito. O que não pode é virar mais um arquivo solto na raiz. Foi assim que o `App.jsx` de hoje cresceu até não caber em si mesmo.