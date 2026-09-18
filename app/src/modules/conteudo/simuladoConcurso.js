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

import { materiaRedacao } from "./estruturaProva.js";
import { ELIMINACAO, REDACAO, STATUS_DADO } from "./pedagogia.js";
import { avaliarAcertos, LEGADO_PADRAO } from "./notaSimulado.js";

// Proxy conservador de "segurança" para o piso RELATIVO (mediana).
// NÃO é a regra oficial — só heurística de risco (doc §6.3).
export const PROXY_MEDIANA_PCT = 60;

// (o capping e a coerção numérica vivem no motor único, notaSimulado.js)

/* Valida os acertos contra o máximo de cada matéria. Devolve os
   acertos "capados" no máximo e a lista de violações (informou mais
   que o total de questões da matéria).

   Onda 2 / I6: delega ao motor único (notaSimulado.js). O que mudou:
   a chave legada 'soc' agora é EXPANDIDA em his/geo antes da conta —
   antes ela era simplesmente ignorada aqui, e por isso esta tela dava
   52 num simulado que a tela do responsável dava 64. Matéria não
   respondida também deixou de virar 0: sai de `capados` e entra em
   `naoRespondidas`, senão o alerta de eliminação a trata como zerada. */
export function validarAcertos(materias = [], acertos = {}) {
  const r = avaliarAcertos(materias, acertos, { legado: LEGADO_PADRAO });
  const capados = {};
  for (const l of r.linhas) if (l.respondida) capados[l.materia] = l.acertos;
  return {
    capados,
    violacoes: r.violacoes,
    valido: r.violacoes.length === 0,
    naoRespondidas: r.naoRespondidas,
    expansoes: r.expansoes,
  };
}

/* Nota por matéria: acertos, máximo, % e pontos. Pontos usam o
   valor por questão quando o edital dá (ex.: CN 2,5/q) ou o peso
   (ex.: EsPCEx); senão, caem no % puro. */
export function notaPorMateria(materias = [], acertos = {}) {
  // Onda 2 / I6: motor único. Cada linha agora carrega `respondida`, e
  // `pct` é null (não 0) para matéria que o aluno não prestou.
  return avaliarAcertos(materias, acertos, { legado: LEGADO_PADRAO }).linhas;
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

  /* I5 — eliminação fabricada. O alerta só olha matéria que o aluno
     REALMENTE prestou. Antes, matéria ausente do JSON vinha como
     pct 0 e caía direto no filtro "abaixo do piso": o sistema
     anunciava eliminação em Biologia, História e Geografia para quem
     nunca fez essas provas, e disparava em 100% dos simulados.

     Cuidado de JS que o filtro precisa: com pct null, `null < 50` é
     TRUE (null coage para 0 na comparação relacional). Filtrar por
     `respondida` é obrigatório — trocar 0 por null não bastaria. */
  const prestadas = linhasNota.filter((l) => l.respondida && l.pct != null);

  if (modelo.tipo === "absoluto") {
    const pisoPct = eliminationModel === "absoluto_50" ? 50 : 50; // 5,0/10 = 50%
    const emRisco = prestadas.filter((l) => l.pct < pisoPct).map((l) => ({ materia: l.materia, pct: l.pct, alvo: pisoPct }));
    return { tipo: "absoluto", pisoPct, emRisco, naoPrestadas: linhasNota.filter((l) => !l.respondida).map((l) => l.materia), status: STATUS_DADO.OFICIAL };
  }
  // mediana: sem corte absoluto oficial
  const emRisco = prestadas.filter((l) => l.pct < PROXY_MEDIANA_PCT).map((l) => ({ materia: l.materia, pct: l.pct, proxy: PROXY_MEDIANA_PCT }));
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
  // I5: só matéria prestada vira objetivo (ver avaliarEliminacao).
  const prestadas = linhasNota.filter((l) => l.respondida && l.pct != null);
  if (!prestadas.length) return "Registrar um simulado completo para o diagnóstico começar.";
  const pior = [...prestadas].sort((a, b) => a.pct - b.pct)[0];
  const relativo = ELIMINACAO[eliminationModel]?.tipo === "relativo";
  if (pior.pct < 70) {
    return relativo
      ? `Subir ${pior.materia.toUpperCase()} (hoje ${pior.pct}%) para ficar acima do campo — é a sua parte mais frágil.`
      : `Subir ${pior.materia.toUpperCase()} de ${pior.pct}% para ≥70% no próximo simulado.`;
  }
  const quase = prestadas.find((l) => l.pct >= 85 && l.pct < 100);
  if (quase) return `Gabaritar ${quase.materia.toUpperCase()} — você já está em ${quase.pct}%.`;
  return "Manter o nível e melhorar a nota geral em relação a este simulado.";
}

// Compara a nota geral (% objetivas) com a meta da escola/aluno.
export function compararComMeta(linhasNota = [], metaPct = null) {
  // I5: o denominador é o que foi PRESTADO. Dividir pelo total da prova
  // quando o aluno não fez 3 matérias transformaria ausência em erro.
  const prestadas = linhasNota.filter((l) => l.respondida !== false);
  const totalMax = prestadas.reduce((s, l) => s + l.max, 0);
  const totalAc = prestadas.reduce((s, l) => s + l.acertos, 0);
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
  // I5: matéria não prestada não vira "0% de acerto" no cálculo de nível.
  for (const l of linhasNota) {
    if (l.respondida === false || l.pct == null) continue;
    out[l.materia] = { acertoPct: l.pct, questoes: l.max };
  }
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

/* ============================================================
   A9 — SEPARA O QUE TEM FORMATO DO QUE NÃO TEM
   ------------------------------------------------------------
   A Onda 2 corrigiu a GRAVAÇÃO (os dois formulários passaram a
   registrar `exam_tag`) e deixou escrito que faltava o outro lado: o
   histórico que já estava gravado com `exam_tag` nulo. Esta é a peça
   que faltava.

   `exam_tag` nulo não quer dizer "é do concurso atual". Quer dizer
   que o formato não foi registrado — o simulado é anterior à
   migration 0014, quando a coluna nem existia. Tratar nulo como
   "atual" faz o passado ser reescrito pelo presente: o mesmo
   simulado é avaliado com as regras do CN hoje e com as da EsPCEx
   amanhã, só porque o aluno trocou de alvo (e T29 mostrou que até o
   scroll do mouse sobre o select troca).

   Devolve duas listas. `doConcurso` é o que pode ser avaliado no
   formato da prova; `semFormato` é o que só pode ser exibido. Nenhum
   simulado é descartado: o registro é do aluno.
   ============================================================ */
export function segregarPorFormato(simulados = [], codigoConcurso = null) {
  const todos = simulados ?? [];
  return {
    doConcurso: todos.filter((s) => !!s?.exam_tag && s.exam_tag === codigoConcurso),
    semFormato: todos.filter((s) => !s?.exam_tag),
  };
}
