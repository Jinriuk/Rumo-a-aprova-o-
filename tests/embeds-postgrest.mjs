// Leitura estática dos embeds do PostgREST no código que fala com o banco.
// ------------------------------------------------------------------------
// As funções de parsing são puras (texto entra, estrutura sai).
// `consultasDoCodigo` é a única que lê disco: varre app/src e
// supabase/functions. Quem usa: embeds-ambiguos.test.mjs e
// embeds-ambiguos-db.test.mjs.
//
// POR QUE EXISTE
// Em 25/09/2026 a 0055 criou 16 FKs compostas "_mesma_escola_" ao lado das
// FKs simples. O PostgREST passou a ver DUAS relações em cada par e todo
// embed sem hint nesses pares virou HTTP 300 (PGRST201): painel da
// coordenação, ficha do aluno, tela do aluno e área do responsável. Nada no
// CI pegava, porque o gate roda SQL direto, sem PostgREST.
//
// O que conta como embed: `nome(...)`, `alias:nome(...)`, `nome!hint(...)`,
// `nome!inner(...)`, `nome!hint!inner(...)`. O que NÃO conta: cast
// (`coluna::text`), agregação (`count()`), operador JSON (`dados->x`).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const MODIFICADORES_JOIN = new Set(["inner", "left"]);

// Número da linha (1-based) de um índice no texto.
function linhaDe(fonte, indice) {
  let n = 1;
  for (let i = 0; i < indice && i < fonte.length; i++) if (fonte[i] === "\n") n++;
  return n;
}

// Lê um literal de string JS a partir de `i` (aspas, apóstrofo ou crase sem
// interpolação). Devolve { valor, fim } ou null se não for literal simples.
function lerLiteral(fonte, i) {
  const q = fonte[i];
  if (q !== '"' && q !== "'" && q !== "`") return null;
  let valor = "";
  for (let j = i + 1; j < fonte.length; j++) {
    const c = fonte[j];
    if (c === "\\") { valor += fonte[j + 1]; j++; continue; }
    if (q === "`" && c === "$" && fonte[j + 1] === "{") return null; // interpolado
    if (c === q) return { valor, fim: j + 1 };
    valor += c;
  }
  return null;
}

// Pula espaço e comentários a partir de `i`.
function pularBranco(fonte, i) {
  for (;;) {
    while (i < fonte.length && /\s/.test(fonte[i])) i++;
    if (fonte.startsWith("//", i)) { while (i < fonte.length && fonte[i] !== "\n") i++; continue; }
    if (fonte.startsWith("/*", i)) { const f = fonte.indexOf("*/", i + 2); i = f < 0 ? fonte.length : f + 2; continue; }
    return i;
  }
}

