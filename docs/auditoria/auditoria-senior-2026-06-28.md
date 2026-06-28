# Auditoria Sênior Independente — Rumo à Aprovação

**Data:** 2026-06-28
**Método:** verificação direta do código, banco e CI (não confiança nos docs).
**Branch:** `claude/system-audit-analysis-lm7r43`

> Este relatório foi feito com o "modo desconfiado": cada afirmação dos docs do
> projeto foi conferida contra o código real. Onde a narrativa e o código batem,
> está marcado ✅ **confirmado**. Onde divergem, está marcado ⚠️. O foco do pedido
> — *coisas criadas e não conectadas, coisas que parecem conectadas mas estão
> vazias, coisas pela metade e coisas por fazer* — está nas seções 2 a 5.

---

## 0. Veredito de uma linha

Fundação técnica **genuinamente forte e honesta** (RLS, CI com 456 testes reais,
segurança de produção) — mas o **coração do produto (gamificação/motor) tem dois
sistemas concorrentes, um deles morto**, e existem **fluxos de UI que prometem
algo e gravam no vazio**. Não é um sistema "pela metade": é um sistema **sólido
por baixo com fios soltos no meio**. O risco não é o alicerce; é a fiação.

Números reais conferidos nesta auditoria:

| Métrica | Alegado nos docs | Medido agora | Veredito |
|---|---|---|---|
| Testes passando | 341 | **456 / 456, 0 falhas** | ✅ subestimado (honesto) |
| Build de produção | verde | **verde (923ms)** | ✅ |
| Migrations | 32 | **36** | ✅ |
| Edge Functions | 6 | **6, todas roteadas pelo seam** | ✅ |
| Segredo no repo | nenhum | **nenhum** (só anon key, publicável) | ✅ |

A casa não está mentindo sobre si mesma — e isso é raro. O problema é o que ela
**não** está contando: ver seções 2 e 3.

---

## 1. As personas (cada uma a mais brava da sua área)

| Persona | Papel | Veredito curto |
|---|---|---|
| 🔒 **A Auditora de Segurança** | RLS, CORS, headers, segredos | Aprovada com ressalvas — base correta, CSP e isolamento demo/real pendentes |
| 🏗️ **O Arquiteto Implacável** | acoplamento, dívida, duplicação | Reprova a **duplicação do motor de XP** e a ausência de tipos |
| 🗄️ **A DBA Paranoica** | schema, migrations, integridade | Acha uma **tabela fantasma** referenciada e nunca criada |
| 🧪 **O Engenheiro de Qualidade** | CI, testes, E2E | Elogia o gate; aponta que **a E2E nunca roda** |
| 💰 **O Investidor Cético** | modelo de negócio, monetização | "Não tenho o que vender ainda": 1 concurso, 1 escola, 0 cobrança |
| 🎓 **A Pedagoga Exigente** | valor para o aluno | "O motor que justifica o produto está **dormente**" |
| 🎨 **A Líder de Front** | UX, bundle, contratos | Bundle de 1,1 MB num arquivo só; sem tipos |

---

## 2. ⛔ CRIADO, MAS NÃO CONECTADO (código/banco vivo, UI nenxerga zero)

Isto é o que você pediu para eu caçar primeiro. São coisas **construídas,
testadas e semeadas no banco** que **nenhuma tela usa**.

### 2.1 — A Fase 15.5 inteira (XP / patentes / conquistas) está órfã ⚠️ **CRÍTICO**

Existe um subsistema completo de gamificação "oficial":

- **Banco:** `aluno_xp_eventos`, `patentes`, `conquistas`, `aluno_conquistas`
  (migration `0013_xp_patentes_conquistas.sql`) + seed `10_gamificacao.sql`.
- **API de dados:** `concederXp`, `desbloquearConquista`, `carregarGamificacaoAluno`,
  `listarPatentes`, `listarConquistas` (`shared/data/index.js:369–411`).
- **Lógica pura:** `modules/conteudo/gamificacao.js` — `xpDeMissao`, `patenteParaXp`,
  `avaliarConquista`, `totalXp`. Tem teste (`tests/gamificacao.test.mjs`).

