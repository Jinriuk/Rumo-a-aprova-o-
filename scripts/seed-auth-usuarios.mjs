// ============================================================
// Seed de USUÁRIOS no Supabase Auth — ambiente de demo/dev.
// ------------------------------------------------------------
// O seed SQL (supabase/seed) cria as linhas de `usuarios` com ids
// fixos; este script cria as contas correspondentes no Auth com os
// MESMOS ids e os claims (escola_id, papel) no app_metadata.
// Roda com a chave de serviço, SÓ na máquina do operador:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-auth-usuarios.mjs
// Idempotente: conta que já existe é atualizada, não duplicada.
// NÃO rodar contra produção real (é a escola de vitrine).
// ============================================================
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error("defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente (nunca no repositório)");
  process.exit(1);
}
const admin = createClient(url, chave, { auth: { persistSession: false } });

const ESCOLA_A = "11111111-1111-4111-8111-111111111111";
const ESCOLA_B = "22222222-2222-4222-8222-222222222222";

// credenciais de DEMONSTRAÇÃO (escola de vitrine) — troque ao apresentar
const USUARIOS = [
  { id: "aaaaaaaa-0000-4000-8000-000000000001", email: "coordenacao@vitrine.demo", senha: "vitrine-coord-2026", escola: ESCOLA_A, papel: "coordenacao", nome: "Coordenação Vitrine" },
  { id: "aaaaaaaa-0000-4000-8000-000000000002", email: "lucasdemo2026@codigo.acesso.local", senha: "LUCASDEMO2026", escola: ESCOLA_A, papel: "aluno", nome: "Lucas" },
  { id: "aaaaaaaa-0000-4000-8000-000000000003", email: "respdemo2026x@codigo.acesso.local", senha: "RESPDEMO2026X", escola: ESCOLA_A, papel: "responsavel", nome: "Responsável do Lucas" },
  { id: "bbbbbbbb-0000-4000-8000-000000000001", email: "coordenacao@beta.demo", senha: "beta-coord-2026", escola: ESCOLA_B, papel: "coordenacao", nome: "Coordenação Beta" },
  { id: "bbbbbbbb-0000-4000-8000-000000000002", email: "brunodemo2026@codigo.acesso.local", senha: "BRUNODEMO2026", escola: ESCOLA_B, papel: "aluno", nome: "Bruno" },
  { id: "bbbbbbbb-0000-4000-8000-000000000003", email: "respbeta2026xx@codigo.acesso.local", senha: "RESPBETA2026XX", escola: ESCOLA_B, papel: "responsavel", nome: "Responsável do Bruno" },
];

for (const u of USUARIOS) {
  const corpo = {
    email: u.email,
    password: u.senha,
    email_confirm: true,
    app_metadata: { escola_id: u.escola, papel: u.papel },
    user_metadata: { nome: u.nome },
  };

  // procura conta existente pelo e-mail (idempotência)
  const { data: lista, error: errLista } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (errLista) { console.error("listUsers:", errLista.message); process.exit(1); }
  const existente = lista.users.find((x) => x.email === u.email);

  let idReal;
  if (existente) {
    const { error } = await admin.auth.admin.updateUserById(existente.id, corpo);
    if (error) { console.error(`${u.email}:`, error.message); process.exit(1); }
    idReal = existente.id;
    console.log(`atualizado: ${u.email}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser(corpo);
    if (error) { console.error(`${u.email}:`, error.message); process.exit(1); }
    idReal = data.user.id;
    console.log(`criado: ${u.email}`);
  }

  // alinha as linhas semeadas ao id REAL da conta no Auth
  if (idReal !== u.id) {
    for (const [tabela, coluna] of [
      ["usuarios", "id"], ["alunos", "usuario_id"],
      ["vinculos_responsaveis", "responsavel_id"], ["consentimentos", "registrado_por"],
    ]) {
      const { error } = await admin.from(tabela).update({ [coluna]: idReal }).eq(coluna, u.id);
      if (error) { console.error(`${tabela}.${coluna}:`, error.message); process.exit(1); }
    }
    console.log(`  ids realinhados: ${u.id} -> ${idReal}`);
  }
}

console.log("\ncontas de demo prontas:");
console.log("  coordenação vitrine: coordenacao@vitrine.demo / vitrine-coord-2026");
console.log("  aluno Lucas (código): LUCA-SDEM-O2026  (digite LUCASDEMO2026)");
console.log("  responsável (código): RESPDEMO2026X");
