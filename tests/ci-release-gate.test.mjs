// Etapa 5 — o release-gate (scripts/ci/release-gate.mjs) e o job que o
// roda no CI. Duas partes:
//   1. a lógica: reprova com job ausente, cancelado, pulado ou falho,
//      relatório ausente, zero testes, jornada crítica pulada ou abaixo
//      do mínimo, SHA ou run diferente, e continue-on-error no ci.yml;
//   2. o ci.yml lido como texto: o job existe, roda sempre, depende dos
//      três obrigatórios, e o e2e-local publica o relatório como saída.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { avaliarGate, conferirJobs, conferirRelatorio, conferirWorkflow, OBRIGATORIOS } from "../scripts/ci/release-gate.mjs";
import { resumoParaGate, avaliar } from "../scripts/e2e/relatorio-jornadas.mjs";
import { JORNADAS } from "../scripts/e2e/jornadas.mjs";

const CI = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const SHA = "a".repeat(40);
const RUN = "123";

// relatório no formato do reporter JSON do Playwright
function playwright(testes) {
  return {
    suites: [{
      title: "x.spec.js",
      specs: testes.map((t, i) => ({
        title: t.titulo ?? `teste ${i}`, file: "x.spec.js", line: i + 1, tags: t.tags,
        tests: [{ projectName: "desktop", status: t.status ?? "expected", results: t.status === "skipped" ? [] : [{ status: t.status === "unexpected" ? "failed" : "passed" }] }],
      })),
    }],
  };
}
const completo = () => JORNADAS.flatMap((j) =>
  Array.from({ length: j.minimo }, (_, i) => ({ titulo: `${j.id} ${i}`, tags: [`j:${j.id}`, "critica"] })));
const REDE_OK = [{ api: 10, hospedado: [] }];
// a saída `relatorio` do e2e-local, exatamente como relatorio-jornadas.mjs a escreve
const saida = (testes = completo(), { sha = SHA, runId = RUN, rede = REDE_OK } = {}) =>
  JSON.stringify(resumoParaGate(avaliar(playwright(testes), rede), { sha, runId, runAttempt: "1" }, rede));
const needsVerdes = (relatorio = saida()) => ({
  "build-e-unitarios": { result: "success", outputs: {} },
  "e2e-local": { result: "success", outputs: { relatorio } },
  "matriz-autorizacao": { result: "success", outputs: {} },
});
const gate = (needs, workflow = CI) => avaliarGate({ needs, workflow, sha: SHA, runId: RUN });

// ── 1. a lógica ─────────────────────────────────────────────────

test("release-gate: tudo verde, relatório completo e do mesmo commit passa", () => {
  const r = gate(needsVerdes());
  assert.deepEqual(r.problemas, []);
  assert.ok(r.relatorio.tabela.every((j) => j.ok));
});

test("release-gate: job obrigatório ausente, cancelado, pulado ou falho reprova, cada um pelo nome", () => {
  for (const job of OBRIGATORIOS) {
    const semJob = needsVerdes();
    delete semJob[job];
    assert.ok(gate(semJob).problemas.includes(`job ${job} ausente do needs do release-gate`), job);
    for (const [result, nome] of [["cancelled", "cancelado"], ["skipped", "pulado"], ["failure", "falhou"]]) {
      const n = needsVerdes();
      n[job] = { ...n[job], result };
      assert.ok(gate(n).problemas.includes(`job ${job} ${nome}`), `${job} ${result}`);
    }
  }
  assert.deepEqual(conferirJobs({}), OBRIGATORIOS.map((j) => `job ${j} ausente do needs do release-gate`));
  assert.deepEqual(conferirJobs(null).length, OBRIGATORIOS.length);
});

test("release-gate: relatório ausente, vazio, ilegível ou de outro formato reprova", () => {
  for (const bruto of [undefined, null, "", "   "]) {
    const n = needsVerdes();
    n["e2e-local"].outputs = bruto === undefined ? {} : { relatorio: bruto };
    assert.ok(gate(n).problemas.some((p) => /relatório de jornadas ausente/.test(p)), String(bruto));
  }
  const skipped = needsVerdes();
  skipped["e2e-local"] = { result: "skipped", outputs: {} };
  const p = gate(skipped).problemas;
  assert.ok(p.includes("job e2e-local pulado") && p.some((x) => /ausente/.test(x)), "pulado some com o relatório junto");
  assert.match(conferirRelatorio("{nao é json", { sha: SHA }).problemas[0], /ilegível/);
  assert.match(conferirRelatorio(JSON.stringify({ versao: 99, testes: [] }), { sha: SHA }).problemas[0], /formato desconhecido/);
});

