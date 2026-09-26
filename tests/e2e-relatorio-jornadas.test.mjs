// Etapa 3 — o portão do job E2E (scripts/e2e/relatorio-jornadas.mjs) e a
// sanitização dos artefatos (scripts/e2e/sanitizar-artefatos.mjs).
// O job tem de REPROVAR com zero testes, com jornada crítica abaixo do
// mínimo, com teste crítico pulado, falho ou instável, e com chamada a
// projeto hospedado; e nenhum token pode subir como artefato.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { avaliar } from "../scripts/e2e/relatorio-jornadas.mjs";
import { JORNADAS } from "../scripts/e2e/jornadas.mjs";
import { sanitizar, redigir } from "../scripts/e2e/sanitizar-artefatos.mjs";

// relatório no formato do reporter JSON do Playwright
function relatorio(testes) {
  return {
    suites: [{
      title: "x.spec.js",
      specs: testes.map((t, i) => ({
        title: t.titulo ?? `teste ${i}`, file: "x.spec.js", tags: t.tags,
        tests: [{ projectName: "desktop", status: t.status ?? "expected", results: t.status === "skipped" ? [] : [{ status: t.status === "unexpected" ? "failed" : "passed" }] }],
      })),
    }],
  };
}
const completo = () => JORNADAS.flatMap((j) =>
  Array.from({ length: j.minimo }, (_, i) => ({ titulo: `${j.id} ${i}`, tags: [`j:${j.id}`, "critica"] })));
const REDE_OK = [{ api: 10, hospedado: [] }];

test("portão: execução completa e verde passa", () => {
  const r = avaliar(relatorio(completo()), REDE_OK);
  assert.deepEqual(r.problemas, []);
  assert.ok(r.tabela.every((j) => j.ok));
});

test("portão: zero testes reprova", () => {
  const r = avaliar(relatorio([]), []);
  assert.ok(r.problemas.includes("nenhum teste foi executado"));
  assert.ok(r.problemas.some((p) => /^auth: 0 teste\(s\) crítico\(s\) executado\(s\), mínimo/.test(p)));
});

test("portão: jornada crítica abaixo do mínimo reprova", () => {
  const menos = completo().filter((t, i, a) => !(t.tags[0] === "j:ciclo" && a.findIndex((x) => x.tags[0] === "j:ciclo") === i));
  const r = avaliar(relatorio(menos), REDE_OK);
  assert.deepEqual(r.problemas, [`ciclo: ${JORNADAS.find((j) => j.id === "ciclo").minimo - 1} teste(s) crítico(s) executado(s), mínimo ${JORNADAS.find((j) => j.id === "ciclo").minimo}`]);
});

test("portão: teste crítico pulado, falho ou instável reprova; teste sem @critica não conta para o mínimo", () => {
  const t = completo();
  t[0].status = "skipped";
  t[1].status = "unexpected";
  t[2].status = "flaky";
  const r = avaliar(relatorio([...t, { titulo: "extra", tags: ["j:auth"], status: "skipped" }]), REDE_OK);
  assert.ok(r.problemas.some((p) => /PULADO/.test(p)));
  assert.ok(r.problemas.some((p) => /FALHOU/.test(p)));
  assert.ok(r.problemas.some((p) => /repetição/.test(p)));
  assert.ok(!r.problemas.some((p) => /extra/.test(p)), "o teste sem @critica não reprova por pulo");
});

test("portão: navegador que tenta projeto hospedado, ou não chama a API local, reprova", () => {
  assert.ok(avaliar(relatorio(completo()), [{ api: 5, hospedado: ["abc.supabase.co"] }]).problemas.some((p) => /hospedado/.test(p)));
  assert.ok(avaliar(relatorio(completo()), [{ api: 0, hospedado: [] }]).problemas.some((p) => /API local/.test(p)));
});

test("artefatos: tokens e segredos saem redigidos e estado de autenticação reprova", () => {
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJlLWRlLXRlc3Rl";
  assert.equal(redigir(`Bearer ${jwt}`), "Bearer [JWT removido]");
  assert.equal(redigir('{"refresh_token":"abc123xyz"}'), '{"refresh_token":"[token removido]"}');
  assert.equal(redigir("senha e2e-local-Triliva-2026 aqui", ["e2e-local-Triliva-2026"]), "senha [segredo removido] aqui");

  const base = mkdtempSync(join(tmpdir(), "e2e-art-"));
  const app = join(base, "app");
  const origem = join(app, "e2e-resultados");
  mkdirSync(join(origem, "saida", "teste-x"), { recursive: true });
  writeFileSync(join(origem, "resultados.json"), JSON.stringify({ erro: `token ${jwt}`, chave: "sb_secret_abcdefghijklmnop" }));
  writeFileSync(join(origem, "saida", "teste-x", "error-context.md"), `tela com ${jwt}`);
  writeFileSync(join(origem, "saida", "teste-x", "trace.zip"), "x");
  const saida = join(base, "art");
  sanitizar({ origem, saida, appDir: app, segredos: [] });
  const res = readFileSync(join(saida, "resultados.json"), "utf8");
  assert.ok(!res.includes("eyJ") && !res.includes("sb_secret_"), res);
  assert.ok(readFileSync(join(saida, "falhas", "teste-x", "error-context.md"), "utf8").includes("[JWT removido]"));
  assert.equal(existsSync(join(saida, "falhas", "teste-x", "trace.zip")), false, "trace nunca sobe");

  writeFileSync(join(app, "storage-state.json"), "{}");
  assert.throws(() => sanitizar({ origem, saida, appDir: app, segredos: [] }), /estado de autenticação salvo/);
});
