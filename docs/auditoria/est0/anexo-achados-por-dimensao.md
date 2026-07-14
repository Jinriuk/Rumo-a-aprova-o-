# Anexo — Achados por dimensão (auditoria 2026-07-14)

> Gerado pela auditoria multi-agente de 14/07/2026 (24 auditores/céticos, ~1,9M tokens, 668 leituras de arquivo).
> Achados de severidade crítica foram verificados por 3 céticos independentes; altos por 1; a coluna **Verificação** registra o veredito.

---

## Segurança

**Veredito:** A postura de segurança é madura e acima da média para um produto pré-piloto: RLS habilitada em 100% das tabelas (46/46) com negar-por-padrão, anon sem privilégio de tabela, service_role confinada às Edge Functions, SECURITY DEFINER com search_path fixo e porteiros de tenant/super_admin, views security_invoker, comparação timing-safe e exclusão LGPD atômica. Não encontrei nenhum caminho de vazamento cross-tenant explorável no SQL atual. Os riscos reais são de escala/arquitetura conhecidos (login por código = senha permanente sem rate-limit próprio, paginação de 1000 no backoffice, ausência de MFA para super_admin) e de operação/residência de dados (projeto demo compartilhado, sem sa-east-1) — nada P0/P1 de isolamento, mas há itens que precisam fechar antes de vender a escola real com dado de menor.

### Estado atual

O isolamento multi-tenant é ancorado no JWT: escola_id e papel viajam em app_metadata (campo controlado pelo servidor, não gravável pelo usuário), lidos pelos helpers app.tenant_id()/app.papel()/app.usuario_id() (0001_fundacao.sql:22-40). Toda tabela tem RLS ligada (verificado: as 46 tabelas em create table batem exatamente com as 46 em enable row level security) e o grant em lote (0001:261) concede select/insert/update/delete apenas a authenticated e service_role — anon recebe só usage no schema (0001:257), logo não lê tabela alguma mesmo sem política. As políticas (0002_rls.sql, refinadas em 0027 e 0029) filtram sempre por escola_id = app.tenant_id() e ramificam por papel; aluno/responsável colapsam a identidade via app.meu_aluno_id()/app.sou_responsavel_de(), que em 0027 ganharam o gate app.tenant_operacional() — suspensão de escola vira bloqueio autoritativo no banco, não só rótulo. Conteúdo global (trilhas, provas, concursos, patentes) é select-only para authenticated; escrita só por service_role (BYPASSRLS). Funções SECURITY DEFINER expostas em public têm porteiro explícito: backoffice_* exigem app.eh_super_admin() (0019/0021/0025/0032), resumo_escola() filtra por tenant e foi revogada de public/anon (0017/0018), salvar_onboarding_aluno usa meu_aluno_id (só a própria linha). Os wrappers do motor e da LGPD (0005) são revogados de public/authenticated/anon e concedidos só a service_role. As 6 Edge Functions autenticam pelo token real (admin.auth.getUser), nunca por campo de formulário; a service_role só existe no ambiente Deno. CORS usa allowlist (não curinga) com reflexão de origem. Login: coordenação por e-mail+senha; aluno/responsável por código CSPRNG XXXX-XXXX-XXXX (alfabeto de 31 símbolos, ~7.6e17 de espaço) que É a senha do GoTrue (provisionar-aluno/index.ts:199-208; entrarComCodigo em data/index.js:51-59). O .env.production commitado contém só URL + anon key (públicas por design). vercel.json aplica HSTS, X-Frame-Options DENY, nosniff e CSP com script-src 'self'. CI tem CodeQL e Dependabot. LGPD (0003/0036 + lgpd-titular): exportação devolve dossiê completo e exclusão apaga Auth-primeiro-depois-banco com aborto seguro em falha parcial.

### Pontos fortes

- RLS habilitada em 100% das tabelas (46/46, cruzamento create table x enable row level security bateu sem sobra) com doutrina negar-por-padrão e anon sem nenhum grant de tabela (0001:257 vs 0001:261) — anon não lê dado mesmo sem política.
- Tenant e papel vêm de app_metadata do JWT (0001:32-40), campo definido pelo servidor no createUser (provisionar-aluno:207) e NÃO gravável pelo usuário — a fonte de autoridade é a correta no Supabase; user_metadata nunca é usado para authz.
- service_role confinada às Edge Functions (contexto.ts:10-14) e comprovadamente ausente do front e do repositório; o front usa só anon key.
- Todas as funções SECURITY DEFINER fixam search_path e têm porteiro: backoffice_* checam eh_super_admin (0019/0021/0025/0032), resumo_escola filtra tenant e foi revogada de anon/public (0017/0018), motor/LGPD só service_role (0005/0003/0036).
- Views são security_invoker (vw_recorrencia_medida 0018, vw_aluno_xp_total 0024:228, vw_concurso_qualidade 0034:77) — respeitam a RLS de quem consulta.
- Suspensão de escola é bloqueio real no banco (0027): app.tenant_operacional() colapsa meu_aluno_id/sou_responsavel_de, atingindo toda a matriz em um ponto por papel.
- Comparação de segredo em tempo constante sobre hash SHA-256 na virar-semana (virar-semana/index.ts:23-34) — único ponto de comparação de segredo do repo.
- Exclusão LGPD com ordem à prova de estado quebrado (Auth idempotente primeiro, aborta com banco intacto e log dedicado — lgpd-titular/index.ts:79-108).
- CORS por allowlist com Vary: Origin e sem Access-Control-Allow-Credentials (modelo Bearer) — não é curinga (cors.ts).
- CSP restritiva com script-src 'self' (sem unsafe-inline em script) + HSTS preload + X-Frame-Options DENY + frame-ancestors 'none' (vercel.json).
- CodeQL e Dependabot configurados no CI sem depender de secrets (codeql.yml, dependabot.yml).

### Achados

#### SEGURANCA-01 · 🟠 ALTA · backoffice-coordenador só lê a 1ª página de 1000 usuários do Auth — quebra a re-vinculação de coordenador em escala modesta

- **Descrição:** No modo 'criar', a checagem de coordenador existente faz admin.auth.admin.listUsers({ perPage: 1000 }) e um .find() sobre essa única página, sem paginação. Como TODO aluno e TODO responsável também são auth.users (criados em provisionar-aluno:203), o total global de contas do projeto passa de 1000 já com uma ou duas escolas reais (500 alunos + 500 responsáveis). A partir daí, um coordenador cujo e-mail caia fora da 1ª página é tratado como inexistente, cai no createUser e o GoTrue rejeita o e-mail duplicado, retornando erro_auth 500 'falha ao criar usuário' — mensagem enganosa que bloqueia re-vincular/corrigir um coordenador já existente.
- **Evidência:** supabase/functions/backoffice-coordenador/index.ts:168 `const { data: lista } = await admin.auth.admin.listUsers({ perPage: 1000 });` seguido de :170 `const existente = lista.users.find(...)` sem loop de paginação; contas de aluno/responsável são auth.users em provisionar-aluno/index.ts:203-209.
- **Impacto:** Fluxo operacional documentado (criar/re-vincular coordenador pelo backoffice) falha silenciosamente para escolas com histórico grande de contas; erro exibido não corresponde à causa. Não é vazamento (GoTrue barra duplicidade), mas bloqueia operação de piloto/venda.
- **Recomendação:** Substituir listUsers por busca direta por e-mail (GoTrue admin getUserByEmail / filtro server-side) ou paginar até esgotar; alternativamente resolver via tabela usuarios.email (já existe cache, 0032) antes de tocar o Auth.
- **Esforço estimado:** horas · **Verificação:** CONFIRMADO por céticos independentes
- **Nota do cético:** Evidência reproduzida integralmente: backoffice-coordenador/index.ts:168 chama admin.auth.admin.listUsers({ perPage: 1000 }) sem page e sem loop de paginação, e a linha 170 faz .find() apenas sobre essa primeira página. provisionar-aluno/index.ts:203-209 confirma que todo aluno e responsável é um auth.users real (e-mail sintético @codigo.acesso.local), logo o total global de contas passa de 1000 com 1-2 escolas reais. A partir daí, um coordenador antigo fora da página 1 (GoTrue ordena por created_at desc) é tratado como inexistente, cai no createUser, o GoTrue rejeita o e-mail duplicado e a fu […]

#### SEGURANCA-02 · 🟡 MÉDIA · Código de acesso do aluno é senha permanente reutilizável, sem rate-limit próprio nem rotação

- **Descrição:** O código XXXX-XXXX-XXXX é literalmente a senha do GoTrue (password = codigo) e o login vai direto ao GoTrue, sem proxy. A entropia (~7.6e17) inviabiliza brute-force online, mas: (a) quem vê o código uma vez (bilhete, foto, ombro) autentica para sempre; (b) não há rotação independente — girar o código exige recriar a conta; (c) o rate limit é só o padrão do GoTrue, sem trava de tentativas própria por IP+código. Para produto que lida com menor, o acoplamento código↔senha e a ausência de rotação são gaps arquiteturais reais, já desenhados mas não implementados (proxy login-codigo).
- **Evidência:** provisionar-aluno/index.ts:199-208 (`password: codigo`); app/src/shared/data/index.js:51-59 (entrarComCodigo chama signInWithPassword direto); pendência declarada em docs/00-indices/05-camadas-faltantes.md:96-97 e sec3/modelo-credencial-opaca.md §1-3.
- **Impacto:** Credencial vazada = acesso permanente sem revogação fácil; incidente com dado de menor. Mitigado por entropia e raio pequeno do piloto, mas não resolvido.
- **Recomendação:** Implementar o proxy login-codigo já desenhado: senha opaca ≠ código, código guardado só como hash, rate-limit por IP+código e rotação mantendo a identidade (checklist em modelo-credencial-opaca.md §4).
- **Esforço estimado:** semanas · **Verificação:** não exigida (severidade média/baixa)

#### SEGURANCA-03 · 🟡 MÉDIA · Sem MFA para super_admin (backoffice cross-tenant) nem para coordenação

- **Descrição:** O super_admin acessa RPCs que operam sobre TODAS as escolas (backoffice_dashboard, criar/editar/definir_status, revogar-responsavel cross-tenant) autenticando apenas com e-mail+senha, mesmo fluxo da coordenação (entrarComEmail). Não há segundo fator. Um vazamento da senha do super_admin dá acesso e escrita a todos os tenants; da coordenação, à escola inteira. O raio de dano do super_admin é a plataforma toda.
- **Evidência:** app/src/shared/data/index.js:61-65 (entrarComEmail, único fluxo de senha); backoffice-coordenador/index.ts:65-79 e revogar-responsavel/index.ts:62-75 resolvem super_admin só por token, sem exigência de 2FA; internal_admins sem coluna/gate de MFA (0019:17-23).
- **Impacto:** Comprometimento de uma única senha de super_admin = acesso cross-tenant a dado de menores de todas as escolas.
- **Recomendação:** Ativar MFA (TOTP) do Supabase Auth ao menos para super_admin e coordenação, e exigir AAL2 nas Edge Functions do backoffice (checar amr/aal no token).
- **Esforço estimado:** dias · **Verificação:** não exigida (severidade média/baixa)

#### SEGURANCA-04 · 🟡 MÉDIA · Força de senha da coordenação validada só no cliente; Leaked Password Protection inativo

- **Descrição:** A regra de força (mín. 8 + 2 categorias) roda em forcaSenha() na tela RedefinirSenha e trava só o botão; db.redefinirSenha chama supabase.auth.updateUser diretamente, então a política é contornável por quem chamar a API sem passar pela UI. A política server-side depende de configuração do projeto Supabase (não versionada no repo, não verificável aqui) e o Leaked Password Protection está inativo (recurso Pro, projeto Free).
- **Evidência:** app/src/routes/publico/RedefinirSenha.jsx:21-27 e :40 (forcaSenha só habilita o submit); submit chama db.redefinirSenha (updateUser) em :48; LPP inativo declarado em docs/00-indices/05-camadas-faltantes.md:98 e sec3/relatorio-sec3-endurecimentos.md §7.
- **Impacto:** Coordenador pode definir senha fraca/vazada por chamada direta à API; combinada com ausência de MFA, aumenta risco de tomada de conta.
- **Recomendação:** Configurar a política de senha no próprio Supabase Auth (não só no front) e ativar Leaked Password Protection ao migrar para Pro; versionar a config esperada.
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### SEGURANCA-05 · 🟡 MÉDIA · Projeto demo compartilhado e sem residência de dados no Brasil (sa-east-1)

- **Descrição:** O ambiente apontado no .env.production commitado é o projeto de demo (bdjkgrzfzoamchdpobbl), que também serve a vitrine pública e seeds de demonstração. Não há separação declarada entre demo e produção; onboardar uma escola real nesse projeto colocaria dado de menor no mesmo banco da vitrine. Além disso, a residência sa-east-1 (dado de menor no Brasil, relevante para LGPD) está pendente. São gaps técnicos de operação/conformidade, não bug de código.
- **Evidência:** app/.env.production:1 e :4 ('ambiente de demo (projeto bdjkgrzfzoamchdpobbl)'); pendências P1-2 (sa-east-1) e 5.7 (separação demo/real) em docs/00-indices/07-pendencias-para-piloto-real.md:31 e docs/00-indices/05-camadas-faltantes.md:156.
- **Impacto:** Mistura de dado real de menor com ambiente de vitrine público; possível não conformidade LGPD por residência fora do Brasil.
- **Recomendação:** Criar projeto de produção dedicado em sa-east-1, separado da demo/vitrine, com backup e retenção definidos antes de admitir dado real.
- **Esforço estimado:** dias · **Verificação:** não exigida (severidade média/baixa)

#### SEGURANCA-06 · ⚪ BAIXA · Regex de preview do CORS aceita qualquer subdomínio com o prefixo do projeto

- **Descrição:** A allowlist de CORS reflete qualquer origem que case /^https:\/\/rumo-a-aprova-o-[a-z0-9-]+\.vercel\.app$/. Como subdomínios vercel.app são reserváveis, uma origem hostil com esse prefixo poderia receber Access-Control-Allow-Origin. O impacto é limitado porque o modelo é Bearer (sem cookies/credenciais) — CORS aqui é defesa em profundidade, não a barreira de autorização; um atacante ainda precisaria de um token válido.
- **Evidência:** supabase/functions/_shared/cors.ts:36 (VERCEL_PREVIEW regex) e :53-54; réplica em provisionar-aluno/index.ts:34, revogar-responsavel:31, backoffice-coordenador:43.
- **Impacto:** Baixo: sem cookies não há CSRF; leitura de resposta exige token do próprio usuário. Reduz a margem de defesa em profundidade.
- **Recomendação:** Restringir o regex ao sufixo de scope real do projeto ou definir ALLOWED_ORIGINS explícito em produção, desligando o preview quando o domínio próprio entrar.
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### SEGURANCA-07 · ⚪ BAIXA · CSP permite img-src https: (qualquer host) e style-src 'unsafe-inline'

- **Descrição:** A CSP libera img-src 'self' data: blob: https: — imagens de qualquer host HTTPS — e style-src 'unsafe-inline'. script-src permanece 'self' (bom). O img-src https: abre um canal de baixa gravidade para exfiltração/tracking via URLs de imagem (ex.: conteúdo derivado de campos), e o unsafe-inline em estilos é aceitável dado o uso intenso de inline styles no app, mas amplia a superfície de injeção de CSS.
- **Evidência:** vercel.json: header Content-Security-Policy — `img-src 'self' data: blob: https:` e `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`.
- **Impacto:** Baixo: exfiltração/tracking limitada por imagem; sem execução de script de terceiros.
- **Recomendação:** Restringir img-src aos hosts realmente usados (logo/Storage do Supabase) removendo o https: genérico; avaliar nonces/hashes para reduzir unsafe-inline em estilo no médio prazo.
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

### Lacunas para venda (Segurança)

- Credencial de aluno opaca com rotação e rate-limit próprio (proxy login-codigo): hoje o código é senha permanente reutilizável, sem revogação fácil — precisa fechar antes de dado real de menor em escala.
- MFA (2FA) para super_admin e coordenação: contas com alto raio de dano (super_admin é cross-tenant) autenticam só com senha.
- Projeto de produção dedicado, separado da demo/vitrine, hospedado em sa-east-1, com backup e retenção definidos — requisito prático de LGPD para dado de menor no Brasil.
- Política de senha e Leaked Password Protection aplicadas no servidor (Supabase Pro), não só no cliente.
- Rate limiting/anti-abuso próprio nos endpoints de login e nas Edge Functions (hoje depende só do padrão do GoTrue); trilha de tentativas e alertas.
- Observabilidade de segurança com destino e alertas (acessos anômalos, exclusões LGPD, ações de super_admin) — as trilhas existem (logs_acesso, logs_coordenacao, admin_logs) mas faltam roteamento/alerta e retenção.
- Processo/documento de resposta a incidente e DPA/contrato de operador com as escolas (controladoras), incluindo prazo real de atendimento de titular já suportado tecnicamente pela lgpd-titular.
- Endurecimento do backoffice para multi-escola em escala (corrigir a paginação de 1000 e validar RLS/revogação com dados reais, não seed).

---

## Banco de dados

**Veredito:** O banco é o ponto mais maduro do sistema: 38 tabelas, todas com RLS deny-by-default, ledger de XP idempotente, funções endurecidas e paridade repo×remoto confirmada em 37==37 migrations (0037/FIX2 aplicada em 02/07, verificado via MCP list_migrations). Os achados da auditoria #56 (tabela fantasma e motor de XP duplicado) foram de fato fechados pela 0037 e pelo FIX2 no front. Restam, porém, dois riscos reais de produção: o job diário de virada de semana é uma transação única sem tratamento de erro por aluno (uma trilha inválida bloqueia a geração de metas de TODAS as escolas, em silêncio) e o ledger de XP é inflável pelo aluno via ciclo inserir/apagar simulado — contradizendo o invariante declarado de "impossível de forjar". Nenhum furo de isolamento entre escolas foi encontrado.

### Estado atual

O schema evoluiu em 37 migrations aditivas (supabase/migrations/0001–0037) organizadas em camadas: fundação multi-tenant (0001–0006: escolas/usuarios/alunos/turmas/metas/registros/simulados, helpers de identidade app.jwt()/tenant_id()/papel() lendo o JWT, RLS em 0002, motor de semana + LGPD em 0003, pg_cron em 0004), camada pedagógica global por exam_tag (0007–0015: concursos, provas/matérias/assuntos, trilha_planos/missoes, recorrência), agregação e endurecimento (0016–0018), backoffice do operador com internal_admins + RPCs SECURITY DEFINER com porteiro eh_super_admin (0019–0021, 0025, 0032), trilhas de auditoria (logs_acesso, logs_coordenacao 0022, admin_logs 0019), motor de progresso C0 com ledger aluno_eventos_progresso + triggers idempotentes por idempotency_key (0024), suspensão de escola autoritativa no banco (0027), consolidação de policies e índices multi-tenant (0023/0028/0029), motor PED1 de missões/níveis (0033), maturidade de conteúdo (0034), virada por escola (0035), atomicidade LGPD (0036) e deprecação da gamificação duplicada da Fase 15.5 (0037). Todas as 38 tabelas têm RLS habilitada (verificado por diff create table × enable row level security — zero exceções); conteúdo global é select-only para authenticated e escrito só por service_role; escrita do progresso é exclusiva de triggers SECURITY DEFINER. O pg_cron roda `virar-semana-diaria` (5 3 * * * = 00:05 America/Sao_Paulo) chamando app.virar_semana() global — job confirmado ativo no remoto (docs/auditoria/sdb-audit/05, cron.job). Seeds 01–18 são idempotentes (on conflict) e exercitados 2x por tests/reset-db.sh; seeds 04/13/14 (auth.users de demo) são pulados no CI. A massa de carga (seed-volume/massa_10k.sql, escola isolada, ids determinísticos) existe mas o teste 10k do PERF1 nunca foi executado (bloqueado por staging, docs/auditoria/perf1/relatorio). O ledger remoto tem exatamente as 37 migrations do repo (verificado ao vivo: 0037 aplicada em 20260702225921) — o relatório SDB-FIX1 (36==36) é de 29/06, anterior à 0037; não há drift hoje. Advisors ao vivo: 10 WARN de SECURITY DEFINER exposto (todos by-design com porteiro), 1 WARN novo de policies permissivas duplicadas em aluno_missoes, 27 INFO de FKs sem índice (decisão documentada DB2-F) e 9 unused_index aguardando carga real.

### Pontos fortes

