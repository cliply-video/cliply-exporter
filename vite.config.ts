import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tauriConf from "./src-tauri/tauri.conf.json";

// Self-contained Tauri webview SPA. No monorepo coupling — "@" maps to ./src.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  // Single source of truth for the displayed version: the bundle version in
  // tauri.conf.json (release CI syncs it from the git tag before building).
  define: { __APP_VERSION__: JSON.stringify(tauriConf.version) },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  server: { port: 1420, strictPort: true },
  build: { outDir: "dist", emptyOutDir: true, target: "es2022" },
});
