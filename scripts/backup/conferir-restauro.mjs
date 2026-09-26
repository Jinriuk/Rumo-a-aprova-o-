// ============================================================
// ETAPA 6 — o banco restaurado FUNCIONA? (stack local da E3)
// ------------------------------------------------------------
// Depois do restaurar.sh (que já provou estrutura, ACLs e contagens
// iguais às da origem), este passo usa o banco como o site usa:
//   1. login: senha pelo Auth local, token com as claims escola/papel.
//      Com ENSAIO_SENHA (dump sintético), entra com a senha ORIGINAL:
//      prova que o hash veio intacto. Sem ela (dump real), troca a
//      senha de uma conta por papel NESTA cópia local e entra: prova
//      conta, identidade e claims, não a senha de ninguém;
//   2. escola, alunos, vínculos e progresso pelo PostgREST, como
//      coordenação, aluno e responsável: o que a API devolve bate com a
//      contagem feita como postgres, e cada um só vê a própria escola;
//   3. RPC do painel (resumo_escola) como coordenação;
//   4. event trigger da 0045: tabela nova no public nasce com RLS
//      (transação desfeita);
//   5. cron sem disparo externo: todo job existe DESLIGADO, sem
//      chamada externa no comando, sem pg_net instalado, e o comando de
//      cada um roda numa transação desfeita.
// Recusa destino que não seja local (trava da E3) e banco sem o
// marcador do ensaio (ensaio_restauro.execucao com ENSAIO_RUN_ID).
// Uso: node scripts/backup/conferir-restauro.mjs [saida.json]
// ============================================================
import { writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { pg, createClient } from "../e2e/deps.mjs";
import { conferirDestino, hostsInternos } from "../e2e/trava.mjs";
import { carregarLocalEnv } from "../e2e/ambiente.mjs";
import { CHAMADA_EXTERNA } from "./pos-restauro.mjs";

const env = carregarLocalEnv(process.env);
const REDIGIR = !!env.RESTAURO_REDIGIR;
const saida = process.argv[2];
conferirDestino({
  urls: { E2E_API_URL: env.E2E_API_URL, E2E_DB_URL: env.E2E_DB_URL },
  runId: env.ENSAIO_RUN_ID, internos: hostsInternos(env),
});

const db = new pg.Client({ connectionString: env.E2E_DB_URL });
await db.connect();
const checks = [];
const ok = (nome, detalhe = "") => { checks.push({ nome, ok: true, detalhe }); console.log(`✔ ${nome}${detalhe ? ` — ${detalhe}` : ""}`); };
const erro = (nome, detalhe) => { checks.push({ nome, ok: false, detalhe }); console.error(`::error::${nome} — ${detalhe}`); };
const naoVerificado = (nome, detalhe) => { checks.push({ nome, ok: null, detalhe }); console.log(`– ${nome} — NÃO VERIFICADO: ${detalhe}`); };
const n = (x) => (REDIGIR ? "…" : String(x));
const q = async (sql, p = []) => (await db.query(sql, p)).rows;

try {
  const [m] = await q("select to_regclass('ensaio_restauro.execucao') as t");
  if (!m.t || !(await q("select 1 from ensaio_restauro.execucao where run_id = $1", [env.ENSAIO_RUN_ID])).length) {
    throw new Error("banco sem o marcador deste ensaio (ensaio_restauro.execucao): não é a cópia local restaurada");
  }

  // ── contas: uma por papel, de escola operacional, com o vínculo que o papel pede
  const [coord] = await q(`select u.id, u.escola_id, a.email from usuarios u join auth.users a on a.id = u.id join escolas e on e.id = u.escola_id
    where u.papel = 'coordenacao' and e.status not in ('suspensa', 'cancelada') and a.email is not null order by u.id limit 1`);
  const [aluno] = await q(`select u.id, u.escola_id, a.email, al.id as aluno_id from alunos al join usuarios u on u.id = al.usuario_id
    join auth.users a on a.id = u.id join escolas e on e.id = u.escola_id
    where e.status not in ('suspensa', 'cancelada') and a.email is not null
    order by exists (select 1 from registros_estudo r where r.aluno_id = al.id) desc, u.id limit 1`);
  const [resp] = await q(`select u.id, u.escola_id, a.email, v.aluno_id from vinculos_responsaveis v join usuarios u on u.id = v.responsavel_id
    join auth.users a on a.id = u.id join escolas e on e.id = u.escola_id
    where e.status not in ('suspensa', 'cancelada') and a.email is not null order by u.id limit 1`);
  const contas = { coordenacao: coord, aluno, responsavel: resp };
  // sem coordenação com login não há o que conferir; aluno e responsável
  // podem não existir na origem (produção tinha uma escola de teste só):
  // aí a linha diz "não verificado", e não conta como aprovação
  if (!coord) erro("conta de coordenacao", "nenhuma coordenação com login e escola operacional no banco restaurado");
  for (const papel of ["aluno", "responsavel"]) {
    if (!contas[papel]) naoVerificado(`login ${papel}`, "a origem não tem conta desse papel com login em escola operacional");
  }

  // ── 1. login
  const admin = createClient(env.E2E_API_URL, env.E2E_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const sessoes = {};
  for (const [papel, c] of Object.entries(contas)) {
    if (!c) continue;
    let senha = env.ENSAIO_SENHA;
    if (!senha) {
      senha = randomBytes(18).toString("base64url");
      const { error } = await admin.auth.admin.updateUserById(c.id, { password: senha });
      if (error) { erro(`login ${papel}`, `troca de senha na cópia local: ${error.message}`); continue; }
    }
    const cli = createClient(env.E2E_API_URL, env.E2E_ANON_KEY, { auth: { persistSession: false } });
    const { data, error } = await cli.auth.signInWithPassword({ email: c.email, password: senha });
    if (error || !data.session) { erro(`login ${papel}`, error?.message ?? "sem sessão"); continue; }
    const claims = JSON.parse(Buffer.from(data.session.access_token.split(".")[1], "base64url"));
    if (claims.app_metadata?.papel !== papel || claims.app_metadata?.escola_id !== c.escola_id) {
      erro(`login ${papel}`, "token sem as claims escola/papel da conta"); continue;
    }
    sessoes[papel] = cli;
    ok(`login ${papel}`, env.ENSAIO_SENHA ? "senha original da origem" : "senha trocada só nesta cópia local");
  }

  // ── 2. escola, alunos, vínculos, progresso pela API
  const conta = async (cli, tabela, filtro = (x) => x) => {
    const { count, error } = await filtro(cli.from(tabela).select("id", { count: "exact", head: true }));
    // select("id"): a 0058 dá à coordenação só algumas colunas de escolas
    if (error) throw new Error(`${tabela}: ${error.message || error.code || "erro sem mensagem"}`);
    return count;
  };
  const porEscola = async (tabela, escola) => Number((await q(`select count(*) from ${tabela} where escola_id = $1`, [escola]))[0].count);
  if (sessoes.coordenacao) {
    const c = sessoes.coordenacao, e = coord.escola_id;
    for (const t of ["escolas", "alunos", "vinculos_responsaveis", "registros_estudo", "metas", "aluno_eventos_progresso"]) {
      const api = await conta(c, t);
      const banco = t === "escolas" ? 1 : await porEscola(t, e);
      if (api === banco) ok(`coordenação lê ${t}`, `${n(api)} = banco, só a própria escola`);
      else erro(`coordenação lê ${t}`, `API ${n(api)} × banco ${n(banco)}`);
    }
    const { data, error } = await c.rpc("resumo_escola");
    const alunosEscola = Number((await q("select count(*) from alunos where escola_id = $1", [e]))[0].count);
    if (error) erro("RPC resumo_escola", error.message);
    else if (data.length !== alunosEscola) erro("RPC resumo_escola", `${n(data.length)} linhas × ${n(alunosEscola)} alunos`);
    else ok("RPC resumo_escola (painel)", `${n(data.length)} alunos`);
  }
  if (sessoes.aluno) {
    const a = sessoes.aluno;
    const proprios = Number((await q("select count(*) from registros_estudo where aluno_id = $1", [aluno.aluno_id]))[0].count);
    const api = await conta(a, "registros_estudo");
    const alunosVistos = await conta(a, "alunos");
    if (api === proprios && alunosVistos === 1) ok("aluno lê o próprio progresso", `${n(api)} registros, 1 aluno visível`);
    else erro("aluno lê o próprio progresso", `registros API ${n(api)} × banco ${n(proprios)}; alunos visíveis ${n(alunosVistos)}`);
  }
  if (sessoes.responsavel) {
    const r = sessoes.responsavel;
    const { data, error } = await r.from("alunos").select("id");
    const vinculados = (await q("select aluno_id from vinculos_responsaveis where responsavel_id = $1", [resp.id])).map((x) => x.aluno_id).sort();
    const vistos = (data ?? []).map((x) => x.id).sort();
    if (!error && JSON.stringify(vistos) === JSON.stringify(vinculados)) ok("responsável vê só o aluno vinculado", `${n(vistos.length)} aluno(s)`);
    else erro("responsável vê só o aluno vinculado", error?.message ?? `API ${n(vistos.length)} × vínculos ${n(vinculados.length)}`);
  }

  // ── 4. event trigger da 0045
  await db.query("begin");
  try {
    await db.query("create table public.ensaio_restauro_rls (id int)");
    const [r] = await q("select relrowsecurity from pg_class where oid = 'public.ensaio_restauro_rls'::regclass");
    if (r.relrowsecurity) ok("event trigger ensure_rls (0045)", "tabela nova no public nasce com RLS");
    else erro("event trigger ensure_rls (0045)", "tabela nova no public nasceu SEM RLS");
  } finally { await db.query("rollback"); }

  // ── 5. cron sem disparo externo
  const jobs = await q("select jobname, command, active from cron.job order by jobname");
  const [net] = await q("select count(*)::int as n from pg_extension where extname in ('pg_net', 'http', 'dblink')");
  if (!jobs.length) erro("cron", "nenhum job no banco restaurado");
  else if (jobs.some((j) => j.active)) erro("cron", `job LIGADO na cópia local: ${jobs.filter((j) => j.active).map((j) => j.jobname).join(", ")}`);
  else if (net.n) erro("cron", "extensão de chamada externa instalada (pg_net/http/dblink)");
  else ok("cron sem disparo externo", `${jobs.length} job(s) desligados: ${jobs.map((j) => j.jobname).join(", ")}; sem pg_net`);
  for (const j of jobs) {
    if (CHAMADA_EXTERNA.test(j.command)) { erro(`cron ${j.jobname}`, "comando com chamada externa: não executado"); continue; }
    await db.query("begin");
    try {
      await db.query(j.command);
      ok(`cron ${j.jobname}`, "o comando roda sobre o dado restaurado (transação desfeita)");
    } catch (e) {
      erro(`cron ${j.jobname}`, e.message);
    } finally { await db.query("rollback"); }
  }
} catch (e) {
  erro("conferência", e.message);
} finally {
  await db.end();
}

if (saida) writeFileSync(saida, JSON.stringify({ ok: checks.every((c) => c.ok !== false), checks }, null, 1) + "\n");
if (!checks.some((c) => c.ok) || checks.some((c) => c.ok === false)) process.exit(1);
const nv = checks.filter((c) => c.ok === null).length;
console.log(`✔ ${checks.filter((c) => c.ok).length} conferências funcionais aprovadas no banco restaurado${nv ? `; ${nv} não verificada(s)` : ""}`);
