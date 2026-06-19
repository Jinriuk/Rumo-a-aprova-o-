# Operação (Fase A — segurança, operação e prontidão técnica)

> Pergunta que este documento responde: **"Se uma escola real começar a
> usar amanhã, conseguimos operar, corrigir, voltar atrás, entender erros
> e evitar falhas graves?"**

## 1. Erros — o que o usuário vê, o que o operador vê

- **Usuário**: nunca vê mensagem técnica (stack trace, erro do Postgres,
  erro do Supabase). Toda tela traduz para uma de quatro mensagens
  humanas (`app/src/shared/lib/erros.js`, `mensagemAmigavel()`):
  - "Não conseguimos carregar esses dados. Atualize a página ou tente novamente."
  - "Não foi possível salvar agora. Tente novamente em alguns instantes."
  - "Não foi possível concluir a ação. Tente novamente."
  - "Sua conexão parece instável. Verifique e tente de novo." (erros de rede)
  - O login mantém suas duas mensagens específicas e já amigáveis
    ("Código não reconhecido...", "E-mail ou senha incorretos.").
- **Tela em branco / exceção não tratada no render**: cai na fronteira de
  erro (`app/src/shared/ui/ErroFronteira.jsx`) — mostra "Algo deu errado
  nesta tela" com botão de atualizar, nunca uma tela branca morta.
- **Operador/desenvolvedor**: o detalhe técnico completo vai para o
  `console.error` (sempre) e, se `VITE_ERROR_REPORT_URL` estiver
  configurada, também para o serviço de monitoramento externo
  (`app/src/shared/lib/observabilidade.js`) — best-effort, nunca bloqueia
  a aplicação se o envio falhar. **Sem essa variável configurada o
  sistema funciona exatamente igual**, só sem o envio externo (Fase A.4:
  nenhuma dependência obrigatória de ferramenta externa).
- **Edge Functions** (`provisionar-aluno`, `gerar-meta`, `lgpd-titular`,
  `virar-semana`): cada uma loga o erro técnico completo no servidor
  (`console.error`, visível em Dashboard → Edge Functions → Logs) e
  devolve ao cliente só `{ error: "<mensagem curta>" }` — sem detalhe
  técnico no corpo da resposta HTTP (corrigido na Fase A: antes
  devolviam também um campo `detail` com a exceção crua).

## 2. Observabilidade mínima

- **Captura global no front**: `window.onerror` e `unhandledrejection`
  instalados em `main.jsx` (`instalarCapturaGlobal()`) — qualquer erro
  não tratado é capturado, nunca silencioso.
- **Health check**: não há endpoint dedicado — usar a própria tela de
  login como sinal mínimo (carrega = front + Supabase respondem) e
  `GET <VITE_SUPABASE_URL>/rest/v1/` para o banco. Para monitoramento
  contínuo, ver `docs/operacao/monitoramento-backup.md` (Advisors, Reports do
  Supabase).
- **Para ativar relato externo de erro** (Sentry ou equivalente): apontar
  `VITE_ERROR_REPORT_URL` para o endpoint do serviço — `observabilidade.js`
  já faz um `POST` best-effort com `{ mensagem, pilha, origem, em, rota }`.
  Nunca inclui dado de aluno/responsável.

## 3. Travas contra duplo envio

Toda ação sensível (salvar, criar, excluir, gerar credencial) já passa por
um estado de ocupado (`ocupado`/`busy`/`trabalhando`) que desabilita o
botão durante o envio — confirmado em: `Registrar`, `MetaSemana`,
`CadastroAlunos` (turma e alunos), `ListaAlunos` (todas as ações em lote),
`Marca`, `AreaAdmin` (criar escola). **Risco residual conhecido**: o
renomear/excluir de turma em `AreaEscola.jsx` usa `window.prompt`/
`window.confirm` sem uma trava de "ocupado" explícita — risco baixo (ação
pouco frequente, idempotente o suficiente: clicar duas vezes só dispara
duas updates iguais ou um erro de "já excluída"), registrado como risco
residual P3 no relatório final em vez de forçar uma refatoração do padrão
`prompt`/`confirm` nesta fase.

