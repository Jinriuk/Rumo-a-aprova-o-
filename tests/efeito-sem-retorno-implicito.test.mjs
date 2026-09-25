// ============================================================
// ETAPA 3 — efeito do React não devolve valor por acidente
// ------------------------------------------------------------
// Achado do E2E local em 25/09/2026: `useEffect(() => window.scrollTo(…))`
// devolvia o retorno do scrollTo. Nos Chromium novos ele é uma Promise;
// o React guarda o que o efeito devolve como "limpeza" e, ao desmontar
// (Sair), chama — `TypeError: l is not a function`, tela de erro para
// aluno, responsável e coordenação. Em Chromium antigo o retorno era
// undefined e nada acontecia, por isso passou despercebido.
//
// Regra: o corpo de useEffect/useLayoutEffect é um bloco `{ … }` ou
// devolve explicitamente uma função de limpeza (`() => () => …`). Efeito
// passado por referência (`useEffect(fn, …)`) também é proibido: não dá
// para ver o que `fn` devolve.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(RAIZ, "app/src");

function arquivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.(jsx?|tsx?)$/.test(n) ? [p] : [];
  });
}

test("nenhum useEffect/useLayoutEffect devolve valor por retorno implícito ou por referência", () => {
  const achados = [];
  for (const f of arquivos(SRC)) {
    const linhas = readFileSync(f, "utf8").split("\n");
    linhas.forEach((l, i) => {
      if (/^\s*\/\//.test(l)) return;
      const m = l.match(/\buse(Layout)?Effect\(\s*(.*)$/);
      if (!m) return;
      const resto = m[2];
      const ok = /^\(\s*\)\s*=>\s*(\{|\(\s*\)\s*=>)/.test(resto) // bloco ou limpeza explícita
        || /^async\b/.test(resto) === false && /^\(\s*\)\s*=>\s*$/.test(resto) // quebra de linha logo depois
        || resto.trim() === ""; // argumentos na linha seguinte
      const porReferencia = /^[A-Za-z_$][\w$.]*\s*,/.test(resto);
      if (!ok || porReferencia) achados.push(`${relative(RAIZ, f)}:${i + 1}: ${l.trim()}`);
    });
  }
  assert.deepEqual(achados, [], "efeito com retorno implícito (vira 'limpeza' e quebra ao desmontar):\n" + achados.join("\n"));
});

test("a guarda pega exatamente o padrão que quebrou o Sair", () => {
  const ruim = [
    'useEffect(() => window.scrollTo({ top: 0 }), []);',
    'useEffect(aoTopo, []);',
    'React.useEffect(() => fetch("/x"), []);',
  ];
  const bom = [
    'useEffect(() => { window.scrollTo({ top: 0 }); }, []);',
    'useEffect(() => () => { clearTimeout(t); }, []);',
    'React.useEffect(() => () => { if (ref.current) clearTimeout(ref.current); }, []);',
  ];
  const casa = (l) => {
    const m = l.match(/\buse(Layout)?Effect\(\s*(.*)$/);
    const resto = m[2];
    const ok = /^\(\s*\)\s*=>\s*(\{|\(\s*\)\s*=>)/.test(resto);
    return !ok || /^[A-Za-z_$][\w$.]*\s*,/.test(resto);
  };
  for (const l of ruim) assert.equal(casa(l), true, l);
  for (const l of bom) assert.equal(casa(l), false, l);
});
