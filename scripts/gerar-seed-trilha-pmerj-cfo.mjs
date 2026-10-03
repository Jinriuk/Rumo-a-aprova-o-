// ============================================================
// GERADOR DA TRILHA CFO PMERJ (pré-edital) — P0.3
// ------------------------------------------------------------
// Fonte: supabase/seed/trilha-pmerj-cfo-v1.json (manifesto editorial).
// Desenho: docs/conteudo/pmerj-cfo/ (seções 5, 6, 10 e Apêndice A).
//
// O QUE ESTE GERADOR NÃO HERDA dos outros (de propósito):
//   • datas: nenhuma data no manifesto. A turma é PARÂMETRO
//     (--inicio, sempre uma segunda-feira) e as 12 semanas saem dela,
//     de segunda a domingo, sem lacuna;
//   • rodízio: não há distribuição por módulo nem deslocamento por
//     matéria (o gerador da EsPCEx faz isso). Cada linha do Anexo II
//     vai para a semana que o Apêndice A escolheu, à mão;
//   • turma em andamento: rodar de novo com a mesma turma e o mesmo
//     início é no-op; com outro início, o SQL RECUSA (as datas de uma
//     turma que já tem aluno não mudam). Turma nova = --turma nova;
//   • atividades: nunca apaga. meta_atividades aponta para
//     atividades_modelo sem cascata, então "apagar e reinserir" quebraria
//     a turma que já tem meta gerada. Upsert por id estável.
//   • maturidade: o SQL NÃO carimba concursos.maturidade. Quem carimba é
//     o seed 18, a partir de app/src/modules/conteudo/maturidade.js,
//     quando a publicação for autorizada (P0.6).
//
// Uso:
//   node scripts/gerar-seed-trilha-pmerj-cfo.mjs --inicio 2026-10-05 --turma 1 \
//        [--publicada] [--saida caminho.sql]
//   node scripts/gerar-seed-trilha-pmerj-cfo.mjs --validar
// Sem --saida, o SQL vai para a saída padrão. Nada é aplicado em banco.
// ============================================================
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
export const FONTE_REL = "supabase/seed/trilha-pmerj-cfo-v1.json";

const NOME_PUBLICO = "CFO PMERJ, preparação pré-edital";
const SIGLAS = ["ADM", "CONST", "PEN", "CPP", "CPM", "DH"];
const LINHAS_POR_SIGLA = { ADM: 40, CONST: 29, PEN: 71, CPP: 47, CPM: 20, DH: 12 };
const SEMANAS = 12;
const SEMANAS_SIMULADO = [4, 8, 12];
const SEMANAS_COM_MISSAO_ESCRITA = [1, 2, 3, 4];
const PRIORIDADES = new Set(["alta", "media", "baixa"]);

export function carregarFonte() {
  return JSON.parse(readFileSync(join(RAIZ, FONTE_REL), "utf8"));
}

// ── utilitários ──────────────────────────────────────────────────────

