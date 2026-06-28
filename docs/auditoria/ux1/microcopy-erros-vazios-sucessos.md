# Microcopy — erros, vazios, sucessos e retry (UX1)

**Data:** 2026-06-28 · **Branch:** `claude/ux1-interface-accessibility-yc7rbw`

Padroniza o que o usuário **lê** em erro, estado vazio, sucesso e retry —
para aluno, responsável, coordenação e superadmin. Princípio:
**o detalhe técnico nunca vai para a tela**; fica no console
(`shared/lib/observabilidade.js`) e, se configurado, no monitoramento.

---

## 1. Erros — fonte única

`shared/lib/erros.js → mensagemAmigavel(erro, contexto)`:

1. Loga o técnico no console (`console.error`).
2. Se for rede (`failed to fetch|network|timeout|conexão|offline`):
   **"Sua conexão parece instável. Verifique e tente de novo."**
3. Se for mensagem **segura** de Edge Function (e-mail inválido, sem
   permissão, escola não encontrada, campos obrigatórios): repassa uma
   versão humana específica.
4. Senão, mensagem genérica por contexto:

| Contexto | Mensagem ao usuário |
|---|---|
| `carregar` | Não conseguimos carregar esses dados. Atualize a página ou tente novamente. |
| `salvar` | Não foi possível salvar agora. Tente novamente em alguns instantes. |
| `acao` | Não foi possível concluir a ação. Tente novamente. |
| `provisionar` | Não foi possível criar o acesso do coordenador. Tente novamente. |
| `reenviar` | Não foi possível reenviar o acesso. Tente novamente. |

**Regra:** nenhum componente exibe `e.message` cru. A última brecha
(`HistoricoProgresso`) foi fechada nesta camada. O componente `Erro`
agora tem `role="alert"` para anúncio imediato a leitor de tela.

### Retry
A própria mensagem orienta o retry ("Atualize a página", "Tente
novamente"). Botões de carga (Login, salvar) mostram estado ocupado
("Entrando…", "Salvando…", "Cadastrando…") e travam duplo envio
(`useEnvioUnico`/`criarTrava`).

---

## 2. Estados vazios — `EmptyState` (ícone + título + dica de próximo passo)

| Tela | Título | Dica |
|---|---|---|
| Registros recentes (aluno) | Nada registrado ainda | Seu primeiro registro aparece aqui e alimenta o radar de desempenho. |
| Trilha sem concurso | Sem concurso-alvo definido | A coordenação precisa vincular o aluno a um concurso para a trilha aparecer. |
| Trilha em configuração | Trilha deste concurso em configuração | Os horizontes deste edital aparecem aqui assim que a escola publicar o conteúdo. |
| Histórico de progresso | Nenhum evento ainda | Os eventos aparecem quando o aluno registra estudo, conclui objetivos ou lança simulados. |
| Lista de escolas (backoffice) | Nenhuma escola encontrada | Ajuste a busca/filtros ou crie a primeira no formulário acima. |
| Logs (backoffice) | Nenhum log para o filtro | Ajuste a busca/filtros — ou as ações aparecem aqui assim que ocorrerem. |
| Coordenadores | Nenhum coordenador ainda | Clique em "+ Criar coordenador" para provisionar o acesso pelo backoffice. |
| Responsável sem vínculo | (Empty) Nenhum aluno vinculado a este acesso. Fale com a escola. | — |

**Tom por perfil:** aluno/responsável → encorajador e concreto;
coordenação/superadmin → operacional ("ajuste filtros", "crie a primeira").

---

## 3. Sucesso

| Ação | Feedback | Como |
|---|---|---|
| Registrar estudo (aluno) | **"Registro salvo! Já entrou no seu desempenho."** | `Toast` (novo nesta camada) |
| Ganhar XP/missão/conquista | "+N XP · missão concluída" | `FeedbackProgresso` (existente) |
| Salvar marca (coordenação) | "✓ Marca salva no banco e aplicada em todo o sistema." | inline verde |
| Criar escola (superadmin) | "Escola \"X\" criada com sucesso. …" | inline verde |
| Redefinir senha | "Senha definida! … Redirecionando para o login…" | tela de sucesso |
| Recuperação de senha/código | "Se este e-mail estiver cadastrado, enviaremos instruções…" | tela neutra (não revela existência da conta — decisão de segurança preservada) |

Todos os toasts/sucessos usam `role="status" aria-live="polite"` e somem
sozinhos (toast ~2,6s).

---

## 4. Loading

Trocado "Carregando…" textual por **skeleton com varredura**
(`CarregandoBloco`/`Skeleton`), que comunica progresso sem parecer
travamento, com `role="status"` + `.sr-only` para leitor de tela:

| Tela | Texto anunciado |
|---|---|
| Bootstrap (App) | Preparando seu painel… |
| Painel do aluno | Carregando seu painel de estudos… |
| Responsável | Carregando os dados do aluno… |
| Coordenação | Carregando dados da escola… |
| Backoffice (lista/detalhe) | Carregando escolas… / Carregando escola… |
| Trilha | Carregando a trilha do concurso… |
| Histórico | Carregando o histórico… |
| Ficha do aluno | Carregando a ficha do aluno… |

---

## 5. Feedback de ação lenta

Login da coordenação (~6s no Supabase Auth): botão vira "Entrando…" e,
após 2,5s, surge **"Verificando suas credenciais com segurança… só um
instante."** (`role="status"`). É feedback honesto — **não** altera a
latência real do Auth (isso seria fora do escopo de acabamento).

---

## 6. Mensagens de erro específicas de login (mantidas)

| Situação | Mensagem |
|---|---|
| Código não reconhecido | Código não reconhecido. Confira com a escola. |
| E-mail/senha incorretos | E-mail ou senha incorretos. |
| Link de recuperação expirado | Este link expirou ou já foi usado. Solicite um novo link de recuperação na tela de login. |

Genéricas o suficiente para não vazar se a conta existe (segurança).
