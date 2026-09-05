// ============================================================
// 0093 — corrige a senha de contas @codigo.acesso.local afetadas pelo
// bug de login-por-código (provisionar-aluno gravava password: codigo
// com traço; o front sempre loga com o código normalizado, sem traço).
// ------------------------------------------------------------
// A parte local do e-mail JÁ é o código normalizado (emailDoCodigo usava
// normalizarCodigo mesmo na versão com bug) — então a senha correta de
// qualquer conta afetada é dedutível do próprio e-mail, sem precisar do
// código original: senha_correta = maiúscula(parte-local-do-email).
//
// Critério pra achar as contas afetadas (evita tocar contas de seed/demo,
// que usam e-mails legíveis como lucasdemo2026, vitrine005, piloto2026a01):
//   1) e-mail termina em @codigo.acesso.local;
//   2) parte local bate no alfabeto/tamanho real de novoCodigo() — 12
//      caracteres do alfabeto sem 0/O/1/I/L (as contas de seed usam
//      padrões legíveis que sempre caem fora disso: contêm 0, 1, i, l
//      ou o, ou têm outro tamanho);
//   3) last_sign_in_at nulo — nunca logou (contas de seed já usadas
//      continuam de fora mesmo se por acaso batessem no alfabeto).
// Idempotente: rodar de novo numa conta já corrigida grava a mesma senha.
//
// Uso (dry-run por padrão — só lista o que mudaria):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/corrigir-senha-codigo-0093.mjs
// Para aplicar de verdade:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/corrigir-senha-codigo-0093.mjs --aplicar
// ============================================================
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error("defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente (nunca no repositório)");
  process.exit(1);
}
const admin = createClient(url, chave, { auth: { persistSession: false } });

const aplicar = process.argv.includes("--aplicar");

// mesmo alfabeto de novoCodigo() em provisionar-aluno/index.ts
const CODIGO_RE = /^[A-HJ-NP-Z2-9]{12}$/i;

async function contasCodigoAcesso() {
  const contas = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) { console.error("listUsers:", error.message); process.exit(1); }
    for (const u of data.users) {
      if (u.email?.endsWith("@codigo.acesso.local")) contas.push(u);
    }
    if (data.users.length < 1000) break;
  }
  return contas;
}

const todas = await contasCodigoAcesso();
const afetadas = todas.filter((u) => {
  const local = u.email.split("@")[0];
  return CODIGO_RE.test(local) && !u.last_sign_in_at;
});

console.log(`${todas.length} conta(s) @codigo.acesso.local no total; ${afetadas.length} afetada(s) pelo bug 0093.`);

for (const u of afetadas) {
  const local = u.email.split("@")[0];
  const senhaCorreta = local.toUpperCase();
  if (!aplicar) {
    console.log(`[dry-run] corrigiria: ${u.email}`);
    continue;
  }
  const { error } = await admin.auth.admin.updateUserById(u.id, { password: senhaCorreta });
  if (error) { console.error(`${u.email}:`, error.message); process.exit(1); }
  console.log(`corrigida: ${u.email}`);
}

if (!aplicar && afetadas.length > 0) {
  console.log("\nrode de novo com --aplicar para corrigir de verdade.");
}
console.log(`\ntotal corrigidas: ${aplicar ? afetadas.length : 0}`);
