# RC1 — Matriz Funcional Total

**Data:** 2026-06-27
**Branch:** `claude/rc1-functional-sweep-foc0wb`
**Fase anterior:** SEG2 (segurança de produção)

---

## Metodologia e honestidade de cobertura

A varredura foi executada em **ambiente remoto efêmero** (Claude Code on the web).
Isso impõe um limite real que é registrado aqui sem maquiar:

| Recurso | Estado no ambiente |
|---------|--------------------|
| Build de produção (`vite build`) | ✅ Executável e **verde** |
| Render do app + console (Playwright/Chromium pinado) | ✅ Executável (tela de login e caminhos de erro) |
| Login/dados reais contra Supabase demo | ❌ **Bloqueado** — sem saída de rede para `bdjkgrzfzoamchdpobbl.supabase.co` (`net::ERR_TUNNEL_CONNECTION_FAILED`) |
| Suíte E2E completa (fluxos com dado) | ❌ **Bloqueada** pelo item acima + mismatch de build do Chromium (env 1194 × `@playwright/test@1.61.1` espera 1228) |

Por isso cada item abaixo recebe um **nível de evidência**:

- **RT** = verificado em *runtime* (render/console/erro reproduzidos neste ambiente)
- **CA** = auditoria de *código* (lido o componente, o handler e a chamada ao seam de dados; comportamento inferido do código)
- **BLQ** = exigiria runtime com Supabase — **não executável aqui**, marcado para validação no ambiente E2E isolado (já previsto no `ci.yml` via `E2E_SUPABASE_*`)

> Nenhum item foi marcado “OK” por aparência. “CA” significa que o caminho do
> código foi lido inteiro; **não** significa que rodou contra o banco.

Legenda de status: ✅ funciona · ⚠️ funciona com ressalva · 🐞 bug · ⛔ bloqueado p/ teste · 📝 só documentado

---

## 0. Autenticação (compartilhada)

| Fluxo | Botão / ação | Evidência | Status | Observação |
|-------|--------------|-----------|--------|------------|
| Tela de login renderiza | seletor de modo Aluno/Resp · Coordenação | RT | ✅ | Console **limpo** após correção do favicon (BUG-RC1-002) |
| Botão "Entrar" desabilitado sem credencial | — | RT | ✅ | `pronto` exige código ≥12 chars ou e-mail+senha |
| Login por **código** (aluno/resp) | "Entrar" | BLQ | ⛔ | Caminho de código corrigido na E2E (BUG-RC1-001); execução real depende de Supabase |
| Código inválido → mensagem clara | "Entrar" | RT | ✅ | Mostra "Código não reconhecido. Confira com a escola." (reproduzido offline) |
| Login por **senha** (coordenação) | "Entrar" | BLQ | ⛔ | `entrarComEmail` → `signInWithPassword` |
| Credencial errada → mensagem clara | "Entrar" | CA | ⚠️ | UI mostra "E-mail ou senha incorretos."; **console** recebe linha técnica (OBS-RC1-003) |
| "Esqueci minha senha" (coordenação) | link | CA | ✅ | `recuperarSenha` → reset por e-mail; tela de confirmação genérica (não vaza existência) |
| "Esqueci meu código" (aluno/resp) | link | CA | ✅ | `solicitarRecuperacaoCodigo` grava `solicitacoes_acesso`; degrada se tabela ausente |
| Logout | "Sair" | BLQ | ⛔ | `db.sair()` em todas as áreas; render do botão confirmado |
| Sessão expirada / sem perfil | "Sair e tentar de novo" | CA | ✅ | `App.jsx` trata `!perfil`/`erro`; `useSessao` recarrega em `onAuthStateChange` |
| Recuperação de senha (rota `#recovery`) | "Redefinir" | CA | ✅ | `detectarRecuperacao()` intercepta hash antes do roteamento por papel |
| Escola suspensa/cancelada | "Sair" | CA | ✅ | Gate `escolaOperacional` mostra tela "Acesso suspenso/encerrado" (bloqueio real é RLS) |

