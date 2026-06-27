# Relatório RC1 — Varredura Funcional Total e Matriz de Bugs Reais

**Data:** 2026-06-27 · **Branch:** `claude/rc1-functional-sweep-foc0wb`
**Fase anterior:** SEG2 · **Próxima:** FIX1 (correções priorizadas)

---

## 1. Objetivo da camada

Testar o sistema inteiro como usuário real (aluno, responsável, coordenação,
superadmin), **sem corrigir em massa**, para descobrir o que funciona, o que não
funciona, erros de console, botões mortos, fluxos incompletos e experiência
confusa — entregando uma **matriz objetiva** de correções, não opinião solta.

---

## 2. O que foi feito

1. Leitura do contexto obrigatório: `00-indices` (mapa, status, pendências),
   SEG1/SEG2 (índice de segurança) e REG0.
2. Auditoria de **100% das rotas** e componentes de cada perfil
   (`App`, `Login`, `RedefinirSenha`, `AreaAluno`/`VisaoEstudo`,
   `AreaResponsavel`/`ResumoResponsavel`, `AreaEscola`/`ListaAlunos`/
   `VinculosResponsavel`/`Turmas`, `AreaAdmin`) e do **seam de dados**
   (`shared/data/index.js`) — incluindo Edge Functions chamadas.
3. **Build de produção** (`vite build`): **verde**.
4. **Runtime parcial** com Playwright/Chromium: render do login e caminhos de
   erro (console capturado).
5. Classificação dos achados (P0–P3/UX/Infra) e correção dos **2 itens P2/P3
   simples e isolados**; o resto documentado para FIX1.
6. Entrega dos 4 documentos da camada.

### Limite honesto do ambiente

A execução "como usuário real" dos fluxos **com dado** ficou **bloqueada**:
o sandbox não tem saída de rede para o Supabase de demo
(`net::ERR_TUNNEL_CONNECTION_FAILED`) e o Chromium pré-instalado (build 1194)
diverge do esperado pelo `@playwright/test@1.61.1` (1228). Isso está registrado
(OBS-RC1-007) e os itens dependentes estão marcados **BLQ** para validação no
**ambiente E2E isolado** já previsto no `ci.yml`. **Não** declaramos verde o que
não rodou.

---

## 3. Correções aplicadas nesta fase (isoladas, baixo risco)

| ID | O que mudou | Por quê | Risco | Teste | Rollback |
|----|-------------|---------|-------|-------|----------|
| BUG-RC1-001 | Seletor E2E do login por código → por rótulo (`campo("Código de acesso")`) em `_apoio.js` e `auth.spec.js` | Placeholder mudou p/ `Ex.: LUCASDEMO2026`; seletor antigo quebrava todo login por código na suíte | Nulo (só teste) | `auth › código inválido` ✅ | reverter 2 linhas |
| BUG-RC1-002 | Favicon SVG inline no `index.html` | Eliminar 404 de `/favicon.ico` no console (preview/local) e ruído na E2E | Nulo (CSP cobre `data:`) | `auth › tela de login aparece` ✅ console limpo | remover `<link rel="icon">` |

Nenhuma migration, nenhuma mudança de RLS/Auth/Edge Function, nenhuma alteração
de comportamento de runtime para os perfis.

---

## 4. Achados documentados para FIX1 (não corrigidos aqui)

| ID | Sev. | Resumo |
|----|------|--------|
| OBS-RC1-003 | UX/P3 | Falhas de auth esperadas logam `console.error` técnico (UI já mostra msg amigável) |
| OBS-RC1-004 | **P2** | Responsável com 2+ filhos vê só 1 aluno (`.limit(1)`), sem seletor — pede decisão de produto |
| OBS-RC1-005 | P3 | `useSessao`: branch `ESCOLA_SUSPENSA` é código morto |
| OBS-RC1-006 | P3/Perf | Bundle único 1.09 MB sem code-splitting |
| OBS-RC1-008 | P3/UX | Contextos sem entrada em `mensagemAmigavel` caem no genérico |

