// Gera o seed PED2-R3 da EsPCEx a partir da fonte estruturada versionada.
// O JSON guarda somente catálogo e tags; nunca enunciados completos.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
export const FONTE_REL = "supabase/seed/espcex-ped2-r3-v1.json";
export const FONTE_2024_REL = "supabase/seed/espcex-2024-tags-v1.json";
export const DESTINO_REL = "supabase/seed/19_espcex_ped2_r3.sql";
export const FONTE = join(RAIZ, FONTE_REL);
export const FONTE_2024 = join(RAIZ, FONTE_2024_REL);
export const DESTINO = join(RAIZ, DESTINO_REL);

const CONTAGENS_CATALOGO = { por: 9, red: 4, fis: 5, qui: 18, mat: 17, ing: 2, his: 17, geo: 8 };
const CONTAGENS_QUESTOES_POR_ANO = { por: 20, fis: 12, qui: 12, mat: 20, geo: 12, his: 12, ing: 12 };
const REGRAS_CADERNO = {
  "2024-d1-a": [
    [1, 20, "por"], [21, 32, "fis"], [33, 44, "qui"],
  ],
  "2024-d2-d": [
    [1, 20, "mat"], [21, 32, "geo"], [33, 44, "his"], [45, 56, "ing"],
  ],
  "2025-d1-a": [
    [1, 20, "por"], [21, 32, "fis"], [33, 44, "qui"],
  ],
  "2025-d2-d": [
    [1, 20, "mat"], [21, 32, "geo"], [33, 44, "his"], [45, 56, "ing"],
  ],
};

export const GABARITOS_OFICIAIS = {
  "2024-d1-a": "A D C D B C C E B E D A C A D A E A B A C E B E D C A A A D E D E C D A C E B A C D D B".split(" "),
  "2024-d2-d": "B C A D B A E B E D B B A C B E A C D D C D D B A E B D D A E B A B B C E C D E E D A C C D A B D C A C E D E B".split(" "),
  "2025-d1-a": "C ANULADA A D C E A B B D C A B B D E E B C C D D C E C B B E A B C A D B C E C A B E D C A E".split(" "),
  "2025-d2-d": "A C B A D B E D D D D B A B C E A D C E E C A B C E B B D E C E D B A E C A E E C E A B A B E A C E D E B D C B".split(" "),
};

const sql = (valor) => valor == null ? "null" : `'${String(valor).replaceAll("'", "''")}'`;
const sqlValor = (valor) => typeof valor === "number" ? String(valor) : sql(valor);
const valoresSql = (linhas) => linhas.map((campos) => `  (${campos.map(sqlValor).join(", ")})`).join(",\n");
const contar = (itens, chave) => itens.reduce((acc, item) => {
  const valor = item[chave];
  acc[valor] = (acc[valor] ?? 0) + 1;
  return acc;
}, {});

export function carregarFonte() {
  const principal = JSON.parse(readFileSync(FONTE, "utf8"));
  const tags2024 = JSON.parse(readFileSync(FONTE_2024, "utf8"));
  if (tags2024.exam_tag !== principal.exam_tag || tags2024.versao !== 1 || tags2024.ano !== 2024) {
    throw new Error(`${FONTE_2024_REL}: metadados incompatíveis com a fonte principal`);
  }
  return {
    ...principal,
    provas: [...(tags2024.provas ?? []), ...(principal.provas ?? [])],
  };
}

