/* ============================================================
   TRILHAS E MISSÕES (Fase 15.4) — lógica pura, sem banco e sem UI.
   ------------------------------------------------------------
   Seleciona e ajusta missões para o aluno a partir do seu exam_tag
   ATIVO e do seu nível. Regra anti-furo: missão de matéria que não
   cai no concurso-alvo NÃO entra (como a missão carrega exam_tag,
   basta casar com o alvo do aluno). A escola pode ajustar; o ajuste
   divergente é sinalizado (desvio do edital). XP aqui é preliminar.
   ============================================================ */

import { NIVEIS } from "./niveisAluno.js";

export const TIPOS_TRILHA = {
  ANUAL: "anual",
  SEMESTRAL: "semestral",
  INTENSIVA: "intensiva",
  RETA_FINAL: "reta_final",
};

// Escolhe o tipo de trilha pela data da prova (estado temporal manda).
export function tipoTrilhaPorPrazo(diasParaProva) {
  if (!Number.isFinite(diasParaProva)) return TIPOS_TRILHA.ANUAL;
  if (diasParaProva <= 90) return TIPOS_TRILHA.RETA_FINAL;
  if (diasParaProva <= 180) return TIPOS_TRILHA.INTENSIVA;
  if (diasParaProva <= 270) return TIPOS_TRILHA.SEMESTRAL;
  return TIPOS_TRILHA.ANUAL;
}

/* Regra anti-furo: a missão só vale se for do exam_tag ATIVO do
   aluno. Sem alvo definido, nada de missão (não inventa). */
export function missaoCabeNoAlvo(missao, examTagAtivo) {
  return !!examTagAtivo && missao?.exam_tag === examTagAtivo;
}

// Só as missões do alvo do aluno (descarta as de outros concursos).
export function missoesDoAlvo(missoes = [], examTagAtivo) {
  return missoes.filter((m) => missaoCabeNoAlvo(m, examTagAtivo));
}

const RANK = { base: 0, intermediario: 1, avancado: 2, reta_final: 3 };

/* Missões adequadas ao nível: na Reta Final, prioriza missões de
   reta final; nos demais, traz as do nível atual e as de níveis já
   alcançados (revisão), sem pular para o que está acima. */
export function missoesParaNivel(missoes = [], nivelAluno) {
  const alvo = RANK[nivelAluno];
  if (!Number.isFinite(alvo)) return [];
  if (nivelAluno === NIVEIS.RETA_FINAL) {
    return missoes.filter((m) => m.nivel === NIVEIS.RETA_FINAL);
  }
  return missoes.filter((m) => RANK[m.nivel] <= alvo && m.nivel !== NIVEIS.RETA_FINAL);
}

/* Aplica o ajuste da escola sobre a missão oficial. O valor efetivo
   passa a ser o da escola onde houver; o oficial NÃO some (fica em
   `oficial`), e o desvio é sinalizado. Missão desativada some. */
export function aplicarAjusteEscola(missao, ajuste) {
  if (!ajuste) return { ...missao, ativa: true, desvioDoEdital: false, oficial: recorteOficial(missao) };
  if (ajuste.ativa === false) return null;
  return {
    ...missao,
    qtd_questoes_sugerida: ajuste.qtd_questoes ?? missao.qtd_questoes_sugerida,
    criterio_conclusao: ajuste.criterio_conclusao ?? missao.criterio_conclusao,
    objetivo: ajuste.objetivo ?? missao.objetivo,
    xp_sugerido: ajuste.xp ?? missao.xp_sugerido,
    ativa: true,
    desvioDoEdital: !!ajuste.desvio_do_edital,
    oficial: recorteOficial(missao),
  };
}

function recorteOficial(missao) {
  return {
    qtd_questoes_sugerida: missao.qtd_questoes_sugerida,
    criterio_conclusao: missao.criterio_conclusao,
    objetivo: missao.objetivo,
    xp_sugerido: missao.xp_sugerido,
  };
}

/* Monta a lista final de missões do aluno: filtra pelo alvo, pelo
   nível, aplica os ajustes da escola e ordena. Junta tudo o que as
   subfases anteriores cadastraram, respeitando a config oficial.
   `nivel` é OPCIONAL: omitido, devolve TODAS as missões do alvo
   (visão "trilha do concurso", sem cortar por nível). A regra
   anti-furo (exam_tag) e os ajustes da escola valem sempre. */
