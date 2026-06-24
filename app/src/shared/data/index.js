/* ============================================================
   O SEAM DE DADOS (herdeiro do objeto `db` da versão atual).
   ------------------------------------------------------------
   ÚNICO ponto do front que fala com o Supabase. Nenhuma tela
   importa o cliente direto. Toda função devolve dado ou LANÇA
   erro com mensagem — nada de engolir exceção.
   A segurança não está aqui: está na RLS. Este arquivo só pede;
   o banco decide o que entrega.
   ============================================================ */
import { supabase } from "../../lib/supabase.js";

function falha(contexto, error) {
  const e = new Error(`${contexto}: ${error.message}`);
  e.causa = error;
  console.error(e);
  return e;
}

/* ---------- identidade ---------- */

// O aluno/responsável digita só o CÓDIGO (XXXX-XXXX-XXXX). A
// coordenação usa e-mail e senha. O código é normalizado e vira a
// credencial completa — quem provisionou foi a escola.
export function normalizarCodigo(texto) {
  return texto.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export async function entrarComCodigo(codigo) {
  const canonico = normalizarCodigo(codigo);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: `${canonico.toLowerCase()}@codigo.acesso.local`,
    password: canonico,
  });
  if (error) throw falha("login por código", error);
  return data;
}

export async function entrarComEmail(email, senha) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw falha("login", error);
  return data;
}

export async function sair() {
  const { error } = await supabase.auth.signOut();
  if (error) throw falha("logout", error);
}

export function aoMudarSessao(fn) {
  const { data } = supabase.auth.onAuthStateChange((_evento, sessao) => fn(sessao));
  return () => data.subscription.unsubscribe();
}

export async function sessaoAtual() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw falha("sessão", error);
  return data.session;
}

export async function meuPerfil() {
  // O usuário logado é o `sub` do JWT (= usuarios.id). Filtrar por ele:
  // a coordenação enxerga TODOS os usuários da escola pela RLS, então um
  // `limit(1)` sem filtro devolveria um colega qualquer — não ela mesma.
  const { data: s } = await supabase.auth.getSession();
  const uid = s?.session?.user?.id;
  if (!uid) throw new Error("perfil: sessão sem usuário autenticado");
  const { data: u, error } = await supabase
    .from("usuarios").select("id, escola_id, papel, nome").eq("id", uid).maybeSingle();
  if (error) throw falha("perfil", error);
  if (!u) throw new Error("perfil: usuário sem cadastro nesta escola");
  const { data: e, error: e2 } = await supabase
    .from("escolas").select("id, nome, slug, logo_url, cor_acento").eq("id", u.escola_id).single();
  if (e2) throw falha("escola", e2);
  return { usuario: u, escola: e };
}

/* ---------- conteúdo (trilha — global, só leitura) ---------- */

export async function carregarTrilha(trilhaId) {
  const [t, d, s, a] = await Promise.all([
    supabase.from("trilhas").select("*").eq("id", trilhaId).single(),
    supabase.from("disciplinas").select("*").eq("trilha_id", trilhaId).order("ordem"),
    supabase.from("trilha_semanas").select("*").eq("trilha_id", trilhaId).order("numero"),
    supabase.from("atividades_modelo").select("*").eq("trilha_id", trilhaId).order("semana_numero").order("ordem"),
  ]);
  for (const r of [t, d, s, a]) if (r.error) throw falha("trilha", r.error);
  return { trilha: t.data, disciplinas: d.data, semanas: s.data, atividades: a.data };
}

export async function trilhaPadrao() {
  const { data, error } = await supabase
    .from("trilhas").select("id, nome").order("versao", { ascending: false }).limit(1);
  if (error) throw falha("trilha padrão", error);
  return data[0] ?? null;
}

// Config de um concurso (elimination_model, redacao_role, etc.).
export async function carregarConcursoPorTag(examTag) {
  const { data, error } = await supabase.from("concursos").select("*").eq("codigo", examTag).maybeSingle();
  if (error) throw falha("concurso", error);
  return data ?? null;
}

