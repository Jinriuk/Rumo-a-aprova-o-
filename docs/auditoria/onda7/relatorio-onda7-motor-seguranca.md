# Onda 7 — motor de virada e segurança

Fecha A2, A3, S1, S2 e S3 do catálogo de 86 defeitos. Medido contra os
**bancos vivos** (demo `bdjkgrzfzoamchdpobbl` e produção
`zckyhihxjjbnqjqilymn`) em 17/09/2026, não contra o relatório de 12/09.

Três dos cinco itens estavam descritos errado no catálogo. As correções
estão abaixo, com a evidência de cada uma.

---

## A2 — o alerta da virada não tinha como ficar vermelho ✅ corrigido

### O que o catálogo diz

> 44 execuções entre 16/07 e 12/09, **2 dias geraram meta**, 3 fecharam, e o
> alerta marcou verde em 41 dos 44. (…) O motor não está "parado desde
> agosto": ele praticamente nunca produziu.

### O que o banco mostra

A segunda metade é **falsa**. O motor funcionou.

| dia | metas_fechadas | metas_geradas | |
|---|---|---|---|
| 16–19/07 | 0 | 0 | meio de semana |
| **20/07** | 63 | **63** | virada de semana — todos os alunos com trilha |
| 21–26/07 | 0 | 0 | meio de semana |
| **27/07** | 63 | **63** | virada seguinte — todos de novo |
| 28/07–01/08 | 0 | 0 | meio de semana |
| **02/08** | 63 | 0 | trilha encerrou em 01/08: fechou as últimas, gerou nenhuma |
| 03/08 → hoje | 0 | 0 | ciclo encerrado |

O heartbeat começou em 16/07 e a única trilha (9 semanas, 30/05 a 01/08)
acabou em 01/08. Nessa janela de 17 dias houve **exatamente 2 viradas de
semana**, e o motor produziu nas 2, para os 63 alunos, com zero erro.
"2 de 49 dias geraram meta" é **aritmética de job semanal**, não sintoma:
um job que vira a semana só produz no dia da virada.

`alunos_com_erro` foi **0 em todas as 49 execuções**.

### O defeito real, que o catálogo tangenciou

`app.virada_saude()` (migration 0043) decidia `ok` assim:

```sql
(v.alunos_com_erro = 0 and v_horas <= p_janela_horas)
```

`metas_geradas` era devolvido e **nunca testado**. Os dois sinais falam da
última **execução** ("rodou? explodiu em alguém?") e nenhum fala do
**estado** que a execução deveria ter produzido.

Consequência: se o motor parar de verdade no meio de um ciclo, o heartbeat
continua gravando linha, `alunos_com_erro` continua 0 (ninguém falhou —
ninguém foi processado) e o painel **continua verde**. O demo nunca expôs
isso porque nunca teve a falha. O alerta não é falso-verde por um bug de
condição: ele **não tem como** ficar vermelho por falta de produção.

### Correção (migration 0050)

Terceiro sinal, de estado e não de execução:

```
alunos_sem_meta = aluno cuja trilha tem semana cobrindo hoje
                  e que não tem meta ativa dessa semana
```

Exclusões, que é onde um alerta destes vira ruído se errar:

| sai da conta | por quê |
|---|---|
| ciclo encerrado | sem semana vigente, não há meta a cobrar — cai sozinho pela definição, sem precisar de um segundo sinal de ciclo (mesma doutrina do T31, Onda 5) |
| `status_provisionamento = 'pendente_configuracao'` | aluno ainda não terminou de ser provisionado (0046) |
| escola `suspensa` / `cancelada` | desligada de propósito (0025) |

`demo` e `piloto` **contam**: rodam o motor de verdade e precisam ser
vigiadas.

**Aplicada em demo e produção** em 17/09/2026. Estado depois de aplicar:

- demo: `ok=true`, `alunos_sem_meta=0` — correto, o ciclo encerrou em 01/08
  e ninguém está devendo meta. O sinal novo não gera falso positivo em
  dado real.
- produção: função criada com a assinatura nova, `security definer`, grants
  só para `postgres` e `service_role` (`authenticated`/`anon` revogados).

Cobertura: `tests/onda7-virada-saude-resultado.test.mjs`, 5 testes. **2
travam o defeito** (conferidos contra a falha: restaurando a condição da
0043 no banco local, quebram) e **3 guardam as exclusões** contra falso
positivo — esses passam nas duas versões, de propósito.

---

## A3 — "zero meta aberta" não é defeito ❌ correção ao catálogo

### O que o catálogo diz

> 547 metas, todas `fechada`, zero aberta **no banco inteiro**. Consequência
> de A2.

### O que o banco mostra

As duas afirmações não se sustentam.

1. **"No banco inteiro" era só o demo.** Produção tem **1 meta `ativa`**
   agora (mais 2 fechadas). O motor está abrindo meta em produção.
2. **Zero meta ativa no demo é o resultado CORRETO.** A trilha encerrou em
   01/08; hoje é 17/09. O invariante que importa — "aluno cuja trilha tem
   semana vigente hoje e que não tem meta aberta" — dá **0**. Não há aluno
   descoberto. As 547 metas fechadas são um ciclo completo, encerrado.

