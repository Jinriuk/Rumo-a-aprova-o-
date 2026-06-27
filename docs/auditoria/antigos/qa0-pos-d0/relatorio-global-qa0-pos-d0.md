# Relatório Global — QA0 pós-D0 · Rumo à Aprovação

Auditoria somente-leitura conduzida sobre a main, pós-D0. Atuei simultaneamente como QA sênior, arquiteto multi-tenant, auditor de segurança, especialista de UX/produto, diretor pedagógico e comprador potencial. Cobri: segurança do front, isolamento RLS (teste ativo), Aluno (completo), Responsável (completo), Coordenação (completo), Supabase (painel autenticado, read-only) e GitHub/CI. Superadmin/backoffice ficou parcial por exigir login privilegiado e ações de escrita.

## 1. Resumo executivo

A engenharia é boa e o isolamento multi-tenant é real e comprovado. Grande parte das telas do aluno já "parece produto pronto". Porém existem 8 itens P1 que separam o sistema de um piloto com dados reais — quase nenhum é de front: são infra/operacionais (região do banco fora do Brasil, ausência de backup, CI e2e quebrado e rodando contra demo, RPCs de backoffice expostas) mais um bug pedagógico (trilha x concurso) e a validação humana pendente do backoffice. Total: 0 P0, 8 P1, 11 P2, 6 P3.

## 2. Lista de achados (P0-P3)

| ID | Achado | Área | Prio | Esforço | Fase |
|----|--------|------|------|---------|------|
| SUP-1 | Banco em us-east-1 (EUA), contraria exigência LGPD do projeto (dado de menor no Brasil) | Infra/LGPD | P1 | Alto | S1/DB1 |
| SUP-2 | Sem backups configurados | Infra | P1 | Médio | S1 |
| CI-1 | Job e2e estoura 25min e é cancelado; main sem CI verde ponta a ponta | CI | P1 | Médio | S1 |
| CI-2 | E2E roda contra o ambiente demo (secrets ausentes) | CI | P1 | Baixo | S1 |
| SEC-1 | RPCs de backoffice SECURITY DEFINER chamáveis por authenticated (sem REVOKE) | Segurança | P1 | Médio | S1 |
| COO-4 | Aluno EsPCEx exibindo conteúdo de missão do Colégio Naval | Pedagógico | P1 | Médio | C1 |
| BO-2 | Bloqueio de /admin-interno para não-admin não testado | Superadmin | P1 | Baixo | C1 |
| BO-3 | Ciclo criar/editar/suspender/reativar + admin_logs não testado | Superadmin | P1 | Médio | C1 |
| DES-1 | "Nível por matéria" inconsistente (75%·150q=Avançado vs 76%·25q=Intermediário) | Aluno | P2 | Médio | C1 |
| COO-1 | "Meta atrasada 59/60" no Painel assusta na demo | Coordenação | P2 | Baixo | C1/demo |
| COO-2 | Ranking com Lucas como outlier artificial | Coordenação | P2 | Baixo | demo |
| COO-3 | "Turma CN 2026" com 2 alunos (resíduo de seed) | Coordenação | P2 | Baixo | demo |
| SEC-2 | Leaked Password Protection desabilitada | Auth | P2 | Baixo | patch |
| SEC-4 | Repositório público | Segurança | P2 | Baixo | patch |
| SEC-5 | Senha do superadmin compartilhada em texto | Operação | P2 | Baixo | patch |
| SUP-3 | Plano FREE / compute NANO para piloto | Infra | P2 | Baixo | S1 |
| VER-1 | Domínio vercel.app | Branding | P2 | Baixo | patch |
| ALU-1 | Mobile não validado visualmente | UX | P2 | Baixo | C1 |
| SEC-3 | search_path mutável em 2 funções | DB | P3 | Baixo | S1 |
| SUP-4 | 7 tabelas com policies permissivas múltiplas | RLS/Perf | P3 | Médio | S1 |
| SUP-5 | 45 sugestões de índice (perf) | Perf | P3 | Médio | S1 |
| CI-4 | Actions em Node.js 20 (depreciado) | CI | P3 | Baixo | patch |
| RES-1 | Dissonância "meta concluída" vs "poucos dias" | Responsável | P3 | Baixo | patch |
| RES-2 | Responsável não validado em mobile | UX | P3 | Baixo | C1 |

