import { Hono } from "hono";
import envelope from "../../../apps/api/middleware/01.envelope.ts";

import * as blogsIndex from "../../../apps/api/routes/api/blogs/index.ts";
import * as blogBySlug from "../../../apps/api/routes/api/blogs/[slug].ts";
import * as adminPostsIndex from "../../../apps/api/routes/api/admin/posts/index.ts";
import * as adminPostById from "../../../apps/api/routes/api/admin/posts/[id].ts";
import * as adminPostStatus from "../../../apps/api/routes/api/admin/posts/[id]/status.ts";
import * as adminTagsIndex from "../../../apps/api/routes/api/admin/tags/index.ts";
import * as adminTagById from "../../../apps/api/routes/api/admin/tags/[id].ts";
import * as adminCategoriesIndex from "../../../apps/api/routes/api/admin/categories/index.ts";
import * as adminCategoryById from "../../../apps/api/routes/api/admin/categories/[id].ts";

// Mirrors Void's `convertReturnValue` (`void/response`): a plain object or
// array becomes JSON, a string becomes text/html, and a Response passes through.
function convertReturnValue(value: unknown): Response {
  if (value instanceof Response) return value;
  if (value === null || value === undefined) return new Response(null, { status: 204 });
  if (typeof value === "string") {
    return new Response(value, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  return Response.json(value);
}

// Mirrors Void's `createHttpRouteHandler`: run the exported handler and convert
// its return value into a Response.
function route(handler: (c: any) => unknown) {
  return async (c: any) => convertReturnValue(await handler(c));
}

// Build a Hono app with the same shape as the compiled Void app: the envelope
// middleware runs first, routes are registered by method, and thrown AppErrors
// become their own envelope responses (the `getResponse()` convention).
export function createApp(): Hono {
  const app = new Hono();

  app.use("*", envelope);

  app.onError((err, c) => {
    if (
      err !== null &&
      typeof err === "object" &&
      "getResponse" in err &&
      typeof (err as { getResponse?: unknown }).getResponse === "function"
    ) {
      return (err as { getResponse(): Response }).getResponse();
    }
    console.error(err);
    return c.json({ code: 500, message: "Internal Server Error", data: null }, 500);
  });

  app.get("/api/blogs", route(blogsIndex.GET));
  app.get("/api/blogs/:slug", route(blogBySlug.GET));

  app.get("/api/admin/posts", route(adminPostsIndex.GET));
  app.post("/api/admin/posts", route(adminPostsIndex.POST));
  app.get("/api/admin/posts/:id", route(adminPostById.GET));
  app.put("/api/admin/posts/:id", route(adminPostById.PUT));
  app.delete("/api/admin/posts/:id", route(adminPostById.DELETE));
  app.patch("/api/admin/posts/:id/status", route(adminPostStatus.PATCH));

  app.get("/api/admin/tags", route(adminTagsIndex.GET));
  app.post("/api/admin/tags", route(adminTagsIndex.POST));
  app.put("/api/admin/tags/:id", route(adminTagById.PUT));
  app.delete("/api/admin/tags/:id", route(adminTagById.DELETE));

  app.get("/api/admin/categories", route(adminCategoriesIndex.GET));
  app.post("/api/admin/categories", route(adminCategoriesIndex.POST));
  app.put("/api/admin/categories/:id", route(adminCategoryById.PUT));
  app.delete("/api/admin/categories/:id", route(adminCategoryById.DELETE));

  return app;
}

export interface JsonResponse {
  status: number;
  body: { code: number; message: string; data: any };
}

// Perform a request against the app and parse the JSON response body.
export async function request(app: Hono, path: string, init?: RequestInit): Promise<JsonResponse> {
  const res = await app.request(path, init);
  return { status: res.status, body: await res.json() };
}

export function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}
