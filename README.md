# Rumo à Aprovação — sistema multi-tenant de acompanhamento de estudos

Sistema white-label para escolas/cursinhos preparatórios (Colégio Naval, EsPCEx, EEAr, CM),
nascido do painel "Rumo ao Naval". Multi-tenant de verdade: **o isolamento entre escolas é
regra de banco (RLS no Postgres), não disciplina de tela.**

> **AVISO QUE NÃO SE NEGOCIA:** a chave de serviço (`service_role`) NUNCA entra neste
> repositório, nunca vai ao navegador. Ela vive só nas Edge Functions do Supabase e na
> máquina do operador. Furar essa regra apaga o isolamento inteiro (Doc 4, seção 12).

## Estrutura (Documento 5)

```
app/        Front (React + Vite). Módulos por domínio; shared/data é o ÚNICO ponto que fala com o Supabase.
supabase/   Banco (migrations com RLS), Edge Functions (privilégio elevado), seed.
docs/       Documentação por área: fundacao/, fases/, auditoria/, operacao/, relatorios/. Índice em docs/README.md.
tests/      Prova de isolamento (Bloco 0), motor e regras preservadas.
scripts/    Ferramentas de operador (geração de seed, seed de usuários no Auth).
```

## Rodar os testes (inclui a prova de isolamento)

Requer um Postgres local (sem Supabase) e Node 20+:

```bash
cd tests
npm install
bash reset-db.sh        # cria rumo_teste, aplica migrations + seed (2x — prova idempotência)
npm test                # isolamento (Bloco 0) + motor (virada) + regras preservadas
```

O teste de isolamento assume a identidade real (papel `authenticated` + claims JWT,
o mesmo que o Supabase entrega à RLS) e prova que a escola A não lê nem escreve
NADA da escola B — leitura, escrita, forja de tenant, tudo.

## Subir o ambiente real (Supabase + Vercel)

1. Crie um projeto Supabase em **São Paulo (sa-east-1)** — LGPD, dado de menor fica no Brasil.
2. Aplique as migrations na ordem: `supabase/migrations/0001…0005` (via `supabase db push` ou SQL editor).
3. Rode os seeds de dev: `supabase/seed/01…03` (NUNCA em produção real — é a escola de vitrine).
4. Crie as contas de demo no Auth: `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/seed-auth-usuarios.mjs`.
5. Faça deploy das funções: `supabase functions deploy gerar-meta virar-semana provisionar-aluno lgpd-titular`.
6. Confirme o agendamento da virada (migration 0004 cria o job no pg_cron; `select * from cron.job;`).
7. Front: `cd app && npm install && npm run build` — deploy no Vercel com
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (só as chaves públicas).

## Login

- **Coordenação:** e-mail + senha (conta provisionada pelo operador).
- **Aluno / responsável:** código `XXXX-XXXX-XXXX` gerado pela coordenação
  (aluno é menor: não cria conta, não administra senha — Doc 6, 1.1).

## As regras que não mudam

- Virada de semana por **data local** (America/São_Paulo), no **servidor**, agendada.
- Nota projetada do Dia 1 = **(mat + ing) × 2,5**.
- Design fixo navy `#0A1622` / dourado `#CDA349` / Fraunces / Archivo; white-label leve
  (logo, nome, cor de acento) por cima.
- Conteúdo (trilha) é global e do operador; progresso é da escola, isolado.

Ambas as fórmulas têm teste que as confere contra a versão atual (`tests/regras.test.mjs`,
`tests/motor.test.mjs`).