---

## 1. Aluno — `VisaoEstudo` (8 abas)

Origem das abas: `VisaoEstudo.jsx` (`ABAS`). Render condicionado a `trilha` carregada.

| Aba | Conteúdo / botões | Evidência | Status | Observação |
|-----|-------------------|-----------|--------|------------|
| **Hoje** | Faixa de patente, Missão atual, Meta da semana, "Registrar estudo de hoje", Conquistas recentes | CA | ✅ | Badge de pendentes na aba; cronômetro joga minutos p/ "Registrar" |
| **Trilha** (concurso) | `TrilhaConcurso` por `exam_tag` | CA | ⚠️ | Sem `concurso.codigo` mostra estado vazio; depende de aluno ter concurso |
| **Registrar** | form (tópico, questões, acertos, tempo, obs) → salvar | BLQ | ⛔ | `adicionarRegistro`; só aparece com `podeEditar` |
| **Desempenho** | Insights, Níveis por matéria, Radar, Acumulado, Progresso | CA | ✅ | Métricas derivam de `calcularMetricas` (puro) |
| **Simulados** | lista + adicionar/remover simulado | BLQ | ⛔ | `adicionarSimulado`/`removerSimulado` |
| **Conquistas** | grade de conquistas/XP | CA | ✅ | Deriva de XP persistido ou estimativa legada |
| **Histórico** | `Arquivo` (metas/registros) | CA | ✅ | Leitura |
| **Plano** | jornada (linha do tempo de semanas) | CA | ✅ | Estado da semana corrente vem da meta |
| Sem trilha configurada | — | CA | ✅ | Estado vazio explicativo ("Trilha ainda não configurada") |
| Conta sem aluno | — | CA | ✅ | "Sua conta não está ligada a um aluno. Fale com a coordenação." |

**Ressalva de UX (P3):** o menu de abas usa `aoTrocar={setTab}` (não rola ao topo),
enquanto os botões internos usam `irAba` (rola ao topo). Inconsistência menor.

---

## 2. Responsável — `AreaResponsavel` / `ResumoResponsavel`

| Item | Evidência | Status | Observação |
|------|-----------|--------|------------|
| Seleção de aluno (vários filhos) | CA | 🐞 | **OBS-RC1-004**: `alunoVinculado()` usa `.limit(1)` — responsável com 2+ alunos só vê um, **sem seletor**. A tarefa pede "seleção de aluno". |
| Progresso / resumo da semana | CA | ✅ | StatCards (meta, questões, tempo, acerto, dias) |
| Desempenho por matéria | CA | ✅ | Leitura, sem controles |
| Alertas / pontos de atenção | CA | ✅ | Poucos dias, queda de acerto, matérias fracas |
| Último simulado | CA | ✅ | Nota projetada |
| Aluno **revogado** | CA | ✅ | `alunoVinculado()` → null → "Nenhum aluno vinculado a este acesso." |
| Aluno **revinculado** | BLQ | ⛔ | Volta a aparecer após novo vínculo (requer reload) |
| Registro de acesso (LGPD) | CA | ✅ | `registrarAcesso(..., "leitura-desempenho")` best-effort |

---

## 3. Coordenação — `AreaEscola` (6 abas)

