import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus/test/config";

export default defineConfig({
  resolve: {
    alias: {
      // `@schema` and `void/db` are virtual modules served by the Void plugin at
      // build time. Point them at real files so tests can run without a build.
      "@schema": fileURLToPath(new URL("./apps/api/db/schema.ts", import.meta.url)),
      "void/db": fileURLToPath(new URL("./apps/api/test/helpers/void-db.ts", import.meta.url)),
    },
  },
  test: {
    // Tests live next to the app they cover, so a change and its assertions sit
    // in the same directory.
    include: ["apps/*/test/**/*.test.ts", "packages/*/test/**/*.test.ts"],
    environment: "node",
    // better-sqlite3 is a native module; the default `forks` pool isolates each
    // test file in its own process, which is what we want.
    fileParallelism: false,
  },
});
