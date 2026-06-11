/* ============================================================
   JARGÃO DE JOGO (camada de apresentação naval/militar).
   ------------------------------------------------------------
   Centralizado aqui de propósito: é só rótulo de tela. NÃO muda
   regra de negócio, dado nem a metodologia. Dá a cara de "missão"
   que engaja o aluno (ref. dos designs). Tweakável por concurso
   no futuro sem tocar no resto.
   ============================================================ */

export const L = {
  missao: "Missão",
  proximaMissao: "Próxima Missão",
  objetivos: "Objetivos da semana",
  concluir: "Concluir",
  adiar: "Adiar",
  cumprido: "Cumprido",
  precisao: "Precisão",
  horas: "Horas de instrução",
  alvos: "Alvos atingidos",
  ritmo: "Ritmo diário",
  radar: "Radar de desempenho",
  tempoProva: "Tempo p/ a prova",
};

// XP derivado de PROGRESSO REAL (atividades cumpridas, questões,
// simulados). Só exibição — não persiste, não falsifica nada.
export function calcularXP({ metas = [], totalQuestoes = 0, simulados = 0 }) {
  const cumpridas = metas.reduce(
    (a, m) => a + (m.meta_atividades ?? []).filter((x) => x.estado === "concluida").length,
    0,
  );
  return cumpridas * 100 + totalQuestoes + simulados * 50;
}

// Patentes por faixa de XP — escala do EXÉRCITO (padrão e neutra
// entre forças: as turmas misturam CN+EPCAR, EsSA+EEAr etc.).
// O "nível" é o índice + 1.
export const PATENTES = [
  { xp: 0, nome: "Recruta" },
  { xp: 300, nome: "Soldado" },
  { xp: 800, nome: "Cabo" },
  { xp: 1600, nome: "2º Tenente" },
  { xp: 2800, nome: "1º Tenente" },
  { xp: 4400, nome: "Capitão" },
  { xp: 6500, nome: "Major" },
  { xp: 9200, nome: "Coronel" },
  { xp: 12500, nome: "General" },
];

export function patente(xp) {
  let i = 0;
  for (let k = 0; k < PATENTES.length; k++) if (xp >= PATENTES[k].xp) i = k;
  const atual = PATENTES[i];
  const prox = PATENTES[i + 1] ?? null;
  const pct = prox ? Math.round(((xp - atual.xp) / (prox.xp - atual.xp)) * 100) : 100;
  return { nome: atual.nome, nivel: i + 1, xp, proxXp: prox?.xp ?? null, proxNome: prox?.nome ?? null, pctProx: pct };
}

// XP que uma atividade vale, pela prioridade (Fechar vale mais).
export const xpPorPrioridade = { F: 100, P: 60, X: 40 };

// Rótulo e tom da prioridade no "modo missão".
export const PRIORIDADE = {
  F: { texto: "Prioridade máxima", tom: "risco" },
  P: { texto: "Atenção média", tom: "alerta" },
  X: { texto: "Apoio", tom: "neutro" },
};

export const fmtHoras = (min) => {
  if (!min) return "0h00m";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h${String(m).padStart(2, "0")}m`;
};

export const fmtHorasCurto = (min) => {
  if (!min) return "0h";
  const h = min / 60;
  return h >= 10 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`;
};
