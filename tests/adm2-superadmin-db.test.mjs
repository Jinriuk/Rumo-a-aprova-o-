// ============================================================
// ADM2 — SuperADM profissional: contrato das RPCs + segurança + log
// ------------------------------------------------------------
// Contra o Postgres real (mesmas migrations de produção), prova os
// critérios de aceite da camada ADM2:
//   • TODA ação sensível exige super_admin e é RECUSADA para
//     coordenação e anon (tarefa 42 / aceite "não-superadmin não
//     acessa poderes de superadmin");
//   • TODA ação sensível grava em admin_logs com a ação certa
//     (criar / editar antes-depois / status de-para);
//   • o ciclo de status (implantacao→ativa→suspensa→reativar) é
//     reversível e auditado;
//   • o detalhe da escola (backoffice_detalhe_escola) tem o SHAPE
//     exato que o núcleo de operação (operacao.js) consome —
//     casando a lógica pura da tela com o contrato do banco para
//     os cenários demo / vazia / ativa / suspensa.
// Tudo em transação com ROLLBACK — não suja o banco.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { pool, como, esperaErro, IDS } from "./identidades.mjs";
import {
  categoriaEscola, avisosRisco, severidadeMaxima,
  checklistGoLive, resumoChecklist,
} from "../app/src/modules/backoffice/operacao.js";

test.after(async () => { await pool.end(); });

const ADMIN = "cccccccc-0000-4000-8000-0000000000a2";
const claimsDe = (sub) => JSON.stringify({ sub, role: "authenticated", app_metadata: {} });

