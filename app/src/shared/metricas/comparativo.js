/* ============================================================
   COMPARATIVO E RELATÓRIOS (cliente) — funções PURAS que montam,
   a partir do agregado por aluno (resumoPorAluno, vindo da RPC
   resumo_escola via adaptarResumoEscola) já em memória:
     • a comparação por TURMA,
     • o recorte por CONCURSO,
     • as linhas planas para exportação CSV (aluno/turma/concurso).
   ------------------------------------------------------------
   NÃO faz I/O, NÃO toca banco, NÃO inventa dado: só reorganiza o
   que a tela já recebeu sob a RLS da escola logada. Por isso é
   testável sem banco e não há risco de vazar dado de outra escola
   — o resultado é função apenas dos arrays de entrada.
   ------------------------------------------------------------
   A média de acerto reproduz o padrão das telas: MÉDIA das %
   por aluno (entre os que têm acerto lançado), não a razão global
   de acertos/questões. Mantém coerência com PainelGestao/Turmas.
   ============================================================ */

const arred = (x) => Math.round(x);

// Agrega uma lista de resumos-por-aluno num bloco de indicadores de
// grupo (turma, concurso ou escola inteira). `rs` são objetos no
// formato de adaptarResumoEscola.
export function resumirGrupo(rs) {
  const n = rs.length;
  const comAcc = rs.filter((r) => r.acc != null);
  const comAccSem = rs.filter((r) => r.accSem != null);
  return {
    n,
    questoes: rs.reduce((s, r) => s + (r.q || 0), 0),
    questoes7d: rs.reduce((s, r) => s + (r.qSem || 0), 0),
    minutos: rs.reduce((s, r) => s + (r.minutos || 0), 0),
    minutos7d: rs.reduce((s, r) => s + (r.minSem || 0), 0),
    acerto: comAcc.length ? arred(comAcc.reduce((s, r) => s + r.acc, 0) / comAcc.length) : null,
    acerto7d: comAccSem.length ? arred(comAccSem.reduce((s, r) => s + r.accSem, 0) / comAccSem.length) : null,
    ativos: rs.filter((r) => !r.semAtividade).length,
    semAtividade: rs.filter((r) => r.semAtividade).length,
    semCredencial: rs.filter((r) => r.semCredencial).length,
    metaPendente: rs.filter((r) => r.metaIncompleta).length,
  };
}

// Resumos dos alunos de uma turma (um aluno pode estar em mais de uma
// turma: entra em cada uma — espelha o componente Turmas).
function resumosDaTurma(turmaId, alunos, resumoPorAluno) {
  return alunos
    .filter((a) => (a.alunos_turmas ?? []).some((v) => v.turma_id === turmaId))
    .map((a) => resumoPorAluno[a.id])
    .filter(Boolean);
}

/* Comparação por turma: uma linha por turma + a linha "Sem turma"
   (alunos sem nenhum vínculo de turma), quando houver. Ordenada por
   nome da turma; "Sem turma" sempre por último. */
export function compararTurmas({ alunos, turmas, resumoPorAluno }) {
  const linhas = (turmas ?? []).map((t) => ({
    turmaId: t.id,
    turma: t.nome,
    ...resumirGrupo(resumosDaTurma(t.id, alunos, resumoPorAluno)),
  }));

  const semTurma = (alunos ?? []).filter((a) => !(a.alunos_turmas ?? []).length);
  if (semTurma.length) {
    linhas.push({
      turmaId: null,
      turma: "Sem turma",
      ...resumirGrupo(semTurma.map((a) => resumoPorAluno[a.id]).filter(Boolean)),
    });
  }

  return linhas.sort((a, b) => {
    if (a.turmaId === null) return 1;
    if (b.turmaId === null) return -1;
    return a.turma.localeCompare(b.turma, "pt-BR");
  });
}

/* Recorte por concurso: uma linha por concurso presente entre os
   alunos + "Sem concurso". `concursosPorId` resolve o nome; alunos
   cujo concurso não está no mapa caem em "Sem concurso". */
export function compararConcursos({ alunos, concursosPorId = {}, resumoPorAluno }) {
  const grupos = new Map();
  for (const a of alunos ?? []) {
    const r = resumoPorAluno[a.id];
    if (!r) continue;
    const c = a.concurso_id ? concursosPorId[a.concurso_id] : null;
    const chave = c ? a.concurso_id : "__sem__";
    const nome = c ? (c.nome ?? c.codigo ?? "Concurso") : "Sem concurso";
    if (!grupos.has(chave)) grupos.set(chave, { concursoId: c ? a.concurso_id : null, concurso: nome, rs: [] });
    grupos.get(chave).rs.push(r);
  }
  return [...grupos.values()]
    .map((g) => ({ concursoId: g.concursoId, concurso: g.concurso, ...resumirGrupo(g.rs) }))
    .sort((a, b) => {
      if (a.concursoId === null) return 1;
      if (b.concursoId === null) return -1;
      return a.concurso.localeCompare(b.concurso, "pt-BR");
    });
}

