import { defineHandler } from "void";
import { storage } from "void/storage";

// GET /api/files/:key — stream an uploaded object (e.g. a cover image) from R2.
export const GET = defineHandler(async (c) => {
  const key = c.req.param("key")!;
  const object = await storage.get(key);
  if (!object) return new Response(null, { status: 404 });

  const contentType = object.httpMetadata?.contentType ?? "application/octet-stream";
  const headers: Record<string, string> = {
    "content-type": contentType,
    "cache-control": "public, max-age=31536000, immutable",
  };
  // SVGs can carry scripts; `sandbox` neutralizes them when the file is opened
  // as a top-level document (inside an <img> it already renders inertly).
  if (contentType === "image/svg+xml") {
    headers["content-security-policy"] = "sandbox";
  }

  return new Response(object.body, { headers });
});
