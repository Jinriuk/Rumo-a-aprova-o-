// Gera o calendário semanal e o catálogo ampliado de missões da EsPCEx.
// As fontes JSON são versionadas; o SQL gerado continua executável por psql puro.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
export const FONTE_REL = "supabase/seed/trilha-espcex-v1.json";
export const CATALOGO_REL = "supabase/seed/espcex-ped2-r3-v1.json";
export const TAGS_2024_REL = "supabase/seed/espcex-2024-tags-v1.json";
export const DESTINO_REL = "supabase/seed/20_trilha_espcex.sql";
const FONTE = join(RAIZ, FONTE_REL);
const CATALOGO = join(RAIZ, CATALOGO_REL);
const TAGS_2024 = join(RAIZ, TAGS_2024_REL);
export const DESTINO = join(RAIZ, DESTINO_REL);

const MATERIAS_PROVA = ["por", "red", "fis", "qui", "mat", "geo", "his", "ing"];
const TIPOS_PLANO = ["anual", "semestral", "intensiva", "reta_final"];
const PRIORIDADES = new Set(["F", "P", "X"]);

function uid(nome) {
  const h = createHash("md5").update(`rumo-aprovacao:${nome}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const sql = (valor) => valor == null ? "null" : `'${String(valor).replaceAll("'", "''")}'`;
const sqlValor = (valor) => typeof valor === "number" ? String(valor) : sql(valor);
const valoresSql = (linhas) => linhas.map((campos) => `  (${campos.map(sqlValor).join(", ")})`).join(",\n");
const dataUtc = (valor) => new Date(`${valor}T00:00:00Z`);
const somarDias = (data, dias) => new Date(data.getTime() + dias * 86_400_000);
const iso = (data) => data.toISOString().slice(0, 10);

export function carregarFontes() {
  const trilha = JSON.parse(readFileSync(FONTE, "utf8"));
  const catalogo = JSON.parse(readFileSync(CATALOGO, "utf8"));
  const tags2024 = JSON.parse(readFileSync(TAGS_2024, "utf8"));
  return {
    trilha,
    conteudo: {
      ...catalogo,
      provas: [...(tags2024.provas ?? []), ...(catalogo.provas ?? [])],
    },
  };
}

function prioridadeDoAssunto(materia, ocorrencias) {
  if (materia === "red") return "F";
  if (ocorrencias >= 4 || (["mat", "por", "fis", "ing"].includes(materia) && ocorrencias >= 3)) return "F";
  if (ocorrencias > 0) return "P";
  return "X";
}

export function montarTarefas(trilha, conteudo) {
  const deslocamentos = Object.fromEntries(trilha.disciplinas.map((d) => [d.codigo, d.deslocamentoSemana]));
  const ocorrencias = new Map();
  for (const prova of conteudo.provas ?? []) {
    for (const questao of prova.questoes ?? []) {
      const chave = `${questao.materia}|${questao.assunto}`;
      ocorrencias.set(chave, (ocorrencias.get(chave) ?? 0) + 1);
    }
  }

  const tarefas = conteudo.catalogo.map((assunto) => {
    const semana = 1 + ((assunto.ordem + deslocamentos[assunto.materia]) % trilha.semanasConteudo);
    const incidencia = ocorrencias.get(`${assunto.materia}|${assunto.nome}`) ?? 0;
    return {
      semana,
      s: assunto.materia,
      p: prioridadeDoAssunto(assunto.materia, incidencia),
      t: assunto.materia === "red"
        ? `Estudar ${assunto.nome}: técnica, produção e correção conforme o edital vigente`
        : `Estudar ${assunto.nome}: teoria, revisão ativa e questões 2024–2025`,
      assunto: assunto.nome,
      incidencia,
      tipo: "programa",
    };
  });

  for (const rotina of trilha.rotinas) {
    for (const semana of rotina.semanas) {
      tarefas.push({ semana, s: rotina.s, p: rotina.p, t: rotina.t, assunto: null, incidencia: null, tipo: "rotina" });
    }
  }

  const ordemMateria = Object.fromEntries(trilha.disciplinas.map((d, i) => [d.codigo, i]));
  const ordemPrioridade = { F: 0, P: 1, X: 2 };
  return tarefas.sort((a, b) => a.semana - b.semana
    || ordemPrioridade[a.p] - ordemPrioridade[b.p]
    || ordemMateria[a.s] - ordemMateria[b.s]
    || a.t.localeCompare(b.t, "pt-BR"));
}

export function validarFonte(trilha, conteudo) {
  const erros = [];
  if (trilha.nicho !== "espcex" || trilha.examTag !== "espcex") erros.push("nicho/examTag devem ser espcex");
  if (trilha.versao !== 1) erros.push("versão esperada da trilha: 1");
  if (trilha.statusDado !== "inferencia") erros.push("o desenho pedagógico deve ser rotulado como inferência");
  if (trilha.semanas?.length !== 9) erros.push(`esperadas 9 semanas, encontradas ${trilha.semanas?.length ?? 0}`);
  if (trilha.semanasConteudo !== 7) erros.push("o fechamento do programa deve ocupar as 7 primeiras semanas");

  for (let i = 0; i < (trilha.semanas?.length ?? 0); i += 1) {
    const semana = trilha.semanas[i];
    if (semana.n !== i + 1) erros.push(`semana fora de ordem: ${semana.n}`);
    if (iso(somarDias(dataUtc(semana.inicio), 6)) !== semana.fim) erros.push(`semana ${semana.n} não tem 7 dias`);
    if (i > 0 && iso(somarDias(dataUtc(trilha.semanas[i - 1].fim), 1)) !== semana.inicio) {
      erros.push(`lacuna entre as semanas ${i} e ${semana.n}`);
    }
    if (!Number.isInteger(semana.metaQuestoes) || semana.metaQuestoes <= 0) erros.push(`meta inválida na semana ${semana.n}`);
  }
  const ultima = trilha.semanas?.at(-1);
  for (const [dia, data] of Object.entries(trilha.provas ?? {})) {
    if (!ultima || data < ultima.inicio || data > ultima.fim) erros.push(`${dia} (${data}) deve cair na semana 9`);
  }
  if (trilha.provas?.dia1 !== "2026-09-12" || trilha.provas?.dia2 !== "2026-09-13") {
    erros.push("datas oficiais esperadas: 12 e 13/09/2026");
  }

  const codigos = trilha.disciplinas?.map((d) => d.codigo) ?? [];
  const esperadas = [...MATERIAS_PROVA, "prov"];
  if (new Set(codigos).size !== 9 || esperadas.some((codigo) => !codigos.includes(codigo))) {
    erros.push("a trilha deve ter as 8 áreas da prova e a disciplina operacional prov");
  }
  for (const rotina of trilha.rotinas ?? []) {
    if (!codigos.includes(rotina.s)) erros.push(`rotina usa disciplina inexistente: ${rotina.s}`);
    if (!PRIORIDADES.has(rotina.p)) erros.push(`rotina usa prioridade inválida: ${rotina.p}`);
    if (!rotina.t?.trim()) erros.push("rotina sem texto");
    for (const semana of rotina.semanas ?? []) {
      if (semana < 1 || semana > 9) erros.push(`rotina fora do calendário: semana ${semana}`);
    }
  }

  const catalogo = conteudo.catalogo ?? [];
  if (catalogo.length !== 80) erros.push(`programa deve ter 80 assuntos, encontrou ${catalogo.length}`);
  const chavesCatalogo = new Set(catalogo.map((a) => `${a.materia}|${a.nome}`));
  const tarefas = montarTarefas(trilha, conteudo);
  const tarefasPrograma = tarefas.filter((t) => t.tipo === "programa");
  const cobertos = new Set(tarefasPrograma.map((t) => `${t.s}|${t.assunto}`));
  if (tarefasPrograma.length !== 80 || cobertos.size !== 80) erros.push("cada assunto do programa deve aparecer exatamente uma vez no fechamento inicial");
  for (const chave of chavesCatalogo) if (!cobertos.has(chave)) erros.push(`assunto fora do calendário: ${chave}`);
  for (const semana of trilha.semanas ?? []) {
    if (!tarefas.some((t) => t.semana === semana.n)) erros.push(`semana ${semana.n} sem atividades`);
  }

  const planos = trilha.planos ?? [];
  if (planos.length !== 4 || TIPOS_PLANO.some((tipo) => !planos.some((p) => p.tipo === tipo))) {
    erros.push("devem existir os quatro horizontes de plano da EsPCEx");
  }

  const missoes = trilha.missoes ?? [];
  if (missoes.length !== 24) erros.push(`esperadas 24 missões, encontradas ${missoes.length}`);
  const nomesMissao = new Set();
  for (const missao of missoes) {
    const chave = `${missao.materia}|${missao.assunto}`;
    if (!chavesCatalogo.has(chave)) erros.push(`missão aponta para assunto inexistente: ${chave}`);
    if (nomesMissao.has(missao.nome)) erros.push(`missão duplicada: ${missao.nome}`);
    nomesMissao.add(missao.nome);
    if (!missao.objetivo?.trim()) erros.push(`missão sem objetivo: ${missao.nome}`);
    if (missao.qtd != null && (!Number.isInteger(missao.qtd) || missao.qtd <= 0)) erros.push(`meta inválida: ${missao.nome}`);
    if (missao.qtd != null && (!Number.isInteger(missao.acuracia) || missao.acuracia < 0 || missao.acuracia > 100)) {
      erros.push(`acurácia inválida: ${missao.nome}`);
    }
  }
  for (const materia of MATERIAS_PROVA) {
    const quantidade = missoes.filter((m) => m.materia === materia).length;
    if (quantidade !== 3) erros.push(`esperadas 3 missões de ${materia}, encontradas ${quantidade}`);
  }
  return erros;
}

function dadosMissoes(trilha) {
  return trilha.missoes.map((m, ordem) => {
    const id = m.id ?? uid(`missao:${trilha.nicho}:v${trilha.versao}:${m.materia}:${m.nome}`);
    const criterio = m.qtd == null
      ? "Acompanhamento manual: entregar produções corrigidas até cumprir o objetivo."
      : `≥${m.qtd} questões e ≥${m.acuracia}% de acurácia no recorte.`;
    const excelencia = m.qtd == null
      ? "Duas produções consecutivas aptas, sem desvio eliminatório."
      : `≥${Math.min(95, m.acuracia + 10)}% nas últimas 20 questões.`;
    const xp = m.prioridade === "alta" ? 90 : m.prioridade === "media" ? 65 : 45;
    return { ...m, id, ordem, criterio, excelencia, xp };
  });
}

export function gerarSql(trilha, conteudo) {
  const erros = validarFonte(trilha, conteudo);
  if (erros.length) throw new Error(`Trilha EsPCEx inválida:\n- ${erros.join("\n- ")}`);

  const trilhaId = uid(`trilha:${trilha.nicho}:v${trilha.versao}`);
  const tarefas = montarTarefas(trilha, conteudo);
  const missoes = dadosMissoes(trilha);
  const trilhaIdSql = `(select id from trilhas where nicho = ${sql(trilha.nicho)} and versao = ${trilha.versao})`;
  const origem = `${trilha.fontePrograma}; desenho pedagógico autoral; recorrência medida nos cadernos oficiais 2024–2025`;

  const disciplinas = trilha.disciplinas.map((d, ordem) => [
    uid(`disc:${trilha.nicho}:v${trilha.versao}:${d.codigo}`), d.codigo, d.nome, d.abrev, d.cor, ordem,
  ]);
  const semanas = trilha.semanas.map((s) => [
    uid(`sem:${trilha.nicho}:v${trilha.versao}:${s.n}`), s.n, s.inicio, s.fim, s.foco, s.simulado, s.metaQuestoes,
  ]);
  const atividades = tarefas.map((t, ordem) => [
    uid(`atv:${trilha.nicho}:v${trilha.versao}:${t.semana}:${ordem}:${t.s}:${t.t}`),
    t.semana, t.s, t.p, t.t, ordem,
  ]);
  const planos = trilha.planos.map((p) => [trilha.examTag, p.tipo, p.nome, p.descricao, trilha.statusDado, p.ordem]);
  const linhasMissoes = missoes.map((m) => [
    m.id, m.materia, m.assunto, m.nivel, m.nome, m.objetivo, m.prioridade, m.qtd, m.tempo,
    m.criterio, m.excelencia, m.xp, origem, trilha.statusDado, m.ordem, m.qtd, m.acuracia,
  ]);
  const idsMissoes = missoes.map((m) => [m.id, m.ordem]);

  return `-- ============================================================
-- CALENDÁRIO E MISSÕES — ESPCEX 2026 (conteúdo global)
-- GERADO por scripts/gerar-seed-trilha-espcex.mjs a partir de
-- ${FONTE_REL}; programa em ${CATALOGO_REL}. NÃO editar à mão.
-- Desenho pedagógico = inferência; datas/programa = edital vigente.
-- ============================================================

insert into trilhas (id, nicho, nome, versao, publicada)
values (${sql(trilhaId)}, ${sql(trilha.nicho)}, ${sql(trilha.nome)}, ${trilha.versao}, true)
on conflict (nicho, versao) do update set
  nome = excluded.nome,
  publicada = excluded.publicada;

insert into disciplinas (id, trilha_id, codigo, nome, abrev, cor, ordem)
select d.id::uuid, ${trilhaIdSql}, d.codigo, d.nome, d.abrev, d.cor, d.ordem
  from (values
${valoresSql(disciplinas)}
  ) as d(id, codigo, nome, abrev, cor, ordem)
on conflict (trilha_id, codigo) do update set
  nome = excluded.nome,
  abrev = excluded.abrev,
  cor = excluded.cor,
  ordem = excluded.ordem;

insert into trilha_semanas (id, trilha_id, numero, inicio, fim, foco, simulado, meta_questoes)
select s.id::uuid, ${trilhaIdSql}, s.numero, s.inicio::date, s.fim::date, s.foco, s.simulado, s.meta_questoes
  from (values
${valoresSql(semanas)}
  ) as s(id, numero, inicio, fim, foco, simulado, meta_questoes)
on conflict (trilha_id, numero) do update set
  inicio = excluded.inicio,
  fim = excluded.fim,
  foco = excluded.foco,
  simulado = excluded.simulado,
  meta_questoes = excluded.meta_questoes;

delete from atividades_modelo where trilha_id = ${trilhaIdSql};

insert into atividades_modelo (id, trilha_id, semana_numero, disciplina_codigo, prioridade, texto, ordem)
select a.id::uuid, ${trilhaIdSql}, a.semana_numero, a.disciplina_codigo, a.prioridade, a.texto, a.ordem
  from (values
${valoresSql(atividades)}
  ) as a(id, semana_numero, disciplina_codigo, prioridade, texto, ordem);

insert into trilha_planos (exam_tag, tipo, nome, descricao, status_dado, ordem)
values
${valoresSql(planos)}
on conflict (exam_tag, tipo) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  status_dado = excluded.status_dado,
  ordem = excluded.ordem;

with dados (id, materia_codigo, assunto_nome, nivel, nome, objetivo, prioridade,
            qtd_questoes_sugerida, tempo_estimado_min, criterio_conclusao,
            criterio_excelencia, xp_sugerido, origem, status_dado, ordem,
            meta_questoes, meta_acuracia) as (
  values
${valoresSql(linhasMissoes)}
)
insert into missoes
  (id, exam_tag, materia_codigo, assunto_id, nivel, nome, objetivo, prioridade,
   qtd_questoes_sugerida, tempo_estimado_min, criterio_conclusao,
   criterio_excelencia, xp_sugerido, origem, status_dado, ordem,
   meta_questoes, meta_acuracia)
select d.id::uuid, 'espcex', d.materia_codigo, a.id, d.nivel, d.nome, d.objetivo,
       d.prioridade, d.qtd_questoes_sugerida, d.tempo_estimado_min,
       d.criterio_conclusao, d.criterio_excelencia, d.xp_sugerido, d.origem,
       d.status_dado, d.ordem, d.meta_questoes, d.meta_acuracia
  from dados d
  join assuntos a
    on a.exam_tag = 'espcex'
   and a.materia_codigo = d.materia_codigo
   and a.nome = d.assunto_nome
on conflict (id) do update set
  materia_codigo = excluded.materia_codigo,
  assunto_id = excluded.assunto_id,
  nivel = excluded.nivel,
  nome = excluded.nome,
  objetivo = excluded.objetivo,
  prioridade = excluded.prioridade,
  qtd_questoes_sugerida = excluded.qtd_questoes_sugerida,
  tempo_estimado_min = excluded.tempo_estimado_min,
  criterio_conclusao = excluded.criterio_conclusao,
  criterio_excelencia = excluded.criterio_excelencia,
  xp_sugerido = excluded.xp_sugerido,
  origem = excluded.origem,
  status_dado = excluded.status_dado,
  ordem = excluded.ordem,
  meta_questoes = excluded.meta_questoes,
  meta_acuracia = excluded.meta_acuracia;

with missao_fonte (id, ordem) as (
  values
${valoresSql(idsMissoes)}
), planos_fonte as (
  select id, tipo from trilha_planos where exam_tag = 'espcex'
)
insert into trilha_plano_missoes (plano_id, missao_id, fase, semana_sugerida, ordem)
select p.id, m.id::uuid,
       case p.tipo
         when 'anual' then 'Consolidação'
         when 'semestral' then 'Consolidação'
         when 'intensiva' then 'Ciclo de 9 semanas'
         else 'Reta Final'
       end,
       case when p.tipo = 'reta_final' then 8 else 1 + (m.ordem % 9) end,
       m.ordem
  from planos_fonte p cross join missao_fonte m
on conflict (plano_id, missao_id) do update set
  fase = excluded.fase,
  semana_sugerida = excluded.semana_sugerida,
  ordem = excluded.ordem;

do $$
declare
  n_semanas int;
  n_atividades int;
  n_missoes int;
  n_materias int;
  n_planos int;
begin
  select count(*)::int into n_semanas from trilha_semanas where trilha_id = ${trilhaIdSql};
  select count(*)::int into n_atividades from atividades_modelo where trilha_id = ${trilhaIdSql};
  select count(*)::int, count(distinct materia_codigo)::int into n_missoes, n_materias
    from missoes where exam_tag = 'espcex';
  select count(*)::int into n_planos from trilha_planos where exam_tag = 'espcex';
  if n_semanas <> 9 or n_atividades <> ${atividades.length} then
    raise exception 'Trilha EsPCEx incompleta: semanas %, atividades %', n_semanas, n_atividades;
  end if;
  if n_missoes < 24 or n_materias <> 8 or n_planos <> 4 then
    raise exception 'Missões EsPCEx incompletas: missões %, matérias %, planos %', n_missoes, n_materias, n_planos;
  end if;
end $$;
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { trilha, conteudo } = carregarFontes();
  const saida = gerarSql(trilha, conteudo);
  writeFileSync(DESTINO, saida);
  console.log(`✓ ${DESTINO_REL} gerado (${trilha.semanas.length} semanas; ${montarTarefas(trilha, conteudo).length} atividades; ${trilha.missoes.length} missões)`);
}