export async function listarConcursos() {
  const { data, error } = await supabase.from("concursos").select("*").order("ordem");
  if (error) throw falha("concursos", error);
  return data;
}

/* ---------- fundação pedagógica (Fase 15.1 — global, só leitura) ---------- */

// Catálogo de turmas comerciais com os concursos que cada uma cobre.
export async function listarTurmasComerciais() {
  const [tc, tcc] = await Promise.all([
    supabase.from("turmas_comerciais").select("*").order("ordem"),
    supabase.from("turmas_comerciais_concursos").select("*").order("ordem"),
  ]);
  for (const r of [tc, tcc]) if (r.error) throw falha("turmas comerciais", r.error);
  const concursosPorTurma = {};
  for (const lig of tcc.data) (concursosPorTurma[lig.turma_comercial_codigo] ??= []).push(lig);
  return tc.data.map((t) => ({ ...t, concursos: concursosPorTurma[t.codigo] ?? [] }));
}

// Config OFICIAL de um concurso (referência do edital). Global.
export async function configOficial(examTag) {
  const { data, error } = await supabase.from("config_oficial").select("*").eq("exam_tag", examTag);
  if (error) throw falha("config oficial", error);
  return data;
}

// Config da ESCOLA para um concurso (override, isolado por RLS na
// escola do usuário logado). Não passa escola_id: a RLS já restringe.
export async function configEscola(examTag) {
  const { data, error } = await supabase.from("config_escola").select("*").eq("exam_tag", examTag);
  if (error) throw falha("config escola", error);
  return data;
}

// Estrutura cadastrada de um concurso (Fase 15.2): prova, dias,
// matérias, assuntos e subassuntos. Conteúdo global, só leitura.
export async function carregarEstruturaProva(examTag) {
  const [prova, dias, materias, assuntos] = await Promise.all([
    supabase.from("provas").select("*").eq("exam_tag", examTag).maybeSingle(),
    supabase.from("prova_dias").select("*").eq("exam_tag", examTag).order("ordem"),
    supabase.from("prova_materias").select("*").eq("exam_tag", examTag).order("ordem"),
    supabase.from("assuntos").select("*").eq("exam_tag", examTag).order("ordem"),
  ]);
  for (const r of [prova, dias, materias, assuntos]) if (r.error) throw falha("estrutura da prova", r.error);
  const ids = (assuntos.data ?? []).map((a) => a.id);
  let subassuntos = [];
  if (ids.length) {
    const s = await supabase.from("subassuntos").select("*").in("assunto_id", ids).order("ordem");
    if (s.error) throw falha("subassuntos", s.error);
    subassuntos = s.data;
  }
  return { prova: prova.data ?? null, dias: dias.data, materias: materias.data, assuntos: assuntos.data, subassuntos };
}

/* ---------- recorrência e tagueamento (Fase 15.7 — global, leitura) ---------- */

// Provas anteriores tagueadas de um concurso.
export async function carregarProvasAnteriores(examTag) {
  const { data, error } = await supabase.from("provas_anteriores").select("*").eq("exam_tag", examTag).order("ano", { ascending: false });
  if (error) throw falha("provas anteriores", error);
  return data;
}

// Recorrência por assunto (todos os graus: estimada/validada/medida).
export async function carregarRecorrencia(examTag) {
  const { data, error } = await supabase.from("recorrencia_assunto").select("*").eq("exam_tag", examTag);
  if (error) throw falha("recorrência", error);
  return data;
}

// Recorrência MEDIDA ao vivo (view) — contagem do tagueamento real.
export async function carregarRecorrenciaMedida(examTag) {
  const { data, error } = await supabase.from("vw_recorrencia_medida").select("*").eq("exam_tag", examTag);
  if (error) throw falha("recorrência medida", error);
  return data;
}

/* ---------- níveis e onboarding (Fase 15.3) ---------- */

