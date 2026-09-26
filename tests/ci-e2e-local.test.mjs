// Etapa 3 — o job e2e-local do CI, lido como texto: reprova em vez de
// pular, não usa secret, derruba a stack mesmo em erro e só publica o
// artefato sanitizado. Um PR que desfizer qualquer uma dessas regras
// quebra aqui, antes de chegar ao runner.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const CI = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const inicio = CI.indexOf("\n  e2e-local:\n");
const job = CI.slice(inicio, CI.indexOf("\n  # ----", inicio + 20) > 0 ? CI.indexOf("\n  # ----", inicio + 20) : undefined);
const passos = job.split("\n      - ").slice(1);
const passo = (re) => passos.find((p) => re.test(p)) ?? "";

test("CI e2e-local: existe e não usa secret nenhum (E2E_SUPABASE_* só com valor da stack local)", () => {
  assert.ok(inicio > 0, "job e2e-local ausente");
  assert.doesNotMatch(job, /secrets\./, "o E2E local não pode ler secret");
  assert.doesNotMatch(CI, /secrets\.E2E_SUPABASE/, "E2E_SUPABASE_* nunca vem de secret do GitHub");
});

test("CI e2e-local: reprova, nunca pula", () => {
  assert.doesNotMatch(CI, /E2E PULADA|isolado == 'true'|e2e-guard/, "a lógica de pular o E2E sem ambiente voltou");
  assert.doesNotMatch(job, /continue-on-error/);
  assert.doesNotMatch(job, /^\s+if: .*(secrets|vars)\./m, "o job não pode depender de configuração para rodar");
  assert.match(passo(/Provas negativas/), /provas-negativas\.sh/);
  assert.match(passo(/suíte inteira/), /run: bash scripts\/e2e\/rodar\.sh\s*$/m, "a suíte inteira, sem filtro");
  const rel = passo(/Relatório jornada/);
  assert.match(rel, /relatorio-jornadas\.mjs/);
  assert.match(rel, /if: always\(\)/, "o relatório roda mesmo com a suíte vermelha");
});

test("CI e2e-local: a stack cai no fim mesmo em erro, e só o artefato sanitizado sobe", () => {
  const parar = passos[passos.length - 1];
  assert.match(parar, /if: always\(\)/);
  assert.match(parar, /stack\.sh parar/);
  const up = passo(/upload-artifact/);
  assert.match(up, /path: e2e-artefatos\/\s*$/m);
  assert.doesNotMatch(up, /e2e-resultados|relatorio\/|trace|\.auth/);
  assert.match(passo(/Artefatos sanitizados/), /sanitizar-artefatos\.mjs/);
});