## 4. Login por código — postura de segurança (Fase A.3)

- O código de acesso (aluno/responsável) tem ~55 bits de entropia (12
  bytes aleatórios de `crypto.getRandomValues`, alfabeto de 32 caracteres
  sem 0/O/1/I/L, formato `XXXX-XXXX-XXXX`) — gerado em
  `supabase/functions/provisionar-aluno/index.ts`.
- O código funciona como **senha literal** no Supabase Auth
  (`entrarComCodigo`, em `data/index.js`) — decisão de produto já tomada
  em fases anteriores (sem cadastro aberto, credencial entregue pela
  escola).
- **Rate limiting de tentativas de login**: não há rate limit customizado
  no código deste projeto. A proteção hoje é a do **próprio Supabase
  Auth** (limite de requisições por IP/endpoint, configurável em
  Dashboard → Auth → Rate Limits) — não foi enfraquecida nem
  contornada, e não foi reimplementada por fora dela (instrução explícita
  desta fase: não fazer gambiarra, não enfraquecer o Supabase Auth).
- **Reemissão/rotação de credencial**: já existe — "Regerar credencial"
  na lista de alunos invalida o código anterior e gera um novo.
- **Pendência documentada (não resolvida nesta fase, por exigir decisão
  de infraestrutura, não só código)**: confirmar no painel do Supabase,
  antes do piloto, que os limites de rate limit do Auth estão em valores
  adequados ao volume esperado (nem tão baixos que bloqueiem uso legítimo,
  nem tão altos que permitam força bruta prática contra ~55 bits de
  entropia). Se o piloto mostrar abuso real, a próxima ação recomendada é
  um rate limit adicional por IP na própria Edge Function de provisão —
  não no fluxo de login (que já é Auth puro do Supabase).

## 5. Logs de ações sensíveis (Fase A.8)

| Tabela | O que registra | Quem grava | Quem lê |
|---|---|---|---|
| `logs_acesso` | leitura de dado de aluno específico (LGPD) + provisão de credencial (`provisionou-aluno`/`provisionou-responsavel`) | front (leitura) e Edge Function `provisionar-aluno` | coordenação da própria escola |
| `logs_coordenacao` (novo) | turma criada/renomeada/excluída, alunos importados em lote, marca alterada | `data/index.js` (`registrarLogCoordenacao`, best-effort) | coordenação da própria escola |
| `admin_logs` | ações do operador no backoffice (criar escola) | RPC `backoffice_criar_escola` (servidor) | super_admin |

Todo log é **best-effort**: uma falha ao gravar o log nunca impede a ação
principal (mesmo padrão já usado em `registrarAcesso`) — só fica um
`console.error` avisando que o log não foi salvo.

## 6. RLS — confirmação (Fase A.7)

Revisão desta fase não encontrou política que precisasse ser enfraquecida
nem `using (true)` em escrita. Invariantes confirmados (e cobertos por
`tests/isolamento.test.mjs`):

- Isolamento por `escola_id` em toda tabela com dado de escola, incluindo
  a nova `logs_coordenacao`.
- Aluno só escreve o próprio registro/meta; coordenação não escreve
  progresso pedagógico do aluno (só lê).
- Tabelas de auditoria (`logs_acesso`, `logs_coordenacao`, `admin_logs`)
  são *insert-only* via API: ninguém edita ou apaga log pela aplicação.
- `anon` (sem login) não acessa nenhuma tabela.

Nenhuma mudança de RLS foi necessária nesta fase — só a criação da nova
tabela `logs_coordenacao` com a mesma forma de isolamento já usada em
`logs_acesso`.

## 7. Suporte e canal de emergência

Ainda não há um canal de suporte formalizado para o piloto (item ⚠ aberto
em `docs/operacao/checklist-go-live-piloto.md`). Definir antes do primeiro acesso
real: quem responde dúvida da escola, em qual canal, e qual é o
procedimento de emergência (ex.: suspender acesso de uma escola — ver
`docs/operacao/rollback.md`, Cenário 4).