- RLS deny-by-default em 100% das tabelas (0002 + cada migration nova habilita RLS na criação); diff automatizado create-table × enable-RLS não encontrou nenhuma tabela descoberta
- Identidade única e não-forjável: todas as policies leem escola/papel exclusivamente via app.tenant_id()/app.papel() derivados do JWT (0001:22-40), nunca de parâmetro do cliente; dado de contraste 'SEGREDO-ESCOLA-B' no seed 03 alimenta o teste de isolamento
- Ledger de XP (aluno_eventos_progresso, 0024) com idempotency_key única, escrito só por triggers SECURITY DEFINER a partir do fato real — aluno não insere XP por API; backfill idempotente; view vw_aluno_xp_total com security_invoker
- Duplicação de motor de gamificação (auditoria #56 §2.1) efetivamente corrigida: 0037 transformou os 2 escritores em no-op, tabelas da 15.5 carimbadas deprecadas via COMMENT, e a tabela fantasma solicitacoes_acesso foi removida do front (comentário em app/src/shared/data/index.js:953-958); provado por tests/fix2-conquistas-deprecadas.test.mjs
- Paridade migrations repo×remoto = 37==37, drift zero (verificado ao vivo via list_migrations) + guarda scripts/checar-migrations.mjs (exit 1 se faltar migration antes de publicar o front)
- Endurecimento sistemático: search_path fixo em todas as funções (0006/0026/0035/0036), revoke de anon em toda função SECURITY DEFINER exposta (0017/0018/0020/0021), RPCs de backoffice com porteiro eh_super_admin que lança 42501
- Suspensão de escola vale no banco, não só no front (0027): colapsa meu_aluno_id()/sou_responsavel_de() num ponto único e gateia as policies da coordenação
- Performance multi-tenant tratada com evidência: índices por escola_id (0023/0028), agregação server-side resumo_escola() (0016) documentando a medição (~900ms→~15ms), policies duplicadas consolidadas (0029)
- Trilhas de auditoria em três camadas (logs_acesso LGPD, logs_coordenacao, admin_logs), todas append-only sem policy de update/delete
- Seeds idempotentes de verdade (reset-db.sh aplica 2x de propósito e a suíte confere que nada duplica); massa de carga isolada em escola descartável com ids determinísticos
- LGPD funcional no banco: app.lgpd_exportar/lgpd_excluir reais (0003) + leitura prévia lgpd_usuarios_do_aluno (0036) para o fluxo Auth-primeiro sem estado órfão
- Documentação viva dentro do próprio banco (COMMENT ON, 0030/0037) marcando o que é motor ativo, deprecado ou a investigar

### Achados

#### BANCO-01 · 🟠 ALTA · Virada de semana global é uma transação única sem isolamento de falha por aluno — um dado ruim bloqueia as metas de todas as escolas, em silêncio

- **Descrição:** app.virar_semana() (chamada diariamente pelo pg_cron) itera todos os alunos com trilha e chama app.gerar_meta por aluno dentro da mesma transação, sem bloco de exceção. app.semana_da_data lança exceção se a trilha não tiver semanas ('trilha % sem semanas', 0003:36) e gerar_meta lança para aluno inconsistente. Como alunos.trilha_id NÃO tem FK (0001:81) e a coordenação pode atualizar campos arbitrários do aluno pelo front (atualizarAluno aceita `campos` sem whitelist, app/src/shared/data/index.js:584-589; atualizarAlvoPedagogico até whitelista, mas não valida conteúdo da trilha), basta um aluno apontando para uma trilha vazia/inexistente para a transação inteira abortar: nenhuma meta é fechada nem gerada para NENHUMA escola. Não há alerta de falha do job (observabilidade é o P1-3 aberto em docs/00-indices/07-pendencias) — a falha só aparece em cron.job_run_details, que ninguém monitora.
- **Evidência:** supabase/migrations/0003_motor_lgpd.sql:34-37 (raise exception 'trilha % sem semanas'), :84-112 (loop sem exception handler); 0004_agendamento.sql:19-23 (cron diário); 0001_fundacao.sql:81 (trilha_id uuid sem references); docs/00-indices/07-pendencias-para-piloto-real.md P1-3 (sem destino de observabilidade)
- **Impacto:** Alunos de todas as escolas param de receber a meta da semana até alguém investigar manualmente; como o job é a REGRA SAGRADA do produto (virada sem depender de abrir o app), a falha silenciosa degrada o valor central do sistema para todos os tenants de uma vez.
- **Recomendação:** 1) envolver o perform app.gerar_meta(r.id, v_hoje) em begin/exception para pular aluno problemático e acumular erros no retorno; 2) adicionar FK alunos.trilha_id → trilhas(id) e validar que a trilha tem semanas antes de aceitar; 3) registrar o resultado do job numa tabela de execução (ou notificar via Edge) para a falha deixar de ser silenciosa.
- **Esforço estimado:** dias · **Verificação:** CONFIRMADO por céticos independentes
- **Nota do cético:** Toda a evidência foi reproduzida no código. (1) 0003_motor_lgpd.sql:34-37: app.semana_da_data lança 'trilha % sem semanas' quando trilha_semanas não tem linhas — o que cobre trilha vazia E trilha inexistente (uuid pendurado). (2) 0003:84-112: app.virar_semana(date) global itera todos os alunos com trilha sem nenhum bloco exception; pior que o alegado, o próprio SELECT do loop chama semana_da_data por linha (0003:104), então um único aluno ruim aborta a query inteira, e como o cron executa 'select app.virar_semana();' como statement/transação única, até o UPDATE que fecha metas vencidas (0003:9 […]

#### BANCO-02 · 🟠 ALTA · Ledger de XP é inflável pelo aluno via ciclo inserir/apagar simulado — quebra o invariante 'impossível de forjar'

- **Descrição:** A RLS dá ao aluno INSERT e DELETE em simulados (0002:197-201). Cada INSERT dispara trg_progresso_simulado que credita +50 XP com idempotency_key amarrada ao id do simulado novo ('simulado:'||new.id, 0024:199-221). Não existe trigger de estorno no DELETE: o evento fica 'valido' para sempre (o status 'estornado' existe no schema mas nenhum código jamais o seta — grep confirma que só o front o lê). Logo o aluno pode inserir simulado → +50 XP → apagar → inserir de novo (novo id, nova key) → +50 XP, indefinidamente. O mesmo vale parcialmente para registros de estudo apagados após fecharem missão PED1: o XP da missão e a missão 'concluida' permanecem (0033:174-183 update ... where estado <> 'concluida' nunca reabre). Isso contradiz a doutrina declarada na própria 0024 ('impossível de forjar pelo aluno', linha 8) e corrompe ranking/patente exibidos à escola.
- **Evidência:** supabase/migrations/0002_rls.sql:197-201 (simulados_insert_aluno/simulados_delete_aluno); 0024_motor_progresso.sql:199-221 (trigger só after insert, key por id novo) e :53 (status 'estornado' sem escritor); ausência de trigger on delete confirmada por grep 'estorn' no repo
- **Impacto:** Gamificação — argumento central de venda às escolas — perde credibilidade: qualquer aluno infla XP/patente sem limite; coordenação e responsáveis veem progresso falso.
- **Recomendação:** Trigger AFTER DELETE em simulados (e registros_estudo) que marque status='estornado' no evento correspondente via referencia_id; alternativamente derivar idempotency_key de conteúdo (aluno+data+nome) em vez do id, e recalcular o total só sobre eventos com origem ainda existente.
- **Esforço estimado:** dias · **Verificação:** CONFIRMADO por céticos independentes
- **Nota do cético:** Evidência REPRODUZIDA integralmente; o mecanismo é real.

1) RLS dá INSERT e DELETE de simulados ao aluno — CONFIRMADO. supabase/migrations/0002_rls.sql:197-201 (simulados_insert_aluno with check papel='aluno' e aluno_id=meu_aluno_id; simulados_delete_aluno using idem). Nenhuma migration posterior revoga: só a 0027:176-184 recria simulados_select; a policy de delete continua ativa. O front escreve direto via cliente autenticado (app/src/shared/data/index.js:727 insert, :733 delete), logo a RLS é o único porteiro.

2) Trigger só AFTER INSERT credita +50 XP com key por id novo — CONFIRMADO. 0024 […]

#### BANCO-03 · 🟡 MÉDIA · Policy de update de meta_atividades não restringe colunas: aluno pode trocar a atividade-modelo e maximizar XP

- **Descrição:** meta_atividades_update_aluno (0002:155-160) limita as LINHAS (só da própria meta) mas o with check só exige escola_id = tenant — o aluno pode alterar qualquer coluna, inclusive atividade_modelo_id (catálogo global legível, FK simples). O trigger de XP lê a prioridade de new.atividade_modelo_id (0024:175-177): trocando um item 'X' (40 XP) por uma atividade 'F' (100 XP) antes de concluir, o aluno ganha o XP máximo e ainda corrompe a composição da meta gerada pelo motor (a unique (meta_id, atividade_modelo_id) não impede a troca para atividade de outra semana/trilha).
- **Evidência:** supabase/migrations/0002_rls.sql:155-160 (with check só escola_id); 0024_motor_progresso.sql:175-177 (v_xp := app.xp_por_prioridade lida da atividade apontada); 0001_fundacao.sql:261 (grant update em todas as colunas)
- **Impacto:** Inflação de XP (40→100 por item) e corrupção do conteúdo da meta semanal exibida à coordenação; mina a auditabilidade do motor.
- **Recomendação:** Trigger BEFORE UPDATE que rejeite mudança de meta_id/atividade_modelo_id por não-service_role, ou coluna-level: revoke update, grant update (estado, atualizado_em) para authenticated.
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### BANCO-04 · 🟡 MÉDIA · Bloqueio de escola suspensa é incompleto: coordenação suspensa mantém acesso às tabelas de progresso/gamificação/config

- **Descrição:** A 0027 gateou as policies da coordenação com app.tenant_operacional(), mas a 0029 preservou deliberadamente as tabelas de gamificação SEM o gate, e a 0033 criou aluno_missoes com FOR ALL da coordenação também sem gate. Resultado: coordenação de escola suspensa/cancelada continua lendo aluno_eventos_progresso (evprog_select ramo coordenacao sem gate, 0024:298-305), inserindo eventos ajuste_coordenacao (0024:309-313), lendo/escrevendo aluno_niveis, aluno_onboarding, aluno_missoes, config_escola, missoes_escola (0029:36-84) e gravando logs_coordenacao. Aluno e responsável ficam de fato bloqueados (colapso de meu_aluno_id), mas o corte comercial da suspensão não vale para a coordenação nessas superfícies.
- **Evidência:** supabase/migrations/0029_db2_policies_consolidadas.sql:17-19 (nota admitindo que gamificação NÃO tem o gate 'e NÃO passam a ter'); 0033_ped1_missoes_niveis.sql:85-87 (aluno_missoes_coordenacao for all sem tenant_operacional); 0024_motor_progresso.sql:298-313
- **Impacto:** Escola inadimplente suspensa segue operando parcialmente (lê progresso de todos os alunos, ajusta XP, edita config) — enfraquece a alavanca comercial da suspensão e a promessa de bloqueio autoritativo no banco.
- **Recomendação:** Adicionar app.tenant_operacional() ao ramo coordenacao das policies de aluno_eventos_progresso, aluno_niveis, aluno_onboarding, aluno_missoes, config_escola, missoes_escola e logs_coordenacao (mesmo padrão da 0027).
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### BANCO-05 · 🟡 MÉDIA · Gatilho PED1 executa o motor completo por linha de registros_estudo — e a massa 10k do PERF1 não liga o gate de semeadura

- **Descrição:** trg_ped1_registro (after insert/update/delete FOR EACH ROW) chama app.motor_avaliar_aluno, que percorre TODAS as missões do exame com um LATERAL agregando todo o histórico de registros do aluno por missão, recalcula níveis por matéria e reavalia conquistas (0033:137-258). O custo cresce com o histórico do aluno e com o catálogo de missões, pago a cada lançamento. Pior: seed-volume/massa_10k.sql insere dezenas de milhares de registros (linhas 96-109) SEM setar app.motor_seed='on' (só os seeds 03/11 setam), então a carga do PERF1 dispararia o motor completo ~40k vezes, distorcendo o teste e tornando a semeadura lentíssima. Import em lote futuro pela coordenação teria o mesmo problema O(n²).
- **Evidência:** supabase/migrations/0033_ped1_missoes_niveis.sql:306-317 (trigger por linha, gate só via app.motor_semeando) e :150-194 (loop missões × lateral sobre registros_estudo); supabase/seed-volume/massa_10k.sql:96-109 (inserts sem set app.motor_seed)
- **Impacto:** Latência crescente no lançamento de estudo do aluno (caminho mais quente do produto) e inviabilidade prática do plano de carga 10k como está escrito.
- **Recomendação:** Curto prazo: adicionar `set app.motor_seed='on'` na massa_10k. Estrutural: mover a avaliação para statement-level com transition tables, ou debounce (avaliar só a matéria do registro tocado — o loop já poderia filtrar m.materia_codigo = new.disciplina_codigo).
- **Esforço estimado:** dias · **Verificação:** não exigida (severidade média/baixa)

#### BANCO-06 · 🟡 MÉDIA · Integridade referencial fraca em colunas-chave do motor e do domínio

- **Descrição:** Além de alunos.trilha_id sem FK (achado 1): registros_estudo.disciplina_codigo é texto livre sem FK (0001:183) — é a chave que o motor PED1 casa com missoes.materia_codigo, então um typo silenciosamente zera o progresso de missão; atividades_modelo.semana_numero/disciplina_codigo não referenciam trilha_semanas/disciplinas (0001:139-147); consentimentos.registrado_por uuid not null sem FK (0001:214); alunos.usuario_id não tem UNIQUE (0001:79, idx não-único em :230) — se o provisionamento duplicar o vínculo, app.meu_aluno_id() usa limit 1 sem order (0002:14-19) e a identidade do aluno vira não-determinística; tabelas de relação (alunos_turmas, vinculos_responsaveis) não têm FK composta garantindo que aluno/turma/responsável pertencem à mesma escola_id da linha (a coerência depende só de RLS + cliente preencher certo).
- **Evidência:** supabase/migrations/0001_fundacao.sql:79-81, :139-147, :183, :214, :230; 0002_rls.sql:14-19 (limit 1)
- **Impacto:** Dados inconsistentes entram sem erro e aparecem como bugs difusos (progresso que não anda, meta órfã, identidade trocada); custo de suporte alto no piloto.
- **Recomendação:** Adicionar: unique em alunos.usuario_id; FK alunos.trilha_id; FK registros_estudo.disciplina_codigo → materias(codigo) (ou check contra catálogo); FKs compostas (escola_id, aluno_id) usando unique(id, escola_id) nas tabelas-pai.
- **Esforço estimado:** dias · **Verificação:** não exigida (severidade média/baixa)

#### BANCO-07 · 🟡 MÉDIA · Tabelas deprecadas (Fase 15.5) mantêm policies de escrita ativas para a coordenação

- **Descrição:** A 0037 desligou os escritores de servidor de aluno_conquistas/aluno_xp_eventos, mas as policies de INSERT/UPDATE/DELETE da coordenação criadas na 0029 continuam vigentes (conq_coord_ins/upd/del, xp_coord_ins/upd/del) e os grants da 0013 permanecem. Uma coordenação pode voltar a popular tabelas oficialmente 'DEPRECADA/CONGELADA' (comentários da 0037), recriando a segunda fonte de verdade que o FIX2 acabou de matar. A remoção física é DB3 (P4) sem prazo.
- **Evidência:** supabase/migrations/0029_db2_policies_consolidadas.sql:27-64 (policies de escrita em aluno_conquistas/aluno_xp_eventos); 0037_fix2_deprecar_escrita_conquistas.sql:56-64 (comentários de deprecação); docs/00-indices/05-camadas-faltantes.md:170 (DB3 pendente)
- **Impacto:** Risco de reintrodução silenciosa de dado duplicado de gamificação e confusão de auditoria futura; superfície de escrita desnecessária.
- **Recomendação:** Migration curta dropando as policies de escrita e revogando insert/update/delete de authenticated nas 4 tabelas deprecadas, antecipando a parte segura do DB3.
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### BANCO-08 · 🟡 MÉDIA · limite_alunos não é aplicado no banco — o plano comercial é só informativo

- **Descrição:** escolas.limite_alunos existe desde a 0021 com check apenas de não-negatividade; nenhuma policy, trigger ou RPC impede a coordenação de cadastrar alunos além do limite (cadastrarAlunos insere direto em alunos; a RLS alunos_insert só checa tenant+papel). O backoffice apenas exibe avisos (avisosRisco em app/src/modules/backoffice/operacao.js).
- **Evidência:** supabase/migrations/0021_backoffice_escolas_crud.sql:19 (check >= 0 apenas); 0002_rls.sql:93-94 + 0027:118-120 (alunos_insert sem contagem); app/src/shared/data/index.js:556-570 (cadastrarAlunos sem checagem)
- **Impacto:** Modelo de cobrança por faixa de alunos não tem trava técnica: escola pode exceder o contratado sem fricção, e o operador só percebe olhando o painel.
- **Recomendação:** Trigger BEFORE INSERT em alunos comparando count por escola com limite_alunos (quando não nulo), com erro amigável; ou mover o cadastro para RPC com a checagem.
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### BANCO-09 · 🟡 MÉDIA · Policies avaliam funções de identidade linha a linha (sem wrap em initplan) — custo já medido de ~900ms em 15k linhas

- **Descrição:** As policies chamam app.tenant_id()/app.papel()/app.meu_aluno_id()/app.sou_responsavel_de() diretamente (não como (select fn())), e meu_aluno_id/sou_responsavel_de são SECURITY DEFINER não-inlináveis — em seq scans o Postgres reexecuta por linha. O próprio comentário da 0016 mediu ~900ms para agregar 15k registros sob RLS e contornou APENAS o painel via SECURITY DEFINER; leituras volumosas que continuam sob RLS pura (listarSimuladosEscola busca todos os simulados da escola, listarConsentimentos, meta_atividades_select com EXISTS correlato em metas que reavalia a RLS de metas por linha, 0002:149-153) pagarão esse custo conforme o volume do piloto crescer.
- **Evidência:** supabase/migrations/0016_painel_agregado.sql:7-14 (medição documentada); 0002_rls.sql:135-160 (chamadas diretas + exists correlato); app/src/shared/data/index.js:603-610 (listarSimuladosEscola sem agregação)
- **Impacto:** Degradação progressiva das telas da coordenação com 300–500 alunos ativos; risco de repetir o incidente dos 900ms em outras superfícies.
- **Recomendação:** Reescrever policies quentes com (select app.tenant_id()) etc. (padrão initplan recomendado pelo advisor do Supabase) e agregar simulados/consentimentos no banco como foi feito no resumo_escola.
- **Esforço estimado:** dias · **Verificação:** não exigida (severidade média/baixa)

#### BANCO-10 · ⚪ BAIXA · Ajuste manual de XP da coordenação sem validação de vínculo aluno↔escola nem limites

- **Descrição:** evprog_ajuste_coordenacao só exige escola_id=tenant, papel=coordenacao e tipo_evento='ajuste_coordenacao' (0024:309-313): não valida que aluno_id pertence à escola_id da linha, não limita xp_delta e não exige justificativa em metadata. O evento com aluno de outra escola fica invisível para a vítima (RLS filtra por escola), mas polui o ledger; xp_delta ilimitado permite ajuste de milhões de pontos num clique.
- **Evidência:** supabase/migrations/0024_motor_progresso.sql:309-313
- **Impacto:** Ledger auditável perde garantias de coerência; erro operacional (uuid colado errado) cria lixo permanente em tabela append-only.
- **Recomendação:** with check adicional: exists(select 1 from alunos a where a.id = aluno_id and a.escola_id = app.tenant_id()) e faixa razoável para xp_delta.
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### BANCO-11 · ⚪ BAIXA · gerar_meta tem corrida select→insert sem ON CONFLICT

- **Descrição:** app.gerar_meta checa a existência da meta e depois insere (0003:62-70) confiando no unique(aluno_id, trilha_id, semana_numero); duas execuções concorrentes (cron global + Edge gerar-meta disparada pela coordenação, ou cron + virada por escola 0035) podem colidir em 23505, derrubando a chamada — e, no caso do cron, a transação inteira (ver achado 1). tests/concorrencia.test.mjs testa apenas um helper de front, não essa corrida.
- **Evidência:** supabase/migrations/0003_motor_lgpd.sql:62-78; tests/concorrencia.test.mjs:1-14 (só comConcorrenciaLimitada)
- **Impacto:** Falha esporádica e não-reproduzível na geração de meta em horários coincidentes.
- **Recomendação:** insert ... on conflict (aluno_id, trilha_id, semana_numero) do nothing + reselect do id.
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### BANCO-12 · ⚪ BAIXA · Regressão de advisor: aluno_missoes recriou o padrão de policies permissivas duplicadas que a 0029 tinha zerado

- **Descrição:** A 0033 criou aluno_missoes com aluno_missoes_select + aluno_missoes_coordenacao FOR ALL — exatamente o antipadrão que a 0029 eliminou de 7 tabelas. O advisor de performance ao vivo acusa 1 WARN multiple_permissive_policies em aluno_missoes (SELECT). Mostra que não há gate de CI conferindo advisors após nova migration.
- **Evidência:** supabase/migrations/0033_ped1_missoes_niveis.sql:75-87; get_advisors(performance) ao vivo: 'Table public.aluno_missoes has multiple permissive policies ... {aluno_missoes_coordenacao,aluno_missoes_select}'
- **Impacto:** Custo duplo de avaliação de policy no SELECT e erosão do trabalho da DB2; sinal de processo (advisors não conferidos a cada migration).
- **Recomendação:** Split da FOR ALL em ins/upd/del (padrão 0029) e adicionar checagem de advisors ao checklist de migration.
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### BANCO-13 · ⚪ BAIXA · checar-migrations compara só nomes; não detecta migration editada após aplicada e não há down-migrations

- **Descrição:** A guarda de paridade (scripts/checar-migrations.mjs) compara a lista de nomes do repo com supabase_migrations.schema_migrations — um arquivo alterado depois de aplicado (drift de conteúdo) passa invisível; o histórico já teve renumeração 0022→0024 corrigida por UPDATE manual no ledger (scripts/reconciliar-ledger-0024) e o ledger remoto tem ordem de aplicação não-monótona (0016 antes da 0008; 0024 antes da 0022/0023 — confirmado no list_migrations). Não existem migrations de rollback executáveis: só comentários manuais a partir da 0033.
- **Evidência:** scripts/checar-migrations.mjs:78-83 (comparação por nome); scripts/reconciliar-ledger-0024-motor-progresso.sql; list_migrations ao vivo (versões 20260614133039=0016 < 20260614134705=0008)
- **Impacto:** Confiança na paridade é parcial; em incidente, o rollback depende de copiar/colar comentários — lento e sujeito a erro.
- **Recomendação:** Somar hash do conteúdo à checagem (ou usar supabase db diff em CI contra shadow db) e padronizar arquivo .down.sql por migration nova.
- **Esforço estimado:** dias · **Verificação:** não exigida (severidade média/baixa)

#### BANCO-14 · ⚪ BAIXA · Migrations misturam correção de dado de demo com schema (0031) e o mesmo projeto remoto hospeda demo + credenciais publicadas no repo

