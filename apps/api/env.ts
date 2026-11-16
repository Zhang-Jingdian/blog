import { defineEnv, string, url } from "void/env";

// Named export gives callers direct typing (oxlint can't see the `void/env` augmentation).
export const env = defineEnv({
  ADMIN_ORIGIN: url().default("https://admin.pill001.com"),
  // Cloudflare Access verification for /api/admin/*. Leave both unset in local
  // development to call the admin API directly; in production they are required
  // and the API refuses admin requests until they are provided.
  CF_ACCESS_TEAM_DOMAIN: string().optional(),
  CF_ACCESS_AUD: string().optional(),
});
