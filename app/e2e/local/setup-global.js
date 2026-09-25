// @ts-check
/* ETAPA 3 — antes de QUALQUER teste: a trava de destino inteira.
   Host local, sem *.supabase.co, id de execução e o marcador da fixture
   no próprio banco. Se algo não confere, nenhum teste roda. */
import { carregarAmbiente } from "./ambiente.js";
import { travaCompleta } from "../../../scripts/e2e/trava.mjs";
import { pg } from "../../../scripts/e2e/deps.mjs";

export default async function setupGlobal() {
  const amb = carregarAmbiente();
  const db = new pg.Client({ connectionString: amb.dbUrl });
  await db.connect();
  try {
    await travaCompleta(db, process.env);
  } finally {
    await db.end();
  }
  console.log(`E2E local: trava ok (run ${amb.runId}, API ${amb.apiUrl})`);
}