| Aba | Botões / ações | Evidência | Status | Observação |
|-----|----------------|-----------|--------|------------|
| **Painel** | atalhos p/ abas filtradas | CA | ✅ | `PainelGestao`, agregado vem da RPC `resumo_escola` |
| **Alunos** | cadastrar (1/lote), Ver desempenho, Gerar credencial, Renomear, +Responsável, Gerenciar responsáveis, Consentimento, Exportar/Excluir LGPD, trocar turma/concurso/trilha, busca, filtros, paginação | BLQ | ⛔ | Handlers lidos em `ListaAlunos`/`CadastroAlunos`; gravações exigem Supabase |
| **Ranking** | classificação por turma | CA | ✅ | `ClassificacaoTurma` |
| **Turmas** | Nova turma, ver alunos, Ver classificação, Renomear (prompt), Excluir (confirm + guarda de alunos) | CA | ✅ | Excluir bloqueado se turma tem alunos |
| **LGPD** | consentimentos + logs de acesso | CA | ✅ | `PainelConformidade` (leitura) |
| **Marca** | nome, logo URL, cor de acento → salvar | BLQ | ⛔ | `atualizarMarca`; registra log de coordenação |
| Provisionar aluno | "Gerar credencial" | BLQ | ⛔ | Edge `provisionar-aluno` (tipo aluno) — modal `CredencialGerada` |
| Provisionar responsável | "+ Adicionar responsável" (prompt nome) | BLQ | ⛔ | Edge `provisionar-aluno` (tipo responsavel) |
| Revogar responsável | "Revogar acesso" (confirma) | BLQ | ⛔ | Edge `revogar-responsavel` |
| Revincular responsável | "Vincular responsável existente" | BLQ | ⛔ | Edge `provisionar-aluno` (vincular-responsavel); trata `vinculo_ja_existente` |
| Exportar LGPD | menu "Exportar dados (LGPD)" | BLQ | ⛔ | Edge `lgpd-titular` (exportar) → download JSON |
| Excluir LGPD | menu "Excluir dados (LGPD)" (confirm) | BLQ | ⛔ | Edge `lgpd-titular` (excluir) — irreversível, confirmado |
| Status da escola (suspensa) | — | CA | ✅ | Coordenação suspensa cai na tela "Acesso suspenso" |

---

## 4. Superadmin — `AreaAdmin` (backoffice)

| Item | Botões / ações | Evidência | Status | Observação |
|------|----------------|-----------|--------|------------|
| Gate de acesso | — | CA | ✅ | `souSuperAdmin()` (RPC com porteiro no banco); pula RPC p/ login por código |
| Dashboard | StatCards agregados | BLQ | ⛔ | `backoffice_dashboard` |
| Lista de escolas | busca, filtro status/plano, ordenação | CA | ✅ | Filtro/sort são puros no cliente |
| Criar escola | "+ Nova escola" (blocos A/B/C) → "Criar escola" | BLQ | ⛔ | `backoffice_criar_escola` + opcional provisionar coordenador |
| Editar escola | "✎ Editar" → "Salvar alterações" | BLQ | ⛔ | `backoffice_editar_escola` (só campos alterados) |
| Ações de status | Reativar/Ativar/Suspender/Cancelar (modal confirma) | BLQ | ⛔ | `backoffice_definir_status` — reversível, registra auditoria |
| Checklist de implantação | — | CA | ✅ | Derivado de dados reais da escola |
| Criar coordenador | "+ Criar coordenador" → "Criar acesso" | BLQ | ⛔ | Edge `backoffice-coordenador` (criar) |
| Reenviar acesso | "↻ Reenviar acesso" | BLQ | ⛔ | Edge `backoffice-coordenador` (reenviar) + log via RPC |
| Atividade administrativa | — | BLQ | ⛔ | `admin_logs` (leitura) |
| Escola vazia / demo / real | — | CA | ✅ | EmptyStates cobrem escola sem coordenador/turma/aluno |
| Logout | "Sair" | CA | ✅ | `db.sair()` |

---

## Resumo da matriz

- **Perfis cobertos:** aluno, responsável, coordenação, superadmin — 100% das abas mapeadas.
- **Botões relevantes:** cada um tem status e nível de evidência.
- **Não executável aqui (BLQ):** todo fluxo que **grava/lê dado real** (depende do Supabase demo, sem rota de rede no sandbox). Marcado para o **ambiente E2E isolado**.
- **Bugs encontrados:** 2 corrigidos nesta fase (P2/P3, isolados) + achados documentados para FIX1. Detalhe em `bugs-e-regressoes.md`.
- **Console:** ver `console-errors.md`.