**Quem consome na UI:** *ninguém.* Busca por `db.concederXp`,
`db.desbloquearConquista`, `db.carregarGamificacaoAluno`, `db.listarPatentes`,
`db.listarConquistas` em `routes/` e `modules/` → **0 resultados**. O módulo
`gamificacao.js` não é importado por nenhum componente.

**Por quê:** ele foi **substituído** pelo motor da Fase C0 (`aluno_eventos_progresso`,
migration `0024_motor_progresso.sql`), que é o que `VisaoEstudo.jsx` realmente lê
(`db.carregarXpPersistido`, `index.js:444`). A patente, na UI, vem de `motor/jargao.js`
— uma **terceira** escada de patentes, hard-coded.

> 🏗️ **O Arquiteto:** "Você tem **dois ledgers de XP** (`aluno_xp_eventos` e
> `aluno_eventos_progresso`) e **duas escadas de patente** (`patentes` no banco e
> `jargao.js` no front). Um conjunto está vivo, o outro está morto-mas-mantido:
> migrations, seed e testes continuam custando manutenção para código que a
> tela nunca chama. Isso é dívida que **se paga toda sprint** sem entregar nada."

### 2.2 — Simulado por concurso / modelo de eliminação está órfão ⚠️

- **Banco:** migration `0014_simulado_concurso.sql` + seed `11_simulado_concurso_dev.sql`.
- **Lógica pura rica:** `modules/conteudo/simuladoConcurso.js` — `validarAcertos`,
  `notaPorDia`, `avaliarRedacao`, `avaliarEliminacao`, `objetivoSugerido`,
  `alertasDeRisco`, `insumoParaNivel`. Testado (`tests/simulado.test.mjs`).
- **UI que usa:** **nenhuma.** A tela de simulado (`modules/motor/`,
  `desempenho/FichaAluno.jsx`) usa o simulado *genérico* (`adicionarSimulado`,
  `listarSimulados`), não o por-concurso com corte/eliminação.

Tradução: o recurso que diferencia "simulado de concurso militar com nota de
corte e linha de eliminação" **está pronto na lógica e no banco, e invisível
para o usuário.**

### 2.3 — Lógica de recorrência (consolidação/promoção) órfã ⚠️

`modules/conteudo/recorrencia.js` (`consolidarRecorrencia`, `prioridadeSugerida`,
`relatorioIncidencia`) não é importada por nenhuma tela. A UI (`TrilhaConcurso.jsx`)
lê o **dado** de recorrência (`db.carregarRecorrencia`), mas não usa o **motor de
decisão** que diz "promova esta prioridade porque a recorrência foi validada".

**Resumo da seção 2:** ~3 módulos de lógica pura + 1 subsistema inteiro de banco
estão construídos, testados e **desligados da tela**. Não é bug — é **valor
estacionado**.

---

## 3. 👻 PARECE CONECTADO, MAS NÃO TEM NADA ATRÁS

### 3.1 — Recuperação de código do aluno grava numa tabela que não existe ⚠️ **ALTO**

- `routes/publico/Login.jsx` oferece "recuperar código de acesso".
- Chama `db.solicitarRecuperacaoCodigo` (`index.js:934`).
- Essa função faz `INSERT` em **`solicitacoes_acesso`**.
- **`solicitacoes_acesso` não existe em nenhuma migration** (conferido:
  `grep solicitacoes_acesso supabase/migrations/` → vazio).

O próprio código admite: *"Tabela pode ainda não existir (D1C). Silenciosa para
o usuário"*. Resultado prático: **o aluno pede recuperação, vê "enviado com
sucesso", e nada acontece** — a coordenação nunca é notificada, o registro vai
para um `console.warn` que ninguém lê em produção.

> 🗄️ **A DBA:** "Isto é o pior tipo de fantasma: a UI **promete** um fluxo, o
> usuário **confia**, e o dado cai num buraco. Ou você cria a tabela (+ RLS + um
> jeito da coordenação ver a fila), ou **tira o botão da tela**. O meio-termo
> atual mente para o aluno."

### 3.2 — Observabilidade está fiada, mas sem destino ⚠️ **MÉDIO**

`shared/lib/observabilidade.js` está **corretamente plugado** (`main.jsx` chama
`instalarCapturaGlobal`, o Error Boundary chama `capturarErro`). Mas o destino é
`VITE_ERROR_REPORT_URL`, que **não é definido em lugar nenhum** (nem em
`app/.env.production`, nem no CI). Em produção, **todo erro só vai para o
`console`** — ninguém vê. É um cano bem instalado ligado a lugar nenhum.

