import { questoesSugeridas } from "./jargao.js";

const ROTULO_MATERIA = { mat: "Matemática", por: "Português", ing: "Inglês", fis: "Física", qui: "Química", bio: "Biologia", his: "História", geo: "Geografia", red: "Redação", soc: "Estudos Sociais" };

/* Raio-x, mudança 8: nome da matéria, nunca o código cru ("DIR_ADM").
   `nomes` = trilha + catálogo `materias` (VisaoEstudo); o mapa fixo cobre
   os concursos antigos quando o catálogo não respondeu. */
export function nomeDaMateria(codigo, nomes = null) {
  return nomes?.[codigo] ?? ROTULO_MATERIA[codigo] ?? "Outra matéria";
}

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
    // o mesmo texto que a tarefa mostra: "Estudo:", nunca "Missão:" (mudança 3)
    titulo: textoDaTarefa(atividade.texto),
    questoesSugeridas: questoesSugeridas[atividade.prioridade] ?? 10,
  };
}

/* P0.4 (0064): contexto de registro a partir de uma MISSÃO da fila
   (filaDeMissoes). `tipo` é 'missao' (praticar a da vez: conta para
   ela) ou 'revisao' (revisar uma já iniciada: fica no assunto dela e
   não avança a fila). O servidor confere tudo de novo; isto só diz ao
   formulário o que mandar. Sem metaAtividadeId: praticar missão não
   fecha objetivo da semana. */
export function contextoRegistroDaMissao(missao, tipo = "missao") {
  if (!missao?.id || !missao?.materia_codigo) return null;
  if (tipo !== "missao" && tipo !== "revisao") return null;
  const falta = Math.max(0, (missao.meta_questoes ?? 0) - (missao.questoes ?? 0));
  return {
    chave: `${tipo}:${missao.id}`,
    tipo,
    missaoId: missao.id,
    disciplinaCodigo: missao.materia_codigo,
    titulo: missao.nome,
    questoesSugeridas: tipo === "missao" && falta > 0 ? falta : null,
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

/* Raio-x, mudança 3: "missão" fica só para a unidade de assunto com
   questões. O item da semana que o conteúdo escreve como "Missão: …" é um
   estudo. Só a apresentação muda; o texto editorial no banco fica.
   O título é a primeira frase (o resto é a orientação de leitura e
   prática, que continua no Plano). */
export function textoDaTarefa(texto) {
  return String(texto ?? "").replace(/^Missão:/, "Estudo:");
}

export function tituloDaTarefa(texto) {
  return textoDaTarefa(texto).split(/\.\s/)[0].replace(/\.$/, "");
}

/* Raio-x fase 2 (decisão de 18/10): a ação única do Hoje.
   A missão da vez é a missão atual (ou a próxima a começar) da matéria da
   primeira tarefa pendente da semana que tem missão; assim o Hoje anda com
   a semana. Sem nenhuma, a primeira da fila. Sem missão nenhuma (fila
   vazia ou toda concluída), a própria tarefa pendente vira a ação, pelo
   registro. Sem tarefa pendente, registro livre.
   `fila` = filaDeMissoes(); `registraveis` = Set das matérias da trilha
   (matéria fora dela é acompanhada pela coordenação, não pelo botão). */
export function acaoDaVez({ fila = [], meta = null, trilha = null, registraveis = null } = {}) {
  const pode = (cod) => !registraveis || registraveis.size === 0 || registraveis.has(cod);
  const daVez = (grupo) => (grupo && pode(grupo.materia_codigo)
    ? grupo.missoes.find((mi) => mi.estado === "atual" || mi.proxima) ?? null
    : null);
  const porMateria = new Map(fila.map((g) => [g.materia_codigo, g]));
  const pendentes = objetivosPendentesEmOrdem(meta, trilha);
  for (const item of pendentes) {
    const missao = daVez(porMateria.get(trilha.atividadesPorId[item.atividade_modelo_id].disciplina_codigo));
    if (missao) return { tipo: "missao", missao };
  }
  for (const grupo of fila) {
    const missao = daVez(grupo);
    if (missao) return { tipo: "missao", missao };
  }
  if (pendentes.length) {
    const tarefa = pendentes[0];
    return { tipo: "tarefa", tarefa, atividade: trilha.atividadesPorId[tarefa.atividade_modelo_id] };
  }
  return { tipo: "livre" };
}

/* "Semana 1 de 12 · 2 de 3 tarefas". A posição é a da semana na trilha
   (a mesma conta do Plano); adiadas saem do total, como no cartão antigo. */
export function resumoDaSemana(meta, trilha) {
  if (!meta || !trilha?.semanas?.length) return null;
  const total = trilha.semanas.length;
  const numero = Math.max(1, trilha.semanas.findIndex((s) => s.numero === meta.semana_numero) + 1);
  const itens = meta.meta_atividades ?? [];
  const feitas = itens.filter((x) => x.estado === "concluida").length;
  const consideradas = itens.filter((x) => x.estado !== "ignorada").length;
  return { numero, total, feitas, consideradas, texto: `Semana ${numero} de ${total} · ${feitas} de ${consideradas} ${consideradas === 1 ? "tarefa" : "tarefas"}` };
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
    materia: porCodigo[registro.disciplina_codigo]?.nome ?? "Matéria",
    topico: registro.topico || "Estudo registrado",
    questoes,
    acertos,
    acuracia: temAcertos && questoes > 0 ? Math.round((acertos / questoes) * 100) : null,
    minutos: registro.minutos == null ? null : Number(registro.minutos),
  };
}
