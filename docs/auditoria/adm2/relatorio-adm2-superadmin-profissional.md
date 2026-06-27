# Relatório ADM2 — SuperADM profissional e controle do operador

**Camada:** ADM2 · **Data:** 2026-06-27
**Branch:** `claude/adm2-superadmin-profissional-nqoknq`
**Natureza:** front (React) + lógica pura testável + testes + documentação.
**NÃO** altera migrations, RLS, Auth, Edge Functions, secrets, seeds nem o
banco de produção. Tudo o que a camada acrescenta **deriva** do que as RPCs
`SECURITY DEFINER` (porteiro `eh_super_admin`) já devolvem — a segurança
continua inteiramente no banco.

---

## 1. Objetivo

Evoluir o SuperADM/backoffice de "backoffice funcional" para **centro de
operação profissional**: separação demo/teste/real/individual, checklist
de **go-live** por escola, **avisos de risco**, saúde da operação no
dashboard, **logs administrativos com filtros** e **modalidades** como
placeholder controlado — sem abrir o banco para fluxos comuns.

## 2. Contexto auditado (tarefa 35 — auditoria das telas atuais)

Tela única: `app/src/routes/admin/AreaAdmin.jsx`, montada por `App.jsx`
**apenas** quando `souSuperAdmin()` (gate no banco). Antes da ADM2:

| Bloco | O que fazia | Lacuna ADM2 |
|---|---|---|
| `Dashboard` | contadores (escolas por status, alunos, ativos 7d, coordenadores, sem coordenador) | sem visão de categoria nem de risco agregado |
| `ListaEscolas` | busca + filtro status/plano + ordenação | sem categoria (demo/real…) nem sinal de risco por linha |
| `NovaEscola` | criar escola (blocos A/B/C) + coordenador | ok — mantido |
| `DetalheEscola` | status, edição, ações, **checklist de implantação**, coordenadores | checklist só "implantação" (sem SMTP/LGPD/backup/smoke); sem avisos de risco; sem modalidades |
| `AtividadeAdmin` | lista crua dos últimos logs | sem filtros (escola/ação/período) |

RPCs/contrato existentes (migrations 0019/0021/0025/0032): `backoffice_escolas`,
`backoffice_dashboard`, `backoffice_detalhe_escola`, `backoffice_criar_escola`,
`backoffice_editar_escola`, `backoffice_definir_status`,
`backoffice_registrar_reenvio`. Todas com porteiro `app.eh_super_admin()` e
log em `admin_logs`. **Nada precisou de migration nova** — a ADM2 só consome.

## 3. O que mudou, por quê, risco, teste, rollback

| # | Mudança | Por quê (tarefa) | Risco | Rollback |
|---|---|---|---|---|
| 1 | **Módulo puro** `app/src/modules/backoffice/operacao.js` | base testável de toda a camada | nenhum (puro, sem rede) | remover arquivo |
| 2 | Dashboard: card **"Saúde da operação"** (categorias + risco agregado) | t.36 | baixo (deriva da lista) | reverter bloco no `Dashboard` |
| 3 | Lista: **selo de categoria** + **ponto de risco** por linha + filtro **Categoria** | t.38, t.36 | baixo | reverter `ListaEscolas` |
| 4 | Detalhe: **Avisos de risco** (risco/alerta/info) | t.41 | baixo | remover `<AvisosRisco>` |
| 5 | Detalhe: **Checklist de go-live** (substitui implantação; agrupa Cadastro/Acesso/Alunos/Conformidade/Go-live; SMTP, LGPD, termo, backup, smoke) | t.37 | baixo | restaurar `ChecklistImplantacao` |
| 6 | Detalhe: **Modalidades** (placeholder declarado; só `concurso` ativo) | t.39 | baixo | remover `<Modalidades>` |
| 7 | **Logs administrativos** com filtros (busca, ação, escola, período); limite 25→200; `super_admin_id` no SELECT | t.40 | baixo | reverter `AtividadeAdmin` + `backofficeLogs` |
| 8 | Testes `tests/adm2-operacao.test.mjs` (puro) e `tests/adm2-superadmin-db.test.mjs` (DB/RLS) | t.42 + aceite | nenhum | remover arquivos |

