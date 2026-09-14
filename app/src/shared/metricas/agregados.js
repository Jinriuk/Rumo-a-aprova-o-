/* Métricas agregadas — um só lugar para as contas que estavam
   copiadas em várias telas (somar questões, acertos, % de acerto,
   minutos e dias distintos). Não muda thresholds nem semântica:
   reproduz exatamente o padrão `cd/cc` (denominador = questões em
   registros COM acerto lançado) usado por Acumulado, Progresso,
   Registrar e pelo ranking da coordenação. */

// Soma um conjunto de registros de estudo. `desde` (YYYY-MM-DD) recorta
// uma janela [desde, hoje]; sem ela, soma tudo. `acertos === null`
// significa "registro sem acerto lançado": entra em questões/dias, mas
// não no cálculo de % de acerto (nem no numerador nem no denominador).
import { cicloEncerrado } from "../regras/regras.js";

export function resumirRegistros(registros, { desde } = {}) {
  let questoes = 0, comAcertoQuestoes = 0, acertos = 0, minutos = 0;
  const datas = new Set();
  for (const r of registros) {
    if (desde && String(r.data) < desde) continue;
    const q = +r.questoes || 0;
    questoes += q;
    minutos += +r.minutos || 0;
    datas.add(String(r.data));
    if (r.acertos !== null && r.acertos !== undefined) {
      comAcertoQuestoes += q;
      acertos += +r.acertos || 0;
    }
  }
  return {
    questoes, comAcertoQuestoes, acertos, minutos,
    dias: datas.size,
    acc: comAcertoQuestoes ? Math.round((acertos / comAcertoQuestoes) * 100) : null,
  };
}

// Converte as linhas da RPC `resumo_escola` (uma por aluno, já somadas
// no banco) no objeto que as telas da coordenação consomem — o mesmo
// formato que o antigo agregarEscola() devolvia, sem varrer registros
// no cliente. `alunosPorId` liga cada linha ao aluno carregado.
//
// T31: `semAtividade` cruza duas vias que resumo_escola (migration
// 0016) não conhece uma da outra — dias_7d (atividade) e estado_ciclo
// (migration 0049, Onda 3). Um aluno cujo ciclo já encerrou não tem
// mais missão: `diasSem === 0` sozinho o marcaria "sem atividade" para
// sempre, um alerta que nunca faz sentido resolver. `semanasPorTrilha`
// (id da trilha → semanas ordenadas) é opcional — sem ele, o
// comportamento é exatamente o de antes (só dias_7d).
export function adaptarResumoEscola(linhas, alunosPorId, semanasPorTrilha = {}) {
  return (linhas ?? [])
    .map((l) => {
      const aluno = alunosPorId[l.aluno_id];
      if (!aluno) return null;
      const caGeral = Number(l.ca_questoes_total) || 0;
      const caSem = Number(l.ca_questoes_7d) || 0;
      const feitas = Number(l.meta_feitas) || 0;
      const consideradas = Number(l.meta_consideradas) || 0;
      const diasSem = Number(l.dias_7d) || 0;
      const cicloDoAluno = semanasPorTrilha[aluno.trilha_id] ?? [];
      return {
        aluno,
        // geral (toda a vida do aluno)
        q: Number(l.questoes_total) || 0,
        acc: caGeral ? Math.round(((Number(l.acertos_total) || 0) / caGeral) * 100) : null,
        minutos: Number(l.minutos_total) || 0,
        dias: Number(l.dias_total) || 0,
        // últimos 7 dias
        qSem: Number(l.questoes_7d) || 0,
        accSem: caSem ? Math.round(((Number(l.acertos_7d) || 0) / caSem) * 100) : null,
        minSem: Number(l.minutos_7d) || 0,
        diasSem,
        ultimaAtividade: l.ultima_atividade ?? null,
        // meta ativa da semana
        feitas, consideradas,
        metaPct: consideradas ? Math.round((feitas / consideradas) * 100) : null,
        metaIncompleta: consideradas > 0 && feitas < consideradas,
        // sinais de risco / operação
        semCredencial: !aluno.usuario_id,
        semAtividade: diasSem === 0 && !cicloEncerrado(cicloDoAluno),
        // T31 (Bloco 3): exposto à parte de semAtividade — quem monta uma
        // proporção "em risco" precisa excluir ciclo encerrado tanto do
        // numerador quanto do DENOMINADOR (a turma toda formada não pode
        // diluir a proporção dos alunos que ainda estão em ciclo ativo).
        cicloEncerrado: cicloEncerrado(cicloDoAluno),
      };
    })
    .filter(Boolean);
}