test("release-gate: zero testes reprova", () => {
  const p = gate(needsVerdes(saida([]))).problemas;
  assert.ok(p.includes("nenhum teste foi executado"), p.join("\n"));
  assert.ok(p.some((x) => /^auth: 0 teste\(s\) crítico\(s\) executado\(s\), mínimo/.test(x)));
});

test("release-gate: jornada crítica pulada (inteira ou um teste) reprova", () => {
  const inteira = completo().map((t) => (t.tags[0] === "j:ciclo" ? { ...t, status: "skipped" } : t));
  const p1 = gate(needsVerdes(saida(inteira))).problemas;
  assert.ok(p1.some((x) => /^ciclo: 0 teste\(s\) crítico\(s\) executado\(s\)/.test(x)), p1.join("\n"));
  assert.ok(p1.some((x) => /^ciclo: teste crítico PULADO/.test(x)));

  const um = completo();
  um[0].status = "skipped";
  assert.ok(gate(needsVerdes(saida(um))).problemas.some((x) => /teste crítico PULADO/.test(x)));
  const falho = completo();
  falho[0].status = "unexpected";
  assert.ok(gate(needsVerdes(saida(falho))).problemas.some((x) => /teste crítico FALHOU/.test(x)));
  const instavel = completo();
  instavel[0].status = "flaky";
  assert.ok(gate(needsVerdes(saida(instavel))).problemas.some((x) => /só passou na repetição/.test(x)));
});

test("release-gate: jornada que sumiu do relatório reprova pelo jornadas.mjs do checkout, não pelo veredito do e2e-local", () => {
  // o e2e-local teria rodado com um jornadas.mjs sem `privacidade` e se
  // declarado limpo; o gate usa a lista deste checkout e acusa
  const semPrivacidade = completo().filter((t) => t.tags[0] !== "j:privacidade");
  const rel = JSON.parse(saida(semPrivacidade));
  rel.problemas = 0;
  const p = gate(needsVerdes(JSON.stringify(rel))).problemas;
  assert.ok(p.some((x) => /^privacidade: 0 teste\(s\) crítico\(s\)/.test(x)), p.join("\n"));
});

test("release-gate: SHA diferente, SHA ausente ou run diferente reprova", () => {
  const outro = "b".repeat(40);
  assert.ok(gate(needsVerdes(saida(completo(), { sha: outro }))).problemas.includes(`relatório de outro commit: SHA ${outro}, este run é ${SHA}`));
  assert.ok(gate(needsVerdes(saida(completo(), { sha: null }))).problemas.some((p) => /SHA ausente, este run/.test(p)));
  assert.ok(gate(needsVerdes(saida(completo(), { runId: "999" }))).problemas.includes(`relatório de outro run: 999, este é ${RUN}`));
  assert.ok(avaliarGate({ needs: needsVerdes(), workflow: CI, sha: undefined, runId: RUN }).problemas.some((p) => /GITHUB_SHA ausente/.test(p)));
});

test("release-gate: problema que só o e2e-local viu (rede hospedada) também reprova", () => {
  const rede = [{ api: 3, hospedado: ["abc.supabase.co"] }];
  const p = gate(needsVerdes(saida(completo(), { rede }))).problemas;
  assert.ok(p.some((x) => /projeto hospedado: abc\.supabase\.co/.test(x)), p.join("\n"));
  // o e2e-local se reprovou por algo que a reavaliação não enxerga: reprova igual
  const rel = JSON.parse(saida());
  rel.problemas = 2;
  assert.ok(gate(needsVerdes(JSON.stringify(rel))).problemas.some((x) => /acusou 2 problema\(s\)/.test(x)));
  delete rel.problemas;
  assert.ok(gate(needsVerdes(JSON.stringify(rel))).problemas.some((x) => /contagem de problemas do e2e-local ausente/.test(x)));
});