Não é código morto (o gancho é real), mas é uma **falsa sensação de
monitoramento**. Para um sistema com dado de menor, "não sei quando quebra" é um
risco operacional, não só técnico (alinha com o P1-3 dos próprios docs).

---

## 4. 🚧 PELA METADE

| Item | O que está feito | O que falta |
|---|---|---|
| **Motor pedagógico (PED1)** | XP/missões persistidos e **lidos** em `VisaoEstudo.jsx`; onboarding self-service via RPC | O **lado da escrita** de gamificação rica (conquistas, patentes oficiais) está desligado; o aluno vê XP derivado, não o catálogo de conquistas |
| **Conteúdo (PED2)** | Colégio Naval com trilha/missões completas | Demais concursos são **cascas de catálogo** (config existe, trilha não) |
| **E2E** | 6 specs Playwright escritas (`app/e2e/`) | **Nunca executam no CI** — só rodam com secrets `E2E_SUPABASE_*` que não estão setados; hoje a E2E é *pulada* |
| **Papel responsável** | Leitura restrita ao aluno vinculado funciona | Notificação/recuperação de acesso do responsável depende de e-mail real |

> 🎓 **A Pedagoga:** "O que você vende é 'gamificação que vicia o aluno em
> estudar'. Hoje o aluno ganha XP por um gatilho de banco, mas **não desbloqueia
> conquista nenhuma** (o catálogo está mudo) e a patente que ele vê é uma régua
> hard-coded no front, não a régua oficial do banco. O motor que justifica a
> tese **está girando em ponto morto**."

---

## 5. 📋 POR FAZER (declarado, não começado)

Estes os próprios docs já reconhecem — confirmo que **não há código** começado:

- **ROLE1 — professor/tutor:** hoje o tutor entra como `coordenacao`. Não há papel
  próprio, nem RLS para ele. (Lacuna de plataforma.)
- **OPS1 — operação para dado real:** backup/restore testado, alertas de uptime,
  região `sa-east-1`. Tudo ⛔ julho/Pro.
- **ARCH1 — contrato / self-service / cobrança:** **não existe camada de
  billing/assinatura/contrato.** Sem isso, não há monetização self-serve.
- **Hardening declarado:** CSP sem `unsafe-inline` (P3-2), `admin_logs` separada
  (P3-3), rotação de logs (P3-1).

---

## 6. 🔒 Segurança (a Auditora) — aprovada com ressalvas

**O que está certo (confirmado no código):**

- RLS-first; `service_role` **nunca** no front (só nas Edge Functions, via
  `_shared/contexto.ts`). Conferido: nenhum segredo versionado.
- A anon key em `app/.env.production` **é publicável por design** — está correto.
- CORS por allowlist real (`_shared/cors.ts`), reflete origin só se permitido,
  sem `Allow-Credentials` (modelo Bearer). Bom.
- `virar-semana` (única função com `verify_jwt:false`) compara o token de serviço
  em **tempo constante via SHA-256** (`virar-semana/index.ts:23`). Correto e raro
  de ver bem feito.
- Headers fortes no `vercel.json`: HSTS com `preload`, `frame-ancestors 'none'`,
  `object-src 'none'`, `X-Content-Type-Options`.

**Ressalvas (priorizadas):**

1. **CSP com `script-src 'self' 'unsafe-inline'`** — anula boa parte da proteção
   anti-XSS (qualquer script inline injetado executa). Para um app que lida com
   dado de menor, é a ressalva nº 1. Caminho: extrair estilos/scripts inline,
   migrar para nonce/hash. (Os docs reconhecem como P3-2; eu subiria a prioridade.)
2. **Mesmo projeto Supabase para demo e (futuro) real** (`bdjkgrzfzoamchdpobbl`,
   `us-east-1`, Free). Misturar vitrine e dado real é risco de LGPD e de
   poluição. Caminho: projeto dedicado + `sa-east-1` **antes** do primeiro aluno real.
3. **Leaked Password Protection desligada** (limitação do plano Free) — mitigada
   por regra de senha, mas é um buraco até o Pro.