export function montarMissoesDoAluno({ missoes = [], examTagAtivo, nivel, ajustesEscola = [] }) {
  const ajustePorMissao = new Map(ajustesEscola.map((a) => [a.missao_id, a]));
  return missoesDoAlvo(missoes, examTagAtivo)
    .filter((m) => !nivel || missoesParaNivel([m], nivel).length > 0)
    .map((m) => aplicarAjusteEscola(m, ajustePorMissao.get(m.id)))
    .filter(Boolean)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

// Quais missões a escola está divergindo do desenho oficial.
export function desviosDeMissao(missoes = [], ajustesEscola = []) {
  const porId = new Map(missoes.map((m) => [m.id, m]));
  return ajustesEscola
    .filter((a) => a.desvio_do_edital && porId.has(a.missao_id))
    .map((a) => ({ missao_id: a.missao_id, nome: porId.get(a.missao_id).nome }));
}

/* FILA DE MISSÕES DO ALUNO, por matéria (motor 0061). Espelha a regra do
   banco: missão automática = meta efetiva (a da escola, senão a do
   catálogo) > 0 e não desativada pela escola; ordem do catálogo
   (`ordem`, desempate por id); uma em andamento por matéria. Cada missão
   sai com estado:
     concluida  linha do aluno concluída (inclui legado e desativadas
                depois de concluídas: o que concluiu fica)
     atual      a em andamento
     a_seguir   ainda não começou (o banco não cria linha antes disso)
   Só a primeira em andamento da matéria é a atual: com o motor antigo
   (banco sem a 0061) todas as missões com meta ficam em andamento ao
   mesmo tempo, e a tela não pode mostrar várias "atuais". Sem atual na
   matéria, a primeira "a seguir" sai com `proxima: true` (começa no
   próximo registro com acertos; não há anterior para esperar).
   `progresso` = linhas de aluno_missoes (carregarMissoesAluno).
   Devolve [{ materia_codigo, missoes: [...] }] na ordem da primeira
   missão de cada matéria. Puro: testado em tests/missoes.test.mjs. */
export function filaDeMissoes({ catalogo = [], ajustesEscola = [], progresso = [] }) {
  const ajustePorMissao = new Map(ajustesEscola.map((a) => [a.missao_id, a]));
  const linhaPorMissao = new Map(progresso.map((p) => [p.missao_id, p]));
  const porMateria = new Map();
  const ordenado = [...catalogo].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || String(a.id).localeCompare(String(b.id)));
  for (const m of ordenado) {
    const ajuste = ajustePorMissao.get(m.id);
    const linha = linhaPorMissao.get(m.id);
    const metaQuestoes = ajuste?.qtd_questoes ?? m.meta_questoes ?? null;
    const automatica = metaQuestoes != null && metaQuestoes > 0 && ajuste?.ativa !== false;
    const concluida = linha?.estado === "concluida";
    if (!automatica && !concluida) continue;
    if (!porMateria.has(m.materia_codigo)) porMateria.set(m.materia_codigo, { temAtual: false, missoes: [] });
    const grupo = porMateria.get(m.materia_codigo);
    const atual = !concluida && linha?.estado === "em_andamento" && !grupo.temAtual;
    if (atual) grupo.temAtual = true;
    const estado = concluida ? "concluida" : atual ? "atual" : "a_seguir";
    grupo.missoes.push({
      id: m.id,
      nome: m.nome,
      materia_codigo: m.materia_codigo,
      estado,
      meta_questoes: metaQuestoes,
      meta_acuracia: m.meta_acuracia ?? null,
      xp: ajuste?.xp ?? m.xp_sugerido ?? 0,
      questoes: estado === "a_seguir" ? 0 : linha?.questoes_acumuladas ?? 0,
      acuracia: estado === "a_seguir" ? null : linha?.acuracia ?? null,
      xp_concedido: linha?.xp_concedido ?? 0,
      proxima: false,
    });
  }
  return [...porMateria.entries()].map(([materia_codigo, { temAtual, missoes }]) => {
    const primeira = temAtual ? null : missoes.find((mi) => mi.estado === "a_seguir");
    if (primeira) primeira.proxima = true;
    return { materia_codigo, missoes };
  });
}