// UUID determinístico: a mesma chave gera o mesmo id em qualquer máquina.
export function uid(chave) {
  const h = createHash("sha256").update(`triliva:pmerj-cfo:${chave}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const sql = (v) => v == null ? "null" : typeof v === "number" ? String(v) : typeof v === "boolean" ? String(v) : `'${String(v).replaceAll("'", "''")}'`;
const valores = (linhas) => linhas.map((c) => `  (${c.map(sql).join(", ")})`).join(",\n");
const dataUtc = (iso) => new Date(`${iso}T00:00:00Z`);
const somarDias = (iso, n) => new Date(dataUtc(iso).getTime() + n * 86_400_000).toISOString().slice(0, 10);

// "1–11,56,70–71" → [1..11, 56, 70, 71]; "—" → []. Aceita hífen ou travessão.
export function expandirFaixas(texto) {
  const t = String(texto ?? "").trim();
  if (t === "—" || t === "-" || t === "") return [];
  return t.split(",").flatMap((parte) => {
    const [a, b] = parte.trim().split(/[–-]/).map((x) => Number(x.trim()));
    if (!Number.isInteger(a) || (b !== undefined && !Number.isInteger(b))) throw new Error(`faixa inválida: "${parte}"`);
    if (b === undefined) return [a];
    if (b < a) throw new Error(`faixa invertida: "${parte}"`);
    return Array.from({ length: b - a + 1 }, (_, i) => a + i);
  });
}

// Destino de cada linha do Anexo II pelo Apêndice A: chave → semana.
// Devolve também as linhas que aparecem mais de uma vez ou em posição
// que não existe, para o validador reprovar.
export function destinoDasLinhas(manifesto) {
  const destino = new Map();
  const repetidas = [];
  const inexistentes = [];
  for (const linha of manifesto.apendiceA ?? []) {
    for (const sigla of SIGLAS) {
      for (const posicao of expandirFaixas(linha[sigla])) {
        const chave = `${sigla}-${String(posicao).padStart(2, "0")}`;
        if (posicao < 1 || posicao > LINHAS_POR_SIGLA[sigla]) inexistentes.push(`${chave} (semana ${linha.semana})`);
        else if (destino.has(chave)) repetidas.push(`${chave} (semanas ${destino.get(chave)} e ${linha.semana})`);
        else destino.set(chave, linha.semana);
      }
    }
  }
  return { destino, repetidas, inexistentes };
}

// ── orçamento (seção 6.2 recalculada para a turma do manifesto) ──────

const pesoDe = (manifesto, codigo) => manifesto.materias.find((m) => m.codigo === codigo).questoesFgv2024;

function dividirPorMateria(manifesto, total, porTotal) {
  const somaPesos = manifesto.materias.reduce((s, m) => s + m.questoesFgv2024, 0);
  return Object.fromEntries(manifesto.materias.map((m) => {
    const t = (total * m.questoesFgv2024) / somaPesos;
    return [m.codigo, porTotal(t)];
  }));
}

// Recalcula as duas tabelas a partir de horas, tempo por questão e
// reservas. É a mesma conta que a seção 6.2/A5 descreve, com uma troca:
// o bloco de arredondamento é 16 (pesos exatos), não 5.
export function calcularOrcamento(manifesto) {
  const o = manifesto.orcamento;
  const t = manifesto.turmaPadrao;
  const u = o.unidadePeso;
  const minutos = 60 * t.horasQuestoesComCorrecao;
  const blocos = (min) => u * Math.floor(min / o.minutosPorQuestaoCorrigida / u);

  const normalTotal = blocos(minutos);
  const normal = dividirPorMateria(manifesto, normalTotal, (tm) => {
    const S = Math.round(tm * o.reservaMisto);
    const R = Math.floor(tm * o.reservaRevisao);
    return { N: tm - R - S, R, S };
  });

  const sim = o.simuladoCompleto;
  const restanteTotal = blocos(minutos - sim.minutosProva - sim.minutosCorrecao);
  const simulado = {};
  const simPorMateria = dividirPorMateria(manifesto, sim.questoes, (x) => x);
  const restPorMateria = dividirPorMateria(manifesto, restanteTotal, (x) => x);
  for (const m of manifesto.materias) {
    const resto = restPorMateria[m.codigo];
    const R = Math.floor(resto * sim.revisaoSobreRestante);
    simulado[m.codigo] = { N: resto - R, R, S: simPorMateria[m.codigo] };
  }
  const soma = (tab) => Object.values(tab).reduce((a, c) => ({ N: a.N + c.N, R: a.R + c.R, S: a.S + c.S }), { N: 0, R: 0, S: 0 });
  return {
    normal, simulado,
    totalNormal: soma(normal),
    totalSimulado: soma(simulado),
    minutosNormal: normalTotal * o.minutosPorQuestaoCorrigida,
    minutosSimulado: sim.minutosProva + sim.minutosCorrecao + restanteTotal * o.minutosPorQuestaoCorrigida,
    minutosDisponiveis: minutos,
  };
}

const totalDe = (c) => c.N + c.R + c.S;
const questoes = (n) => `${n} ${n === 1 ? "questão" : "questões"}`;
const eSimulado = (n) => SEMANAS_SIMULADO.includes(n);

// ── validação ────────────────────────────────────────────────────────

export function validarFonte(m) {
  const erros = [];
  const e = (msg) => erros.push(msg);

  // identidade
  if (m.nicho !== "pmerj-cfo" || m.examTag !== "pmerj_cfo") e("nicho/examTag devem ser pmerj-cfo / pmerj_cfo");
  if (m.nome !== NOME_PUBLICO || m.concurso?.nome !== NOME_PUBLICO) e(`nome público deve ser "${NOME_PUBLICO}"`);
  if (/\b20\d\d\b/.test(m.nome ?? "")) e("o nome público não leva ano");
  if (m.concurso?.codigo !== m.examTag) e("concurso.codigo deve ser igual a examTag");
  if (m.statusDado !== "inferencia") e("o desenho pedagógico deve ser rotulado como inferência");
  if (m.dataProvaConfirmada != null && !/^\d{4}-\d{2}-\d{2}$/.test(m.dataProvaConfirmada)) e("dataProvaConfirmada deve ser null ou AAAA-MM-DD");

  // matérias
  const codigos = (m.materias ?? []).map((x) => x.codigo);
  const esperadas = { dir_adm: 15, dir_const: 15, dir_pen: 15, dir_proc_pen: 15, dir_pen_mil: 10, dir_hum: 10 };
  if (codigos.length !== 6 || Object.keys(esperadas).some((c) => !codigos.includes(c))) e("as seis matérias jurídicas devem estar no manifesto");
  for (const mat of m.materias ?? []) {
    if (esperadas[mat.codigo] !== mat.questoesFgv2024) e(`peso de ${mat.codigo} deve ser ${esperadas[mat.codigo]}`);
    if (!SIGLAS.includes(mat.sigla)) e(`sigla inválida: ${mat.sigla}`);
  }
  if (erros.length) return erros; // o resto depende das matérias
  const siglaDe = Object.fromEntries(m.materias.map((x) => [x.codigo, x.sigla]));
  const opcionais = new Set((m.disciplinasOperacionais ?? []).map((d) => d.codigo));
  for (const c of opcionais) if (codigos.includes(c)) e(`disciplina operacional repete matéria: ${c}`);

  // Anexo II: 219 linhas, chave estável, texto literal não vazio
  const linhas = m.anexoII ?? [];
  if (linhas.length !== 219) e(`o Anexo II deve ter 219 linhas, tem ${linhas.length}`);
  const chaves = new Set();
  const textos = new Set();
  const porSigla = {};
  for (const l of linhas) {
    const sigla = siglaDe[l.materia];
    if (!sigla) { e(`linha ${l.chave} com matéria desconhecida: ${l.materia}`); continue; }
    porSigla[sigla] = (porSigla[sigla] ?? 0) + 1;
    const esperada = `${sigla}-${String(porSigla[sigla]).padStart(2, "0")}`;
    if (l.chave !== esperada || l.posicao !== porSigla[sigla]) e(`chave fora de ordem: ${l.chave} (esperado ${esperada})`);
    if (chaves.has(l.chave)) e(`chave duplicada: ${l.chave}`);
    chaves.add(l.chave);
    if (!l.texto?.trim()) e(`linha sem texto: ${l.chave}`);
    const k = `${l.materia}|${l.texto}`;
    if (textos.has(k)) e(`texto repetido na mesma matéria (o banco exige nome único): ${l.chave}`);
    textos.add(k);
    if (!PRIORIDADES.has(l.prioridade)) e(`prioridade inválida em ${l.chave}: ${l.prioridade}`);
  }
  for (const [sigla, n] of Object.entries(LINHAS_POR_SIGLA)) {
    if ((porSigla[sigla] ?? 0) !== n) e(`${sigla} deve ter ${n} linhas, tem ${porSigla[sigla] ?? 0}`);
  }

  // Apêndice A: toda linha tem exatamente um destino
  if ((m.apendiceA ?? []).length !== SEMANAS) e(`o Apêndice A deve ter ${SEMANAS} semanas`);
  const { destino, repetidas, inexistentes } = (() => {
    try { return destinoDasLinhas(m); } catch (x) { e(x.message); return { destino: new Map(), repetidas: [], inexistentes: [] }; }
  })();
  for (const r of repetidas) e(`linha com dois destinos: ${r}`);
  for (const r of inexistentes) e(`Apêndice A aponta linha inexistente: ${r}`);
  for (const chave of chaves) if (!destino.has(chave)) e(`linha sem destino no Apêndice A: ${chave}`);
  for (const [chave, sem] of destino) if (sem < 1 || sem > SEMANAS) e(`destino fora do calendário: ${chave} → ${sem}`);

  // semanas
  const semanas = m.semanas ?? [];
  if (semanas.length !== SEMANAS) e(`esperadas ${SEMANAS} semanas`);
  semanas.forEach((s, i) => {
    if (s.n !== i + 1) e(`semana fora de ordem: ${s.n}`);
    if (s.tipo !== (eSimulado(s.n) ? "simulado" : "normal")) e(`semana ${s.n} deveria ser ${eSimulado(s.n) ? "simulado" : "normal"}`);
    if (!s.foco?.trim()) e(`semana ${s.n} sem foco`);
    if (!s.escrita?.trim()) e(`semana ${s.n} sem entrega de escrita`);
    for (const c of codigos) if (!s.sinteses?.[c]?.trim()) e(`semana ${s.n} sem síntese de ${c}`);
    if ("inicio" in s || "fim" in s) e(`semana ${s.n} tem data fixa; a data vem do parâmetro --inicio`);
  });

  // carga da turma
  const t = m.turmaPadrao ?? {};
  if (t.horasLeitura + t.horasQuestoesComCorrecao + t.horasEscrita !== t.horasSemana) e("as horas da turma não somam o total semanal");

  // orçamento: tabela declarada = tabela recalculada, pesos exatos, cabe no tempo
  const calc = calcularOrcamento(m);
  for (const [tipo, declarada, calculada] of [["semanaNormal", m.orcamento.semanaNormal, calc.normal], ["semanaSimulado", m.orcamento.semanaSimulado, calc.simulado]]) {
    for (const c of codigos) {
      const d = declarada?.[c]; const k = calculada[c];
      if (!d || d.N !== k.N || d.R !== k.R || d.S !== k.S) e(`${tipo}.${c} = ${JSON.stringify(d)}, recalculado ${JSON.stringify(k)}`);
      if (!Number.isInteger(k.N) || !Number.isInteger(k.R) || !Number.isInteger(k.S) || k.N <= 0) e(`${tipo}.${c} não é inteiro positivo: ${JSON.stringify(k)}`);
    }
    // pesos mantidos: total de cada matéria proporcional ao peso, exato
    const somaTotal = codigos.reduce((s, c) => s + totalDe(calculada[c]), 0);
    for (const c of codigos) {
      if (totalDe(calculada[c]) * 80 !== somaTotal * pesoDe(m, c)) e(`${tipo}: ${c} não recebe exatamente ${pesoDe(m, c)}/80 do total`);
    }
  }
  if (calc.minutosNormal > calc.minutosDisponiveis) e("semana normal não cabe no tempo de questões");
  if (calc.minutosSimulado > calc.minutosDisponiveis) e("semana de simulado não cabe no tempo de questões");
  if (calc.totalSimulado.S !== m.orcamento.simuladoCompleto.questoes) e("o simulado precisa entrar inteiro na semana de simulado");
  const leitura = m.orcamento.leituraMinutosPorSemana ?? {};
  if (codigos.reduce((s, c) => s + (leitura[c] ?? 0), 0) !== 60 * t.horasLeitura) e("a leitura por matéria não soma as horas de leitura");

  // missões: 24 escritas nas semanas 1 a 4, as outras 48 pendentes
  const escritas = m.missoes ?? [];
  const pendentes = m.missoesPendentes ?? [];
  const chavesMissao = new Set();
  for (const x of [...escritas, ...pendentes]) {
    if (chavesMissao.has(x.chave)) e(`missão duplicada: ${x.chave}`);
    chavesMissao.add(x.chave);
    const esperada = `PMERJ-M${String(x.semana).padStart(2, "0")}-${siglaDe[x.materia]}`;
    if (x.chave !== esperada) e(`chave de missão fora do padrão: ${x.chave} (esperado ${esperada})`);
  }
  for (let n = 1; n <= SEMANAS; n += 1) {
    for (const c of codigos) {
      const lista = SEMANAS_COM_MISSAO_ESCRITA.includes(n) ? escritas : pendentes;
      if (lista.filter((x) => x.semana === n && x.materia === c).length !== 1) {
        e(`semana ${n}, ${c}: esperada exatamente uma missão ${SEMANAS_COM_MISSAO_ESCRITA.includes(n) ? "escrita" : "pendente"}`);
      }
    }
  }
  if (escritas.length !== 24) e(`esperadas 24 missões escritas, há ${escritas.length}`);
  if (pendentes.length !== 48) e(`esperadas 48 missões pendentes, há ${pendentes.length}`);
  for (const p of pendentes) {
    if (p.status !== "pendente") e(`missão ${p.chave} das semanas 5–12 deve estar marcada como pendente`);
    if (p.nome || p.objetivo) e(`missão pendente ${p.chave} não deve ter texto`);
  }
  const linhaPorChave = new Map(linhas.map((l) => [l.chave, l]));
  for (const x of escritas) {
    for (const campo of ["nome", "objetivo", "conteudo", "evidencia"]) if (!x[campo]?.trim()) e(`missão ${x.chave} sem ${campo}`);
    if (/domín|sem erro/i.test(`${x.nome} ${x.objetivo}`)) e(`missão ${x.chave} promete domínio pelo volume`);
    const principal = linhaPorChave.get(x.assunto);
    if (!principal || principal.materia !== x.materia) e(`missão ${x.chave} aponta assunto de outra matéria ou inexistente: ${x.assunto}`);
    else if (destino.get(x.assunto) > x.semana) e(`missão ${x.chave} usa ${x.assunto}, que só aparece na semana ${destino.get(x.assunto)}`);
    if (!x.linhas?.includes(x.assunto)) e(`missão ${x.chave}: o assunto principal deve estar em linhas`);
    for (const ch of x.linhas ?? []) {
      const l = linhaPorChave.get(ch);
      if (!l || l.materia !== x.materia) e(`missão ${x.chave} cita linha inválida: ${ch}`);
    }
    // a meta é a parcela de questões novas da matéria na semana (6.2)
    const tipoEsperado = eSimulado(x.semana) ? "manual" : "automatica";
    if (x.tipo !== tipoEsperado) e(`missão ${x.chave} deveria ser ${tipoEsperado}`);
    const metaEsperada = eSimulado(x.semana) ? null : calc.normal[x.materia].N;
    if (x.metaQuestoes !== metaEsperada) e(`missão ${x.chave}: meta ${x.metaQuestoes}, orçamento ${metaEsperada}`);
  }
  // soma das metas por semana = questões novas dirigidas da semana
  for (const n of SEMANAS_COM_MISSAO_ESCRITA.filter((s) => !eSimulado(s))) {
    const soma = escritas.filter((x) => x.semana === n).reduce((s, x) => s + x.metaQuestoes, 0);
    if (soma !== calc.totalNormal.N) e(`semana ${n}: metas somam ${soma}, orçamento de questões novas ${calc.totalNormal.N}`);
  }

  if ((m.planos ?? []).length !== 1 || m.planos[0].tipo !== "intensiva") e("um plano 'intensiva' (ciclo pré-edital de 12 semanas)");
  return erros;
}

export function validarParametros({ inicio, turma }) {
  const erros = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(inicio ?? "")) || Number.isNaN(dataUtc(inicio).getTime())) {
    erros.push("--inicio é obrigatório, no formato AAAA-MM-DD");
  } else if (somarDias(inicio, 0) !== inicio) {
    erros.push(`--inicio ${inicio} não é uma data válida`);
  } else if (dataUtc(inicio).getUTCDay() !== 1) {
    erros.push(`--inicio ${inicio} não é segunda-feira (as semanas vão de segunda a domingo)`);
  }
  if (!Number.isInteger(turma) || turma < 1) erros.push("--turma é obrigatório: inteiro ≥ 1 (vira trilhas.versao)");
  return erros;
}

