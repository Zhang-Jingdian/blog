import { defineConfig } from "vite-plus";
import { voidPlugin } from "void";

// `voidPlugin()` boots a Worker dev server, which conflicts with Vitest's own
// server. Skip it during test runs so pure-function tests (`vp test`) can run.
// `process` is available in the Node context that loads this config, but the
// app's tsconfig only loads Vite/void ambient types — declare the minimal shape.
declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  plugins: process.env.VITEST ? [] : [voidPlugin()],
  server: {
    // Pin the API to a high port so it never collides with the frontends
    // (Vite defaults to 5173 and silently drifts when that port is taken).
    port: 8787,
    strictPort: true,
  },
  test: {
    environment: "node",
  },
});
