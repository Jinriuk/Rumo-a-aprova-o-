// ============================================================
// VALIDADOR DE CONTEÚDO (PED2) — integridade + maturidade honesta
// ------------------------------------------------------------
// Roda OFFLINE (sem banco): cruza a matriz de maturidade (fonte única
// app/src/modules/conteudo/maturidade.js) com o conteúdo REAL dos
// seeds. Falha (exit 1) se:
//   • um concurso é exibível como mais pronto do que o conteúdo permite
//     (ex.: 'completa'/'beta' sem assunto catalogado, 'completa' sem
//      trilha semanal);
//   • a matriz e o seed de concursos divergem (concurso sem maturidade
//     ou maturidade de concurso inexistente);
//   • há furo de integridade: semana vazia, assunto sem nome, matéria
//     sem código (slug), plano de trilha apontando concurso inexistente;
//   • o seed gerado (13_maturidade_concursos.sql) está dessincronizado
//     da fonte única.
//
// Uso:  node scripts/validar-conteudo.mjs
// Exit: 0 = ok   1 = falhou   2 = erro de uso/leitura
//
// As funções são exportadas para tests/conteudo-maturidade.test.mjs.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MATURIDADE_CONCURSOS, NIVEIS_MATURIDADE, REQUISITOS_MATURIDADE,
} from "../app/src/modules/conteudo/maturidade.js";

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const lerRaw = (rel) => readFileSync(join(RAIZ, rel), "utf8");

// Remove comentários SQL (`-- linha` e `/* bloco */`) — senão um `;`
// dentro de comentário trunca a extração do bloco. Para arquivos JSON
// use lerRaw diretamente.
export function semComentarios(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}
const ler = (rel) => semComentarios(lerRaw(rel));

// ------------------------------------------------------------
// Mini-parser de seed: isola o bloco `insert into <tabela> ... ;` e
// detecta a presença de um token 'codigo' dentro dele. Presença
// (booleana) basta para os invariantes — não precisamos de contagem.
// ------------------------------------------------------------
export function blocoInsert(sql, tabela) {
  // Vai de `insert into <tabela>` até o próximo `insert into` (ou EOF).
  // Evita parar num `;` que esteja DENTRO de string (ex.: observações
  // com ponto-e-vírgula) — bem mais robusto que casar até o `;`.
  const re = new RegExp(`insert\\s+into\\s+${tabela}\\b[\\s\\S]*?(?=insert\\s+into\\b|$)`, "i");
  const m = sql.match(re);
  return m ? m[0] : "";
}
export function temTag(bloco, codigo) {
  return new RegExp(`'${codigo}'`).test(bloco);
}

// Códigos de concurso declarados no seed 05_concursos.sql.
export function concursosDoSeed() {
  const bloco = blocoInsert(ler("supabase/seed/05_concursos.sql"), "concursos");
  // cada linha de valor começa com (uuid, 'codigo', ...) → 2º token
  const cods = [...bloco.matchAll(/'[0-9a-f-]{36}',\s*'([a-z0-9_]+)'/gi)].map((m) => m[1]);
  return [...new Set(cods)];
}

// Conteúdo real por concurso a partir dos seeds (presença booleana).
export function conteudoRealPorConcurso() {
  const provas = ler("supabase/seed/07_provas.sql");
  const trilhas = ler("supabase/seed/09_trilhas_missoes.sql");
  const blocoProvaMaterias = blocoInsert(provas, "prova_materias");
  const blocoAssuntos = blocoInsert(provas, "assuntos");
  const blocoMissoes = blocoInsert(trilhas, "missoes");
  const blocoPlanos = blocoInsert(trilhas, "trilha_planos");
  const out = {};
  for (const cod of concursosDoSeed()) {
    out[cod] = {
      provaOficial: temTag(blocoProvaMaterias, cod),
      assuntos: temTag(blocoAssuntos, cod),
      missoes: temTag(blocoMissoes, cod),
      planos: temTag(blocoPlanos, cod),
      // trilha semanal: a matriz aponta o arquivo; existe e parseia?
      trilhaSemanal: trilhaSemanalPresente(cod),
    };
  }
  return out;
}

