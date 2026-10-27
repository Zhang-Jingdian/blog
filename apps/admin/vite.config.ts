import { fileURLToPath, URL } from "node:url";

import { defineConfig, lazyPlugins, loadEnv } from "vite-plus";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    fmt: {
      semi: false,
      singleQuote: true,
    },
    plugins: lazyPlugins(() => [vue(), vueDevTools(), tailwindcss()]),
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: 5174,
      proxy: {
        "/api": env.VITE_API_PROXY_TARGET,
      },
    },
  };
});
