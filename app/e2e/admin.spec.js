// @ts-check
/* Jornada do SUPER ADMIN (Etapa 3): cria escola, provisiona a
   coordenação (que ativa o acesso pelo e-mail do capturador LOCAL),
   muda o status da escola e o efeito chega na sessão da coordenação; e
   usuário comum é negado no backoffice, na tela e na API.

   Nada de e-mail sai: RESEND_API_KEY não existe na stack, então a
   função marca o envio como pendente; a coordenação nova pede o link por
   "Esqueci minha senha", que o Auth local manda para o Mailpit. */
import { test, expect } from "./local/base.js";
import { sql, esperarEmail, entrar, rest, fecharBanco } from "./local/api.js";
import {
  CONTAS, SENHA_E2E, SENHA_NOVA_E2E, loginCoordenacao, campo, sufixo, entrarCom, retratoDaTela, sair,
} from "./_apoio.js";

test.afterAll(async () => { await fecharBanco(); });

async function loginSuperAdmin(page) {
  await entrarCom(page, { email: CONTAS.superAdmin.email }, SENHA_E2E);
  await expect(page.getByRole("heading", { name: "Backoffice" })).toBeVisible({ timeout: 20_000 });
}

test.describe("super admin", { tag: ["@j:super_admin", "@critica"] }, () => {
  test.describe.configure({ mode: "serial" });
  const s = sufixo();
  const escola = `E2E Escola ${s}`;
  const slug = `e2e-${s}`;
  const coordEmail = `coord-${s}@e2e.local`;

  test("cria escola com coordenação: escola, conta, claims e log no banco", async ({ page }) => {
    await loginSuperAdmin(page);
    await page.getByRole("button", { name: /^Escolas/ }).click();
    await page.getByRole("button", { name: "+ Nova escola" }).click();
    await campo(page, "Nome de exibição *").fill(escola);
    await campo(page, "Slug (URL) *").fill(slug);
    await page.getByRole("button", { name: /Criar coordenador agora/ }).click();
    await campo(page, "Nome do coordenador *").fill(`Coordenação ${s}`);
    await campo(page, "E-mail do coordenador *").fill(coordEmail);
    await page.getByRole("button", { name: "+ Criar escola" }).click();
    await expect(page.getByText(new RegExp(`Escola "${escola}" criada com sucesso`)), await retratoDaTela(page)).toBeVisible({ timeout: 20_000 });

    const [e] = await sql("select id, status from escolas where slug = $1", [slug]);
    expect(e?.status).toBe("implantacao");
    const [u] = await sql("select id, papel, escola_id from usuarios where email = $1", [coordEmail]);
    expect(u).toMatchObject({ papel: "coordenacao", escola_id: e.id });
    const [auth] = await sql("select raw_app_meta_data->>'escola_id' as escola_id, raw_app_meta_data->>'papel' as papel from auth.users where id = $1", [u.id]);
    expect(auth).toEqual({ escola_id: e.id, papel: "coordenacao" });
    const logs = await sql("select acao, detalhe->>'status' as status from admin_logs where escola_id = $1 order by em", [e.id]);
    expect(logs.map((l) => l.acao)).toEqual(expect.arrayContaining(["vincular-coordenador"]));
    // sem Resend na stack: o envio fica pendente e nada sai da máquina
    expect(logs.find((l) => l.acao === "vincular-coordenador")?.status).toBe("coordenador_criado_email_pendente");
  });

  test("a coordenação nova ativa o acesso pelo e-mail do capturador local e vê a escola", async ({ page }) => {
    // a criação já gerou um link de recuperação (generateLink): o Auth só
    // aceita outro pedido para a mesma conta depois do intervalo mínimo
    // (smtp max_frequency, 1 s na stack local). Antes disso o pedido é
    // recusado com 429 e a tela diz "Solicitação recebida" do mesmo jeito,
    // por desenho (não revela se o e-mail existe). Espera o intervalo a
    // partir do carimbo do próprio Auth, sem sono às cegas.
    await expect.poll(async () => {
      const [r] = await sql("select extract(epoch from (now() - recovery_sent_at)) as s from auth.users where email = $1", [coordEmail]);
      return Number(r?.s ?? 99);
    }, { timeout: 10_000 }).toBeGreaterThan(1.5);
    const desde = Date.now() - 1000;
    await page.goto("/");
    await page.getByRole("button", { name: /Coordenação/ }).click();
    await page.getByRole("button", { name: "Esqueci minha senha" }).click();
    await page.getByLabel("E-mail", { exact: true }).fill(coordEmail);
    await page.getByRole("button", { name: "Enviar instruções" }).click();
    await expect(page.getByText("Solicitação recebida")).toBeVisible({ timeout: 15_000 });
    const email = await esperarEmail(coordEmail, { desde });
    const link = (email.html.match(/href="([^"]+)"/) ?? [])[1]?.replace(/&amp;/g, "&");
    expect(new URL(link).hostname).toBe("127.0.0.1");
    await page.goto(link);
    await campo(page, "Nova senha").fill(SENHA_NOVA_E2E);
    await campo(page, "Confirmar senha").fill(SENHA_NOVA_E2E);
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page.getByText("Senha alterada!")).toBeVisible({ timeout: 20_000 });
    await page.goto("/");
    await entrarCom(page, { email: coordEmail }, SENHA_NOVA_E2E);
    await expect(page.getByRole("heading", { name: escola })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Painel de gestão").first()).toBeVisible();
  });

  test("suspende a escola: a coordenação dela perde o painel; reativar devolve", async ({ page, novoContexto }) => {
    const ctx = await novoContexto();
    const pCoord = await ctx.newPage();
    try {
      await entrarCom(pCoord, { email: coordEmail }, SENHA_NOVA_E2E);
      await expect(pCoord.getByText("Painel de gestão").first()).toBeVisible({ timeout: 20_000 });

      await loginSuperAdmin(page);
      await page.getByRole("button", { name: /^Escolas/ }).click();
      await page.getByRole("button", { name: new RegExp(escola) }).first().click();
      await page.getByRole("button", { name: "⏸ Suspender escola" }).click();
      await page.getByRole("button", { name: "Sim, confirmar" }).click();
      await expect.poll(async () => (await sql("select status from escolas where slug = $1", [slug]))[0].status, { timeout: 15_000 }).toBe("suspensa");

      await pCoord.reload();
      await expect(pCoord.getByText("Acesso temporariamente suspenso")).toBeVisible({ timeout: 20_000 });
      await expect(pCoord.getByText("Painel de gestão")).toHaveCount(0);

      await page.getByRole("button", { name: "▶ Reativar escola" }).click();
      await page.getByRole("button", { name: /^Confirmar$|Sim, confirmar/ }).click();
      await expect.poll(async () => (await sql("select status from escolas where slug = $1", [slug]))[0].status, { timeout: 15_000 }).toBe("ativa");
      await pCoord.reload();
      await expect(pCoord.getByText("Painel de gestão").first()).toBeVisible({ timeout: 20_000 });

      const acoes = await sql("select acao from admin_logs a join escolas e on e.id = a.escola_id where e.slug = $1", [slug]);
      expect(acoes.length, "cada mudança de status no log do backoffice").toBeGreaterThanOrEqual(3);
    } finally { await ctx.close(); }
  });

  test("usuário comum é negado: coordenação não vê backoffice nem executa as funções dele", async ({ page }) => {
    await loginCoordenacao(page, CONTAS.coordenacaoVitrine);
    await expect(page.getByRole("heading", { name: "Backoffice" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "+ Nova escola" })).toHaveCount(0);
    await sair(page);

    const { token } = await entrar(CONTAS.coordenacaoVitrine.email, SENHA_E2E);
    const lista = await rest("rpc/backoffice_escolas", { token, method: "POST", body: {} });
    expect(lista.status === 200 ? lista.corpo.length : 0, `backoffice_escolas pela coordenação (status ${lista.status})`).toBe(0);
    const antes = await sql("select count(*)::int as n from escolas");
    const criar = await rest("rpc/backoffice_criar_escola", {
      token, method: "POST",
      body: {
        p_nome: "E2E intrusa", p_slug: `e2e-intrusa-${s}`, p_cidade: null, p_uf: null, p_plano: null, p_limite_alunos: null,
        p_status_inicial: "implantacao", p_email_institucional: null, p_telefone_contato: null, p_contato_nome: null, p_contato_observacao: null,
      },
    });
    // a função existe com esta assinatura: a recusa tem de ser de permissão,
    // não 404 de função não encontrada (PGRST202)
    expect(criar.corpo?.code, JSON.stringify(criar.corpo)).not.toBe("PGRST202");
    expect(criar.status, JSON.stringify(criar.corpo)).toBeGreaterThanOrEqual(400);
    expect(await sql("select count(*)::int as n from escolas")).toEqual(antes);
    const BETA = "22222222-2222-4222-8222-222222222222";
    const status = await rest("rpc/backoffice_definir_status", { token, method: "POST", body: { p_escola: BETA, p_status: "suspensa" } });
    expect(status.corpo?.code, JSON.stringify(status.corpo)).not.toBe("PGRST202");
    expect(status.status).toBeGreaterThanOrEqual(400);
    const [beta] = await sql("select status from escolas where id = $1", [BETA]);
    expect(beta.status).not.toBe("suspensa");
  });
});