**Por que sem migration:** a regra dura da camada manda não usar
`db push` cego e justificar qualquer migration. Toda a inteligência da
ADM2 (categoria, risco, checklist) é **interpretação** de dado já
devolvido pelas RPCs — então não há razão para tocar o schema. Modalidades
e a confirmação persistida de itens manuais ficariam atrás de migration;
foram entregues como **placeholder/manual declarado** (escopo permite).

## 4. Garantias de segurança (tarefa 42 + aceite)

- O módulo `operacao.js` é **puro** e **não decide acesso**. Classificar
  uma escola como "real" não libera nada; é rótulo para o olho do operador.
- Toda ação sensível continua atrás de RPC `SECURITY DEFINER` com
  `app.eh_super_admin()` e gravando `admin_logs`. A ADM2 **não criou**
  caminho novo de escrita — usa os já existentes.
- Provado por teste contra o Postgres real (`adm2-superadmin-db.test.mjs`):
  coordenação e anon são **recusadas** em `dashboard/escolas/detalhe/criar/
  editar/definir_status`; toda ação grava log; ninguém forja log de outro
  operador (RLS `super_admin_id = app.usuario_id()`).

## 5. Testes (obrigatórios da camada)

Ambiente: Postgres 16 local, `reset-db.sh` (migrations + seed 2×), `node --test`.

**Suíte completa: 396 testes, 396 passam, 0 falham, 0 pulados.** (baseline
antes da ADM2: 363 → +33 dos dois arquivos novos.)

| Teste obrigatório | Onde | Resultado |
|---|---|---|
| Criar/editar/suspender/reativar escola | `adm2-superadmin-db` "trilha de auditoria completa" (ciclo implantacao→ativa→suspensa→ativa) | ✅ |
| Criar coordenador e verificar logs | coberto por `d1b-provisionamento` + log `reenviar/vincular` | ✅ (pré-existente) |
| Escola vazia / demo / ativa / suspensa | `adm2-superadmin-db` cenários VAZIA/DEMO/ATIVA/SUSPENSA (contrato detalhe↔operacao.js) | ✅ |
| Bloqueio de não-superadmin | `adm2-superadmin-db` "coordenação recusada" + "anon recusado" | ✅ |
| Conferir banco/logs após ação sensível | `adm2-superadmin-db` (antes/depois, de/para, sem forja) | ✅ |
| Lógica de categoria/risco/checklist/filtros | `adm2-operacao` (24 casos puros) | ✅ |
| Responsividade desktop/tablet | grids `repeat(auto-fit,minmax(…))` em dashboard, lista, detalhe e filtros (sem largura fixa) — ver §6 | ✅ (revisão de código) |
| Build de produção | `npm run build` | ✅ verde |

Comandos:

```bash
# Postgres local na porta 54322 (migrations + seed 2x)
cd tests && bash reset-db.sh
# suíte inteira
npm test
# só ADM2
node --test adm2-operacao.test.mjs adm2-superadmin-db.test.mjs
```

## 6. Revisão dupla (obrigatória)

**1ª passada — funcional, como operador.** Build de produção verde; a tela
monta só para super_admin (gate `App.jsx`). Percorridos os fluxos: dashboard
→ saúde da operação; lista com selo de categoria e ponto de risco; detalhe
com avisos, checklist de go-live agrupado, modalidades; logs com filtros.
Os componentes derivam de `d`/`lista`/`logs` já carregados — sem nova
chamada de rede e sem segredo no front.

**2ª passada — item a item da camada:**

