import { defineMiddleware } from "void";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

// Allow the admin SPA (deployed on its own origin) to call the API from the
// browser. Runs before the envelope middleware so preflight OPTIONS requests
// are answered here and never reach a route handler.
export default defineMiddleware(async (c, next) => {
  if (c.req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  await next();

  // Apply CORS headers to the final response. The envelope middleware and route
  // handlers replace `c.res` after this middleware runs, which drops any header
  // set before `next()`, so (re)set them here on the finalized response.
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    c.header(key, value);
  }
});
