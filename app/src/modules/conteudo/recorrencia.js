/* ============================================================
   RECORRÊNCIA E TAGUEAMENTO (Fase 15.7) — lógica pura, sem banco/UI.
   ------------------------------------------------------------
   Liga a estrutura de provas reais (tagueamento) à evolução das
   trilhas. Mantém a SEPARAÇÃO honesta dos graus de confiança e a
   regra de ouro: recorrência ESTIMADA é inferência e NÃO promove
   prioridade sozinha — só 'validada' ou 'medida' viram dado de
   produção (não transformar inferência em oficial).
   ============================================================ */

import { STATUS_DADO } from "./pedagogia.js";

export const TIPO_RECORRENCIA = {
  ESTIMADA: "estimada",
  VALIDADA: "validada",
  MEDIDA: "medida",
};

// Confiança crescente: medida > validada > estimada.
const CONFIANCA = { estimada: 0, validada: 1, medida: 2 };

// Só recorrência validada ou medida pode promover a prioridade de um
// assunto a dado de produção. Estimada permanece inferência.
export function podePromoverPrioridade(tipo) {
  return tipo === TIPO_RECORRENCIA.VALIDADA || tipo === TIPO_RECORRENCIA.MEDIDA;
}

// Mapeia o tipo de recorrência ao status do dado pedagógico.
export function statusDoTipo(tipo) {
  if (tipo === TIPO_RECORRENCIA.MEDIDA) return STATUS_DADO.OFICIAL;
  if (tipo === TIPO_RECORRENCIA.VALIDADA) return STATUS_DADO.OFICIAL;
  return STATUS_DADO.INFERENCIA; // estimada
}

/* Consolida as linhas de recorrência de um assunto: escolhe a de
   MAIOR confiança disponível, sem apagar as outras (a estimada fica
   visível como referência). Devolve o melhor valor + o seu grau. */
export function consolidarRecorrencia(linhas = []) {
  if (!linhas.length) return null;
  const melhor = [...linhas].sort((a, b) => (CONFIANCA[b.tipo] ?? -1) - (CONFIANCA[a.tipo] ?? -1))[0];
  return {
    assunto_id: melhor.assunto_id,
    tipo: melhor.tipo,
    status: statusDoTipo(melhor.tipo),
    pct_materia: melhor.pct_materia ?? null,
    num_questoes: melhor.num_questoes ?? null,
    promovivel: podePromoverPrioridade(melhor.tipo),
    alternativas: linhas.filter((l) => l !== melhor).map((l) => ({ tipo: l.tipo, pct_materia: l.pct_materia ?? null })),
  };
}

/* Sugere prioridade a partir da recorrência consolidada + peso da
   matéria. SUGESTÃO apenas: quem não é promovível (estimada) volta
   marcado para validação, sem virar regra. */
export function prioridadeSugerida(consolidado, { peso = null } = {}) {
  if (!consolidado) return { prioridade: null, aplicar: false, motivo: "sem recorrência" };
  const pct = consolidado.pct_materia ?? null;
  const pesoAlto = peso != null && peso >= 1.5;
  let prioridade = "media";
  if (pct != null) {
    if (pct >= 20 || pesoAlto) prioridade = "alta";
    else if (pct < 8) prioridade = "baixa";
  } else if (consolidado.num_questoes != null) {
    prioridade = consolidado.num_questoes >= 3 ? "alta" : consolidado.num_questoes <= 1 ? "baixa" : "media";
  }
  return { prioridade, aplicar: consolidado.promovivel, motivo: consolidado.promovivel ? consolidado.tipo : "estimada — pendente de validação" };
}

/* Relatório de incidência: cruza os assuntos do EDITAL com a
   recorrência MEDIDA na prova real. Sinaliza o que está no edital
   mas sem incidência medida (ponto cego) e o que tem alta incidência. */
export function relatorioIncidencia(assuntosEdital = [], medidaPorAssunto = {}) {
  return assuntosEdital.map((a) => {
    const medida = medidaPorAssunto[a.id]?.num_questoes_medidas ?? 0;
    return {
      assunto_id: a.id,
      nome: a.nome,
      materia: a.materia_codigo,
      prioridadeEdital: a.prioridade ?? null,
      questoesMedidas: medida,
      semIncidenciaMedida: medida === 0,
    };
  });
}
