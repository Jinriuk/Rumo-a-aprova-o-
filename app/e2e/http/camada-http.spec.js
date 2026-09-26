// @ts-check
/* ETAPA 3 — os 15 casos da camada_http (docs/evidencias/e2-matriz-autorizacao.json),
   contra o Auth, o PostgREST e as Edge Functions da stack LOCAL.

   Cada teste leva o id do caso no título e registra o observado como
   ANOTAÇÃO do próprio teste (tipo "camada_http"): quem grava é o reporter
   JSON do Playwright, e scripts/e2e/registrar-camada-http.mjs lê de lá
   para atualizar a evidência. O spec não escreve arquivo. Negação só
   conta com o hash das tabelas igual antes e depois, como na camada banco. */
import { test, expect } from "@playwright/test";
import { ESC, U, AL, R } from "../../../tests/matriz-autorizacao.mjs";
import { PERSONAS_HTTP, SENHA_E2E } from "../../../scripts/e2e/contas.mjs";
import {
  entrar, renovar, claims, rest, funcao, FUNCOES, sql, hashTabelas, mesmoHash, tokenExpirado, fecharBanco,
} from "../local/api.js";
import { casosTAR, executarHttp, deveBater } from "./matriz-http.js";


const observados = {};
function registrar(id, { observado, status, detalhe }) {
  observados[id] = { observado, status, detalhe, em: new Date().toISOString() };
  test.info().annotations.push({ type: "camada_http", description: JSON.stringify({ id, ...observados[id] }) });
}
test.afterAll(async () => { await fecharBanco(); });

const sessoes = {};
async function sessao(persona) {
  if (sessoes[persona]) return sessoes[persona];
  const p = PERSONAS_HTTP[persona];
  if (!p) throw new Error(`persona sem login real: ${persona}`);
  const s = await entrar(p.email, SENHA_E2E);
  expect(s.status, `login de ${persona}`).toBe(200);
  sessoes[persona] = s;
  return s;
}

