// ============================================================
// ONDA 7 / S1 — credencial real não vive na tela pública
// ------------------------------------------------------------
// O placeholder do campo "Código de acesso" (Login.jsx) trazia
// `LUCASDEMO2026`, que é o código REAL do aluno de demonstração no seed
// — e, no modelo antigo de credencial, código era também senha. Quem
// abrisse a tela de login lia uma credencial válida.
//
// O modelo novo já está no ar (provisionar-aluno pós-#95 em demo e
// produção, senha temporária + must_change_password), mas o placeholder
// continuava anunciando o código. Este teste trava o exemplo em algo
// claramente fictício.
//
// Inspeção de fonte, com comentários removidos antes de casar (senão a
// própria nota que explica a correção faria o teste passar).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const semComentarios = (fonte) => fonte
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:\\])\/\/.*$/gm, "$1");
const src = (p) => semComentarios(readFileSync(resolve(root, p), "utf8"));

test("S1: a tela pública de login não exibe o código de credencial do seed", () => {
  const login = src("app/src/routes/publico/Login.jsx");
  assert.doesNotMatch(
    login,
    /LUCASDEMO2026/,
    "o código real do aluno de demonstração não pode aparecer na tela pública — é credencial, não exemplo",
  );
  assert.match(
    login,
    /placeholder="Ex\.: [A-Z0-9]+"/,
    "o campo continua com um exemplo de formato, só que fictício",
  );
});

test("S1: o código do seed continua existindo só no seed (que é dado de dev)", () => {
  // Não é para o seed parar de ter credencial de demonstração — é para
  // ela não vazar para o front. Este teste existe para a correção acima
  // não ser "resolvida" apagando o seed por engano.
  const seed = readFileSync(resolve(root, "supabase/seed/04_usuarios_auth_dev.sql"), "utf8");
  assert.match(seed, /LUCASDEMO2026/, "o seed de dev continua provisionando o aluno de demonstração");
});