| Tarefa | Estado | Evidência |
|---|---|---|
| 35 Auditar telas atuais | 🟢 concluído | §2 deste relatório |
| 36 Dashboard operacional (status, alunos, plano, limites, risco, pendências) | 🟢 concluído | `Dashboard` + `MiniSaude` + `resumoRisco` |
| 37 Checklist de go-live (marca, coord, alunos, resp., SMTP/fallback, LGPD, termo, backup, smoke) | 🟢 concluído | `ChecklistGoLive` + `checklistGoLive()` + `docs/operacao/checklist-go-live-escola.md` |
| 38 Separar demo/teste/real/individual(B2C) | 🟢 concluído | `categoriaEscola` + `SeloCategoria` + filtro Categoria |
| 39 Campos/plano para modalidades sem MOD0 | 🟡 placeholder controlado | `Modalidades` + `modalidadesDaEscola` (persistência diferida, declarada) |
| 40 Logs administrativos com filtros (escola/ação/usuário/período) | 🟢 concluído | `AtividadeAdmin` + `filtrarLogs` (usuário via `super_admin_id` no SELECT) |
| 41 Avisos de risco | 🟢 concluído | `AvisosRisco` + `avisosRisco()` |
| 42 Ações sensíveis exigem superadmin real e logam | 🟢 concluído (já era do banco; provado) | `adm2-superadmin-db.test.mjs` |

**Regressão nos 4 perfis:** a ADM2 toca **só** a área super_admin
(`AreaAdmin.jsx`) e dois pontos compartilhados de leitura: `backofficeLogs`
(adicionou `super_admin_id` ao SELECT — aditivo, sem efeito em aluno/
responsável/coordenação) e o novo módulo puro (importado só pelo admin).
Aluno, responsável e coordenação **não** mudam. Suíte de RLS/isolamento/
suspensão (`isolamento`, `suspensao-db`, `coordenacao-acesso-db`) segue verde.

**Antes/depois:** comportamento ampliado (categoria, risco, checklist
go-live, filtros de log); logs/tabelas/Edge Functions **inalterados**; UI
acrescida; mensagens novas honestas (nunca "pronto"/"real" por omissão);
performance equivalente (tudo client-side sobre dado já carregado; limite
de logs subiu para 200, uma leitura).

## 7. Itens manuais e diferidos (transparência)

- **Confirmação persistida** de backup/smoke/SMTP/termo: o checklist os
  mostra como **manuais** (não fecham sozinhos) e aponta os docs. Persistir
  a marcação exigiria migration — fora do mínimo desta camada.
- **Modalidades por escola:** placeholder declarado, sem persistência.
  MOD0 completo é **fora de escopo** (regra 7 / aceite).
- **Smoke real dos 4 perfis em produção** e **verificação de SMTP/backup**
  dependem de ambiente (Supabase real/SMTP/projeto Pro) — registrados como
  passos de operador no checklist, não automatizáveis no front.

## 8. Fora de escopo (respeitado)

Modalidades completas (MOD0), financeiro/faturamento real, SLA/contratos
jurídicos. Nenhum deles foi iniciado.

## 9. Critérios de aceite

| Critério | Situação |
|---|---|
| Operar escola sem mexer direto no banco para fluxos comuns | ✅ criar/editar/status/coordenador/checklist/risco/logs pela tela |
| Ações sensíveis protegidas e logadas | ✅ porteiro `eh_super_admin` + `admin_logs` (provado em teste) |
| Não-superadmin não acessa rotas/poderes de superadmin | ✅ gate `App.jsx` + recusa nas RPCs (provado: coordenação/anon) |
| Checklist de go-live existe e é utilizável | ✅ tela `ChecklistGoLive` + doc operacional |
| Build/testes/smoke passam | ✅ build verde · 396/396 testes · smoke documentado |

**Veredito:** camada **concluída**. Únicos itens não-100%-automáticos
(modalidades persistidas e confirmação de itens manuais) estão
**declarados** como placeholder/manual e fora do mínimo da camada — sem
pendência funcional que prometa algo não entregue.