// nada de detalhe interno no corpo de erro das funções
const VAZAMENTO = /(stack|at \w+ \(|\.ts:\d+|file:\/\/|postgres|sqlstate|violates|relation "|supabase_url|service_role)/i;

// toda a camada_http é a jornada crítica "limites de acesso"
test.describe("camada_http", { tag: ["@j:limites_acesso", "@critica"] }, () => {
  test.describe.configure({ mode: "serial" });

  test("H.postgrest.accept_profile_app: schema app não é alcançável pela API", async () => {
    const r = await rest("concursos?select=codigo&limit=1", { headers: { "Accept-Profile": "app" } });
    expect(r.status).toBe(406);
    expect(r.corpo?.code).toBe("PGRST106");
    const msg = String(r.corpo?.message ?? "") + String(r.corpo?.hint ?? "");
    expect(msg).not.toMatch(/\bapp\b/);
    registrar("H.postgrest.accept_profile_app", { observado: "negado", status: r.status, detalhe: `${r.corpo.code}: ${r.corpo.message}` });
  });

  test("H.postgrest.rpc_app_backfill: app.backfill_progresso pela API com Content-Profile: app", async () => {
    const { token } = await sessao("coordA");
    const antes = await hashTabelas(["aluno_eventos_progresso"]);
    const r = await rest("rpc/backfill_progresso", {
      token, method: "POST", body: { p_escola: ESC.B }, headers: { "Content-Profile": "app" },
    });
    const depois = await hashTabelas(["aluno_eventos_progresso"]);
    expect(r.status).toBe(406);
    expect(mesmoHash(antes, depois), "eventos de progresso intactos").toBe(true);
    registrar("H.postgrest.rpc_app_backfill", { observado: "negado", status: r.status, detalhe: `${r.corpo?.code}: ${r.corpo?.message}; eventos inalterados` });
  });

  test("H.auth.login_por_persona: cada persona entra de verdade e o token traz as claims da fixture", async () => {
    const conferidas = [];
    for (const [nome, p] of Object.entries(PERSONAS_HTTP)) {
      const s = await sessao(nome);
      const c = claims(s.token);
      expect(c.sub, nome).toBe(p.id);
      expect(c.role, nome).toBe("authenticated");
      expect(c.app_metadata?.papel, `${nome}: papel`).toBe(p.papel);
      expect(c.app_metadata?.escola_id ?? null, `${nome}: escola_id`).toBe(p.escola ?? null);
      conferidas.push(nome);
    }
    registrar("H.auth.login_por_persona", {
      observado: "conforme", status: 200,
      detalhe: `${conferidas.length} personas com login real e claims app_metadata.{escola_id,papel} iguais às da fixture (${conferidas.join(", ")})`,
    });
  });

  test("H.postgrest.matriz_tabelas: casos T.*, A.* e R.* da camada banco, por HTTP", async () => {
    test.setTimeout(240_000);
    const resultados = [];
    for (const caso of casosTAR()) {
      const { token } = await sessao(caso.persona);
      resultados.push({ ...(await executarHttp(caso, token)), deveBater: deveBater(caso.id) });
    }
    const traduzidos = resultados.filter((r) => r.traduzido);
    const semTraducao = resultados.filter((r) => !r.traduzido).map((r) => r.id);
    const divergentes = traduzidos.filter((r) => (r.deveBater ? r.observado !== r.esperado : r.observado === r.esperado));
    const semProva = traduzidos.filter((r) => r.semProva);
    // à parte: representação completa na própria escola esbarra na 0058
    const { token: tokA } = await sessao("coordA");
    const antesEsc = await hashTabelas(["escolas"]);
    const completa = await rest(`escolas?id=eq.${ESC.A}`, {
      token: tokA, method: "PATCH", body: { cor_acento: "#0b3d2f" }, headers: { Prefer: "return=representation" },
    });
    const escolasIntactas = mesmoHash(antesEsc, await hashTabelas(["escolas"]));
    expect(completa.status, "PATCH com select=* na própria escola").toBe(403);
    expect(escolasIntactas, "o 403 do RETURNING desfaz o UPDATE").toBe(true);
    // o caso a caso fica na anotação do teste (vai para o resultados.json)
    test.info().annotations.push({ type: "matriz_http", description: JSON.stringify(resultados) });
    registrar("H.postgrest.matriz_tabelas", {
      observado: divergentes.length || semProva.length ? "divergente" : "conforme",
      status: null,
      detalhe: `${traduzidos.length} casos por HTTP (${traduzidos.filter((r) => r.esperado === "negado").length} negações com hash conferido, ${traduzidos.filter((r) => r.esperado === "permitido").length} controles positivos); ${divergentes.length} divergentes; ${semTraducao.length} sem tradução${semTraducao.length ? `: ${semTraducao.join(", ")}` : ""}. ` +
        `À parte: PATCH na própria escola com representação completa (select=*) dá ${completa.status} ${completa.corpo?.code ?? ""} e não grava, porque a 0058 esconde observacao/contato_nome; o app pede select=id e não é afetado`,
    });
    expect(semProva.map((r) => `${r.id} ${r.requisicao} ${JSON.stringify(r.prova)}`), "negação sem hash igual").toEqual([]);
    expect(divergentes.map((r) => `${r.id} [${r.persona}] esperado ${r.esperado}, observado ${r.observado} · ${r.requisicao} ${JSON.stringify(r.prova)}`)).toEqual([]);
    expect(semTraducao).toEqual([]);
  });

  test("H.postgrest.upsert_on_conflict: UPSERT com id da B não muda a linha da B", async () => {
    const { token } = await sessao("coordA");
    const alvos = [
      ["turmas", { id: R.turmaB, escola_id: ESC.A, nome: "e2 upsert http" }, "id"],
      ["alunos", { id: AL.B1, escola_id: ESC.A, nome: "e2 upsert http" }, "id"],
      ["escolas", { id: ESC.B, nome: "invadida por upsert", slug: "e2-upsert-http" }, "id"],
    ];
    const linhas = [];
    for (const [t, corpo, chave] of alvos) {
      const antes = await hashTabelas([t]);
      const r = await rest(`${t}?on_conflict=${chave}`, {
        token, method: "POST", body: corpo, headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      });
      const depois = await hashTabelas([t]);
      const zero = Array.isArray(r.corpo) ? r.corpo.length === 0 : true;
      expect(r.status >= 400 || zero, `${t}: upsert devia ser recusado ou devolver 0 linhas (status ${r.status})`).toBe(true);
      expect(mesmoHash(antes, depois), `${t}: tabela intacta`).toBe(true);
      linhas.push(`${t}: ${r.status}${r.corpo?.code ? ` ${r.corpo.code}` : ""}`);
    }
    registrar("H.postgrest.upsert_on_conflict", { observado: "negado", status: null, detalhe: `${linhas.join("; ")}; hash das tabelas igual` });
  });

  test("H.edge.escola_parada: coordenação de escola suspensa e cancelada é barrada nas funções", async () => {
    const tabelas = ["alunos", "usuarios", "vinculos_responsaveis", "logs_acesso", "logs_coordenacao", "metas"];
    const linhas = [];
    for (const [persona, aluno] of [["coordS", AL.S1], ["coordX", AL.X1]]) {
      const { token } = await sessao(persona);
      const chamadas = [
        ["gerar-meta", { aluno_id: aluno }],
        ["lgpd-titular", { acao: "exportar", aluno_id: aluno }],
        ["provisionar-aluno", { tipo: "responsavel", aluno_id: aluno, nome: "E2 intruso" }],
        ["revogar-responsavel", { vinculo_id: R.vincA1 }],
      ];
      for (const [fn, body] of chamadas) {
        const antes = await hashTabelas(tabelas);
        const r = await funcao(fn, { token, body });
        const depois = await hashTabelas(tabelas);
        expect(r.status, `${persona} ${fn}`).toBe(403);
        expect(r.corpo?.estado, `${persona} ${fn}`).toBe("escola_nao_operacional");
        expect(mesmoHash(antes, depois), `${persona} ${fn}: sem efeito`).toBe(true);
        linhas.push(`${persona}/${fn}: ${r.status}`);
      }
    }
    registrar("H.edge.escola_parada", { observado: "negado", status: 403, detalhe: `${linhas.join("; ")}; estado escola_nao_operacional, sem efeito` });
  });

  // o porteiro de cada função: quem não tem sessão de escola recebe 401;
  // virar-semana (só a chave de serviço) e backoffice-coordenador (só
  // super admin) respondem 403 a qualquer um que não seja o dono delas
  const PORTEIRO = { "virar-semana": 403, "backoffice-coordenador": 403 };
  const statusSemSessao = (fn) => PORTEIRO[fn] ?? 401;

  async function semEfeitoEmTodas(rotulo, montar) {
    const tabelas = ["alunos", "usuarios", "metas", "vinculos_responsaveis", "logs_acesso", "admin_logs", "virada_execucoes"];
    const linhas = [];
    for (const fn of FUNCOES) {
      const antes = await hashTabelas(tabelas);
      const r = await funcao(fn, montar(fn));
      const depois = await hashTabelas(tabelas);
      expect(r.status, `${rotulo} ${fn}`).toBe(statusSemSessao(fn));
      expect(r.texto, `${rotulo} ${fn}: corpo sem detalhe interno`).not.toMatch(VAZAMENTO);
      expect(mesmoHash(antes, depois), `${rotulo} ${fn}: sem efeito`).toBe(true);
      linhas.push(`${fn} ${r.status}`);
    }
    return linhas;
  }

  test("H.edge.sem_bearer: as 7 funções sem Authorization", async () => {
    const linhas = await semEfeitoEmTodas("sem bearer", () => ({ token: null, body: { aluno_id: AL.A1 } }));
    registrar("H.edge.sem_bearer", {
      observado: "negado", status: null,
      detalhe: `${linhas.join("; ")}; sem efeito. virar-semana e backoffice-coordenador dão 403 (porteiro próprio: chave de serviço / super admin), não 401`,
    });
  });

  test("H.edge.bearer_malformado: as 7 funções com Bearer abc", async () => {
    const linhas = await semEfeitoEmTodas("bearer malformado", () => ({ token: "abc", body: { aluno_id: AL.A1 } }));
    registrar("H.edge.bearer_malformado", { observado: "negado", status: null, detalhe: `${linhas.join("; ")}; sem efeito e sem detalhe interno no corpo` });
  });

  test("H.edge.token_expirado: token expirado da coordA é recusado (controle: o mesmo token válido passa)", async () => {
    // controle: o token forjado com exp no futuro É aceito (chega na validação do corpo)
    const valido = await tokenExpirado(U.coordA, { exp: Math.floor(Date.now() / 1000) + 600, iat: Math.floor(Date.now() / 1000) });
    const controle = await funcao("gerar-meta", { token: valido, body: {} });
    expect(controle.status, "controle: token válido passa do porteiro").toBe(400);
    const expirado = await tokenExpirado(U.coordA);
    const linhas = await semEfeitoEmTodas("token expirado", () => ({ token: expirado, body: { aluno_id: AL.A1 } }));
    registrar("H.edge.token_expirado", {
      observado: "negado", status: 401,
      detalhe: `controle com exp futuro: gerar-meta ${controle.status} (passa do porteiro); com exp no passado: ${linhas.join("; ")}`,
    });
  });

  test("H.edge.outro_tenant: coordA com aluno, vínculo, conta e escola da B no payload", async () => {
    const { token } = await sessao("coordA");
    const tabelas = ["alunos", "usuarios", "metas", "vinculos_responsaveis", "logs_acesso", "logs_coordenacao", "admin_logs", "escolas"];
    const chamadas = [
      ["provisionar-aluno", { tipo: "responsavel", aluno_id: AL.B1, nome: "E2 intruso" }, 404],
      ["provisionar-aluno", { tipo: "resetar-senha", usuario_id: U.alunoB1 }, 404],
      ["provisionar-aluno", { tipo: "revogar-credencial", usuario_id: U.respB1 }, 404],
      ["gerar-meta", { aluno_id: AL.B1 }, 404],
      ["lgpd-titular", { acao: "exportar", aluno_id: AL.B1 }, 404],
      ["lgpd-titular", { acao: "excluir", aluno_id: AL.B1 }, 404],
      ["revogar-responsavel", { vinculo_id: R.vincB1 }, 404],
      ["backoffice-coordenador", { escola_id: ESC.B, nome: "E2 intruso", email: "intruso@e2.local" }, 403],
    ];
    const linhas = [];
    for (const [fn, body, esperado] of chamadas) {
      const antes = await hashTabelas(tabelas);
      const r = await funcao(fn, { token, body });
      const depois = await hashTabelas(tabelas);
      expect(r.status, `${fn} ${JSON.stringify(body)}`).toBe(esperado);
      expect(mesmoHash(antes, depois), `${fn}: sem efeito`).toBe(true);
      linhas.push(`${fn}${body.tipo ? `/${body.tipo}` : body.acao ? `/${body.acao}` : ""} ${r.status}`);
    }
    registrar("H.edge.outro_tenant", { observado: "negado", status: null, detalhe: `${linhas.join("; ")}; sem efeito` });
  });

  test("H.edge.metodo_errado: GET, PUT e DELETE nas 7 funções", async () => {
    const linhas = [];
    for (const fn of FUNCOES) {
      for (const method of ["GET", "PUT", "DELETE"]) {
        const r = await funcao(fn, { method, token: null });
        expect(r.status, `${method} ${fn}`).toBe(405);
        linhas.push(`${method} ${fn} ${r.status}`);
      }
    }
    registrar("H.edge.metodo_errado", { observado: "negado", status: 405, detalhe: `21 chamadas, todas 405` });
  });

  test("H.edge.options_cors: preflight direto no Edge Runtime, só a origem permitida recebe CORS", async () => {
    const PERMITIDA = process.env.E2E_FRONT_ORIGIN || "http://127.0.0.1:4173";
    const RECUSADAS = ["http://localhost:5173", "https://evil.example", "https://app.trilivaedu.com.br", "https://rumo-a-aprova-o-git-x-jinriuk.vercel.app"];
    const linhas = [];
    for (const fn of FUNCOES) {
      const ok = await funcao(fn, { method: "OPTIONS", direto: true, headers: { Origin: PERMITIDA, "Access-Control-Request-Method": "POST" } });
      expect(ok.status, `${fn} preflight`).toBe(200);
      expect(ok.headers.get("access-control-allow-origin"), `${fn}: permitida`).toBe(PERMITIDA);
      for (const origem of RECUSADAS) {
        const r = await funcao(fn, { method: "OPTIONS", direto: true, headers: { Origin: origem, "Access-Control-Request-Method": "POST" } });
        expect(r.headers.get("access-control-allow-origin"), `${fn}: ${origem} não pode receber CORS`).toBeNull();
      }
      linhas.push(fn);
    }
    // registro da diferença da stack local: o Kong responde "*" antes da função
    const kong = await funcao("gerar-meta", { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "POST" } });
    registrar("H.edge.options_cors", {
      observado: "conforme", status: 200,
      detalhe: `7 funções direto no Edge Runtime: ${PERMITIDA} recebe Access-Control-Allow-Origin; ${RECUSADAS.join(", ")} não recebem. ` +
        `Pelo Kong LOCAL o preflight volta "${kong.headers.get("access-control-allow-origin")}" (plugin de CORS da CLI, não existe no hospedado da mesma forma: conferir lá na Etapa 5)`,
    });
  });

  test("H.auth.sessao_revogada: token de antes da revogação e refresh depois", async () => {
    // responsável NOVO, criado pela própria coordenação A, vinculado ao A2:
    // o caso não mexe nos vínculos que as outras provas usam
    const { token: tokCoord } = await sessao("coordA");
    const prov = await funcao("provisionar-aluno", { token: tokCoord, body: { tipo: "responsavel", aluno_id: AL.A2, nome: "E2E Resp Revogação" } });
    expect(prov.status, JSON.stringify(prov.corpo)).toBe(200);
    const emailResp = `${prov.corpo.codigo.replace(/[^A-Za-z0-9]/g, "").toLowerCase()}@codigo.acesso.local`;
    const resp = await entrar(emailResp, prov.corpo.senhaTemporaria);
    expect(resp.status).toBe(200);

    const ler = async (tok) => (await rest(`alunos?select=id&id=eq.${AL.A2}`, { token: tok })).corpo;
    expect((await ler(resp.token)).length, "antes: lê o aluno vinculado").toBe(1);

    const [v] = await sql("select v.id from vinculos_responsaveis v join usuarios u on u.id = v.responsavel_id where v.aluno_id = $1 and u.nome = 'E2E Resp Revogação' order by v.criado_em desc limit 1", [AL.A2]);
    const rev = await funcao("revogar-responsavel", { token: tokCoord, body: { vinculo_id: v.id } });
    expect(rev.status).toBe(200);

    const depoisMesmoToken = await ler(resp.token);
    expect(depoisMesmoToken.length, "o MESMO access token já não lê o aluno").toBe(0);
    const ref = await renovar(resp.refresh);
    const depoisRefresh = ref.token ? await ler(ref.token) : [];
    expect(depoisRefresh.length, "nem com token renovado").toBe(0);
    registrar("H.auth.sessao_revogada", {
      observado: "negado", status: null,
      detalhe: `leitura do aluno negada já com o access token anterior (0 linhas); refresh depois da revogação: ${ref.status} (a conta segue ativa: revogar o vínculo não encerra a sessão), e o token novo também lê 0 linhas`,
    });
  });

  test("H.auth.refresh_reemite_claims: ex-coordenação segue com papel coordenacao depois do refresh", async () => {
    const s = await sessao("coordRebaixada");
    const [u] = await sql("select papel from usuarios where id = $1", [U.coordRebaixada]);
    expect(u.papel, "fixture: usuarios.papel já é aluno").toBe("aluno");
    expect(claims(s.token).app_metadata.papel).toBe("coordenacao");
    const ref = await renovar(s.refresh);
    expect(ref.status).toBe(200);
    const papelDepois = claims(ref.token).app_metadata.papel;
    const le = await rest(`alunos?select=id&id=eq.${AL.A2}`, { token: ref.token });
    registrar("H.auth.refresh_reemite_claims", {
      observado: papelDepois === "coordenacao" ? "janela_indefinida" : "claims_atualizadas",
      status: ref.status,
      detalhe: `refresh ${ref.status}; o token novo diz papel=${papelDepois} (app_metadata não acompanha usuarios.papel) e lê ${Array.isArray(le.corpo) ? le.corpo.length : "?"} aluno(s) da A: a janela não é 3600 s, dura enquanto o app_metadata não for trocado no Auth`,
    });
    // registro de comportamento, não correção: o que se exige é que o
    // resultado fique medido e conhecido
    expect(papelDepois).toBe("coordenacao");
  });

  test("H.auth.login_codigo_limite: código inexistente e senha errada respondem igual", async () => {
    const inexistente = await entrar("zzzz9999zzzz@codigo.acesso.local", "Qualquer-Senha-1");
    const senhaErrada = await entrar(`${"LUCASDEMO2026".toLowerCase()}@codigo.acesso.local`, "Qualquer-Senha-1");
    expect(inexistente.status).toBe(400);
    expect(senhaErrada.status).toBe(400);
    expect(inexistente.corpo.error_code).toBe(senhaErrada.corpo.error_code);
    expect(inexistente.corpo.msg).toBe(senhaErrada.corpo.msg);
    // tentativas repetidas: registra o que a stack local faz
    const statuses = [];
    for (let i = 0; i < 40; i++) statuses.push((await entrar("zzzz9999zzzz@codigo.acesso.local", `Errada-${i}`)).status);
    const limitou = statuses.includes(429);
    registrar("H.auth.login_codigo_limite", {
      observado: limitou ? "conforme" : "parcial",
      status: 400,
      detalhe: `anti-enumeração: código inexistente e senha errada dão ${inexistente.status} ${inexistente.corpo.error_code} com a mesma mensagem. ` +
        `Limite: 40 tentativas seguidas → ${limitou ? "429 observado" : "nenhum 429"}. ` +
        (limitou ? "" : "Na stack local o GoTrue não limita /token porque a CLI não define GOTRUE_RATE_LIMIT_HEADER; o limite do hospedado não é observável aqui e fica para a Etapa 5."),
    });
  });

  test("fecha: toda camada_http tem observado", async () => {
    const faltam = ["H.postgrest.accept_profile_app", "H.postgrest.rpc_app_backfill", "H.auth.login_por_persona", "H.postgrest.matriz_tabelas",
      "H.postgrest.upsert_on_conflict", "H.edge.escola_parada", "H.edge.sem_bearer", "H.edge.bearer_malformado", "H.edge.token_expirado",
      "H.edge.outro_tenant", "H.edge.metodo_errado", "H.edge.options_cors", "H.auth.sessao_revogada", "H.auth.refresh_reemite_claims",
      "H.auth.login_codigo_limite"].filter((id) => !observados[id]);
    expect(faltam).toEqual([]);
  });
});
