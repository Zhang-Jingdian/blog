import { defineMiddleware } from "void";
import { env } from "../env.ts";
import { AppError } from "../src/lib/error.ts";
import { verifyAccessJwt, type JwksFetcher } from "../src/lib/access.ts";

const ADMIN_PREFIX = "/api/admin/";
const ASSERTION_HEADER = "cf-access-jwt-assertion";

export interface AdminGuardOptions {
  // Zero Trust team domain and Access application AUD tag; both are required for
  // verification to happen at all.
  teamDomain?: string;
  audience?: string;
  // Production must fail closed: an unconfigured guard is a misconfiguration,
  // not an invitation to serve the admin API to everyone.
  isProduction: boolean;
  fetchJwks?: JwksFetcher;
  warn?: (message: string) => void;
}

// Reject requests to the admin API that did not come through Cloudflare Access.
// Paths outside /api/admin/ are untouched, so the public API stays open.
export async function assertAdminAccess(
  request: { path: string; header: (name: string) => string | undefined },
  options: AdminGuardOptions,
): Promise<void> {
  if (!request.path.startsWith(ADMIN_PREFIX)) return;

  const { teamDomain, audience } = options;
  if (!teamDomain || !audience) {
    if (options.isProduction) {
      throw new AppError(
        500,
        "Admin API authentication is not configured (CF_ACCESS_TEAM_DOMAIN / CF_ACCESS_AUD)",
      );
    }
    options.warn?.(
      "Access JWT verification is disabled because CF_ACCESS_TEAM_DOMAIN / CF_ACCESS_AUD are unset. The admin API is unauthenticated in this environment.",
    );
    return;
  }

  const token = request.header(ASSERTION_HEADER);
  if (!token) throw new AppError(401, "Missing Cf-Access-Jwt-Assertion header");

  await verifyAccessJwt(token, { teamDomain, audience, fetchJwks: options.fetchJwks });
}

let warnedOnce = false;

function warnOnce(message: string): void {
  if (warnedOnce) return;
  warnedOnce = true;
  console.warn(`[access] ${message}`);
}

// The env values are read per request: `void/env` resolves bindings from the
// Cloudflare runtime, which does not exist at module load time (and is missing
// entirely under vitest).
export default defineMiddleware(async (c, next) => {
  await assertAdminAccess(c.req, {
    teamDomain: env.CF_ACCESS_TEAM_DOMAIN,
    audience: env.CF_ACCESS_AUD,
    isProduction: import.meta.env.PROD,
    warn: warnOnce,
  });
  await next();
});
