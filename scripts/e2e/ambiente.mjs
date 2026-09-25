// ETAPA 3 — ambiente da stack local, lido de $E2E_WORKDIR/local.env
// (escrito por scripts/e2e/stack.sh) e $E2E_WORKDIR/run_id (rodar.sh),
// sem sobrescrever o que já está no processo. Nada daqui é segredo: são
// as chaves de demonstração da CLI, válidas só na stack local.
import { readFileSync, existsSync } from "node:fs";

export function workdir(env = process.env) {
  return env.E2E_WORKDIR || `${env.RUNNER_TEMP || "/tmp"}/triliva-e2e-stack`;
}

export function carregarLocalEnv(env = process.env) {
  const w = workdir(env);
  if (existsSync(`${w}/local.env`)) {
    for (const linha of readFileSync(`${w}/local.env`, "utf8").split("\n")) {
      const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !env[m[1]]) env[m[1]] = m[2];
    }
  }
  if (!env.E2E_RUN_ID && existsSync(`${w}/run_id`)) env.E2E_RUN_ID = readFileSync(`${w}/run_id`, "utf8").trim();
  return env;
}
