import { questoesSugeridas } from "./jargao.js";

/* Contrato puro da jornada UXG2. O contexto vive apenas na navegação:
   não altera o schema e não finge que o registro está vinculado à
   meta_atividade no banco. */
export function contextoRegistroDaAtividade(metaAtividade, trilha) {
  if (!metaAtividade || !trilha) return null;
  const atividade = trilha.atividadesPorId?.[metaAtividade.atividade_modelo_id];
  if (!atividade) return null;

  return {
    chave: `${metaAtividade.id}:${atividade.id}`,
    metaAtividadeId: metaAtividade.id,
    atividadeModeloId: atividade.id,
    disciplinaCodigo: atividade.disciplina_codigo,
    titulo: atividade.texto,
    questoesSugeridas: questoesSugeridas[atividade.prioridade] ?? 10,
  };
}

/* Objetivos pendentes na MESMA ordem que a lista da tela usa
   (`atividade.ordem`). O embed `meta_atividades(...)` do PostgREST não
   pede ordenação, então a ordem crua do banco não é contrato: sem isto,
   o CTA da missão e o topo da lista podem apontar para alvos
   diferentes. Itens sem atividade na trilha ficam de fora — não há
   contexto honesto a montar para eles. */
export function objetivosPendentesEmOrdem(meta, trilha) {
  return (meta?.meta_atividades ?? [])
    .filter((item) => item?.estado === "pendente")
    .map((item) => ({ item, atividade: trilha?.atividadesPorId?.[item.atividade_modelo_id] }))
    .filter((par) => par.atividade)
    .sort((a, b) => (a.atividade.ordem ?? 0) - (b.atividade.ordem ?? 0))
    .map((par) => par.item);
}

export function primeiroContextoPendente(meta, trilha) {
  return contextoRegistroDaAtividade(objetivosPendentesEmOrdem(meta, trilha)[0], trilha);
}

export function resumoRegistroConfirmado(registro, porCodigo = {}) {
  if (!registro) return null;
  const questoes = Number(registro.questoes) || 0;
  const temAcertos = registro.acertos !== null && registro.acertos !== undefined;
  const acertos = temAcertos ? Number(registro.acertos) : null;
  return {
    materia: porCodigo[registro.disciplina_codigo]?.nome ?? registro.disciplina_codigo ?? "Matéria",
    topico: registro.topico || "Estudo registrado",
    questoes,
    acertos,
    acuracia: temAcertos && questoes > 0 ? Math.round((acertos / questoes) * 100) : null,
    minutos: registro.minutos == null ? null : Number(registro.minutos),
  };
}