// ── montagem ─────────────────────────────────────────────────────────

export function montarSemanas(m, inicio) {
  const calc = calcularOrcamento(m);
  return m.semanas.map((s) => ({
    ...s,
    inicio: somarDias(inicio, 7 * (s.n - 1)),
    fim: somarDias(inicio, 7 * (s.n - 1) + 6),
    metaQuestoes: eSimulado(s.n) ? totalDe(calc.totalSimulado) : totalDe(calc.totalNormal),
    simulado: eSimulado(s.n) ? `Simulado completo: ${m.orcamento.simuladoCompleto.questoes} questões` : null,
  }));
}

export function montarAtividades(m) {
  const calc = calcularOrcamento(m);
  const leitura = m.orcamento.leituraMinutosPorSemana;
  const sim = m.orcamento.simuladoCompleto;
  const pesos = m.materias.map((x) => x.questoesFgv2024).join("/");
  const atividades = [];
  for (const s of m.semanas) {
    const tab = eSimulado(s.n) ? calc.simulado : calc.normal;
    const doDia = [];
    for (const mat of m.materias) {
      const c = tab[mat.codigo];
      const missao = m.missoes.find((x) => x.semana === s.n && x.materia === mat.codigo);
      const conteudo = missao ? `Missão: ${missao.nome}. ${missao.conteudo}` : `Conteúdo: ${s.sinteses[mat.codigo]}.`;
      doDia.push({ chave: `${mat.sigla}-conteudo`, s: mat.codigo, p: "F",
        t: `${conteudo} Leitura: cerca de ${leitura[mat.codigo]} min. Prática dirigida: ${questoes(c.N)} novas, resolvidas e corrigidas.` });
      doDia.push({ chave: `${mat.sigla}-revisao`, s: mat.codigo, p: "P",
        t: eSimulado(s.n)
          ? `Revisão: ${questoes(c.R)} de erros anteriores, com a causa de cada erro anotada.`
          : `Revisão: ${questoes(c.R)} de erros anteriores e ${c.S} do bloco misto, com a causa de cada erro anotada.` });
    }
    if (eSimulado(s.n)) {
      doDia.push({ chave: "simulado", s: "sim", p: "F",
        t: `Simulado completo: ${sim.questoes} questões (${pesos}) em ${sim.minutosProva / 60} h, depois ${sim.minutosCorrecao / 60} h de correção com a causa de cada erro.` });
    }
    doDia.push({ chave: "escrita", s: "esc", p: "F",
      t: `Escrita (${m.turmaPadrao.horasEscrita} h): ${s.escrita}. Autoavaliação guiada: problema, regra aplicável, aplicação ao caso, conclusão e fonte conferível.` });
    doDia.forEach((a, i) => atividades.push({ ...a, semana: s.n, ordem: i }));
  }
  return atividades;
}

