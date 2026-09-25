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
//   E2/C-S03 — o bundle construído não carrega chave de servidor nem
//          sourcemap.
//   E2/C-S07 — o que o papel `anon` alcança no banco (Postgres real).
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

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

// ── E2/C-S03 — o bundle construído ───────────────────────────────────────────
// O T76 olha o .env versionado; isto olha o que o Vite de fato EMITIU. O
// job do CI roda `npm run build` antes da suíte, então app/dist existe lá.
// Fora do CI, sem build local, o teste se declara pulado com o motivo; no
// CI a ausência do dist é falha, não pulo.
const DIST = resolve(root, "app/dist");
const semDistLocal = !existsSync(DIST) && !process.env.CI;

function arquivosDe(dir) {
  return readdirSync(dir).flatMap((nome) => {
    const p = join(dir, nome);
    return statSync(p).isDirectory() ? arquivosDe(p) : [p];
  });
}

function claimsDoJwt(jwt) {
  const b64 = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
}

test(
  "E2/C-S03: o bundle só carrega JWT de papel anon, nenhuma chave sb_secret_ e nenhum sourcemap",
  { skip: semDistLocal ? "app/dist ausente fora do CI: rode `npm run build` em app/" : false },
  () => {
    assert.ok(existsSync(DIST), "app/dist não existe: o CI roda o build antes da suíte");
    const arquivos = arquivosDe(DIST);
    assert.ok(arquivos.some((f) => f.endsWith(".js")), "dist sem nenhum .js: build vazio");

    const mapas = arquivos.filter((f) => f.endsWith(".map"));
    assert.deepEqual(mapas, [], "sourcemap publicado expõe o código-fonte inteiro");

    const jwts = [];
    for (const f of arquivos.filter((f) => /\.(js|html|css|json)$/.test(f))) {
      const txt = readFileSync(f, "utf8");
      assert.doesNotMatch(txt, /sourceMappingURL=/, `${f}: aponta para um sourcemap`);
      // a biblioteca testa o PREFIXO `sb_secret_` (string curta); uma
      // chave de verdade tem o prefixo seguido de dezenas de caracteres
      assert.doesNotMatch(txt, /sb_secret_[A-Za-z0-9_-]{16,}/, `${f}: chave secreta nova no bundle`);
      for (const m of txt.matchAll(/eyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]{10,}/g)) jwts.push([f, m[0]]);
    }
    for (const [f, jwt] of jwts) {
      assert.equal(claimsDoJwt(jwt).role, "anon", `${f}: JWT embutido com papel diferente de anon`);
    }
  },
);

// ── T69/T70 — modelo de credencial opaca documentado ─────────────────────────
test("T69/T70: o modelo de credencial opaca está documentado", () => {
  const p = "docs/auditoria/sec3/modelo-credencial-opaca.md";
  assert.ok(existsSync(resolve(root, p)), "deve existir o desenho da credencial opaca");
  const doc = ler(p);
  assert.match(doc, /opac|token|rotac/i, "o desenho deve falar de token opaco/rotação");
});

// ── E2/C-S07 — o que o papel anon alcança (Postgres real) ────────────────────
// A chave anon é pública por desenho. O que a torna segura é o banco: nenhuma
// policy vale para `anon`, toda tabela tem RLS, as views rodam com a
// permissão de quem consulta e nenhuma função de `public`/`app` é executável
// por `anon`. Medido em demo e produção em 24/09 (docs/e2-seguranca.md,
// Fatia 6); aqui fica travado no banco local.
//
// Os hospedados dão a `anon` SELECT/INSERT/UPDATE/DELETE em 48 dos 50
// objetos de `public` (grant padrão do Supabase). O local não dá. O teste de
// comportamento concede os quatro em TODOS os objetos, dentro da transação
// desfeita: é mais do que o hospedado tem, então o resultado vale para ele.
const pgCfg = {
  host: process.env.PGHOST ?? "127.0.0.1",
  port: Number(process.env.PGPORT ?? 54322),
  user: process.env.PGUSER ?? "postgres",
  password: process.env.PGPASSWORD ?? "postgres",
  database: process.env.PGDATABASE ?? "rumo_teste",
};