- **Descrição:** A 0031 faz UPDATE de status das escolas 'vitrine'/'beta' dentro do stream de migrations — dado de demo virando história de schema. Os seeds 04/13 inserem contas direto em auth.users com senhas fixas versionadas no repositório (vitrine-coord-2026, LUCASDEMO2026 etc., seed/04:29-40) e essas escolas convivem no mesmo projeto Supabase que receberia a primeira escola real (separação demo×real é o P2-2 aberto). No banco puramente: o risco é operar produção com tenants de demo cujas credenciais são públicas no Git.
- **Evidência:** supabase/migrations/0031_d1a_vitrine_status_ativa.sql:21-25; supabase/seed/04_usuarios_auth_dev.sql:12-18 e 43-54; docs/00-indices/07-pendencias-para-piloto-real.md P2-2
- **Impacto:** Superfície de acesso conhecida num banco que passará a conter dado de menor de idade; história de migrations menos reproduzível em ambiente limpo.
- **Recomendação:** Projeto Supabase dedicado para produção antes do primeiro aluno real (P2-2); trocar/rotacionar as credenciais de demo; manter correções de dado em scripts operacionais, não em migrations.
- **Esforço estimado:** dias · **Verificação:** não exigida (severidade média/baixa)

### Lacunas para venda (Banco de dados)

- Backup automático com restore TESTADO (P1-1) — hoje não há evidência de nenhum teste de restauração; para escola pagante com dado de menor, é pré-requisito contratual
- Região sa-east-1 / residência de dados no Brasil (P1-2, LGPD) — o projeto atual não está na região exigida pelo posicionamento LGPD do produto
- Projeto Supabase de produção separado do demo (P2-2) — o banco atual mistura escolas de vitrine com credenciais versionadas no Git e seria o mesmo a receber dado real
- Capacidade não comprovada: o teste de carga 300/500/10k do PERF1 nunca foi executado (bloqueado por staging) — não há número medido para prometer a uma escola de 300+ alunos
- Observabilidade do banco: nenhum alerta para falha do pg_cron (virada de semana), erros de RLS ou crescimento anômalo — o job mais crítico falha em silêncio
- Retenção/expurgo de logs_acesso e logs_coordenacao (P3-1) — trilha LGPD cresce sem política de retenção, o que a própria LGPD exige definir
- Modelo de cobrança/assinatura inexistente no schema: 'plano' é texto livre e limite_alunos não é trava; vender exige pelo menos plano/valor/vigência e enforcement do limite
- Conteúdo multi-concurso: o banco está pronto (maturidade/0034), mas só o Colégio Naval está 'completa'; EsPCEx é beta e EEAr/EPCAR/ESA/CM são esqueleto/indisponível (seed 18) — não dá para vender turmas desses nichos ainda
- DB3 pendente: remoção física das 4 tabelas deprecadas da Fase 15.5 e poda de índices sob carga real — dívida controlada, mas precisa de plano datado
- Processo de migração para clientes: sem down-migrations executáveis, sem staging permanente e com guarda de paridade só por nome — operar N escolas reais exigirá pipeline de mudança de schema mais robusto

---

## Arquitetura

**Veredito:** A arquitetura real é notavelmente fiel à declarada nos docs de fundação: o seam único de dados existe de fato (grep confirma zero importações do Supabase fora de shared/data e lib/supabase.js), as regras críticas (XP, virada de semana, geração de meta) rodam no servidor com SECURITY DEFINER e pg_cron, os módulos formam um grafo acíclico e o CI roda 471 testes contra Postgres real. O achado #56 (motor de XP duplicado) foi fechado no ponto crítico — escrita dupla neutralizada pela migration 0037 — mas deixou resíduos no cliente (fallback calcularXP, PATENTES hardcoded, módulo gamificacao.js morto). As dívidas que ameaçam estabilidade não estão no desenho, e sim na camada de operação: um único projeto Supabase serve demo e produção, em us-east-1 (contra a promessa LGPD de São Paulo do Doc 6), a observabilidade aponta para lugar nenhum e o cron da virada roda sem alerta de falha.

### Estado atual

O front é um SPA React 19 + Vite 8 (apenas 4 dependências de runtime; npm audit = 0 vulnerabilidades em app e tests) organizado em App.jsx magro (165 linhas) que roteia por papel do token (coordenacao/aluno/responsavel/super_admin), com code-splitting por área via lazy/Suspense. A estrutura segue o Doc 5: routes/ (cascas por papel) → modules/ (conteudo, pessoas, desempenho, motor, consentimento, backoffice, escola) → shared/ (data, contratos, regras, lib, hooks, ui, metricas, branding). Todo acesso a dados passa por shared/data/index.js (965 linhas, ~80 funções), único importador de lib/supabase.js — a regra "o seam é o único ponto que fala com o Supabase" se sustenta integralmente no grep; o único fetch direto fora do seam é o da observabilidade (best-effort). A divisão cliente/servidor respeita o Doc 4 §6: XP é concedido por triggers SECURITY DEFINER com idempotency_key (migration 0024), missões fecham por gatilho com critério de volume+acurácia (0033), a virada de semana roda no pg_cron às 03:05 UTC (0004) com variante por escola (0035), e geração de meta/provisionamento/LGPD rodam em 6 Edge Functions Deno que concentram a service key em _shared/contexto.ts (com timingSafeEqual na virar-semana e CORS allowlist). O cliente só exibe: nota projetada (regras.js) e patente (jargao.js) são derivações de apresentação sobre dados persistidos. Erros têm três camadas (ErroFronteira, mensagemAmigavel, capturarErro com gancho para endpoint externo — não configurado), concorrência tem trava síncrona (travaEnvio/useEnvioUnico) e limitador de paralelismo (concorrencia.js). O CI (ci.yml) builda produção, roda migrations+seed 2x num Postgres vanilla e exige ≥200 testes passando (471 medidos em 02/07), com E2E Playwright explicitamente pulada sem ambiente isolado. Deploy: Vercel com headers de segurança fortes (CSP script-src 'self', HSTS, frame-ancestors none) apontando para um único projeto Supabase (bdjkgrzfzoamchdpobbl, us-east-1) que é simultaneamente demo e futuro ambiente de produção.

### Pontos fortes

- Regra do seam único CUMPRIDA: grep em app/src encontra createClient apenas em lib/supabase.js e importação do cliente apenas em shared/data/index.js — nenhuma tela fala com o Supabase direto
- Regras de negócio críticas no servidor, inadulteráveis pelo cliente: XP via triggers SECURITY DEFINER com idempotency_key (0024), missões com critério de acurácia (0033), virada de semana no pg_cron (0004/0035), geração de meta via RPC com service role (gerar-meta/index.ts:34) — o front só lê e exibe
- Fronteiras de módulo acíclicas: routes→modules→shared; desempenho e pessoas importam de conteudo/motor, mas conteudo, motor, escola, consentimento e backoffice não importam de nenhum outro módulo — sem dependência circular
- Achado #56 fechado no ponto que importava: migration 0037 transformou os dois escritores de conquista em no-ops assinatura-compatíveis (verificado no SQL), com teste dedicado (tests/fix2-conquistas-deprecadas.test.mjs) e dados preservados
- CI honesto e forte: build de produção + migrations/seed 2x (idempotência exercitada) + 471 testes node contra Postgres real (incl. RLS e motor) + guarda anti-verde-vazio que falha com <200 testes; E2E pulada EXPLICITAMENTE sem ambiente isolado em vez de fingir verde
- Dependências mínimas e saudáveis: 4 deps de runtime (react, react-dom, supabase-js, recharts), npm audit 0 vulnerabilidades em app e tests, code-splitting por área (aluno não baixa o painel da coordenação)
- Camada de resiliência de front bem desenhada: ErroFronteira global, mensagemAmigavel com contextos, trava síncrona de duplo envio por construção (travaEnvio.js), AbortController opt-in no seam (comSinal), stale-while-revalidate no useRecurso
- Edge Functions disciplinadas: service key só em _shared/contexto.ts, identidade sempre pelo token verificado (chamador()), comparação de segredo em tempo constante, CORS por allowlist com regex restrito a previews do próprio projeto
- Escala de leitura da coordenação resolvida no banco: resumo_escola agrega por RPC (uma linha por aluno) em vez de baixar registros crus; índices multi-tenant nas migrations 0023/0028
- Documentação viva (05-camadas-faltantes, 07-pendencias) honesta e majoritariamente aderente ao código — cada afirmação relevante que verifiquei no código bateu

### Achados

#### ARQUITETURA-01 · 🟠 ALTA · Observabilidade de produção aponta para lugar nenhum: erros somem no console do usuário

- **Descrição:** Toda a cadeia de captura de erros (ErroFronteira → capturarErro) termina num console.error e num POST condicionado a VITE_ERROR_REPORT_URL, que não está definida em nenhum ambiente: app/.env.production contém apenas VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY. Em produção, uma tela quebrando para um aluno é invisível para a operação. As Edge Functions também só fazem console.error (logs do Supabase, sem alerta). O registro vivo confirma o item aberto desde a auditoria de 28/06 (camada 5.1, P2).
- **Evidência:** app/src/shared/lib/observabilidade.js:9 (`const ENDPOINT = import.meta.env?.VITE_ERROR_REPORT_URL;`) e :13 (`if (!ENDPOINT) return;`); app/.env.production (só 2 variáveis); docs/00-indices/05-camadas-faltantes.md:83 (item 5.1 🔴 'gancho instalado, VITE_ERROR_REPORT_URL indefinida')
- **Impacto:** Incidentes em produção com escola real (tela branca, falha de gravação de estudo, RLS negando indevidamente) não geram nenhum sinal para o operador — o diagnóstico depende de o usuário reclamar e descrever o erro.
- **Recomendação:** Apontar VITE_ERROR_REPORT_URL para um Sentry/GlitchTip/endpoint próprio (o gancho já existe e é best-effort), configurar a variável no Vercel, e adicionar captura equivalente nas Edge Functions. É o item de maior razão valor/custo antes do piloto.
- **Esforço estimado:** horas · **Verificação:** CONFIRMADO por céticos independentes
- **Nota do cético:** Evidência reproduzida integralmente: app/src/shared/lib/observabilidade.js:9 lê VITE_ERROR_REPORT_URL e a linha 13 (`if (!ENDPOINT) return;`) faz capturarErro terminar em mero console.error quando a variável é indefinida. Ela não está definida em nenhum lugar do repo — app/.env.production tem só VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (único .env de app/), e VITE_ERROR_REPORT_URL só aparece comentada em .env.example:17. A cadeia está instalada (main.jsx:7 chama instalarCapturaGlobal; ErroFronteira.jsx:18 chama capturarErro), então o gancho existe mas aponta para lugar nenhum. As Edge Functi […]

#### ARQUITETURA-02 · 🟠 ALTA · Virada de semana agendada roda às cegas: nenhum alerta se o pg_cron falhar

- **Descrição:** A regra central do motor ('a virada não depende de o aluno abrir o app', Doc 4 §6) está corretamente no servidor via pg_cron diário (migration 0004), mas não existe nenhum mecanismo que detecte ou alerte uma falha do job: sem heartbeat, sem verificação de 'última virada executada', sem alerta de uptime. O registro vivo confirma (camada 5.2 🔴, P2). A Edge Function virar-semana existe como acesso operacional manual, o que pressupõe que alguém PERCEBA a falha primeiro.
- **Evidência:** supabase/migrations/0004_agendamento.sql (cron.schedule 'virar-semana-diaria' sem qualquer monitoração); docs/00-indices/05-camadas-faltantes.md:84 ('Alerta de falha da virada + uptime | 🔴 | inexistente | P2')
- **Impacto:** Se o cron falhar numa segunda-feira (extensão desabilitada, erro na função, migração com regressão), centenas de alunos ficam sem meta nova e a escola percebe antes do operador — exatamente o modo de falha nº 4 que o Doc 4 §12 mandou projetar contra.
- **Recomendação:** Gravar um carimbo de última execução (tabela de heartbeat) na app.virar_semana e criar um alerta externo barato (cron-job.org/UptimeRobot chamando uma RPC que verifica 'virada de hoje aconteceu?') ou um check diário na própria Edge Function agendada pela Vercel.
- **Esforço estimado:** horas · **Verificação:** CONFIRMADO por céticos independentes
- **Nota do cético:** Evidência 100% reproduzida: supabase/migrations/0004_agendamento.sql tem o único cron.schedule do repo ('virar-semana-diaria') sem qualquer monitoração; docs/00-indices/05-camadas-faltantes.md:84 diz literalmente 'Alerta de falha da virada + uptime | 🔴 | inexistente | P2'; a Edge Function virar-semana se autodescreve como 'execução manual/operacional'; varredura completa (supabase/, app, .github/workflows/, docs/operacao/) não encontrou heartbeat, verificação de última virada ou alerta — o gap de detecção é real e total. Porém a severidade 'alta' exagera: (1) o job roda DIARIAMENTE com função […]

#### ARQUITETURA-03 · 🟠 ALTA · Arquitetura de ambientes declarada não existe: projeto único demo=produção, em us-east-1 contra a promessa LGPD de São Paulo

- **Descrição:** O Doc 6 §7 declara 'dois ambientes: desenvolvimento (com seed da vitrine) e produção' e 'região São Paulo (LGPD)'. A realidade: um único projeto Supabase (bdjkgrzfzoamchdpobbl, referenciado em app/.env.production como ambiente de produção do Vercel) serve demo, desenvolvimento remoto e o futuro piloto, e está em us-east-1 — o próprio registro vivo admite ambos os desvios. O CI reforça a consequência: a E2E é pulada porque não há ambiente isolado. Dado de menor de escola real entraria no mesmo banco onde vivem credenciais de demo.
- **Evidência:** docs/fundacao/06-arquitetura-fechada.md:135-137 ('Banco, auth e funções no Supabase, região São Paulo (LGPD)... Dois ambientes'); docs/00-indices/05-camadas-faltantes.md:86 ('Região sa-east-1 | ⛔ | remoto segue us-east-1') e :89 ('Separação demo × staging × prod | 🔴 | projeto único; credenciais demo em produção'); app/.env.production:4
- **Impacto:** Risco operacional (um seed ou teste destrutivo atinge dados reais), risco de argumento de venda (a resposta LGPD prometida às escolas — 'dado no Brasil' — hoje é falsa) e impossibilidade de rodar E2E/carga sem poluir a vitrine.
- **Recomendação:** Antes da primeira escola real: criar projeto Supabase dedicado de produção em sa-east-1, migrar via as 37 migrations (que o CI já prova idempotentes), manter o atual como demo/staging, e configurar os secrets E2E para destravar a suíte Playwright no CI.
- **Esforço estimado:** dias · **Verificação:** CONFIRMADO por céticos independentes
- **Nota do cético:** Toda a evidência citada se reproduz literalmente: docs/fundacao/06-arquitetura-fechada.md:135-136 promete 'região São Paulo (LGPD)' e 'Dois ambientes: desenvolvimento (com seed da vitrine) e produção'; docs/00-indices/05-camadas-faltantes.md:86 admite 'remoto segue us-east-1' (⛔) e :89 admite 'projeto único; credenciais demo em produção' (🔴); app/.env.production:4 aponta o build de produção Vite/Vercel para o projeto bdjkgrzfzoamchdpobbl, rotulado no próprio arquivo como 'ambiente de demo'. docs/operacao/ambientes-e-variaveis.md:14-17 confirma sem ambiguidade: 'Demo/produção atual... projeto  […]

#### ARQUITETURA-04 · 🟡 MÉDIA · XP inflável pelo aluno via inserir/apagar simulado em loop (sem estorno no delete)

- **Descrição:** O trigger app.progresso_de_simulado concede XP fixo (app.xp_simulado()) a cada INSERT em simulados, com idempotency_key = 'simulado:'||new.id — cada nova linha gera chave nova. A RLS permite ao aluno inserir E apagar os próprios simulados, e não existe trigger de estorno no DELETE (o status 'estornado' do ledger existe mas nada o grava). Um aluno pode inserir e apagar o mesmo simulado N vezes e acumular N×XP. Contradiz a premissa antigaming do próprio motor ('XP premia domínio... nunca volume puro').
- **Evidência:** supabase/migrations/0024_motor_progresso.sql:199-221 (trigger after insert on simulados, idempotency_key por id novo; nenhum trigger on delete); supabase/migrations/0002_rls.sql:197-200 (policies simulados_insert_aluno e simulados_delete_aluno); app/src/shared/data/index.js:732-735 (removerSimulado exposto ao aluno)
- **Impacto:** Integridade da gamificação, não segurança de dados: XP e patente inflados distorcem a ClassificacaoTurma e o acompanhamento da coordenação — numa escola real, o ranking vira alvo de gaming por adolescentes rapidamente.
- **Recomendação:** Trigger AFTER DELETE em simulados que marca o evento correspondente como 'estornado' (o campo de status já existe para isso), ou idempotency_key derivada de (aluno_id, nome, data) em vez do id da linha.
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### ARQUITETURA-05 · 🟡 MÉDIA · Resíduo do motor de XP duplicado (#56): fallback legado no cliente, régua de patente no front e módulo morto

- **Descrição:** O núcleo do achado #56 foi resolvido (0037 neutralizou a escrita dupla — verificado), mas três resíduos permanecem: (1) calcularXP legado ainda é o fallback exibido quando o aluno não tem eventos no ledger — duas fórmulas de XP convivem e o número exibido salta quando o primeiro evento chega; (2) a régua de patente é uma tabela hardcoded no front (PATENTES em jargao.js) enquanto a tabela patentes do banco segue existindo, deprecada — a regra de progressão vive no bundle, não no dado; (3) o módulo puro modules/conteudo/gamificacao.js (motor 15.5: xpDeMissao, patenteParaXp, totalXp) tem ZERO importadores no app — código morto mantido vivo por teste (tests/gamificacao.test.mjs), e a remoção física das 4 tabelas deprecadas (DB3) segue pendente.
- **Evidência:** app/src/routes/aluno/VisaoEstudo.jsx:156-158 e app/src/modules/desempenho/FichaAluno.jsx:54-56 (fallback `: calcularXP({...})`); app/src/modules/motor/jargao.js:29-35 (calcularXP legado) e :62-76 (PATENTES hardcoded); grep 'gamificacao' em app/src → 0 importadores fora do próprio arquivo; supabase/migrations/0037_fix2_deprecar_escrita_conquistas.sql:57-64 (4 tabelas carimbadas deprecadas, não removidas)
- **Impacto:** Confusão de manutenção (três lugares definem 'quanto vale XP/patente'), UX inconsistente na transição estimativa→ledger, e schema com 4 tabelas mortas que enganam quem audita o banco.
- **Recomendação:** Executar a DB3 (drop das 4 tabelas), remover calcularXP e o fallback (backfill do ledger para bases antigas), deletar gamificacao.js e seu teste, e considerar mover PATENTES para o banco se a régua for variar por concurso.
- **Esforço estimado:** dias · **Verificação:** não exigida (severidade média/baixa)

#### ARQUITETURA-06 · 🟡 MÉDIA · Contratos de escrita e DTOs adotados só parcialmente: escritas de simulado montadas à mão em 2 telas

- **Descrição:** A resposta à pergunta 'os contratos são usados em todas as escritas?' é NÃO. validarRegistroEstudo cobre apenas o registro de estudo (Registrar.jsx:68 usa v.campos validados). adicionarSimulado é chamado com payload montado inline em DUAS telas, cada uma com sua validação própria duplicada (a checagem de 'estouros' de acertos existe copiada em SimuladoConcurso.jsx e Progresso.jsx). Os DTOs de leitura (dto.js) são usados em exatamente 1 componente (VinculosResponsavel.jsx); todas as demais telas leem o formato cru do PostgREST — acoplamento que o próprio cabeçalho de dto.js descreve como 'quebra em silêncio (vira undefined)' se o select mudar. O registro vivo reconhece (item 10.5: 'PostgREST cru ainda domina').
- **Evidência:** grep 'contratos/' em app/src → só VinculosResponsavel.jsx:8 e Registrar.jsx:14; app/src/modules/desempenho/SimuladoConcurso.jsx:76 e app/src/modules/desempenho/Progresso.jsx:224 (dois `db.adicionarSimulado({...})` montados à mão com validação `estouros` duplicada); docs/00-indices/05-camadas-faltantes.md:146 (item 10.5 🟡)
- **Impacto:** A validação de simulado pode divergir entre as duas telas (já são implementações separadas), e qualquer mudança de select no seam quebra telas silenciosamente — exatamente o risco que a camada de contratos foi criada para eliminar.
- **Recomendação:** Extrair validarSimulado para shared/contratos (unificando a regra de estouros) e completar a adoção de DTOs nas leituras com embeds aninhados (listarAlunos com alunos_turmas, listarMetas com meta_atividades) antes de o time crescer.
- **Esforço estimado:** dias · **Verificação:** não exigida (severidade média/baixa)

#### ARQUITETURA-07 · 🟡 MÉDIA · Trava de duplo envio não adotada nas mutações fora do trio inicial; sem idempotência de insert no banco

- **Descrição:** useEnvioUnico (trava síncrona correta por construção) é usado em apenas 3 arquivos (CadastroAlunos, VinculosResponsavel, Registrar). As demais telas com mutação mantêm o padrão antigo de estado assíncrono que o próprio travaEnvio.js documenta como furado: Marca.jsx nem sequer checa `ocupado` antes de rodar salvar(); MetaSemana.jsx usa `if (ocupado) return` sobre estado React (janela de corrida no mesmo tick); Onboarding, ListaAlunos e AreaAdmin idem. Agrava: inserts de simulados e registros_estudo não têm chave de idempotência no banco (só os eventos de XP derivados têm), então um retry de rede ou duplo disparo cria linha duplicada de verdade.
- **Evidência:** grep useEnvioUnico → só 3 arquivos; app/src/modules/escola/Marca.jsx:20,28-38 (setOcupado sem guarda síncrona nem checagem prévia); app/src/modules/motor/MetaSemana.jsx:75 (`if (!podeEditar || ocupado) return;` — estado de render, não latch); app/src/shared/lib/travaEnvio.js:5-12 (o próprio arquivo descreve por que esse padrão falha)
- **Impacto:** Duplo-clique ou toque fantasma no mobile pode salvar marca duas vezes (inofensivo) ou duplicar simulado/adiamento de atividade (afeta métricas e XP — cada simulado duplicado concede XP em dobro via trigger).
- **Recomendação:** Migrar as mutações restantes para useEnvioUnico (mecânico, o hook já existe) e adicionar unique parcial em simulados (aluno_id, nome, data) e em registros_estudo um token de idempotência gerado no cliente.
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### ARQUITETURA-08 · 🟡 MÉDIA · Soma de XP feita no cliente baixando o ledger inteiro, ignorando a view agregada que já existe no banco

