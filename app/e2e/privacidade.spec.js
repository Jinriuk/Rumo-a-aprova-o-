// @ts-check
/* Jornada de PRIVACIDADE (Etapa 3): a coordenação exporta e apaga os dados
   de um titular SINTÉTICO pela tela (lgpd-titular), e o banco e o Auth
   locais confirmam: o dossiê traz só o titular, a exclusão leva registros,
   metas, simulados, a conta do aluno e a do responsável exclusivo, e o
   log de acesso fica.

   O titular nasce aqui, com sufixo, na escola da vitrine local: nenhuma
   conta ou dado de outra jornada é tocado. */
import { test, expect } from "./local/base.js";
import { readFile } from "node:fs/promises";
import { amb, sql, entrar, fecharBanco } from "./local/api.js";
import { createClient } from "../../scripts/e2e/deps.mjs";
import { SENHA_E2E, loginCoordenacao, irParaAba, dialogoAberto, sufixo } from "./_apoio.js";

const admin = createClient(amb.apiUrl, amb.serviceKey, { auth: { persistSession: false } });
const VITRINE = "11111111-1111-4111-8111-111111111111";
const s = sufixo();
const T = { nome: `E2E Titular ${s}`, aluno: null, contaAluno: null, contaResp: null, emailAluno: `e2etit${s}@codigo.acesso.local`, emailResp: `e2eresp${s}@codigo.acesso.local` };

test.beforeAll(async () => {
  const [trilha] = await sql("select id from trilhas where nicho = 'colegio-naval' order by versao desc limit 1");
  const [a] = await sql("insert into alunos (escola_id, nome, trilha_id) values ($1, $2, $3) returning id", [VITRINE, T.nome, trilha.id]);
  T.aluno = a.id;
  for (const [chave, email, papel, nome] of [["contaAluno", T.emailAluno, "aluno", T.nome], ["contaResp", T.emailResp, "responsavel", `Responsável ${s}`]]) {
    const u = await admin.auth.admin.createUser({
      email, password: SENHA_E2E, email_confirm: true, app_metadata: { escola_id: VITRINE, papel }, user_metadata: { nome },
    });
    if (u.error) throw u.error;
    T[chave] = u.data.user.id;
    await sql("insert into usuarios (id, escola_id, papel, nome, must_change_password) values ($1, $2, $3, $4, false)", [T[chave], VITRINE, papel, nome]);
  }
  await sql("update alunos set usuario_id = $1 where id = $2", [T.contaAluno, T.aluno]);
  await sql("insert into vinculos_responsaveis (escola_id, responsavel_id, aluno_id) values ($1, $2, $3)", [VITRINE, T.contaResp, T.aluno]);
  await sql(`insert into registros_estudo (escola_id, aluno_id, data, disciplina_codigo, topico, questoes, acertos, minutos)
             values ($1, $2, app.hoje_local(), 'mat', 'E2E dado do titular', 10, 7, 20)`, [VITRINE, T.aluno]);
  await sql("insert into simulados (escola_id, aluno_id, nome, data) values ($1, $2, 'E2E simulado do titular', app.hoje_local())", [VITRINE, T.aluno]);
});
test.afterAll(async () => { await fecharBanco(); });

async function abrirAcoes(page) {
  await loginCoordenacao(page);
  await irParaAba(page, "Alunos");
  await page.getByRole("textbox", { name: "Buscar aluno por nome" }).fill(T.nome);
  await page.getByRole("button", { name: "Mais ações" }).first().click();
}
const item = (page, nome) => page.getByRole("menuitem", { name: nome }).or(page.getByRole("button", { name: nome })).first();

test.describe("privacidade (LGPD) com dados sintéticos", { tag: ["@j:privacidade", "@critica"] }, () => {
  test.describe.configure({ mode: "serial" });

  test("exportar: o dossiê baixado traz o titular e mais ninguém, e a exportação fica no log", async ({ page }) => {
    await abrirAcoes(page);
    const [download] = await Promise.all([page.waitForEvent("download"), item(page, "Exportar dados (LGPD)").click()]);
    const dossie = JSON.parse(await readFile(await download.path(), "utf8"));
    const texto = JSON.stringify(dossie);
    expect(texto).toContain(T.nome);
    expect(texto).toContain("E2E dado do titular");
    expect(texto).toContain("E2E simulado do titular");
    // nada de outro aluno da escola no dossiê
    for (const outro of ["Lucas", "Igor Fonseca Macedo", "Nathalia Freitas Campos"]) expect(texto).not.toContain(outro);
    const [log] = await sql("select count(*)::int as n from logs_acesso where aluno_id = $1 and acao = 'exportacao-lgpd'", [T.aluno]);
    expect(log.n).toBe(1);
  });

  test("apagar: some da escola, do banco e do Auth; o titular não entra mais; o log fica", async ({ page }) => {
    expect((await entrar(T.emailAluno, SENHA_E2E)).status, "antes: a conta do titular entra").toBe(200);
    await abrirAcoes(page);
    await item(page, "Excluir dados (LGPD)").click();
    await dialogoAberto(page).getByRole("button", { name: "Apagar definitivamente" }).click();
    await expect.poll(async () => (await sql("select count(*)::int as n from alunos where id = $1", [T.aluno]))[0].n, { timeout: 20_000 }).toBe(0);

    await page.getByRole("textbox", { name: "Buscar aluno por nome" }).fill(T.nome);
    await expect(page.getByRole("button", { name: "Ver desempenho" })).toHaveCount(0, { timeout: 15_000 });
    for (const [t, col] of [["registros_estudo", "aluno_id"], ["simulados", "aluno_id"], ["metas", "aluno_id"], ["vinculos_responsaveis", "aluno_id"]]) {
      const [r] = await sql(`select count(*)::int as n from ${t} where ${col} = $1`, [T.aluno]);
      expect(r.n, `${t} do titular`).toBe(0);
    }
    const contas = await sql("select id from usuarios where id = any($1)", [[T.contaAluno, T.contaResp]]);
    expect(contas, "contas do aluno e do responsável exclusivo").toEqual([]);
    const auth = await sql("select id from auth.users where id = any($1)", [[T.contaAluno, T.contaResp]]);
    expect(auth, "contas fora do Auth também").toEqual([]);
    expect((await entrar(T.emailAluno, SENHA_E2E)).status, "depois: a conta do titular não entra").toBe(400);
    const [log] = await sql("select count(*)::int as n from logs_acesso where aluno_id = $1 and acao = 'exclusao-lgpd'", [T.aluno]);
    expect(log.n, "o pedido fica registrado").toBe(1);
  });
});
