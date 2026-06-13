/* ============================================================
   FUNDAÇÃO PEDAGÓGICA CONFIGURÁVEL (Fase 15.1) — lógica pura.
   ------------------------------------------------------------
   A unidade pedagógica real é o CONCURSO, etiquetado por
   `exam_tag` (= concursos.codigo). "Turma comercial" é só rótulo.
   Este módulo NÃO fala com o banco: só traduz e combina config.
   A segurança continua na RLS; aqui é decisão de produto.

   O que NÃO entra nesta subfase (vem nas 15.4+): missões, XP,
   patentes, conquistas, motor adaptativo, recorrência real.
   ============================================================ */

// Status do dado pedagógico — preservado de ponta a ponta.
export const STATUS_DADO = {
  OFICIAL: "oficial",
  INFERENCIA: "inferencia",
  VALIDAR: "validar",
};

export const ROTULO_STATUS = {
  oficial: "Oficial",
  inferencia: "Inferência",
  validar: "Validar",
};

// Modelos de eliminação (doc §6.2). Absoluto → alvo numérico claro;
// mediana → piso RELATIVO à turma do ano, sem alvo absoluto oficial.
export const ELIMINACAO = {
  absoluto_50: { rotulo: "50% por disciplina", tipo: "absoluto", descricao: "Elimina quem fica abaixo de 50% em qualquer disciplina (Marinha)." },
  absoluto_5: { rotulo: "5,0/10 por disciplina", tipo: "absoluto", descricao: "Elimina quem fica abaixo de 5,0 em qualquer disciplina (FAB)." },
  mediana: { rotulo: "Mediana por parte", tipo: "relativo", descricao: "Piso relativo: é preciso ficar acima da mediana da turma em cada parte (Exército)." },
};

// Papel da redação (doc §1.2): bifurca a arquitetura, não é detalhe.
export const REDACAO = {
  eliminatoria: { rotulo: "Eliminatória", classifica: false, elimina: true, descricao: "Barreira: reprova abaixo do mínimo, mas não soma na classificação." },
  eliminatoria_classificatoria: { rotulo: "Eliminatória + classificatória", classifica: true, elimina: true, descricao: "Reprova abaixo do mínimo E soma pontos na classificação." },
  ausente: { rotulo: "Sem redação", classifica: false, elimina: false, descricao: "O concurso não cobra redação." },
};

export function rotuloEliminacao(modelo) {
  return ELIMINACAO[modelo]?.rotulo ?? "—";
}

export function rotuloRedacao(papel) {
  return REDACAO[papel]?.rotulo ?? "—";
}

export function eliminacaoEhRelativa(modelo) {
  return ELIMINACAO[modelo]?.tipo === "relativo";
}

/* ---------- exam_tag ---------- */

// O alvo pedagógico ATIVO do aluno é o concurso de `concurso_id`
// (decisão D2: um por vez). Devolve o exam_tag (= codigo) ou null.
export function examTagAtivo(aluno, concursosPorId = {}) {
  if (!aluno?.concurso_id) return null;
  return concursosPorId[aluno.concurso_id]?.codigo ?? null;
}

// Concursos que uma turma comercial cobre, na ordem do catálogo.
export function concursosDaTurma(turmaComercial) {
  if (!turmaComercial?.concursos) return [];
  return [...turmaComercial.concursos].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

// Um alvo pedagógico só é válido se o concurso pertence à turma
// comercial do aluno (ou se o aluno não tem turma comercial — então
// qualquer concurso cadastrado vale). Não mistura regra de concurso.
export function alvoPermitido(examTag, turmaComercial) {
  const cobertos = concursosDaTurma(turmaComercial).map((c) => c.codigo ?? c.exam_tag);
  if (!cobertos.length) return true;
  return cobertos.includes(examTag);
}

/* ---------- config oficial × config escola ---------- */

/* Combina a referência OFICIAL com o override da ESCOLA por chave.
   Devolve uma lista por chave com a origem do valor efetivo e, quando
   a escola sobrescreve divergindo, o flag `desvioDoEdital`. Nada da
   referência oficial é escondido: o valor oficial viaja junto. */
export function resolverConfig(oficial = [], escola = []) {
  const porChaveOficial = new Map(oficial.map((o) => [o.chave, o]));
  const porChaveEscola = new Map(escola.map((e) => [e.chave, e]));
  const chaves = new Set([...porChaveOficial.keys(), ...porChaveEscola.keys()]);

  return [...chaves].sort().map((chave) => {
    const o = porChaveOficial.get(chave) ?? null;
    const e = porChaveEscola.get(chave) ?? null;
    const temOverride = !!e;
    return {
      chave,
      valorEfetivo: temOverride ? e.valor : o?.valor ?? null,
      valorOficial: o?.valor ?? null,
      origem: temOverride ? "escola" : "oficial",
      // status só faz sentido na referência oficial; override é decisão da escola
      statusDado: o?.status_dado ?? null,
      fonte: o?.fonte ?? null,
      desvioDoEdital: temOverride ? !!e.desvio_do_edital : false,
      temReferenciaOficial: !!o,
    };
  });
}

// Só os pontos em que a escola está divergindo do edital — alimenta
// o aviso "trava advisory" (decisão D4): liberdade com transparência.
export function desviosDoEdital(oficial = [], escola = []) {
  return resolverConfig(oficial, escola).filter((c) => c.desvioDoEdital);
}
