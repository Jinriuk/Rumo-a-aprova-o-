// ============================================================
// ETAPA 4 — o keepalive avisa o healthchecks (HC_KEEPALIVE_URL)
// ------------------------------------------------------------
// Mesma técnica da prova do #155: o `run:` de cada passo novo é extraído
// do YAML e executado com bash, com um `curl` falso no PATH que registra
// a URL chamada. As condições `if:` são travadas pela fonte.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, chmodSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const yml = readFileSync(resolve(root, ".github/workflows/manter-banco-acordado.yml"), "utf8");
const linhas = yml.split("\n");

/** Bloco do passo `- name: <nome>` até o próximo `- name:` do mesmo nível. */
function passo(nome) {
  const i = linhas.findIndex((l) => l.trim() === `- name: ${nome}`);
  assert.ok(i >= 0, `passo "${nome}" sumiu do workflow`);
  const ind = linhas[i].indexOf("-");
  let j = i + 1;
  while (j < linhas.length && !(linhas[j].indexOf("- name:") === ind)) j++;
  return linhas.slice(i, j);
}

function runDe(bloco) {
  const i = bloco.findIndex((l) => /^\s*run: \|\s*$/.test(l));
  assert.ok(i >= 0, "passo sem run: |");
  const corpo = bloco.slice(i + 1);
  const ind = corpo.find((l) => l.trim()).match(/^\s*/)[0].length;
  return corpo.filter((l) => !l.trim() || l.match(/^\s*/)[0].length >= ind).map((l) => l.slice(ind)).join("\n");
}

function executar(script, { url, curlSai = 0 }) {
  const dir = mkdtempSync(join(tmpdir(), "hc-"));
  const log = join(dir, "curl.log");
  writeFileSync(join(dir, "curl"), `#!/bin/bash\nfor a in "$@"; do last="$a"; done\necho "$last" >> "${log}"\nexit ${curlSai}\n`);
  chmodSync(join(dir, "curl"), 0o755);
  const env = { PATH: `${dir}:${process.env.PATH}` };
  if (url !== undefined) env.HC_URL = url;
  const r = spawnSync("bash", ["-e", "-c", script], { env, encoding: "utf8" });
  return { status: r.status, saida: r.stdout + r.stderr, chamadas: existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : [] };
}

const OK = "Avisar o healthchecks (as duas batidas passaram)";
const FALHA = "Avisar o healthchecks da falha";
const URL_HC = "https://hc-ping.com/00000000-0000-4000-8000-0000000000aa";

test("E4: o ping de sucesso roda só quando os passos anteriores passaram (sem if = success())", () => {
  const bloco = passo(OK);
  assert.ok(!bloco.some((l) => /^\s*if:/.test(l)), "o passo de sucesso não pode ter if: (always() pingaria com batida falha)");
  assert.ok(bloco.some((l) => l.includes("secrets.HC_KEEPALIVE_URL")));
  const i = linhas.indexOf(bloco[0]);
  assert.ok(i > linhas.findIndex((l) => l.trim() === "- name: Bater no REST de produção"));
  assert.ok(i > linhas.findIndex((l) => l.trim() === "- name: Bater no REST do demo (vitrine)"));
});

test("E4: sucesso pinga a URL sem /fail", () => {
  const r = executar(runDe(passo(OK)), { url: URL_HC });
  assert.equal(r.status, 0, r.saida);
  assert.deepEqual(r.chamadas, [URL_HC]);
});

test("E4: sem HC_KEEPALIVE_URL o passo reprova e não chama nada", () => {
  const r = executar(runDe(passo(OK)), { url: "" });
  assert.equal(r.status, 1);
  assert.match(r.saida, /::error::FALTA CONFIGURAÇÃO — sem HC_KEEPALIVE_URL/);
  assert.deepEqual(r.chamadas, []);
});

test("E4: ping que não chega reprova o passo", () => {
  const r = executar(runDe(passo(OK)), { url: URL_HC, curlSai: 7 });
  assert.equal(r.status, 1);
  assert.match(r.saida, /::error::O ping ao healthchecks falhou/);
});

test("E4: falha de uma batida pinga /fail; falha só do ping não", () => {
  const bloco = passo(FALHA);
  const cond = bloco.find((l) => /^\s*if:/.test(l));
  assert.match(cond, /failure\(\)/);
  assert.match(cond, /steps\.prod\.outcome == 'failure'/);
  assert.match(cond, /steps\.demo\.outcome == 'failure'/);
  assert.ok(passo("Bater no REST de produção").some((l) => l.trim() === "id: prod"));
  assert.ok(passo("Bater no REST do demo (vitrine)").some((l) => l.trim() === "id: demo"));
  const r = executar(runDe(bloco), { url: `${URL_HC}/` });
  assert.equal(r.status, 0, r.saida);
  assert.deepEqual(r.chamadas, [`${URL_HC}/fail`]);
});
