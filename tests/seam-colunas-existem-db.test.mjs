// ============================================================
// TODA COLUNA QUE O SEAM PEDE PRECISA EXISTIR NO BANCO
// ------------------------------------------------------------
// Por que este teste existe, com nome e data:
//
// A Onda 5 (PR #110, bloco 12 / T38) quis trocar o código cru da matéria
// ("qui", "mat") pelo nome real na Trilha do Concurso. Para isso passou a
// pedir `prova_materias.nome`. Essa coluna NUNCA existiu: `prova_materias`
// guarda a estrutura da prova por exam_tag e identifica a matéria só pelo
// código; o nome mora no catálogo `materias`.
//
// O PostgREST responde 42703 e o seam converte em exceção. Como a leitura
// está num Promise.all dentro de `carregarPlanoConcurso`, a exceção derruba
// a função inteira — e `TrilhaConcurso` cai no ramo de erro e renderiza
// "Trilha temporariamente indisponível". Para TODO aluno, em TODO concurso,
// de 14/09 a 20/09/2026.
//
// Seis dias no ar, suíte verde o tempo todo. Os testes de tela deste repo
// são inspeção de fonte: eles leem o JSX e conferem que a string certa está
// lá. Nenhum deles fala com o banco, então nenhum deles consegue saber se a
// coluna pedida existe. O defeito só apareceu quando alguém foi tirar print
// da tela para o material comercial.
//
// Este teste fecha essa classe inteira: varre o seam, extrai cada
// `.from("tabela").select("col, col, embed(col)")` e confere coluna por
// coluna contra o information_schema do banco de teste. É barato e pega o
// erro no CI, não na tela do aluno.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./identidades.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SEAM = resolve(root, "app/src/shared/data/index.js");

test.after(async () => { await pool.end(); });

/* Divide "a, b, tabela(x, y), c" nas vírgulas de PRIMEIRO nível. */
function partesDeTopo(spec) {
  const partes = [];
  let profundidade = 0, atual = "";
  for (const ch of spec) {
    if (ch === "(") profundidade += 1;
    if (ch === ")") profundidade -= 1;
    if (ch === "," && profundidade === 0) { partes.push(atual); atual = ""; continue; }
    atual += ch;
  }
  if (atual.trim()) partes.push(atual);
  return partes.map((p) => p.trim()).filter(Boolean);
}

/* Achata o select numa lista de { tabela, coluna }.
   Trata embed (`escolas(id, nome)`), alias (`x:escolas(id)`) e
   modificador de join (`missoes!inner(exam_tag)`). */
function colunasPedidas(tabela, spec, saida = []) {
  for (const parte of partesDeTopo(spec)) {
    const embed = parte.match(/^([^()]+)\(([\s\S]*)\)$/);
    if (embed) {
      let alvo = embed[1].trim();
      if (alvo.includes(":")) alvo = alvo.split(":").pop().trim();   // alias
      alvo = alvo.split("!")[0].trim();                               // !inner
      colunasPedidas(alvo, embed[2], saida);
      continue;
    }
    const col = parte.split(":").pop().trim();                        // renome
    if (!col || col === "*" || col.includes("...")) continue;
    if (/[^a-z0-9_]/i.test(col)) continue;                            // agregados etc.
    saida.push({ tabela, coluna: col });
  }
  return saida;
}

test("seam: toda coluna pedida em .select() existe no banco", async () => {
  const src = readFileSync(SEAM, "utf8");

  // `.from("tabela")` seguido, no mesmo encadeamento, de `.select("...")`.
  const pedidos = [];
  const re = /\.from\(\s*"([a-z0-9_]+)"\s*\)\s*\r?\n?\s*\.select\(\s*"([\s\S]*?)"\s*[,)]/g;
  for (let m; (m = re.exec(src)) !== null; ) {
    const [, tabela, spec] = m;
    if (spec.trim() === "*") continue;
    pedidos.push(...colunasPedidas(tabela, spec));
  }

  assert.ok(pedidos.length > 20,
    `o extrator achou só ${pedidos.length} colunas — o padrão de .select() mudou e este teste parou de cobrir o seam`);

  const { rows } = await pool.query(
    `select table_name, column_name from information_schema.columns where table_schema='public'`,
  );
  const existe = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
  const tabelasConhecidas = new Set(rows.map((r) => r.table_name));

  const faltando = [];
  for (const { tabela, coluna } of pedidos) {
    // tabela que não existe no banco de teste é outro assunto (algumas
    // estruturas são opcionais e o seam degrada de propósito); aqui só
    // interessa coluna ausente numa tabela que EXISTE.
    if (!tabelasConhecidas.has(tabela)) continue;
    if (!existe.has(`${tabela}.${coluna}`)) faltando.push(`${tabela}.${coluna}`);
  }

  assert.deepEqual(
    [...new Set(faltando)].sort(), [],
    "o seam pede coluna que não existe — o PostgREST devolve 42703 e a tela que depender desta leitura morre",
  );
});

test("regressão T38: o nome da matéria vem do catálogo, não de prova_materias", async () => {
  // trava específica do defeito que originou este arquivo.
  const { rows } = await pool.query(
    `select column_name from information_schema.columns
      where table_schema='public' and table_name='prova_materias' and column_name='nome'`,
  );
  assert.equal(rows.length, 0,
    "se prova_materias.nome passar a existir, revise carregarNomesMateria — o comentário dela afirma o contrário");

  const src = readFileSync(SEAM, "utf8");
  assert.doesNotMatch(src, /from\("prova_materias"\)\s*\.select\("[^"]*\bnome\b/,
    "voltou a pedir prova_materias.nome — é a leitura que derrubava a Trilha do Concurso");
  assert.match(src, /from\("materias"\)\s*\.select\("codigo, nome"\)/,
    "o catálogo de matérias deixou de ser lido; a trilha volta a mostrar código cru");
});
