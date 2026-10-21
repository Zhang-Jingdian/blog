import { defineMiddleware } from "void";

// The admin SPA lives on a different origin (https://admin.pill001.com) and
// calls /api/admin/* with credentials (the Cloudflare Access CF_Authorization
// cookie), so those routes need a specific origin + credentials instead of the
// wildcard. The public /api/posts and /api/files routes keep the wildcard.
const ADMIN_ORIGIN = "https://admin.pill001.com";

const BASE_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

function corsHeaders(path: string): Record<string, string> {
  if (path.startsWith("/api/admin/")) {
    return {
      ...BASE_HEADERS,
      "Access-Control-Allow-Origin": ADMIN_ORIGIN,
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

  await next();

  // Apply CORS headers to the final response. The envelope middleware and route
  // handlers replace `c.res` after this middleware runs, which drops any header
  // set before `next()`, so (re)set them here on the finalized response.
  for (const [key, value] of Object.entries(headers)) {
    c.header(key, value);
  }
});
