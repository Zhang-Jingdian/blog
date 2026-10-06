import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { HttpsProxyAgent } from "https-proxy-agent";
import { defineConfig, lazyPlugins } from "vite-plus";
import vueDevTools from "vite-plugin-vue-devtools";

// Forward API calls (including /api/auth) to a Void API. Keeping changeOrigin
// off preserves the browser's Origin, which Better Auth checks against its
// trustedOrigins, and keeps cookies same-origin — so no CORS is involved.
//
// Defaults to the local API. To manage a deployed API, point it there:
//   HTTPS_PROXY=http://127.0.0.1:7897 \
//   VITE_API_PROXY_TARGET=https://api.example.workers.dev pnpm --filter admin dev
const target = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:8787";

// The proxy runs in Node, which does not use the system proxy: a deployed API
// that is only reachable through one would hang (and the app would sit on an
// unresolved session check). Tunnel via HTTPS_PROXY when the target is https.
const upstreamProxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
const agent =
  upstreamProxy && target.startsWith("https:") ? new HttpsProxyAgent(upstreamProxy) : undefined;

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
    proxy: {
      "/api": {
        target,
        // Must be true when tunnelling through a proxy: the TLS handshake (and
        // the API's own origin) must use the target host, not localhost. The
        // API trusts the browser's localhost Origin — see apps/api/auth.ts.
        changeOrigin: true,
        agent,
      },
    },
  },
});
