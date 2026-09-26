// @ts-check
/* ETAPA 3 — `test` dos specs de navegador, com a guarda de rede.
   Toda requisição de QUALQUER página do teste passa por aqui (a rota é
   posta no contexto, não só na página padrão, e contextos extras nascem
   pelo fixture `novoContexto`, com a mesma guarda):
     • para 127.0.0.1/localhost segue normal (front e stack local);
     • para *.supabase.co é BLOQUEADA e reprova o teste: o front do
       E2E nunca pode falar com projeto hospedado;
     • para qualquer outro host (ex.: fontes) é bloqueada e anotada.
   Ao fim de cada teste, as contagens vão para e2e-resultados/rede.jsonl:
   é a prova de que o navegador chamou o backend LOCAL. */
import { test as base, expect } from "@playwright/test";
import { appendFileSync, mkdirSync } from "node:fs";
import { carregarAmbiente } from "./ambiente.js";
import { guiaJaVistoNaPagina, PREFIXO_GUIA } from "../../../scripts/captura/pack-v2-lib.mjs";

const amb = carregarAmbiente();
const API = new URL(amb.apiUrl);
const LOCAIS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
// fontes da web: respondidas aqui com corpo vazio (nada sai da máquina e
// o console não ganha erro de recurso bloqueado); layout usa o fallback
const FONTES = /^fonts\.(googleapis|gstatic)\.com$/i;

/** Põe a guarda de rede e o "guia já visto" num contexto de navegador. */
async function protegerContexto(ctx, reg) {
  // o convite do guia (#150) aparece em todo navegador limpo; as jornadas
  // partem de quem já entrou antes (o mesmo que a captura faz)
  await ctx.addInitScript(guiaJaVistoNaPagina, PREFIXO_GUIA);
  await ctx.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.protocol === "data:" || u.protocol === "blob:") return route.continue();
    if (LOCAIS.has(u.hostname)) {
      if (u.host === API.host) reg.api++; else reg.front++;
      return route.continue();
    }
    if (FONTES.test(u.hostname)) {
      reg.fontes++;
      return route.fulfill({ status: 200, contentType: "text/css", body: "" });
    }
    if (/(^|\.)supabase\.(co|com|in)$/i.test(u.hostname)) reg.hospedado.push(u.host);
    else reg.bloqueadas.push(u.host);
    return route.abort("blockedbyclient");
  });
}

export const test = base.extend({
  rede: [async ({ context }, use, info) => {
    const reg = { api: 0, front: 0, fontes: 0, bloqueadas: [], hospedado: [] };
    await protegerContexto(context, reg);
    await use(reg);
    mkdirSync("e2e-resultados", { recursive: true });
    appendFileSync("e2e-resultados/rede.jsonl", JSON.stringify({
      teste: info.titlePath.join(" › "), projeto: info.project.name,
      api: reg.api, front: reg.front, fontes: reg.fontes, bloqueadas: [...new Set(reg.bloqueadas)], hospedado: reg.hospedado,
    }) + "\n");
    expect(reg.hospedado, "o navegador tentou falar com projeto hospedado").toEqual([]);
  }, { auto: true }],

  /** Contexto extra (outra pessoa, outro navegador) com a MESMA guarda e a
   *  mesma contagem do teste. Fecha sozinho no fim. */
  novoContexto: async ({ browser, rede }, usar) => {
    const abertos = [];
    await usar(async (opcoes = {}) => {
      const ctx = await browser.newContext(opcoes);
      await protegerContexto(ctx, rede);
      abertos.push(ctx);
      return ctx;
    });
    for (const ctx of abertos) await ctx.close().catch(() => {});
  },
});

export { expect };
