# Suíte E2E — Fase 14.5 (estabilização antes da Fase 15)

Testes de ponta a ponta com **Playwright**, dirigindo o app **real** (build de
produção via `vite preview`) contra o **Supabase de demonstração**. Sem mocks:
login real, RLS real, dados reais do seed (Colégio Vitrine Naval + Curso Beta).

## Como rodar

```bash
cd app
npm install
npm run test:e2e:install   # baixa o Chromium do Playwright (1ª vez)
npm run test:e2e           # roda a suíte (sobe o preview sozinho)
```

Relatório HTML: `app/playwright-report/index.html`.
Modo interativo: `npm run test:e2e:ui`.

> **Nota de ambiente:** na execução em nuvem do Claude Code o download do
> Chromium é bloqueado pela política de eg. de rede (`cdn.playwright.dev` fora
> do allowlist). Por isso a suíte é executada em ambiente local/CI com acesso
> ao CDN do Playwright. O `--list` (abaixo) valida config e specs sem browser.

```bash
npx playwright test --list   # lista os testes sem abrir navegador
```

## O que está coberto

| Arquivo | Fluxos |
|---|---|
| `auth.spec.js` | tela de login, código inválido, login+logout dos 3 papéis |
| `aluno.spec.js` | missão atual, cronômetro (iniciar/pausar/retomar/finalizar), validações do registro (tópico obrigatório, acertos ≤ questões, tempo livre), navegação por todas as abas |
| `responsavel.spec.js` | leitura do resumo do aluno; ausência de qualquer controle de edição |
| `coordenacao.spec.js` | painel/KPIs/alertas, navegação (Alunos/Ranking/Turmas/LGPD/Marca), abrir ficha do aluno, critério de destaque, **persistência da marca** (altera→reload→restaura) |
| `mobile.spec.js` | 390px: sem estouro horizontal e barra inferior nos papéis |

Toda asserção liga um **coletor de erros de console** (`coletarErros`) e reprova
o teste se houver erro não-conhecido. Os fluxos de escrita ou apenas validam
(sem salvar) ou **restauram o estado** ao final (marca).

## Credenciais usadas

Definidas em `e2e/_apoio.js` (`CONTAS`), conferidas em `auth.users` do projeto
de demo. Coordenação por e-mail+senha; aluno/responsável por código.