/* ---------- linhas planas para CSV ---------- */

const simNao = (b) => (b ? "Sim" : "Não");
const nomesTurmasDoAluno = (a, turmasPorId) =>
  (a.alunos_turmas ?? [])
    .map((v) => turmasPorId[v.turma_id]?.nome)
    .filter(Boolean)
    .join(" / ");

// Colunas do relatório por ALUNO (detalhado).
export const COLUNAS_ALUNOS = [
  { chave: "nome", rotulo: "Aluno" },
  { chave: "turma", rotulo: "Turma" },
  { chave: "concurso", rotulo: "Concurso" },
  { chave: "questoes", rotulo: "Questões (total)" },
  { chave: "acerto", rotulo: "Acerto % (total)" },
  { chave: "minutos", rotulo: "Minutos (total)" },
  { chave: "dias", rotulo: "Dias (total)" },
  { chave: "questoes7d", rotulo: "Questões (7d)" },
  { chave: "acerto7d", rotulo: "Acerto % (7d)" },
  { chave: "dias7d", rotulo: "Dias (7d)" },
  { chave: "ultimaAtividade", rotulo: "Última atividade" },
  { chave: "metaFeitas", rotulo: "Meta feitas" },
  { chave: "metaConsideradas", rotulo: "Meta consideradas" },
  { chave: "semCredencial", rotulo: "Sem credencial" },
  { chave: "semAtividade", rotulo: "Sem atividade 7d" },
];

export function linhasRelatorioAlunos({ alunos, turmas = [], concursosPorId = {}, resumoPorAluno }) {
  const turmasPorId = Object.fromEntries((turmas ?? []).map((t) => [t.id, t]));
  return (alunos ?? [])
    .map((a) => {
      const r = resumoPorAluno[a.id];
      const c = a.concurso_id ? concursosPorId[a.concurso_id] : null;
      return {
        nome: a.nome,
        turma: nomesTurmasDoAluno(a, turmasPorId),
        concurso: c ? (c.nome ?? c.codigo ?? "") : "",
        questoes: r ? r.q : 0,
        acerto: r ? (r.acc ?? "") : "",
        minutos: r ? r.minutos : 0,
        dias: r ? r.dias : 0,
        questoes7d: r ? r.qSem : 0,
        acerto7d: r ? (r.accSem ?? "") : "",
        dias7d: r ? r.diasSem : 0,
        ultimaAtividade: r?.ultimaAtividade ?? "",
        metaFeitas: r ? r.feitas : 0,
        metaConsideradas: r ? r.consideradas : 0,
        semCredencial: simNao(r ? r.semCredencial : !a.usuario_id),
        semAtividade: simNao(r ? r.semAtividade : true),
      };
    })
    .sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
}

// Colunas comuns aos relatórios de grupo (turma / concurso).
const COLUNAS_GRUPO = [
  { chave: "questoes", rotulo: "Questões (total)" },
  { chave: "questoes7d", rotulo: "Questões (7d)" },
  { chave: "acerto", rotulo: "Acerto médio % (total)" },
  { chave: "acerto7d", rotulo: "Acerto médio % (7d)" },
  { chave: "minutos", rotulo: "Minutos (total)" },
  { chave: "ativos", rotulo: "Ativos (7d)" },
  { chave: "semAtividade", rotulo: "Sem atividade (7d)" },
  { chave: "semCredencial", rotulo: "Sem credencial" },
  { chave: "metaPendente", rotulo: "Meta pendente" },
];

export const COLUNAS_TURMAS = [
  { chave: "turma", rotulo: "Turma" },
  { chave: "n", rotulo: "Alunos" },
  ...COLUNAS_GRUPO,
];

export const COLUNAS_CONCURSOS = [
  { chave: "concurso", rotulo: "Concurso" },
  { chave: "n", rotulo: "Alunos" },
  ...COLUNAS_GRUPO,
];

// As linhas de comparação já estão no formato das colunas de grupo —
// só normaliza o acerto nulo para célula vazia no CSV.
const normalizarGrupo = (linhas) =>
  linhas.map((l) => ({ ...l, acerto: l.acerto ?? "", acerto7d: l.acerto7d ?? "" }));

export function linhasRelatorioTurmas(params) {
  return normalizarGrupo(compararTurmas(params));
}

export function linhasRelatorioConcursos(params) {
  return normalizarGrupo(compararConcursos(params));
}
