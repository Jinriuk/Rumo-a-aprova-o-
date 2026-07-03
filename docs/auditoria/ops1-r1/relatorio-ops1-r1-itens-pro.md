# OPS1-R1 — Itens destravados pelo Pro — resultado

Data: 2026-07-03
Autor: Claude (assistente de automacao), correcoes solicitadas por Fable incorporadas

## ESTADO VERIFICADO (Fase 0)

- Plano confirmado: Pro Plan. Evidencia: pagina de Billing da organizacao mostra "Pro Plan", fatura paga em 03/Jul/2026 de $25.00 (invoice AJSKQG-00002).
- - Regiao atual confirmada: us-east-1 (AWS). Nao e sa-east-1. Migracao de regiao continua como fase separada, nao iniciada.
  - - Backup automatico: ja estava ativo antes de qualquer acao nesta fase — backups fisicos diarios desde pelo menos 26/Jun/2026, retencao de ~7-8 dias.
    - - Leaked Password Protection: estava DESATIVADO antes desta fase.
      - - PITR: confirmado NAO contratado como add-on (DISABLED em Settings > Add-ons).
       
        - ## 1. Backup automatico
       
        - Sem alteracao necessaria — ja rodava diariamente antes desta fase.
       
        - ## 2. Restore testado — status corrigido
       
        - Correcao aceita: a afirmacao original "Restore testado: sim" estava superclamada. Segue o resultado completo, separado por componente.
       
        - ### Banco de dados (Postgres) — CONFIRMADO
       
        - Restore via recurso nativo "Restore to new project" (BETA), projeto descartavel ops1-r1-restore-test-descartavel (ref lpjxlzsbrgqhvspxtrzh), mesma organizacao, mesma regiao (us-east-1). Backup restaurado: 03/Jul/2026 14:39:33 UTC. Inicio: 21:55:05 UTC, concluido por volta de 21:59 UTC (~4 minutos). Contagem de linhas bateu exatamente em 8 tabelas: meta_atividades (1733), logs_acesso (1008), aluno_eventos_progresso (1002), registros_estudo (456), metas (295), usuarios (76), alunos (68), turmas (8). auth.users mostrou 76 no backup restaurado vs 77 na producao atual — diferenca esperada, pois o backup e anterior ao usuario de teste criado durante o smoke test de LPP (ver secao 3).
       
        - ### Storage — NAO RESTAURADO (confirmado por teste direto)
       
        - O bucket Logos-escolas aparece no projeto restaurado, e a linha de metadata do arquivo IMG_9712.jpeg tambem aparece (tabela storage.objects, que e Postgres e por isso veio no backup). Porem o arquivo binario em si NAO veio: requisicao direta a https://lpjxlzsbrgqhvspxtrzh.supabase.co/storage/v1/object/public/Logos-escolas/IMG_9712.jpeg retornou 404 Not Found ("The resource was not found"). Confirma o aviso que o proprio Supabase mostra na tela de backups: "Database backups do not include objects stored via the Storage API". Ou seja: em um desastre real, um restore de banco recupera os dados, mas os logos das escolas (e qualquer outro arquivo em Storage) se perderiam a menos que exista um plano de backup separado para Storage.
       
        - ### Edge Functions — NAO RESTAURADO (confirmado por contagem)
       
        - Projeto de producao tem 6 Edge Functions: backoffice-coordenador, gerar-meta, lgpd-titular, provisionar-aluno, revogar-responsavel, virar-semana. O projeto restaurado tem 0 funcoes — tela inicial "Deploy your first Edge Function". Restore de banco nao traz Edge Functions; isso exige redeploy separado (via CLI/CI) apos qualquer restore real.
       
        - Frase final correta: banco confirmado (contagem de linhas batendo em 8 tabelas), Storage e Edge Functions confirmados como NAO cobertos pelo restore de banco — precisam de estrategia de backup/redeploy propria, hoje inexistente. Isso e uma lacuna operacional real que fica registrada aqui, fora do escopo de correcao desta fase (OPS1-R1 e sobre o que o Pro destrava, nao sobre criar um backup de Storage/Functions).
       
        - ## Tier do projeto descartavel
       
        - Confirmado por print da aba de Billing da organizacao: o plano Supabase e por organizacao, nao por projeto ("Each organization has it's own subscription plan, billing cycle, payment methods and usage quotas."). O projeto ops1-r1-restore-test-descartavel NAO tem uma assinatura Pro propria de $25/mes rodando em paralelo — ele aparece apenas como uma linha de custo de compute dentro da MESMA fatura Pro ja existente: "ops1-r1-restore-test-descartavel (Micro Compute - 1 Hours) $0.01" ao lado de "Rumo a Aprovacao" e "barbearia-saas" na mesma Upcoming Invoice (Pro Plan $25.00 unico + compute por projeto). Custo real observado ate o momento: $0.01 (1 hora de Micro compute). Custo projetado se deixado rodando o mes todo: ~$9.68 adicionais de compute (nao e um segundo Pro Plan).
       
        - ## 3. Leaked Password Protection — cobertura real por perfil (corrigido)
       
        - O teste anterior (rejeicao de "password123" no signup publico, HTTP 422, motivo "pwned") confirma que o mecanismo do Supabase Auth funciona quando chamado via API publica de signup/updateUser. Isso continua valido e foi feito corretamente (mirando cadastro, nao login de conta pre-existente). Mas essa API publica nao e o caminho usado por nenhum dos 4 perfis para criar ou, na maioria dos casos, alterar senha nesta aplicacao. Inspecionei o codigo das Edge Functions e cruzei com docs/operacao/auth-codigos-alunos.md (ja existente no repo):
       
        - - Aluno (66 de 76 usuarios, 87%): Edge Function provisionar-aluno usa admin.auth.admin.createUser() com password: codigo (o proprio codigo de acesso, em texto puro, vira a senha). Chamadas admin.createUser nao passam pela checagem de Leaked Password Protection — o proprio doc leaked-password-protection.md ja alertava para isso: "O comportamento do Leaked Password Protection para chamadas admin pode diferir do comportamento para usuarios finais. Recomenda-se usar senhas temporarias fortes (geradas aleatoriamente)". Essa recomendacao nao foi implementada: o codigo atual em producao usa o codigo de acesso como senha, sem geracao de senha forte separada.
          - - Responsavel (4 usuarios): mesmo fluxo que aluno (provisionar-aluno com tipo: "responsavel", conforme auth-codigos-alunos.md) — mesma senha = codigo, mesmo bypass do LPP.
            - - Coordenacao (6 usuarios): Edge Function backoffice-coordenador tambem usa admin.auth.admin.createUser(), mas com password: senhaAleatoria() (senha aleatoria gerada, nao escolhida por humano) — tambem bypassa o LPP na criacao. Depois, a mesma function usa admin.auth.admin.generateLink({ type: "recovery" }) para enviar um link de redefinicao. Nao confirmei se a pagina de frontend que recebe esse link chama a API publica updateUser (que aplicaria o LPP) ou outro mecanismo — essa e uma camada de codigo de frontend fora do que da para inspecionar pelo painel Supabase, e ficou sem verificacao nesta fase.
              - - Admin (1 usuario, tabela internal_admins, separada de usuarios): nao faz parte de nenhuma das duas Edge Functions inspecionadas; parece provisionado manualmente por fora do fluxo automatizado. Nao avaliado em profundidade nesta fase.
               
                - Conclusao honesta: o LPP funciona como mecanismo (comprovado via API), mas na pratica protege efetivamente zero das criacoes de conta desta aplicacao hoje, porque as 4 rotas de criacao usam a Admin API (que bypassa a checagem). A unica janela onde o LPP poderia realmente atuar — redefinicao de senha da coordenacao via link de recovery — nao foi confirmada. "LPP testado, sem regressao" deve ser lido como: mecanismo ativo e funcional na API publica, sem regressao no signup/login publico testado; cobertura real sobre os fluxos de producao da aplicacao e, no melhor cenario, parcial e nao confirmada, e no fluxo de aluno/responsavel (91% dos usuarios) e nula por desenho.
               
                - Este achado extrapola o escopo estrito de "ativar o toggle", mas fica registrado aqui porque muda o significado pratico do item — recomendo tratar como pendencia propria em fase futura (nao expando o escopo desta fase para corrigi-lo agora).
               
                - ## 4. Observabilidade
               
                - Pro deu acesso ao Logs Explorer unificado (API Gateway, Postgres, PostgREST, Auth, Storage, Realtime, Edge Functions, Poolers) com janela de consulta de ate 7 dias (Free normalmente limita a 1 dia). Nenhuma integracao externa nova foi feita (Sentry etc.), conforme escopo.
               
                - ## Pendencia critica reafirmada
               
                - Regiao atual e us-east-1, nao sa-east-1 — migracao de regiao e fase propria e separada, ainda nao iniciada.
               
                - ## Acoes pendentes (fora do escopo de execucao do assistente por seguranca)
               
                - 1. Apagar o projeto descartavel ops1-r1-restore-test-descartavel (ref lpjxlzsbrgqhvspxtrzh) — exclusoes permanentes sao proibidas para o assistente mesmo com permissao.
                  2. 2. Remover o usuario de teste criado durante o smoke test de LPP: ops1r1.smoke.test.1783115179577@gmail.com (UID b5b7f873-a44b-4502-9e5c-2ee6eb74c98c) em Auth > Users no projeto de producao.
                    
                     3. ## Nota de processo
                    
                     4. Durante a navegacao, o assistente clicou acidentalmente no toggle "Enable Captcha protection" (fora do escopo desta fase). O erro foi percebido antes de salvar e revertido; captcha permanece desativado, como estava antes de qualquer acao desta fase.
                    
                     5. ## Testes
                    
                     6. 3/3 (rejeicao de senha vazada via API publica, cadastro normal sem regressao, restore de banco com contagem de linhas batendo). Storage e Edge Functions: testados e confirmados como NAO cobertos pelo restore (2 verificacoes adicionais, ambas com resultado negativo esperado e documentado).
                     7. 
