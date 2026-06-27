# Ambiente E2E isolado (Fase 17.2)

> Problema que motivou: a suíte E2E (Playwright) escreve no banco — o
> teste de marca altera o **nome da escola**. Rodando contra o projeto de
> **demo compartilhado**, isso corrompe a vitrine (chegou a ficar
> `"Matriz ⟦e2e⟧"`). Solução: o E2E roda contra um **projeto Supabase só
> dele**, descartável e reseteável, sem valor comercial.

## Os três ambientes

| Ambiente | Para quê | Banco |
|----------|----------|-------|
| **Produção** | clientes reais | projeto sa-east-1 (ver `lgpd-e-infra.md`) |
| **Demo comercial** | apresentação/vendas | projeto demo — **não** usado por teste destrutivo |
| **E2E / teste** | CI Playwright | projeto próprio, reseteável, descartável |

Regra: **o E2E nunca escreve no demo nem na produção.**

## O que já está pronto no código

O job `e2e` do CI (`.github/workflows/ci.yml`) builda apontando para o
projeto isolado **quando os secrets existirem**:

- `secrets.E2E_SUPABASE_URL`
- `secrets.E2E_SUPABASE_ANON_KEY`

**Atualização S1.1/S1.2 — comportamento honesto:** um job `e2e-guard`
traduz a presença do secret num booleano e o job `e2e` só roda
`if: needs.e2e-guard.outputs.isolado == 'true'`. Ou seja:

- **Com** os secrets: o E2E roda contra o projeto isolado (escreve
  `app/.env.production.local`, ignorado pelo git, com prioridade sobre
  `.env.production`).
- **Sem** os secrets: o E2E é **PULADO de forma explícita** (estado
  "skipped" no GitHub, com `::warning::`) — **nunca mais roda contra o
  banco de demo**. Antes, o comportamento era rodar contra o demo com um
  aviso; isso foi removido porque (a) poluía a vitrine e (b) um job
  cancelado/timeout contra o demo compartilhado podia parecer "verde".

O **gate autoritativo do PR** passa a ser só `build-e-unitarios`
(determinístico, sem rede externa, com guarda anti-"verde vazio" que
falha se a suíte rodar < 200 testes). O E2E é um sinal complementar,
opcional e isolado — não um portão que finge passar.

## Passos manuais (uma vez) — só você consegue fazer

1. **Criar o projeto E2E** no Supabase (custo **$0**, free tier). Região
   pode ser us-east-1 (é teste, sem dado real).
2. **Subir o schema + seed** no projeto E2E (mantém o tracking de
   migrations correto — ver `deploy-checklist.md`):
   ```bash
   supabase link --project-ref <REF_DO_PROJETO_E2E>
   supabase db push                       # aplica migrations 0001..NNNN
   # seeds (catálogo + dados de demo, todos idempotentes):
   for f in supabase/seed/[0-9][0-9]_*.sql; do
     case "$f" in */04_*) continue;; esac   # 04 é Auth (abaixo)
     psql "$E2E_DB_URL" -f "$f"
   done
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-auth-usuarios.mjs
   ```
3. **Adicionar os secrets no GitHub** (Settings → Secrets and variables →
   Actions): `E2E_SUPABASE_URL` e `E2E_SUPABASE_ANON_KEY` com os valores
   do projeto E2E (anon key é pública por design).
4. Pronto: o próximo CI roda o E2E isolado. Como o banco é só de teste,
   o teste de marca pode sujar à vontade.

## Reset entre execuções

O seed é **idempotente** e os testes restauram o que mudam (o de marca
restaura no `finally`). Para um reset forte do projeto E2E, reaplique os
seeds (ou `supabase db reset` apontando para o projeto E2E). Como o banco
não tem valor comercial, resetar é seguro.

## Critério de conclusão (17.2)
O E2E roda N vezes sem corromper a escola demo. Atingido quando os secrets
`E2E_SUPABASE_*` apontam para o projeto de teste.

## Registro: episódio de flaky na área do aluno (Fase 17)

Durante o fechamento da Fase 16/17, o E2E da **área do aluno** ficou
vermelho em vários runs (o menu "Hoje" não aparecia em 15s) e depois
**passou com o mesmo código de aplicação** (login do aluno em ~1.5s).
Conclusões:

- **Não era bug de produto:** as queries do aluno (metas/registros/
  simulados/trilha/concursos) funcionam; coordenação e responsável
  passavam; o aluno é o único teste que espera a tela carregar por
  inteiro, logo o "canário" de degradação do banco demo **remoto e
  compartilhado**.
- **Não era latência determinística:** medida ~50ms; a falha foi
  intermitente (concentrada em janelas de degradação do demo).
- **Mitigações aplicadas (ficam):**
  - `useSessao` não checa `souSuperAdmin()` em login por código
    (aluno/responsável nunca são super_admin) → um round-trip a menos no
    caminho mais sensível a latência.
  - **Evidência no CI em qualquer falha do aluno** (`_apoio.loginAluno`):
    a mensagem do erro embute console/página, **falhas de rede
    (4xx/5xx)** e o texto visível da tela; e `playwright.config` retém
    **trace + vídeo + screenshot** (além do HTML report). Não dá mais
    para "não aparecer no log".
- **Pendência obrigatória:** isolar o E2E em projeto Supabase próprio
  (acima) elimina a causa-raiz da fragilidade.
