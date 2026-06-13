/* ============================================================
   ESTRUTURA DE PROVA POR CONCURSO (Fase 15.2) — lógica pura.
   ------------------------------------------------------------
   Lê a estrutura cadastrada no banco (provas, dias, matérias,
   assuntos, subassuntos) e oferece os recortes que as telas e os
   simulados (15.6) vão consumir. Cada concurso é tratado pelo seu
   `exam_tag`; nada de misturar regra de prova entre concursos.

   Não fala com o banco (isso é o seam de dados); aqui só organiza.
   Não antecipa missão/XP/simulado: só estrutura + status do dado.
   ============================================================ */

import { STATUS_DADO } from "./pedagogia.js";

export const ORDEM_PRIORIDADE = { alta: 0, media: 1, baixa: 2 };

// Só as matérias objetivas (exclui a redação, que tem papel próprio).
export function materiasObjetivas(materias = []) {
  return materias.filter((m) => !m.eh_redacao);
}

// A matéria de redação do concurso (ou null se ausente, ex.: EEAR).
export function materiaRedacao(materias = []) {
  return materias.find((m) => m.eh_redacao) ?? null;
}

// Total de questões objetivas do concurso (soma do nº por matéria).
export function totalQuestoesObjetivas(materias = []) {
  return materiasObjetivas(materias).reduce((s, m) => s + (m.num_questoes || 0), 0);
}

// Agrupa as matérias por dia/bloco de prova, na ordem do edital.
export function materiasPorDia(materias = [], dias = []) {
  const porNumero = new Map(dias.map((d) => [d.numero, { ...d, materias: [] }]));
  const semDia = [];
  for (const m of [...materias].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))) {
    const alvo = porNumero.get(m.dia_numero);
    (alvo ? alvo.materias : semDia).push(m);
  }
  const grupos = [...porNumero.values()].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  if (semDia.length) grupos.push({ numero: null, nome: "Prova", materias: semDia });
  return grupos;
}

// Assuntos de uma matéria, ordenados por prioridade (alta → baixa)
// e depois pela ordem cadastrada.
export function assuntosOrdenados(assuntos = [], materiaCodigo = null) {
  return assuntos
    .filter((a) => !materiaCodigo || a.materia_codigo === materiaCodigo)
    .sort((a, b) => {
      const pa = ORDEM_PRIORIDADE[a.prioridade] ?? 99;
      const pb = ORDEM_PRIORIDADE[b.prioridade] ?? 99;
      return pa - pb || (a.ordem ?? 0) - (b.ordem ?? 0);
    });
}

// Conta o dado por status — alimenta o selo de transparência
// (quanto é oficial vs. inferência vs. validar) na tela da escola.
export function resumoStatus(itens = []) {
  const base = { [STATUS_DADO.OFICIAL]: 0, [STATUS_DADO.INFERENCIA]: 0, [STATUS_DADO.VALIDAR]: 0 };
  for (const i of itens) if (i.status_dado in base) base[i.status_dado] += 1;
  return base;
}

// Liga subassuntos aos seus assuntos (devolve cada assunto com a
// lista de subassuntos já anexada e ordenada).
export function comporAssuntos(assuntos = [], subassuntos = []) {
  const porAssunto = {};
  for (const s of subassuntos) (porAssunto[s.assunto_id] ??= []).push(s);
  for (const lista of Object.values(porAssunto)) lista.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  return assuntos.map((a) => ({ ...a, subassuntos: porAssunto[a.id] ?? [] }));
}