// Níveis do aluno (geral + por matéria). A RLS decide o que sai:
// coordenação vê os da escola; aluno vê o próprio; responsável o do vinculado.
export async function carregarNivelAluno(alunoId) {
  const { data, error } = await supabase.from("aluno_niveis").select("*").eq("aluno_id", alunoId).order("escopo");
  if (error) throw falha("níveis do aluno", error);
  return data;
}

// Define/ajusta o nível de um escopo ('geral' ou matéria). Só a
// coordenação escreve (RLS); o gatilho registra o histórico.
export async function salvarNivelAluno({ alunoId, escopo, nivel, origem, motivo }) {
  // `definido_por` é o coordenador logado — não um usuário qualquer da
  // escola. meuPerfil() já resolve a identidade correta pelo JWT.
  const { escola, usuario } = await meuPerfil();
  const { data, error } = await supabase
    .from("aluno_niveis")
    .upsert(
      { escola_id: escola.id, aluno_id: alunoId, escopo, nivel, origem, motivo, definido_por: usuario.id, atualizado_em: new Date().toISOString() },
      { onConflict: "aluno_id,escopo" }
    )
    .select().single();
  if (error) throw falha("salvar nível", error);
  return data;
}

// Histórico de alterações de nível (só coordenação lê).
export async function historicoNivelAluno(alunoId) {
  const { data, error } = await supabase
    .from("aluno_nivel_historico").select("*").eq("aluno_id", alunoId).order("em", { ascending: false });
  if (error) throw falha("histórico de nível", error);
  return data;
}

// Alvo pedagógico do aluno (principal/secundário, data da prova,
// especialidade/ciclo). Escrita só da coordenação (RLS de alunos).
export async function atualizarAlvoPedagogico(alunoId, campos) {
  const permitidos = ["concurso_id", "concurso_secundario_id", "data_prova_alvo", "especialidade", "ciclo", "turma_comercial_codigo"];
  const patch = Object.fromEntries(Object.entries(campos).filter(([k]) => permitidos.includes(k)));
  const { data, error } = await supabase.from("alunos").update(patch).eq("id", alunoId).select("id");
  if (error) throw falha("atualizar alvo pedagógico", error);
  if (!data?.length) throw new Error("atualizar alvo pedagógico: o banco recusou a alteração");
}

// Onboarding pedagógico (1:1 com o aluno).
export async function carregarOnboarding(alunoId) {
  const { data, error } = await supabase.from("aluno_onboarding").select("*").eq("aluno_id", alunoId).maybeSingle();
  if (error) throw falha("onboarding", error);
  return data ?? null;
}

export async function salvarOnboarding(alunoId, campos) {
  const { escola } = await meuPerfil();
  const { data, error } = await supabase
    .from("aluno_onboarding")
    .upsert({ aluno_id: alunoId, escola_id: escola.id, ...campos, atualizado_em: new Date().toISOString() }, { onConflict: "aluno_id" })
    .select().single();
  if (error) throw falha("salvar onboarding", error);
  return data;
}

/* ---------- trilhas e missões (Fase 15.4) ---------- */

// Planos de trilha de um concurso (global, só leitura).
export async function carregarTrilhaPlanos(examTag) {
  const { data, error } = await supabase.from("trilha_planos").select("*").eq("exam_tag", examTag).order("ordem");
  if (error) throw falha("planos de trilha", error);
  return data;
}

// Missões de um concurso (global). Filtro opcional por nível.
export async function carregarMissoes(examTag, { nivel } = {}) {
  let q = supabase.from("missoes").select("*").eq("exam_tag", examTag).order("ordem");
  if (nivel) q = q.eq("nivel", nivel);
  const { data, error } = await q;
  if (error) throw falha("missões", error);
  return data;
}

// Plano pedagógico COMPLETO de um concurso (Fase 15.4), por exam_tag:
// horizontes (trilha_planos), missões oficiais e os ajustes da escola
// (estes isolados por RLS). É o ponto único que a UI usa para mostrar a
// "trilha do concurso" do aluno — derivada do exam_tag dele, NUNCA de
// uma trilha fixa. A montagem/regra de exibição fica em conteudo/missoes.js
// (lógica pura), não aqui: o seam só busca.
export async function carregarPlanoConcurso(examTag) {
  if (!examTag) return { planos: [], missoes: [], ajustesEscola: [] };
  const [planos, missoes, ajustesEscola] = await Promise.all([
    carregarTrilhaPlanos(examTag),
    carregarMissoes(examTag),
    carregarMissoesEscola(examTag),
  ]);
  return { planos, missoes, ajustesEscola };
}

