// ============================================================
// Criar/atualizar um SUPER_ADMIN do backoffice (Fase 17.4).
// ------------------------------------------------------------
// Cria a conta no Supabase Auth e a linha em `internal_admins`
// (a fonte de verdade do acesso interno). Roda com a chave de
// serviço, SÓ na máquina do operador — nunca no front nem no CI:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   ADMIN_EMAIL=operador@suaempresa.com ADMIN_SENHA='forte-aqui' \
//   ADMIN_NOME='Seu Nome' node scripts/criar-super-admin.mjs
// Idempotente: conta existente é atualizada; internal_admins é upsert.
// Para REVOGAR um operador: update internal_admins set ativo=false.
// ============================================================
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL;
const senha = process.env.ADMIN_SENHA;
const nome = process.env.ADMIN_NOME || "Operador";

if (!url || !chave || !email || !senha) {
  console.error("defina SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL e ADMIN_SENHA no ambiente (nunca no repositório)");
  process.exit(1);
}

const admin = createClient(url, chave, { auth: { persistSession: false } });

const corpo = {
  email,
  password: senha,
  email_confirm: true,
  app_metadata: { papel: "super_admin" }, // marcador; o gate real é internal_admins
  user_metadata: { nome },
};

// procura conta existente pelo e-mail (idempotência)
const { data: lista, error: errLista } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (errLista) { console.error("listUsers:", errLista.message); process.exit(1); }
const existente = lista.users.find((x) => x.email === email);

let uid;
if (existente) {
  const { error } = await admin.auth.admin.updateUserById(existente.id, corpo);
  if (error) { console.error("updateUser:", error.message); process.exit(1); }
  uid = existente.id;
  console.log(`conta Auth atualizada: ${email}`);
} else {
  const { data, error } = await admin.auth.admin.createUser(corpo);
  if (error) { console.error("createUser:", error.message); process.exit(1); }
  uid = data.user.id;
  console.log(`conta Auth criada: ${email}`);
}

// fonte de verdade do acesso interno (service_role bypassa a RLS)
const { error } = await admin.from("internal_admins")
  .upsert({ auth_user_id: uid, email, nome, ativo: true }, { onConflict: "auth_user_id" });
if (error) { console.error("internal_admins:", error.message); process.exit(1); }

console.log(`super_admin pronto: ${email} (${uid}). Faça login normal — o app abre o Backoffice.`);
