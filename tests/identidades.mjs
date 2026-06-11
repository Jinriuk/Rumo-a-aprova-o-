// Helper dos testes: abre uma transação ASSUMINDO uma identidade
// real (papel de banco `authenticated` + claims JWT), exatamente
// como o PostgREST/Supabase fazem em produção. RLS vale por inteiro.
import pg from "pg";

export const pool = new pg.Pool({
  host: process.env.PGHOST || "127.0.0.1",
  port: +(process.env.PGPORT || 54322),
  user: process.env.PGUSER || "postgres",
  database: process.env.PGDATABASE || "rumo_teste",
  password: process.env.PGPASSWORD || undefined,
});

export const ESCOLA_A = "11111111-1111-4111-8111-111111111111";
export const ESCOLA_B = "22222222-2222-4222-8222-222222222222";

export const IDS = {
  coordA: { sub: "aaaaaaaa-0000-4000-8000-000000000001", escola_id: ESCOLA_A, papel: "coordenacao" },
  alunoA: { sub: "aaaaaaaa-0000-4000-8000-000000000002", escola_id: ESCOLA_A, papel: "aluno" },
  respA:  { sub: "aaaaaaaa-0000-4000-8000-000000000003", escola_id: ESCOLA_A, papel: "responsavel" },
  coordB: { sub: "bbbbbbbb-0000-4000-8000-000000000001", escola_id: ESCOLA_B, papel: "coordenacao" },
  alunoB: { sub: "bbbbbbbb-0000-4000-8000-000000000002", escola_id: ESCOLA_B, papel: "aluno" },
  respB:  { sub: "bbbbbbbb-0000-4000-8000-000000000003", escola_id: ESCOLA_B, papel: "responsavel" },
};

export const ALUNO_LUCAS = "a0000000-0000-4000-8000-000000000001";
export const ALUNO_BRUNO = "b0000000-0000-4000-8000-000000000001";

// Executa fn(client) como o usuário dado, dentro de uma transação
// que SEMPRE faz rollback — os testes não sujam o banco.
export async function como(identidade, fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    if (identidade) {
      const claims = JSON.stringify({
        sub: identidade.sub,
        role: "authenticated",
        app_metadata: { escola_id: identidade.escola_id, papel: identidade.papel },
      });
      await c.query("select set_config('request.jwt.claims', $1, true)", [claims]);
      await c.query("set local role authenticated");
    } else {
      await c.query("set local role anon"); // sem login
    }
    return await fn(c);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

// Igual, mas commitando (para cenários que precisam persistir).
export async function comoCommit(identidade, fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    const claims = JSON.stringify({
      sub: identidade.sub,
      role: "authenticated",
      app_metadata: { escola_id: identidade.escola_id, papel: identidade.papel },
    });
    await c.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    await c.query("set local role authenticated");
    const r = await fn(c);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

// Afirma que uma consulta é RECUSADA pelo banco, sem abortar a
// transação do teste (savepoint). O erro tem que casar com o regex.
export async function esperaErro(c, regex, sql, params) {
  await c.query("savepoint sp_espera_erro");
  let err = null;
  try {
    await c.query(sql, params);
  } catch (e) {
    err = e;
  }
  await c.query("rollback to savepoint sp_espera_erro");
  if (!err) throw new Error(`o banco deveria ter recusado, mas aceitou: ${sql}`);
  if (!regex.test(String(err.message))) {
    throw new Error(`recusou pelo motivo errado (${err.message}): ${sql}`);
  }
}

// Acesso de servidor (motor/cron), sem RLS — só para preparar cenários.
export async function comoServidor(fn) {
  const c = await pool.connect();
  try {
    return await fn(c);
  } finally {
    c.release();
  }
}