Detalhe completo (impacto, causa, recomendação, risco) em `bugs-e-regressoes.md`.

---

## 5. Revisão dupla

**Revisão 1 (funcionalidade como usuário real):** executada na medida do
ambiente — render do login com console aberto (limpo após correção), caminho de
código inválido (mensagem amigável) e captura do erro técnico de auth no console.
Fluxos com dado: auditados linha a linha no código (handlers → seam → Edge/RLS).
Banco: **não** conferido em runtime (sem rede); gravações marcadas BLQ.

**Revisão 2 (item por item da camada):** revisitados os 4 perfis e todas as abas;
cada botão recebeu status e nível de evidência na matriz. Confirmado que:
- nenhum requisito foi marcado "concluído" por aparência;
- os 2 fixes foram testados (não só "documentados como feitos");
- não há regressão entre perfis — as mudanças tocam só `index.html` e testes E2E;
- todo achado tem dono/fase; nenhum P0/P1 ficou órfão.

**Antes/depois:** comportamento de runtime inalterado para os perfis; **console
do login** passou de "404 favicon" para **limpo**; **suíte E2E** passou de
"login por código 100% quebrado" para seletor robusto por rótulo. Build, logs,
tabelas, Edge Functions e mensagens ao usuário: sem alteração.

---

## 6. Critérios de aceite

| Critério | Estado |
|----------|--------|
| Todos os perfis e abas testados | ✅ (mapeados; fluxos com dado = BLQ no sandbox, marcados p/ E2E isolado) |
| Cada botão relevante com status | ✅ (matriz com nível de evidência RT/CA/BLQ) |
| Cada erro de console classificado/reproduzido ou descartado com justificativa | ✅ (`console-errors.md`) |
| Nenhum P0/P1 sem dono/fase | ✅ (matriz com dono; nenhum P0/P1 novo) |
| Termina com matriz objetiva, não opinião | ✅ (4 docs) |

---

## 7. Resultado (resposta final esperada)

**RC1 — Varredura funcional total e matriz de bugs reais — resultado**

- **Status:** **parcial** — varredura estática + build + runtime de login
  **concluídos**; varredura runtime dos fluxos com dado **bloqueada pelo
  ambiente** (sem rede p/ Supabase), marcada para o E2E isolado.
- **Branch:** `claude/rc1-functional-sweep-foc0wb`
- **Arquivos alterados:**
  - `app/index.html` (favicon inline)
  - `app/e2e/_apoio.js` (seletor por rótulo)
  - `app/e2e/auth.spec.js` (seletor por rótulo + import)
  - `docs/auditoria/rc1/*` (4 entregáveis)
- **Migrations:** não
- **RLS alterada:** não
- **Build/testes:** `vite build` **verde**; E2E: `tela de login aparece` ✅ e
  `código inválido` ✅ (render/erro); fluxos com dado não executáveis no sandbox.
- **Smoke manual:** login renderiza, console limpo, erro de credencial mostra
  mensagem amigável; demais fluxos auditados por código.
- **Revisão 1:** feita (runtime possível + auditoria de código).
- **Revisão 2:** feita (item por item; sem regressão entre perfis).
- **Pendências restantes:** OBS-RC1-003/004/005/006/008 → FIX1; validar itens
  **BLQ** da matriz no ambiente E2E isolado (OBS-RC1-007).
- **Riscos novos:** nenhum — mudanças isoladas em `index.html` e testes.
- **Pode abrir PR para main?** **Sim** — build verde, sem migration/RLS, mudanças
  de baixo risco; recomenda-se rodar a suíte E2E no ambiente isolado antes do
  merge para fechar os itens BLQ.

---

## 8. Fora de escopo (respeitado)

Polimento visual amplo, modalidades ENEM/Policiais, refatoração grande e infra de
julho **não** foram tocados.
