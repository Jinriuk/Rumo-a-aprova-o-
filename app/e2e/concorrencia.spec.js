// @ts-check
/* Jornada de CONCORRÊNCIA E FALHA (Etapa 3): duplo clique, duas abas e
   falha de API, sem duplicar nem perder dado. Toda conclusão é conferida
   no banco local (linhas e eventos de XP), não só na tela.

   Conta dedicada (alunoConcorrencia): as escritas daqui não cruzam com
   as da jornada do aluno. */
import { test, expect } from "./local/base.js";
import { sql, fecharBanco } from "./local/api.js";
import { CONTAS, loginAluno, irParaAba, campo, sufixo, retratoDaTela } from "./_apoio.js";

const CONTA = CONTAS.alunoConcorrencia;
test.afterAll(async () => { await fecharBanco(); });

async function preencherRegistro(page, topico) {
  await irParaAba(page, "Registrar");
  await campo(page, "Matéria").selectOption({ label: "Matemática" });
  await campo(page, "Tópico *").fill(topico);
  await campo(page, "Questões").fill("8");
  await campo(page, "Acertos").fill("6");
}
const registrosDo = async (topico) => (await sql("select count(*)::int as n from registros_estudo where aluno_id = $1 and topico = $2", [CONTA.alunoId, topico]))[0].n;
async function eventosDoRegistro(topico) {
  const [r] = await sql(`select count(*)::int as n from aluno_eventos_progresso e join registros_estudo r on r.id = e.referencia_id
                          where r.aluno_id = $1 and r.topico = $2`, [CONTA.alunoId, topico]);
  return r.n;
}

test.describe("concorrência e falha", { tag: ["@j:concorrencia", "@critica"] }, () => {
  test("duplo clique em Confirmar estudo grava UM registro e UM evento de XP", async ({ page }) => {
    const topico = `E2E duplo ${sufixo()}`;
    await loginAluno(page, CONTA);
    await preencherRegistro(page, topico);
    await page.getByRole("button", { name: "Confirmar estudo" }).dblclick();
    await expect(page.getByRole("heading", { name: "Seu estudo entrou no radar." }), await retratoDaTela(page)).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    expect(await registrosDo(topico)).toBe(1);
    expect(await eventosDoRegistro(topico)).toBe(1);
  });

  test("duplo clique em Concluir objetivo conclui uma vez e dá XP uma vez", async ({ page }) => {
    await loginAluno(page, CONTA);
    const [alvo] = await sql(
      `select ma.id from meta_atividades ma join metas m on m.id = ma.meta_id
        where m.aluno_id = $1 and m.status = 'ativa' and ma.estado = 'pendente' order by ma.id limit 1`, [CONTA.alunoId]);
    expect(alvo, "precisa de objetivo pendente na meta ativa").toBeTruthy();
    await page.getByRole("button", { name: "✓ Concluir" }).first().dblclick();
    await page.waitForLoadState("networkidle");
    await expect.poll(async () => (await sql(
      `select count(*)::int as n from meta_atividades ma join metas m on m.id = ma.meta_id
        where m.aluno_id = $1 and m.status = 'ativa' and ma.estado = 'concluida'`, [CONTA.alunoId]))[0].n, { timeout: 10_000 }).toBeGreaterThan(0);
    const eventos = await sql(
      `select e.referencia_id, count(*)::int as n from aluno_eventos_progresso e
        where e.aluno_id = $1 and e.referencia_tabela = 'meta_atividades' group by 1 having count(*) > 1`, [CONTA.alunoId]);
    expect(eventos, "nenhuma atividade com XP em dobro").toEqual([]);
  });

  test("duas abas: o que cada uma grava fica, e a mesma conclusão nas duas conta uma vez", async ({ context }) => {
    const a = await context.newPage();
    const b = await context.newPage();
    await loginAluno(a, CONTA);
    await b.goto("/");
    await expect(b.getByRole("button", { name: /^Hoje/ }).filter({ visible: true }).first()).toBeVisible({ timeout: 20_000 });

    const t1 = `E2E aba A ${sufixo()}`;
    const t2 = `E2E aba B ${sufixo()}`;
    await preencherRegistro(a, t1);
    await preencherRegistro(b, t2); // a aba B ainda não viu o registro da A
    await a.getByRole("button", { name: "Confirmar estudo" }).click();
    await expect(a.getByRole("heading", { name: "Seu estudo entrou no radar." })).toBeVisible({ timeout: 15_000 });
    await b.getByRole("button", { name: "Confirmar estudo" }).click();
    await expect(b.getByRole("heading", { name: "Seu estudo entrou no radar." })).toBeVisible({ timeout: 15_000 });
    expect([await registrosDo(t1), await registrosDo(t2)]).toEqual([1, 1]);
    for (const p of [a, b]) {
      await p.reload();
      await irParaAba(p, "Registrar");
      await expect(p.getByText(new RegExp(`Matemática · ${t1}`))).toBeVisible({ timeout: 15_000 });
      await expect(p.getByText(new RegExp(`Matemática · ${t2}`))).toBeVisible();
    }

    // a mesma atividade concluída nas duas abas (a segunda com tela velha)
    await irParaAba(a, "Hoje");
    await irParaAba(b, "Hoje");
    const [alvo] = await sql(
      `select ma.id from meta_atividades ma join metas m on m.id = ma.meta_id
        where m.aluno_id = $1 and m.status = 'ativa' and ma.estado = 'pendente' order by ma.id limit 1`, [CONTA.alunoId]);
    expect(alvo, "precisa de objetivo pendente").toBeTruthy();
    await a.getByRole("button", { name: "✓ Concluir" }).first().click();
    await b.getByRole("button", { name: "✓ Concluir" }).first().click();
    await a.waitForLoadState("networkidle");
    await b.waitForLoadState("networkidle");
    const duplicados = await sql(
      `select referencia_id from aluno_eventos_progresso where aluno_id = $1 and referencia_tabela = 'meta_atividades'
        group by 1 having count(*) > 1`, [CONTA.alunoId]);
    expect(duplicados, "nenhum XP em dobro por conclusão repetida").toEqual([]);
  });

  test("falha de API no registro: a tela avisa, o formulário não se perde e o reenvio grava uma vez", async ({ page }) => {
    const topico = `E2E falha ${sufixo()}`;
    await loginAluno(page, CONTA);
    await preencherRegistro(page, topico);
    let derrubadas = 0;
    await page.route("**/rest/v1/registros_estudo*", async (route) => {
      if (route.request().method() === "POST" && derrubadas === 0) { derrubadas++; return route.abort("failed"); }
      return route.fallback();
    });
    await page.getByRole("button", { name: "Confirmar estudo" }).click();
    await expect(page.getByRole("alert").or(page.getByText(/não foi possível|falha|tente de novo|sem conexão/i)).first(), await retratoDaTela(page))
      .toBeVisible({ timeout: 15_000 });
    expect(derrubadas).toBe(1);
    expect(await registrosDo(topico), "nada gravado na falha").toBe(0);
    await expect(campo(page, "Tópico *"), "o que o aluno digitou continua lá").toHaveValue(topico);
    await expect(campo(page, "Questões")).toHaveValue("8");

    await page.getByRole("button", { name: "Confirmar estudo" }).click();
    await expect(page.getByRole("heading", { name: "Seu estudo entrou no radar." })).toBeVisible({ timeout: 15_000 });
    expect(await registrosDo(topico)).toBe(1);
    expect(await eventosDoRegistro(topico)).toBe(1);
  });
});
