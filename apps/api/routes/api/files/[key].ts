import { defineHandler } from "void";
import { storage } from "void/storage";

// GET /api/files/:key — stream an uploaded object (e.g. a cover image) from R2.
export const GET = defineHandler(async (c) => {
  const key = c.req.param("key")!;
  const object = await storage.get(key);
  if (!object) return new Response(null, { status: 404 });

  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
});
