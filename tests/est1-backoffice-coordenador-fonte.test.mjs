// ============================================================
// EST1-B1 — backoffice-coordenador NÃO varre a 1ª página do Auth
// ------------------------------------------------------------
// Achado EST0 SEGURANCA-01/A8 (confirmado): a função resolvia o
// coordenador existente com listUsers({perPage:1000}) + .find() sobre a
// ÚNICA página — como todo aluno/responsável é auth.users, o projeto
// passa de 1000 contas com 1–2 escolas e um coordenador fora da página 1
// caía no createUser, o GoTrue rejeitava a duplicidade e a função
// devolvia um 500 enganoso, bloqueando o re-vínculo.
//
// A correção resolve pelo cache indexado usuarios.email (0041) e, no
// estado parcial raro, pagina o Auth ATÉ achar (sem parar em 1000).
// Sem runner de Deno no repo, travamos a propriedade por inspeção de
// fonte (mesmo padrão de sec3-endurecimento-edge / d1c-email).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const ler = (p) => readFileSync(resolve(root, p), "utf8");

const src = ler("supabase/functions/backoffice-coordenador/index.ts");

test("B1: não faz mais find() sobre uma única página de listUsers({perPage:1000})", () => {
  // o anti-padrão exato do achado não pode voltar: listUsers de página
  // única seguido de find no fluxo de criação.
  assert.doesNotMatch(
    src,
    /listUsers\(\{\s*perPage:\s*1000\s*\}\)/,
    "listUsers de página única (sem page) não pode reaparecer no caminho comum",
  );
});

test("B1: resolve o coordenador pelo cache indexado usuarios.email", () => {
  assert.match(src, /acharUsuarioPorEmail/, "deve existir a resolução por cache");
  assert.match(src, /from\("usuarios"\)[\s\S]*?\.eq\("email"/, "busca o id por usuarios.email");
});

test("B1: o fallback ao Auth pagina de verdade (page++), não para em 1000", () => {
  assert.match(src, /page\s*<=\s*50/, "há teto de paginação (defensivo)");
  assert.match(src, /listUsers\(\{\s*page,\s*perPage\s*\}\)/, "pagina por page/perPage");
  assert.match(src, /data\.users\.length\s*<\s*perPage/, "para na última página, não na 1ª");
});

test("B1: a migration cria o índice de usuarios.email", () => {
  const mig = ler("supabase/migrations/0041_est1_indice_usuarios_email.sql");
  assert.match(mig, /create index if not exists idx_usuarios_email/i);
  assert.match(mig, /on usuarios \(email\)/i);
});
