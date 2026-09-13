/* Estrutura de PROVA por concurso — ESPELHO da estrutura OFICIAL do
   banco (supabase/seed/07_provas.sql, status_dado='oficial'). Fonte da
   validação ("acertos não passam do máximo"), da nota projetada e do
   ranking/semáforo lidos pela coordenação e pelo responsável.

   EST1-A5 (2026-07): esta tabela ANTES divergia do banco (ESA 40q vs
   50 oficiais; EsPCEx com dias trocados; EPCAR 20q vs 16; CN Dia 2 com
   fis/qui max 10 e a chave agregada 'soc' em vez de fis/qui/bio + his/
   geo). Como o SimuladoConcurso salva com as chaves OFICIAIS
   (bio/his/geo), o ranking da turma e o resumo do responsável — que
   liam esta tabela — subcontavam os acertos. Agora os números e as
   chaves batem 1:1 com o seed 07. Ao mexer aqui, mexa também no seed. */

import { avaliarAcertos } from "./notaSimulado.js";

export const PROVAS = {
  // CN — Dia 1: Mat+Ing (2,5/q). Dia 2: Por + Ciências (fís/quí/bio 6) +
  // Estudos Sociais (hist/geo 6). Redação eliminatória (tratada à parte).
  cn: {
    rotulo: "Colégio Naval",
    dias: [
      { nome: "Dia 1", materias: [{ k: "mat", nome: "Matemática", max: 20 }, { k: "ing", nome: "Inglês", max: 20 }] },
      { nome: "Dia 2", materias: [
        { k: "por", nome: "Português", max: 20 },
        { k: "fis", nome: "Física", max: 6 }, { k: "qui", nome: "Química", max: 6 }, { k: "bio", nome: "Biologia", max: 6 },
        { k: "his", nome: "História", max: 6 }, { k: "geo", nome: "Geografia", max: 6 },
      ] },
    ],
    // nota clássica do Dia 1 (mat+ing /40 → escala 0–100) — inalterada.
    nota: (ac) => Math.round(((+ac.mat || 0) + (+ac.ing || 0)) * 2.5),
    notaRotulo: "nota projetada Dia 1",
    // Compat de dado LEGADO: simulados antigos guardavam 'soc' (Estudos
    // Sociais somado). Ao ler um simulado assim, o valor de 'soc' entra
    // como acerto de 'his' (bucket, teto 6+6) para não sumir do total.
    legado: { soc: ["his", "geo"] },
  },
  epcar: {
    rotulo: "EPCAR",
    dias: [
      { nome: "Prova única", materias: [{ k: "por", nome: "Português", max: 16 }, { k: "mat", nome: "Matemática", max: 16 }, { k: "ing", nome: "Inglês", max: 16 }] },
    ],
    nota: (ac) => Math.round((((+ac.por || 0) + (+ac.mat || 0) + (+ac.ing || 0)) / 48) * 100),
    notaRotulo: "nota projetada",
  },
  espcex: {
    rotulo: "EsPCEx",
    dias: [
      { nome: "Dia 1", materias: [{ k: "por", nome: "Português", max: 20 }, { k: "fis", nome: "Física", max: 12 }, { k: "qui", nome: "Química", max: 12 }] },
      { nome: "Dia 2", materias: [{ k: "mat", nome: "Matemática", max: 20 }, { k: "ing", nome: "Inglês", max: 12 }, { k: "his", nome: "História", max: 12 }, { k: "geo", nome: "Geografia", max: 12 }] },
    ],
    nota: null, notaRotulo: null,
    // legado: 'soc' de EsPCEx (Hist./Geo. somado) → his/geo.
    legado: { soc: ["his", "geo"] },
  },
  esa: {
    rotulo: "ESA",
    dias: [
      { nome: "Prova única", materias: [
        { k: "mat", nome: "Matemática", max: 14 }, { k: "por", nome: "Português", max: 14 },
        { k: "his", nome: "História", max: 6 }, { k: "geo", nome: "Geografia", max: 6 }, { k: "ing", nome: "Inglês", max: 10 },
      ] },
    ],
    nota: null, notaRotulo: null,
    legado: { soc: ["his", "geo"] },
  },
  eear: {
    rotulo: "EEAr",
    dias: [
      { nome: "Prova única", materias: [{ k: "por", nome: "Português", max: 24 }, { k: "ing", nome: "Inglês", max: 24 }, { k: "mat", nome: "Matemática", max: 24 }, { k: "fis", nome: "Física", max: 24 }] },
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

// fallback: estrutura genérica (CN) — compatível com o histórico.
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

/* Onda 2 / I6: esta tabela deixou de pontuar por conta própria.
   Existiam dois motores sobre o mesmo simulado (este e o
   simuladoConcurso.js, que lê a estrutura do banco) e eles devolviam
   números diferentes — no dado real do demo, 64 aqui contra 52 lá,
   para um JSON que soma 74. Agora os dois delegam ao motor único em
   notaSimulado.js, que é quem sabe expandir a chave legada 'soc',
   distinguir "não respondida" de "zerou" e registrar o capping.

   A estrutura daqui vira o shape do banco (materia_codigo/num_questoes)
   para o motor não precisar saber de qual dos dois lados ela veio.
   Continua sendo FALLBACK: quando a estrutura do banco existe, é ela
   que manda. */
function comoEstruturaDeBanco(prova) {
  return materiasDaProva(prova).map((m) => ({
    materia_codigo: m.k,
    num_questoes: m.max,
    eh_redacao: false,
  }));
}

export function avaliarProva(prova, acertos = {}) {
  return avaliarAcertos(comoEstruturaDeBanco(prova), acertos, { legado: prova.legado ?? {} });
}

export function totalAcertos(prova, acertos = {}) {
  return avaliarProva(prova, acertos).totalAcertos;
}

// nota geral em % quando o concurso não tem fórmula própria
export function notaPct(prova, acertos) {
  if (prova.nota) return prova.nota(acertos);
  return Math.round((totalAcertos(prova, acertos) / totalQuestoes(prova)) * 100);
}

/* Objetivo sugerido pós-simulado (Fase 6): olha o último resultado
   e devolve UMA meta curta e acionável. */
export function objetivoSugerido(prova, acertos) {
  const nomePorCodigo = Object.fromEntries(materiasDaProva(prova).map((m) => [m.k, m.nome]));
  // I5: só matéria RESPONDIDA entra no objetivo — sugerir "suba
  // Biologia de 0%" para quem nunca fez Biologia é o mesmo defeito que
  // anunciava eliminação em matéria não prestada.
  const ms = avaliarProva(prova, acertos).linhas
    .filter((l) => l.respondida)
    .map((l) => ({ ...l, nome: nomePorCodigo[l.materia] ?? l.materia }));
  const pior = [...ms].sort((a, b) => a.pct - b.pct)[0];
  const quaseGabarito = ms.find((m) => m.pct >= 85 && m.pct < 100);
  if (pior && pior.pct < 70) return `Subir ${pior.nome} de ${pior.pct}% para ≥70% no próximo simulado.`;
  if (quaseGabarito) return `Gabaritar ${quaseGabarito.nome} — você já está em ${quaseGabarito.pct}%.`;
  return "Manter o nível e melhorar a nota geral em relação a este simulado.";
}