// A trilha semanal é "presente" quando a matriz aponta um ref e o
// arquivo existe (hoje, só o CN). Liga maturidade 'completa' a um
// calendário real — não à palavra.
export function trilhaSemanalPresente(codigo) {
  const ref = MATURIDADE_CONCURSOS[codigo]?.trilhaSemanalRef;
  return Boolean(ref && existsSync(join(RAIZ, ref)));
}

// Integridade da trilha semanal do CN (fonte: JSON estruturado).
export function integridadeTrilhaSemanal() {
  const erros = [];
  const t = JSON.parse(lerRaw("supabase/seed/trilha-cn-v1.json"));
  if (!t.semanas?.length) erros.push("trilha-cn: sem semanas");
  // tarefas ficam aninhadas em cada semana: { s: disciplina, p: prioridade, t: texto }
  const codigosDisc = new Set((t.disciplinas ?? []).map((d) => d.codigo));
  for (const s of t.semanas ?? []) {
    const tarefas = s.tarefas ?? [];
    if (!tarefas.length) erros.push(`trilha-cn: semana ${s.n} VAZIA (sem tarefas)`);
    if (!s.foco || !String(s.foco).trim()) erros.push(`trilha-cn: semana ${s.n} sem foco`);
    for (const a of tarefas) {
      if (!a.s) erros.push(`trilha-cn: tarefa sem disciplina (semana ${s.n})`);
      else if (codigosDisc.size && !codigosDisc.has(a.s)) erros.push(`trilha-cn: tarefa com disciplina '${a.s}' fora do catálogo (semana ${s.n})`);
      if (!a.t || !String(a.t).trim()) erros.push(`trilha-cn: tarefa sem texto (semana ${s.n})`);
    }
  }
  return erros;
}

