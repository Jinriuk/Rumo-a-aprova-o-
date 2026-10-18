/* ============================================================
   MISSÕES POR SEMANA (raio-x fase 2, desenho aprovado em 18/10)
   ------------------------------------------------------------
   Lógica pura, sem banco e sem UI. Junta três coisas:
     - a fila do motor por matéria (filaDeMissoes, missoes.js): estado de
       cada missão (concluída, atual, a seguir) e o progresso;
     - a semana de cada missão no plano do concurso
       (trilha_plano_missoes.semana_sugerida);
     - o catálogo, para mostrar também a missão que fica fora da fila
       (sem meta de questões, acompanhada à mão: "manual").
   Regras (decisões de 18/10):
     - a semana das missões é a do RITMO DO ALUNO: a primeira semana que
       ainda tem missão a fazer. O aluno que entra com a trilha andando
       começa pela semana 1 das missões, sem botão que o servidor recuse;
     - a missão de agora é a primeira não concluída dessa semana (ordem do
       catálogo), preferindo a que o motor deixa começar;
     - só a missão da vez de cada matéria (atual, ou a próxima a começar)
       tem botão: as outras o servidor recusa ("fora_da_vez", 0065);
     - matéria fora das que o aluno registra na trilha: a missão fica com a
       coordenação, como no painel antigo (EST1-A5), sem botão e sem contar.
   Testado em tests/raio-x-f2-missoes-semana.test.mjs.
   ============================================================ */

/* Um concurso pode ter vários planos (anual, intensiva…) e a trilha do
   aluno não diz qual é o dele. Vale o plano com mais missões ligadas a
   semanas; no empate, o de menor ordem. No PMERJ há um só. */
export function escolherPlano(vinculos = []) {
  const porPlano = new Map();
  for (const v of vinculos) {
    if (!v?.plano_id || !Number.isFinite(v.semana)) continue;
    const p = porPlano.get(v.plano_id) ?? { plano_id: v.plano_id, ordem: v.plano_ordem ?? 0, n: 0 };
    p.n += 1;
    porPlano.set(v.plano_id, p);
  }
  const ordenados = [...porPlano.values()].sort((a, b) => b.n - a.n || a.ordem - b.ordem);
  return ordenados[0]?.plano_id ?? null;
}

export function semanaPorMissao(vinculos = []) {
  const plano = escolherPlano(vinculos);
  const mapa = new Map();
  for (const v of vinculos) {
    if (v.plano_id === plano && Number.isFinite(v.semana)) mapa.set(v.missao_id, { semana: v.semana, ordem: v.ordem ?? 0 });
  }
  return mapa;
}

const fazer = (l) => l.estado === "atual" || l.estado === "a_seguir";

/* Linhas das missões, com semana. `fila` = filaDeMissoes(); `catalogo` =
   carregarMissoes(examTag); `ajustesEscola` = carregarMissoesEscola;
   `vinculos` = carregarSemanasDasMissoes; `materiasDaTrilha` = códigos que
   o aluno registra (vazio = sem filtro). Missão desativada pela escola e
   não concluída some. Devolve { linhas, porSemana, semSemana, semanaAtual,
   missaoDeAgora, comMeta }. */
export function montarMissoesPorSemana({ fila = [], catalogo = [], ajustesEscola = [], vinculos = [], totalSemanas = null, materiasDaTrilha = [] } = {}) {
  const daFila = new Map(fila.flatMap((g) => g.missoes).map((mi) => [mi.id, mi]));
  const ajuste = new Map(ajustesEscola.map((a) => [a.missao_id, a]));
  const semanas = semanaPorMissao(vinculos);
  const registraveis = new Set(materiasDaTrilha);
  const naTrilha = (cod) => registraveis.size === 0 || !cod || registraveis.has(cod);

  const linhas = [];
  for (const m of catalogo) {
    const naFila = daFila.get(m.id);
    if (!naFila && ajuste.get(m.id)?.ativa === false) continue;
    const vinc = semanas.get(m.id);
    const comCoordenacao = naFila && naFila.estado !== "concluida" && !naTrilha(naFila.materia_codigo);
    const base = comCoordenacao ? { ...naFila, estado: "manual", proxima: false, coordenacao: true } : naFila ?? {
      id: m.id, nome: m.nome, materia_codigo: m.materia_codigo, estado: "manual",
      meta_questoes: null, questoes: 0, pct: 0, proxima: false,
    };
    linhas.push({ ...base, semana: vinc?.semana ?? null, ordem: m.ordem ?? vinc?.ordem ?? 0 });
  }
  linhas.sort((a, b) => (a.semana ?? Infinity) - (b.semana ?? Infinity) || a.ordem - b.ordem || String(a.id).localeCompare(String(b.id)));

  const dentro = (l) => l.semana != null && (totalSemanas == null || l.semana <= totalSemanas);
  const porSemana = new Map();
  const semSemana = [];
  for (const l of linhas) {
    if (!dentro(l)) { semSemana.push(l); continue; }
    if (!porSemana.has(l.semana)) porSemana.set(l.semana, []);
    porSemana.get(l.semana).push(l);
  }

  const semanaAtual = linhas.filter((l) => dentro(l) && fazer(l)).reduce((min, l) => (min == null || l.semana < min ? l.semana : min), null);
  // concurso sem missão ligada a semana (ou com as das semanas já feitas):
  // a de agora sai das que sobraram fora das semanas
  const daSemana = semanaAtual == null ? semSemana.filter(fazer) : porSemana.get(semanaAtual).filter(fazer);
  const missaoDeAgora = daSemana.find(podeComecar) ?? daSemana[0] ?? null;
  // só missão manual (sem meta de questões) ou nenhuma: nada a contar
  const comMeta = linhas.some((l) => l.estado !== "manual");
  return { linhas, porSemana, semSemana, semanaAtual, missaoDeAgora, comMeta };
}

// A missão que o motor deixa praticar agora (a da vez na matéria).
export function podeComecar(linha) {
  return !!linha && (linha.estado === "atual" || !!linha.proxima);
}

// "1 de 6 missões": as concluídas sobre as que contam (manual fica fora).
// Semana só de missões manuais (simulado): "4 missões com a coordenação".
export function resumoMissoesDaSemana(linhas = []) {
  const contam = linhas.filter((l) => l.estado !== "manual");
  const feitas = contam.filter((l) => l.estado === "concluida").length;
  const plural = (n) => (n === 1 ? "missão" : "missões");
  const texto = contam.length || !linhas.length
    ? `${feitas} de ${contam.length} ${plural(contam.length)}`
    : `${linhas.length} ${plural(linhas.length)} com a coordenação`;
  return { feitas, total: contam.length, texto };
}

// "Direito Administrativo" → "Administrativo" na linha curta do desenho.
export function nomeCurtoMateria(nome) {
  const curto = String(nome ?? "").replace(/^Direito\s+(d[aeo]s?\s+)?/i, "");
  return curto ? curto.charAt(0).toUpperCase() + curto.slice(1) : nome;
}
