import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
