import { defineHandler } from "void";
import { storage } from "void/storage";
import { AppError } from "../../../../src/lib/error.ts";
import { IMAGE_EXT, MAX_SIZE, matchesImageMagic } from "../../../../src/lib/upload.ts";

// POST /api/admin/uploads — store a cover image in R2 and return its URL.
export const POST = defineHandler(async (c) => {
  const raw = c.req.header("content-type") ?? "";
  const contentType = raw.split(";")[0]?.trim().toLowerCase() ?? "";
  const ext = IMAGE_EXT[contentType];
  if (!ext) throw new AppError(415, "Unsupported image type");

  const bytes = await c.req.arrayBuffer();
  if (bytes.byteLength === 0) throw new AppError(400, "Empty file");
  if (bytes.byteLength > MAX_SIZE) throw new AppError(413, "Image too large");
  if (!matchesImageMagic(contentType, new Uint8Array(bytes))) {
    throw new AppError(415, "File content does not match its declared image type");
  }

  const key = `cover-${crypto.randomUUID()}.${ext}`;
  await storage.put(key, bytes, { httpMetadata: { contentType } });

  return { url: new URL(`/api/files/${key}`, c.req.url).toString() };
});
