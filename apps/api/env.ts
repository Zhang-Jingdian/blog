import { defineEnv, url } from "void/env";

// Named export gives callers direct typing (oxlint can't see the `void/env` augmentation).
export const env = defineEnv({
  ADMIN_ORIGIN: url().default("https://admin.pill001.com"),
});
