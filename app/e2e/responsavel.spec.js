// @ts-check
/* Jornada do RESPONSÁVEL (Etapa 3): lê só o aluno vinculado, não tem
   nenhum controle de edição (nem pela tela, nem pela API com a própria
   sessão) e a revogação feita pela coordenação vale na hora.

   A revogação usa uma conta dedicada (responsavelRevogacao, vinculada ao
   Lucas pela fixture); o afterAll refaz o vínculo para a suíte poder
   rodar de novo na mesma stack. */
import { test, expect } from "./local/base.js";
import { amb, sql, hashTabelas, mesmoHash, fecharBanco } from "./local/api.js";
import {
  CONTAS, coletarErros, loginResponsavel, loginCoordenacao, irParaAba, semEstouroHorizontal, dialogoAberto, sair,
} from "./_apoio.js";

const LUCAS = CONTAS.alunoLucas.alunoId;
const VITRINE = "11111111-1111-4111-8111-111111111111";

test.afterAll(async () => {
  await sql(`insert into vinculos_responsaveis (escola_id, responsavel_id, aluno_id) values ($1, $2, $3)
             on conflict (responsavel_id, aluno_id) do nothing`, [VITRINE, CONTAS.responsavelRevogacao.id, LUCAS]);
  await fecharBanco();
});

/** Access token da sessão que o próprio app guardou no navegador. */
async function tokenDaPagina(page) {
  return page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.endsWith("-auth-token"));
    return k ? JSON.parse(localStorage.getItem(k)).access_token : null;
  });
}

test.describe("responsável", { tag: ["@j:responsavel", "@critica"] }, () => {
  test("lê o resumo do aluno vinculado e de mais ninguém", async ({ page }) => {
    const erros = coletarErros(page);
    await loginResponsavel(page, CONTAS.responsavelLucas);
    await expect(page.getByText("Atividades da semana")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Lucas estudou/)).toBeVisible();
    await expect(page.getByText("Desempenho por matéria")).toBeVisible();
    // nenhum outro aluno da escola aparece
    await expect(page.getByText(/Igor|Nathalia|Maria Eduarda/)).toHaveCount(0);
    // e a API, com a sessão dele, só devolve o vinculado
    const token = await tokenDaPagina(page);
    const r = await fetch(`${amb.apiUrl}/rest/v1/alunos?select=id`, { headers: { apikey: amb.anonKey, authorization: `Bearer ${token}` } });
    expect((await r.json()).map((a) => a.id)).toEqual([LUCAS]);
    await semEstouroHorizontal(page);
    expect(erros).toEqual([]);
  });

  test("não edita: sem controles na tela e a API recusa com a sessão dele", async ({ page }) => {
    await loginResponsavel(page, CONTAS.responsavelLucas);
    await expect(page.getByText("Atividades da semana")).toBeVisible({ timeout: 15_000 });
    for (const nome of [/Iniciar estudo/, /Confirmar estudo/, /Concluir/, /Adiar/, /Salvar simulado/]) {
      await expect(page.getByRole("button", { name: nome })).toHaveCount(0);
    }
    await expect(page.getByRole("button", { name: "Registrar", exact: true })).toHaveCount(0);

    const token = await tokenDaPagina(page);
    const [reg] = await sql("select id from registros_estudo where aluno_id = $1 order by criado_em limit 1", [LUCAS]);
    const antes = await hashTabelas(["registros_estudo", "meta_atividades"]);
    const h = { apikey: amb.anonKey, authorization: `Bearer ${token}`, "content-type": "application/json", Prefer: "return=representation" };
    const patch = await fetch(`${amb.apiUrl}/rest/v1/registros_estudo?select=id&id=eq.${reg.id}`, { method: "PATCH", headers: h, body: JSON.stringify({ questoes: 99 }) });
    const post = await fetch(`${amb.apiUrl}/rest/v1/registros_estudo?select=id`, {
      method: "POST", headers: h, body: JSON.stringify({ escola_id: VITRINE, aluno_id: LUCAS, data: "2026-01-07", disciplina_codigo: "mat", questoes: 5 }),
    });
    const depois = await hashTabelas(["registros_estudo", "meta_atividades"]);
    expect(patch.status === 200 ? (await patch.json()).length : 0, "PATCH não altera linha").toBe(0);
    expect(post.status, "POST recusado").toBeGreaterThanOrEqual(400);
    expect(mesmoHash(antes, depois), "nada mudou no banco").toBe(true);
  });

  test("revogação: a coordenação revoga o acesso e o responsável deixa de ver o aluno", async ({ page, novoContexto }) => {
    const conta = CONTAS.responsavelRevogacao;
    // o responsável entra e vê o Lucas
    const ctxResp = await novoContexto();
    const pResp = await ctxResp.newPage();
    try {
      await loginResponsavel(pResp, conta);
      await expect(pResp.getByText(/Lucas estudou/)).toBeVisible({ timeout: 15_000 });

      // a coordenação revoga pela tela "Gerenciar responsáveis"
      await loginCoordenacao(page);
      await irParaAba(page, "Alunos");
      await page.getByRole("textbox", { name: "Buscar aluno por nome" }).fill("Lucas");
      const linhaLucas = page.getByRole("button", { name: "Mais ações" }).first();
      await linhaLucas.click();
      await page.getByRole("menuitem", { name: /Gerenciar responsáveis/ }).or(page.getByRole("button", { name: /Gerenciar responsáveis/ })).first().click();
      const dlg = dialogoAberto(page);
      const item = dlg.locator("div").filter({ hasText: conta.nome ?? "E2E Responsável Revogação" })
        .filter({ has: page.getByRole("button", { name: "Revogar acesso" }) }).last();
      await item.getByRole("button", { name: "Revogar acesso" }).click();
      await dlg.getByRole("button", { name: "Confirmar revogação" }).click();
      await expect(dlg.getByText("E2E Responsável Revogação")).toHaveCount(0, { timeout: 15_000 });

      const v = await sql("select 1 from vinculos_responsaveis where responsavel_id = $1 and aluno_id = $2", [conta.id, LUCAS]);
      expect(v, "vínculo apagado no banco").toEqual([]);
      const [log] = await sql("select count(*)::int as n from logs_coordenacao where acao = 'revogou-responsavel' and detalhe->>'responsavel_id' = $1", [conta.id]);
      expect(log.n, "revogação registrada no log da coordenação").toBeGreaterThan(0);

      // a sessão aberta do responsável: ao atualizar, o aluno some
      await pResp.reload();
      await expect(pResp.getByText("Nenhum aluno vinculado a este acesso. Fale com a escola.")).toBeVisible({ timeout: 20_000 });
      await expect(pResp.getByText(/Lucas estudou/)).toHaveCount(0);
      await sair(pResp).catch(() => {});
    } finally { await ctxResp.close(); }
  });
});