// Toda consulta `.from("tabela")` com o `.select(...)` que a segue na mesma
// cadeia. A cadeia termina no próximo `.from(` ou `.rpc(`. `select` é null
// quando a cadeia não tem select; `literal` é false quando o argumento do
// select não é uma string fixa (o teste reprova: não dá para auditar).
export function extrairConsultas(fonte) {
  const consultas = [];
  const reFrom = /\.from\(\s*/g;
  const marcas = [];
  let m;
  while ((m = reFrom.exec(fonte))) {
    const lit = lerLiteral(fonte, m.index + m[0].length);
    if (!lit) continue; // Array.from({ length }) etc.
    marcas.push({ tabela: lit.valor, inicio: m.index, depoisDoFrom: lit.fim });
  }
  const reRpc = /\.rpc\(/g;
  const rpcs = [];
  while ((m = reRpc.exec(fonte))) rpcs.push(m.index);

  for (let k = 0; k < marcas.length; k++) {
    const { tabela, inicio, depoisDoFrom } = marcas[k];
    let limite = k + 1 < marcas.length ? marcas[k + 1].inicio : fonte.length;
    for (const r of rpcs) if (r > depoisDoFrom && r < limite) { limite = r; break; }
    const trecho = fonte.slice(depoisDoFrom, limite);
    const s = /\.select\(/.exec(trecho);
    if (!s) { consultas.push({ tabela, select: null, literal: true, linha: linhaDe(fonte, inicio) }); continue; }
    const posArg = pularBranco(fonte, depoisDoFrom + s.index + s[0].length);
    if (fonte[posArg] === ")") { consultas.push({ tabela, select: null, literal: true, linha: linhaDe(fonte, inicio) }); continue; }
    const lit = lerLiteral(fonte, posArg);
    consultas.push({
      tabela,
      select: lit ? lit.valor : null,
      literal: !!lit,
      linha: linhaDe(fonte, depoisDoFrom + s.index),
    });
  }
  return consultas;
}

// Divide `a, b(c, d), e` no nível de cima (respeita parênteses).
function dividirNoTopo(texto) {
  const partes = [];
  let prof = 0, atual = "";
  for (const c of texto) {
    if (c === "(") prof++;
    if (c === ")") prof--;
    if (c === "," && prof === 0) { partes.push(atual); atual = ""; continue; }
    atual += c;
  }
  if (atual.trim()) partes.push(atual);
  return partes.map((p) => p.trim()).filter(Boolean);
}

// Árvore de embeds de uma string de select. Cada embed:
//   { origem, alvo, hints: [..], juncao: "inner"|"left"|null, alias, texto }
// `origem` é a tabela de onde o embed parte (a raiz ou o embed pai).
export function extrairEmbeds(select, tabelaRaiz) {
  const embeds = [];
  const visitar = (texto, origem) => {
    for (const item of dividirNoTopo(texto)) {
      const abre = item.indexOf("(");
      if (abre < 0) continue;
      if (!item.endsWith(")")) continue;
      let cabeca = item.slice(0, abre).trim();
      const interno = item.slice(abre + 1, -1);
      if (cabeca === "" || /->|::/.test(cabeca)) continue;
      let alias = null;
      const doisPontos = cabeca.indexOf(":");
      if (doisPontos >= 0) { alias = cabeca.slice(0, doisPontos).trim(); cabeca = cabeca.slice(doisPontos + 1).trim(); }
      if (cabeca.startsWith("...")) cabeca = cabeca.slice(3).trim(); // spread
      const [alvo, ...mods] = cabeca.split("!").map((x) => x.trim());
      if (!/^[a-z_][a-z0-9_]*$/i.test(alvo)) continue;
      if (["count", "sum", "avg", "min", "max"].includes(alvo) && interno.trim() === "") continue;
      const hints = mods.filter((x) => !MODIFICADORES_JOIN.has(x));
      const juncao = mods.find((x) => MODIFICADORES_JOIN.has(x)) ?? null;
      embeds.push({ origem, alvo, hints, juncao, alias, texto: item });
      visitar(interno, alvo);
    }
  };
  visitar(select, tabelaRaiz);
  return embeds;
}

// Chave canônica de um par (a ordem não importa: o PostgREST resolve o
// embed nos dois sentidos, M2O e O2M, e a ambiguidade é a mesma).
export function chavePar(a, b) {
  return [a, b].sort().join(" <-> ");
}

// Onde o código fala com o PostgREST: o front e as Edge Functions.
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const PASTAS_COM_CONSULTA = ["app/src", "supabase/functions"];

function* arquivosDeCodigo(pasta) {
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) {
      if (nome !== "node_modules") yield* arquivosDeCodigo(caminho);
    } else if (/\.(m?js|jsx|ts|tsx)$/.test(nome)) {
      yield caminho;
    }
  }
}

// Toda consulta do código, com `onde` = "arquivo:linha".
export function consultasDoCodigo() {
  const todas = [];
  for (const pasta of PASTAS_COM_CONSULTA) {
    for (const arq of arquivosDeCodigo(join(RAIZ, pasta))) {
      const rel = relative(RAIZ, arq);
      for (const c of extrairConsultas(readFileSync(arq, "utf8"))) todas.push({ ...c, onde: `${rel}:${c.linha}` });
    }
  }
  return todas;
}

// Todo embed do código, achatado, com a consulta de onde veio.
export function embedsDoCodigo() {
  return consultasDoCodigo()
    .filter((c) => c.select)
    .flatMap((c) => extrairEmbeds(c.select, c.tabela).map((e) => ({ ...e, onde: c.onde })));
}
