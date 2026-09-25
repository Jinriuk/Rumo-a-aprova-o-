// ============================================================
// ETAPA 3 — semeia a fixture do E2E na stack LOCAL
// ------------------------------------------------------------
// Pré: stack.sh subir + banco.sh (migrations e seeds). Passos:
//   1. trava completa (host local, sem *.supabase.co, run id, marcador);
//   2. fixture da matriz de autorização (tests/matriz-autorizacao.mjs,
//      montarFixture), a mesma da camada banco, agora gravada;
//   3. usuários pelo admin LOCAL do Auth, com os ids fixos, e-mail
//      confirmado, app_metadata { escola_id, papel } (as claims que a RLS
//      lê) e user_metadata { nome };
//   4. linhas de `usuarios` que faltarem, vínculos e o estado de troca
//      de senha de cada conta (só a alunaTroca exige troca).
// Idempotente dentro da mesma execução. Uso: node scripts/e2e/semear.mjs
// ============================================================
import { pg, createClient } from "./deps.mjs";
import { travaCompleta } from "./trava.mjs";
import { CONTAS, PERSONAS_HTTP, SENHA_E2E } from "./contas.mjs";
import { montarFixture } from "../../tests/matriz-autorizacao.mjs";

import { carregarLocalEnv } from "./ambiente.mjs";

const env = carregarLocalEnv(process.env);
const db = new pg.Client({ connectionString: env.E2E_DB_URL });
await db.connect();

try {
  await travaCompleta(db, env);

  // 2. fixture da matriz (escolas A, B, C, suspensa, cancelada e personas)
  const { rows: ja } = await db.query("select 1 from escolas where slug = 'e2-escola-a'");
  if (!ja.length) {
    await db.query("begin");
    await montarFixture(db);
    await db.query("commit");
    console.log("fixture da matriz gravada");
  }

  // 4a. linhas de usuarios que só o E2E precisa
  for (const c of Object.values(CONTAS)) {
    if (!c.criarUsuario) continue;
    await db.query(
      `insert into usuarios (id, escola_id, papel, nome, email) values ($1, $2, $3, $4, $5)
       on conflict (id) do nothing`, [c.id, c.escola, c.papel, c.nome, c.email]);
  }

  // 3. usuários no Auth local, pela API admin
  const admin = createClient(env.E2E_API_URL, env.E2E_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const todas = { ...CONTAS, ...PERSONAS_HTTP };
  let criados = 0;
  for (const [chave, c] of Object.entries(todas)) {
    const corpo = {
      email: c.email, password: SENHA_E2E, email_confirm: true,
      app_metadata: { escola_id: c.escola, papel: c.papel },
      user_metadata: { nome: c.nome },
    };
    const { data: existente } = await admin.auth.admin.getUserById(c.id);
    if (existente?.user) {
      const { error } = await admin.auth.admin.updateUserById(c.id, corpo);
      if (error) throw new Error(`${chave}: ${error.message}`);
    } else {
      const { error } = await admin.auth.admin.createUser({ id: c.id, ...corpo });
      if (error) throw new Error(`${chave}: ${error.message}`);
      criados++;
    }
  }
  console.log(`usuários no Auth local: ${Object.keys(todas).length} (${criados} novos)`);

  // 4b. estado de senha: só quem a jornada pede entra com troca obrigatória
  await db.query("update usuarios set must_change_password = false where id = any($1)",
    [Object.values(todas).filter((c) => !c.trocaObrigatoria).map((c) => c.id)]);
  await db.query("update usuarios set must_change_password = true where id = any($1)",
    [Object.values(todas).filter((c) => c.trocaObrigatoria).map((c) => c.id)]);
  await db.query("update usuarios set email = $2 where id = $1 and email is distinct from $2",
    [CONTAS.coordRecuperacao.id, CONTAS.coordRecuperacao.email]);

  console.log("fixture do E2E pronta");
} finally {
  await db.end();
}
