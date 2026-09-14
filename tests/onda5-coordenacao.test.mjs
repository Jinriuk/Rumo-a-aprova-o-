// ============================================================
// ONDA 5 — COORDENAÇÃO (17 itens, 15 blocos)
// ------------------------------------------------------------
// Mesmo padrão das ondas anteriores: o repo não sobe navegador nem
// renderiza React em CI, então estes testes travam as propriedades
// por INSPEÇÃO DE FONTE (ver onda1-cors-modais.test.mjs), com
// comentários removidos antes de casar os padrões — senão um
// comentário que MENCIONA o padrão errado (documentando o que foi
// corrigido) faria o teste passar sem o código estar certo.
//
// Cada bloco abaixo trava exatamente o que o bloco corrigiu — não
// mais, não menos — para que reverter o código de um bloco quebre
// SÓ os testes dele.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const ler = (p) => readFileSync(resolve(root, p), "utf8");
const semComentarios = (fonte) => fonte
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:\\])\/\/.*$/gm, "$1");
const src = (p) => semComentarios(ler(p));

// ── Bloco 1 (I9): contagem exata de acessos, não logs.length ────────────────
test("I9: data/index.js introduz o padrão count:'exact', head:true", () => {
  const codigo = src("app/src/shared/data/index.js");
  assert.match(
    codigo,
    /export async function contarLogsAcesso/,
    "precisa de uma função dedicada para a contagem exata (separada da listagem limitada)",
  );
  const trechoFn = codigo.slice(codigo.indexOf("export async function contarLogsAcesso"));
  assert.match(
    trechoFn.slice(0, 400),
    /\{\s*count:\s*["']exact["']\s*,\s*head:\s*true\s*\}/,
    "contarLogsAcesso precisa pedir count:'exact', head:true — não baixar o array pra contar no cliente",
  );
});

test("I9: AreaEscola.jsx busca a contagem exata e repassa ao PainelConformidade", () => {
  const codigo = src("app/src/routes/escola/AreaEscola.jsx");
  assert.match(codigo, /db\.contarLogsAcesso\(/, "a tela precisa chamar a nova função de contagem exata");
  assert.match(
    codigo,
    /<PainelConformidade[\s\S]*?logsTotal=\{[^}]+\}/,
    "logsTotal precisa ser passado como prop para o painel",
  );
});

test("I9: o StatCard 'Acessos registrados' usa logsTotal, não logs.length (limitado a 100)", () => {
  const codigo = src("app/src/modules/consentimento/PainelConformidade.jsx");
  assert.match(
    codigo,
    /rotulo="Acessos registrados"\s+valor=\{logsTotal\}/,
    "o card de resumo precisa mostrar a contagem exata, não o tamanho do array de 100",
  );
  assert.doesNotMatch(
    codigo,
    /rotulo="Acessos registrados"\s+valor=\{logs\.length\}/,
    "voltou a usar logs.length (nunca passa de 100) como se fosse o total",
  );
});

test("I9: a lista de baixo continua honesta sobre mostrar só os últimos 100", () => {
  const codigo = src("app/src/modules/consentimento/PainelConformidade.jsx");
  assert.match(codigo, /últimos 100/, "o texto de apoio da trilha de acesso não deveria mudar");
  assert.match(codigo, /logs\.map\(/, "a lista em si continua iterando o array limitado (só o resumo usa a contagem exata)");
});
