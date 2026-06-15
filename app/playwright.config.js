// @ts-check
/* Fase 14.5 — Suíte E2E de estabilização (antes da Fase 15).
   Dirige o app REAL (build de produção via `vite preview`) contra o
   Supabase de demonstração. Sem mock: login real, RLS real, dados
   reais do seed (Vitrine + Beta). Os fluxos de escrita ou são apenas
   de validação (não salvam) ou restauram o estado depois.

   Pré-requisito de browser (uma vez):  npm run test:e2e:install
   Rodar:                               npm run test:e2e            */
import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // o seed é compartilhado: rodar serial evita corrida em escritas/restauros
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    // Fase 17 — evidência em qualquer falha (não só na 1ª retry):
    // trace + vídeo + screenshot ficam anexados ao relatório/artefato.
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } }, // ~390px de largura
  ],
  // sobe o preview sozinho; reaproveita se já estiver no ar
  webServer: {
    command: "npm run build && npm run preview -- --port " + PORT,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