4. **Repositório público** — intencional e documentado, mas lembre que isso torna
   a allowlist de CORS e a topologia toda **visíveis**; a segurança tem que ser
   100% no banco (e, felizmente, é o desenho).

---

## 7. 🏗️ Arquitetura / 🎨 Front — o que o sênior cortaria

- ✅ **Seam de dados único** (`shared/data/index.js`) é uma decisão **excelente**:
  nenhuma tela toca o Supabase direto. Mantenha religiosamente.
- ⚠️ **Zero TypeScript no app** (os 8 `.ts` são só Edge Functions). Para um SaaS
  multi-tenant com LGPD, dados sem tipo são DTOs que se quebram em silêncio. Há
  `shared/contratos/dto.js`, mas é convenção, não contrato verificável. Caminho:
  migrar pelo menos `shared/data` e `shared/contratos` para TS.
- ⚠️ **Bundle de 1,13 MB num único arquivo** (gzip 313 KB), sem code-splitting.
  `recharts` sozinho pesa muito. Caminho: `import()` dinâmico para os painéis de
  gráfico (coordenação) e separar a área admin.
- ⚠️ **Dois motores de XP** (seção 2.1) — decida qual morre e **delete o outro**
  (migrations de depreciação + remover seed/teste). Carregar os dois é mentir
  para quem lê o schema.

---

## 8. 💰 Negócio (o Investidor Cético)

- **Tese:** SaaS B2B white-label para concursos militares no RJ. Tese boa, nicho real.
- **Realidade hoje:** 1 escola candidata real (Ícone), 3 demo; **1 concurso** com
  conteúdo de verdade (Colégio Naval); **0 camada de cobrança**.
- **O furo comercial:** o diferencial (gamificação) é exatamente o que está
  **dormente/duplicado** (seções 2.1 e 4). Você está vendendo o motor que ainda
  não ligou na tomada.
- **Ordem que eu defenderia para faturar:**
  1. **Ligar UM motor de XP** de ponta a ponta (matar o duplicado) → valor visível.
  2. **2º e 3º concursos** com trilha real → deixa de ser produto de uma escola só.
  3. **Camada de contrato/cobrança mínima** (ARCH1) → vira negócio, não projeto.
  - Itens de julho/Pro (backup, `sa-east-1`, SMTP) liberam **aluno real**, mas
    não destravam **venda** — não inverta a ordem.

---

## 9. Caminho recomendado (sequência, do mais barato/urgente ao estruturante)

1. **Tampar o fantasma (3.1):** criar `solicitacoes_acesso` (+RLS +fila visível à
   coordenação) **ou** remover o botão. Não deixar a UI mentir. *(horas)*
2. **Decidir o motor de XP (2.1):** eleger `aluno_eventos_progresso` como verdade,
   **depreciar** `aluno_xp_eventos`/`patentes`/`conquistas` ou **religá-los** na
   tela. Um caminho só. *(dias)*
3. **Conectar conquistas/patentes oficiais à UI do aluno (4 + 2.1)** — fechar a
   tese pedagógica. *(dias)*
4. **Ligar a observabilidade a um destino real (3.2)** — definir `VITE_ERROR_REPORT_URL`. *(horas)*
5. **Fazer a E2E rodar no CI** (secrets de ambiente isolado) — hoje é decorativa. *(horas)*
6. **Subir CSP (6.1)** e **separar projeto demo/real + `sa-east-1` (6.2)** antes do
   primeiro aluno real. *(operação)*
7. **Reduzir bundle + introduzir TS no seam (7)** — saúde de longo prazo. *(semanas)*
8. **2º concurso + camada de cobrança (8)** — destravar venda. *(roadmap)*

---

## 10. O que **não** retrabalhar (está bom — não mexa)

- O seam de dados (`shared/data/index.js`).
- A postura de segredos (nada vazado; anon key publicável correta).
- O gate de CI com guarda anti-"verde vazio" (`ci.yml:86`) — é um detalhe de
  engenheiro maduro; 456 testes rodando de verdade.
- A comparação timing-safe em `virar-semana`.
- O isolamento RLS (provado em `tests/isolamento.test.mjs`).

---

*Fim do relatório. Toda afirmação aqui tem rastro em arquivo:linha ou em comando
reproduzível (ver `tests/` + `bash reset-db.sh && node --test`).*
