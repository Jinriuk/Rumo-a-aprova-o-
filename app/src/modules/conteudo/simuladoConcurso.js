/* ============================================================
   SIMULADO POR CONCURSO (Fase 15.6) — lógica pura, sem banco/UI.
   ------------------------------------------------------------
   Avalia um simulado contra a ESTRUTURA REAL do concurso (matérias,
   nº de questões, pesos, dias, redação, modelo de eliminação) que a
   15.2 cadastrou. Honestidade: para concurso de MEDIANA não existe
   corte absoluto oficial — o sistema NÃO inventa nota de corte; usa
   um proxy conservador marcado como inferência só para sinal de risco.
   O simulado é insumo para nível (15.3) e missão (15.4).
   ============================================================ */

import { materiasObjetivas, materiaRedacao } from "./estruturaProva.js";
import { ELIMINACAO, REDACAO, STATUS_DADO } from "./pedagogia.js";

// Proxy conservador de "segurança" para o piso RELATIVO (mediana).
// NÃO é a regra oficial — só heurística de risco (doc §6.3).
export const PROXY_MEDIANA_PCT = 60;

const num = (v) => (Number.isFinite(+v) ? +v : 0);

/* Valida os acertos contra o máximo de cada matéria. Devolve os
   acertos "capados" no máximo e a lista de violações (informou mais
   que o total de questões da matéria). */
export function validarAcertos(materias = [], acertos = {}) {
  const objetivas = materiasObjetivas(materias);
  const capados = {};
  const violacoes = [];
  for (const m of objetivas) {
    const informado = num(acertos[m.materia_codigo]);
    const max = num(m.num_questoes);
    if (informado > max) violacoes.push({ materia: m.materia_codigo, informado, max });
    capados[m.materia_codigo] = Math.max(0, Math.min(informado, max));
  }
  return { capados, violacoes, valido: violacoes.length === 0 };
}

/* Nota por matéria: acertos, máximo, % e pontos. Pontos usam o
   valor por questão quando o edital dá (ex.: CN 2,5/q) ou o peso
   (ex.: EsPCEx); senão, caem no % puro. */
export function notaPorMateria(materias = [], acertos = {}) {
  const objetivas = materiasObjetivas(materias);
  return objetivas.map((m) => {
    const max = num(m.num_questoes);
    const ac = Math.max(0, Math.min(num(acertos[m.materia_codigo]), max));
    const pct = max > 0 ? Math.round((ac / max) * 100) : 0;
    const valor = m.valor_questao != null ? num(m.valor_questao) : null;
    const peso = m.peso != null ? num(m.peso) : null;
    const pontos = valor != null ? ac * valor : peso != null ? (pct / 100) * peso * max : ac;
    return { materia: m.materia_codigo, dia: m.dia_numero ?? null, acertos: ac, max, pct, peso, valor, pontos: Math.round(pontos * 100) / 100 };
  });
}

// Nota agregada por dia/bloco (quando o concurso separa por dia).
export function notaPorDia(materias = [], acertos = {}) {
  const linhas = notaPorMateria(materias, acertos);
  const porDia = new Map();
  for (const l of linhas) {
    const k = l.dia ?? 0;
    const cur = porDia.get(k) ?? { dia: l.dia ?? null, acertos: 0, max: 0, pontos: 0 };
    cur.acertos += l.acertos; cur.max += l.max; cur.pontos = Math.round((cur.pontos + l.pontos) * 100) / 100;
    porDia.set(k, cur);
  }
  return [...porDia.values()].sort((a, b) => (a.dia ?? 0) - (b.dia ?? 0));
}

// Papel da redação aplicado (eliminatória/classificatória/ausente).
export function avaliarRedacao(redacaoRole, redacaoNota, { minimo = null } = {}) {
  const papel = REDACAO[redacaoRole] ? redacaoRole : "ausente";
  if (papel === "ausente") return { papel, presente: false, apto: true, pontosClassificatorios: 0 };
  const nota = Number.isFinite(redacaoNota) ? redacaoNota : null;
  const apto = minimo == null || nota == null ? nota != null : nota >= minimo;
  const classifica = REDACAO[papel].classifica;
  return { papel, presente: nota != null, nota, apto, pontosClassificatorios: classifica && nota != null ? nota : 0 };
}

/* Avalia o modelo de eliminação. Para ABSOLUTO (CN 50%, FAB 5,0)
   devolve as matérias em risco com alvo claro. Para MEDIANA não há
   alvo oficial: devolve tipo 'relativo', aviso, e um proxy
   conservador marcado como INFERÊNCIA (nunca como regra). */
