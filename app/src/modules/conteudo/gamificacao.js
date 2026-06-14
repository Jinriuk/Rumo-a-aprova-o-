/* ============================================================
   GAMIFICAÇÃO PEDAGÓGICA (Fase 15.5) — lógica pura, sem banco/UI.
   ------------------------------------------------------------
   XP premia DOMÍNIO (acurácia), constância, evolução e simulado —
   nunca volume puro (doc §11/§12). O XP é um LEDGER de eventos; o
   total é a soma. Patente deriva do total; conquista é marco com
   critério atrelado a acurácia/nota/constância. Tudo travado no
   exam_tag do alvo (XP não é comparável entre exames — D2).
   ============================================================ */

// Multiplicadores (🟡 calibrar — doc §11). Peso oficial da matéria e
// dificuldade do nível dão legitimidade pedagógica ao XP.
export const MULT_PESO = { 2: 1.3, 1.5: 1.15, 1: 1.0 };
export const MULT_DIFICULDADE = { base: 1.0, intermediario: 1.2, avancado: 1.6, reta_final: 1.4 };

// Bônus fixos por evento que não é missão (doc §11).
export const BONUS = {
  semana_completa: 60,
  melhoria_materia: 40,
  simulado: 150,
  recuperacao: 120,
};

function multPeso(peso) {
  if (peso == null) return 1.0;
  return MULT_PESO[peso] ?? 1.0;
}

/* XP de uma missão CONCLUÍDA. Antigaming: só pontua se a acurácia
   bateu o limiar da missão (domínio), e escala por peso × dificuldade.
   Sem acurácia suficiente, a missão não fecha e o XP é zero. */
export function xpDeMissao({ xpBase = 0, peso, nivel = "base", acuracia, limiarAcuracia = 0 } = {}) {
  if (!Number.isFinite(acuracia) || acuracia < limiarAcuracia) return 0;
  const m = (MULT_DIFICULDADE[nivel] ?? 1.0) * multPeso(peso);
  return Math.round(xpBase * m);
}

// Total de XP = soma do ledger (opcionalmente de um exam_tag só).
export function totalXp(eventos = [], examTag = null) {
  return eventos
    .filter((e) => !examTag || e.exam_tag === examTag)
    .reduce((s, e) => s + (Number(e.pontos) || 0), 0);
}

/* Patente atual a partir do XP total + progresso para a próxima.
   As patentes vêm do catálogo (ordenadas por xp_necessario). */
export function patenteParaXp(xpTotal, patentes = []) {
  const ordenadas = [...patentes].sort((a, b) => a.xp_necessario - b.xp_necessario);
  let atual = null;
  let proxima = null;
  for (const p of ordenadas) {
    if (xpTotal >= p.xp_necessario) atual = p;
    else { proxima = p; break; }
  }
  if (!proxima) return { atual, proxima: null, progresso: 1, faltam: 0 };
  const piso = atual?.xp_necessario ?? 0;
  const faixa = proxima.xp_necessario - piso;
  const progresso = faixa > 0 ? Math.min(1, Math.max(0, (xpTotal - piso) / faixa)) : 0;
  return { atual, proxima, progresso, faltam: Math.max(0, proxima.xp_necessario - xpTotal) };
}

/* Avalia se uma conquista foi conquistada, a partir do estado do
   aluno. O critério é sempre por acurácia/nota/constância — nada de
   volume puro. Estado: { streakDias, questoesNoMes, acuraciaMes,
   simuladosCompletos, acuraciaPorMateria:{mat:..}, deltaAcuracia,
   pisoEmTodasUltimoSimulado, recuperouPiso, retaFinalAtiva }. */
export function avaliarConquista(conquista, estado = {}) {
  const c = conquista?.criterio ?? {};
  switch (conquista?.tipo) {
    case "constancia":
      return (estado.streakDias ?? 0) >= (c.dias ?? Infinity);
    case "volume":
      // volume SÓ conta com acurácia estável (antigaming)
      return (estado.questoesNoMes ?? 0) >= (c.questoes ?? Infinity)
          && (estado.acuraciaMes ?? 0) >= (c.acuracia_min ?? 0);
    case "desempenho":
      return (estado.melhorAcuraciaAltaPrioridade ?? 0) >= (c.acuracia_min ?? Infinity);
    case "simulado":
      return (estado.simuladosCompletos ?? 0) >= (c.simulados ?? Infinity);
    case "materia":
    case "alavancagem": {
      const ac = estado.acuraciaPorMateria?.[c.materia];
      return Number.isFinite(ac) && ac >= (c.acuracia_min ?? Infinity);
    }
    case "evolucao":
      return (estado.deltaAcuracia ?? 0) >= (c.delta_acuracia ?? Infinity);
    case "corte":
      return !!estado.pisoEmTodasUltimoSimulado;
    case "recuperacao":
      return !!estado.recuperouPiso;
    case "reta_final":
      return !!estado.retaFinalAtiva;
    default:
      return false;
  }
}

// Conquistas que o aluno JÁ ganharia com o estado atual (catálogo →
// avaliadas). Útil para destacar o que falta pouco e o que caiu.
export function conquistasGanhas(conquistas = [], estado = {}) {
  return conquistas.filter((c) => avaliarConquista(c, estado));
}

/* Separa o catálogo em desbloqueadas × bloqueadas a partir dos ids
   já registrados para o aluno (medalhas acesas × cinzas). */
export function separarConquistas(conquistas = [], desbloqueadasIds = []) {
  const set = new Set(desbloqueadasIds);
  const desbloqueadas = [];
  const bloqueadas = [];
  for (const c of conquistas) (set.has(c.id) ? desbloqueadas : bloqueadas).push(c);
  return { desbloqueadas, bloqueadas };
}
