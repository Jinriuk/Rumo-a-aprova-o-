# D1B — Testes

## Arquivo de testes criado

`tests/d1b-provisionamento.test.mjs`

## Cobertura de testes

| # | Teste | O que prova |
|---|-------|-------------|
| D1B-1 | super_admin cria escola com contato administrativo | Campos de contato persistem corretamente |
| D1B-2 | `backoffice_detalhe_escola` retorna coordenadores com email | Mudança de `string[]` para `{id,nome,email}[]` |
| D1B-3 | `backoffice_registrar_reenvio` registra log | Trilha de auditoria para reenvio |
| D1B-4 | coordenação não pode criar escola | Porteiro `eh_super_admin` funciona |
| D1B-5 | aluno não acessa backoffice | Isolamento de papel |
| D1B-6 | escola sem coordenador → coordenadores=[] | Checklist correto |
| D1B-7 | escola com coordenador → objeto {id,nome,email} | Estrutura correta de retorno |
| D1B-8 | `backoffice_editar_escola` persiste campos de contato | Novos campos na edição |
| D1B-9 | `admin_logs` registra ação `vincular-coordenador` | Auditoria completa |
| D1B-10 | escola suspensa → status bloqueado | RLS intacta |

## Testes de login (UI — não automatizados no suite de DB)

Os testes de login requerem ambiente de browser. Verificações manuais para D1B:

| # | Verificação |
|---|-------------|
| L1 | Campo senha alterna entre `type=password` e `type=text` ao clicar no olhinho |
| L2 | Valor digitado na senha não muda ao alternar visibilidade |
| L3 | `aria-label` muda conforme estado do olhinho |
| L4 | Botão "Esqueci minha senha" aparece apenas no modo coordenação |
| L5 | Botão "Esqueci meu código de acesso" aparece apenas no modo código |
| L6 | Tela de recuperação exibe mensagem genérica independentemente do e-mail |
| L7 | Fluxo de código continua funcionando normalmente |
| L8 | Fluxo de coordenação continua funcionando normalmente |

## Como executar os testes de banco

```bash
cd tests
npm test d1b-provisionamento.test.mjs
```

Ou todos os testes:
```bash
cd tests
npm test
```

## Dependências dos testes

- Banco de teste com migrations aplicadas até `0032_d1b_provisionamento_acessos.sql`
- Seeds padrão (`01_escolas_dev.sql` a `03_dados_dev.sql` — com `ESCOLA_A` e `ESCOLA_B`)
- `pool` conectado ao banco de teste local (`PGHOST`, `PGPORT` etc.)

## Notas

- Todos os testes de banco rodam em transação com rollback — não sujam o banco
- Super_admin é inserido temporariamente dentro da transação
- A Edge Function (`backoffice-coordenador`) não é testada via suite de banco — requer ambiente Supabase
