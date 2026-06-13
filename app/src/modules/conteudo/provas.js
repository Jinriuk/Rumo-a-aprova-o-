/* Estrutura de PROVA por concurso (Fase 6 do doc central):
   concurso → dias → matérias → máximo de questões. É a fonte da
   validação ("acertos não passam do máximo") e da nota projetada.
   ATENÇÃO: quantidades marcadas como aproximadas serão ajustadas na
   etapa de estudo pedagógico dos editais (Fase 15) — a ESTRUTURA é
   o que importa aqui; os números são configuração, não código. */

export const PROVAS = {
  cn: {
    rotulo: "Colégio Naval",
    dias: [
      { nome: "Dia 1", materias: [{ k: "mat", nome: "Matemática", max: 20 }, { k: "ing", nome: "Inglês", max: 20 }] },
      { nome: "Dia 2", materias: [{ k: "por", nome: "Português", max: 20 }, { k: "fis", nome: "Física", max: 10 }, { k: "qui", nome: "Química", max: 10 }, { k: "soc", nome: "Est. Sociais", max: 20 }] },
    ],
    // nota clássica do Dia 1 (mat+ing /40 → escala 0–100)
    nota: (ac) => Math.round(((+ac.mat || 0) + (+ac.ing || 0)) * 2.5),
    notaRotulo: "nota projetada Dia 1",
  },
  epcar: {
    rotulo: "EPCAR",
    dias: [
      { nome: "Prova única", materias: [{ k: "por", nome: "Português", max: 20 }, { k: "mat", nome: "Matemática", max: 20 }, { k: "ing", nome: "Inglês", max: 20 }] }, // quantidades aproximadas
    ],
    nota: (ac) => Math.round((((+ac.por || 0) + (+ac.mat || 0) + (+ac.ing || 0)) / 60) * 100),
    notaRotulo: "nota projetada",
  },
  espcex: {
    rotulo: "EsPCEx",
    dias: [
      { nome: "Dia 1", materias: [{ k: "mat", nome: "Matemática", max: 20 }, { k: "fis", nome: "Física", max: 12 }, { k: "qui", nome: "Química", max: 10 }] }, // aprox.
      { nome: "Dia 2", materias: [{ k: "por", nome: "Português", max: 20 }, { k: "ing", nome: "Inglês", max: 10 }, { k: "soc", nome: "Hist./Geo.", max: 14 }] }, // aprox.
    ],
    nota: null, notaRotulo: null,
  },
  esa: {
    rotulo: "ESA",
    dias: [
      { nome: "Prova única", materias: [{ k: "mat", nome: "Matemática", max: 12 }, { k: "por", nome: "Português", max: 12 }, { k: "ing", nome: "Inglês", max: 8 }, { k: "soc", nome: "Hist./Geo.", max: 8 }] }, // aprox.
    ],
    nota: null, notaRotulo: null,
  },
  eear: {
    rotulo: "EEAr",
    dias: [
      { nome: "Prova única", materias: [{ k: "por", nome: "Português", max: 24 }, { k: "ing", nome: "Inglês", max: 24 }, { k: "mat", nome: "Matemática", max: 24 }, { k: "fis", nome: "Física", max: 24 }] }, // aprox. (BCT)
    ],
    nota: null, notaRotulo: null,
  },
  cm: {
    rotulo: "Colégio Militar",
    dias: [
      { nome: "Prova única", materias: [{ k: "mat", nome: "Matemática", max: 20 }, { k: "por", nome: "Português", max: 20 }] },
    ],
    nota: null, notaRotulo: null,
  },
};

// fallback: estrutura genérica (mesmas chaves do CN — compatível com
// o que já está salvo no banco)
const PADRAO = PROVAS.cn;

export function provaDoConcurso(codigo) {
  return PROVAS[codigo] ?? PADRAO;
}

export function materiasDaProva(prova) {
  return prova.dias.flatMap((d) => d.materias);
}

export function totalQuestoes(prova) {
  return materiasDaProva(prova).reduce((s, m) => s + m.max, 0);
}

export function totalAcertos(prova, acertos) {
  return materiasDaProva(prova).reduce((s, m) => s + Math.min(+acertos[m.k] || 0, m.max), 0);
}

// nota geral em % quando o concurso não tem fórmula própria
export function notaPct(prova, acertos) {
  if (prova.nota) return prova.nota(acertos);
  return Math.round((totalAcertos(prova, acertos) / totalQuestoes(prova)) * 100);
}

/* Objetivo sugerido pós-simulado (Fase 6): olha o último resultado
   e devolve UMA meta curta e acionável. */
export function objetivoSugerido(prova, acertos) {
  const ms = materiasDaProva(prova).map((m) => ({ ...m, pct: Math.round((Math.min(+acertos[m.k] || 0, m.max) / m.max) * 100) }));
  const pior = [...ms].sort((a, b) => a.pct - b.pct)[0];
  const quaseGabarito = ms.find((m) => m.pct >= 85 && m.pct < 100);
  if (pior && pior.pct < 70) return `Subir ${pior.nome} de ${pior.pct}% para ≥70% no próximo simulado.`;
  if (quaseGabarito) return `Gabaritar ${quaseGabarito.nome} — você já está em ${quaseGabarito.pct}%.`;
  return "Manter o nível e melhorar a nota geral em relação a este simulado.";
}
