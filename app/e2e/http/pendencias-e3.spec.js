// @ts-check
/* ETAPA 3 — pendências HTTP do docs/e2-seguranca.md que não estão entre os
   15 casos da camada_http, medidas na stack LOCAL:
     • o reset de senha feito pela coordenação encerra a sessão aberta?
     • conta com credencial revogada (banida) responde diferente no login?
   Cada uma usa um responsável NOVO, criado pela coordenação A com a
   própria função (provisionar-aluno): nada das personas da matriz muda.
   O observado vira anotação do teste (tipo "pendencia_e3"), gravada pelo
   reporter JSON do Playwright; o spec não escreve arquivo. */
import { test, expect } from "@playwright/test";
import { AL } from "../../../tests/matriz-autorizacao.mjs";
import { PERSONAS_HTTP, SENHA_E2E } from "../../../scripts/e2e/contas.mjs";
import { entrar, renovar, rest, funcao, sql, fecharBanco } from "../local/api.js";

function registrar(id, obs) {
  test.info().annotations.push({ type: "pendencia_e3", description: JSON.stringify({ id, ...obs }) });
}
test.afterAll(async () => { await fecharBanco(); });

async function responsavelNovo(nome) {
  const { token } = await entrar(PERSONAS_HTTP.coordA.email, SENHA_E2E);
  const prov = await funcao("provisionar-aluno", { token, body: { tipo: "responsavel", aluno_id: AL.A2, nome } });
  expect(prov.status, JSON.stringify(prov.corpo)).toBe(200);
  const email = `${prov.corpo.codigo.replace(/[^A-Za-z0-9]/g, "").toLowerCase()}@codigo.acesso.local`;
  const [u] = await sql("select id from usuarios where nome = $1 order by criado_em desc limit 1", [nome]);
  return { tokenCoord: token, email, senha: prov.corpo.senhaTemporaria, usuarioId: u.id };
}

test.describe("pendências HTTP da E2", { tag: ["@j:limites_acesso"] }, () => {
  test("E3.reset_encerra_sessao: o reset de senha pela coordenação não derruba a sessão aberta", async () => {
    const r = await responsavelNovo(`E2E Resp Reset ${Date.now()}`);
    const sessao = await entrar(r.email, r.senha);
    expect(sessao.status).toBe(200);
    const reset = await funcao("provisionar-aluno", { token: r.tokenCoord, body: { tipo: "resetar-senha", usuario_id: r.usuarioId } });
    expect(reset.status).toBe(200);
    const antiga = await entrar(r.email, r.senha);
    const leAinda = await rest(`alunos?select=id&id=eq.${AL.A2}`, { token: sessao.token });
    const ref = await renovar(sessao.refresh);
    const refreshMorre = ref.status !== 200;
    registrar("E3.reset_encerra_sessao", {
      observado: refreshMorre ? "refresh_revogado_access_vale_ate_expirar" : "sessao_continua",
      detalhe: `senha antiga depois do reset: ${antiga.status} (${antiga.corpo.error_code ?? "ok"}); refresh com o token de antes: ${ref.status}` +
        `${ref.corpo?.error_code ? ` ${ref.corpo.error_code}` : ""}; o access token de antes ainda lê ${Array.isArray(leAinda.corpo) ? leAinda.corpo.length : "?"} linha(s). ` +
        (refreshMorre
          ? "O reset derruba o refresh (a sessão não se renova), mas o access token já emitido vale até expirar (jwt_expiry, 3600 s)."
          : "O reset NÃO encerra as sessões abertas: quem já estava logado segue logado."),
    });
    expect(antiga.status, "a senha antiga não entra mais").toBe(400);
  });

  test("E3.conta_banida_login: credencial revogada responde diferente só com a senha certa", async () => {
    const r = await responsavelNovo(`E2E Resp Ban ${Date.now()}`);
    const rev = await funcao("provisionar-aluno", { token: r.tokenCoord, body: { tipo: "revogar-credencial", usuario_id: r.usuarioId } });
    expect(rev.status).toBe(200);
    const certa = await entrar(r.email, r.senha);
    const errada = await entrar(r.email, "Senha-Errada-123");
    const inexistente = await entrar("zzzz0000zzzz@codigo.acesso.local", "Senha-Errada-123");
    const enumera = errada.corpo.error_code !== inexistente.corpo.error_code;
    registrar("E3.conta_banida_login", {
      observado: enumera ? "diferente_sem_a_senha" : "igual_sem_a_senha",
      detalhe: `banida + senha certa: ${certa.status} ${certa.corpo.error_code}; banida + senha errada: ${errada.status} ${errada.corpo.error_code}; ` +
        `inexistente: ${inexistente.status} ${inexistente.corpo.error_code}. ` +
        (enumera
          ? "A conta revogada responde diferente da inexistente MESMO SEM a senha: quem tem o código descobre que ele existe e foi revogado. O front mostra a mesma frase nos dois casos; a diferença está na resposta do Auth."
          : "Sem a senha, banida e inexistente respondem igual."),
    });
    expect(certa.status, "conta banida não entra").toBeGreaterThanOrEqual(400);
    expect(certa.token, "nenhum token para conta banida").toBeNull();
  });
});
