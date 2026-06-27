# Relatório de Segurança — QA0 pós-D0

## Resumo

A postura de segurança é o ponto mais forte do sistema. O isolamento multi-tenant por RLS funciona de verdade (testado), o front não expõe segredos, e o Security Advisor do Supabase não reporta NENHUM erro (0 errors). Há 11 warnings — nenhum é bloqueador, mas dois temas merecem atenção antes do piloto.

## O que foi verificado (com evidência)

- Bundle do front (Vercel): varredura do JS de produção. Só a anon key aparece. Nenhum service_role, nenhuma chave de OpenAI/Google, nenhum token. PASS. Bate com a regra do README: service_role nunca vai ao navegador.
- Isolamento RLS (teste ativo): com o token da Coordenação (não-admin) mais anon key, via PostgREST: escolas=1 (só a própria); alunos=60 mesmo escola_id; usuarios=62 mesmo escola_id; internal_admins=vazio; admin_logs=vazio; RPC sou_super_admin()=false. Conclusão: escola A não enxerga nada de escola B nem do backoffice. Isolamento real.
- Supabase Security Advisor: 0 errors, 11 warnings, 0 info.

## Achados

| ID | Achado | Área | Conta | Impacto | Prio | Sugestão | Esforço | Fase |
|----|--------|------|-------|---------|------|----------|---------|------|
| SEC-1 | 8 funções SECURITY DEFINER chamáveis por usuário logado (backoffice_*, resumo_escola, sou_super_admin) | DB/RPC | todas | Médio. Checam super-admin internamente (coordenação recebe vazio/false), mas a superfície fica exposta na API, sem REVOKE EXECUTE | P1 | REVOKE EXECUTE FROM authenticated, ou SECURITY INVOKER, ou schema fora da API; manter sou_super_admin como 2a camada | Médio | S1 |
| SEC-2 | Leaked Password Protection desabilitada | Auth | coord/superadmin | Baixo/Médio. Permite senhas já vazadas (HIBP) | P2 | Ativar em Auth, Passwords | Baixo | patch |
| SEC-3 | 2 funções com search_path mutável (app.xp_por_prioridade, app.xp_simulado) | DB | — | Baixo. Hardening | P3 | ALTER FUNCTION SET search_path | Baixo | S1 |
| SEC-4 | Repositório público no GitHub | GitHub | — | Médio. Fonte aberta facilita mapear ataque; sem segredos commitados vistos, mas risco desnecessário | P2 | Tornar privado antes do piloto comercial | Baixo | patch |
| SEC-5 | Senha do superadmin compartilhada em texto | operação | superadmin | Médio. Credencial de maior privilégio fora de cofre | P2 | Trocar a senha ao fim da auditoria | Baixo | patch |

## Não verificável de forma independente

- Conteúdo das Edge Functions — não acessível pelo painel sem abrir áreas editáveis. Revisar em S1.
- Rotação de chaves e secrets do CI — requer operador.
