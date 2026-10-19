import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";

// Etapa 4: o relato de erro diz de qual build ele veio. Na Vercel o SHA
// vem de VERCEL_GIT_COMMIT_SHA; no CI, de GITHUB_SHA; na máquina, do git.
// Sem nenhum dos três, "dev". Não é segredo: o repositório é público.
function release() {
  const env = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  if (env) return env.slice(0, 12);
  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || "dev";
  } catch {
    return "dev";
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_RELEASE": JSON.stringify(release()),
  },
  build: {
    rolldownOptions: {
      output: {
        // UXG2: o motor de animação existe só para a experiência de entrada.
        // Mantê-lo num chunk próprio evita inflar o núcleo compartilhado das
        // quatro áreas e permite cache independente após o primeiro acesso.
        manualChunks(id) {
          if (/node_modules\/(motion|motion-dom|motion-utils|framer-motion)\//.test(id)) {
            return "motion";
          }
          return undefined;
        },
      },
    },
  },
});