test("relatório: a saída do job não leva título nem texto livre (o runner a descartaria)", () => {
  // run 36245732923: "Skip output 'relatorio' since it may contain secret",
  // por causa do título "H.edge.bearer_malformado: as 7 funções com Bearer abc"
  const t = completo();
  t[0].titulo = "H.edge.bearer_malformado: as 7 funções com Bearer abc";
  t[1].status = "unexpected";
  const bruto = saida(t);
  assert.doesNotMatch(bruto, /Bearer|bearer_malformado|teste crítico|FALHOU/);
  const r = JSON.parse(bruto);
  assert.deepEqual(Object.keys(r.testes[0]).sort(), ["execucoes", "projeto", "ref", "status", "tags"]);
  assert.equal(r.testes[0].ref, "x.spec.js:1");
  assert.equal(typeof r.problemas, "number");
  // e o gate continua dizendo QUAL teste, por arquivo:linha
  assert.ok(gate(needsVerdes(bruto)).problemas.includes("auth: teste crítico FALHOU: x.spec.js:2"));
});

test("release-gate: continue-on-error no ci.yml ou job obrigatório removido reprova", () => {
  assert.deepEqual(conferirWorkflow(CI), [], "o ci.yml de hoje tem de passar");
  const comCoe = CI.replace("\n  e2e-local:\n", "\n  e2e-local:\n    continue-on-error: true\n");
  assert.notEqual(comCoe, CI);
  assert.ok(gate(needsVerdes(), comCoe).problemas.some((p) => /usa continue-on-error/.test(p)));
  const passo = CI.replace("      - name: Provas negativas", "      - continue-on-error: true\n        name: Provas negativas");
  assert.ok(conferirWorkflow(passo).some((p) => /usa continue-on-error/.test(p)));
  assert.deepEqual(conferirWorkflow("# um comentário que cita continue-on-error não conta\n" + CI), []);
  const semMatriz = CI.replace(/\n  matriz-autorizacao:\n/, "\n  outra-coisa:\n");
  assert.ok(conferirWorkflow(semMatriz).includes("ci.yml não define o job matriz-autorizacao"));
});

// ── 2. o ci.yml ─────────────────────────────────────────────────

const bloco = (nome) => {
  const i = CI.indexOf(`\n  ${nome}:\n`);
  assert.ok(i > 0, `job ${nome} ausente`);
  const fim = CI.indexOf("\n  # ----", i + 5);
  return CI.slice(i, fim > 0 ? fim : undefined);
};

test("CI release-gate: roda sempre, depende dos três obrigatórios e chama o script", () => {
  const job = bloco("release-gate");
  assert.match(job, /^    if: always\(\)\s*$/m, "o gate roda mesmo com job vermelho, pulado ou cancelado");
  const needs = job.match(/^    needs: \[(.*)\]\s*$/m)?.[1].split(",").map((s) => s.trim());
  assert.deepEqual(needs?.sort(), [...OBRIGATORIOS].sort());
  assert.match(job, /NEEDS: \$\{\{ toJSON\(needs\) \}\}/);
  assert.match(job, /run: node scripts\/ci\/release-gate\.mjs\s*$/m);
  assert.doesNotMatch(CI, /^\s*[^#\n]*continue-on-error/m, "nenhum job ou passo do CI usa continue-on-error");
});

test("CI release-gate: os obrigatórios não têm condição para rodar", () => {
  for (const nome of OBRIGATORIOS) {
    assert.doesNotMatch(bloco(nome), /^    if:/m, `${nome} com if: no job pode ser pulado`);
  }
});

test("CI e2e-local: publica o relatório de jornadas como saída do job, com o passo que roda sempre", () => {
  const job = bloco("e2e-local");
  assert.match(job, /outputs:\n\s+relatorio: \$\{\{ steps\.relatorio\.outputs\.relatorio \}\}/);
  const passo = job.split("\n      - ").find((p) => /id: relatorio/.test(p)) ?? "";
  assert.match(passo, /if: always\(\)/);
  assert.match(passo, /run: node scripts\/e2e\/relatorio-jornadas\.mjs\s*$/m);
});

test("CI matriz-autorizacao e build-e-unitarios: Postgres 17, o major do remoto", () => {
  for (const nome of ["build-e-unitarios", "matriz-autorizacao"]) {
    assert.match(bloco(nome), /image: postgres:17\s*$/m, nome);
  }
  const m = bloco("matriz-autorizacao");
  assert.match(m, /e2-matriz-autorizacao-db\.test\.mjs/);
  assert.match(m, /set -o pipefail/);
  assert.match(m, /conta skipped/);
});