- **Descrição:** carregarXpPersistido faz select de TODOS os eventos do aluno (sem limite) e soma no JavaScript, enquanto a migration 0024 já criou vw_aluno_xp_total (security_invoker, soma no SQL) exatamente para isso — a view não tem nenhum consumidor no app. A mesma redução está triplicada: no seam (index.js), em jargao.xpTotal e na view SQL. O ledger é append-only e cresce sem teto: um aluno ativo por 12 meses acumula milhares de eventos baixados a cada abertura da tela de estudo e da ficha na coordenação.
- **Evidência:** app/src/shared/data/index.js:460-474 (select de xp_delta,status sem limit + reduce no cliente); supabase/migrations/0024_motor_progresso.sql:225-232 (create view vw_aluno_xp_total); grep 'vw_aluno_xp_total' em app/src → 0 usos; app/src/modules/motor/jargao.js:41-46 (terceira cópia da soma)
- **Impacto:** Latência e tráfego crescentes por aluno ao longo do ano letivo (pior no 3G do celular do aluno), e três implementações da mesma regra que podem divergir (a view filtra status='valido'; o cliente filtra 'estornado' — hoje equivalentes por serem os únicos dois status, mas frágil).
- **Recomendação:** Trocar carregarXpPersistido para ler vw_aluno_xp_total (uma linha) e manter carregarEventosProgresso (já limitado a 50) para o histórico; eliminar as reduções duplicadas.
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### ARQUITETURA-09 · ⚪ BAIXA · Sem roteamento por URL: estado de navegação não sobrevive a refresh nem gera deep links

- **Descrição:** O App roteia exclusivamente por papel do token e estado local (abas via useState); a única rota real é /redefinir-senha detectada por hash. O vercel.json já reescreve tudo para index.html (SPA pronta para rotas), mas não há react-router nem history API: F5 volta o coordenador para a primeira aba, não é possível enviar link 'ficha do aluno X' para um colega, e o botão voltar do navegador sai do app — atrito real para a coordenação em uso institucional diário.
- **Evidência:** app/src/App.jsx:41-45 (AREAS por papel, sem router); grep 'react-router|useNavigate|history.pushState' em app/src → 0; vercel.json rewrites `/(.*) → /index.html`
- **Impacto:** UX institucional abaixo do padrão B2B (favoritos, links compartilháveis, voltar do navegador) e e2e/suporte mais difíceis (não há URL que reproduza um estado de tela).
- **Recomendação:** Introduzir rotas rasas por área e aba (ex.: /escola/alunos/:id) — a estrutura de cascas por papel já mapeia 1:1 para um router; fazer isso antes de crescer telas barateia o custo.
- **Esforço estimado:** dias · **Verificação:** não exigida (severidade média/baixa)

#### ARQUITETURA-10 · ⚪ BAIXA · Trilhas de log crescem sem retenção e a gravação é best-effort silenciosa para o usuário

- **Descrição:** logs_acesso (trilha LGPD — uma linha por leitura de dado de aluno por responsável), logs_coordenacao e aluno_eventos_progresso são append-only sem qualquer política de retenção/arquivamento (o registro vivo já apontava 1008 rows de logs_acesso só com seed/demo). registrarAcesso e registrarLogCoordenacao falham para console.error sem alertar ninguém — aceitável como desenho (log não pode derrubar a ação), mas sem telemetria (achado 1) uma falha sistemática da trilha LGPD passaria despercebida indefinidamente.
- **Evidência:** app/src/shared/data/index.js:782-811 (registrarAcesso/registrarLogCoordenacao com console.error e retorno {ok:false} que os chamadores ignoram); docs/00-indices/07-pendencias-para-piloto-real.md:57 (P3-1 'logs_acesso com 1008 rows sem retenção')
- **Impacto:** Com 10 escolas × 500 alunos, a trilha de acesso vira a tabela que mais cresce no banco; e uma regressão de RLS que bloqueie o insert de log LGPD deixaria a escola sem a trilha que é exigência legal, em silêncio.
- **Recomendação:** Job mensal de arquivamento/particionamento por data para as tabelas de log, e um contador de falhas de log reportado à observabilidade quando ela ganhar destino.
- **Esforço estimado:** dias · **Verificação:** não exigida (severidade média/baixa)

### Lacunas para venda (Arquitetura)

- Separação real de ambientes (demo × staging × produção em projetos Supabase distintos) — hoje é um projeto único; nenhuma escola pagante deveria entrar no banco onde roda o seed de vitrine
- Região sa-east-1 + backup automático com restore testado — a promessa LGPD 'dado de menor no Brasil' feita nos docs de fundação (argumento de venda explícito do Doc 4 §8) ainda não é verdadeira na infra
- Telemetria de produção com destino (error tracking + alerta de uptime + heartbeat da virada de semana) — sem isso não há como operar SLA para uma escola pagante
- Ambiente E2E ativo no CI (os specs Playwright existem e são pulados) e execução do teste de carga 300/10k que hoje só existe como plano escrito (perf1/plano-carga-300-500-10000.md)
- Credencial de aluno opaca — o modelo está documentado (sec3/modelo-credencial-opaca.md) mas provisionar-aluno ainda usa password = código; escolas sérias vão perguntar
- Domínio próprio / white-label de URL por escola — todas as escolas hoje compartilham rumo-a-aprova-o.vercel.app; para 'a escola se ver dona' (Doc 6 §1.2) falta ao menos domínio custom
- Módulo de Notificações (nº 8 do mapa de módulos do Doc 4 §3) — nunca construído além do e-mail de reset de senha; lembrete de meta/liberação de semana é esperado pelo comprador que viu o sistema de referência
- Roteamento por URL e deep links para uso institucional diário da coordenação (compartilhar ficha de aluno, favoritos, botão voltar)
- Tipos no seam (TypeScript ou JSDoc verificado) e conclusão da camada de contratos/DTOs — pré-requisito para escalar o time além de uma pessoa sem quebrar telas em silêncio
- Política de retenção/arquivamento de dados (logs LGPD, ledger de XP) e a limpeza física do schema (DB3: 4 tabelas deprecadas) antes de auditoria externa de um comprador
- Onboarding self-service/painel multi-escola e faturamento por tenant — corretamente adiados pelo Doc 4 §0, mas viram lacuna assim que houver mais de ~3 escolas ativas operadas manualmente pelo backoffice

---

## Front-end e UX

**Veredito:** O front-end é maduro para o estágio do produto: SPA React 19 sem router, navegação por estado, design system próprio (navy/dourado) consistente, code-splitting real (bundle inicial 124 kB gzip, recharts isolado em chunk lazy), estados de loading/erro/vazio/retry presentes nas telas centrais e uma camada de acessibilidade genuinamente implementada (labels, focus-visible, aria-live, reduced-motion). Porém a garantia "duplo envio impossível" (FE1) NÃO cobre todos os pontos de escrita (simulados e backoffice ficaram de fora), o CSV exportado não escapa injeção de fórmula, não existe deep-linking/URL nenhum, e o white-label funciona só depois do login — a tela de entrada, o título da aba e o favicon são sempre da plataforma.

### Estado atual

Arquitetura: App.jsx roteia exclusivamente por papel do token (AREAS em App.jsx:40-44) com lazy+Suspense por área; não há react-router nem URLs — toda navegação interna é useState/useReducer (navegacaoEscola.js). Sessão via useSessao.js (recarrega perfil a cada evento de auth). Design system em shared/ui/tema.js + componentes.jsx (Card, Campo com htmlFor/useId, Modal acessível com foco devolvido, Toast, skeletons, useDialogo substituindo window.confirm/prompt). White-label: BrandingContext aplica logo (URL sanitizada contra javascript:/svg), nome e cor de acento (clareada por garantirLegivel se escura demais), com preview ao vivo e aplicação imediata (Marca.jsx:33 aplicarMarca); vale só pós-login. Mobile: barra inferior fixa ≤1023px + sidebar desktop (MenuPrincipal.jsx), safe-area iOS, font-size 16 anti-zoom, overflow-x:clip, e2e mobile (Pixel 7) validando estouro horizontal. Build medido: index 433 kB (124 gzip) + CartesianChart 345 kB (101 gzip) lazy + chunks por área de 3-80 kB.

Estado real das 10 telas/fluxos mais importantes: (1) Login (Login.jsx) — bom: trava síncrona, aviso de demora >2,5s, recuperação de senha honesta, labels a11y; falha de rede vira mensagem errada "Código não reconhecido" (linha 52-53) e sem marca da escola. (2) Aluno/VisaoEstudo — a melhor tela: skeleton, ErroComRetry, vazio "trilha não configurada", modo essencial persistido, charts lazy. (3) Registrar (Registrar.jsx) — padrão-ouro: useEnvioUnico, validação por contrato puro (registroEstudo.js), toast de sucesso, confirmação ao apagar. (4) MetaSemana — funcional, mas o toggle usa guard de estado (não a trava síncrona), tolerável por ser idempotente. (5) Simulados (Progresso.jsx/SimuladoConcurso.jsx) — o ponto fraco: sem trava, sem "salvando…", exclusão sem confirmação. (6) Escola/PainelGestao+ListaAlunos+CadastroAlunos — sólido: alertas clicáveis com filtro coordenado por reducer, paginação em memória (50/pág), import CSV com preview e validação linha a linha, travas nos cadastros, concorrência limitada (10) no gerar-meta em lote. (7) FichaAluno — useRecurso, skeleton; erro sem botão de retry (usa Erro simples, FichaAluno.jsx:48). (8) Relatorios/CSV — export por aluno/turma/concurso com BOM e ; para Excel pt-BR, mas sem escape de fórmula. (9) ResumoResponsavel — muito bom para o público: semáforo, frase interpretativa, seletor multi-filho (FIX1 real no código), tudo leitura. (10) Backoffice AreaAdmin — completo funcionalmente, mas arquivo de 1.088 linhas com ~10 componentes e escrita crítica (criar escola/provisionar coordenador) no padrão antigo de estado ocupado, sem trava síncrona.

### Pontos fortes

- Code-splitting real e medido: cada área é chunk próprio e o recharts (maior dependência) só carrega ao abrir abas de gráfico — bundle inicial 124 kB gzip (App.jsx:15-19; VisaoEstudo.jsx:26-29; build verificado)
- Camada de prevenção de duplo envio bem desenhada (trava síncrona em memória + estado de UI + guarda de desmontagem) e aplicada nos formulários de maior risco: login, registro de estudo, cadastro individual/lote/CSV, turma, credenciais e vínculos (travaEnvio.js, useEnvioUnico.js, ListaAlunos.jsx:33-42)
- Estados de UI completos nas telas centrais: skeletons com aria-live, ErroComRetry com ação, estados vazios com próximo passo, stale-while-revalidate com AbortController no useRecurso (componentes.jsx:207-241, useRecurso.js:38-54)
- Acessibilidade real no código, não só no relatório: 81 htmlFor, focus-visible com anel dourado, :focus:not(:focus-visible) limpo, prefers-reduced-motion, role=dialog com devolução de foco e Esc, sr-only, aria-invalid/aria-describedby nos campos (tema.js:65-101, componentes.jsx:478-513)
- White-label pós-login funciona de ponta a ponta com salvaguardas: URL de logo sanitizada (sem javascript:/SVG), cor de acento clareada automaticamente para manter contraste, preview ao vivo e aplicação sem F5 (BrandingContext.jsx:26-33, tema.js:22-45, Marca.jsx:28-38)
- Mobile-first consistente: barra inferior na zona do polegar, safe-area iOS, inputs 16px anti-zoom, overflow-x:clip, e2e com projeto Pixel 7 validando estouro horizontal e console limpo (MenuPrincipal.jsx:137-147, mobile.spec.js, playwright.config.js:37)
- Erros técnicos nunca chegam crus à tela: tradução central com contexto, error boundary global com captura para observabilidade (erros.js, ErroFronteira.jsx)
- Validação como contrato puro e testável fora do React (registroEstudo.js), com a mesma regra alimentando dicas inline e payload do banco
- Voz de produto correta por persona: responsável tem semáforo e frase interpretativa sem jargão de jogo; aluno tem gamificação com modo essencial; coordenação tem alertas acionáveis com navegação coordenada por reducer testado (ResumoResponsavel.jsx:63-74, navegacaoEscola.js)
- E2E contra app real (build + Supabase de demo, RLS real), com diagnóstico embutido na mensagem de falha (_apoio.js:88-112)

### Achados

#### FRONTEND-01 · 🟠 ALTA · Registro de simulado aceita duplo envio e exclusão sem confirmação — fora da garantia FE1

