import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// Tauri 期望固定的端口，若被占用会自动失败，可改端口后同步修改 src-tauri/tauri.conf.json
export default defineConfig({
  plugins: [vue()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "chrome105",
    minify: "esbuild",
    sourcemap: false,
  },
});
