import { defineMiddleware } from "void";
import { env } from "../env.ts";
import { AppError } from "../src/lib/error.ts";
import { withHeaders } from "../src/lib/http.ts";

// Admin routes are called cross-origin with the Cloudflare Access cookie, so
// they need a specific origin + credentials; public routes keep the wildcard.
const BASE_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

function corsHeaders(path: string): Record<string, string> {
  if (path.startsWith("/api/admin/")) {
    return {
      ...BASE_HEADERS,
      "Access-Control-Allow-Origin": env.ADMIN_ORIGIN,
      "Access-Control-Allow-Credentials": "true",
    };
  }
  return {
    ...BASE_HEADERS,
    "Access-Control-Allow-Origin": "*",
  };
}

// Allow the admin SPA (deployed on its own origin) to call the API from the
// browser. Runs before the envelope middleware so preflight OPTIONS requests
// are answered here and never reach a route handler.
export default defineMiddleware(async (c, next) => {
  const headers = corsHeaders(c.req.path);

  if (c.req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    await next();
  } catch (error) {
    // Handlers signal expected failures by throwing AppError (400/401/404/…).
    // Building the response here instead of letting Hono's onError do it keeps
    // the CORS headers on it — without them the browser hides the status from
    // the SPA and a rejected request looks like a network failure.
    if (!(error instanceof AppError)) throw error;
    c.res = withHeaders(error.getResponse(), headers);
    return;
  }

  // Apply CORS headers to the final response. The envelope middleware and route
  // handlers replace `c.res` after this middleware runs, which drops any header
  // set before `next()`, so (re)set them here on the finalized response.
  for (const [key, value] of Object.entries(headers)) {
    c.header(key, value);
  }
});
