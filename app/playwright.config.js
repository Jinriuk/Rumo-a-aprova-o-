// @ts-check
/* ETAPA 3 — E2E contra a stack Supabase LOCAL e descartável.
   Nenhum projeto hospedado: o front é o build `--mode e2e`
   (scripts/e2e/front.sh → app/dist-e2e), que só conhece a URL local,
   e o globalSetup roda a trava de destino (host local, sem
   *.supabase.co, id de execução, marcador da fixture no banco) antes
   de qualquer teste.

   Subir tudo e rodar:  bash scripts/e2e/rodar.sh
   (stack → banco → fixture → front → esta suíte). Ver
   docs/operacao/e2e-ambiente.md.

   Projetos: desktop e mobile (navegador) e http (casos da camada_http
   da matriz de autorização, só API). Artefatos sem trace nem vídeo: o
   trace guarda cabeçalhos com o token e o localStorage com a sessão. */
import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const baseURL = `http://127.0.0.1:${PORT}`;
const executablePath = process.env.PW_CHROMIUM_PATH || undefined; // só em máquina sem o Chromium da versão

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/local/setup-global.js",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [
    ["list"],
    ["json", { outputFile: "e2e-resultados/resultados.json" }],
    ["html", { open: "never", outputFolder: "e2e-resultados/relatorio" }],
  ],
  outputDir: "e2e-resultados/saida",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "off",
    video: "off",
    screenshot: "only-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    launchOptions: { executablePath },
  },
  projects: [
    { name: "http", testMatch: /http\/.*\.spec\.js/ },
    // cada spec roda em UM projeto: nenhum teste nasce pulado por viewport
    // (a regra da Etapa 3 é zero skip nas jornadas críticas)
    { name: "desktop", testIgnore: [/http\//, /mobile\.spec\.js/], use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } } },
    { name: "mobile", testMatch: /mobile\.spec\.js/, use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npx vite preview --outDir dist-e2e --port ${PORT} --host 127.0.0.1 --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
