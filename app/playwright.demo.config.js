// @ts-check
/* P1.1 — E2E contra o DEMO hospedado (bdjkgrzfzoamchdpobbl), fora da
   suíte local: testDir próprio (e2e-demo/), sem o globalSetup da trava
   da Etapa 3 (que recusa *.supabase.co de propósito). Só roda quando
   pedido, com o build do demo (vite build --outDir dist-demo, que lê
   .env.production = demo) e um aluno de teste criado para a ocasião:
     DEMO_ALUNO_CODIGO=... DEMO_ALUNO_SENHA=... \
       npx playwright test -c playwright.demo.config.js questoes
   A jornada inteira (coordenação cadastra, gera credencial, aluno troca a
   senha e resolve) pede só uma coordenação de escola de teste:
     DEMO_COORD_EMAIL=... DEMO_COORD_SENHA=... \
       npx playwright test -c playwright.demo.config.js jornada
   Gasta créditos da Quest só na primeira entrega de cada missão (questão
   guardada é servida da base, sem nova chamada).

   Transporte: as chamadas ao Supabase saem do navegador e são feitas
   pelo Node do teste (e2e-demo/_transporte.js). Serve a dois casos: a
   origem local (127.0.0.1) não está na allowlist de CORS das funções, e
   há máquinas (agente atrás de proxy) em que o Chromium não alcança o
   Supabase. O app e as requisições são os mesmos; só o caminho muda.
   Atrás de proxy: NODE_USE_ENV_PROXY=1. */
import { defineConfig, devices } from "@playwright/test";

const PORT = 4174;
export default defineConfig({
  testDir: "./e2e-demo",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: "e2e-demo-resultados",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "off",
    video: "off",
    screenshot: "off",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    ...devices["Desktop Chrome"],
    viewport: { width: 1366, height: 900 },
    // máquina sem o Chromium da versão do @playwright/test
    launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined },
  },
  webServer: {
    command: `npx vite preview --outDir dist-demo --port ${PORT} --host 127.0.0.1 --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