## 3. Próximos passos (ordem recomendada)

1. Decidir a região do banco (SUP-1) — decisão mais cara e jurídica; quanto mais cedo, menos dados para migrar.
2. 2. Habilitar backups e sair do FREE (SUP-2/SUP-3) antes de qualquer dado real.
   3. 3. Consertar o e2e do CI (CI-1/CI-2) — sem isso não há rede de regressão confiável.
      4. 4. Fechar a superfície das RPCs de backoffice (SEC-1) com REVOKE/INVOKER.
         5. 5. Corrigir trilha x concurso (COO-4) e validar com operador o backoffice (BO-2/BO-3).
            6. 6. Higienizar dados demo (COO-1/2/3) antes de gravar vídeo.
               7. 7. Patches rápidos: repo privado, domínio próprio, leaked-password ON, trocar senha superadmin, ajustar "nível por matéria", validar mobile.
                 
                  8. ## 4. Telas liberadas vs. evitar (print/vídeo)
                 
                  9. Liberadas: Plano/"Sua jornada", Conquistas/Patentes, Registrar, Histórico (aluno); Responsável; Marca/white-label e LGPD (coordenação).
                 
                  10. Evitar até corrigir: Painel da coordenação (COO-1), Ranking (COO-2), Turmas (COO-3), Ficha de aluno EsPCEx (COO-4) e qualquer tela com a URL vercel.app em destaque.
                 
                  11. ## 5. Recomendações para C1
                 
                  12. Padronizar a lógica de "nível por matéria" (blocos por volume x acerto); corrigir o mapeamento exam_tag para missões; higienizar o seed de vitrine; validar todas as telas em 430px (foco Simulados e Desempenho); operador testar o backoffice ponta a ponta.
                 
                  13. ## 6. Riscos
                 
                  14. - Jurídico/LGPD: dado de menor fora do Brasil (SUP-1).
                      - - Operacional: perda de dados sem backup (SUP-2); FREE pausa por inatividade (SUP-3).
                        - - Qualidade: sem e2e verde, regressões passam despercebidas (CI-1/CI-2).
                          - - Segurança: superfície de backoffice exposta, hoje só protegida por lógica interna (SEC-1).
                            - - Comercial: "tells" de demo e bug de trilha x concurso (COO-1 a COO-4).
                             
                              - ## 7. Conclusão — as duas perguntas, respondidas separadamente
                             
                              - a) Pronto para operar uma escola real em piloto controlado? Ainda NÃO — faltam ajustes técnicos/operacionais (não de tela). Os bloqueadores são infra e processo: região do banco (LGPD), ausência de backup, CI e2e quebrado e contra demo, e superfície de backoffice exposta. Resolvidos os 8 itens P1 (com validação humana do backoffice), fica apto a piloto controlado. A base — RLS real, service_role fora do front, testes de isolamento — sustenta a decisão.
                             
                              - b) Bonito, claro, convincente e usável para demonstração (print, vídeo, reunião)? Quase — SIM com ressalvas, após higienizar a demo. Aluno e white-label já parecem produto pronto. Demonstrar hoje exporia 4 fraquezas (meta 59/60, ranking artificial, turma-resíduo, trilha x concurso) mais a URL genérica. Com meio dia de ajuste de dados demo e domínio próprio, fica pronto para reunião de venda.
                             
                              - Veredito único: engenharia sólida e isolamento real; NÃO operar piloto com dado real antes dos 8 P1; PODE demonstrar em breve, após higienizar a vitrine e corrigir COO-4.
                             
                              - Lembrete de segurança: trocar a senha do superadmin agora que a auditoria encerrou. Nenhuma credencial/segredo foi reproduzido neste relatório.
