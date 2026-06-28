// ============================================================
// SEC3 — endurecimentos de Edge Functions e higiene de ambiente
// ------------------------------------------------------------
// Estes testes NÃO sobem o Supabase (CI não tem GoTrue/service role):
// inspecionam o CÓDIGO-FONTE e o .env versionado para travar as
// propriedades de segurança da camada, evitando regressão silenciosa.
//   T73 — virar-semana compara o token de serviço em tempo constante.
//   T74 — virar-semana escopa por escola quando recebe escola_id.
//   T75 — lgpd-titular apaga o Auth ANTES do banco e aborta em falha
//          parcial (sem estado quebrado silencioso).
//   T76 — app/.env.production só tem chave PÚBLICA (anon), sem segredo.
//   T69/T70 — o modelo de credencial opaca está documentado.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const ler = (p) => readFileSync(resolve(root, p), "utf8");

// ── T73 — comparação em tempo constante ──────────────────────────────────────
test("T73: virar-semana usa timingSafeEqual e não compara o segredo com !== direto", () => {
  const src = ler("supabase/functions/virar-semana/index.ts");
  assert.match(src, /timingSafeEqual/, "deveria usar uma comparação constante no tempo");
  assert.match(src, /crypto\.subtle\.digest/, "a comparação constante deveria derivar de um hash");
  // o anti-padrão antigo (token !== segredo) não pode voltar
  assert.doesNotMatch(
    src,
    /token\s*!==\s*Deno\.env\.get/,
    "comparação direta (vaza por timing) não pode reaparecer",
  );
});

// ── T74 — escopo por escola ──────────────────────────────────────────────────
test("T74: virar-semana escopa por escola_id quando informado e mantém global sem ele", () => {
  const src = ler("supabase/functions/virar-semana/index.ts");
  assert.match(src, /motor_virar_semana_escola/, "deve ter caminho escopado por escola");
  assert.match(src, /motor_virar_semana\b/, "deve manter a virada global");
  const iEscola = src.indexOf("motor_virar_semana_escola");
  const iEscolaId = src.indexOf("escola_id");
  assert.ok(iEscolaId >= 0 && iEscola >= 0, "deve ler escola_id do corpo");
});

test("T74: a migration cria a função escopada com escola_id, idempotência e grant só ao service_role", () => {
  const sql = ler("supabase/migrations/0035_virar_semana_por_escola.sql");
  assert.match(sql, /function app\.virar_semana\(p_escola uuid/, "função escopada por escola");
  assert.match(sql, /where[\s\S]*escola_id = p_escola/i, "o UPDATE/SELECT filtra por escola_id");
  assert.match(sql, /escola % não existe/, "valida que a escola existe");
  assert.match(sql, /grant execute on function app\.virar_semana\(uuid, date\) to service_role/i);
  assert.match(sql, /revoke all on function app\.virar_semana\(uuid, date\) from public, authenticated, anon/i);
});

// ── T75 — atomicidade LGPD: Auth antes do banco, aborta em falha parcial ──────
test("T75: lgpd-titular apaga o Auth ANTES do banco", () => {
  const src = ler("supabase/functions/lgpd-titular/index.ts");
  const iLista = src.indexOf("lgpd_usuarios_do_aluno");
  const iAuth = src.indexOf("removerContaAuth(id)"); // o CALL site (não a definição do helper)
  const iDb = src.lastIndexOf("lgpd_excluir");
  assert.ok(iLista >= 0, "deve levantar a lista de contas antes de apagar");
  assert.ok(iAuth >= 0, "deve apagar contas do Auth");
  assert.ok(iDb >= 0, "deve apagar o banco");
  assert.ok(iLista < iAuth && iAuth < iDb, "ordem deve ser: listar → Auth → banco");
});

test("T75: lgpd-titular aborta a exclusão quando alguma conta do Auth não sai (banco intacto)", () => {
  const src = ler("supabase/functions/lgpd-titular/index.ts");
  assert.match(src, /falhas\.length\s*>\s*0/, "deve checar falhas de remoção do Auth");
  assert.match(src, /abortada/i, "deve sinalizar aborto sem apagar o banco");
  // o abort tem que estar ANTES da chamada de exclusão no banco
  const iAbort = src.indexOf("falhas.length > 0");
  const iDb = src.lastIndexOf("lgpd_excluir");
  assert.ok(iAbort >= 0 && iAbort < iDb, "o abort precede a exclusão do banco");
});

test("T75: remoção de conta do Auth é idempotente (conta ausente = sucesso)", () => {
  const src = ler("supabase/functions/lgpd-titular/index.ts");
  assert.match(src, /getUserById/, "checa existência antes de apagar (idempotência)");
  assert.match(src, /já removida|idempotente/i, "trata conta ausente como já removida");
});

test("T75: a migration expõe a leitura da lista de contas só ao service_role", () => {
  const sql = ler("supabase/migrations/0036_lgpd_usuarios_do_aluno.sql");
  assert.match(sql, /function app\.lgpd_usuarios_do_aluno\(p_aluno uuid\)/);
  assert.match(sql, /grant execute on function app\.lgpd_usuarios_do_aluno\(uuid\) to service_role/i);
  assert.match(sql, /revoke all on function app\.lgpd_usuarios_do_aluno\(uuid\) from public, authenticated, anon/i);
});

// ── T76 — .env.production só tem chave pública ───────────────────────────────
function decodeJwtRole(jwt) {
  const payload = jwt.split(".")[1];
  const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const json = Buffer.from(b64, "base64").toString("utf8");
  return JSON.parse(json).role;
}

test("T76: app/.env.production contém apenas URL pública + anon key (role=anon)", () => {
  const env = ler("app/.env.production");
  const m = env.match(/VITE_SUPABASE_ANON_KEY=([\w.\-]+)/);
  assert.ok(m, "deve ter a anon key");
  assert.equal(decodeJwtRole(m[1]), "anon", "a chave versionada TEM que ser a anon (pública), nunca service_role");
});

test("T76: nada de service_role ou segredo no .env versionado nem no front", () => {
  for (const p of ["app/.env.production", ".env.example"]) {
    const txt = ler(p);
    assert.doesNotMatch(txt, /"role"\s*:\s*"service_role"/, `${p}: não pode ter token service_role`);
    // .env.example pode citar o NOME da variável (placeholder), mas nunca um valor real
    assert.doesNotMatch(txt, /SUPABASE_SERVICE_ROLE_KEY=eyJ/, `${p}: não pode ter um valor real de service_role`);
  }
});

// ── T69/T70 — modelo de credencial opaca documentado ─────────────────────────
test("T69/T70: o modelo de credencial opaca está documentado", () => {
  const p = "docs/auditoria/sec3/modelo-credencial-opaca.md";
  assert.ok(existsSync(resolve(root, p)), "deve existir o desenho da credencial opaca");
  const doc = ler(p);
  assert.match(doc, /opac|token|rotac/i, "o desenho deve falar de token opaco/rotação");
});
