// @ts-check
/* Jornada do MOTOR DE CICLO (Etapa 3): virada de semana, encerramento e
   próximo ciclo, com datas CONTROLADAS e o fuso America/Sao_Paulo.

   Como a data é controlada
   • A virada de verdade é app.virar_semana(escola, p_hoje), a mesma que o
     cron chama (o cron sai da stack no banco.sh). O p_hoje não vem de um
     número escrito no teste: vem de um INSTANTE UTC convertido pelo
     próprio Postgres com a mesma regra de app.hoje_local()
     ((instante at time zone 'America/Sao_Paulo')::date). Assim a fronteira
     da meia-noite de Brasília é exercida: 02:59:59Z de segunda ainda é
     domingo em São Paulo, 03:00:00Z já é segunda.
   • O relógio do navegador é fixado no mesmo instante (page.clock), porque
     a tela também decide a semana corrente pela data.
   • O calendário da trilha fica no PASSADO, relativo ao dia da execução
     (semana 1 começa 4 segundas atrás): o relógio fixado do navegador
     nunca fica à frente do servidor, então o token da sessão continua
     válido para o supabase-js.

   Fixture própria (escola, coordenação, aluna e trilha com sufixo), criada
   aqui pela trava da stack local: não mexe em nada das outras jornadas. */
import { test, expect } from "./local/base.js";
import { amb, sql, funcao, entrar, fecharBanco } from "./local/api.js";
import { createClient } from "../../scripts/e2e/deps.mjs";
import { SENHA_E2E, entrarCom, botaoVisivel, irParaAba, retratoDaTela, sufixo } from "./_apoio.js";

const admin = createClient(amb.apiUrl, amb.serviceKey, { auth: { persistSession: false } });
const FUSO = "America/Sao_Paulo";

const s = sufixo();
const F = {
  escola: null, trilha: null, aluno: null, coordEmail: `ciclo-${s}@e2e.local`,
  alunoCodigo: `E2ECICLO${s.toUpperCase().replace(/[^A-Z0-9]/g, "")}`.slice(0, 20),
  semanas: [], // [{ numero, inicio, fim }]
};

/** Data local de São Paulo para um instante UTC, pelo próprio Postgres. */
async function dataSP(instanteIso) {
  const [r] = await sql(`select (($1::timestamptz) at time zone '${FUSO}')::date::text as d`, [instanteIso]);
  return r.d;
}
/** A virada como o cron roda (service role = postgres aqui), na data de um instante. */
async function virar(instanteIso) {
  const hoje = await dataSP(instanteIso);
  const [r] = await sql("select * from app.virar_semana($1::uuid, $2::date)", [F.escola, hoje]);
  return { hoje, ...r };
}
async function metasDaAluna() {
  return sql(`select m.semana_numero, m.status, m.trilha_id from metas m where m.aluno_id = $1 order by m.inicio`, [F.aluno]);
}