async function comoSuperAdmin(fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(
      "insert into internal_admins (auth_user_id, email, nome, ativo) values ($1, 'adm2@interno.local', 'Operador ADM2', true)",
      [ADMIN],
    );
    await c.query("select set_config('request.jwt.claims', $1, true)", [claimsDe(ADMIN)]);
    await c.query("set local role authenticated");
    return await fn(c);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

const detalhe = async (c, id) => (await c.query("select public.backoffice_detalhe_escola($1) as j", [id])).rows[0].j;
const criar = async (c, sql) => (await c.query(sql)).rows[0].id;

/* ---------- segurança: todas as RPCs sensíveis exigem super_admin ---------- */

test("ADM2: coordenação é RECUSADA em todas as RPCs sensíveis do backoffice", async () => {
  const ESC = "11111111-1111-4111-8111-111111111111";
  await como(IDS.coordA, async (c) => {
    await esperaErro(c, /acesso negado/i, "select public.backoffice_dashboard()");
    await esperaErro(c, /acesso negado/i, "select * from public.backoffice_escolas()");
    await esperaErro(c, /acesso negado/i, "select public.backoffice_detalhe_escola($1)", [ESC]);
    await esperaErro(c, /acesso negado/i, "select public.backoffice_criar_escola('Intruso','intruso-adm2')");
    await esperaErro(c, /acesso negado/i, "select public.backoffice_editar_escola($1,'Hack')", [ESC]);
    await esperaErro(c, /acesso negado/i, "select public.backoffice_definir_status($1,'suspensa')", [ESC]);
  });
});

test("ADM2: anon (sem login) não executa nenhuma RPC do backoffice", async () => {
  await como(null, async (c) => {
    await esperaErro(c, /permission denied/i, "select public.backoffice_dashboard()");
    await esperaErro(c, /permission denied/i, "select * from public.backoffice_escolas()");
    await esperaErro(c, /permission denied/i, "select public.sou_super_admin()");
  });
});

/* ---------- toda ação sensível registra em admin_logs ---------- */

test("ADM2: criar + editar + status geram trilha de auditoria completa", async () => {
  await comoSuperAdmin(async (c) => {
    const id = await criar(c, "select public.backoffice_criar_escola('Auditada','auditada-adm2','Rio','RJ','padrao',100) as id");

    await c.query("select public.backoffice_editar_escola($1, 'Auditada II', null, '#101010')", [id]);
    await c.query("select public.backoffice_definir_status($1, 'ativa')", [id]);
    await c.query("select public.backoffice_definir_status($1, 'suspensa')", [id]);
    await c.query("select public.backoffice_definir_status($1, 'ativa')", [id]); // reativar

    const logs = (await c.query(
      "select acao, detalhe from admin_logs where escola_id = $1 order by id", [id])).rows;
    const acoes = logs.map((l) => l.acao);
    assert.ok(acoes.includes("criar-escola"));
    assert.ok(acoes.includes("editar-escola"));
    assert.ok(acoes.includes("ativar-escola"));
    assert.ok(acoes.includes("suspender-escola"));
    // edição guarda antes/depois
    const ed = logs.find((l) => l.acao === "editar-escola");
    assert.equal(ed.detalhe.antes.nome, "Auditada");
    assert.equal(ed.detalhe.depois.nome, "Auditada II");
    // suspender guarda de/para
    const sus = logs.find((l) => l.acao === "suspender-escola");
    assert.equal(sus.detalhe.para, "suspensa");
    // todos os logs são do operador autenticado (não forjados)
    const forjados = (await c.query(
      "select count(*)::int n from admin_logs where escola_id=$1 and super_admin_id <> $2", [id, ADMIN])).rows[0].n;
    assert.equal(forjados, 0);
  });
});

test("ADM2: super_admin não consegue forjar log em nome de outro operador", async () => {
  await comoSuperAdmin(async (c) => {
    await esperaErro(c, /row-level security/i,
      "insert into admin_logs (super_admin_id, acao) values ('dddddddd-0000-4000-8000-0000000000ff','forjado')");
  });
});

/* ---------- contrato detalhe ↔ operacao.js (cenários da tarefa) ---------- */

test("ADM2 cenário VAZIA: detalhe alimenta checklist/risco e nada fica 'pronto' por omissão", async () => {
  await comoSuperAdmin(async (c) => {
    const id = await criar(c, "select public.backoffice_criar_escola('Vazia ADM2','vazia-adm2') as id");
    const d = await detalhe(c, id);

    // shape esperado pelo operacao.js
    assert.ok("escola" in d && "coordenadores" in d && "alunos" in d);
    assert.equal(d.escola.status, "implantacao");

    const cat = categoriaEscola(d.escola);
    assert.equal(cat.chave, "teste", "implantação é teste, nunca real");

    const av = avisosRisco(d.escola, d);
    assert.ok(av.some((a) => a.codigo === "sem-coordenador"), "vazia tem risco de sem-coordenador");
    assert.equal(severidadeMaxima(av), "risco");

    const resumo = resumoChecklist(checklistGoLive(d));
    assert.equal(resumo.prontoGoLive, false);
    assert.ok(resumo.criticosPendentes.length > 0);
  });
});

test("ADM2 cenário DEMO: classifica como demonstração e não cobra alunos", async () => {
  await comoSuperAdmin(async (c) => {
    const id = await criar(c, "select public.backoffice_criar_escola('Vitrine ADM2','demo-adm2-x',null,null,'demo',null,'demo') as id");
    const d = await detalhe(c, id);
    assert.equal(categoriaEscola(d.escola).chave, "demo");
    const av = avisosRisco(d.escola, d);
    assert.ok(!av.some((a) => a.codigo === "sem-alunos"), "demo sem aluno não vira alerta");
    assert.ok(av.some((a) => a.codigo === "ambiente-demo"));
  });
});

test("ADM2 cenário ATIVA: escola ativa de slug limpo é REAL e operacional", async () => {
  await comoSuperAdmin(async (c) => {
    // slug/nome sem sinal de vitrine: só vira 'real' por estar ATIVA.
    const id = await criar(c, "select public.backoffice_criar_escola('Colégio Atlântico','atlantico-adm2','Niteroi','RJ','padrao',200) as id");
    await c.query("select public.backoffice_definir_status($1,'ativa')", [id]);
    const d = await detalhe(c, id);
    assert.equal(categoriaEscola(d.escola).chave, "real");
    const itens = checklistGoLive(d);
    assert.ok(itens.find((i) => i.chave === "operacional").ok, "ativa fecha o item operacional");
    // ainda sem coordenador/alunos: o checklist é HONESTO e não fica pronto
    assert.equal(resumoChecklist(itens).prontoGoLive, false);
  });
});

test("ADM2 cenário SUSPENSA: status reflete bloqueio e checklist marca não-operacional", async () => {
  await comoSuperAdmin(async (c) => {
    const id = await criar(c, "select public.backoffice_criar_escola('Suspendivel ADM2','suspensa-adm2') as id");
    await c.query("select public.backoffice_definir_status($1,'suspensa')", [id]);
    const d = await detalhe(c, id);
    assert.equal(d.escola.status, "suspensa");
    const itens = checklistGoLive(d);
    assert.equal(itens.find((i) => i.chave === "operacional").ok, false);
    const av = avisosRisco(d.escola, d);
    assert.ok(av.some((a) => a.codigo === "suspensa"));
  });
});

test("ADM2: status inválido é recusado pelo banco (defesa do contrato)", async () => {
  await comoSuperAdmin(async (c) => {
    const id = await criar(c, "select public.backoffice_criar_escola('Defesa ADM2','defesa-adm2') as id");
    await esperaErro(c, /status inválido/i, "select public.backoffice_definir_status($1,'inventado')", [id]);
  });
});