export function validarFonte(dados) {
  const erros = [];
  if (dados.exam_tag !== "espcex") erros.push("exam_tag deve ser 'espcex'");
  if (dados.versao !== 1) erros.push("versao da fonte deve ser 1");

  const fontes = [dados.fonte_programa, dados.fonte_programa_vigente, ...(dados.provas ?? []).flatMap((p) => [p.caderno, p.gabarito])];
  for (const fonte of fontes) {
    if (!fonte?.arquivo || !/^[a-f0-9]{64}$/.test(fonte?.sha256 ?? "")) {
      erros.push(`fonte sem arquivo/hash SHA-256 válido: ${fonte?.arquivo ?? "(ausente)"}`);
    }
  }
  if (!dados.fonte_programa_vigente?.comparado_com_2022) {
    erros.push("o programa vigente deve registrar a comparação com o edital de 2022");
  }
  if (!/^https:\/\/in\.gov\.br\//.test(dados.fonte_programa_vigente?.url_oficial ?? "")) {
    erros.push("a fonte do programa vigente deve apontar para o DOU oficial");
  }

  const catalogo = dados.catalogo ?? [];
  const chavesAssunto = new Set();
  const chavesSubassunto = new Set();
  for (const assunto of catalogo) {
    const chave = `${assunto.materia}|${assunto.nome}`;
    if (chavesAssunto.has(chave)) erros.push(`assunto duplicado: ${chave}`);
    chavesAssunto.add(chave);
    if (assunto.rotulo_oficial && (assunto.rotulo_oficial.length > 140 || /[\r\n]/.test(assunto.rotulo_oficial))) {
      erros.push(`rótulo oficial inválido: ${chave}`);
    }
    if (!assunto.subassuntos?.length) erros.push(`assunto sem recorte pedagógico: ${chave}`);
    for (const sub of assunto.subassuntos ?? []) {
      const chaveSub = `${chave}|${sub}`;
      if (chavesSubassunto.has(chaveSub)) erros.push(`subassunto duplicado: ${chaveSub}`);
      chavesSubassunto.add(chaveSub);
    }
  }
  const contagensCatalogo = contar(catalogo, "materia");
  for (const [materia, esperado] of Object.entries(CONTAGENS_CATALOGO)) {
    if ((contagensCatalogo[materia] ?? 0) !== esperado) {
      erros.push(`catálogo ${materia}: esperado ${esperado}, encontrado ${contagensCatalogo[materia] ?? 0}`);
    }
  }
  for (const materia of Object.keys(contagensCatalogo)) {
    if (!(materia in CONTAGENS_CATALOGO)) erros.push(`matéria inesperada no catálogo: ${materia}`);
  }

  const provas = dados.provas ?? [];
  const chavesProva = new Set();
  const questoes = [];
  for (const prova of provas) {
    if (chavesProva.has(prova.chave)) erros.push(`prova duplicada: ${prova.chave}`);
    chavesProva.add(prova.chave);
    if (!REGRAS_CADERNO[prova.chave]) erros.push(`caderno inesperado: ${prova.chave}`);
    if (!prova.chave.startsWith(`${prova.ano}-`)) erros.push(`${prova.chave}: ano ${prova.ano} diverge da chave`);
    const numeros = new Set();
    for (const questao of prova.questoes ?? []) {
      if (numeros.has(questao.numero)) erros.push(`${prova.chave}: questão duplicada ${questao.numero}`);
      numeros.add(questao.numero);
      const regra = (REGRAS_CADERNO[prova.chave] ?? []).find(([inicio, fim]) => questao.numero >= inicio && questao.numero <= fim);
      if (!regra || regra[2] !== questao.materia) {
        erros.push(`${prova.chave} Q${questao.numero}: matéria ${questao.materia} fora do intervalo oficial`);
      }
      if (!/^(?:[A-E]|ANULADA)$/.test(questao.gabarito ?? "")) {
        erros.push(`${prova.chave} Q${questao.numero}: gabarito inválido '${questao.gabarito}'`);
      }
      if (!questao.referencia || questao.referencia.length > 140 || /[\r\n]/.test(questao.referencia)) {
        erros.push(`${prova.chave} Q${questao.numero}: referência curta ausente ou longa demais`);
      }
      const assunto = `${questao.materia}|${questao.assunto}`;
      const subassunto = `${assunto}|${questao.subassunto}`;
      if (!chavesAssunto.has(assunto)) erros.push(`${prova.chave} Q${questao.numero}: assunto inexistente ${assunto}`);
      if (!chavesSubassunto.has(subassunto)) erros.push(`${prova.chave} Q${questao.numero}: subassunto inexistente ${subassunto}`);
      questoes.push({ ...questao, prova: prova.chave });
    }
    const gabaritoOficial = GABARITOS_OFICIAIS[prova.chave] ?? [];
    const questoesOrdenadas = [...(prova.questoes ?? [])].sort((a, b) => a.numero - b.numero);
    if (questoesOrdenadas.length !== gabaritoOficial.length) {
      erros.push(`${prova.chave}: esperado ${gabaritoOficial.length} respostas oficiais, encontradas ${questoesOrdenadas.length}`);
    }
    for (let i = 0; i < gabaritoOficial.length; i += 1) {
      const questao = questoesOrdenadas[i];
      if (questao?.numero !== i + 1) {
        erros.push(`${prova.chave}: numeração incompleta; esperada Q${i + 1}`);
      } else if (questao.gabarito !== gabaritoOficial[i]) {
        erros.push(`${prova.chave} Q${questao.numero}: esperado gabarito oficial ${gabaritoOficial[i]}, encontrado ${questao.gabarito}`);
      }
    }
  }
  if (provas.length !== 4) erros.push(`esperadas 4 provas/cadernos, encontradas ${provas.length}`);
  if (questoes.length !== 200) erros.push(`esperadas 200 questões, encontradas ${questoes.length}`);
  for (const ano of [2024, 2025]) {
    const questoesAno = questoes.filter((q) => q.prova.startsWith(`${ano}-`));
    const contagensQuestoes = contar(questoesAno, "materia");
    if (questoesAno.length !== 100) erros.push(`ano ${ano}: esperadas 100 questões, encontradas ${questoesAno.length}`);
    for (const [materia, esperado] of Object.entries(CONTAGENS_QUESTOES_POR_ANO)) {
      if ((contagensQuestoes[materia] ?? 0) !== esperado) {
        erros.push(`ano ${ano}, questões ${materia}: esperado ${esperado}, encontrado ${contagensQuestoes[materia] ?? 0}`);
      }
    }
  }
  if (questoes.filter((q) => q.prova.startsWith("2025-") && q.gabarito === "ANULADA").length !== 1
      || questoes.some((q) => q.prova.startsWith("2024-") && q.gabarito === "ANULADA")) {
    erros.push("o gabarito oficial de 2025 deve conter exatamente 1 questão anulada nos cadernos tagueados");
  }
  return erros;
}