// Ajustes de missão da escola do usuário (isolado por RLS).
// Degrada graciosamente se a tabela não existir ou o join falhar —
// o aluno ainda vê as missões oficiais, só sem os ajustes da escola.
export async function carregarMissoesEscola(examTag) {
  const { data, error } = await supabase
    .from("missoes_escola").select("*, missoes!inner(exam_tag)").eq("missoes.exam_tag", examTag);
  if (error) {
    if (tabelaInexistente(error) || /relationship|foreign/i.test(error?.message ?? "")) {
      console.warn("missoes_escola: tabela ou join indisponível, usando missões oficiais sem ajuste");
      return [];
    }
    throw falha("ajustes de missão da escola", error);
  }
  return data;
}

// Cria/ajusta o override de uma missão (só coordenação, via RLS).
export async function salvarAjusteMissaoEscola({ missaoId, ativa, qtdQuestoes, xp, criterioConclusao, objetivo, desvioDoEdital }) {
  const { escola, usuario } = await meuPerfil();
  const { data, error } = await supabase
    .from("missoes_escola")
    .upsert(
      {
        escola_id: escola.id, missao_id: missaoId, ativa, qtd_questoes: qtdQuestoes, xp,
        criterio_conclusao: criterioConclusao, objetivo, desvio_do_edital: !!desvioDoEdital,
        ajustado_por: usuario?.id ?? null, atualizado_em: new Date().toISOString(),
      },
      { onConflict: "escola_id,missao_id" }
    )
    .select().single();
  if (error) throw falha("salvar ajuste de missão", error);
  return data;
}

/* ---------- gamificação: XP, patentes, conquistas (Fase 15.5) ---------- */

// Catálogos globais (só leitura).
export async function listarPatentes() {
  const { data, error } = await supabase.from("patentes").select("*").order("ordem");
  if (error) throw falha("patentes", error);
  return data;
}

export async function listarConquistas() {
  const { data, error } = await supabase.from("conquistas").select("*").order("ordem");
  if (error) throw falha("conquistas", error);
  return data;
}

// Progresso do aluno (XP e conquistas), isolado por RLS no exam_tag.
export async function carregarGamificacaoAluno(alunoId, examTag) {
  const [xp, conq] = await Promise.all([
    supabase.from("aluno_xp_eventos").select("*").eq("aluno_id", alunoId).eq("exam_tag", examTag).order("em"),
    supabase.from("aluno_conquistas").select("*").eq("aluno_id", alunoId).eq("exam_tag", examTag),
  ]);
  for (const r of [xp, conq]) if (r.error) throw falha("gamificação do aluno", r.error);
  return { eventos: xp.data, conquistas: conq.data };
}

// Concede um evento de XP (só coordenação/servidor; aluno não se autopontua).
export async function concederXp({ alunoId, examTag, origem, pontos, descricao, referenciaId }) {
  const { escola, usuario } = await meuPerfil();
  const { data, error } = await supabase
    .from("aluno_xp_eventos")
    .insert({ escola_id: escola.id, aluno_id: alunoId, exam_tag: examTag, origem, pontos, descricao, referencia_id: referenciaId ?? null, concedido_por: usuario?.id ?? null })
    .select().single();
  if (error) throw falha("conceder XP", error);
  return data;
}

// Desbloqueia uma conquista para o aluno (idempotente por unique).
export async function desbloquearConquista({ alunoId, examTag, conquistaId }) {
  const { escola } = await meuPerfil();
  const { data, error } = await supabase
    .from("aluno_conquistas")
    .upsert({ escola_id: escola.id, aluno_id: alunoId, exam_tag: examTag, conquista_id: conquistaId }, { onConflict: "aluno_id,conquista_id,exam_tag" })
    .select().single();
  if (error) throw falha("desbloquear conquista", error);
  return data;
}

