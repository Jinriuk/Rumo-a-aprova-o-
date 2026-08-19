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

export function primeiroContextoPendente(meta, trilha) {
  const alvo = (meta?.meta_atividades ?? []).find((item) => item.estado === "pendente");
  return contextoRegistroDaAtividade(alvo, trilha);
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