export function avaliarEliminacao(eliminationModel, linhasNota = []) {
  const modelo = ELIMINACAO[eliminationModel];
  if (!modelo) return { tipo: "desconhecido", emRisco: [], status: STATUS_DADO.VALIDAR };
  if (modelo.tipo === "absoluto") {
    const pisoPct = eliminationModel === "absoluto_50" ? 50 : 50; // 5,0/10 = 50%
    const emRisco = linhasNota.filter((l) => l.pct < pisoPct).map((l) => ({ materia: l.materia, pct: l.pct, alvo: pisoPct }));
    return { tipo: "absoluto", pisoPct, emRisco, status: STATUS_DADO.OFICIAL };
  }
  // mediana: sem corte absoluto oficial
  const emRisco = linhasNota.filter((l) => l.pct < PROXY_MEDIANA_PCT).map((l) => ({ materia: l.materia, pct: l.pct, proxy: PROXY_MEDIANA_PCT }));
  return {
    tipo: "relativo",
    aviso: "Piso relativo à mediana da turma: não há corte absoluto oficial. O alerta usa um proxy conservador.",
    proxyPct: PROXY_MEDIANA_PCT,
    emRisco,
    status: STATUS_DADO.INFERENCIA,
  };
}

// Objetivo curto e acionável a partir do resultado (doc §6 / 15.2).
export function objetivoSugerido(linhasNota = [], eliminationModel) {
  if (!linhasNota.length) return "Registrar um simulado completo para o diagnóstico começar.";
  const pior = [...linhasNota].sort((a, b) => a.pct - b.pct)[0];
  const relativo = ELIMINACAO[eliminationModel]?.tipo === "relativo";
  if (pior.pct < 70) {
    return relativo
      ? `Subir ${pior.materia.toUpperCase()} (hoje ${pior.pct}%) para ficar acima do campo — é a sua parte mais frágil.`
      : `Subir ${pior.materia.toUpperCase()} de ${pior.pct}% para ≥70% no próximo simulado.`;
  }
  const quase = linhasNota.find((l) => l.pct >= 85 && l.pct < 100);
  if (quase) return `Gabaritar ${quase.materia.toUpperCase()} — você já está em ${quase.pct}%.`;
  return "Manter o nível e melhorar a nota geral em relação a este simulado.";
}

// Compara a nota geral (% objetivas) com a meta da escola/aluno.
export function compararComMeta(linhasNota = [], metaPct = null) {
  const totalMax = linhasNota.reduce((s, l) => s + l.max, 0);
  const totalAc = linhasNota.reduce((s, l) => s + l.acertos, 0);
  const geralPct = totalMax > 0 ? Math.round((totalAc / totalMax) * 100) : 0;
  if (metaPct == null) return { geralPct, meta: null, atingiu: null, diferenca: null };
  return { geralPct, meta: metaPct, atingiu: geralPct >= metaPct, diferenca: geralPct - metaPct };
}

/* Alertas de risco: matérias em risco de eliminação + redação inapta.
   É o que vira sinal para a coordenação (corte simbólico, doc §12). */
export function alertasDeRisco({ eliminacao, redacao }) {
  const alertas = [];
  for (const r of eliminacao?.emRisco ?? []) {
    alertas.push({ tipo: "eliminacao", materia: r.materia, pct: r.pct, critico: eliminacao.tipo === "absoluto" });
  }
  if (redacao && redacao.presente && !redacao.apto) alertas.push({ tipo: "redacao", critico: true });
  return alertas;
}

/* Insumo para o NÍVEL (15.3): cada matéria vira {acertoPct, questoes}
   no formato que niveisAluno.classificarPorDesempenho consome. */
export function insumoParaNivel(linhasNota = []) {
  const out = {};
  for (const l of linhasNota) out[l.materia] = { acertoPct: l.pct, questoes: l.max };
  return out;
}

/* Avaliação completa do simulado de um concurso — junta tudo. */
export function avaliarSimulado({ materias = [], acertos = {}, redacaoNota = null, concurso = {}, metaPct = null, redacaoMinimo = null }) {
  const validacao = validarAcertos(materias, acertos);
  const linhas = notaPorMateria(materias, validacao.capados);
  const dias = notaPorDia(materias, validacao.capados);
  const redacao = avaliarRedacao(concurso.redacao_role, redacaoNota, { minimo: redacaoMinimo });
  const eliminacao = avaliarEliminacao(concurso.elimination_model, linhas);
  return {
    validacao,
    porMateria: linhas,
    porDia: dias,
    redacao,
    eliminacao,
    objetivo: objetivoSugerido(linhas, concurso.elimination_model),
    meta: compararComMeta(linhas, metaPct),
    alertas: alertasDeRisco({ eliminacao, redacao }),
    insumoNivel: insumoParaNivel(linhas),
    temRedacao: materiaRedacao(materias) != null,
  };
}