/* ---------- motor de progresso persistido (Fase C0) ---------- */

// Rollout em fases: se a migration 0024 não estiver aplicada num
// ambiente (ex.: demo antiga), a tabela não existe. Aqui o motor é
// ADITIVO: se a leitura falhar (tabela ausente), degrada para vazio e o
// front cai na estimativa legada — não derruba a tela. Erro fica no
// console para diagnóstico. Quando 0024 existe, a leitura é normal.
function tabelaInexistente(error) {
  const c = error?.code || error?.causa?.code;
  return c === "42P01" || c === "PGRST205" || /does not exist|could not find the table/i.test(error?.message || "");
}

// Eventos de progresso do aluno (ledger real). A RLS decide o que sai:
// aluno vê o próprio, coordenação a escola, responsável o vinculado.
// O aluno NÃO escreve aqui — quem grava é o gatilho no servidor.
export async function carregarEventosProgresso(alunoId, { limite = 50 } = {}) {
  const { data, error } = await supabase
    .from("aluno_eventos_progresso")
    .select("*")
    .eq("aluno_id", alunoId)
    .order("criado_em", { ascending: false })
    .limit(limite);
  if (error) {
    if (tabelaInexistente(error)) { console.warn("motor de progresso ainda não migrado neste ambiente"); return []; }
    throw falha("eventos de progresso", error);
  }
  return data;
}

// XP persistido do aluno: soma do ledger (todos os eventos válidos).
// Devolve { eventos, total } — o total é a verdade; patente deriva dele.
export async function carregarXpPersistido(alunoId) {
  const { data, error } = await supabase
    .from("aluno_eventos_progresso")
    .select("xp_delta, status, tipo_evento")
    .eq("aluno_id", alunoId);
  if (error) {
    if (tabelaInexistente(error)) { console.warn("motor de progresso ainda não migrado neste ambiente"); return { eventos: [], total: 0 }; }
    throw falha("XP persistido", error);
  }
  const total = (data ?? []).reduce(
    (a, e) => a + (e.status === "estornado" ? 0 : (+e.xp_delta || 0)),
    0,
  );
  return { eventos: data ?? [], total };
}

/* ---------- pessoas ---------- */

export async function meuAluno() {
  const { data, error } = await supabase.from("alunos").select("*").limit(1);
  if (error) throw falha("aluno", error);
  return data[0] ?? null;
}

export async function alunoVinculado() {
  const { data: v, error } = await supabase.from("vinculos_responsaveis").select("aluno_id").limit(1);
  if (error) throw falha("vínculo", error);
  if (!v?.length) return null;
  const { data: a, error: e2 } = await supabase.from("alunos").select("*").eq("id", v[0].aluno_id).single();
  if (e2) throw falha("aluno vinculado", e2);
  return a;
}

export async function listarTurmas() {
  const { data, error } = await supabase.from("turmas").select("*").order("nome");
  if (error) throw falha("turmas", error);
  return data;
}

export async function criarTurma(nome) {
  const { escola } = await meuPerfil();
  const { data, error } = await supabase
    .from("turmas").insert({ escola_id: escola.id, nome }).select().single();
  if (error) throw falha("criar turma", error);
  await registrarLogCoordenacao("criou-turma", { entidade: "turma", entidadeId: data.id, detalhe: { nome } });
  return data;
}

export async function renomearTurma(turmaId, nome) {
  const { data, error } = await supabase.from("turmas").update({ nome }).eq("id", turmaId).select("id");
  if (error) throw falha("renomear turma", error);
  if (!data?.length) throw new Error("renomear turma: o banco recusou a alteração");
  await registrarLogCoordenacao("renomeou-turma", { entidade: "turma", entidadeId: turmaId, detalhe: { nome } });
}

export async function removerTurma(turmaId) {
  const { error } = await supabase.from("turmas").delete().eq("id", turmaId);
  if (error) throw falha("excluir turma", error);
  await registrarLogCoordenacao("excluiu-turma", { entidade: "turma", entidadeId: turmaId });
}

