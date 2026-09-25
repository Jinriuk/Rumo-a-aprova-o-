// @ts-check
/* ETAPA 3 — ambiente da stack local para os testes.
   Lê $E2E_WORKDIR/local.env (escrito por scripts/e2e/stack.sh) quando
   as variáveis ainda não estão no processo. Nada daqui é segredo: são
   as chaves de demonstração da CLI, válidas só na stack local. */
import { carregarLocalEnv } from "../../../scripts/e2e/ambiente.mjs";

export function carregarAmbiente() {
  carregarLocalEnv(process.env);
  const faltam = ["E2E_API_URL", "E2E_ANON_KEY", "E2E_SERVICE_ROLE_KEY", "E2E_DB_URL", "E2E_MAIL_URL", "E2E_RUN_ID"]
    .filter((k) => !process.env[k]);
  if (faltam.length) {
    throw new Error(`E2E local sem ambiente (${faltam.join(", ")}): suba a stack com scripts/e2e/rodar.sh`);
  }
  return {
    apiUrl: process.env.E2E_API_URL,
    anonKey: process.env.E2E_ANON_KEY,
    serviceKey: process.env.E2E_SERVICE_ROLE_KEY,
    dbUrl: process.env.E2E_DB_URL,
    mailUrl: process.env.E2E_MAIL_URL,
    functionsUrl: process.env.E2E_FUNCTIONS_URL || `${process.env.E2E_API_URL}/functions/v1`,
    runId: process.env.E2E_RUN_ID,
  };
}
