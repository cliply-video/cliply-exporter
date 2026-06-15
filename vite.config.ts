import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Self-contained Tauri webview SPA. No monorepo coupling — "@" maps to ./src.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  server: { port: 1420, strictPort: true },
  build: { outDir: "dist", emptyOutDir: true, target: "es2022" },
});