export async function listarAlunos() {
  const { data, error } = await supabase
    .from("alunos")
    .select("*, alunos_turmas(turma_id, turmas(nome))")
    .order("nome");
  if (error) throw falha("alunos", error);
  return data;
}

// cadastro um a um ou em lote: `nomes` é um array (1..N)
export async function cadastrarAlunos(nomes, turmaId, trilhaId, concursoId) {
  const { escola } = await meuPerfil();
  const linhas = nomes.map((nome) => ({
    escola_id: escola.id, nome, trilha_id: trilhaId, concurso_id: concursoId ?? null,
  }));
  const { data, error } = await supabase.from("alunos").insert(linhas).select();
  if (error) throw falha("cadastrar alunos", error);
  if (turmaId) {
    const v = data.map((a) => ({ escola_id: escola.id, aluno_id: a.id, turma_id: turmaId }));
    const { error: e2 } = await supabase.from("alunos_turmas").insert(v);
    if (e2) throw falha("vincular turma", e2);
  }
  await registrarLogCoordenacao("importou-alunos", { entidade: "aluno", detalhe: { quantidade: data.length, turma_id: turmaId ?? null } });
  return data;
}

// troca a turma do aluno (modelo atual: uma turma por aluno)
export async function definirTurma(alunoId, turmaId) {
  const { escola } = await meuPerfil();
  const { error: e1 } = await supabase.from("alunos_turmas").delete().eq("aluno_id", alunoId);
  if (e1) throw falha("trocar turma", e1);
  if (turmaId) {
    const { error: e2 } = await supabase.from("alunos_turmas")
      .insert({ escola_id: escola.id, aluno_id: alunoId, turma_id: turmaId });
    if (e2) throw falha("trocar turma", e2);
  }
}

export async function atualizarAluno(alunoId, campos) {
  const { data, error } = await supabase.from("alunos").update(campos).eq("id", alunoId).select();
  if (error) throw falha("atualizar aluno", error);
  if (!data?.length) throw new Error("atualizar aluno: o banco recusou a alteração");
  return data[0];
}

// leituras da ESCOLA inteira (coordenação) — a RLS limita ao tenant.
// O painel NÃO baixa mais todos os registros/metas: a agregação por
// aluno acontece no banco (função resumo_escola, migration 0016) e
// volta uma linha por aluno. Escala para centenas de alunos.
export async function resumoEscola() {
  const { data, error } = await supabase.rpc("resumo_escola");
  if (error) throw falha("resumo da escola", error);
  return data;
}

// Simulados continuam crus (volume bem menor e o ranking precisa do
// detalhe por simulado); indexados no cliente por aluno.
export async function listarSimuladosEscola() {
  const { data, error } = await supabase
    .from("simulados").select("aluno_id, nome, data, acertos").order("data");
  if (error) throw falha("simulados da escola", error);
  return data;
}

/* ---------- provisão e servidor (Edge Functions) ---------- */

async function invocar(fn, body) {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    let detalhe = error.message;
    try {
      const ctx = await error.context?.json?.();
      if (ctx?.error) detalhe = ctx.error;
    } catch { /* corpo não-JSON: fica a mensagem original */ }
    throw falha(fn, new Error(detalhe));
  }
  if (data?.error) throw falha(fn, new Error(data.error));
  return data;
}

export const provisionarAluno = (alunoId) => invocar("provisionar-aluno", { tipo: "aluno", aluno_id: alunoId });
export const provisionarResponsavel = (alunoId, nome) =>
  invocar("provisionar-aluno", { tipo: "responsavel", aluno_id: alunoId, nome });
export const gerarMeta = (alunoId) => invocar("gerar-meta", { aluno_id: alunoId });
export const lgpdTitular = (acao, alunoId) => invocar("lgpd-titular", { acao, aluno_id: alunoId });

/* ---------- motor (meta + registro) ---------- */