function dadosMissoes(m) {
  const calc = calcularOrcamento(m);
  const leitura = m.orcamento.leituraMinutosPorSemana;
  const min = m.orcamento.minutosPorQuestaoCorrigida;
  const linhaPorChave = new Map(m.anexoII.map((l) => [l.chave, l]));
  const ordemMateria = Object.fromEntries(m.materias.map((x, i) => [x.codigo, i]));
  return [...m.missoes]
    .sort((a, b) => a.semana - b.semana || ordemMateria[a.materia] - ordemMateria[b.materia])
    .map((x, ordem) => {
      const auto = x.tipo === "automatica";
      const dirigidas = auto ? x.metaQuestoes : calc.simulado[x.materia].N;
      return {
        ...x,
        // id pela chave, sem a versão do conteúdo: uma revisão do
        // manifesto atualiza a missão no lugar (o progresso dos alunos
        // continua apontando para ela) em vez de criar uma segunda.
        id: uid(`missao:${x.chave}`),
        ordem,
        prioridade: linhaPorChave.get(x.assunto).prioridade,
        tempo: leitura[x.materia] + dirigidas * min,
        criterio: auto
          ? `Execução: ${x.metaQuestoes} questões novas do recorte resolvidas e corrigidas. A acurácia fica registrada, mas não é exigida nesta primeira passagem.`
          : `Acompanhamento manual: simulado corrigido com a causa de cada erro e ${questoes(dirigidas)} dirigidas da semana corrigidas.`,
        xp: auto ? 3 * x.metaQuestoes : 30,
        origem: `Anexo II CFO PMERJ 2024 (base histórica), linhas ${x.linhas.join(", ")}; desenho pedagógico autoral (docs/conteudo/pmerj-cfo/)`,
      };
    });
}

