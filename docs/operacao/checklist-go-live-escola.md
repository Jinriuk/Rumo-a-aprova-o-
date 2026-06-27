# Checklist de go-live por escola (ADM2)

> **Para que serve:** rodar **a cada escola** antes de liberar acesso real.
> O backoffice já calcula a maior parte deste checklist na tela
> **Detalhe da escola → "Checklist de go-live"** (deriva de dado real do
> banco). Os itens **manuais** (backup, smoke, SMTP, termo) não são
> detectáveis pelo sistema — são confirmados aqui, pelo operador.
>
> Diferença para os irmãos:
> - `docs/operacao/go-live-checklist.md` — o **sistema** está pronto para o
>   primeiro cliente (uma vez só).
> - `docs/operacao/checklist-go-live-piloto.md` — checklist do **piloto** (Fase A.9).
> - **este** — versão ADM2, alinhada item-a-item com o checklist que o
>   SuperADM mostra na tela, separando **automático** (o banco confirma) de
>   **manual** (o operador confirma).

Fonte da lógica: `app/src/modules/backoffice/operacao.js` → `checklistGoLive()`.
Honestidade por padrão: o painel **só** mostra "✓ go-live" quando **todo
item crítico** (inclusive os manuais) está concluído — nunca dá falso
"pronto" porque os automáticos fecharam.

---

## Legenda

- **✓ automático** — o backoffice marca sozinho ao ler o dado real.
- **◌ manual** — o operador confirma fora do sistema e marca aqui.
- **crítico** — trava o go-live enquanto faltar.

---

## Grupo: Cadastro

- [ ] **Escola criada** _(automático, crítico)_
- [ ] **Dados básicos** — nome e slug _(automático, crítico)_
- [ ] **Contato administrativo informado** — e-mail institucional, nome do
      responsável ou telefone _(automático)_ — necessário para enviar
      acessos/avisos.
- [ ] **Marca configurada** — cor de acento ou logo _(automático)_

## Grupo: Acesso

- [ ] **Coordenador provisionado** _(automático, crítico)_ — criar pelo
      painel "Coordenação" do backoffice (sem script manual).
- [ ] **Coordenador com e-mail de acesso** _(automático, crítico)_ — sem
      e-mail não há link de senha; o coordenador não entra.

## Grupo: Alunos

- [ ] **Turmas criadas** _(automático)_
- [ ] **Alunos cadastrados** _(automático, crítico)_
- [ ] **Credenciais/códigos gerados** _(automático)_ — o código aparece
      uma vez; confirmar que a escola anotou/entregou.
- [ ] **Responsáveis vinculados** _(automático)_, onde aplicável.

## Grupo: Conformidade

- [ ] **Consentimento LGPD registrado** _(automático)_ — obrigatório para
      aluno menor; registrar **antes** de liberar acesso.
- [ ] **SMTP / fallback de e-mail verificado** _(◌ manual)_ — confirmar que
      o envio de senha/aviso funciona, ou que o fallback de link manual
      está definido. Ver `docs/operacao/auth-credenciais-checklist.md`.
- [ ] **Termo de uso / contrato aceito** _(◌ manual)_ — confirmação de
      processo; o sistema não detecta.
- [ ] **Backup confirmado e testado** _(◌ manual, crítico)_ — backup do
      projeto Supabase validado. Ver `docs/operacao/backup-retencao-lgpd.md`
      e `docs/operacao/monitoramento-backup.md`.
- [ ] **Smoke test dos 4 perfis** _(◌ manual, crítico)_ — login real
      testado, sem erro de console, em: **aluno**, **responsável**,
      **coordenação** e **superadmin/backoffice**.

## Grupo: Go-live

- [ ] **Escola ativada (status `ativa`)** _(automático, crítico)_ — mudar o
      status para `ativa` **só quando** todo o restante estiver pronto. A
      ação fica registrada em `admin_logs` (reversível).

---

## Separação demo / teste / real / individual

Antes de ativar, confirme a **categoria** correta (o backoffice mostra o
selo na lista e no detalhe — derivado de `categoriaEscola()`):

| Categoria | Quando | Cuidado |
|---|---|---|
| **Demonstração** | status `demo`, slug `vitrine/demo`, plano `demo` | dado fictício — **nunca** misturar com aluno real (ver `docs/operacao/lgpd-e-infra.md`) |
| **Teste/Piloto** | `implantacao`/`piloto`, slug de sandbox | ainda não é operação plena |
| **Escola real (B2B)** | `ativa` e sem sinal de demo/teste | cliente em produção, dado real |
| **Individual/B2C** | plano `individual/b2c` ou limite 1 | modalidade futura — placeholder controlado |

> Uma escola **só** é classificada como "real" quando está `ativa` e não
> dispara nenhum sinal de demo/teste — nunca "real" por omissão.

---

## Avisos de risco (o backoffice destaca)

O painel "Avisos de risco" do detalhe lista automaticamente, por nível:

- **Risco (vermelho):** escola sem coordenador; limite de alunos excedido.
- **Alerta (dourado):** coordenador sem e-mail de acesso; escola sem
  alunos (exceto demo); sem e-mail institucional; alunos sem credencial;
  sem consentimento LGPD.
- **Info (neutro):** ambiente demo; escola suspensa/cancelada.

Resolva todo **risco** e avalie cada **alerta** antes do go-live.

---

## Pós-ativação (primeiros dias)

- [ ] Confirmar nos **logs administrativos** (`admin_logs`, painel "Logs
      administrativos") que a ativação e o provisionamento aparecem.
- [ ] Acompanhar "Alunos ativos (7d)" no dashboard — primeiro sinal de uso real.
- [ ] Canal de suporte e de emergência ativos (`docs/operacao/rollback.md`).
