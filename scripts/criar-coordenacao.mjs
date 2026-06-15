// ============================================================
// Provisionar a COORDENAÇÃO de uma escola (Fase 17.5).
// ------------------------------------------------------------
// Cria a conta no Supabase Auth (com os claims escola_id + papel) e a
// linha em `usuarios`. É a "camada segura" do fluxo de implantação: a
// criação de conta exige service_role, que NUNCA entra no front — por
// isso é um script de operador. A escola já deve existir (criada no
// backoffice). Idempotente. Roda só na máquina do operador:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   ESCOLA_SLUG=vitrine COORD_EMAIL=coord@escola.com COORD_SENHA='forte' \
//   COORD_NOME='Coordenação Fulano' node scripts/criar-coordenacao.mjs
// ============================================================
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
const slug = process.env.ESCOLA_SLUG;
const email = process.env.COORD_EMAIL;
const senha = process.env.COORD_SENHA;
const nome = process.env.COORD_NOME || "Coordenação";

if (!url || !chave || !slug || !email || !senha) {
  console.error("defina SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ESCOLA_SLUG, COORD_EMAIL e COORD_SENHA (nunca no repositório)");
  process.exit(1);
}

const admin = createClient(url, chave, { auth: { persistSession: false } });

// resolve a escola pelo slug
const { data: escola, error: errEsc } = await admin.from("escolas").select("id, nome").eq("slug", slug).maybeSingle();
if (errEsc) { console.error("buscar escola:", errEsc.message); process.exit(1); }
if (!escola) { console.error(`escola com slug "${slug}" não existe — crie no backoffice primeiro`); process.exit(1); }

const corpo = {
  email,
  password: senha,
  email_confirm: true,
  app_metadata: { escola_id: escola.id, papel: "coordenacao" },
  user_metadata: { nome },
};

// idempotência: procura conta existente pelo e-mail
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

// linha em usuarios (service_role bypassa a RLS)
const { error } = await admin.from("usuarios")
  .upsert({ id: uid, escola_id: escola.id, papel: "coordenacao", nome }, { onConflict: "id" });
if (error) { console.error("usuarios:", error.message); process.exit(1); }

console.log(`coordenação pronta em "${escola.nome}": ${email}. Faça login com e-mail e senha.`);
