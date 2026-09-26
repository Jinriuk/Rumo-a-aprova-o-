// ============================================================
// ETAPA 3 — grava o resultado da camada_http na evidência da matriz
// ------------------------------------------------------------
// Lê app/e2e-resultados/camada-http.json (escrito pelo spec
// app/e2e/http/camada-http.spec.js numa execução da stack LOCAL) e
// atualiza docs/evidencias/e2-matriz-autorizacao.json:
//   • camada_http[].observado / detalhe / status / medido_em / execucao;
//   • placar.camada_http (provados, parciais, registrados, pendentes).
// Não inventa nada: caso sem observado no arquivo fica como estava, e o
// script falha se o arquivo não tiver os 15 casos.
// Uso: node scripts/e2e/registrar-camada-http.mjs [caminho-do-resultado]
// ============================================================
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CASOS_HTTP } from "../../tests/matriz-autorizacao.mjs";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const origem = resolve(process.argv[2] ?? `${RAIZ}/app/e2e-resultados/camada-http.json`);
const destino = `${RAIZ}/docs/evidencias/e2-matriz-autorizacao.json`;

const obs = JSON.parse(readFileSync(origem, "utf8"));
const faltam = CASOS_HTTP.map((c) => c.id).filter((id) => !obs[id]);
if (faltam.length) {
  console.error(`::error::camada_http incompleta no resultado (${faltam.join(", ")})`);
  process.exit(1);
}

// provado = negado/conforme; registrado = comportamento medido que não é
// "seguro" nem "inseguro" por si (janela de claims); parcial = parte não
// observável na stack local
export const CLASSE = { negado: "provado", conforme: "provado", janela_indefinida: "registrado", parcial: "parcial" };

const ev = JSON.parse(readFileSync(destino, "utf8"));
ev.camada_http = CASOS_HTTP.map((c) => {
  const o = obs[c.id];
  return {
    ...c, camada: "http",
    observado: o.observado,
    classe: CLASSE[o.observado] ?? "divergente",
    status_http: o.status ?? null,
    detalhe: o.detalhe,
    medido_em: o.em,
    execucao: "stack Supabase local e descartável (Etapa 3, app/e2e/http/camada-http.spec.js)",
  };
});
const conta = (k) => ev.camada_http.filter((c) => c.classe === k).length;
ev.placar.camada_http = {
  casos: ev.camada_http.length,
  provados: conta("provado"),
  registrados: conta("registrado"),
  parciais: conta("parcial"),
  divergentes: conta("divergente"),
  pendente_e3: 0,
};
writeFileSync(destino, `${JSON.stringify(ev, null, 2)}\n`);
console.log(`camada_http: ${JSON.stringify(ev.placar.camada_http)} → ${destino}`);