// Integridade de matérias/assuntos/planos nos seeds (sem banco).
export function integridadeConteudo() {
  const erros = [];
  const provas = ler("supabase/seed/07_provas.sql");
  const trilhas = ler("supabase/seed/09_trilhas_missoes.sql");

  // matéria sem slug (codigo): 1º token de cada tupla do bloco materias
  const blocoMaterias = blocoInsert(provas, "materias");
  for (const tup of [...blocoMaterias.matchAll(/\(\s*('?[^,]*'?)\s*,/g)]) {
    const cod = tup[1].replace(/'/g, "").trim();
    if (!cod) erros.push("materia sem código (slug) no seed 07");
  }

  // assunto sem nome: o nome é o 4º campo textual; checa aspas vazias
  if (/,\s*''\s*,/.test(blocoInsert(provas, "assuntos"))) {
    erros.push("assunto com nome vazio no seed 07");
  }

  // plano de trilha apontando concurso inexistente (trilha sem concurso)
  const codigos = new Set(concursosDoSeed());
  const blocoPlanos = blocoInsert(trilhas, "trilha_planos");
  const tagsPlano = [...blocoPlanos.matchAll(/'([a-z0-9_]+)',\s*'(anual|semestral|intensiva|reta_final)'/gi)].map((m) => m[1]);
  for (const tag of new Set(tagsPlano)) {
    if (!codigos.has(tag)) erros.push(`trilha_plano com exam_tag '${tag}' sem concurso correspondente`);
  }
  return erros;
}

// Paridade: o seed 13 commitado bate com a fonte única?
export function seedMaturidadeEmDia() {
  const erros = [];
  const seed = ler("supabase/seed/13_maturidade_concursos.sql");
  for (const c of Object.values(MATURIDADE_CONCURSOS)) {
    const re = new RegExp(`maturidade\\s*=\\s*'${c.maturidade}',\\s*conteudo_versao\\s*=\\s*${c.versao}\\s*\\n\\s*where codigo = '${c.codigo}'`);
    if (!re.test(seed)) erros.push(`seed 13 dessincronizado para '${c.codigo}' (esperado ${c.maturidade}/v${c.versao}) — rode scripts/gerar-seed-maturidade.mjs`);
  }
  return erros;
}

// ------------------------------------------------------------
// Validação principal. Devolve { erros, avisos, matriz }.
// ------------------------------------------------------------
export function validar() {
  const erros = [];
  const avisos = [];

  const codigosSeed = new Set(concursosDoSeed());
  const codigosMatriz = new Set(Object.keys(MATURIDADE_CONCURSOS));

  // 1) Matriz × seed de concursos: cobertura mútua.
  for (const c of codigosSeed) {
    if (!codigosMatriz.has(c)) erros.push(`concurso '${c}' está no seed mas SEM maturidade na matriz`);
  }
  for (const c of codigosMatriz) {
    if (!codigosSeed.has(c)) avisos.push(`maturidade declarada para '${c}', que não está no seed de concursos`);
  }

  // 2) Enum válido + CN é a âncora completa.
  for (const c of Object.values(MATURIDADE_CONCURSOS)) {
    if (!NIVEIS_MATURIDADE.includes(c.maturidade)) erros.push(`'${c.codigo}': maturidade inválida '${c.maturidade}'`);
  }
  if (MATURIDADE_CONCURSOS.cn?.maturidade !== "completa") erros.push("CN deixou de ser 'completa' — regressão grave");

  // 3) Maturidade declarada não pode prometer mais do que o conteúdo entrega.
  const real = conteudoRealPorConcurso();
  for (const c of Object.values(MATURIDADE_CONCURSOS)) {
    const req = REQUISITOS_MATURIDADE[c.maturidade];
    const r = real[c.codigo];
    if (!r) continue; // concurso só na matriz (já avisado)
    if (req.provaOficial && !r.provaOficial) erros.push(`'${c.codigo}' declarado '${c.maturidade}' mas NÃO tem estrutura de prova no seed`);
    if (req.assuntos && !r.assuntos) erros.push(`'${c.codigo}' declarado '${c.maturidade}' mas NÃO tem assuntos catalogados`);
    if (req.trilhaSemanal && !r.trilhaSemanal) erros.push(`'${c.codigo}' declarado '${c.maturidade}' mas NÃO tem trilha semanal (calendário)`);
  }

  // 4) Integridade de conteúdo + trilha semanal.
  erros.push(...integridadeTrilhaSemanal());
  erros.push(...integridadeConteudo());

  // 5) Paridade do seed gerado.
  erros.push(...seedMaturidadeEmDia());

  return { erros, avisos, real };
}

// ------------------------------------------------------------
// CLI (só quando chamado direto, não quando importado pelo teste).
// ------------------------------------------------------------
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { erros, avisos, real } = validar();
  console.log("CONTEÚDO POR CONCURSO (presença):");
  for (const [cod, r] of Object.entries(real)) {
    console.log(`  ${cod.padEnd(7)} prova=${r.provaOficial?"✓":"·"} assuntos=${r.assuntos?"✓":"·"} missoes=${r.missoes?"✓":"·"} trilhaSemanal=${r.trilhaSemanal?"✓":"·"}  → ${MATURIDADE_CONCURSOS[cod]?.maturidade ?? "—"}`);
  }
  if (avisos.length) { console.log("\nAVISOS:"); for (const a of avisos) console.log("  • " + a); }
  if (erros.length) {
    console.log(`\n❌ ${erros.length} ERRO(S) DE CONTEÚDO:`);
    for (const e of erros) console.log("  • " + e);
    process.exit(1);
  }
  console.log("\n✓ conteúdo íntegro e maturidade honesta.");
  process.exit(0);
}
