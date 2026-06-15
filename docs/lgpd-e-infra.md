# LGPD, região e infraestrutura (Fase 17.3)

> O sistema trata dados de **alunos e responsáveis — muitos menores**.
> A infraestrutura precisa estar adequada **antes de cliente real**.

## Decisão-gate (não negociável)

**Não colocar escola real pagante com dados reais enquanto a região não
estiver em sa-east-1 e o checklist abaixo não estiver fechado.** Dá para
vender e demonstrar; não dá para operar dado real de menor fora de
conformidade.

Hoje o projeto que o front usa (`bdjkgrzfzoamchdpobbl`) está em
**us-east-1** e é rotulado "demo". Serve para demonstração — **não** para
dado real.

## Inventário de dados (o que coletamos)

Minimização já é regra do schema (Doc 4 §8):

| Dado | Onde | Observação |
|------|------|------------|
| Nome do aluno | `alunos.nome` | **só o nome** — sem CPF, RG, endereço |
| Nome do responsável | `consentimentos.responsavel_nome`, vínculo | só nome |
| Registros de estudo | `registros_estudo` | questões/acertos/minutos/tópico |
| Metas, simulados, níveis, XP | tabelas do motor | desempenho pedagógico |
| Consentimento | `consentimentos` | data + quem registrou (trilha LGPD) |
| Trilha de acesso | `logs_acesso` | quem leu dado de aluno, quando, qual ação |
| Credenciais | Supabase Auth | aluno/responsável por código; coordenação por e-mail |

Não há dado financeiro, biométrico nem documento. Isolamento por escola é
garantido por **RLS** (migrations `0002` + por tabela).

## Provisionar o projeto de produção (sa-east-1)

Mesmo procedimento do `deploy-checklist.md`, num projeto novo na região
Brasil:

1. Criar projeto Supabase em **sa-east-1** (custo $0 no free tier;
   avaliar plano pago para backup/retenção adequados — ver abaixo).
2. `supabase link --project-ref <REF>` + `supabase db push` (aplica
   `0001..NNNN` e mantém o tracking; rode `scripts/checar-migrations.mjs`).
3. Aplicar **apenas os seeds de catálogo global** (05,06,07,09,10,12) —
   **não** os seeds de demo/dev (01–04, 08, 11), que criam escolas
   fictícias. Em produção, as escolas reais entram pelo backoffice (17.4).
4. Apontar o front para o novo projeto: `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` (Vercel + `app/.env.production`).
5. Reprovisionar Edge Functions e o `SUPABASE_SERVICE_ROLE_KEY` (só no
   servidor/funções — nunca no front).

## Configurações de Auth (painel do Supabase)

- **Habilitar "Leaked Password Protection"** (Auth → Policies) — hoje está
  desabilitado (advisor `auth_leaked_password_protection`). Verifica senhas
  contra HaveIBeenPwned.
- Manter `enable_signup = false` (provisão pelo operador; aluno é menor).
- Revisar política de senha mínima para as contas de coordenação.

## Backups e retenção

- Habilitar **backups automáticos** do Supabase (depende do plano; o free
  tier tem retenção curta — avaliar plano pago para produção real).
- No começo, **export manual periódico** (dump) guardado fora do Supabase.
- Checklist antes de migration sensível: backup + `checar-migrations`.
- Definir **política de retenção** (quanto tempo guardar dado de aluno
  após saída da escola) e o fluxo de **exclusão a pedido do titular** — já
  existe o endpoint `lgpd-titular` (exportar/excluir) na camada de dados.

## Checklist LGPD (resumo)

- [ ] Projeto em sa-east-1 para dado real
- [ ] RLS validada (suíte `tests/isolamento.test.mjs`) no projeto real
- [ ] Leaked password protection habilitado
- [ ] `service_role` ausente do front e do repositório
- [ ] Backup automático + export manual definidos
- [ ] Política de retenção e fluxo de exclusão do titular documentados
- [ ] Consentimento registrado por aluno (`consentimentos`) no fluxo de
      implantação (17.5)
- [ ] Inventário de dados acima revisado com quem responde pela escola

## Critério de conclusão (17.3)
O ambiente para cliente real está **definido e documentado**: região
sa-east-1, Auth endurecido, backup e retenção decididos, e o gate acima
respeitado.
