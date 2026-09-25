// @ts-check
/* ETAPA 3 — fumaça HTTP da stack local (Auth, PostgREST, Edge Functions). */
import { test, expect } from "@playwright/test";
import { carregarAmbiente } from "../local/ambiente.js";

const amb = carregarAmbiente();

test("fumaça: Auth e PostgREST locais respondem com a chave publicável local", async ({ request }) => {
  const saude = await request.get(`${amb.apiUrl}/auth/v1/health`, { headers: { apikey: amb.anonKey } });
  expect(saude.status()).toBe(200);
  const rest = await request.get(`${amb.apiUrl}/rest/v1/escolas?select=id`, { headers: { apikey: amb.anonKey } });
  expect(rest.status()).toBe(200);
  expect(await rest.json(), "anon não enxerga escolas (RLS)").toEqual([]);
});

test("fumaça: Edge Function local sobe e recusa quem não tem sessão", async ({ request }) => {
  const r = await request.post(`${amb.functionsUrl}/gerar-meta`, { data: {} });
  expect(r.status()).toBe(401);
});
