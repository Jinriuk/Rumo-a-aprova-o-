// @ts-check
/* ETAPA 3 — H.postgrest.matriz_tabelas: os casos T.*, A.* e R.* da
   camada banco (tests/matriz-autorizacao.mjs), repetidos por HTTP.

   A camada banco assume a persona dentro do Postgres; aqui o token é o
   do Auth local, o corpo e o filtro vão pelo PostgREST como o cliente
   mandaria. O SQL de cada caso é traduzido para a requisição
   equivalente:
     select 1 from T where c = $1   → GET    /T?c=eq.v
     update T set a = x where c = $n → PATCH  /T?c=eq.v   {a: x}
     delete from T where c = $n      → DELETE /T?c=eq.v
     insert into T (...) values (...) [on conflict (k) do update ...]
                                     → POST   /T  (merge-duplicates no upsert)
   Sempre com Prefer: return=representation, devolvendo só a coluna do
   filtro (ou a primeira do insert), como o app faz (`.select("id")`):
   representação completa (`select=*`) na tabela `escolas` pede de volta
   as colunas que a 0058 esconde e dá 403, o que mediria o RETURNING e
   não a RLS. Esse comportamento é conferido à parte, no próprio teste.
   O que não cabe nesses
   moldes fica listado como "sem tradução" (nenhum caso some calado).

   Prova, igual à da camada banco: hash das tabelas como postgres antes e
   depois. Negação só conta com hash igual; 200 com [] e hash igual é
   negação provada. Diferente da camada banco, aqui não há rollback: os
   controles positivos (esperado "permitido") ficam gravados, o que numa
   stack descartável é o certo (a transação é a própria stack). */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { montarCasos } from "../../../tests/matriz-autorizacao.mjs";
import { ACHADOS_ABERTOS } from "../../../tests/matriz-autorizacao-achados.mjs";
import { rest, sql, hashTabelas, mesmoHash } from "../local/api.js";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** Divide por vírgula no nível de cima (fora de aspas e parênteses). */
function dividir(lista) {
  const partes = [];
  let atual = "", nivel = 0, aspas = false;
  for (let i = 0; i < lista.length; i++) {
    const ch = lista[i];
    if (ch === "'" && !aspas) aspas = true;
    else if (ch === "'" && aspas) { if (lista[i + 1] === "'") { atual += "''"; i++; continue; } aspas = false; }
    else if (!aspas && ch === "(") nivel++;
    else if (!aspas && ch === ")") nivel--;
    if (ch === "," && !aspas && nivel === 0) { partes.push(atual.trim()); atual = ""; continue; }
    atual += ch;
  }
  if (atual.trim()) partes.push(atual.trim());
  return partes;
}

/** Valor SQL → valor JSON. Expressão que não é literal é resolvida pelo
 *  próprio Postgres (ex.: subselect de conquista, now() - interval). */
