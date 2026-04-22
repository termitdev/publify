// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],

  // === LINHAS MÁGICAS QUE CONSERTAM O HORÁRIO DE SP ===
  define: {
    "process.env.TZ": JSON.stringify("America/Sao_Paulo"),
  },
  // ================================================

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));