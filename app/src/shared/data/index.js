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
  const { data: u, error } = await supabase.from("usuarios").select("id, escola_id, papel, nome").limit(1);
  if (error) throw falha("perfil", error);
  if (!u?.length) throw new Error("perfil: usuário sem cadastro nesta escola");
  const { data: e, error: e2 } = await supabase
    .from("escolas").select("id, nome, slug, logo_url, cor_acento").eq("id", u[0].escola_id).single();
  if (e2) throw falha("escola", e2);
  return { usuario: u[0], escola: e };
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
  return data;
}

export async function renomearTurma(turmaId, nome) {
  const { data, error } = await supabase.from("turmas").update({ nome }).eq("id", turmaId).select("id");
  if (error) throw falha("renomear turma", error);
  if (!data?.length) throw new Error("renomear turma: o banco recusou a alteração");
}

export async function removerTurma(turmaId) {
  const { error } = await supabase.from("turmas").delete().eq("id", turmaId);
  if (error) throw falha("excluir turma", error);
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

// leituras da ESCOLA inteira (coordenação) — a RLS limita ao tenant
export async function listarRegistrosEscola() {
  const { data, error } = await supabase
    .from("registros_estudo").select("aluno_id, data, questoes, acertos, minutos");
  if (error) throw falha("registros da escola", error);
  return data;
}

export async function listarSimuladosEscola() {
  const { data, error } = await supabase
    .from("simulados").select("aluno_id, nome, data, acertos").order("data");
  if (error) throw falha("simulados da escola", error);
  return data;
}

export async function listarMetasEscola() {
  const { data, error } = await supabase
    .from("metas").select("aluno_id, status, semana_numero, meta_atividades(estado)");
  if (error) throw falha("metas da escola", error);
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
// Falhar em logar não pode derrubar a tela, mas aparece no console.
export async function registrarAcesso(escolaId, alunoId, usuarioId, papel, acao) {
  const { error } = await supabase.from("logs_acesso").insert({
    escola_id: escolaId, aluno_id: alunoId, usuario_id: usuarioId, papel, acao,
  });
  if (error) console.error("log de acesso não registrado:", error.message);
}