function fontePrograma(dados) {
  const fonte = dados.fonte_programa_vigente;
  return `Anexo C do ${fonte.edital} (${fonte.concurso}) — ${fonte.arquivo} (SHA-256 ${fonte.sha256}); URL oficial ${fonte.url_oficial}`;
}

function fonteAssunto(dados, assunto) {
  const fonte = fontePrograma(dados);
  if (!assunto.rotulo_oficial) return fonte;
  return `${fonte}. Título no Anexo C: “${assunto.rotulo_oficial}”; chave preservada como “${assunto.nome}” por compatibilidade.`;
}

function fonteProva(prova) {
  return `${prova.descricao} — caderno ${prova.caderno.arquivo} (SHA-256 ${prova.caderno.sha256}); gabarito ${prova.gabarito.arquivo} (SHA-256 ${prova.gabarito.sha256})`;
}

export function gerarSql(dados) {
  const erros = validarFonte(dados);
  if (erros.length) throw new Error(`Fonte PED2-R3 inválida:\n- ${erros.join("\n- ")}`);

  const assuntos = dados.catalogo.map((a) => [a.materia, a.nome, fonteAssunto(dados, a), a.ordem]);
  const subassuntos = dados.catalogo.flatMap((a) => a.subassuntos.map((sub, ordem) => [a.materia, a.nome, sub, ordem]));
  const provas = dados.provas.map((p) => [dados.exam_tag, p.ano, p.etapa, fonteProva(p), p.observacao, "oficial"]);
  const questoes = dados.provas.flatMap((p) => p.questoes.map((q) => [
    p.ano, p.etapa, q.numero, q.materia, q.assunto, q.subassunto, q.gabarito,
    `${p.chave} Q${q.numero}: ${q.referencia}`,
  ]));
  const chavesProvas = dados.provas.map((p) => [p.ano, p.etapa]);
  const fonteRecorrencia = `Tagueamento oficial EsPCEx 2024–2025: ${dados.provas.map((p) => `${p.chave} (${p.caderno.sha256.slice(0, 12)}…/${p.gabarito.sha256.slice(0, 12)}…)`).join(" + ")}`;

  return `-- ============================================================
-- PED2-R3 — CATÁLOGO E TAGUEAMENTO REAL DA ESPCEX
-- ------------------------------------------------------------
-- GERADO por scripts/gerar-seed-espcex-ped2-r3.mjs a partir de
-- ${FONTE_REL}. NÃO editar à mão; não contém enunciados completos.
-- Fontes originais permanecem fora do Git; hashes no JSON e neste seed.
-- Conteúdo global, aditivo, idempotente; nenhuma migration/RLS/trilha.
-- ============================================================

-- 1) Catálogo vigente do Anexo C: 80 assuntos oficiais nas 8 matérias.
-- Os subassuntos são recortes pedagógicos rastreáveis do texto oficial e,
-- por honestidade de granularidade, entram como 'inferencia'.
insert into assuntos (exam_tag, materia_codigo, nome, status_dado, observacao, ordem)
values
${valoresSql(assuntos.map(([materia, nome, observacao, ordem]) => [dados.exam_tag, materia, nome, "oficial", observacao, ordem]))}
on conflict (exam_tag, materia_codigo, nome) do update set
  status_dado = excluded.status_dado,
  observacao = excluded.observacao,
  ordem = excluded.ordem;

-- Resolve explicitamente o OCR antigo: o Anexo C traz Eletroquímica
-- e inclui eletrólise; não traz "eletroforese".
update assuntos
   set status_dado = 'oficial',
       observacao = ${sql(`${fontePrograma(dados)}. O item oficial é Eletroquímica e inclui eletrólise; dúvida de OCR encerrada.`)}
 where exam_tag = 'espcex'
   and materia_codigo = 'qui'
   and nome = 'Eletroquímica/Eletrólise';

with dados (materia_codigo, assunto_nome, subassunto_nome, ordem) as (
  values
${valoresSql(subassuntos)}
)
insert into subassuntos (assunto_id, nome, status_dado, ordem)
select a.id, d.subassunto_nome, 'inferencia', d.ordem
  from dados d
  join assuntos a
    on a.exam_tag = 'espcex'
   and a.materia_codigo = d.materia_codigo
   and a.nome = d.assunto_nome
on conflict (assunto_id, nome) do update set
  ordem = excluded.ordem;

-- Remove somente recortes EsPCEx que deixaram de existir na fonte vigente
-- (por exemplo, rótulos substituídos na comparação 2022 → 2026).
with fonte (materia_codigo, assunto_nome, subassunto_nome, ordem) as (
  values
${valoresSql(subassuntos)}
)
delete from subassuntos s
 using assuntos a
 where s.assunto_id = a.id
   and a.exam_tag = 'espcex'
   and not exists (
     select 1 from fonte f
      where f.materia_codigo = a.materia_codigo
        and f.assunto_nome = a.nome
        and f.subassunto_nome = s.nome
   );

do $$
declare
  n_assuntos int;
  n_subassuntos int;
  n_nao_oficiais int;
begin
  select count(*)::int,
         count(*) filter (where status_dado <> 'oficial')::int
    into n_assuntos, n_nao_oficiais
    from assuntos
   where exam_tag = 'espcex';
  select count(*)::int into n_subassuntos
    from subassuntos s join assuntos a on a.id = s.assunto_id
   where a.exam_tag = 'espcex';
  if n_assuntos <> 80 or n_subassuntos <> 339 or n_nao_oficiais <> 0 then
    raise exception 'PED2-R3 catálogo inválido: esperado 80 assuntos oficiais/339 subassuntos; encontrado %/% (% assunto(s) não oficial(is))',
      n_assuntos, n_subassuntos, n_nao_oficiais;
  end if;
end $$;

-- 2) Quatro cadernos oficiais, dois de 2024 e dois de 2025.
insert into provas_anteriores (exam_tag, ano, etapa, fonte, observacao, status_dado)
values
${valoresSql(provas)}
on conflict (exam_tag, ano, etapa) do update set
  fonte = excluded.fonte,
  observacao = excluded.observacao,
  status_dado = excluded.status_dado;

-- A fonte é uma fotografia exata destes quatro cadernos: remove tags antigas
-- somente neste escopo antes de repor as 200 linhas validadas.
with provas_fonte (ano, etapa) as (
  values
${valoresSql(chavesProvas)}
)
delete from questoes_prova q
 using provas_anteriores pa, provas_fonte pf
 where q.prova_anterior_id = pa.id
   and pa.exam_tag = 'espcex'
   and pa.ano = pf.ano
   and pa.etapa = pf.etapa;

-- 3) 200 questões objetivas tagueadas; somente referência curta + tags.
with dados (ano, etapa, numero, materia_codigo, assunto_nome, subassunto_nome, gabarito, observacao) as (
  values
${valoresSql(questoes)}
)
insert into questoes_prova
  (prova_anterior_id, numero, materia_codigo, assunto_id, subassunto_id, gabarito, observacao)
select pa.id, d.numero, d.materia_codigo, a.id, s.id, d.gabarito, d.observacao
  from dados d
  join provas_anteriores pa
    on pa.exam_tag = 'espcex' and pa.ano = d.ano and pa.etapa = d.etapa
  join assuntos a
    on a.exam_tag = 'espcex' and a.materia_codigo = d.materia_codigo and a.nome = d.assunto_nome
  join subassuntos s
    on s.assunto_id = a.id and s.nome = d.subassunto_nome
on conflict (prova_anterior_id, numero) do update set
  materia_codigo = excluded.materia_codigo,
  assunto_id = excluded.assunto_id,
  subassunto_id = excluded.subassunto_id,
  gabarito = excluded.gabarito,
  observacao = excluded.observacao;

do $$
declare
  prova record;
  n_questoes int;
begin
  for prova in
    select * from (values
${valoresSql(dados.provas.map((p) => [p.ano, p.etapa, p.questoes.length]))}
    ) as esperado(ano, etapa, quantidade)
  loop
    select count(*)::int into n_questoes
      from questoes_prova q join provas_anteriores pa on pa.id = q.prova_anterior_id
     where pa.exam_tag = 'espcex' and pa.ano = prova.ano and pa.etapa = prova.etapa;
    if n_questoes <> prova.quantidade then
      raise exception 'PED2-R3 incompleto: prova %/% esperava %, encontrou %',
        prova.ano, prova.etapa, prova.quantidade, n_questoes;
    end if;
  end loop;
end $$;

-- 4) Recorrência medida, derivada do tagueamento conjunto de 2024–2025.
delete from recorrencia_assunto
 where exam_tag = 'espcex' and tipo = 'medida';

with provas_fonte (ano, etapa) as (
  values
${valoresSql(chavesProvas)}
),
medida as (
  select q.materia_codigo,
         q.assunto_id,
         count(*)::int as num_questoes,
         count(distinct pa.ano)::int as anos
    from questoes_prova q
    join provas_anteriores pa on pa.id = q.prova_anterior_id
    join provas_fonte pf on pf.ano = pa.ano and pf.etapa = pa.etapa
   where pa.exam_tag = 'espcex'
   group by q.materia_codigo, q.assunto_id
),
totais_materia as (
  select materia_codigo, sum(num_questoes)::int as num_questoes
    from medida
   group by materia_codigo
)
insert into recorrencia_assunto
  (exam_tag, materia_codigo, assunto_id, anos, num_questoes, pct_materia, tipo, fonte, observacao)
select 'espcex', m.materia_codigo, m.assunto_id, m.anos, m.num_questoes,
       round((100.0 * m.num_questoes / pm.num_questoes)::numeric, 2),
       'medida', ${sql(fonteRecorrencia)},
       'Contagem derivada das questões tagueadas; conferir também vw_recorrencia_medida.'
  from medida m
  join totais_materia pm on pm.materia_codigo = m.materia_codigo
on conflict (exam_tag, assunto_id, tipo) do update set
  materia_codigo = excluded.materia_codigo,
  anos = excluded.anos,
  num_questoes = excluded.num_questoes,
  pct_materia = excluded.pct_materia,
  fonte = excluded.fonte,
  observacao = excluded.observacao,
  atualizado_em = now();

insert into config_oficial (exam_tag, chave, valor, status_dado, fonte, observacao)
values (
  'espcex',
  'recorrencia_status',
  '{"medida": true, "anos": [2024, 2025], "questoes": 200}'::jsonb,
  'oficial',
  ${sql(fonteRecorrencia)},
  'Recorrência recalculada sobre quatro cadernos oficiais; não depende mais de um único ano.'
)
on conflict (exam_tag, chave) do update set
  valor = excluded.valor,
  status_dado = excluded.status_dado,
  fonte = excluded.fonte,
  observacao = excluded.observacao,
  atualizado_em = now();
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dados = carregarFonte();
  const saida = gerarSql(dados);
  writeFileSync(DESTINO, saida);
  console.log(`✓ ${DESTINO_REL} gerado (${dados.catalogo.length} assuntos; ${dados.provas.reduce((n, p) => n + p.questoes.length, 0)} questões em ${dados.provas.length} cadernos)`);
}
