// ============================================================
// EST1-C2 — provisionar-aluno grava o HASH do código (aditivo)
// ------------------------------------------------------------
// O provisionamento passa a registrar o hash do código na fundação da
// credencial opaca (0044), de forma ADITIVA e NÃO-FATAL: o login atual
// não muda (password=codigo segue) e uma falha ao gravar o hash não
// aborta o provisionamento. Sem runner de Deno no repo, travamos a
// propriedade por inspeção de fonte (padrão sec3/d1c).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const ler = (p) => readFileSync(resolve(root, p), "utf8");

const src = ler("supabase/functions/provisionar-aluno/index.ts");

test("C2: chama a porta public registrar_codigo_acesso com o código gerado", () => {
  assert.match(src, /registrar_codigo_acesso/, "grava o hash na fundação (0044)");
  assert.match(src, /p_usuario:\s*usuarioId/, "passa o usuário recém-criado");
  assert.match(src, /p_codigo:\s*codigo/, "passa o código gerado");
});

test("C2: é NÃO-FATAL — não aborta o provisionamento se o hash falhar", () => {
  // o erro do rpc vira console.error (não throw), como os logs de acesso
  assert.match(src, /registrar_codigo_acesso[\s\S]{0,220}?console\.error/, "erro do hash é logado, não propagado");
  // o login atual não foi trocado: password ainda é o código (corte é janela dedicada)
  assert.match(src, /password:\s*codigo/, "login direto preservado (dormente até o corte)");
});
