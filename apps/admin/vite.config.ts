import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite-plus";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";
import { lazyPlugins } from "vite-plus";

// https://vite.dev/config/
export default defineConfig({
  fmt: {
    semi: false,
    singleQuote: true,
  },
  plugins: lazyPlugins(() => [vue(), vueDevTools()]),
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Forward API calls (including /api/auth) to a Void API. Keeping changeOrigin
    // off preserves the browser's Origin, which Better Auth checks against its
    // trustedOrigins, and keeps cookies same-origin — so no CORS is involved.
    //
    // Defaults to the local API. To manage a deployed API, point it there:
    //   VITE_API_PROXY_TARGET=https://api.example.workers.dev pnpm --filter admin dev
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:8787",
        changeOrigin: false,
      },
    },
  },
});
