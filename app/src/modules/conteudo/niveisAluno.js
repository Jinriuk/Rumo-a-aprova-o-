/* ============================================================
   NÍVEIS DE ALUNO (Fase 15.3) — lógica pura, sem banco e sem UI.
   ------------------------------------------------------------
   Classificação inicial, SIMPLES e testável — não é motor adaptativo.
   Quatro níveis (doc §8): Base, Intermediário, Avançado, Reta Final.
   • Nível = habilidade (Base/Inter/Avançado), por matéria e agregado.
   • Reta Final = estado TEMPORAL (proximidade da prova), sobreposto.
   • Sem dados suficientes → não inventa: devolve origem 'validar'.
   A lógica é por exam_tag/aluno; nunca por turma comercial.
   ============================================================ */

export const NIVEIS = {
  BASE: "base",
  INTERMEDIARIO: "intermediario",
  AVANCADO: "avancado",
  RETA_FINAL: "reta_final",
};

export const ORIGEM = {
  CALCULADO: "calculado",
  MANUAL: "manual",
  DIAGNOSTICO: "diagnostico",
  VALIDAR: "validar",
};

export const ROTULO_NIVEL = {
  base: "Base",
  intermediario: "Intermediário",
  avancado: "Avançado",
  reta_final: "Reta Final",
};

// Limiares (🟡 calibrar com turma real — doc §10). Conservadores de
// propósito: nível alto exige acerto E volume; pouco dado vira 'validar'.
export const LIMIAR = {
  VOLUME_MINIMO: 20,    // abaixo disto não há evidência suficiente
  VOLUME_AVANCADO: 100, // avançado exige volume consolidado
  ACERTO_BASE: 40,      // < 40% → Base
  ACERTO_AVANCADO: 70,  // ≥ 70% (com volume) → Avançado
  DIAS_RETA_FINAL: 90,  // ≤ 90 dias da prova → estado Reta Final
};

const RANK = { base: 0, intermediario: 1, avancado: 2 };

/* Desempenho → nível de habilidade. Volume gateia: bom acerto com
   pouco volume fica em Intermediário (consolidar), não Avançado. */
export function classificarPorDesempenho({ acertoPct, questoes } = {}) {
  if (!Number.isFinite(acertoPct) || !Number.isFinite(questoes) || questoes < LIMIAR.VOLUME_MINIMO) {
    return { nivel: null, origem: ORIGEM.VALIDAR };
  }
  if (acertoPct < LIMIAR.ACERTO_BASE) return { nivel: NIVEIS.BASE, origem: ORIGEM.CALCULADO };
  if (acertoPct >= LIMIAR.ACERTO_AVANCADO && questoes >= LIMIAR.VOLUME_AVANCADO) {
    return { nivel: NIVEIS.AVANCADO, origem: ORIGEM.CALCULADO };
  }
  return { nivel: NIVEIS.INTERMEDIARIO, origem: ORIGEM.CALCULADO };
}

// Nível de UMA matéria a partir dos números agregados dela.
export function calcularNivelMateria(desempenhoMateria) {
  return classificarPorDesempenho(desempenhoMateria);
}

// Estado temporal: dentro da janela de reta final (e ainda não passou).
export function estaEmRetaFinal(diasParaProva) {
  return Number.isFinite(diasParaProva) && diasParaProva >= 0 && diasParaProva <= LIMIAR.DIAS_RETA_FINAL;
}

/* Nível GERAL: agrega os níveis por matéria (média dos ranks, blindando
   o conservador no arredondamento). Se a prova está próxima, o estado
   Reta Final se sobrepõe. Sem nenhuma matéria com dado → 'validar'. */
export function calcularNivelGeral(niveisPorMateria = {}, { diasParaProva } = {}) {
  if (estaEmRetaFinal(diasParaProva)) {
    return { nivel: NIVEIS.RETA_FINAL, origem: ORIGEM.CALCULADO };
  }
  const ranks = Object.values(niveisPorMateria)
    .map((m) => (typeof m === "string" ? m : m?.nivel))
    .filter((n) => n in RANK)
    .map((n) => RANK[n]);
  if (!ranks.length) return { nivel: null, origem: ORIGEM.VALIDAR };
  const media = ranks.reduce((s, r) => s + r, 0) / ranks.length;
  const nivel = Object.keys(RANK).find((k) => RANK[k] === Math.round(media)) ?? NIVEIS.INTERMEDIARIO;
  // se faltou matéria com dado, marca como validar (agregado parcial)
  const completo = Object.values(niveisPorMateria).every((m) => (typeof m === "string" ? m : m?.nivel) in RANK);
  return { nivel, origem: completo ? ORIGEM.CALCULADO : ORIGEM.VALIDAR };
}

/* Sugestão de nível inicial no onboarding: prioriza o estado temporal,
   depois o desempenho do diagnóstico; sem dado, devolve um ponto de
   partida seguro marcado para validação humana (sem precisão falsa). */
export function sugerirNivelInicial({ diagnostico, diasParaProva } = {}) {
  if (estaEmRetaFinal(diasParaProva)) return { nivel: NIVEIS.RETA_FINAL, origem: ORIGEM.CALCULADO };
  const r = classificarPorDesempenho(diagnostico ?? {});
  if (r.nivel) return { nivel: r.nivel, origem: ORIGEM.DIAGNOSTICO };
  return { nivel: NIVEIS.BASE, origem: ORIGEM.VALIDAR };
}

/* Resumo para coordenação/responsável: pontos fortes (matérias
   Avançado) e de atenção (matérias Base). Não decide nada; só lê. */
export function resumirDiagnosticoAluno(niveisPorMateria = {}) {
  const fortes = [];
  const atencao = [];
  for (const [materia, m] of Object.entries(niveisPorMateria)) {
    const nivel = typeof m === "string" ? m : m?.nivel;
    if (nivel === NIVEIS.AVANCADO) fortes.push(materia);
    else if (nivel === NIVEIS.BASE) atencao.push(materia);
  }
  return { pontosFortes: fortes, pontosAtencao: atencao };
}