async function valor(expr, params) {
  const e = expr.trim();
  const p = e.match(/^\$(\d+)$/);
  if (p) return params[Number(p[1]) - 1];
  const lit = e.match(/^'((?:[^']|'')*)'$/);
  if (lit) {
    const s = lit[1].replace(/''/g, "'");
    if (/^[[{]/.test(s)) { try { return JSON.parse(s); } catch { /* texto */ } }
    return s;
  }
  if (/^-?\d+(\.\d+)?$/.test(e)) return Number(e);
  if (/^(true|false)$/i.test(e)) return e.toLowerCase() === "true";
  if (/^null$/i.test(e)) return null;
  const [r] = await sql(`select (${e}) as v`);
  return r.v instanceof Date ? r.v.toISOString() : r.v;
}

const filtro = (col, v) => `${col}=eq.${encodeURIComponent(String(v))}`;

/** Traduz um caso para { metodo, caminho, corpo, headers } ou null. */
export async function traduzir(caso) {
  const q = caso.sql.replace(/\s+/g, " ").trim();
  const params = caso.params ?? [];
  let m;

  if ((m = q.match(/^select (.+?) from (\w+)(?: where (\w+) = \$1)?$/i))) {
    const [, cols, t, col] = m;
    // "select 1" mede a RLS da LINHA: pede só a coluna do filtro. Com
    // select=* a tabela escolas negaria pelo grant de coluna (0058), que
    // é outra barreira, e a prova deixaria de ser sobre a RLS
    const select = cols.trim() === "1" ? (col ?? "*") : cols.split(",").map((c) => c.trim()).join(",");
    return { metodo: "GET", caminho: `${t}?select=${select}${col ? `&${filtro(col, params[0])}` : ""}` };
  }
  if ((m = q.match(/^select 1 from public\.(\w+)\(\) where (\w+) (<>|=) \$1$/i))) {
    const [, fn, col, op] = m;
    return { metodo: "GET", caminho: `rpc/${fn}?${col}=${op === "<>" ? "neq" : "eq"}.${params[0]}` };
  }
  if ((m = q.match(/^update (\w+) set (.+) where (\w+) = \$(\d+)$/i))) {
    const [, t, sets, col, n] = m;
    const corpo = {};
    for (const s of dividir(sets)) {
      const [c, ...resto] = s.split("=");
      corpo[c.trim()] = await valor(resto.join("="), params);
    }
    return { metodo: "PATCH", caminho: `${t}?select=${col}&${filtro(col, params[Number(n) - 1])}`, corpo };
  }
  if ((m = q.match(/^delete from (\w+) where (\w+) = \$(\d+)$/i))) {
    const [, t, col, n] = m;
    return { metodo: "DELETE", caminho: `${t}?select=${col}&${filtro(col, params[Number(n) - 1])}` };
  }
  if ((m = q.match(/^insert into (\w+) \(([^)]+)\) values \((.+?)\)(?: on conflict \(([^)]+)\) do update set .+)?$/i))) {
    const [, t, cols, vals, conflito] = m;
    const nomes = cols.split(",").map((c) => c.trim());
    const exprs = dividir(vals);
    if (nomes.length !== exprs.length) return null;
    const corpo = {};
    for (let i = 0; i < nomes.length; i++) corpo[nomes[i]] = await valor(exprs[i], params);
    const headers = conflito ? { Prefer: "return=representation,resolution=merge-duplicates" } : undefined;
    const sel = `select=${nomes[0]}`;
    const caminho = conflito ? `${t}?${sel}&on_conflict=${conflito.split(",").map((c) => c.trim()).join(",")}` : `${t}?${sel}`;
    return { metodo: "POST", caminho, corpo, headers };
  }
  return null;
}

/** O caso tem de bater com o esperado? Mesma regra do teste da camada
 *  banco: achado aberto só diverge enquanto a migration dele não existe. */
export function deveBater(id) {
  const a = ACHADOS_ABERTOS[id];
  if (!a) return true;
  return !!a.corrigidoPor && existsSync(resolve(RAIZ, "supabase/migrations", `${a.corrigidoPor}.sql`));
}

export function casosTAR() {
  return montarCasos().filter((c) => /^[TAR]\./.test(c.id) && ["leitura", "escrita", "rpc"].includes(c.tipo));
}

/** Executa um caso por HTTP com a sessão da persona. */
export async function executarHttp(caso, token) {
  const req = await traduzir(caso);
  if (!req) return { id: caso.id, traduzido: false };
  const antes = await hashTabelas(caso.tabelas);
  const r = await rest(req.caminho, {
    token, method: req.metodo, body: req.corpo,
    headers: { Prefer: "return=representation", ...(req.headers ?? {}) },
  });
  const depois = await hashTabelas(caso.tabelas);
  const inalteradas = mesmoHash(antes, depois);
  const linhas = Array.isArray(r.corpo) ? r.corpo.length : 0;
  const ok2xx = r.status >= 200 && r.status < 300;
  const leitura = caso.tipo === "leitura" || caso.leitura;

  let observado;
  if (leitura) observado = ok2xx && linhas > 0 ? "permitido" : "negado";
  else observado = ok2xx && (linhas > 0 || !inalteradas) ? "permitido" : "negado";
  // negação sem prova de integridade não é negação
  const semProva = observado === "negado" && !inalteradas;

  return {
    id: caso.id, persona: caso.persona, esperado: caso.esperado, observado, traduzido: true,
    requisicao: `${req.metodo} /rest/v1/${req.caminho}`,
    prova: { status: r.status, linhas, codigo: r.corpo?.code ?? null, tabelas_inalteradas: inalteradas },
    semProva,
  };
}
