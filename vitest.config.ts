import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus/test/config";

export default defineConfig({
  resolve: {
    alias: {
      // `@schema` and `void/db` are virtual modules served by the Void plugin at
      // build time. Point them at real files so tests can run without a build.
      "@schema": fileURLToPath(new URL("./apps/api/db/schema.ts", import.meta.url)),
      "void/db": fileURLToPath(new URL("./test/api/helpers/void-db.ts", import.meta.url)),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    // better-sqlite3 is a native module; the default `forks` pool isolates each
    // test file in its own process, which is what we want.
    fileParallelism: false,
  },
});
