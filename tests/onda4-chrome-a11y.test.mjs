/* Onda 4 — higiene de chrome e acessibilidade (21 itens, blocos 1-9).
   ------------------------------------------------------------
   Mesmo padrão de inspeção de fonte que onda1-cors-modais.test.mjs e
   onda3-ciclo-encerrado.test.mjs: sem GoTrue/navegador no CI, as
   propriedades são travadas lendo o código-fonte, com `semComentarios`
   antes de casar — senão um teste "passa na prosa" (um comentário que
   FALA do conserto sem o conserto existir). Cada teste abaixo foi
   conferido contra a falha: revertendo o arquivo do bloco correspondente,
   o teste quebra. Isso é o que separa "trava o defeito" de "trava a
   redação".

   Itens de LAYOUT (I1, I3, I7, T1, T36, T41, T47, T48) só fecham de
   verdade quando alguém olhar em 1366×768 e 390px — o proxy deste
   ambiente nega CONNECT a *.supabase.co e não há Chromium contra o app
   autenticado. Os testes abaixo travam a PROPRIEDADE estrutural (CSS/
   marcação que implementa a correção), não a aparência renderizada. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const ler = (p) => readFileSync(resolve(root, p), "utf8");
const semComentarios = (f) => f
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:\\])\/\/.*$/gm, "$1");
const lerCodigo = (p) => semComentarios(ler(p));

// ============================================================
// BLOCO 1 — menu que esconde abas (I1, I7)
// ============================================================
test("BLOCO1: .menu-rolagem não suprime mais a barra de rolagem", () => {
  const src = lerCodigo("app/src/shared/ui/MenuPrincipal.jsx");
  // o defeito era isto: rolava, e nada sinalizava.
  assert.doesNotMatch(src, /\.menu-rolagem\s*\{\s*scrollbar-width:\s*none/,
    "scrollbar-width: none ainda suprime a affordance");
  assert.doesNotMatch(src, /\.menu-rolagem::-webkit-scrollbar\s*\{\s*display:\s*none/,
    "::-webkit-scrollbar{display:none} ainda esconde a barra no Chrome/Safari");
});

test("BLOCO1: .menu-rolagem agora tem uma barra visível (Firefox e WebKit/Blink)", () => {
  const src = lerCodigo("app/src/shared/ui/MenuPrincipal.jsx");
  assert.match(src, /\.menu-rolagem\s*\{\s*scrollbar-width:\s*thin/, "sem scrollbar-width: thin (Firefox)");
  assert.match(src, /\.menu-rolagem::-webkit-scrollbar\s*\{\s*width:\s*\d/, "sem largura de scrollbar (Chrome/Safari)");
  assert.match(src, /\.menu-rolagem::-webkit-scrollbar-thumb\s*\{\s*background:/, "sem thumb visível");
});

test("BLOCO1: aluno (8 abas) e coordenação (6, 'marca' por último) — a lista rola dentro do mesmo container sem paginação própria", () => {
  // Confirma que a premissa do defeito (contagem de abas) continua batendo
  // com o catálogo — se um dev reduzir/mudar a lista, este teste avisa.
  const visao = lerCodigo("app/src/routes/aluno/VisaoEstudo.jsx");
  const abasAluno = visao.match(/const ABAS = \[([\s\S]*?)\]\.filter/)?.[1] ?? "";
  const contagemAluno = (abasAluno.match(/\[["']/g) ?? []).length;
  assert.equal(contagemAluno, 8, "VisaoEstudo não tem mais 8 abas — reavaliar se I1/I7 ainda se aplicam");

  const escola = lerCodigo("app/src/routes/escola/AreaEscola.jsx");
  const abasEscola = escola.match(/const ABAS = \[([\s\S]*?)\];/)?.[1] ?? "";
  assert.match(abasEscola, /\["marca", "Marca"/, "a aba Marca sumiu ou mudou de chave — I7 fala dela por nome");
  assert.ok(abasEscola.trim().endsWith('["marca", "Marca", null, "pincel"],'),
    "'marca' não é mais a última aba da coordenação — I7 partia disso");
});