// ── SQL ──────────────────────────────────────────────────────────────

export function gerarSql(m, { inicio, turma, publicada = false } = {}) {
  const erros = [...validarFonte(m), ...validarParametros({ inicio, turma })];
  if (erros.length) throw new Error(`Trilha PMERJ inválida:\n- ${erros.join("\n- ")}`);

  const tag = m.examTag;
  const semanas = montarSemanas(m, inicio);
  const atividades = montarAtividades(m);
  const missoes = dadosMissoes(m);
  const calc = calcularOrcamento(m);
  const trilhaSql = `(select id from trilhas where nicho = ${sql(m.nicho)} and versao = ${turma})`;
  const c = m.concurso;
  const obsAssunto = (l) => `${l.chave} · Anexo II do edital CFO PMERJ 2024, ${l.materia}, linha ${l.posicao} · FGV 2024: ${l.questoesFgv2024} · base histórica; aplicabilidade ao próximo ciclo provisória`;
  const destino = destinoDasLinhas(m).destino;

  const linhasAssuntos = m.anexoII.map((l) => [uid(`assunto:${tag}:${l.chave}`), l.materia, l.texto, l.prioridade, obsAssunto(l), l.posicao]);
  const linhasMaterias = m.materias.map((x) => [x.codigo, x.nome, x.abrev, 100 + x.ordem]);
  const disciplinas = [...m.materias, ...m.disciplinasOperacionais].map((d, ordem) => [d.codigo, d.nome, d.abrev, d.cor, ordem]);
  const linhasSemanas = semanas.map((s) => [s.n, s.inicio, s.fim, s.foco, s.simulado, s.metaQuestoes]);
  const linhasAtividades = atividades.map((a) => [uid(`atividade:${m.nicho}:turma-${turma}:${a.semana}:${a.chave}`), a.semana, a.s, a.p, a.t, a.ordem]);
  const linhasMissoes = missoes.map((x) => [
    x.id, x.materia, uid(`assunto:${tag}:${x.assunto}`), x.nome, x.objetivo, x.prioridade,
    x.metaQuestoes, x.tempo, x.criterio, x.evidencia, x.xp, x.origem, x.ordem, x.metaQuestoes,
  ]);
  const linhasPlano = missoes.map((x) => [x.id, x.semana, x.ordem]);
  const plano = m.planos[0];
  const metasPorSemana = SEMANAS_COM_MISSAO_ESCRITA.filter((n) => !eSimulado(n));

  return `-- ============================================================
-- TRILHA CFO PMERJ — PRÉ-EDITAL · turma ${turma}, início ${inicio}
-- GERADO por scripts/gerar-seed-trilha-pmerj-cfo.mjs a partir de
-- ${FONTE_REL} (${m.conteudoVersao}). NÃO editar à mão.
-- Datas: parâmetro --inicio (${inicio}); nada no manifesto é data.
-- Programa: ${m.fontePrograma}.
-- Idempotente: rodar de novo com a mesma turma e o mesmo início não
-- duplica nem muda nada. Com outro início, RECUSA (turma em andamento
-- não muda de data). Não carimba concursos.maturidade (seed 18).
-- APLICAÇÃO: só com autorização do dono (P0.6).
-- ============================================================

begin;

-- 1) Concurso. Data da prova vazia: aguardando edital (0062). Num
--    concurso que já existe, não toca data nem maturidade.
insert into concursos (id, codigo, nome, organizacao, nivel, mes_prova, dia_prova, observacao, ordem, status_dado)
values (${sql(uid(`concurso:${tag}`))}, ${sql(c.codigo)}, ${sql(c.nome)}, ${sql(c.organizacao)}, ${sql(c.nivel)}, null, null, ${sql(c.observacao)}, ${c.ordem}, ${sql(m.statusDado)})
on conflict (codigo) do update set
  nome = excluded.nome,
  organizacao = excluded.organizacao,
  nivel = excluded.nivel,
  observacao = excluded.observacao,
  status_dado = excluded.status_dado;

-- 2) Matérias jurídicas (catálogo global; mesmo código em disciplinas).
insert into materias (codigo, nome, abrev, ordem)
values
${valores(linhasMaterias)}
on conflict (codigo) do update set
  nome = excluded.nome,
  abrev = excluded.abrev,
  ordem = excluded.ordem;

-- 3) As ${m.anexoII.length} linhas do Anexo II, texto literal. Id estável pela chave
--    (ADM-01…): uma retificação de texto atualiza a linha, não duplica.
insert into assuntos (id, exam_tag, materia_codigo, nome, prioridade, status_dado, observacao, ordem)
select a.id::uuid, ${sql(tag)}, a.materia_codigo, a.nome, a.prioridade, 'oficial', a.observacao, a.ordem
  from (values
${valores(linhasAssuntos)}
  ) as a(id, materia_codigo, nome, prioridade, observacao, ordem)
on conflict (id) do update set
  materia_codigo = excluded.materia_codigo,
  nome = excluded.nome,
  prioridade = excluded.prioridade,
  status_dado = excluded.status_dado,
  observacao = excluded.observacao,
  ordem = excluded.ordem;

-- 4) Missões escritas (semanas ${SEMANAS_COM_MISSAO_ESCRITA[0]}–${SEMANAS_COM_MISSAO_ESCRITA.at(-1)}). As ${m.missoesPendentes.length} das semanas seguintes
--    estão marcadas como pendentes no manifesto e não entram no banco.
--    Semana de simulado: meta vazia = acompanhamento manual (fora da fila).
insert into missoes
  (id, exam_tag, materia_codigo, assunto_id, nivel, nome, objetivo, prioridade,
   qtd_questoes_sugerida, tempo_estimado_min, criterio_conclusao,
   criterio_excelencia, xp_sugerido, origem, status_dado, ordem,
   meta_questoes, meta_acuracia)
select d.id::uuid, ${sql(tag)}, d.materia_codigo, d.assunto_id::uuid, 'base', d.nome, d.objetivo,
       d.prioridade, d.qtd::int, d.tempo::int, d.criterio, d.excelencia, d.xp::int,
       d.origem, ${sql(m.statusDado)}, d.ordem::int, d.meta::int, null
  from (values
${valores(linhasMissoes)}
  ) as d(id, materia_codigo, assunto_id, nome, objetivo, prioridade, qtd, tempo, criterio, excelencia, xp, origem, ordem, meta)
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

-- 5) Plano e semana sugerida de cada missão (metadado; a fila do motor
--    segue missoes.ordem).
insert into trilha_planos (exam_tag, tipo, nome, descricao, status_dado, ordem)
values (${sql(tag)}, ${sql(plano.tipo)}, ${sql(plano.nome)}, ${sql(plano.descricao)}, ${sql(m.statusDado)}, ${plano.ordem})
on conflict (exam_tag, tipo) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  status_dado = excluded.status_dado,
  ordem = excluded.ordem;

insert into trilha_plano_missoes (plano_id, missao_id, fase, semana_sugerida, ordem)
select (select id from trilha_planos where exam_tag = ${sql(tag)} and tipo = ${sql(plano.tipo)}),
       p.missao_id::uuid, 'Primeira passagem', p.semana::int, p.ordem::int
  from (values
${valores(linhasPlano)}
  ) as p(missao_id, semana, ordem)
on conflict (plano_id, missao_id) do update set
  fase = excluded.fase,
  semana_sugerida = excluded.semana_sugerida,
  ordem = excluded.ordem;

-- 6) Turma ${turma}. Trava: se a turma já existe com outro início, para aqui.
do $$
declare v_inicio date;
begin
  select s.inicio into v_inicio
    from trilha_semanas s join trilhas t on t.id = s.trilha_id
   where t.nicho = ${sql(m.nicho)} and t.versao = ${turma} and s.numero = 1;
  if v_inicio is not null and v_inicio <> date ${sql(inicio)} then
    raise exception 'turma % do % já existe com início %, e não %: as datas de uma turma não mudam. Gere uma turma nova (--turma).',
      ${turma}, ${sql(m.nicho)}, v_inicio, date ${sql(inicio)};
  end if;
end $$;

insert into trilhas (id, nicho, nome, versao, publicada)
values (${sql(uid(`trilha:${m.nicho}:turma-${turma}`))}, ${sql(m.nicho)}, ${sql(m.nome)}, ${turma}, ${publicada})
on conflict (nicho, versao) do update set
  nome = excluded.nome,
  -- rodar de novo sem --publicada não despublica uma turma em uso;
  -- despublicar é decisão manual, fora do gerador.
  publicada = trilhas.publicada or excluded.publicada;

insert into disciplinas (id, trilha_id, codigo, nome, abrev, cor, ordem)
select gen_random_uuid(), ${trilhaSql}, d.codigo, d.nome, d.abrev, d.cor, d.ordem::int
  from (values
${valores(disciplinas)}
  ) as d(codigo, nome, abrev, cor, ordem)
on conflict (trilha_id, codigo) do update set
  nome = excluded.nome,
  abrev = excluded.abrev,
  cor = excluded.cor,
  ordem = excluded.ordem;

insert into trilha_semanas (id, trilha_id, numero, inicio, fim, foco, simulado, meta_questoes)
select gen_random_uuid(), ${trilhaSql}, s.numero::int, s.inicio::date, s.fim::date, s.foco, s.simulado, s.meta::int
  from (values
${valores(linhasSemanas)}
  ) as s(numero, inicio, fim, foco, simulado, meta)
on conflict (trilha_id, numero) do update set
  foco = excluded.foco,
  simulado = excluded.simulado,
  meta_questoes = excluded.meta_questoes;

insert into atividades_modelo (id, trilha_id, semana_numero, disciplina_codigo, prioridade, texto, ordem)
select a.id::uuid, ${trilhaSql}, a.semana::int, a.disciplina, a.prioridade, a.texto, a.ordem::int
  from (values
${valores(linhasAtividades)}
  ) as a(id, semana, disciplina, prioridade, texto, ordem)
on conflict (id) do update set
  semana_numero = excluded.semana_numero,
  disciplina_codigo = excluded.disciplina_codigo,
  prioridade = excluded.prioridade,
  texto = excluded.texto,
  ordem = excluded.ordem;

-- 7) Conferência: se algo não bate, a transação inteira volta.
do $$
declare
  v_trilha uuid := ${trilhaSql};
  n int;
begin
  -- linhas e missões do banco que o manifesto não tem mais: uma versão
  -- nova que tira itens precisa de um mapa explícito, não de sobra calada.
  select count(*) into n from assuntos where exam_tag = ${sql(tag)} and id <> all (array[${linhasAssuntos.map((l) => `${sql(l[0])}::uuid`).join(", ")}]);
  if n <> 0 then raise exception 'PMERJ: % assunto(s) no banco fora do manifesto; mapeie antes de reaplicar', n; end if;
  select count(*) into n from assuntos where exam_tag = ${sql(tag)};
  if n <> ${m.anexoII.length} then raise exception 'PMERJ: % assuntos, esperados ${m.anexoII.length}', n; end if;
  select count(*) into n from missoes where exam_tag = ${sql(tag)} and id <> all (array[${missoes.map((x) => `${sql(x.id)}::uuid`).join(", ")}]);
  if n <> 0 then raise exception 'PMERJ: % missão(ões) no banco fora do manifesto; mapeie antes de reaplicar', n; end if;
  select count(*) into n from missoes where exam_tag = ${sql(tag)};
  if n <> ${missoes.length} then raise exception 'PMERJ: % missões, esperadas ${missoes.length}', n; end if;
  select count(*) into n from trilha_semanas where trilha_id = v_trilha;
  if n <> ${SEMANAS} then raise exception 'PMERJ turma ${turma}: % semanas, esperadas ${SEMANAS}', n; end if;
  select count(*) into n from atividades_modelo where trilha_id = v_trilha;
  if n <> ${atividades.length} then raise exception 'PMERJ turma ${turma}: % atividades, esperadas ${atividades.length}', n; end if;
  select count(*) into n from trilha_semanas where trilha_id = v_trilha
     and (fim - inicio <> 6 or extract(isodow from inicio) <> 1);
  if n <> 0 then raise exception 'PMERJ turma ${turma}: % semanas fora de segunda a domingo', n; end if;
  -- orçamento: soma das metas das missões automáticas = questões novas da semana
  select count(*) into n from (
    select tpm.semana_sugerida, sum(mi.meta_questoes) as soma
      from trilha_plano_missoes tpm join missoes mi on mi.id = tpm.missao_id
     where mi.exam_tag = ${sql(tag)} and tpm.semana_sugerida in (${metasPorSemana.join(", ")})
     group by tpm.semana_sugerida
  ) x where x.soma <> ${calc.totalNormal.N};
  if n <> 0 then raise exception 'PMERJ: metas de % semana(s) não somam ${calc.totalNormal.N}', n; end if;
end $$;

commit;
`;
}