test.beforeAll(async () => {
  // semana 1 começa 4 segundas atrás (data de São Paulo), semana 2 logo depois
  const [{ segunda }] = await sql(`select (date_trunc('week', app.hoje_local()) - interval '28 days')::date::text as segunda`);
  const [esc] = await sql(`insert into escolas (nome, slug, status) values ($1, $2, 'ativa') returning id`, [`E2E Escola Ciclo ${s}`, `e2e-ciclo-${s}`]);
  F.escola = esc.id;
  const [tr] = await sql(`insert into trilhas (nicho, nome, versao, publicada) values ($1, $2, 1, true) returning id`, [`e2e-ciclo-${s}`, `E2E Trilha Ciclo ${s}`]);
  F.trilha = tr.id;
  await sql(`insert into disciplinas (trilha_id, codigo, nome, abrev, cor, ordem) values ($1, 'mat', 'Matemática', 'Mat', '#CDA349', 0)`, [F.trilha]);
  await sql(`insert into trilha_semanas (trilha_id, numero, inicio, fim, foco)
             values ($1, 1, $2::date, $2::date + 6, 'E2E foco 1'), ($1, 2, $2::date + 7, $2::date + 13, 'E2E foco 2')`, [F.trilha, segunda]);
  await sql(`insert into atividades_modelo (trilha_id, semana_numero, disciplina_codigo, prioridade, texto, ordem)
             values ($1, 1, 'mat', 'F', 'E2E atividade da semana 1', 0), ($1, 2, 'mat', 'F', 'E2E atividade da semana 2', 0)`, [F.trilha]);
  F.semanas = await sql(`select numero, inicio::text, fim::text from trilha_semanas where trilha_id = $1 order by numero`, [F.trilha]);

  const [cn] = await sql(`select id from concursos where codigo = 'cn'`);
  const [al] = await sql(`insert into alunos (escola_id, nome, trilha_id, concurso_id) values ($1, $2, $3, $4) returning id`,
    [F.escola, `E2E Aluna Ciclo ${s}`, F.trilha, cn.id]);
  F.aluno = al.id;

  // contas pelo Auth local (a coordenação e a aluna), com as claims
  const coord = await admin.auth.admin.createUser({
    email: F.coordEmail, password: SENHA_E2E, email_confirm: true,
    app_metadata: { escola_id: F.escola, papel: "coordenacao" }, user_metadata: { nome: `Coordenação Ciclo ${s}` },
  });
  if (coord.error) throw coord.error;
  await sql(`insert into usuarios (id, escola_id, papel, nome, email) values ($1, $2, 'coordenacao', $3, $4)`,
    [coord.data.user.id, F.escola, `Coordenação Ciclo ${s}`, F.coordEmail]);
  const aluna = await admin.auth.admin.createUser({
    email: `${F.alunoCodigo.toLowerCase()}@codigo.acesso.local`, password: SENHA_E2E, email_confirm: true,
    app_metadata: { escola_id: F.escola, papel: "aluno" }, user_metadata: { nome: `E2E Aluna Ciclo ${s}` },
  });
  if (aluna.error) throw aluna.error;
  await sql(`insert into usuarios (id, escola_id, papel, nome, must_change_password) values ($1, $2, 'aluno', $3, false)`,
    [aluna.data.user.id, F.escola, `E2E Aluna Ciclo ${s}`]);
  await sql(`update alunos set usuario_id = $1 where id = $2`, [aluna.data.user.id, F.aluno]);
});
test.afterAll(async () => { await fecharBanco(); });