export async function listarMetas(alunoId) {
  const { data, error } = await supabase
    .from("metas")
    .select("*, meta_atividades(id, estado, atividade_modelo_id)")
    .eq("aluno_id", alunoId)
    .order("semana_numero", { ascending: false });
  if (error) throw falha("metas", error);
  return data;
}

export async function metaAtual(alunoId) {
  const { data, error } = await supabase
    .from("metas")
    .select("*, meta_atividades(id, estado, atividade_modelo_id)")
    .eq("aluno_id", alunoId)
    .order("semana_numero", { ascending: false })
    .limit(1);
  if (error) throw falha("meta", error);
  return data[0] ?? null;
}

export async function definirEstadoAtividade(metaAtividadeId, estado) {
  const { data, error } = await supabase
    .from("meta_atividades")
    .update({ estado, atualizado_em: new Date().toISOString() })
    .eq("id", metaAtividadeId)
    .select();
  if (error) throw falha("estado da atividade", error);
  if (!data?.length) throw new Error("estado da atividade: o banco recusou a alteração");
  return data[0];
}

export async function listarRegistros(alunoId) {
  const { data, error } = await supabase
    .from("registros_estudo").select("*").eq("aluno_id", alunoId)
    .order("data", { ascending: false }).order("criado_em", { ascending: false });
  if (error) throw falha("registros", error);
  return data;
}

export async function adicionarRegistro(registro) {
  const { data, error } = await supabase.from("registros_estudo").insert(registro).select().single();
  if (error) throw falha("registrar estudo", error);
  return data;
}

export async function removerRegistro(id) {
  const { error } = await supabase.from("registros_estudo").delete().eq("id", id);
  if (error) throw falha("apagar registro", error);
}

export async function listarSimulados(alunoId) {
  const { data, error } = await supabase
    .from("simulados").select("*").eq("aluno_id", alunoId).order("data");
  if (error) throw falha("simulados", error);
  return data;
}

export async function adicionarSimulado(simulado) {
  const { data, error } = await supabase.from("simulados").insert(simulado).select().single();
  if (error) throw falha("salvar simulado", error);
  return data;
}

export async function removerSimulado(id) {
  const { error } = await supabase.from("simulados").delete().eq("id", id);
  if (error) throw falha("apagar simulado", error);
}

/* ---------- escola / marca ---------- */

export async function atualizarMarca(escolaId, marca) {
  const { data, error } = await supabase.from("escolas").update(marca).eq("id", escolaId).select("id");
  if (error) throw falha("marca", error);
  if (!data?.length) throw new Error("marca: o banco recusou a alteração (verifique seu papel)");
  // nunca logar o conteúdo do logo/cor em si é sensível pessoal — mas registrar
  // QUE a marca mudou tem valor de auditoria (ex.: branding trocado por engano).
  await registrarLogCoordenacao("atualizou-marca", { entidade: "escola", entidadeId: escolaId, detalhe: { campos: Object.keys(marca) } });
}

/* ---------- conformidade ---------- */

export async function registrarConsentimento(alunoId, responsavelNome) {
  const { usuario, escola } = await meuPerfil();
  const { data, error } = await supabase.from("consentimentos").insert({
    escola_id: escola.id, aluno_id: alunoId,
    responsavel_nome: responsavelNome, registrado_por: usuario.id,
  }).select().single();
  if (error) throw falha("consentimento", error);
  return data;
}

export async function listarConsentimentos() {
  const { data, error } = await supabase.from("consentimentos").select("*").order("aceito_em", { ascending: false });
  if (error) throw falha("consentimentos", error);
  return data;
}

export async function listarLogsAcesso(limite = 100) {
  const { data, error } = await supabase
    .from("logs_acesso").select("*").order("em", { ascending: false }).limit(limite);
  if (error) throw falha("logs de acesso", error);
  return data;
}