O pedido operacional do plano ("confirmar que o motor corrigido produz meta
aberta antes do reseed da Onda 8") **já está evidenciado**: 63/63 nas duas
viradas de semana que existiram, e uma meta ativa viva em produção.

**Sem ação de código.** O que o A3 media como sintoma é a Onda 3 (ciclo
encerrado) funcionando.

---

## S1 — código no ar; credenciais giradas ✅ / ⚠ resíduo

### Deploy: feito, e verificável

Comparando o `ezbr_sha256` das 7 Edge Functions entre os dois ambientes:

| função | demo | produção |
|---|---|---|
| provisionar-aluno | `402c5f3c…` | `402c5f3c…` |
| gerar-meta | `28e7a1cd…` | `28e7a1cd…` |
| virar-semana | `deef4ac7…` | `deef4ac7…` |
| lgpd-titular | `79cfb079…` | `79cfb079…` |
| backoffice-coordenador | `f1cd2e67…` | `f1cd2e67…` |
| revogar-responsavel | `6e90f899…` | `6e90f899…` |
| trocar-senha | `d4313842…` | `d4313842…` |

**Byte-idênticas nos dois ambientes**, todas com `verify_jwt: false`.
`provisionar-aluno` está pós-#95 (senha temporária +
`must_change_password`). O drift que a auditoria de 13/09 achou — 4 funções
com cópia inline de CORS e o `provisionar-aluno` pré-#95 — **acabou**.

Isso também fecha o **B1 em runtime**, que a Onda 1 deixou como "código
pronto, aguarda deploy".

### Credenciais: giradas

As 78 credenciais do demo nasceram no código velho (`password =
normalizarCodigo(codigo)` — senha = código) e estavam todas com
`must_change_password = false`. Marcadas como `true` em 17/09:

| papel | marcados |
|---|---|
| aluno | 67 |
| coordenação | 7 |
| responsável | 4 |
| **total** | **78** |

O enforcement existe e é total: `App.jsx:137` prende o app inteiro atrás do
`TrocarSenhaObrigatoria` enquanto a flag for true, para qualquer papel.

### ⚠ Resíduo honesto

`must_change_password = true` força a troca **no próximo acesso** — não
invalida a senha conhecida para esse primeiro acesso. Quem já sabe um
código pode logar uma vez e escolher a nova senha, o que trancaria o
usuário legítimo para fora (visível, mas ruim).

O passo mais forte é `credencial_status = 'revogada'`, que bloqueia o login
até a coordenação re-provisionar. **Não foi aplicado**: revogar as 78
inutiliza o demo como peça de venda até alguém re-gerar credencial uma a
uma. Fica como decisão do dono, por credencial.

Também corrigido: `Login.jsx` exibia `LUCASDEMO2026` — código real do aluno
de demonstração — como placeholder do campo na **tela pública**. Virou
exemplo fictício, travado por teste.

---

## S2 — Leaked Password Protection ⚠ aberto, ação do dono

Confirmado aberto pelo advisor do Supabase
(`auth_leaked_password_protection`, WARN, ambos os projetos):

> Supabase Auth prevents the use of compromised passwords by checking
> against HaveIBeenPwned.org. Enable this feature to enhance security.

É toggle de painel, não de código — não há como ligar por migration nem
por MCP. Caminho: **Dashboard → Authentication → Policies → Password
Security → Leaked password protection**.

Vale especialmente agora: com as 78 credenciais forçadas a trocar de senha,
a proteção impede que a nova senha escolhida seja uma senha já vazada.

---

## S3 — 11 funções `SECURITY DEFINER` expostas ✅ fecha documentado

O advisor lista **11** funções `SECURITY DEFINER` chamáveis por
`authenticated` — a contagem do catálogo está certa. Nenhuma é buraco:

| função | porteiro |
|---|---|
| `backoffice_criar_escola`, `backoffice_dashboard`, `backoffice_definir_status`, `backoffice_detalhe_escola`, `backoffice_editar_escola`, `backoffice_escolas`, `backoffice_registrar_reenvio`, `backoffice_virada_saude` | `app.eh_super_admin()` interno; recusam com `acesso negado` (exercitado na suíte) |
| `resumo_escola()` | escopada por tenant; há teste afirmando que não vaza entre escolas |
| `salvar_onboarding_aluno()` | escreve só o onboarding do próprio chamador; valida faixa de entrada |
| `sou_super_admin()` | devolve um booleano sobre o próprio chamador |

O padrão é deliberado: `SECURITY DEFINER` com porteiro no corpo é como o
repo dá acesso cross-tenant controlado ao super-admin sem afrouxar RLS.
Trocar para `SECURITY INVOKER` quebraria as funções sem ganho.

**Fecha como documentado, não como corrigido** — que é o que o próprio
relatório de origem concluiu.

### Achado lateral, fora do catálogo

O advisor também aponta `rls_enabled_no_policy` (INFO) em
`app.acessos_codigo` e `app.login_tentativas`: RLS ligada, zero policies.
Isso é **fail-closed** e correto — são tabelas internas do schema `app`,
acessadas só por funções `SECURITY DEFINER`, e a suíte já confirma
`permission denied` para `authenticated`. Sem ação.
