# Checklist de Auth e credenciais (S1.8)

> Itens a confirmar **antes da primeira escola real**. A maioria são
> toggles de painel (decisão/execução do dono), não código.

## Senhas
- [ ] **Leaked Password Protection ON** — Authentication → Policies /
      Password → habilitar a checagem HaveIBeenPwned. (Advisor
      `auth_leaked_password_protection` está WARN hoje.)
- [ ] Política de **força mínima** de senha definida (comprimento etc.).

## Coordenação
- [ ] Fluxo de **recuperação de senha** testado ponta a ponta (a conta
      nasce com senha aleatória; a pessoa define a dela pelo link). Exige
      SMTP/provedor de e-mail configurado no Supabase.
- [ ] Confirmar que `backoffice-coordenador` gera o link de recuperação
      (ou que o operador envia o reset manualmente).

## Operador / super_admin
- [ ] Super_admin inicial existe e está `ativo` em `internal_admins`.
- [ ] Existe um **segundo operador** de contingência (não ficar com 1
      ponto único de acesso ao backoffice).
- [ ] Processo de **rotação de senha** do operador documentado.
- [ ] Revogação testada: `ativo=false` tira o acesso (a RPC
      `eh_super_admin()` passa a devolver false).

## Aluno / responsável
- [ ] Códigos de acesso são entregues pela escola por canal seguro (não
      versionados, não em e-mail aberto em massa).
- [ ] Confirmar que o login por código não dispara round-trip de
      super_admin (otimização já no `useSessao`).

## Ativação no plano Pro (Etapa 8, item C-S05)

> Levantado em 24/09/2026 (Etapa 2, Fatia 6) com a documentação da
> Supabase do mesmo dia. Nada disto foi ligado. Demo primeiro; produção
> só depois do teste de cada linha passar no demo.

**Hoje, medido nos dois projetos:** o advisor
`auth_leaked_password_protection` está WARN (proteção desligada). Os
demais valores do Auth ficam no painel e não são legíveis por ferramenta;
o JWT expiry tem indício de 3600 s (ver `docs/e2-seguranca.md`, Fatia 1).

| # | Controle | Plano | Valor proposto | Teste na ativação |
| --- | --- | --- | --- | --- |
| 1 | Proteção de senha vazada (HaveIBeenPwned) | **Pro** | ligar | Trocar a senha de um aluno de teste para uma senha sabidamente vazada **pela tela de primeiro acesso** (Edge Function `trocar-senha`) e pelo link de recuperação da coordenação. As duas têm de recusar. **Atenção:** a `trocar-senha` troca pela API de admin (`updateUserById`); a documentação não diz se a checagem vale nesse caminho. Se não valer, a proteção não cobre alunos e responsáveis, e o PR da E8 tem de tratar isso. |
| 2 | Comprimento mínimo | todos | 8 (igual à regra do servidor em `trocar-senha` e do front em `shared/lib/senha.js`) | Senha de 7 caracteres recusada nos dois caminhos |
| 3 | Caracteres obrigatórios | todos | **não ligar** antes de alinhar o gerador | A senha temporária (`provisionar-aluno`, 16 caracteres de `[A-Za-z2-9]`) não tem símbolo e pode sair sem dígito. Exigir classes no Auth antes de mudar o gerador quebra a criação de conta ou o primeiro login. Ordem: gerador, `senha.js`, `trocar-senha`, depois o painel. |
| 4 | Sessão com prazo máximo (*time-box*) | **Pro** | decisão do produto; sugestão: 7 dias | A sessão acaba no primeiro refresh depois do prazo. A duração real é o prazo mais o JWT expiry. |
| 5 | Tempo de inatividade | **Pro** | decisão do produto; sugestão: 72 h | Idem: vale no refresh |
| 6 | Uma sessão por usuário | **Pro** | **não ligar** sem decisão: o aluno usa celular e computador | Login no segundo aparelho derruba o primeiro no próximo refresh |
| 7 | JWT expiry | todos | manter 3600 s ou baixar para 900 s | Encurta a janela de token velho: credencial revogada (ver abaixo), ex-coordenação com claims antigas e sessões de captura. A Supabase desaconselha menos de 5 min. |
| 8 | Exigir senha atual ou reautenticação na troca | todos | **não ligar** | O fluxo de hoje não pede a senha atual de propósito (a posse da sessão autoriza, como no link de recuperação). Ligar sem teste pode quebrar o link de recuperação. |

**Controles que já existem no Free e foram testados no banco em 24/09**
(`tests/etapa7-bloco-b-credencial.test.mjs`, bloco `E2/C-S05`):

- Só o servidor (`service_role`, nas Edge Functions) muda
  `must_change_password` e `credencial_status`. Nem o aluno, nem a
  coordenação, nem `anon` mudam, nem com um grant vazado (a RLS de
  `usuarios` não tem policy de UPDATE).
- A regra de senha do servidor (8+ caracteres, 2 classes, diferente do
  código) está em `trocar-senha` e tem teste.

**Limites conhecidos, registrados e não resolvidos pelo plano Pro:**

- `must_change_password` é uma trava de tela. Quem tem a senha temporária
  e fala direto com a API usa a conta sem trocar a senha. Não cruza
  escola.
- Credencial revogada continua valendo até o token expirar: o banimento
  impede o refresh, mas nenhuma policy lê `credencial_status`. A janela é
  o JWT expiry (item 7).
- Se o reset de senha feito pela coordenação encerra as sessões abertas
  do aluno: **não verificado** (precisa do Auth rodando; fica para a E3).

## Princípios já garantidos no código (não precisam de ação)
- Sem senha hardcoded; senha da coordenação é autodefinida.
- Sem `service_role` no front.
- Papel/escola vêm do **token** (não forjável), espelhados pela RLS.