test.describe("motor de ciclo", { tag: ["@j:ciclo", "@critica"] }, () => {
  test.describe.configure({ mode: "serial" });

  test("app.hoje_local() é a data de São Paulo, qualquer que seja o fuso da sessão do banco", async () => {
    for (const tz of ["UTC", "Asia/Tokyo", "America/Sao_Paulo"]) {
      const [r] = await sql(`select set_config('timezone', $1, false) as tz,
                                    app.hoje_local() = (now() at time zone '${FUSO}')::date as igual`, [tz]);
      expect(r.igual, `sessão em ${tz}`).toBe(true);
    }
    await sql("select set_config('timezone', 'UTC', false)");
  });

  test("virada no meio da semana 1 gera a meta da semana 1", async ({ page }) => {
    const instante = `${F.semanas[0].inicio}T15:00:00Z`; // segunda da semana 1, meio-dia em São Paulo
    const r = await virar(instante);
    expect(r.hoje).toBe(F.semanas[0].inicio);
    expect(r.metas_geradas).toBe(1);
    expect(await metasDaAluna()).toEqual([{ semana_numero: 1, status: "ativa", trilha_id: F.trilha }]);

    await page.clock.setFixedTime(new Date(instante));
    await entrarCom(page, { codigo: F.alunoCodigo }, SENHA_E2E);
    await expect(botaoVisivel(page, "Hoje"), await retratoDaTela(page)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("E2E atividade da semana 1")).toBeVisible({ timeout: 15_000 });
  });

  test("fronteira de Brasília: 02:59:59Z de segunda ainda é domingo; 03:00Z vira a semana", async ({ page }) => {
    const segunda2 = F.semanas[1].inicio;
    const antes = await virar(`${segunda2}T02:59:59Z`);
    expect(antes.hoje, "02:59:59Z é domingo em São Paulo").toBe(F.semanas[0].fim);
    expect([antes.metas_fechadas, antes.metas_geradas]).toEqual([0, 0]);
    expect(await metasDaAluna()).toEqual([{ semana_numero: 1, status: "ativa", trilha_id: F.trilha }]);

    const depois = await virar(`${segunda2}T03:00:00Z`);
    expect(depois.hoje).toBe(segunda2);
    expect([depois.metas_fechadas, depois.metas_geradas]).toEqual([1, 1]);
    expect(await metasDaAluna()).toEqual([
      { semana_numero: 1, status: "fechada", trilha_id: F.trilha },
      { semana_numero: 2, status: "ativa", trilha_id: F.trilha },
    ]);
    // idempotente: a mesma virada de novo não duplica nada
    const repetida = await virar(`${segunda2}T03:00:00Z`);
    expect([repetida.metas_fechadas, repetida.metas_geradas]).toEqual([0, 0]);

    await page.clock.setFixedTime(new Date(`${segunda2}T15:00:00Z`));
    await entrarCom(page, { codigo: F.alunoCodigo }, SENHA_E2E);
    await expect(page.getByText("E2E atividade da semana 2"), await retratoDaTela(page)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("E2E atividade da semana 1")).toHaveCount(0);
  });

  test("encerramento: depois da última semana a meta fecha, nada nasce e a tela diz que o ciclo acabou", async ({ page }) => {
    const [{ dia }] = await sql(`select ($1::date + 1)::text as dia`, [F.semanas[1].fim]);
    const r = await virar(`${dia}T03:00:00Z`);
    expect([r.metas_fechadas, r.metas_geradas]).toEqual([1, 0]);
    const [estado] = await sql("select estado from app.estado_ciclo($1::uuid, $2::date)", [F.trilha, r.hoje]);
    expect(estado.estado).toBe("encerrado");
    // gerar-meta pela coordenação responde o estado, sem marcar o aluno como pendente
    const { token } = await entrar(F.coordEmail, SENHA_E2E);
    const g = await funcao("gerar-meta", { token, body: { aluno_id: F.aluno } });
    expect(g.corpo).toEqual({ estado: "ciclo_encerrado" });
    const [al] = await sql("select status_provisionamento from alunos where id = $1", [F.aluno]);
    expect(al.status_provisionamento).toBe("ok");

    await entrarCom(page, { codigo: F.alunoCodigo }, SENHA_E2E);
    await expect(page.getByText("CICLO CONCLUÍDO"), await retratoDaTela(page)).toBeVisible({ timeout: 20_000 });
  });

  test("próximo ciclo: a coordenação abre a edição nova, a aluna muda de trilha e o histórico fica", async ({ page }) => {
    const [{ ancora }] = await sql(`select (app.hoje_local() + 20)::text as ancora`);
    const [xpAntes] = await sql("select coalesce(sum(xp_delta), 0)::int as xp from aluno_eventos_progresso where aluno_id = $1", [F.aluno]);

    await entrarCom(page, { email: F.coordEmail }, SENHA_E2E);
    await expect(page.getByText("Painel de gestão").first()).toBeVisible({ timeout: 20_000 });
    await irParaAba(page, "Ciclo");
    await page.getByRole("checkbox", { name: `Incluir E2E Aluna Ciclo ${s} no próximo ciclo` }).check();
    await page.getByLabel("Data da próxima prova (fim da nova edição)").fill(ancora);
    await page.getByRole("button", { name: "Abrir ciclo para 1 aluno" }).click();
    await page.getByRole("dialog").filter({ visible: true }).last().getByRole("button", { name: "Abrir ciclo" }).click();
    await expect.poll(async () => (await sql("select trilha_id from alunos where id = $1", [F.aluno]))[0].trilha_id, { timeout: 15_000 })
      .not.toBe(F.trilha);

    const [nova] = await sql(`select t.id, t.nicho, t.versao, max(s.fim)::text as fim, min(s.inicio)::text as inicio, count(s.*)::int as semanas
                                from alunos a join trilhas t on t.id = a.trilha_id join trilha_semanas s on s.trilha_id = t.id
                               where a.id = $1 group by t.id`, [F.aluno]);
    expect(nova.nicho).toBe(`e2e-ciclo-${s}`);
    expect(nova.versao).toBe(2);
    expect(nova.semanas).toBe(2);
    const [{ domingo }] = await sql(`select ($1::date + ((7 - extract(isodow from $1::date)::int) % 7))::text as domingo`, [ancora]);
    expect(nova.fim, "a última semana termina no domingo da semana da prova").toBe(domingo);
    // o histórico do ciclo anterior fica preso à edição antiga, intacto
    expect((await metasDaAluna()).filter((m) => m.trilha_id === F.trilha).map((m) => m.status)).toEqual(["fechada", "fechada"]);
    const [xpDepois] = await sql("select coalesce(sum(xp_delta), 0)::int as xp from aluno_eventos_progresso where aluno_id = $1", [F.aluno]);
    expect(xpDepois.xp, "XP segue com a aluna").toBe(xpAntes.xp);

    // a virada no começo da edição nova gera a meta da semana 1 dela
    const r = await virar(`${nova.inicio}T03:00:00Z`);
    expect(r.metas_geradas).toBe(1);
    const atuais = (await metasDaAluna()).filter((m) => m.status === "ativa");
    expect(atuais).toEqual([{ semana_numero: 1, status: "ativa", trilha_id: nova.id }]);
  });
});
