import { defineConfig, searchForWorkspaceRoot } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { relayDesktopAliases } from "./vite.aliases.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: relayDesktopAliases(here),
    // Shared UI under ../src must use the desktop locale provider's context.
    dedupe: ["react", "react-dom", "use-intl", "@tiptap/core", "@tiptap/pm"],
  },
  clearScreen: false,
  server: {
    fs: { allow: [searchForWorkspaceRoot(here), path.resolve(here, '../node_modules/katex/dist/fonts')] },
    port: 1420,
    strictPort: true,
    host: host || "127.0.0.1",
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : {
          protocol: "ws",
          host: "127.0.0.1",
          port: 1420,
        },
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  optimizeDeps: {
    exclude: ["tauri-plugin-snap-layout", "@quickdrawjs/core", "@quickdrawjs/react"],
  },
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