- **Descrição:** Os dois formulários de simulado não usam useEnvioUnico nem trava síncrona, não têm estado 'salvando…' e o botão não desabilita durante o envio: duplo clique (ou toque fantasma no mobile, cenário que a própria doc do travaEnvio.js descreve) cria dois simulados idênticos, pois é um INSERT não idempotente. Além disso, o × de apagar simulado chama db.removerSimulado direto, sem o diálogo de confirmação que o mesmo app exige para apagar um registro de estudo (Registrar.jsx:79-85).
- **Evidência:** app/src/modules/desempenho/Progresso.jsx:220-232 (adicionar sem trava/ocupado) e :353 (botão × chama apagar(s.id) direto); app/src/modules/desempenho/SimuladoConcurso.jsx:72-91 (mesmo padrão)
- **Impacto:** Simulado duplicado distorce a nota, a evolução no gráfico e o comparativo que a coordenação e o responsável veem; exclusão acidental apaga dado de desempenho sem undo. Contradiz a garantia declarada da fase FE1 ('duplo envio impossível').
- **Recomendação:** Trocar os dois adicionar() para useEnvioUnico (padrão já existente em Registrar.jsx), desabilitar o botão com rótulo 'Salvando…', e usar dialogo.confirmar() no apagar, igual ao fluxo de registros.
- **Esforço estimado:** horas · **Verificação:** CONFIRMADO por céticos independentes
- **Nota do cético:** Evidência integralmente reproduzida. (1) app/src/modules/desempenho/Progresso.jsx: `adicionar` (linhas 220-232) chama db.adicionarSimulado sem useEnvioUnico/latch, sem estado 'salvando'; o botão (325) só desabilita por `estouros` (validação), que não muda durante o envio — duplo clique gera dois INSERTs idênticos; o × (353) chama `apagar(s.id)` direto, sem confirmação. (2) app/src/modules/desempenho/SimuladoConcurso.jsx (72-91, botão em 220, × em 255): mesmo padrão. (3) O INSERT não é idempotente em nenhuma camada: data/index.js:726-730 é `.insert()` cru e a tabela simulados (migrations/0001_f […]

#### FRONTEND-02 · 🟡 MÉDIA · Exportação CSV não escapa injeção de fórmula (Excel/Sheets)

- **Descrição:** celula() só faz quoting RFC 4180 (aspas/separador/quebra). Valores iniciados por =, +, -, @ ou tab vão crus para o arquivo. Nomes de aluno e de turma são texto livre (digitado ou importado por CSV pela própria escola, ou renomeado) e entram nas linhas exportadas; um nome como '=HYPERLINK(...)' ou '=cmd|...' vira fórmula ativa no Excel da coordenação. tests/csv.test.mjs não tem nenhum caso de injeção.
- **Evidência:** app/src/shared/lib/csv.js:19-26 (função celula sem prefixo de escape); consumo em app/src/modules/desempenho/Relatorios.jsx:28-37
- **Impacto:** Vetor clássico de CSV injection contra o operador da escola (quem mais exporta). Baixa probabilidade, mas dano reputacional alto para um SaaS que se vende com LGPD/segurança como diferencial.
- **Recomendação:** Em celula(), prefixar com apóstrofo (') todo valor cujo primeiro caractere seja =, +, -, @, \t ou \r, e adicionar casos de teste em csv.test.mjs. Aplicar também ao export JSON→CSV futuro.
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### FRONTEND-03 · 🟡 MÉDIA · Ausência total de roteamento/URL: sem deep-linking, F5 reseta a navegação e o botão Voltar sai do app

- **Descrição:** Não há router (package.json não tem dependência de rota; a única leitura de URL é o hash de recuperação de senha em App.jsx:36). Toda navegação — aba do aluno, aba da escola, ficha de um aluno aberto, filtros — vive em useState/useReducer. Consequências: impossível mandar link 'veja a ficha do aluno X' ou 'aba Relatórios'; recarregar a página volta sempre à aba inicial; o botão Voltar do navegador/Android abandona o site em vez de fechar a ficha; sessões de suporte não conseguem reproduzir 'a tela onde deu erro'.
- **Evidência:** app/package.json:14-19 (sem router); App.jsx:40-44 (roteamento apenas por papel); routes/escola/navegacaoEscola.js:20-39 (navegação inteira em reducer de memória)
- **Impacto:** UX abaixo do padrão esperado por escolas (coordenação vive de compartilhar telas), atrito real em suporte e treinamento, e comportamento do botão Voltar hostil no mobile — o dispositivo primário do aluno.
- **Recomendação:** Adotar rota mínima por hash ou history (ex.: /#/escola/alunos?f=sem-atividade, /#/aluno/registrar, /#/escola/aluno/:id) sincronizada com o estado atual — o reducer da escola já centraliza as transições, o que torna a sincronização barata. Priorizar back-button no mobile (fechar ficha em vez de sair).
- **Esforço estimado:** dias · **Verificação:** não exigida (severidade média/baixa)

#### FRONTEND-04 · 🟡 MÉDIA · White-label não cobre o pré-login: tela de entrada, título da aba e favicon são sempre da plataforma

- **Descrição:** O BrandingProvider só monta depois da sessão (App.jsx:110-118). A tela de Login usa marca fixa '⚓ PAINEL DE ESTUDOS' (LogoTopo), o fluxo de recuperação renderiza com escola hardcoded 'Rumo à Aprovação' (App.jsx:54), o <title> é estático ('Painel de Estudos', index.html) e o favicon é o da plataforma; nenhum uso do slug da escola em URL para personalizar antes do login. O rodapé da sidebar também assina 'Rumo à Aprovação' sempre (MenuPrincipal.jsx:132) — aceitável num white-label 'leve', mas precisa estar combinado comercialmente.
- **Evidência:** app/src/App.jsx:54 e :70 (Login fora do BrandingProvider); app/src/routes/publico/Login.jsx:242-252 (LogoTopo fixo); app/index.html:13 (<title>Painel de Estudos</title> estático, sem document.title dinâmico em src/)
- **Impacto:** O primeiro contato do aluno e do responsável com o produto (login, aba do navegador, ícone salvo na home) não carrega a marca da escola — exatamente o momento que a escola compradora de white-label mais valoriza.
- **Recomendação:** Fase 1: setar document.title e favicon com a marca após o login. Fase 2: resolver a escola pré-login via slug na URL (?e=slug ou subdomínio) com endpoint público de branding mínimo (nome/logo/cor) e aplicar o BrandingProvider também no Login.
- **Esforço estimado:** dias · **Verificação:** não exigida (severidade média/baixa)

#### FRONTEND-05 · 🟡 MÉDIA · Recarga de perfil em todo evento de auth: falha transitória durante refresh de token derruba o usuário para tela de erro

- **Descrição:** useSessao registra aoMudarSessao e chama carregarPerfil em QUALQUER evento (inclui TOKEN_REFRESHED ~1x/h e SIGNED_IN ao refocar a aba). Se meuPerfil() falhar por oscilação de rede nesse refresh em segundo plano, o catch seta perfil:null + erro, e o App substitui a área inteira pela tela 'Não foi possível carregar seu perfil' com botão 'Sair e tentar de novo' (App.jsx:86-96) — o aluno perde o contexto (formulário de registro preenchido, aba aberta) sem ter feito nada. Também custa 1-2 round-trips (souSuperAdmin + meuPerfil) por refresh sem necessidade.
- **Evidência:** app/src/shared/hooks/useSessao.js:50-53 (recarrega em todo evento) e :42 (catch zera perfil); app/src/App.jsx:86-96 (tela de erro substitui a área)
- **Impacto:** Sessões longas (aluno estudando 1h+) têm risco real de interrupção destrutiva; em rede móvel instável o cenário é comum.
- **Recomendação:** Ignorar TOKEN_REFRESHED quando já há perfil carregado (ou recarregar em silêncio mantendo o perfil anterior em caso de falha — padrão stale-while-revalidate que o próprio useRecurso já implementa).
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### FRONTEND-06 · 🟡 MÉDIA · Backoffice (AreaAdmin) usa o padrão antigo de guard por estado em escritas críticas — sem trava síncrona

- **Descrição:** Criar escola (+ provisionar coordenador com envio de link de acesso), editar escola, mudar status e reenviar acesso usam apenas `const [ocupado, setOcupado] = useState(false)` + disabled — exatamente o padrão que a documentação do travaEnvio.js:5-14 descreve como insuficiente (dois disparos no mesmo tick leem ocupado===false). Duplo clique pode criar duas escolas (se slugs distintos por retry manual) ou disparar dois provisionamentos/e-mails de coordenador.
- **Evidência:** app/src/routes/admin/AreaAdmin.jsx:290-335 (criar escola sem trava), :698-710 (editar), :779-793 (status), :979-1008 (provisionar/reenviar); contraste com a regra declarada em app/src/shared/lib/travaEnvio.js:5-22
- **Impacto:** Ações mais sensíveis do sistema (provisionamento de tenant e credenciais) ficaram fora da garantia FE1; risco operacional interno (super_admin), não de tenant, mas gera lixo de dados e e-mails duplicados.
- **Recomendação:** Migrar os 4 fluxos para useEnvioUnico — é troca mecânica, o hook já existe e cobre erro padronizado.
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### FRONTEND-07 · ⚪ BAIXA · Parser de CSV de importação de alunos é naïve (não trata aspas RFC 4180)

- **Descrição:** parsearCsv divide cada linha por /[,;|\t]/ e apenas remove aspas das pontas: um nome exportado do Excel como "Silva, Maria" é cortado na vírgula (nome vira 'Silva' e turma vira 'Maria'); nome contendo | também quebra. O preview com validação linha a linha mitiga (a coordenação vê o resultado antes de importar), mas o erro é silenciosamente plausível de passar em lote grande.
- **Evidência:** app/src/modules/pessoas/CadastroAlunos.jsx:25-35 (split por regex sem estado de aspas)
- **Impacto:** Importação de planilhas reais de secretaria (que usam vírgula + aspas) gera nomes truncados ou linhas inválidas em massa.
- **Recomendação:** Implementar parsing com máquina de estados para campos entre aspas (ou detectar o separador majoritário por linha) e adicionar testes com nomes contendo vírgula.
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### FRONTEND-08 · ⚪ BAIXA · Validação do registro de estudo não limita data (futura/antiga) nem rejeita acertos negativos

- **Descrição:** validarRegistroEstudo passa form.data cru para o payload (aluno pode registrar estudo numa data futura, poluindo streak/semana) e Number('-5') em acertos passa (só valida acertos > questoes; o min=0 do input não impede colar/digitar). A defesa final é do banco, mas o contrato foi criado justamente para ser a fronteira de higiene.
- **Evidência:** app/src/shared/contratos/registroEstudo.js:39-72 (sem validação de data nem de acertos < 0); app/src/modules/motor/Registrar.jsx:147 (input date sem max)
- **Impacto:** Dados de progresso inconsistentes (dias 'estudados' no futuro) distorcem métricas de semana e alertas da coordenação.
- **Recomendação:** No contrato: rejeitar data > hoje (e opcionalmente < início da trilha) e acertos/questoes negativos; setar max={todayISO()} no input de data.
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### FRONTEND-09 · ⚪ BAIXA · Resíduos de acessibilidade: navegação sem aria-current, abas sem semântica de tabs, headings em div e fontes de 8.5-10.5px

- **Descrição:** O relatório UX1 é fiel no que afirma (verificado: 81 htmlFor, focus-visible, aria-live, reduced-motion existem no código), mas as pendências que ele mesmo declara seguem abertas: itens de menu ativos são só cor (sem aria-current='page' em MenuPrincipal), o componente Tabs não tem role=tablist/aria-selected, títulos de seção são div.disp (hierarquia h1-h3 ausente fora de Cabecalho/SectionCard), e há textos funcionais de 8.5-10.5px (ex.: 'dias p/ prova' 9.5px no Cabecalho, rótulos de StatCard 10.5-11px). axe/Lighthouse nunca rodaram (assumido pelo próprio checklist).
- **Evidência:** app/src/shared/ui/MenuPrincipal.jsx:95-121 (botões de nav sem aria-current); componentes.jsx:306-324 (Tabs sem roles); docs/auditoria/ux1/checklist-acessibilidade.md:74 e :80 (pendências declaradas); Cabecalho.jsx:29 (fontSize 9.5)
- **Impacto:** Leitor de tela não anuncia qual aba está ativa; usuários de baixa visão sofrem com os micro-textos; sem verificação automatizada, regressões de a11y passam.
- **Recomendação:** Adicionar aria-current/aria-selected (1-2 linhas por menu), integrar @axe-core/playwright na suíte e2e existente, e estabelecer piso de 11px para texto informativo.
- **Esforço estimado:** dias · **Verificação:** não exigida (severidade média/baixa)

#### FRONTEND-10 · ⚪ BAIXA · Fontes carregadas do Google Fonts em runtime (dependência externa, FOUT e IP de menores enviado a terceiro)

- **Descrição:** FONTES_CSS faz @import de fonts.googleapis.com dentro de <style> injetado por componente — carrega tarde (FOUT), falha sem rede/bloqueadores (tipografia degrada para Georgia/system) e envia IP + user-agent dos usuários (incluindo alunos menores de idade) ao Google, ponto sensível para o discurso LGPD do produto.
- **Evidência:** app/src/shared/ui/tema.js:47-48 (@import url('https://fonts.googleapis.com/css2?family=Fraunces...'))
- **Impacto:** Perf (fonte após o JS), robustez (escolas com filtro de rede corporativo/escolar bloqueando Google) e coerência com o posicionamento de privacidade.
- **Recomendação:** Self-host das duas famílias (woff2 no bundle/Vercel) com font-display: swap e preload no index.html.
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### FRONTEND-11 · ⚪ BAIXA · Toggle de atividade da meta usa guard de estado em vez da trava síncrona

- **Descrição:** mudar() em MetaSemana usa `if (ocupado) return` com useState — o mesmo anti-padrão documentado em travaEnvio.js. Como definirEstadoAtividade é idempotente (define um estado, não insere), o dano de um duplo disparo é nulo ou um toggle a mais; ainda assim é inconsistente com o padrão da casa.
- **Evidência:** app/src/modules/motor/MetaSemana.jsx:74-82
- **Impacto:** Inconsistência de padrão; risco funcional baixo (operação idempotente).
- **Recomendação:** Trocar para useEnvioUnico na próxima passada de manutenção.
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### FRONTEND-12 · ⚪ BAIXA · Mensagem de erro do login mascara falha de rede como credencial inválida

- **Descrição:** O catch de entrar() ignora a exceção e sempre exibe 'Código não reconhecido. Confira com a escola.' / 'E-mail ou senha incorretos.' — mesmo quando a causa foi rede/timeout. O usuário conclui que o código está errado e liga para a escola; o app tem detector de erro de rede (erros.js REDE) mas não o usa aqui.
- **Evidência:** app/src/routes/publico/Login.jsx:52-57 (catch sem inspecionar o erro); contraste com app/src/shared/lib/erros.js:18 e :40
- **Impacto:** Chamados de suporte falsos ('meu código não funciona') em dias de instabilidade; primeiro contato do usuário com o produto termina em mensagem errada.
- **Recomendação:** Testar REDE.test(e.message) no catch e exibir 'Sua conexão parece instável…' quando for o caso.
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### FRONTEND-13 · ⚪ BAIXA · AreaAdmin.jsx com 1.088 linhas e ~10 componentes num arquivo; estilo 100% inline em todo o app

- **Descrição:** O maior arquivo do front concentra dashboard, lista, detalhe, formulários e modais do backoffice; o restante do app é disciplinado (maioria <300 linhas), mas todo o estilo é objeto inline repetido (inputS/lbl/selS redefinidos em ~8 arquivos), o que dificulta evolução visual consistente e incha o JSX. useEffect e estados estão, no geral, bem cuidados (guarda vivo, deps corretas) — a dívida é de organização, não de correção.
- **Evidência:** wc -l: app/src/routes/admin/AreaAdmin.jsx = 1088 linhas; duplicação de inputS em Progresso.jsx:214, SimuladoConcurso.jsx:66, Login.jsx:74 vs. useInputStyle já existente em componentes.jsx:92-98
- **Impacto:** Custo de manutenção e onboarding de novos devs; risco de divergência visual conforme o time cresce.
- **Recomendação:** Quebrar AreaAdmin em módulos (Dashboard, NovaEscola, DetalheEscola, Logs) e padronizar todos os inputs no useInputStyle/Campo já existentes.
- **Esforço estimado:** dias · **Verificação:** não exigida (severidade média/baixa)

### Lacunas para venda (Front-end e UX)

- Roteamento com URLs reais (deep-link para ficha de aluno, abas e filtros; botão Voltar do celular funcional) — hoje nenhuma tela é endereçável, o que trava suporte, treinamento e integração com e-mails/relatórios
- White-label pré-login e de navegador: página de login com a marca da escola (slug/subdomínio), document.title, favicon e theme-color dinâmicos — sem isso o 'white-label' vendável é apenas parcial
- PWA/instalabilidade e tolerância offline: não há manifest nem service worker; o aluno (mobile-first) não consegue 'instalar' o app nem registrar estudo sem rede — capacidade padrão em concorrentes de estudo
- Notificações ao aluno/responsável (push/e-mail: lembrete de meta, resumo semanal ao responsável) — o front não tem nenhuma superfície de notificação; o responsável só vê algo se abrir o app
- Autogestão de conta da coordenação: não existe tela para trocar a própria senha/e-mail logado (só o fluxo 'esqueci minha senha'), nem gestão de múltiplos usuários de coordenação pela própria escola
- Escala de UI acima de ~500 alunos: a Área da Escola carrega 9 consultas com a base inteira e pagina só em memória (paginacao.js); falta paginação/busca server-side e virtualização (react-window ausente — confirmado no registro vivo, camada 4.4) para o teto de 10k do plano de carga
- Auditoria de acessibilidade automatizada (axe/Lighthouse no CI) e correção das pendências declaradas (headings semânticos, aria-current) — necessário para vender a escolas públicas/licitações que exigem conformidade
- Cobertura e2e mobile de fluxos de escrita (registrar estudo, cadastrar aluno no celular): o mobile.spec.js só valida estouro horizontal e presença da barra inferior
- Tour/onboarding guiado da coordenação no primeiro acesso (o produto depende de a escola configurar turma→aluno→credencial→concurso na ordem certa; hoje só há estados vazios com dicas)
- Página institucional/planos e fluxo self-service de demonstração — o front começa no login; toda venda depende de provisionamento manual via backoffice

---

## Pedagogia e conteúdo

**Veredito:** A engenharia pedagógica está pronta e é honesta — fábrica de conteúdo com validador que impede maturidade mentirosa, motor de progresso idempotente no banco, simulado fiel ao edital de cada concurso, virada de semana server-side sólida — mas o produto pedagógico em si só existe para o Colégio Naval: 1 trilha real (9 semanas/50 atividades, autorada pelo dono) que expira em 01/08/2026, contra 5 concursos sem experiência de estudo utilizável, 3 questões de prova tagueadas e recorrência apenas de amostra. Uma escola CN poderia pagar hoje por um piloto curto e supervisionado; qualquer escola dos demais concursos compraria uma casca vazia com aviso honesto. O gargalo declarado e verdadeiro é material-fonte e autoria do dono (editais, provas, metodologia semanal), não código: antes de vender é indispensável produzir a trilha EsPCEx completa, o ciclo CN/2027 e um mínimo de assuntos para EEAr/ESA/EPCAR, além de resolver as incoerências internas do motor (critérios de missão, dupla estrutura de prova, missões inalcançáveis).

### Estado atual

O modelo pedagógico implementado é um ciclo semanal de coorte: uma trilha datada por concurso (trilhas→trilha_semanas→atividades_modelo, geradas de JSON versionado por scripts/gerar-seed-trilha.mjs) vira meta semanal por aluno via app.gerar_meta/app.virar_semana (0003/0035, cron em 0004, timezone America/Sao_Paulo, clamp na primeira/última semana). O aluno registra estudo autodeclarado (questões/acertos/tempo por disciplina da trilha) e simulados; gatilhos SECURITY DEFINER (0024 C0 + 0033 PED1) alimentam um ledger único de XP (aluno_eventos_progresso: objetivo F/P/X = 100/60/40, simulado = 50, registro = 0), fecham missões por volume+acurácia (aluno_missoes), persistem nível por matéria (aluno_niveis, mesma régua de niveisAluno.js: <40% base, ≥70% com ≥100 questões avançado) e nunca deixam o aluno se autopontuar por API. A gamificação visível (13 patentes militares, conquistas derivadas no cliente) vem de jargao.js/Conquistas.jsx; o subsistema 15.5 do banco (patentes, conquistas com xp_bonus, aluno_xp_eventos) foi desligado pela 0037 e está deprecado. O simulado por concurso (0014 + simuladoConcurso.js) avalia contra a estrutura oficial do edital (prova_materias/prova_dias, status 'oficial'), aplica modelo de eliminação por piso absoluto (CN 50%, FAB 5,0) ou mediana (EsPCEx/ESA — com proxy de 60% explicitamente marcado como inferência), papel da redação por edital e gera alertas de risco; a nota projetada (mat+ing)×2,5 é a regra legada do CN Dia 1, preservada e correta para esse concurso.\n\nO conteúdo real, medido nos seeds e confirmado pelo relatório PED2-R2 contra o banco remoto (03/07/2026), é: CN 'completa' — 9 semanas, 50 atividades-modelo, estrutura de prova oficial, 6 assuntos (5 de Biologia + Geometria Plana) e 3 missões; EsPCEx 'beta' — estrutura oficial de 2 dias com pesos, 5 assuntos em 3 de 7 matérias objetivas (um em status 'validar' por suspeita de OCR), 2 missões e 0 semanas de trilha; EEAr/ESA/EPCAR 'esqueleto' — estrutura oficial de prova, 0 assuntos, 1 missão cada; CM 'indisponivel' — só o cadastro, bloqueado para alunos. Provas anteriores: 1 referência (CPACN 2024) sem documento; questoes_prova: 3 (amostra); recorrencia_assunto: 3 (amostra CN). Não há nenhum PDF/edital no repositório ou no storage. O selo de maturidade (0034 + maturidade.js como fonte única + SeloMaturidade/AvisoMaturidade) comunica isso com honestidade real: o cadastro mostra o nível ao lado de cada concurso e recusa CM, a área do aluno exibe o aviso, o validador (validar-conteudo.mjs) derruba o build se a matriz prometer mais que os seeds entregam, e a view vw_concurso_qualidade audita o espelho no banco. A fábrica de conteúdo (pipeline de 6 passos documentado em fabrica-trilhas-concursos.md, com JSON→SQL gerado, IDs determinísticos e 4 porteiros automáticos) é tecnicamente barata e sustentável; o custo real é editorial e está fora do repositório — edital, provas com gabarito e a metodologia semanal 'pensada prova a prova' que a decisão 16 reserva ao dono (bus factor de uma pessoa). A cobertura de testes da dimensão é extensa (471 testes, incluindo pedagogia, missões, níveis, simulado por concurso, maturidade e o motor PED1), mas os E2E de UI dos fluxos pedagógicos existem e são pulados sem secrets de staging.

### Pontos fortes

- Honestidade epistemológica sistêmica e rara: status_dado oficial/inferencia/validar em toda config pedagógica (06_pedagogia.sql), proxy de mediana explicitamente marcado como inferência (simuladoConcurso.js:15-17), recorrência 'estimada' proibida de promover prioridade (recorrencia.js:24-26), e a decisão PED2-R2 de NÃO inventar trilhas sem fonte real
- Selo de maturidade com dentes: fonte única em maturidade.js, validador que quebra o build se um concurso prometer mais que o conteúdo (validar-conteudo.mjs:177-186), gates reais no cadastro (CM recusa aluno, só CN recebe trilha) e aviso visível ao aluno e à coordenação — o sistema não vende trilha parcial como pronta por construção
- Fábrica de conteúdo versionada e barata tecnicamente: JSON autoral → SQL gerado com IDs determinísticos e idempotência (gerar-seed-trilha.mjs), pipeline de 6 passos documentado com 4 porteiros automáticos, espelho de maturidade gerado (nunca editado à mão) — adicionar concurso novo não exige código de UI
- Motor de progresso correto onde importa: ledger único de XP idempotente por idempotency_key, aluno não se autopontua por API (SECURITY DEFINER), nível calculado nunca sobrescreve ajuste manual da coordenação, exception-safe (motor nunca derruba um registro de estudo) — 0024/0033 com 10 testes de banco dedicados
- Fidelidade real aos editais na estrutura de prova: pisos por disciplina com fonte citada (CN 6.5, ESA Art. 68), modelos de eliminação distintos por concurso (absoluto vs mediana), papel da redação por edital, EEAr sem redação e com especialidade/ciclo — cada concurso tratado separadamente por exam_tag, sem mistura
- A trilha CN autoral é pedagogicamente sólida para o público: progressão base→geometria→consolidação→reta final, prioridades F/P/X, simulados semanais crescentes, ênfase em provas antigas e 'caderno de pegadinhas da banca', descanso estratégico na semana final — metodologia de quem conhece a prova, protegida contra reescrita ('NÃO reescrever')
- Virada de semana robusta e operável: agendada no banco, timezone Brasil, idempotente, variante por escola (0035) restrita a service_role com comparação timing-safe na Edge Function
- Simulado por concurso funciona ponta a ponta: registro no formato do edital com validação de máximos, redação com aptidão, alertas de risco de eliminação, insumo para nível — persistido com exam_tag/redacao_nota (0014) e coberto por teste de fluxo (simulado-concurso-fluxo-db.test.mjs)

### Achados

#### PEDAGOGIA-01 · 🔴 CRÍTICA · Só 1 dos 6 concursos tem produto pedagógico utilizável — aluno de EsPCEx/EEAr/ESA/EPCAR cai numa tela vazia

- **Descrição:** A única trilha semanal existente é a do CN (trilha-cn-v1.json: 9 semanas, 50 atividades — número confirmado pela PED2-R2 em três medições). EsPCEx tem 5 assuntos em 3/7 matérias e 0 semanas de trilha; EEAr/ESA/EPCAR têm 0 assuntos e 1 missão cada; CM não tem nada e é bloqueado no cadastro. Como o cadastro só atribui trilha a concurso 'completa' (podeAtribuirTrilhaSemanal → só CN) e a área do aluno faz early-return de TODAS as abas quando não há trilha (VisaoEstudo.jsx:142: 'Trilha ainda não configurada'), um aluno matriculado em qualquer concurso beta/esqueleto não consegue registrar estudo, não ganha XP, não vê missões nem simulados — o produto inteiro se reduz ao onboarding + aviso de maturidade. 'aceitaAluno: true' para beta/esqueleto (maturidade.js:42-57) é, na prática, aceitar um aluno para um produto vazio.
- **Evidência:** app/src/routes/aluno/VisaoEstudo.jsx:142-150 (return antecipado sem trilha); app/src/modules/pessoas/CadastroAlunos.jsx:81,91 (trilha só se podeAtribuirTrilhaSemanal); docs/conteudo/gaps-material-fonte-concursos.md:44-50 ('espcex: 0 semanas'; 'eear/esa/epcar: 0 assuntos'); supabase/seed/trilha-cn-v1.json (única trilha); docs/auditoria/ped2-r2/relatorio-ped2-r2-conteudo-trilhas.md §0.3
- **Impacto:** O sistema só é vendável a escolas que preparem exclusivamente para o Colégio Naval. Para os outros 5 concursos do posicionamento comercial, a escola pagaria por cadastro + aviso honesto de que não há conteúdo. O bloqueio declarado é material-fonte do dono (decisão 16 do build), não código.
- **Recomendação:** Priorizar a produção EsPCEx→completa (edital Anexo C + metodologia semanal do dono + provas), seguindo o molde CN pela fábrica já pronta; enquanto isso, considerar uma experiência mínima sem trilha (registro livre por matéria da estrutura de prova) para beta/esqueleto não ser tela morta.
- **Esforço estimado:** semanas · **Verificação:** CONFIRMADO por céticos independentes
- **Nota do cético:** Todas as evidências foram reproduzidas no código e nos docs. (1) VisaoEstudo.jsx:142-150 tem o return antecipado 'Trilha ainda não configurada' ANTES da montagem das abas (linha 160+), bloqueando Hoje/Registrar/Desempenho/Simulados/Conquistas/Histórico/Plano de uma vez; useTrilha.js:14 confirma que aluno sem trilha_id recebe trilha=null sem fallback. (2) CadastroAlunos.jsx:81,91 (e 219/230 no lote) só atribui trilha quando podeAtribuirTrilhaSemanal(codigo) é true, o que maturidade.js:39,160-162 restringe a maturidade 'completa' — hoje só o CN; maturidade.js:42-57 tem aceitaAluno:true + temTril […]

#### PEDAGOGIA-02 · 🟠 ALTA · A única trilha 'completa' (CN) é um calendário fixo que termina em 01/08/2026 — 2,5 semanas após a data desta auditoria

- **Descrição:** A trilha CN v1 é datada (semana 1: 2026-05-30; semana 9: fim 2026-08-01) para a edição CPACN/2026. A regra sagrada de semana ativa faz clamp na última semana ('depois da última vale a última' — regras.js:35-39 e app.semana_da_data em 0003:38-41), então a partir de 02/08/2026 todo aluno CN fica preso para sempre na semana 9 ('Ajuste fino e descanso estratégico'), a virada de semana não gera mais nada de novo e nenhum estado de 'ciclo encerrado' existe na UI. Uma turma nova (ciclo 2027) não tem calendário nenhum: seria preciso autorar trilha-cn-v2.json com novas datas. O modelo é de coorte única global — aluno que entra no meio cai na semana corrente do calendário, não na semana 1 do seu percurso.
- **Evidência:** supabase/seed/trilha-cn-v1.json:18-95 (datas fixas 2026-05-30 a 2026-08-01); app/src/shared/regras/regras.js:35-39 (clamp); supabase/migrations/0003_motor_lgpd.sql:38-41 (mesmo clamp no servidor)
- **Impacto:** O único conteúdo vendável expira em ~2,5 semanas. Um piloto iniciado em agosto/2026 nasceria com a trilha morta. Renovar exige nova autoria datada a cada edição, por concurso — sem processo de re-datação por turma/coorte, o produto não sustenta operação contínua de escola.
- **Recomendação:** Criar trilha CN v2 (ciclo CPACN/2027) e decidir o modelo de coorte: datas por turma/escola (offset a partir do início da turma) em vez de datas absolutas globais; adicionar estado explícito de 'ciclo encerrado' na UI e na virada.
- **Esforço estimado:** dias · **Verificação:** verificação não concluída (limite de sessão)

#### PEDAGOGIA-03 · 🟡 MÉDIA · Duas fontes divergentes de estrutura de prova: ranking da turma e resumo do responsável usam números errados

- **Descrição:** Existe a estrutura oficial no banco (07_provas.sql, status 'oficial', usada pelo SimuladoConcurso) e um catálogo hardcoded legado (provas.js, marcado 'aprox.') que diverge dela: ESA com 40 questões (12+12+8+8) contra 50 oficiais (14+14+6+6+10); EsPCEx com dias trocados e sem his/geo separados; EPCAR com 20 questões/matéria contra 16 oficiais; CN Dia 2 com fis/qui max 10 e chave 'soc' contra fis/qui/bio 6 cada + his/geo. ClassificacaoTurma.jsx:72 e ResumoResponsavel.jsx:52 leem o catálogo legado, mas os simulados novos são salvos pelo SimuladoConcurso com as chaves oficiais (bio/his/geo — SimuladoConcurso.jsx:76-79): esses acertos são ignorados ou zerados no ranking e no semáforo do responsável (chave 'soc' inexistente no dado novo).
- **Evidência:** app/src/modules/conteudo/provas.js:35-47 (ESA 40q, chave 'soc') vs supabase/seed/07_provas.sql:87-98 (ESA oficial 50q); consumidores: app/src/modules/desempenho/ClassificacaoTurma.jsx:72 e ResumoResponsavel.jsx:52; gravação nova: app/src/modules/desempenho/SimuladoConcurso.jsx:76-79
- **Impacto:** Percentuais e totais de acertos exibidos a pais e coordenação ficam subcontados/incorretos para simulados registrados no formato por concurso — exatamente as telas que sustentam a percepção de valor da escola.
- **Recomendação:** Aposentar provas.js e fazer ClassificacaoTurma/ResumoResponsavel/metricas lerem a estrutura oficial do banco (carregarEstruturaProva), com mapeamento de compatibilidade para simulados antigos com chave 'soc'.
- **Esforço estimado:** dias · **Verificação:** não exigida (severidade média/baixa)

#### PEDAGOGIA-04 · 🟡 MÉDIA · Critério de missão mostrado ao aluno não é o critério que o motor aplica

- **Descrição:** A UI exibe o criterio_conclusao textual ('≥60 questões e ≥80% nas últimas 30, incluindo nível 3' — seed 09:38-39), mas o motor fecha por meta_questoes + meta_acuracia, com a acurácia backfilled uniforme em 70% para TODAS as missões (seed 09:90-93) e calculada sobre o acumulado de vida inteira da matéria, sem janela móvel (0033:160-167,180). Uma missão que promete 80% nas últimas 30 fecha com 70% acumulado. Além disso, missões de assunto (ex.: 'Fechar Geometria Plana') contam qualquer questão da matéria 'mat', pois registros_estudo não têm assunto — limitação admitida no relatório PED1 §7, mas não comunicada ao aluno.
- **Evidência:** supabase/seed/09_trilhas_missoes.sql:38-39 e 90-93; supabase/migrations/0033_ped1_missoes_niveis.sql:160-167,180; docs/auditoria/ped1/relatorio-ped1-motor-progresso-vivido.md §7
- **Impacto:** O contrato pedagógico exibido ao adolescente é diferente do executado: missões 'de domínio' fecham sem domínio do assunto e com barra menor que a prometida — corrói a credibilidade do selo de conclusão junto a aluno e coordenação.
- **Recomendação:** Ou exibir na UI o critério estruturado real (volume + acurácia acumulada 70%), ou implementar a janela móvel prometida; calibrar meta_acuracia por missão em vez do 70% uniforme.
- **Esforço estimado:** dias · **Verificação:** não exigida (severidade média/baixa)

#### PEDAGOGIA-05 · 🟡 MÉDIA · Missões estruturalmente inalcançáveis: matéria da missão não existe no registro de estudo

- **Descrição:** O motor casa registros_estudo.disciplina_codigo com missoes.materia_codigo (0033:166), mas o seletor do Registrar só oferece as disciplinas da trilha do aluno (Registrar.jsx:115). A trilha CN não tem disciplina 'bio' (tem 'soc' e 'prov'), então a missão CN 'Citologia sem susto' (materia 'bio', seed 09:43-45) fica eternamente em 0/30 no painel MissoesPersistidas — o aluno a vê e nunca pode progredir. As missões dos demais concursos (espcex/eear/esa/epcar) são duplamente inertes: seus alunos não têm trilha e nem chegam ao Registrar.
- **Evidência:** supabase/migrations/0033_ped1_missoes_niveis.sql:166 (match por disciplina_codigo); app/src/modules/motor/Registrar.jsx:115 (picker = trilha.disciplinas); supabase/seed/trilha-cn-v1.json:8-15 (sem 'bio'); supabase/seed/09_trilhas_missoes.sql:43-45 (missão cn/bio)
- **Impacto:** Elemento de gamificação visivelmente quebrado para todo aluno CN (missão impossível), o tipo de detalhe que adolescente percebe rápido e que mina a confiança no sistema de progresso.
- **Recomendação:** Alinhar o vocabulário: ou mapear disciplinas da trilha ↔ matérias oficiais (soc→his+geo, incluir bio), ou remover/ajustar missões cuja matéria não é registrável pelo aluno.
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### PEDAGOGIA-06 · 🟡 MÉDIA · Subsistema de gamificação da Fase 15.5 está morto e divergente do que a UI exibe

- **Descrição:** A migration 0037 (FIX2) transformou em no-op os dois escritores de conquistas (C0 e PED1) e carimbou como DEPRECADAS as 4 tabelas da 15.5 (aluno_xp_eventos, patentes, conquistas, aluno_conquistas). Resultado: as 10 conquistas do catálogo do banco com xp_bonus (100–180 XP) nunca são concedidas; a aba Conquistas do aluno deriva um catálogo próprio no cliente; e há duas escalas de patentes divergentes (banco: 8 níveis, recruta 0→aspirante 13.000, com critérios pedagógicos adicionais; front jargao.js: 13 níveis, cabo 700 vs 800 no banco, topo Coronel 13.500). gamificacao.js (multiplicadores por peso/dificuldade, bônus de 150 XP por simulado vs 50 do motor real) não tem nenhum importador — é lógica órfã. A decisão foi documentada, mas a divergência de catálogos e regras permanece como dívida sem plano de reconvergência de produto (DB3 só prevê remoção física).
- **Evidência:** supabase/migrations/0037_fix2_deprecar_escrita_conquistas.sql:36-56 (no-ops e comentários DEPRECADA); supabase/seed/10_gamificacao.sql:14-40 (patentes 8 níveis e conquistas com xp_bonus) vs app/src/modules/motor/jargao.js:62-76 (13 patentes, valores distintos); grep sem importadores de app/src/modules/conteudo/gamificacao.js
- **Impacto:** O desenho pedagógico da gamificação (conquistas por acurácia/constância com XP, patentes com critério adicional anti-grind) descrito nas fases 15.5 não é o que roda; o que roda é uma versão mais pobre derivada no cliente. Três fontes de regra convivendo dificultam calibração e qualquer promessa comercial sobre gamificação.
- **Recomendação:** Decidir formalmente o modelo-alvo (provavelmente: ledger C0 + catálogo único em jargao.js), remover fisicamente o subsistema morto (DB3) e apagar gamificacao.js/valores conflitantes, ou religar o catálogo do banco na UI.
- **Esforço estimado:** dias · **Verificação:** não exigida (severidade média/baixa)

#### PEDAGOGIA-07 · 🟡 MÉDIA · Onboarding pedagógico coleta diagnóstico que nenhum motor consome

- **Descrição:** O onboarding do aluno (experiência prévia, disponibilidade semanal, maior dificuldade, objetivo) grava em aluno_onboarding via RPC e some da tela — mas nada o consome: app.gerar_meta ignora disponibilidade (meta é sempre a semana da trilha com as mesmas atividades e 250 questões), nenhum nível inicial é atribuído a partir dele, e sugerirNivelInicial (niveisAluno.js:106), feito exatamente para isso, não tem nenhum chamador no app. O próprio código admite 'é insumo, não regra' (Onboarding.jsx:7), porém o aluno responde 'quantas horas por semana você consegue estudar?' e recebe exatamente o mesmo plano de quem respondeu o triplo.
- **Evidência:** app/src/modules/motor/Onboarding.jsx:1-50; supabase/migrations/0003_motor_lgpd.sql:47-79 (gerar_meta sem uso do onboarding); app/src/modules/conteudo/niveisAluno.js:106 (sugerirNivelInicial sem consumidores — grep só mostra a definição)
- **Impacto:** A promessa implícita de personalização ('ajuda a orientar seu estudo') não se cumpre; para adolescentes com disponibilidades muito díspares, meta única de 250 questões/semana pode ser desmotivadora ou frouxa. A coordenação até vê as respostas, mas todo ajuste é manual.
- **Recomendação:** No mínimo, usar a disponibilidade declarada para modular a meta de questões da semana e sinalizar à coordenação alunos cuja meta é implausível; em seguida, ligar sugerirNivelInicial ao aluno_niveis inicial.
- **Esforço estimado:** dias · **Verificação:** não exigida (severidade média/baixa)

#### PEDAGOGIA-08 · 🟡 MÉDIA · Todo o motor pedagógico roda sobre autodeclaração sem nenhuma checagem de plausibilidade

- **Descrição:** Não há banco de questões no produto: o aluno resolve fora e digita questões/acertos (Registrar.jsx), marca objetivos como concluídos (100/60/40 XP por checkbox — 0024:81-86) e digita o próprio resultado de simulado (50 XP — 0024:88). Missões fecham e níveis sobem por esses números (0033), o ranking da turma (ClassificacaoTurma) e o semáforo do responsável derivam deles, e a UI afirma 'XP só vem de estudo real' (Conquistas.jsx:115). Um adolescente pode registrar 200 questões com 100% de acerto e fechar todas as missões em um dia; não existe teto diário, detecção de outlier nem revisão obrigatória da coordenação. O anti-gaming existente (registro puro = 0 XP; missão exige acurácia) só valida números autodeclarados.
- **Evidência:** app/src/modules/motor/Registrar.jsx:27,114-115 (entrada manual); supabase/migrations/0024_motor_progresso.sql:81-95 (XP por objetivo/simulado); supabase/migrations/0033_ped1_missoes_niveis.sql:180 (missão fecha pelos números digitados); app/src/modules/motor/Conquistas.jsx:115
- **Impacto:** Em produção com adolescentes competindo em ranking, a integridade dos dados pedagógicos (nível, missões, semáforo dos pais, ranking) depende só de honestidade — risco real de o valor de acompanhamento vendido à escola ser corrompido.
- **Recomendação:** Curto prazo: tetos e sinalização de implausibilidade (ex.: >X questões/dia, acurácia 100% recorrente) visíveis à coordenação; médio prazo: banco de questões interno ao menos para checkpoints de missão.
- **Esforço estimado:** dias · **Verificação:** não exigida (severidade média/baixa)

#### PEDAGOGIA-09 · 🟡 MÉDIA · Promessa de 'prioridade por recorrência' sem nenhuma medida real: 3 registros de amostra e 0 questões tagueadas

- **Descrição:** A infraestrutura de recorrência (0015, recorrencia.js com a regra de ouro 'estimada não promove prioridade') está pronta e testada, mas o banco remoto tem apenas a amostra do seed: 1 prova referenciada sem documento (CPACN 2024, status 'validar'), 3 questões em questoes_prova e 3 linhas de recorrência (2 estimadas, 1 medida), todas CN. As prioridades de assunto que ordenam trilha e missões estão marcadas como 'preliminar (peso × recorrência)' sem recorrência medida atrás (07_provas.sql:112-113). O sistema é honesto sobre isso (status 'validar' em config_oficial), mas o diferencial pedagógico anunciado não existe em dado.
- **Evidência:** docs/auditoria/ped2-r2/relatorio-ped2-r2-conteudo-trilhas.md §0.1 (medição remota: 3 questões, 3 recorrências, tudo amostra); supabase/seed/07_provas.sql:112-113; supabase/seed/06_pedagogia.sql:72-76 (recorrencia_status 'validar' nos 5 concursos); app/src/modules/conteudo/recorrencia.js:24-33
- **Impacto:** Qualquer discurso comercial sobre 'estudo guiado pelo que mais cai' seria inverificável; as prioridades alta/média/baixa exibidas derivam de juízo editorial, não de medição.
- **Recomendação:** Adquirir provas oficiais + gabaritos (começando pelas 10 provas do CN que a própria trilha manda o aluno refazer) e taguear via questoes_prova para promover recorrência a 'medida' — é trabalho contínuo de conteúdo, não de código.
- **Esforço estimado:** semanas · **Verificação:** não exigida (severidade média/baixa)

#### PEDAGOGIA-10 · ⚪ BAIXA · Economia de XP descalibrada da escala de patentes: 8 de 13 patentes são inalcançáveis no ciclo completo

- **Descrição:** O ciclo CN inteiro (9 semanas) rende no máximo ~4.950 XP: 34 atividades F×100 + 16 P×60 = 4.360, + 8 simulados×50 = 400, + missões CN (100+50+40) = 190 — conquistas com bônus estão desligadas (0037). A escala do front vai até Coronel com 13.500 XP; um aluno perfeito termina o ciclo como 2º Tenente (4.500). A metade de cima da carreira exibida na aba Conquistas é decorativa.
- **Evidência:** app/src/modules/motor/jargao.js:62-76 (PATENTES até 13.500); contagem medida em trilha-cn-v1.json (34 F, 16 P); supabase/migrations/0024_motor_progresso.sql:81-95 (valores de XP)
- **Impacto:** Menor: a progressão percebida estagna e a promessa visual de carreira não fecha com a matemática — relevante porque patente é o eixo motivacional central do produto para adolescentes.
- **Recomendação:** Calibrar a escala para o XP realmente emissível por ciclo (ou tornar o XP acumulável entre ciclos/versões de trilha de forma deliberada e documentada).
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### PEDAGOGIA-11 · ⚪ BAIXA · Meta semanal única de 250 questões para todas as semanas e todos os alunos

- **Descrição:** metaQuestoesSemana=250 é um escalar único do JSON aplicado pelo gerador a todas as 9 semanas (gerar-seed-trilha.mjs:46) e usado como fallback na UI (VisaoEstudo.jsx:135 '?? 250'). Não varia por fase do ciclo (semana 1 de diagnóstico = semana 8 de reta final), nem por disponibilidade declarada no onboarding, nem por concurso. O override por escola existe em config_escola (ex.: volume_semanal_mat da demo) mas não alimenta a meta gerada.
- **Evidência:** supabase/seed/trilha-cn-v1.json:6; scripts/gerar-seed-trilha.mjs:46 (mesmo valor para toda semana); app/src/routes/aluno/VisaoEstudo.jsx:135; supabase/seed/06_pedagogia.sql:91-95 (override demo sem consumo pelo motor)
- **Impacto:** Meta uniforme pesa diferente para um 8º-anista iniciante e um veterano; como o % da meta alimenta o semáforo do responsável, a régua única pode gerar sinal vermelho injusto.
- **Recomendação:** Permitir meta_questoes por semana no JSON da trilha (a coluna trilha_semanas.meta_questoes já existe) e/ou modular pela disponibilidade do onboarding.
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

### Lacunas para venda (Pedagogia e conteúdo)

- Conteúdo por concurso — a lacuna dominante: trilha semanal EsPCEx (0 de ~9 semanas; falta Anexo C do edital + metodologia do dono), assuntos de EEAr/ESA/EPCAR (0 catalogados; falta programa oficial de cada edital) e definição/edital de CM. Sem isso, só escolas exclusivamente CN podem comprar
- Renovação de ciclo: trilha CN v2 datada para CPACN/2027 e um modelo de calendário por turma/coorte (hoje o calendário é global, fixo e expira em 01/08/2026) — sem isso não há operação contínua de escola
- Banco de questões/conteúdo dentro do produto: hoje o app é casca de gestão — todo estudo acontece fora, em materiais de terceiros citados nominalmente na trilha ('Murphy Units', 'Faça e Passe'), o que também exige resolver a dependência/direitos desses materiais para white-label
- Tagueamento real de provas e recorrência medida (hoje 3 questões e 3 linhas de amostra) para sustentar a promessa 'prioridade pelo que mais cai' — exige adquirir provas oficiais com gabarito, começando pelas 10 provas do CN que a própria metodologia manda refazer
- Fluxo de redação: não existe envio/correção de redação no produto, embora a redação seja eliminatória ou classificatória em 5 dos 6 concursos e a missão de redação do EPCAR não feche sozinha (acompanhamento manual)
- Personalização mínima: consumir o onboarding (disponibilidade/dificuldade) na meta e no nível inicial; ativar de fato as trilhas por horizonte (anual/semestral/intensiva/reta final existem como planos com 3 missões, sem consumo na jornada do aluno)
- Papel professor/tutor (ROLE1, camada 3 do registro vivo): sem ele a 'intervenção pedagógica' vendida à escola é só a coordenação olhando painéis
- Integridade do dado autodeclarado: tetos/sinais de plausibilidade para registro e simulado antes de expor ranking de turma e semáforo de pais como valor comercial
- E2E dos fluxos pedagógicos rodando em CI (specs existem e são puladas sem secrets de staging) — hoje a garantia de regressão pedagógica na UI é indireta
- Processo editorial sustentável: a fábrica técnica está pronta, mas toda autoria depende de uma pessoa (decisão 16); vender além do piloto exige formato de autoria/curadoria replicável (template de trilha + revisão) e acervo de fontes no repositório (docs/conteudo/fontes/ está vazio)

---

## Negócio e produto

**Veredito:** O sistema está em fase de PRÉ-PILOTO: a engenharia é madura para o porte-alvo (multi-tenant com RLS provada por testes, backoffice de operação, checklists de go-live por escola), mas o negócio é embrionário — receita zero, nenhum instrumento jurídico (contrato/DPA/termos/privacidade), preço apenas hipotético, conteúdo vendável restrito ao Colégio Naval e operação dependente de uma única pessoa. A sequência realista até a primeira venda é: (1) jurídico + preço, (2) infra de dado real (projeto dedicado sa-east-1/Pro, backup testado, SMTP), (3) piloto gratuito na escola candidata já cadastrada (Colégio e Curso Ícone), (4) conversão do piloto em contrato — estimo 3 a 5 meses. Chegar a 5 escolas pagantes exige ainda trilhas de outros concursos (bloqueadas por material do dono), material comercial e redundância de operador — horizonte realista de 9 a 18 meses, condicionado à janela sazonal de matrícula dos cursinhos.

### Estado atual

O produto é um SaaS B2B white-label de acompanhamento de estudos para cursinhos preparatórios militares (CN, EsPCEx, EEAr, CM), nascido de um painel pessoal ("Rumo ao Naval") e explicitamente dimensionado para 5-6 escolas ("Não superdimensione. O alvo é 5 a 6 escolas" — docs/fundacao/00-prompt-de-build.md:89). Modelo de receita: licença por escola com setup (R$ 5-15 mil) + mensalidade (R$ 600-2.000), declaradamente hipótese não validada (docs/fundacao/01-visao-geral.md:37). Tecnicamente existe: 37 migrations com RLS (verificado: ls supabase/migrations = 37), 6 Edge Functions, backoffice SuperADM que cria escola e coordenação sem SQL (RPC backoffice_criar_escola em supabase/migrations/0021, Edge backoffice-coordenador), checklist de go-live por escola em parte automatizado na tela (docs/operacao/checklist-go-live-escola.md), mecanismos LGPD técnicos (tabela consentimentos, logs_acesso, Edge lgpd-titular de exportação/exclusão) e uma escola de vitrine com ~60 alunos fictícios e progresso gerado pelo motor (supabase/seed/13_vitrine_militar_demo.sql). Tudo roda num ÚNICO projeto Supabase Free em us-east-1 que mistura demo e a "produção" (app/.env.production:4 aponta bdjkgrzfzoamchdpobbl), sem backup automático (docs/operacao/backup-e-plano-supabase.md:6-11). Há 4 escolas cadastradas no remoto, sendo 1 real candidata a piloto (Colégio e Curso Ícone) e nenhum real faturado ("Nenhum real entrou ainda" — docs/fundacao/01-visao-geral.md:50).

Classificação das lacunas declaradas pelo próprio projeto (07-pendencias + 05-camadas, reconciliados pela REG1): CONFIRMO NO CÓDIGO — P1-3 observabilidade sem destino (app/src/shared/lib/observabilidade.js:9 lê VITE_ERROR_REPORT_URL, ausente de app/.env.production e de .github/workflows/ci.yml); P2-3 E2E nunca roda (ci.yml:116 "E2E PULADA — sem projeto Supabase isolado"); P2-5 credencial do aluno = código como senha (supabase/functions/provisionar-aluno/index.ts:205 "password: codigo"); P2-6 ausência de rate limiting (grep "rate" nas 6 functions = 0); item 2.2 trilha EsPCEx inexistente (docs/conteudo/gaps-material-fonte-concursos.md:48-50: "trilha semanal: 0 semanas"; único JSON de trilha é supabase/seed/trilha-cn-v1.json); camada 3 sem papel professor (0001_fundacao.sql:60 check papel in coordenacao/aluno/responsavel); P2-2 demo×real no mesmo projeto (.env.production versionado com o projeto demo); item 10.4 provisão operada pelo dono. JÁ RESOLVIDAS — P1-5 tabela fantasma (app/src/shared/data/index.js:953 comenta a remoção; Login.jsx:121 tela honesta) e P2-8 motor de XP duplicado (migration 0037_fix2_deprecar_escrita_conquistas.sql existe + tests/fix2-conquistas-deprecadas.test.mjs). NÃO CONSIGO VERIFICAR — os P0 operacionais do go-live (SMTP com domínio real, smoke com escola real), backup/região do projeto remoto em si, e a contagem "475/475 testes" (exige Postgres local; a trilha 341→456→459→471→475 está documentada com comandos em docs/auditoria/reg1).

Fase de negócio: PRÉ-PILOTO (demo controlada liberada; piloto real bloqueado por P0 operacionais + jurídico + infra). Sequência realista: F1 jurídico+preço (2-4 semanas, depende de advogado); F2 infra de dado real — projeto dedicado sa-east-1/Pro, backup+restore testado, credencial opaca + rate limit, SMTP (1-3 semanas, itens já com runbook); F3 piloto gratuito/simbólico no Ícone com consentimento real (4-8 semanas de uso observado); F4 primeira venda = converter o piloto + abrir CNPJ (decisão já registrada em docs/fundacao/02-premissas-decisoes.md:15); F5 até 5 escolas = trilha EsPCEx no mínimo (bloqueada por material do dono), site/material de venda, segunda pessoa operando, e alinhamento à sazonalidade de matrícula (dez-mar) — 9 a 18 meses.

### Pontos fortes

- Diferencial real e defensável: a metodologia autoral (trilha CN de 9 semanas/50 atividades, análise de provas 2021-2025, mapa Fechar/Pincelar/Pular) — o próprio projeto a reconhece como 'o ativo mais valioso, mais que o código' (docs/fundacao/01-visao-geral.md:16); nenhum concorrente white-label conhecido cobre esse nicho com metodologia embutida
- Modelo B2B bem escolhido para o porte: um decisor, um contrato, receita previsível — com racional explícito de descarte do B2C (docs/fundacao/01-visao-geral.md:35), coerente com a realidade de venda para cursinhos pequenos
- Disciplina de honestidade rara: gate de maturidade de conteúdo impede vender trilha que não existe (selo beta/esqueleto na UI, validador de build — docs/conteudo/gaps-material-fonte-concursos.md), e a REG1 corrigiu publicamente uma alegação falsa de fechamento (docs/auditoria/reg1 §4.1) e instituiu regra de reconciliação
- Onboarding de escola quase todo sem SQL: criação de escola, coordenação, turmas, alunos em lote e credenciais pelo backoffice/painel, com checklist de go-live derivado de dado real do banco (docs/operacao/checklist-go-live-escola.md:26-27 'automático') — o custo marginal de operar cada escola nova é baixo e escala até as 5-6 alvo
- Fundação técnica desproporcional à fase (a favor): isolamento por RLS provado por suíte de testes desde o Bloco 0, LGPD técnica desde o MVP (consentimentos, logs_acesso, exportação/exclusão via lgpd-titular), custo de infra irrisório (projeto Supabase único multi-tenant; Pro ~US$25/mês cobre todas as escolas do alvo)
- Já existe candidata real a piloto cadastrada (Colégio e Curso Ícone — docs/00-indices/03-status-atual.md:94) e um caso de uso vivido (aluno Lucas migrado do app original), matéria-prima para o primeiro estudo de caso comercial

### Achados

#### NEGOCIO-01 · 🔴 CRÍTICA · Nenhum instrumento jurídico existe para assinar com uma escola (contrato, DPA, termos de uso, política de privacidade)

- **Descrição:** O próprio projeto trava desde a fundação que 'o contrato com a escola precisa ter cláusula de operador (DPA). Isso vale desde o piloto' (docs/fundacao/02-premissas-decisoes.md:22), mas o checklist LGPD operacional lista termo de uso, política de privacidade, retenção, canal do titular/DPO e DPA todos como '⏳ pendente' e os declara 'bloqueantes para aluno real' (docs/auditoria/seguranca/seg2/13-lgpd-operacional.md:43-62). Não há nenhum texto jurídico no repositório. O sistema trata dado de menor de idade: vender sem esses instrumentos expõe o operador e a escola.
- **Evidência:** docs/auditoria/seguranca/seg2/13-lgpd-operacional.md:43-52 (termos/política/DPA '⏳ pendente'); docs/fundacao/02-premissas-decisoes.md:22; grep por 'termos de uso|política de privacidade|DPA' no repo retorna apenas pendências em docs, nenhum documento jurídico
- **Impacto:** Impede qualquer venda ou mesmo piloto com dado real de menor. Sem DPA, a escola (controladora) não pode contratar o operador de forma regular sob a LGPD; sem termos/política, o próprio produto não tem finalidade declarada.
- **Recomendação:** Contratar redação jurídica de um pacote mínimo (contrato de licença B2B com cláusula de operador/DPA anexa, termo de uso, política de privacidade com finalidade e canal do titular, termo de consentimento do responsável v1 com texto real) antes de qualquer conversa comercial com dado real. É trabalho de advogado, não de código.
- **Esforço estimado:** dias · **Verificação:** CONFIRMADO por céticos independentes
- **Nota do cético:** Evidência reproduzida integralmente. (1) docs/fundacao/02-premissas-decisoes.md:22 contém literalmente a exigência de contrato com cláusula de operador (DPA) "desde o piloto". (2) docs/auditoria/seguranca/seg2/13-lgpd-operacional.md:43-53 marca termo de uso, política de privacidade, finalidade, retenção, canal do titular/DPO e DPA como "⏳ pendente/definir", e as linhas 57-62 os declaram "bloqueantes para aluno real". (3) Grep exaustivo no repo (termo de uso, política de privacidade, DPA, minuta, cláusula, contratante, foro) retorna apenas pendências em checklists — nenhum texto jurídico existe […]

#### NEGOCIO-02 · 🟠 ALTA · Produto vendável hoje apenas para escolas focadas em Colégio Naval — o posicionamento 'preparatórios militares' não tem lastro de conteúdo

- **Descrição:** A única trilha semanal completa é a do CN (9 semanas, 50 atividades). EsPCEx — item P1 declarado — tem 0 semanas de trilha e 3/7 matérias com algum assunto; EEAr, ESA e EPCAR são 'esqueleto' com 0 assuntos; CM não tem config. A PED2-R2 (03/07) mediu que não existe nenhum edital ou prova no projeto e que a produção está 'aguardando material-fonte do dono' — corretamente, o sistema se recusa a gerar trilha sem lastro, mas isso significa que o pitch para uma escola EsPCEx/EEAr/CM entrega só estrutura de prova e selo 'beta/esqueleto'.
- **Evidência:** docs/conteudo/gaps-material-fonte-concursos.md:48-50 ('trilha semanal: 0 semanas... a única trilha no banco é colegio-naval v1') e §2-§5; docs/00-indices/05-camadas-faltantes.md itens 2.2-2.4; supabase/seed/trilha-cn-v1.json é o único JSON de trilha
- **Impacto:** Reduz o mercado endereçável imediato a cursinhos com turma de Colégio Naval (subconjunto pequeno do nicho, concentrado no RJ). Escola multi-concurso (caso típico: Elite/Pensi-like preparam CN+EsPCEx+EPCAR juntos) veria produto incompleto no demo.
- **Recomendação:** O dono deve produzir a metodologia EsPCEx (o gargalo é dele, não do agente/código: anexo C do edital + plano semanal autoral + provas com gabarito) usando a fábrica já pronta; priorizar 1 concurso adicional antes da prospecção ampla, ou restringir honestamente o pitch inicial a escolas CN.
- **Esforço estimado:** semanas · **Verificação:** CONFIRMADO por céticos independentes
- **Nota do cético:** Evidência integralmente reproduzida. (1) docs/conteudo/gaps-material-fonte-concursos.md:48-50 diz literalmente que a trilha EsPCEx tem 0 semanas e que a única trilha no banco é colegio-naval v1 (9 semanas / 50 atividades); os §§1-5 confirmam EsPCEx beta com 3/7 matérias com assunto, EEAr/ESA/EPCAR esqueleto com 0 assuntos e CM indisponível; o §0 confirma a medição PED2-R2 de 03/07 (nenhum edital/prova/PDF no projeto; produção aguardando material-fonte do dono). (2) docs/00-indices/05-camadas-faltantes.md itens 2.2-2.4 conferem, incluindo EsPCEx marcado P1 com 0 semanas de trilha. (3) supabase/ […]

#### NEGOCIO-03 · 🟠 ALTA · Infraestrutura atual incompatível com cliente pagante: projeto único Supabase Free (us-east-1) mistura demo e 'produção', sem backup automático

- **Descrição:** O único projeto remoto (bdjkgrzfzoamchdpobbl) está no plano Free — 'Backup automático gerenciado: indisponível no free tier' — em us-east-1 (dado de menor deveria estar no Brasil, plano de migração sa-east-1 escrito e não executado), e serve simultaneamente a vitrine demo (com credenciais demo em produção, ressalva P2 da SDB-AUDIT) e as escolas de teste/candidatas. As chaves públicas desse projeto demo estão versionadas em app/.env.production.
- **Evidência:** docs/operacao/backup-e-plano-supabase.md:6-11 ('plano free... Backup automático gerenciado: indisponível'); app/.env.production:4 (VITE_SUPABASE_URL=...bdjkgrzfzoamchdpobbl...); docs/00-indices/07-pendencias-para-piloto-real.md P1-1/P1-2/P2-2; docs/00-indices/03-status-atual.md:49-52 ('credenciais demo em produção... seguem válidas')
- **Impacto:** Perda de dado de aluno sem backup restaurável seria fatal para a reputação numa primeira escola; dado de menor fora do Brasil fragiliza o discurso LGPD que é justamente o argumento de conformidade do produto.
- **Recomendação:** Antes do piloto real: criar projeto Supabase dedicado em sa-east-1 no plano Pro (~US$25/mês, custo que cabe em qualquer mensalidade hipotética), aplicar as 37 migrations pelo runbook existente, testar restore uma vez, e manter o projeto atual exclusivamente como demo. Tudo já tem runbook (docs/operacao/plano-migracao-sa-east-1.md, runbook-migrations-supabase.md).
- **Esforço estimado:** dias · **Verificação:** CONFIRMADO por céticos independentes
- **Nota do cético:** Todas as evidências foram reproduzidas literalmente. (1) /home/user/Rumo-a-aprova-o-/docs/operacao/backup-e-plano-supabase.md linhas 6-10: "Organização: plano **free**", projeto `bdjkgrzfzoamchdpobbl` em `us-east-1`, "**Backup automático gerenciado: indisponível no free tier.**" (apurado 2026-06-21). (2) /home/user/Rumo-a-aprova-o-/app/.env.production linha 4: `VITE_SUPABASE_URL=https://bdjkgrzfzoamchdpobbl.supabase.co` — o mesmo projeto demo, com anon key versionada (o achado corretamente qualifica como "chaves públicas"; o próprio repo trata isso como P4, não como vazamento). (3) /home/user/ […]

#### NEGOCIO-04 · 🟠 ALTA · Consentimento do responsável é autodeclarado pela coordenação e o 'termo v1' não tem texto — a prova de conformidade vendida na tela é frágil

- **Descrição:** O fluxo operacionalizado de consentimento é a coordenação digitar o nome do responsável num prompt ('Nome do responsável que consente pelo aluno X (termo v1)') que insere linha em `consentimentos` com termo_versao default 'v1'. Não existe documento 'termo v1' em lugar nenhum do repositório, o responsável não vê nem aceita nada no sistema (o papel responsável nem participa do fluxo), e não há coleta de evidência (assinatura, aceite digital, upload). O PainelConformidade apresenta isso à escola como 'sua prova de conformidade'.
- **Evidência:** app/src/modules/pessoas/ListaAlunos.jsx:57 (pedirNome('Registrar consentimento', ...'termo v1')); supabase/migrations/0001_fundacao.sql:207-215 (termo_versao text default 'v1', registrado_por = coordenação); app/src/modules/consentimento/PainelConformidade.jsx:31 ('esta página é a sua prova de conformidade'); nenhum arquivo de termo no repo
- **Impacto:** Se um responsável contestar, o registro prova apenas que a coordenação digitou um nome — não que houve consentimento. Como conformidade LGPD é argumento central do pitch B2B, um piloto que exponha essa fragilidade destrói o diferencial.
- **Recomendação:** Junto do pacote jurídico: dar texto real ao termo v1 (versionado no produto), e evoluir o registro para anexar evidência (aceite pelo login do responsável, ou upload/hash do termo físico assinado). Enquanto isso, no piloto, operar com termo físico assinado guardado pela escola e registrado no sistema.
- **Esforço estimado:** dias · **Verificação:** CONFIRMADO por céticos independentes
- **Nota do cético:** Todas as evidências foram reproduzidas literalmente: (1) ListaAlunos.jsx:56-59 mostra a coordenação digitando o nome do responsável num diálogo ('Nome do responsável que consente pelo aluno X (termo v1)') que chama registrarConsentimento — um insert simples em `consentimentos` (app/src/shared/data/index.js:750-758) sem qualquer captura de evidência; (2) a migration 0001_fundacao.sql:207-215 confirma termo_versao default 'v1' e registrado_por comentado como 'usuário da coordenação que registrou', sem colunas de assinatura/aceite/anexo; (3) PainelConformidade.jsx:31 afirma à escola que 'esta pág […]

#### NEGOCIO-05 · 🟠 ALTA · Bus factor = 1: todo o desenvolvimento humano é de um autor e toda a operação (provisão, emergência, suporte) depende do dono

- **Descrição:** O histórico git tem exatamente 1 autor humano (Jinriuk, 53 commits) além do agente (Claude, 22) e do dependabot. A camada 10.4 registra 'provisão segue operada pelo dono'; os checklists de go-live exigem 'canal de suporte e responsável definidos' e 'canal de emergência' que hoje só podem ser a mesma pessoa; a parte comercial está delegada a uma pessoa sem experiência no setor (a tia, 'ex-nutricionista, sem atuação atual'). Não há segunda pessoa técnica treinada nem evidência de que os runbooks foram executados por terceiros.
- **Evidência:** git log --format='%an' | sort | uniq -c → 53 Jinriuk, 22 Claude, 6 dependabot[bot]; docs/00-indices/05-camadas-faltantes.md:145 (item 10.4 '🔴 provisão segue operada pelo dono'); docs/operacao/checklist-go-live-piloto.md:15-18; docs/fundacao/01-visao-geral.md:46
- **Impacto:** Uma escola pagante compra continuidade de serviço. Com um único operador (que ainda mantém outro negócio, a Alinhatta), férias/doença/abandono interrompem virada de semana monitorada, suporte e incidentes — risco que uma coordenação diligente perguntará no fechamento do contrato.
- **Recomendação:** Antes da 2ª escola paga: treinar uma segunda pessoa nos runbooks de operação (já bem escritos), validar que ela executa go-live e rollback sozinha, e formalizar o canal de suporte com SLA simples no contrato. O plano existente de 'contratar especialista a partir da 2ª-3ª escola' (02-premissas-decisoes.md:34) deve incluir operação, não só segurança.
- **Esforço estimado:** semanas · **Verificação:** CONFIRMADO por céticos independentes
- **Nota do cético:** Todas as evidências se reproduzem literalmente: (1) git log confirma exatamente 53 commits de Jinriuk, 22 de Claude e 6 do dependabot — um único autor humano; (2) docs/00-indices/05-camadas-faltantes.md:145 contém o item 10.4 com status 🔴 e a evidência "provisão segue operada pelo dono"; (3) docs/operacao/checklist-go-live-piloto.md:15-18 exige "canal de suporte e responsável definidos" e "canal de emergência definido", e a equipe documentada em docs/fundacao/01-visao-geral.md:43-48 tem apenas uma pessoa técnica, tornando correta a inferência de que ambos os papéis recaem sobre o dono; (4) do […]

#### NEGOCIO-06 · 🟡 MÉDIA · Preço é hipótese nunca validada e o estudo de mercado — passo 1 da ordem de execução declarada — não existe

- **Descrição:** A ordem de execução travada é 'estudo de mercado → escolher colégio-alvo → MVP → piloto → vender' (docs/fundacao/02-premissas-decisoes.md:8), mas não há nenhum estudo de mercado, doc de precificação ou proposta comercial no repositório — as únicas faixas (setup R$ 5-15 mil + R$ 600-2.000/mês) estão marcadas como 'hipótese — confirmar no estudo de mercado' desde a fundação. O projeto executou intensamente o MVP e pulou a validação que deveria precedê-lo.
- **Evidência:** docs/fundacao/01-visao-geral.md:37 ('Números são hipótese — confirmar no estudo de mercado'); docs/fundacao/02-premissas-decisoes.md:38-39; grep por preço/mensalidade/R$ em docs/ só encontra os docs de fundação
- **Impacto:** Sem preço validado não há proposta; com o teto autoimposto de 5-6 escolas, o negócio inteiro vale entre ~R$ 36k e ~R$ 120k/ano de recorrência nos números hipotéticos — a decisão de continuar investindo tempo deveria se apoiar em disposição-a-pagar real, não em suposição.
- **Recomendação:** Fazer a validação barata que os próprios docs prescrevem: 5-10 conversas com coordenações de cursinhos militares (RJ) apresentando a vitrine, testando as faixas de preço e a janela de compra (sazonalidade de matrícula), antes de investir nas trilhas de outros concursos.
- **Esforço estimado:** semanas · **Verificação:** não exigida (severidade média/baixa)

#### NEGOCIO-07 · 🟡 MÉDIA · Não existe superfície comercial: nenhuma landing page, site, material de venda ou demo autoexplicativa — a rota pública é só o Login

- **Descrição:** app/src/routes/publico contém apenas Login.jsx e RedefinirSenha.jsx. Não há página institucional, apresentação, vídeo ou roteiro de demo no repositório. O demo para uma escola exige o operador logar com credenciais da escola de vitrine — as mesmas 'credenciais demo em produção' apontadas como ressalva P2 pela SDB-AUDIT. A vitrine em si é boa (~60 alunos fictícios com progresso gerado pelo motor, seed 13), mas só é acessível por quem já tem as credenciais na mão.
- **Evidência:** ls app/src/routes/publico → Login.jsx, RedefinirSenha.jsx; supabase/seed/13_vitrine_militar_demo.sql (cabeçalho: '~60 alunos fictícios... PROGRESSO GERADO PELO MOTOR C0'); docs/00-indices/03-status-atual.md:49-52 (credenciais demo em produção)
- **Impacto:** Todo lead exige demo presencial conduzida pelo dono/tia; não há como uma escola conhecer o produto sozinha, nem prova social publicável. Isso limita o funil ao alcance pessoal da vendedora.
- **Recomendação:** Criar landing simples (fora do app se preferir), roteiro de demo escrito para a vendedora, e um acesso demo controlado (conta de leitura na escola de vitrine com expiração) que não dependa das credenciais compartilhadas atuais.
- **Esforço estimado:** dias · **Verificação:** não exigida (severidade média/baixa)

#### NEGOCIO-08 · 🟡 MÉDIA · Segurança da credencial do aluno aquém do que se promete à escola: senha = código de acesso e login sem rate limiting

- **Descrição:** O provisionamento cria o usuário do aluno com password igual ao próprio código exibido (formato XXXX-XXXX-XXXX), e não há nenhum rate limiting no login por código — ambos pendências P2 declaradas (05-camadas 6.2/6.3) e confirmadas no código. O modelo de credencial opaca está documentado (SEC3) mas não implementado. Na dimensão negócio, isso importa porque o pitch é exatamente 'segurança e conformidade para dado de menor'.
- **Evidência:** supabase/functions/provisionar-aluno/index.ts:205 ('password: codigo'); grep -i 'rate' em supabase/functions/*.ts → 0 ocorrências; docs/00-indices/05-camadas-faltantes.md itens 6.2 (🟡) e 6.3 (🔴)
- **Impacto:** Um incidente de acesso indevido a dado de menor no piloto — mesmo pequeno — encerraria a tese comercial. O risco é conhecido e classificado internamente como 'antes de aluno real', o que o torna bloqueador de venda na prática.
- **Recomendação:** Implementar o modelo de credencial opaca já documentado em sec3/modelo-credencial-opaca.md e um rate limit mínimo antes do primeiro aluno real; manter no gate de go-live.
- **Esforço estimado:** dias · **Verificação:** não exigida (severidade média/baixa)

#### NEGOCIO-09 · 🟡 MÉDIA · Histórico de auto-reporte inflado: um doc de fechamento alegou correções que nunca existiram em nenhum commit

- **Descrição:** O 'fechamento-100%-código' (28/06) afirmou que a tabela fantasma e o motor de XP duplicado 'já tinham sido corrigidos'; a REG1 vasculhou todo o histórico (git log --all) e o banco remoto e provou que as correções não existiam — foram feitas de fato só na FIX2 (02/07). O processo se autocorrigiu (regra REG1: toda rodada atualiza os índices), mas o episódio mostra que decisões de negócio tomadas sobre relatórios de status do próprio pipeline podem se apoiar em estado inexistente.
- **Evidência:** docs/auditoria/reg1/relatorio-reg1-reconciliacao-pos-fechamento.md:52-64 (§4.1 'A alegação falsa do fechamento... não existem'); docs/00-indices/03-status-atual.md:83-87 ('Tratar essa alegação como incorreta')
- **Impacto:** Risco de governança: com bus factor 1 e desenvolvimento fortemente agêntico, um status inflado pode chegar a uma escola (ou a um go-live) sem contestação. Mitigado, mas estrutural.
- **Recomendação:** Manter a regra REG1 e acrescentar um gate simples: nenhuma afirmação 'resolvido' entra em índice sem hash de commit + comando reproduzível (a REG1 já pratica isso; formalizar como exigência do gate de release, item 9.5 ainda 🟡).
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### NEGOCIO-10 · ⚪ BAIXA · Sem gestão comercial no produto: campo 'plano' é texto livre, sem contrato/licença/limite faturável nem qualquer processo de cobrança

- **Descrição:** A tabela escolas tem status/plano/limite_alunos como campos operacionais soltos (plano text sem semântica de cobrança); não existe registro de contrato, vigência, valor, fatura ou inadimplência — nem manual (planilha referenciada) nem no produto. Para 5-6 escolas, cobrança manual é aceitável, mas hoje não existe sequer o processo manual descrito.
- **Evidência:** supabase/migrations/0021_backoffice_escolas_crud.sql:16 ('add column if not exists plano text') e :32; nenhuma tabela/doc de faturamento no repo; faturamento inicial previsto 'pela Alinhatta' ainda dependente de acordo verbal com o sócio (docs/fundacao/02-premissas-decisoes.md:14-16)
- **Impacto:** Baixo agora; vira atrito na primeira renovação/reajuste e na abertura do CNPJ. O acordo pendente com o sócio da Alinhatta (item explícito dos docs) é pré-condição para faturar o piloto sem conflito societário.
- **Recomendação:** Antes do primeiro real: fechar por escrito o acordo Alinhatta (ou decidir faturar só após CNPJ próprio) e manter registro mínimo de contrato/vigência/valor por escola (planilha versionada basta neste porte).
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

### Lacunas para venda (Negócio e produto)

- Pacote jurídico completo assinável: contrato de licença B2B com cláusula de operador (DPA), termo de uso, política de privacidade com finalidade/retenção/canal do titular (DPO) publicados, e termo de consentimento do responsável com texto real — tudo declarado obrigatório 'desde o piloto' pelos próprios docs e inexistente
- Definição de preço validada em campo (estudo de mercado/conversas com coordenações) e uma proposta comercial padrão — hoje só existem faixas hipotéticas de 2026-06 nos docs de fundação
- Ambiente de produção dedicado e adequado a dado de menor: projeto Supabase sa-east-1 no plano Pro, backup automático com restore testado, separado do projeto demo, com SMTP/domínio próprios — tudo com runbook pronto, nada executado
- Conteúdo além do Colégio Naval: no mínimo a trilha EsPCEx completa (material-fonte e metodologia são do dono e estão formalmente 'aguardando' desde a PED2-R2), com roadmap declarado para EEAr/EPCAR/ESA/CM — sem isso o pitch é mono-concurso
- Go-to-market mínimo: site/landing institucional, roteiro de demo para a vendedora, acesso demo controlado (sem credenciais compartilhadas), e um estudo de caso publicável (o piloto no Ícone e/ou o caso Lucas)
- Estrutura de faturamento regularizada: acordo escrito com o sócio da Alinhatta para o faturamento do piloto, e plano de abertura do CNPJ dedicado com a primeira receita (decisão já tomada, não executada)
- Operação com redundância: segunda pessoa treinada nos runbooks (go-live, rollback, emergência) e canal de suporte formal com SLA simples por contrato — hoje tudo depende de um único operador
- Endurecimentos pré-aluno-real já classificados internamente como P2 e ainda abertos: credencial opaca do aluno, rate limiting no login por código, observabilidade com destino real e alertas de uptime/virada
- Prova de eficácia do método (métricas de uso e, idealmente, aprovação de alunos do piloto) — explicitamente fora do escopo do build (prompt §9) e ainda por produzir; é o argumento que converte a 2ª-5ª escola
- Capacidades de plataforma que escolas médias tendem a exigir na venda: papel professor/tutor (ROLE1, não iniciado) e self-service de provisão (item 10.4), hoje ambos ausentes por decisão de fase

---

## Qualidade, testes e CI/CD

**Veredito:** A dimensão qualidade/testes/CI é o ponto mais maduro do sistema: build de produção compila limpo (582 módulos, sem warnings), a suíte completa de 475 testes passou 100% em Postgres real neste ambiente (475 pass / 0 fail em 3,7s, incluindo a prova de isolamento RLS com identidade JWT real), e o CI roda esse mesmo gate em todo push/PR com guarda anti-"verde vazio". As fragilidades reais estão nas bordas: as 6 Edge Functions (Deno, com service_role) não têm nenhum teste de runtime — só inspeção de código-fonte por regex; a suíte E2E existe (52 testes) mas nunca roda no CI por falta de ambiente isolado; não há lint/typecheck algum; e monitoramento/alertas são zero — o gancho de observabilidade aponta para lugar nenhum.

### Estado atual

EXECUTADO NESTA AUDITORIA: (a) `npm ci && npm run build` em /app — sucesso, 0 vulnerabilidades no npm audit, vite 8.1.0, 582 módulos transformados em 388ms, sem nenhum warning; dist/ total 1,2 MB, maiores chunks: index-BzBeMh3E.js 433,7 kB (gzip 124,2), CartesianChart 345,7 kB (gzip 100,8 — recharts), AreaEscola 79,9 kB, AreaAluno 73,3 kB — code-splitting por área funciona. (b) Lint: NÃO EXISTE — nenhum script de lint em app/package.json, nenhum .eslintrc/eslint.config em lugar algum do repositório. (c) Testes: subi o Postgres 16 local, rodei `bash reset-db.sh` (37 migrations + seeds aplicados 2x para exercitar idempotência, pulando 04/13/14 que dependem de auth.users do GoTrue) — sucesso; depois `npm test` (node --test) na suíte completa: **475 pass / 0 fail / 0 skipped, 16 suítes, 53 arquivos (6.361 linhas de teste), 3,7s** — inclui isolamento RLS, motor, gamificação, LGPD, concorrência, volume (~150 alunos sintéticos com teto de latência). Única ressalva: um DeprecationWarning do pg ("Calling client.query() when the client is already executing a query… removed in pg@9.0"). (d) E2E: `npx playwright test --list` valida config e specs — 52 testes (26 casos × projetos desktop 1366px e mobile Pixel 7), serial (workers:1), contra o Supabase de DEMO compartilhado com credenciais hardcoded em e2e/_apoio.js; não executado (exige Supabase vivo). (e) CI (.github/workflows/ci.yml): job `build-e-unitarios` roda em todo push/PR com service container postgres:15 — npm ci + build + reset-db.sh + npm test + guarda que FALHA se a suíte rodar menos de 200 testes (ci.yml:86-94); a prova de isolamento RODA em todo PR (é parte do node --test). Job e2e só roda se o secret E2E_SUPABASE_URL existir — hoje não existe (docs/00-indices/07-pendencias P2-3), então a E2E é pulada com warning explícito. codeql.yml analisa JS/TS em PR/push na main + semanal; dependabot.yml agrupa updates semanais de app/ e tests/. (f) Monitoramento: app/src/shared/lib/observabilidade.js instala captura global de erros e faria POST para VITE_ERROR_REPORT_URL — variável indefinida em todos os .env e no vercel.json; nenhum alerta de uptime/falha configurado em nenhum arquivo do repo; docs/operacao/monitoramento-backup.md:40-43 admite: "Falta a configuração de infra (backups automáticos, alertas)".

### Pontos fortes

- Suíte de 475 testes 100% verde executada nesta auditoria contra Postgres real (3,7s), com RLS avaliada sob identidade real: tests/identidades.mjs abre transação com papel `authenticated` + claims JWT, exatamente como o PostgREST faz — não é mock.
- Prova de isolamento multi-tenant (tests/isolamento.test.mjs) percorre 14 tabelas isoladas em leitura E escrita para 3 papéis, e roda em TODO push/PR no CI — o requisito nº 1 de um SaaS white-label é testado continuamente.
- CI determinístico e anti-fraude: migrations + seed aplicados 2x (idempotência exercitada), e guarda explícita que reprova o build se a suíte rodar <200 testes (ci.yml:86-94) — protege contra 'verde vazio' por seed abortado.
- Qualidade genuína dos testes: regras.test.mjs compara o módulo novo contra cópia literal do código legado em TODO o domínio (365 datas, 441 combinações de nota); motor.test.mjs testa limites inclusivos, clamp e idempotência da virada em SQL real; gamificacao-db e sec3-lgpd-atomicidade testam RLS e privilégio no banco; concorrencia.test.mjs e volume-coordenacao (150 alunos com teto de latência) existem.
- E2E bem construída onde existe: coletor de erros de console reprova qualquer erro não-conhecido (_apoio.js:27-37), trace/vídeo/screenshot em falha, projetos desktop+mobile, asserção de não-estouro horizontal, e login do aluno com diagnóstico embutido na mensagem de falha.
- CodeQL (security-and-quality, PR+push+semanal) e Dependabot (semanal, agrupado) ativos; npm audit do app retornou 0 vulnerabilidades.
- Documentação de lacunas honesta e reconciliada com o código (05-camadas-faltantes.md marca explicitamente o que está 🔴/⛔, incluindo os próprios déficits de QA e observabilidade) — o número de testes nos docs (471) está apenas 4 atrás do real (475).

### Achados

#### QUALIDADE-01 · 🟠 ALTA · Edge Functions (Deno) não têm nenhum teste de runtime — só inspeção do código-fonte por regex

- **Descrição:** As 6 Edge Functions (backoffice-coordenador, gerar-meta, lgpd-titular, provisionar-aluno, revogar-responsavel, virar-semana) rodam com service_role e implementam os fluxos mais perigosos do sistema (exclusão LGPD banco+Auth, provisionamento de contas, virada de semana). Não existe nenhum arquivo de teste em supabase/functions/ (find por *test*/*spec* retorna vazio). O único 'teste' é tests/sec3-endurecimento-edge.test.mjs, que declara na linha 4-5: 'Estes testes NÃO sobem o Supabase… inspecionam o CÓDIGO-FONTE' — asserções como assert.match(src, /timingSafeEqual/) e verificação da ORDEM de substrings no fonte (iLista < iAuth < iDb para a atomicidade LGPD). Isso trava regressão textual, mas não prova comportamento: um bug de lógica dentro do handler (JSON malformado, erro de status code, branch invertido) passaria intacto.
- **Evidência:** tests/sec3-endurecimento-edge.test.mjs:3-6 ('inspecionam o CÓDIGO-FONTE e o .env versionado') e :57-66 (atomicidade LGPD verificada por indexOf de substrings); `find supabase -name '*test*'` → 0 resultados; supabase/functions/ contém apenas index.ts por função.
- **Impacto:** O fluxo de exclusão LGPD (obrigação legal com dados de menores) e o provisionamento de alunos podem regredir em comportamento sem que nenhum teste falhe. Numa venda a escola real, é a camada com maior privilégio e menor cobertura.
- **Recomendação:** Adicionar testes de integração das funções com `deno test` + supabase CLI local (supabase functions serve) ou extrair a lógica dos handlers para módulos puros testáveis (validação de payload, ordenação Auth→banco) e testar via Deno no CI — um job `deno test` é barato e roda sem secrets.
- **Esforço estimado:** dias · **Verificação:** verificação não concluída (limite de sessão)

#### QUALIDADE-02 · 🟠 ALTA · Suíte E2E nunca roda no CI — 52 testes existem mas são pulados por falta de ambiente isolado

- **Descrição:** O job e2e do CI é condicionado ao secret E2E_SUPABASE_URL (ci.yml:101-125), que não está configurado — confirmado por docs/00-indices/07-pendencias-para-piloto-real.md P2-3 ('specs existem e são puladas no CI') e 05-camadas-faltantes.md item 9.2 (⛔ staging/julho). Localmente a suíte roda contra o projeto de DEMO compartilhado, com credenciais hardcoded no repositório (e2e/_apoio.js:8-14). Resultado: os fluxos de UI dos 3 papéis, o motor de progresso na tela e a responsividade mobile só são verificados quando alguém roda manualmente contra o demo — nenhum PR é bloqueado por regressão de UI.
- **Evidência:** .github/workflows/ci.yml:109-117 (guard que emite warning 'E2E PULADA — sem projeto Supabase isolado'); app/e2e/_apoio.js:8-14 (CONTAS com email/senha do demo); `npx playwright test --list` executado → 'Total: 52 tests in 6 files'.
- **Impacto:** Regressões de frontend (login quebrado, tela do aluno em branco, RLS mal consumida na UI) chegam à main com CI verde. O gate real do produto visível ao cliente não existe no pipeline.
- **Recomendação:** Criar o projeto Supabase isolado de E2E (ou usar supabase CLI + docker no próprio runner do GitHub Actions, que dispensa secrets), configurar E2E_SUPABASE_URL/ANON_KEY e tornar o job e2e obrigatório na branch protection.
- **Esforço estimado:** dias · **Verificação:** verificação não concluída (limite de sessão)

#### QUALIDADE-03 · 🟠 ALTA · Zero monitoramento e alertas: o gancho de observabilidade aponta para lugar nenhum

- **Descrição:** app/src/shared/lib/observabilidade.js implementa captura global de erros (window.onerror + unhandledrejection) e POST best-effort para VITE_ERROR_REPORT_URL — mas a variável não está definida em nenhum .env nem no vercel.json (grep retorna só o próprio arquivo), então em produção os erros do front morrem no console do usuário. Não há nenhum alerta de uptime, nenhum alerta de falha da virada de semana (cron), nenhum destino tipo Sentry. Os próprios docs classificam isso como P1/P2 pré-piloto (07-pendencias P1-3: 'o gancho existe, aponta para lugar nenhum'; 05-camadas 5.1/5.2 🔴).
- **Evidência:** app/src/shared/lib/observabilidade.js:9 (`const ENDPOINT = import.meta.env?.VITE_ERROR_REPORT_URL`) + grep de ERROR_REPORT em app/.env* e vercel.json → 0 ocorrências; docs/operacao/monitoramento-backup.md:40-43 ('Falta a configuração de infra (backups automáticos, alertas)').
- **Impacto:** Com escola real, uma falha silenciosa (virada de semana que não roda, Edge Function 500, erro de RLS na UI) só seria descoberta por reclamação de cliente. Opera-se no escuro — inaceitável para produto pago com dados de menores.
- **Recomendação:** Definir o destino da observabilidade (Sentry free tier ou endpoint próprio) e setar VITE_ERROR_REPORT_URL no Vercel; configurar alerta de uptime (Better Stack/UptimeRobot) na URL do app e health-check da virar-semana; alertas de log do Supabase para falha de Edge Function.
- **Esforço estimado:** dias · **Verificação:** verificação não concluída (limite de sessão)

#### QUALIDADE-04 · 🟡 MÉDIA · Nenhum lint ou typecheck no repositório

- **Descrição:** Não existe ESLint (nenhum .eslintrc/eslint.config no repo, nenhuma dependência eslint no package.json), nenhum Prettier, nenhum tsc/jsconfig checado. O CI valida apenas 'compila no Vite' + testes. app/src tem 78 arquivos JS/JSX (884 KB) sem análise estática além do CodeQL (que foca segurança, não correção). Classes de bug que lint pega de graça — variável não usada indicando refactor incompleto, deps de useEffect erradas (react-hooks/exhaustive-deps), imports quebrados em branch não exercitado — passam despercebidas.
- **Evidência:** `ls app/.eslintrc* app/eslint.config.* .eslintrc*` → No such file; app/package.json (scripts: dev/build/preview/test:e2e apenas, devDependencies sem eslint); execução da etapa (b) da auditoria: não havia script para rodar.
- **Impacto:** Qualidade depende 100% de revisão humana e testes; bugs de hooks React e código morto acumulam sem detecção automática.
- **Recomendação:** Adicionar eslint (flat config) com eslint-plugin-react-hooks + job de lint no CI (2 min de execução). Typecheck gradual via jsconfig + checkJs nos módulos shared/ já cobertos por teste.
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### QUALIDADE-05 · 🟡 MÉDIA · Frontend sem nenhum teste de unidade/componente — 78 arquivos cobertos só indiretamente

- **Descrição:** Não existe vitest/jest/testing-library no projeto; `find app/src -name '*.test.*'` retorna 0. A lógica compartilhada (shared/regras, metricas, csv, contratos) é bem testada a partir de tests/, mas todos os componentes React (AreaAluno, AreaEscola, AreaAdmin, VisaoEstudo, fluxos de formulário, ErroFronteira, useEnvioUnico, useRecurso) só têm cobertura via E2E — que não roda no CI (achado anterior). Na prática, a camada de apresentação inteira está sem rede de proteção no pipeline.
- **Evidência:** `find app/src -name '*.test.*' -o -name '*.spec.*'` → vazio; app/package.json sem vitest/jest/@testing-library; 78 arquivos js/jsx em app/src.
- **Impacto:** Refactors de UI e mudanças de contrato entre componentes quebram sem sinal; a trava de duplo envio e o error boundary — mecanismos de segurança de UX citados como entregues (05-camadas 7.1/7.2) — não têm teste próprio.
- **Recomendação:** Introduzir vitest + @testing-library/react e cobrir primeiro os hooks críticos (useEnvioUnico, useRecurso) e componentes de formulário com validação; adicionar ao job de CI existente.
- **Esforço estimado:** dias · **Verificação:** não exigida (severidade média/baixa)

#### QUALIDADE-06 · 🟡 MÉDIA · Validadores de conteúdo e de migrations não estão ligados ao CI

- **Descrição:** scripts/validar-conteudo.mjs é descrito nos docs como 'porteiro' da fábrica de trilhas (05-camadas item 2.5) e scripts/checar-migrations.mjs como gate pré-deploy (monitoramento-backup.md:36), mas nenhum dos dois é referenciado em ci.yml nem em nenhum package.json — grep retorna zero. São executados só manualmente, ou seja, um seed de trilha incoerente ou uma migration destrutiva pode entrar na main com CI verde.
- **Evidência:** `grep -n 'validar-conteudo\|checar-migrations' .github/workflows/ci.yml app/package.json tests/package.json` → 0 ocorrências; os scripts existem em /home/user/Rumo-a-aprova-o-/scripts/.
- **Impacto:** O gate de qualidade de conteúdo pedagógico (o produto vendido às escolas É a trilha) e a proteção contra migration destrutiva dependem de disciplina manual do dev solo.
- **Recomendação:** Adicionar dois steps ao job build-e-unitarios: `node scripts/validar-conteudo.mjs` e `node scripts/checar-migrations.mjs` (ambos rodam sem secret).
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### QUALIDADE-07 · ⚪ BAIXA · DeprecationWarning do driver pg na suíte — quebra futura garantida no pg@9

- **Descrição:** A execução real da suíte emitiu: '(node:21493) DeprecationWarning: Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0'. Algum teste dispara queries concorrentes no mesmo client (provável em arquivos com Promise.all sobre a mesma conexão). Hoje passa; quando o Dependabot subir pg para 9.x, a suíte quebra ou passa a ter comportamento indefinido.
- **Evidência:** Saída literal do `npm test` executado nesta auditoria (linha 2 do output): 'DeprecationWarning: Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0'.
- **Impacto:** Risco de quebra da suíte inteira num bump de dependência, com custo de diagnóstico no pior momento.
- **Recomendação:** Rodar `node --trace-deprecation --test` para localizar o ponto e serializar as queries (await) ou usar conexões separadas do pool.
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### QUALIDADE-08 · ⚪ BAIXA · Guarda anti-verde-vazio do CI usa piso desatualizado (200) e reexecuta a suíte inteira

- **Descrição:** O step de conferência roda `node --test` uma SEGUNDA vez e exige apenas ≥200 testes passando (ci.yml:89-94), enquanto a suíte real tem 475. Uma regressão que silenciosamente pulasse metade dos arquivos de teste (ex.: erro de import em 25 arquivos tratado como skip) ainda passaria no piso de 200. Além disso, a dupla execução dobra o tempo do job à toa.
- **Evidência:** .github/workflows/ci.yml:89-94 (`if [ "${N:-0}" -lt 200 ]`); execução real desta auditoria: '# tests 475 / # pass 475'.
- **Impacto:** A guarda protege menos do que aparenta; janela para perda silenciosa de até ~57% da suíte.
- **Recomendação:** Subir o piso para ~450 (ou capturar o total da primeira execução via tee) e eliminar a segunda rodada parseando o output da execução principal.
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

#### QUALIDADE-09 · ⚪ BAIXA · Credenciais do ambiente de demonstração versionadas no repositório e usadas pela E2E

- **Descrição:** e2e/_apoio.js versiona email+senha da coordenação e códigos de acesso de alunos do projeto de demo (coordenacao@vitrine.demo / vitrine-coord-2026 etc.). É decisão documentada (demo é vitrine pública, segurança é a RLS), mas o mesmo projeto Supabase de demo é hoje o único projeto (07-pendencias P2-2: 'credenciais demo em produção; separação demo × real' pendente). Enquanto não houver separação, qualquer pessoa com o repo entra como coordenação na instância que também seria usada por escola real.
- **Evidência:** app/e2e/_apoio.js:8-14 (objeto CONTAS com senhas literais); docs/00-indices/07-pendencias-para-piloto-real.md P2-2.
- **Impacto:** Aceitável enquanto for só vitrine; vira exposição real no instante em que a primeira escola entrar no mesmo projeto.
- **Recomendação:** Manter as credenciais de demo, mas condicionar o go-live à separação de projetos (já planejada) e mover as contas E2E para o projeto isolado de teste.
- **Esforço estimado:** horas · **Verificação:** não exigida (severidade média/baixa)

### Lacunas para venda (Qualidade, testes e CI/CD)

- Ambiente de staging/E2E isolado com secrets configurados, para que os 52 testes Playwright rodem em todo PR e o gate de release inclua a UI — hoje o pipeline valida banco e build, mas nenhum fluxo visível ao cliente.
- Teste de carga executado (o plano 300/500/10k alunos existe em docs/auditoria/perf1/plano-carga-300-500-10000.md, mas nunca foi rodado — 05-camadas 4.8 🟡) — sem isso não há número defensável de capacidade para prometer a uma escola.
- Monitoramento operacional mínimo vendável: destino de erros do front (VITE_ERROR_REPORT_URL), alerta de uptime, alerta de falha da virada de semana e dashboards de uso por escola — pré-requisito para qualquer SLA, mesmo informal.
- Testes de runtime das Edge Functions (Deno) no CI — a camada de provisionamento e LGPD precisa de prova executável, não só inspeção de fonte, antes de assinar contrato com escola que envolve dados de menores.
- Gate de release formal documentado e aplicado (05-camadas 9.5 🟡): checklist de go-live existe, mas não há processo formalizado de versão/rollback amarrado ao CI para dar previsibilidade de entrega a clientes.
- Backup com restore TESTADO e separação demo × produção (05-camadas 5.3 ⛔ e 5.7 🔴) — do ponto de vista de qualidade, nenhum pipeline valida hoje que um restore funciona; é pré-condição comercial para custodiar dados de alunos.
- Lint/typecheck e testes de componente no front — para um produto white-label que promete customização por escola, a ausência total de análise estática e de teste de UI torna cada personalização um risco de regressão não detectada.
- Auditoria de acessibilidade automatizada (axe) no pipeline — escolas públicas/militares podem exigir conformidade; hoje só há 11 arquivos com htmlFor e nenhuma verificação automática (05-camadas 8.1 🟡).