// Trilha de acesso (LGPD): quem lê dado de aluno registra o acesso.
// Falhar em logar não pode DERRUBAR a tela (é efeito colateral de uma
// leitura), mas não pode sumir em silêncio — a trilha LGPD é exigência
// legal. Devolve {ok} para o chamador decidir avisar, e mantém o log.
export async function registrarAcesso(escolaId, alunoId, usuarioId, papel, acao) {
  const { error } = await supabase.from("logs_acesso").insert({
    escola_id: escolaId, aluno_id: alunoId, usuario_id: usuarioId, papel, acao,
  });
  if (error) {
    console.error("log de acesso LGPD não registrado:", error.message);
    return { ok: false, erro: error.message };
  }
  return { ok: true };
}

// Trilha mínima de ações sensíveis da coordenação (Fase A.8): turma e
// marca alteradas, alunos importados — hoje sem rastro nenhum. Best-effort
// e silencioso como registrarAcesso: uma falha de log NUNCA pode derrubar
// a ação que está sendo logada.
async function registrarLogCoordenacao(acao, { entidade = null, entidadeId = null, detalhe = {} } = {}) {
  try {
    const { usuario, escola } = await meuPerfil();
    if (usuario.papel !== "coordenacao") return { ok: false };
    const { error } = await supabase.from("logs_coordenacao").insert({
      escola_id: escola.id, usuario_id: usuario.id, papel: usuario.papel,
      acao, entidade, entidade_id: entidadeId, detalhe,
    });
    if (error) { console.error("log de coordenação não registrado:", error.message); return { ok: false }; }
    return { ok: true };
  } catch (e) {
    console.error("log de coordenação não registrado:", e.message);
    return { ok: false };
  }
}

/* ---------- backoffice interno (super_admin) — Fase 17.4 ---------- */

// O App pergunta isto para decidir se mostra o backoffice. Resiliente:
// se a RPC não existir (banco antigo) ou for negada, trata como NÃO
// super_admin — login normal nunca quebra por causa disto.
export async function souSuperAdmin() {
  const { data, error } = await supabase.rpc("sou_super_admin");
  if (error) return false;
  return data === true;
}

// Resumo de todas as escolas (cross-tenant). A RPC tem porteiro
// eh_super_admin no banco — quem não é super_admin recebe erro.
export async function backofficeEscolas() {
  const { data, error } = await supabase.rpc("backoffice_escolas");
  if (error) throw falha("escolas (backoffice)", error);
  return data;
}

// Trilha de auditoria do operador. `super_admin_id` é o próprio (RLS).
export async function registrarAcaoAdmin(acao, escolaId = null, detalhe = {}) {
  const { data: s } = await supabase.auth.getSession();
  const uid = s?.session?.user?.id;
  if (!uid) return { ok: false };
  const { error } = await supabase.from("admin_logs")
    .insert({ super_admin_id: uid, acao, escola_id: escolaId, detalhe });
  if (error) { console.error("admin_log não registrado:", error.message); return { ok: false }; }
  return { ok: true };
}

// Criar escola pelo backoffice (RPC com porteiro no banco). Devolve o id.
export async function backofficeCriarEscola({ nome, slug, cidade, uf, plano, limiteAlunos }) {
  const { data, error } = await supabase.rpc("backoffice_criar_escola", {
    p_nome: nome, p_slug: slug, p_cidade: cidade ?? null, p_uf: uf ?? null,
    p_plano: plano ?? null, p_limite_alunos: limiteAlunos ?? null,
  });
  if (error) throw falha("criar escola", error);
  return data;
}

// Detalhe da escola + dados do checklist de implantação (jsonb).
export async function backofficeDetalheEscola(escolaId) {
  const { data, error } = await supabase.rpc("backoffice_detalhe_escola", { p_escola: escolaId });
  if (error) throw falha("detalhe da escola", error);
  return data;
}

// Atividade administrativa recente (admin_logs) — a RLS já restringe
// a leitura ao super_admin. Para o painel de monitoramento (17.6).
export async function backofficeLogs(limite = 30) {
  const { data, error } = await supabase
    .from("admin_logs").select("acao, escola_id, detalhe, em").order("em", { ascending: false }).limit(limite);
  if (error) throw falha("atividade administrativa", error);
  return data;
}