// ── CLI ──────────────────────────────────────────────────────────────

function lerArgs(argv) {
  const a = { publicada: false };
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    if (k === "--inicio") a.inicio = argv[++i];
    else if (k === "--turma") a.turma = Number(argv[++i]);
    else if (k === "--saida") a.saida = argv[++i];
    else if (k === "--publicada") a.publicada = true;
    else if (k === "--validar") a.validar = true;
    else throw new Error(`argumento desconhecido: ${k}`);
  }
  return a;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const args = lerArgs(process.argv.slice(2));
    const m = carregarFonte();
    if (args.validar) {
      const erros = validarFonte(m);
      if (erros.length) { console.error(`❌ ${erros.length} erro(s):\n- ${erros.join("\n- ")}`); process.exit(1); }
      const calc = calcularOrcamento(m);
      console.log(`✓ manifesto íntegro: ${m.anexoII.length} linhas com destino, ${m.missoes.length} missões escritas, ${m.missoesPendentes.length} pendentes; semana normal ${totalDe(calc.totalNormal)}, com simulado ${totalDe(calc.totalSimulado)}`);
      process.exit(0);
    }
    const saida = gerarSql(m, args);
    if (args.saida) {
      writeFileSync(args.saida, saida);
      console.error(`✓ ${args.saida}: turma ${args.turma}, início ${args.inicio}`);
    } else {
      process.stdout.write(saida);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