async function comBanco(fn) {
  const db = new pg.Client(pgCfg);
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

test("E2/C-S07: nenhuma policy de public vale para anon ou PUBLIC", async () => {
  await comBanco(async (db) => {
    const r = await db.query(`
      select c.relname, p.polname
        from pg_policy p
        join pg_class c on c.oid = p.polrelid
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and (0::oid = any(p.polroles) or 'anon'::regrole::oid = any(p.polroles))`);
    assert.deepEqual(r.rows, [], "policy alcançável sem login");
  });
});

test("E2/C-S07: toda tabela de public tem RLS e toda view é security_invoker", async () => {
  await comBanco(async (db) => {
    const semRls = await db.query(`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity`);
    assert.deepEqual(semRls.rows, [], "tabela sem RLS: o grant de anon do hospedado abriria tudo");

    const views = await db.query(`
      select c.relname, coalesce(c.reloptions, '{}') as opcoes
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'v'`);
    assert.ok(views.rowCount > 0, "nenhuma view encontrada: consulta desatualizada");
    for (const v of views.rows) {
      assert.ok(
        v.opcoes.some((o) => /^security_invoker=(true|on)$/.test(o)),
        `${v.relname}: view sem security_invoker roda como o dono (BYPASSRLS nos hospedados)`,
      );
    }
  });
});

// As funções de `app` herdam EXECUTE de PUBLIC (a 0057 tira das internas e
// dos gatilhos, não das helpers de policy). O que barra `anon` é não ter
// USAGE no schema: sem ele, nenhuma função de `app` é alcançável. Por isso o
// teste trava as duas coisas, a barreira e o alcance efetivo.
test("E2/C-S07: anon não tem USAGE no schema app", async () => {
  await comBanco(async (db) => {
    const r = await db.query(`select has_schema_privilege('anon', 'app', 'USAGE') as tem`);
    assert.equal(r.rows[0].tem, false, "com USAGE em app, anon executaria as helpers e as internas");
  });
});

test("E2/C-S07: anon não alcança nenhuma função de public ou app (fora de extensão)", async () => {
  await comBanco(async (db) => {
    const r = await db.query(`
      select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as f
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('public', 'app')
         and has_schema_privilege('anon', n.oid, 'USAGE')
         and has_function_privilege('anon', p.oid, 'EXECUTE')
         and not exists (select 1 from pg_depend d
                          where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
       order by 1`);
    assert.deepEqual(r.rows.map((x) => x.f), [], "função executável sem login");
  });
});

// Tabelas que o seed deixa vazias: nelas a negação de SELECT/UPDATE/DELETE
// é vazia por construção, e só o INSERT prova alguma coisa. Tabela nova
// vazia tem de entrar aqui de propósito, ou ganhar linha no seed.
const VAZIAS_NO_SEED = new Set([
  "admin_logs", "internal_admins", "logs_acesso", "logs_coordenacao", "virada_execucoes",
]);

test("E2/C-S07: com os grants do hospedado, anon não lê, altera, apaga nem insere em nada", async () => {
  await comBanco(async (db) => {
    const { rows: objetos } = await db.query(`
      select c.relname, c.relkind,
             (select quote_ident(a.attname) from pg_attribute a
               where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
                 and a.attgenerated = '' and a.attidentity = ''
               order by a.attnum limit 1) as coluna
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r','p','v')
       order by 1`);
    assert.ok(objetos.length >= 50, `só ${objetos.length} objetos em public: reset do banco incompleto`);

    const falhas = [];
    const vazios = [];
    for (const o of objetos) {
      const t = `public.${o.relname}`;
      await db.query("begin");
      try {
        await db.query("grant select, insert, update, delete on all tables in schema public to anon");
        const controle = (await db.query(`select count(*)::int as n from ${t}`)).rows[0].n;
        if (controle === 0) vazios.push(o.relname);
        await db.query("set local role anon");

        const lidas = (await db.query(`select count(*)::int as n from ${t}`)).rows[0].n;
        if (lidas !== 0) falhas.push(`${o.relname}: anon leu ${lidas} de ${controle}`);

        if (o.relkind !== "v") {
          const upd = await db.query(`update ${t} set ${o.coluna} = ${o.coluna} where true`);
          if (upd.rowCount !== 0) falhas.push(`${o.relname}: anon alterou ${upd.rowCount}`);
          const del = await db.query(`delete from ${t} where true`);
          if (del.rowCount !== 0) falhas.push(`${o.relname}: anon apagou ${del.rowCount}`);
          await db.query("savepoint ins");
          try {
            await db.query(`insert into ${t} default values`);
            falhas.push(`${o.relname}: anon inseriu`);
          } catch (e) {
            // a recusa tem de vir da RLS, não de NOT NULL ou de função
            if (e.code !== "42501" || !/row-level security/.test(e.message)) {
              falhas.push(`${o.relname}: insert recusado por outro motivo (${e.code}: ${e.message})`);
            }
            await db.query("rollback to savepoint ins");
          }
        }
      } finally {
        await db.query("rollback");
      }
    }
    assert.deepEqual(falhas, []);
    const vaziosInesperados = vazios.filter((v) => !VAZIAS_NO_SEED.has(v));
    assert.deepEqual(vaziosInesperados, [], "negação vazia: tabela sem linha no seed");
  });
});
